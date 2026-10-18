import crypto from 'node:crypto';
import {
  PIPELINE_VERSION,
  SKILL_SPEC_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  VALIDATOR_VERSION,
  type ErrorCode,
  type ExtractionCandidateEnvelope,
  type JobStage,
} from '../../shared/contracts.js';
import { canonicalizeVideoUrl } from '../../shared/url-canonicalizer.js';
import type { DatabaseClient } from '../db/index.js';
import {
  computeIdempotencyKey,
  computeSha256,
  parseTranscriptSegments,
} from './idempotency.js';
import {
  YouTubeShortsAdapter,
  cleanupTempJobMedia,
} from '../acquisition/youtube-adapter.js';
import { InstagramReelAdapter } from '../acquisition/instagram-adapter.js';
import {
  StructuredLlmExtractor,
  type EvidencePromptSegment,
} from '../extraction/llm-extractor.js';
import { validateCandidateEnvelope } from '../validation/validator.js';

export const MAX_JOB_ATTEMPTS = 5;

export interface WorkerDependencies {
  db: DatabaseClient;
  youtubeAdapter?: YouTubeShortsAdapter;
  instagramAdapter?: InstagramReelAdapter;
  llmExtractor?: StructuredLlmExtractor;
  runAsync?: boolean;
}

export interface SubmitJobResult {
  ok: true;
  jobId: string;
  sourceId: string;
  reusedExisting: boolean;
  status: string;
}

export interface SubmitJobFailure {
  ok: false;
  errorCode: ErrorCode;
  message: string;
}

export class JobPipelineService {
  private readonly db: DatabaseClient;
  private readonly youtubeAdapter: YouTubeShortsAdapter;
  private readonly instagramAdapter: InstagramReelAdapter;
  private readonly llmExtractor: StructuredLlmExtractor;
  private readonly runAsync: boolean;

  constructor(deps: WorkerDependencies) {
    this.db = deps.db;
    this.youtubeAdapter = deps.youtubeAdapter ?? new YouTubeShortsAdapter();
    this.instagramAdapter =
      deps.instagramAdapter ?? new InstagramReelAdapter();
    this.llmExtractor = deps.llmExtractor ?? new StructuredLlmExtractor();
    this.runAsync = deps.runAsync ?? true;
  }

  async submitJob(
    userId: string,
    input: {
      url?: string;
      pastedTranscript?: string;
      sourceTitle?: string;
      language?: string;
      forceNew?: boolean;
    }
  ): Promise<SubmitJobResult | SubmitJobFailure> {
    let platform: 'youtube' | 'instagram' | 'manual' = 'manual';
    let platformContentId = '';
    let canonicalUrl = '';
    let submittedUrl = '';

    if (input.url && input.url.trim()) {
      const canon = canonicalizeVideoUrl(input.url);
      if (!canon.ok) {
        return {
          ok: false,
          errorCode: canon.errorCode,
          message: canon.message,
        };
      }
      platform = canon.platform;
      platformContentId = canon.platformContentId;
      canonicalUrl = canon.canonicalUrl;
      submittedUrl = canon.submittedUrl;
    } else if (input.pastedTranscript && input.pastedTranscript.trim()) {
      const digest = computeSha256(input.pastedTranscript.trim()).slice(0, 16);
      platform = 'manual';
      platformContentId = `transcript-${digest}`;
      canonicalUrl = `afterframe://transcript/${digest}`;
      submittedUrl = canonicalUrl;
    } else {
      return {
        ok: false,
        errorCode: 'INVALID_URL',
        message: 'Provide a supported video link or paste a transcript.',
      };
    }

    const { idempotencyKey, inputHash } = computeIdempotencyKey({
      userId,
      platform,
      platformContentId,
      pastedTranscript: input.pastedTranscript,
    });

    const txResult = await this.db.transaction(async (tx) => {
      // 1. Upsert canonical source record scoped to user
      const existingSource = await tx.query<{ id: string }>(
        `SELECT id FROM sources WHERE user_id = $1 AND platform = $2 AND platform_content_id = $3`,
        [userId, platform, platformContentId]
      );

      let sourceId: string;
      if (existingSource.rows.length > 0) {
        sourceId = existingSource.rows[0].id;
        if (input.sourceTitle?.trim()) {
          await tx.query(
            `UPDATE sources SET metadata_json = metadata_json || $1::jsonb WHERE id = $2`,
            [JSON.stringify({ title: input.sourceTitle.trim() }), sourceId]
          );
        }
      } else {
        sourceId = `src_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
        const initialMeta = input.sourceTitle?.trim()
          ? { title: input.sourceTitle.trim() }
          : {};
        await tx.query(
          `INSERT INTO sources (id, user_id, platform, submitted_url, canonical_url, platform_content_id, metadata_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            sourceId,
            userId,
            platform,
            submittedUrl,
            canonicalUrl,
            platformContentId,
            JSON.stringify(initialMeta),
          ]
        );
      }

      // 2. Check idempotent job reuse
      const existingJob = await tx.query<{
        id: string;
        status: string;
        source_id: string;
      }>(
        `SELECT id, status, source_id FROM processing_jobs WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, idempotencyKey]
      );

      if (existingJob.rows.length > 0) {
        const job = existingJob.rows[0];
        if (
          !input.forceNew &&
          job.status !== 'failed' &&
          job.status !== 'cancelled'
        ) {
          return {
            jobId: job.id,
            sourceId: job.source_id,
            reusedExisting: true,
            status: job.status,
          };
        }

        // Reset failed/cancelled or forceNew job
        await tx.query(
          `UPDATE processing_jobs
           SET status = 'queued',
               current_stage = 'queued',
               failed_stage = NULL,
               last_error_code = NULL,
               last_error_message = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [job.id]
        );

        if (input.pastedTranscript && input.pastedTranscript.trim()) {
          await this.persistUserTranscriptSegments(
            tx,
            sourceId,
            input.pastedTranscript,
            input.language ?? 'en'
          );
        }

        return {
          jobId: job.id,
          sourceId: job.source_id,
          reusedExisting: false,
          status: 'queued',
        };
      }

      // 3. Persist user-provided transcript segments if supplied (FR-059)
      if (input.pastedTranscript && input.pastedTranscript.trim()) {
        await this.persistUserTranscriptSegments(
          tx,
          sourceId,
          input.pastedTranscript,
          input.language ?? 'en'
        );
      }

      const jobId = `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
      await tx.query(
        `INSERT INTO processing_jobs (
          id, user_id, source_id, status, current_stage, attempt_count, idempotency_key, input_hash
        ) VALUES ($1, $2, $3, 'queued', 'queued', 0, $4, $5)`,
        [jobId, userId, sourceId, idempotencyKey, inputHash]
      );

      return {
        jobId,
        sourceId,
        reusedExisting: false,
        status: 'queued',
      };
    });

    if (!txResult.reusedExisting) {
      if (this.runAsync) {
        setImmediate(() => {
          this.executePipeline(txResult.jobId).catch(() => undefined);
        });
      } else {
        await this.executePipeline(txResult.jobId);
      }
    }

    return {
      ok: true,
      ...txResult,
    };
  }

  private async persistUserTranscriptSegments(
    tx: { query: DatabaseClient['query'] },
    sourceId: string,
    rawTranscript: string,
    language: string
  ): Promise<void> {
    const existingUserEv = await tx.query<{ id: string }>(
      `SELECT id FROM source_evidence WHERE source_id = $1 AND kind = 'user_provided' LIMIT 1`,
      [sourceId]
    );
    if (existingUserEv.rows.length > 0) {
      await tx.query(
        `DELETE FROM source_evidence WHERE source_id = $1 AND kind = 'user_provided' AND id NOT IN (SELECT evidence_id FROM evidence_links)`,
        [sourceId]
      );
    }

    const segments = parseTranscriptSegments(rawTranscript);
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const evId = `ev_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
      const contentHash = computeSha256(
        `${seg.startMs ?? 'none'}:${seg.text}`
      );
      await tx.query(
        `INSERT INTO source_evidence (
          id, source_id, kind, content_ref, content_text, start_ms, end_ms, language, content_hash, provenance, limitations_json, metadata_json
        ) VALUES ($1, $2, 'user_provided', $3, $4, $5, $6, $7, $8, 'user-pasted-transcript-v1', $9::jsonb, $10::jsonb)`,
        [
          evId,
          sourceId,
          `segment-${i + 1}`,
          seg.text,
          seg.startMs,
          seg.endMs,
          language,
          contentHash,
          JSON.stringify([
            'User-supplied transcript text; visual frames were not inspected.',
          ]),
          JSON.stringify({ segmentIndex: i }),
        ]
      );
    }
  }

  async executePipeline(
    jobId: string,
    startFromStage?: JobStage
  ): Promise<void> {
    try {
      const jobRes = await this.db.query<{
        id: string;
        user_id: string;
        source_id: string;
        status: string;
        attempt_count: number;
      }>(
        `SELECT id, user_id, source_id, status, attempt_count FROM processing_jobs WHERE id = $1`,
        [jobId]
      );

      if (jobRes.rows.length === 0) return;
      const job = jobRes.rows[0];
      if (job.status === 'cancelled' || job.status === 'completed') return;

      if (job.attempt_count >= MAX_JOB_ATTEMPTS) {
        await this.failJob(
          jobId,
          'acquiring',
          'PLATFORM_RATE_LIMITED',
          'Maximum retry attempts reached for this job (bounded retry limit = 5).'
        );
        return;
      }

      await this.db.query(
        `UPDATE processing_jobs SET attempt_count = attempt_count + 1, updated_at = NOW() WHERE id = $1`,
        [jobId]
      );

      const sourceRes = await this.db.query<{
        id: string;
        platform: 'youtube' | 'instagram' | 'manual';
        submitted_url: string;
        canonical_url: string;
        platform_content_id: string;
        metadata_json: Record<string, unknown>;
      }>(
        `SELECT id, platform, submitted_url, canonical_url, platform_content_id, metadata_json FROM sources WHERE id = $1`,
        [job.source_id]
      );
      if (sourceRes.rows.length === 0) return;
      const source = sourceRes.rows[0];

      // Check existing evidence for stage reuse (Section 8.5)
      const existingEv = await this.db.query<{
        id: string;
        kind: string;
      }>(`SELECT id, kind FROM source_evidence WHERE source_id = $1`, [
        source.id,
      ]);

      const hasSpokenOrUserTranscript = existingEv.rows.some(
        (e) =>
          e.kind === 'caption' ||
          e.kind === 'transcript' ||
          e.kind === 'user_provided'
      );
      const hasMetadataEv = existingEv.rows.some((e) => e.kind === 'metadata');

      // STAGE 1: ACQUIRING
      if (
        !startFromStage ||
        startFromStage === 'queued' ||
        startFromStage === 'acquiring'
      ) {
        if (await this.isCancelled(jobId)) return;
        await this.setStage(jobId, 'acquiring');

        if (source.platform !== 'manual' && !hasMetadataEv && !hasSpokenOrUserTranscript) {
          const runId = await this.startRun(
            jobId,
            'acquiring',
            source.platform === 'youtube'
              ? this.youtubeAdapter.providerId
              : this.instagramAdapter.providerId,
            null
          );
          const t0 = Date.now();
          const adapter =
            source.platform === 'youtube'
              ? this.youtubeAdapter
              : this.instagramAdapter;

          const res = await adapter.resolveMetadata({
            platform: source.platform,
            platformContentId: source.platform_content_id,
            canonicalUrl: source.canonical_url,
            submittedUrl: source.submitted_url,
          });

          const dur = Date.now() - t0;
          await this.recordMetric(
            'source_resolution',
            'acquiring',
            source.platform,
            res.ok ? 'succeeded' : 'failed',
            dur,
            res.ok ? null : res.errorCode
          );

          if (!res.ok) {
            await this.finishRunFailed(
              runId,
              dur,
              res.errorCode,
              res.safeErrorDetails
            );
            await this.failJob(
              jobId,
              'acquiring',
              res.errorCode,
              res.userMessage
            );
            return;
          }

          // Persist metadata & evidence
          await this.db.query(
            `UPDATE sources SET metadata_json = metadata_json || $1::jsonb WHERE id = $2`,
            [JSON.stringify(res.metadata.rawMetadata), source.id]
          );

          for (const item of res.evidenceItems) {
            const evId = `ev_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
            await this.db.query(
              `INSERT INTO source_evidence (
                id, source_id, kind, content_ref, content_text, start_ms, end_ms, language, content_hash, provenance, limitations_json, metadata_json
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`,
              [
                evId,
                source.id,
                item.kind,
                item.contentRef,
                item.contentText,
                item.startMs,
                item.endMs,
                item.language,
                computeSha256(item.contentText),
                item.provenance,
                JSON.stringify(item.limitations),
                JSON.stringify(item.metadata),
              ]
            );
          }

          await this.finishRunSucceeded(runId, dur, null);
        }
      }

      // STAGE 2: TRANSCRIBING
      if (
        !startFromStage ||
        startFromStage === 'queued' ||
        startFromStage === 'acquiring' ||
        startFromStage === 'transcribing'
      ) {
        if (await this.isCancelled(jobId)) return;
        await this.setStage(jobId, 'transcribing');

        const refreshedEv = await this.db.query<{ id: string; kind: string }>(
          `SELECT id, kind FROM source_evidence WHERE source_id = $1`,
          [source.id]
        );
        const alreadyHasTranscript = refreshedEv.rows.some(
          (e) =>
            e.kind === 'caption' ||
            e.kind === 'transcript' ||
            e.kind === 'user_provided'
        );

        if (!alreadyHasTranscript) {
          if (source.platform !== 'youtube') {
            await this.failJob(
              jobId,
              'transcribing',
              'TRANSCRIPT_UNAVAILABLE',
              'No transcript is available for this source. Paste the transcript to continue.'
            );
            return;
          }

          const runId = await this.startRun(
            jobId,
            'transcribing',
            this.youtubeAdapter.providerId,
            null
          );
          const t0 = Date.now();
          const capRes = await this.youtubeAdapter.fetchCaptions({
            platform: 'youtube',
            platformContentId: source.platform_content_id,
            canonicalUrl: source.canonical_url,
            submittedUrl: source.submitted_url,
          });
          const dur = Date.now() - t0;

          await this.recordMetric(
            'transcript_acquisition',
            'transcribing',
            source.platform,
            capRes.ok ? 'succeeded' : 'failed',
            dur,
            capRes.ok ? null : capRes.errorCode
          );

          if (!capRes.ok) {
            await this.finishRunFailed(
              runId,
              dur,
              capRes.errorCode,
              capRes.safeErrorDetails
            );
            await this.failJob(
              jobId,
              'transcribing',
              capRes.errorCode,
              capRes.userMessage
            );
            return;
          }

          for (const seg of capRes.segments) {
            const evId = `ev_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
            await this.db.query(
              `INSERT INTO source_evidence (
                id, source_id, kind, content_ref, content_text, start_ms, end_ms, language, content_hash, provenance, limitations_json, metadata_json
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`,
              [
                evId,
                source.id,
                seg.kind,
                seg.contentRef,
                seg.contentText,
                seg.startMs,
                seg.endMs,
                seg.language,
                computeSha256(`${seg.startMs ?? 0}:${seg.contentText}`),
                seg.provenance,
                JSON.stringify(seg.limitations),
                JSON.stringify(seg.metadata),
              ]
            );
          }

          await this.finishRunSucceeded(runId, dur, null);
        }
      }

      // STAGE 3: ANALYZING
      if (await this.isCancelled(jobId)) return;
      await this.setStage(jobId, 'analyzing');

      const evidenceRows = await this.db.query<{
        id: string;
        kind: 'metadata' | 'caption' | 'transcript' | 'visual_observation' | 'user_provided';
        start_ms: number | null;
        end_ms: number | null;
        content_text: string;
      }>(
        `SELECT id, kind, start_ms, end_ms, content_text
         FROM source_evidence
         WHERE source_id = $1
         ORDER BY start_ms ASC NULLS FIRST, created_at ASC`,
        [source.id]
      );

      const promptSegments: EvidencePromptSegment[] = evidenceRows.rows.map(
        (r) => ({
          id: r.id,
          kind: r.kind,
          startMs: r.start_ms,
          endMs: r.end_ms,
          contentText: r.content_text,
        })
      );

      const userSettingsRes = await this.db.query<{
        settings_json: { content_language?: string };
      }>(`SELECT settings_json FROM users WHERE id = $1`, [job.user_id]);
      const contentLanguage =
        userSettingsRes.rows[0]?.settings_json?.content_language ?? 'auto';

      const runId = await this.startRun(
        jobId,
        'analyzing',
        'llm-structured-extractor',
        process.env.LLM_MODEL ?? 'gpt-4o-mini'
      );

      const llmResult = await this.llmExtractor.extractFromEvidence(
        promptSegments,
        { contentLanguage }
      );

      await this.recordMetric(
        'llm_extraction',
        'analyzing',
        source.platform,
        llmResult.ok ? 'succeeded' : 'failed',
        llmResult.durationMs,
        llmResult.ok ? null : llmResult.errorCode
      );

      if (!llmResult.ok) {
        await this.finishRunFailed(
          runId,
          llmResult.durationMs,
          llmResult.errorCode,
          llmResult.safeErrorDetails
        );
        await this.failJob(
          jobId,
          'analyzing',
          llmResult.errorCode,
          llmResult.userMessage
        );
        return;
      }

      // Persist extraction_results and validation_runs atomically
      const candidateId = `cand_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
      const validationRunId = `val_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      await this.db.transaction(async (tx) => {
        await tx.query(
          `UPDATE processing_runs
           SET status = 'succeeded',
               provider_id = $1,
               model_id = $2,
               duration_ms = $3,
               token_usage_json = $4::jsonb,
               finished_at = NOW()
           WHERE id = $5`,
          [
            llmResult.providerId,
            llmResult.modelId,
            llmResult.durationMs,
            JSON.stringify(llmResult.tokenUsage ?? {}),
            runId,
          ]
        );

        await tx.query(
          `INSERT INTO extraction_results (
            id, run_id, job_id, candidate_type, recommended_type, recommendation_reason,
            schema_version, payload_json, validation_status, repair_attempts, findings_json, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12)`,
          [
            candidateId,
            runId,
            jobId,
            llmResult.envelope.recommended_type,
            llmResult.envelope.recommended_type,
            llmResult.envelope.recommendation_reason,
            PIPELINE_VERSION,
            JSON.stringify(llmResult.envelope),
            llmResult.validationStatus,
            llmResult.repairAttempts,
            JSON.stringify(llmResult.findings),
            expiresAt,
          ]
        );

        await tx.query(
          `INSERT INTO validation_runs (
            id, candidate_id, validator_version, result, findings_json
          ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [
            validationRunId,
            candidateId,
            VALIDATOR_VERSION,
            llmResult.validationStatus,
            JSON.stringify(llmResult.findings),
          ]
        );

        await tx.query(
          `UPDATE processing_jobs
           SET status = 'needs_review',
               current_stage = 'needs_review',
               failed_stage = NULL,
               last_error_code = NULL,
               last_error_message = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [jobId]
        );
      });
    } finally {
      cleanupTempJobMedia(jobId);
    }
  }

  /**
   * Stage-aware retry (UC-08, FR-051, FR-053, Section 8.5).
   * Optionally attaches a user-pasted transcript if acquisition or captioning failed.
   */
  async retryJob(
    jobId: string,
    userId: string,
    options: { pastedTranscript?: string; stage?: JobStage } = {}
  ): Promise<{ ok: boolean; message?: string }> {
    const jobRes = await this.db.query<{
      id: string;
      user_id: string;
      source_id: string;
      status: string;
      failed_stage: JobStage | null;
      attempt_count: number;
    }>(
      `SELECT id, user_id, source_id, status, failed_stage, attempt_count
       FROM processing_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );

    if (jobRes.rows.length === 0) {
      return { ok: false, message: 'Processing job not found.' };
    }

    const job = jobRes.rows[0];
    if (job.status === 'completed') {
      return {
        ok: false,
        message:
          'This job has already been confirmed and saved. Retry will not duplicate a confirmed artifact (FR-053).',
      };
    }

    if (job.attempt_count >= MAX_JOB_ATTEMPTS) {
      return {
        ok: false,
        message: `Maximum retry attempts (${MAX_JOB_ATTEMPTS}) reached for this job.`,
      };
    }

    let resumeStage: JobStage =
      options.stage ?? job.failed_stage ?? 'acquiring';

    await this.db.transaction(async (tx) => {
      if (options.pastedTranscript && options.pastedTranscript.trim()) {
        await this.persistUserTranscriptSegments(
          tx,
          job.source_id,
          options.pastedTranscript,
          'en'
        );
        resumeStage = 'analyzing';
      }

      await tx.query(
        `UPDATE processing_jobs
         SET status = $1,
             current_stage = $1,
             failed_stage = NULL,
             last_error_code = NULL,
             last_error_message = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [resumeStage, jobId]
      );
    });

    if (this.runAsync) {
      setImmediate(() => {
        this.executePipeline(jobId, resumeStage).catch(() => undefined);
      });
    } else {
      await this.executePipeline(jobId, resumeStage);
    }

    return { ok: true };
  }

  /**
   * Explicitly initializes a user-authored candidate from real source evidence
   * when the user opts to draft manually without an LLM (NFR-002, Principle 1 & 8).
   * Every field is marked `user_edited` so it is never mistaken for model output.
   */
  async createManualDraftFromEvidence(
    jobId: string,
    userId: string
  ): Promise<{ ok: boolean; message?: string }> {
    const jobRes = await this.db.query<{
      id: string;
      source_id: string;
      status: string;
    }>(
      `SELECT id, source_id, status FROM processing_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );
    if (jobRes.rows.length === 0) {
      return { ok: false, message: 'Job not found.' };
    }
    const job = jobRes.rows[0];

    const evRes = await this.db.query<{
      id: string;
      kind: 'metadata' | 'caption' | 'transcript' | 'visual_observation' | 'user_provided';
      content_text: string;
    }>(
      `SELECT id, kind, content_text FROM source_evidence
       WHERE source_id = $1
       ORDER BY start_ms ASC NULLS FIRST, created_at ASC`,
      [job.source_id]
    );

    const textSegments = evRes.rows.filter((r) => r.kind !== 'metadata');
    if (textSegments.length === 0) {
      return {
        ok: false,
        message:
          'Paste a transcript first so there is real source evidence to draft from.',
      };
    }

    const sourceRes = await this.db.query<{
      metadata_json: { title?: string };
      platform_content_id: string;
    }>(`SELECT metadata_json, platform_content_id FROM sources WHERE id = $1`, [
      job.source_id,
    ]);

    const rawTitle =
      sourceRes.rows[0]?.metadata_json?.title?.trim() ||
      textSegments[0].content_text.slice(0, 68).trim() ||
      'User-authored draft from transcript';

    const slug =
      rawTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'manual-skill';

    const envelope: ExtractionCandidateEnvelope = {
      schema_version: PIPELINE_VERSION,
      recommended_type: 'task',
      recommendation_reason:
        'Initialized directly from your supplied transcript segments for manual review and editing (no AI model used).',
      task_candidate: {
        schema_version: TASK_SCHEMA_VERSION,
        artifact_type: 'task',
        title: rawTitle,
        description: textSegments.map((s) => s.content_text).join(' ').slice(0, 600),
        steps: textSegments.slice(0, 12).map((seg, idx) => ({
          id: `step_${idx + 1}`,
          position: idx,
          title: seg.content_text.slice(0, 140),
          description: seg.content_text,
          provenance_kind: 'user_edited' as const,
          is_inferred: false,
          is_user_edited: true,
          evidence_refs: [seg.id],
          caveats: null,
        })),
        topics: ['general'],
        estimated_minutes: null,
        deadline: null,
        priority: null,
      },
      skill_candidate: {
        schema_version: SKILL_SPEC_SCHEMA_VERSION,
        artifact_type: 'ai_skill',
        identity: {
          name: slug.length >= 2 ? slug : 'manual-skill',
          title: rawTitle,
          summary: textSegments[0].content_text.slice(0, 200),
          description: textSegments
            .map((s) => s.content_text)
            .join(' ')
            .slice(0, 600),
        },
        intended_use: ['Apply the workflow described in the source transcript'],
        non_use_conditions: [
          'Do not apply outside the scope described in the source transcript',
        ],
        trigger_examples: [`Run the ${rawTitle.slice(0, 50)} workflow`],
        input_contract: {
          fields: [
            {
              name: 'target_context',
              type: 'text_block',
              required: true,
              description: 'Context or code to apply the instructions to',
            },
          ],
          notes: 'Authored from user-supplied transcript evidence.',
        },
        workflow_steps: textSegments.slice(0, 12).map((seg, idx) => ({
          id: `wf_step_${idx + 1}`,
          position: idx,
          title: seg.content_text.slice(0, 140),
          instruction: seg.content_text,
          condition: null,
          provenance_kind: 'user_edited' as const,
          is_inferred: false,
          is_user_edited: true,
          evidence_refs: [seg.id],
        })),
        output_contract: {
          format: 'markdown',
          description: 'Structured checklist following the source transcript steps.',
          verification_criteria: [
            'All steps from the source transcript have been addressed.',
          ],
        },
        capability_declarations: ['instruction_only'],
        topics: ['general'],
      },
      evidence_summary: {
        transcript_analyzed: true,
        visual_frames_analyzed: 0,
        visual_note: 'Visual frames: not analyzed. User-authored draft from transcript.',
      },
    };

    const validation = validateCandidateEnvelope(
      envelope,
      evRes.rows.map((r) => ({ id: r.id, kind: r.kind }))
    );

    const runId = `run_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const candidateId = `cand_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const valId = `val_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO processing_runs (
          id, job_id, stage, pipeline_version, provider_id, model_id, schema_version, status, duration_ms, finished_at
        ) VALUES ($1, $2, 'analyzing', $3, 'user-manual-draft', 'none', $3, 'succeeded', 0, NOW())`,
        [runId, jobId, PIPELINE_VERSION]
      );

      await tx.query(
        `INSERT INTO extraction_results (
          id, run_id, job_id, candidate_type, recommended_type, recommendation_reason,
          schema_version, payload_json, validation_status, repair_attempts, findings_json, expires_at
        ) VALUES ($1, $2, $3, 'task', 'task', $4, $5, $6::jsonb, $7, 0, $8::jsonb, $9)`,
        [
          candidateId,
          runId,
          jobId,
          envelope.recommendation_reason,
          PIPELINE_VERSION,
          JSON.stringify(envelope),
          validation.status === 'invalid' ? 'warnings' : validation.status,
          JSON.stringify(validation.findings),
          expiresAt,
        ]
      );

      await tx.query(
        `INSERT INTO validation_runs (
          id, candidate_id, validator_version, result, findings_json
        ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          valId,
          candidateId,
          VALIDATOR_VERSION,
          validation.status === 'invalid' ? 'warnings' : validation.status,
          JSON.stringify(validation.findings),
        ]
      );

      await tx.query(
        `UPDATE processing_jobs
         SET status = 'needs_review',
             current_stage = 'needs_review',
             failed_stage = NULL,
             last_error_code = NULL,
             last_error_message = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [jobId]
      );
    });

    return { ok: true };
  }

  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE processing_jobs
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status NOT IN ('completed', 'cancelled')`,
      [jobId, userId]
    );
    cleanupTempJobMedia(jobId);
    return res.rowCount > 0;
  }

  private async isCancelled(jobId: string): Promise<boolean> {
    const res = await this.db.query<{ status: string }>(
      `SELECT status FROM processing_jobs WHERE id = $1`,
      [jobId]
    );
    return res.rows[0]?.status === 'cancelled';
  }

  private async setStage(jobId: string, stage: JobStage): Promise<void> {
    await this.db.query(
      `UPDATE processing_jobs
       SET status = $1, current_stage = $1, updated_at = NOW()
       WHERE id = $2 AND status != 'cancelled'`,
      [stage, jobId]
    );
  }

  private async startRun(
    jobId: string,
    stage: 'acquiring' | 'transcribing' | 'analyzing',
    providerId: string | null,
    modelId: string | null
  ): Promise<string> {
    const runId = `run_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    await this.db.query(
      `INSERT INTO processing_runs (
        id, job_id, stage, pipeline_version, provider_id, model_id, schema_version, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $4, 'running')`,
      [runId, jobId, stage, PIPELINE_VERSION, providerId, modelId]
    );
    return runId;
  }

  private async finishRunSucceeded(
    runId: string,
    durationMs: number,
    tokenUsage: Record<string, number> | null
  ): Promise<void> {
    await this.db.query(
      `UPDATE processing_runs
       SET status = 'succeeded',
           duration_ms = $1,
           token_usage_json = $2::jsonb,
           finished_at = NOW()
       WHERE id = $3`,
      [durationMs, JSON.stringify(tokenUsage ?? {}), runId]
    );
  }

  private async finishRunFailed(
    runId: string,
    durationMs: number,
    errorCode: ErrorCode,
    safeErrorDetails: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE processing_runs
       SET status = 'failed',
           duration_ms = $1,
           error_code = $2,
           safe_error_details = $3,
           finished_at = NOW()
       WHERE id = $4`,
      [durationMs, errorCode, safeErrorDetails, runId]
    );
  }

  private async failJob(
    jobId: string,
    failedStage: 'acquiring' | 'transcribing' | 'analyzing',
    errorCode: ErrorCode,
    userMessage: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE processing_jobs
       SET status = 'failed',
           failed_stage = $1,
           last_error_code = $2,
           last_error_message = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [failedStage, errorCode, userMessage, jobId]
    );
  }

  private async recordMetric(
    metricName: string,
    stage: string,
    platform: string,
    status: string,
    durationMs: number,
    errorCode: string | null
  ): Promise<void> {
    const id = `met_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    await this.db.query(
      `INSERT INTO operational_metrics (
        id, metric_name, stage, platform, status, duration_ms, error_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, metricName, stage, platform, status, durationMs, errorCode]
    );
  }
}

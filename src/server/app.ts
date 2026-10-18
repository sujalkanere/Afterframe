import express, { type Request, type Response, type NextFunction } from 'express';
import {
  ConfirmArtifactRequestSchema,
  SubmitJobRequestSchema,
  UserSettingsSchema,
  SkillSpecPayloadSchema,
  TaskCandidatePayloadSchema,
} from '../shared/contracts.js';
import type { DatabaseClient } from './db/index.js';
import { AuthService, type AuthenticatedUser } from './auth/auth-service.js';
import { JobPipelineService } from './jobs/worker.js';
import { ArtifactService } from './artifacts/artifact-service.js';
import { SkillExportRenderer } from './export/skill-renderer.js';
import { AtlasGraphBuilder } from './atlas/graph-builder.js';
import { YouTubeShortsAdapter } from './acquisition/youtube-adapter.js';
import { InstagramReelAdapter } from './acquisition/instagram-adapter.js';
import { StructuredLlmExtractor } from './extraction/llm-extractor.js';
import {
  validateSkillSpecCandidate,
  validateTaskCandidate,
} from './validation/validator.js';
import { sanitizeErrorDetails } from './security/redaction.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
      sessionToken?: string;
    }
  }
}

export interface CreateAppOptions {
  db: DatabaseClient;
  youtubeAdapter?: YouTubeShortsAdapter;
  instagramAdapter?: InstagramReelAdapter;
  llmExtractor?: StructuredLlmExtractor;
  runJobsAsync?: boolean;
}

export function createApiApp(options: CreateAppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));

  const db = options.db;
  const youtubeAdapter = options.youtubeAdapter ?? new YouTubeShortsAdapter();
  const instagramAdapter =
    options.instagramAdapter ?? new InstagramReelAdapter();
  const llmExtractor = options.llmExtractor ?? new StructuredLlmExtractor();

  const authService = new AuthService(db);
  const jobService = new JobPipelineService({
    db,
    youtubeAdapter,
    instagramAdapter,
    llmExtractor,
    runAsync: options.runJobsAsync ?? true,
  });
  const artifactService = new ArtifactService(db);
  const skillRenderer = new SkillExportRenderer(db);
  const atlasBuilder = new AtlasGraphBuilder(db);

  // Extract session token from header or cookie
  function paramStr(val: string | string[] | undefined): string {
    if (Array.isArray(val)) return val[0] ?? '';
    return val ?? '';
  }

  function extractToken(req: Request): string | null {
    const headerToken = req.header('x-afterframe-session');
    if (headerToken) return headerToken;
    const cookieHeader = req.header('cookie') ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)afterframe_session=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Authentication middleware
  async function requireSession(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const rawToken = extractToken(req);
      const session = await authService.resolveOrCreateSession(rawToken);
      req.authUser = session.user;
      req.sessionToken = session.sessionToken;
      if (session.isNewSession) {
        res.setHeader(
          'Set-Cookie',
          `afterframe_session=${encodeURIComponent(
            session.sessionToken
          )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
        );
      }
      res.setHeader('x-afterframe-session', session.sessionToken);
      next();
    } catch (err) {
      res.status(500).json({
        error: 'DATABASE_FAILURE',
        message: 'Could not initialize user session.',
        details: sanitizeErrorDetails(err),
      });
    }
  }

  // Web Share Target GET handler (FR-060, Section 6.7)
  // When Android / PWA shares a link to /share-target?url=...&text=..., redirect to /?shared=...
  app.get('/share-target', (req, res) => {
    const sharedUrl =
      (typeof req.query.url === 'string' && req.query.url) ||
      (typeof req.query.text === 'string' && req.query.text) ||
      (typeof req.query.title === 'string' && req.query.title) ||
      '';
    res.redirect(`/?shared=${encodeURIComponent(sharedUrl)}`);
  });

  // Health & Observability endpoint (Section 12.1)
  app.get('/api/health', async (_req, res) => {
    const metricsRes = await db.query<{
      metric_name: string;
      status: string;
      cnt: string;
      avg_ms: string | null;
    }>(
      `SELECT metric_name, status, COUNT(*)::text AS cnt, ROUND(AVG(duration_ms))::text AS avg_ms
       FROM operational_metrics
       GROUP BY metric_name, status
       ORDER BY metric_name, status`
    );

    res.json({
      status: 'ok',
      engine: db.engine,
      connectors: {
        youtube: {
          enabled: youtubeAdapter.isEnabled(),
          providerId: youtubeAdapter.providerId,
        },
        instagram: {
          enabled: instagramAdapter.isEnabled(),
          providerId: instagramAdapter.providerId,
          reasonWhenDisabled:
            'Disabled until public Reel acquisition is verified without authentication bypass (FR-008, FR-009).',
        },
        llm: {
          configured: llmExtractor.isConfigured(),
          model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
        },
      },
      metrics: metricsRes.rows,
    });
  });

  app.get('/api/session', requireSession, async (req, res) => {
    res.json({
      user: req.authUser,
      sessionToken: req.sessionToken,
      capabilities: {
        youtubeLinkEnabled: youtubeAdapter.isEnabled(),
        instagramLinkEnabled: instagramAdapter.isEnabled(),
        pasteTranscriptEnabled: true,
        llmConfigured: llmExtractor.isConfigured(),
      },
      retentionPolicy: {
        temporaryMedia:
          'Temporary media files are bounded and deleted immediately when a job stage finishes (0 days retained).',
        unconfirmedCandidates:
          'Unconfirmed review candidates expire automatically after 7 days.',
        confirmedArtifacts:
          'Saved artifacts and their cited transcript/caption segments are retained until you delete them (10-second undo window before permanent purge). Shared source evidence is retained only while referenced by at least one saved artifact.',
      },
    });
  });

  app.post('/api/auth/signin', requireSession, async (req, res) => {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const displayName =
      typeof req.body?.displayName === 'string'
        ? req.body.displayName.trim()
        : undefined;

    const outcome = await authService.signInPasswordless(
      req.authUser!.id,
      email,
      displayName
    );
    if (!outcome.ok || !outcome.user || !outcome.sessionToken) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: outcome.message ?? 'Sign-in failed.',
      });
      return;
    }

    res.setHeader(
      'Set-Cookie',
      `afterframe_session=${encodeURIComponent(
        outcome.sessionToken
      )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
    );
    res.json({
      user: outcome.user,
      sessionToken: outcome.sessionToken,
    });
  });

  app.put('/api/settings', requireSession, async (req, res) => {
    const parsed = UserSettingsSchema.partial().safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'INVALID_SETTINGS',
        message: 'Invalid settings values provided.',
      });
      return;
    }
    const updated = await authService.updateSettings(
      req.authUser!.id,
      parsed.data
    );
    res.json({ settings: updated });
  });

  app.get('/api/account/export', requireSession, async (req, res) => {
    const bundle = await authService.exportUserData(req.authUser!.id);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="afterframe-data-export.json"'
    );
    res.json(bundle);
  });

  app.delete('/api/account', requireSession, async (req, res) => {
    await authService.deleteAccountAndData(req.authUser!.id);
    res.setHeader(
      'Set-Cookie',
      'afterframe_session=; Path=/; HttpOnly; Max-Age=0'
    );
    res.json({ deleted: true });
  });

  // Submit URL or Transcript Job (FR-001, FR-048, FR-059, NFR-006)
  app.post('/api/jobs', requireSession, async (req, res) => {
    const parsed = SubmitJobRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'INVALID_URL',
        message:
          parsed.error.issues[0]?.message ??
          'Provide a valid link or transcript.',
      });
      return;
    }

    const result = await jobService.submitJob(req.authUser!.id, {
      url: parsed.data.url,
      pastedTranscript: parsed.data.pasted_transcript,
      sourceTitle: parsed.data.source_title,
      language: parsed.data.language,
      forceNew: parsed.data.force_new,
    });

    if (!result.ok) {
      res.status(400).json({
        error: result.errorCode,
        message: result.message,
      });
      return;
    }

    res.status(202).json(result);
  });

  // List jobs + "Ready for review" candidates (Section 6.8.A)
  app.get('/api/jobs', requireSession, async (req, res) => {
    const jobsRes = await db.query<{
      id: string;
      source_id: string;
      status: string;
      current_stage: string;
      failed_stage: string | null;
      attempt_count: number;
      last_error_code: string | null;
      last_error_message: string | null;
      confirmed_artifact_id: string | null;
      created_at: string;
      updated_at: string;
      platform: string;
      submitted_url: string;
      canonical_url: string;
      metadata_json: { title?: string };
      recommended_type: string | null;
      candidate_title: string | null;
      expires_at: string | null;
    }>(
      `SELECT
        j.id, j.source_id, j.status, j.current_stage, j.failed_stage,
        j.attempt_count, j.last_error_code, j.last_error_message,
        j.confirmed_artifact_id, j.created_at, j.updated_at,
        s.platform, s.submitted_url, s.canonical_url, s.metadata_json,
        er.recommended_type,
        COALESCE(er.payload_json->'task_candidate'->>'title', s.metadata_json->>'title') AS candidate_title,
        er.expires_at
       FROM processing_jobs j
       JOIN sources s ON s.id = j.source_id
       LEFT JOIN LATERAL (
         SELECT recommended_type, payload_json, expires_at
         FROM extraction_results
         WHERE job_id = j.id
         ORDER BY created_at DESC
         LIMIT 1
       ) er ON TRUE
       WHERE j.user_id = $1
       ORDER BY j.updated_at DESC
       LIMIT 25`,
      [req.authUser!.id]
    );

    res.json({
      jobs: jobsRes.rows,
      readyForReviewCount: jobsRes.rows.filter(
        (j) => j.status === 'needs_review'
      ).length,
    });
  });

  // Get specific job, stages, runs, source evidence, and review candidate
  app.get('/api/jobs/:id', requireSession, async (req, res) => {
    const jobId = paramStr(req.params.id);
    const jobRes = await db.query<{
      id: string;
      user_id: string;
      source_id: string;
      status: string;
      current_stage: string;
      failed_stage: string | null;
      attempt_count: number;
      last_error_code: string | null;
      last_error_message: string | null;
      confirmed_artifact_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, user_id, source_id, status, current_stage, failed_stage, attempt_count,
              last_error_code, last_error_message, confirmed_artifact_id, created_at, updated_at
       FROM processing_jobs
       WHERE id = $1 AND user_id = $2`,
      [jobId, req.authUser!.id]
    );

    if (jobRes.rows.length === 0) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Processing job not found.',
      });
      return;
    }

    const job = jobRes.rows[0];
    const sourceRes = await db.query(
      `SELECT id, platform, submitted_url, canonical_url, platform_content_id, metadata_json, created_at
       FROM sources WHERE id = $1`,
      [job.source_id]
    );

    const runsRes = await db.query(
      `SELECT id, stage, pipeline_version, provider_id, model_id, status, duration_ms, started_at, finished_at, error_code, safe_error_details
       FROM processing_runs WHERE job_id = $1 ORDER BY started_at ASC`,
      [job.id]
    );

    const evidenceRes = await db.query(
      `SELECT id, source_id, kind, content_ref, content_text, start_ms, end_ms, language, provenance, limitations_json, metadata_json
       FROM source_evidence WHERE source_id = $1 ORDER BY start_ms ASC NULLS FIRST, created_at ASC`,
      [job.source_id]
    );

    const candidateRes = await db.query(
      `SELECT id, run_id, candidate_type, recommended_type, recommendation_reason, schema_version,
              payload_json, validation_status, repair_attempts, findings_json, expires_at, created_at
       FROM extraction_results WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [job.id]
    );

    res.json({
      job,
      source: sourceRes.rows[0] ?? null,
      runs: runsRes.rows,
      evidence: evidenceRes.rows,
      candidate: candidateRes.rows[0] ?? null,
    });
  });

  app.post('/api/jobs/:id/retry', requireSession, async (req, res) => {
    const pastedTranscript =
      typeof req.body?.pasted_transcript === 'string'
        ? req.body.pasted_transcript
        : undefined;
    const outcome = await jobService.retryJob(
      paramStr(req.params.id),
      req.authUser!.id,
      {
        pastedTranscript,
      }
    );
    if (!outcome.ok) {
      res.status(400).json({
        error: 'RETRY_REJECTED',
        message: outcome.message ?? 'Cannot retry this job.',
      });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/jobs/:id/manual-draft', requireSession, async (req, res) => {
    const outcome = await jobService.createManualDraftFromEvidence(
      paramStr(req.params.id),
      req.authUser!.id
    );
    if (!outcome.ok) {
      res.status(400).json({
        error: 'MANUAL_DRAFT_FAILED',
        message: outcome.message ?? 'Could not initialize manual draft.',
      });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/jobs/:id/cancel', requireSession, async (req, res) => {
    const cancelled = await jobService.cancelJob(
      paramStr(req.params.id),
      req.authUser!.id
    );
    res.json({ cancelled });
  });

  // Live validation endpoint for Review & Edit screen (Section 6.8.C)
  app.post('/api/jobs/:id/validate', requireSession, async (req, res) => {
    const jobRes = await db.query<{ source_id: string }>(
      `SELECT source_id FROM processing_jobs WHERE id = $1 AND user_id = $2`,
      [paramStr(req.params.id), req.authUser!.id]
    );
    if (jobRes.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }
    const evRes = await db.query<{
      id: string;
      kind: 'metadata' | 'caption' | 'transcript' | 'visual_observation' | 'user_provided';
    }>(`SELECT id, kind FROM source_evidence WHERE source_id = $1`, [
      jobRes.rows[0].source_id,
    ]);

    const selectedType = req.body?.selected_type;
    if (selectedType === 'ai_skill') {
      const outcome = validateSkillSpecCandidate(
        req.body?.skill_payload,
        evRes.rows
      );
      res.json({ status: outcome.status, findings: outcome.findings });
      return;
    }

    const outcome = validateTaskCandidate(req.body?.task_payload, evRes.rows);
    res.json({ status: outcome.status, findings: outcome.findings });
  });

  // Confirm and persist artifact (FR-030, FR-038, Section 10.2.10)
  app.post('/api/artifacts/confirm', requireSession, async (req, res) => {
    const parsed = ConfirmArtifactRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'SCHEMA_VALIDATION_FAILURE',
        message:
          parsed.error.issues[0]?.message ?? 'Invalid confirmation payload.',
        findings: parsed.error.issues.map((i) => ({
          layer: 'structural',
          severity: 'error',
          code: 'INVALID_CONFIRM_REQUEST',
          message: `${i.path.join('.')}: ${i.message}`,
          field_path: i.path.join('.') || null,
          step_id: null,
        })),
      });
      return;
    }

    const outcome = await artifactService.confirmArtifact(
      req.authUser!.id,
      parsed.data
    );
    if (!outcome.ok) {
      res.status(422).json({
        error: 'SCHEMA_VALIDATION_FAILURE',
        message: outcome.message,
        findings: outcome.findings,
      });
      return;
    }

    res.status(201).json(outcome);
  });

  // List & search library artifacts (FR-040, FR-042, NFR-008)
  app.get('/api/artifacts', requireSession, async (req, res) => {
    const result = await artifactService.listArtifacts(req.authUser!.id, {
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      topic: typeof req.query.topic === 'string' ? req.query.topic : undefined,
      sort:
        req.query.sort === 'oldest' || req.query.sort === 'title'
          ? req.query.sort
          : 'newest',
      cursor:
        typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      limit:
        typeof req.query.limit === 'string'
          ? Number(req.query.limit)
          : undefined,
    });
    res.json(result);
  });

  // Artifact detail (FR-044, Section 6.8.E)
  app.get('/api/artifacts/:id', requireSession, async (req, res) => {
    const detail = await artifactService.getArtifactDetail(
      req.authUser!.id,
      paramStr(req.params.id)
    );
    if (!detail) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Artifact not found or access denied.',
      });
      return;
    }
    res.json({ artifact: detail });
  });

  // Update Task or create new AI Skill version (FR-054)
  app.patch('/api/artifacts/:id', requireSession, async (req, res) => {
    const artifactId = paramStr(req.params.id);
    if (req.body?.skill_spec) {
      const parsedSpec = SkillSpecPayloadSchema.safeParse(req.body.skill_spec);
      if (!parsedSpec.success) {
        res.status(400).json({
          error: 'SCHEMA_VALIDATION_FAILURE',
          message:
            parsedSpec.error.issues[0]?.message ?? 'Invalid SkillSpec payload.',
        });
        return;
      }
      const out = await artifactService.updateSkillArtifactVersion(
        req.authUser!.id,
        artifactId,
        parsedSpec.data
      );
      if (!out.ok) {
        res.status(404).json({ error: 'NOT_FOUND', message: out.message });
        return;
      }
      res.json(out);
      return;
    }

    const ok = await artifactService.updateTaskArtifact(
      req.authUser!.id,
      artifactId,
      {
        title:
          typeof req.body?.title === 'string' ? req.body.title.trim() : undefined,
        description:
          typeof req.body?.description === 'string'
            ? req.body.description.trim()
            : undefined,
        completionStatus: req.body?.completion_status,
        deadline: req.body?.deadline,
        topics: Array.isArray(req.body?.topics) ? req.body.topics : undefined,
        stepToggle: req.body?.step_toggle,
      }
    );

    if (!ok) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Task artifact not found.',
      });
      return;
    }
    res.json({ ok: true });
  });

  // Delete with 10-second undo (FR-055, FR-057, FR-063)
  app.delete('/api/artifacts/:id', requireSession, async (req, res) => {
    const artifactId = paramStr(req.params.id);
    if (req.query.immediate === 'true') {
      const ok = await artifactService.finalizeDelete(
        req.authUser!.id,
        artifactId
      );
      if (!ok) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Artifact not found.',
        });
        return;
      }
      res.json({ deleted: true, permanent: true });
      return;
    }

    const out = await artifactService.initiateDelete(
      req.authUser!.id,
      artifactId
    );
    if (!out.ok) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Artifact not found.',
      });
      return;
    }
    res.json({
      deleted: true,
      permanent: false,
      undoUntil: out.undoUntil,
    });
  });

  app.post(
    '/api/artifacts/:id/undo-delete',
    requireSession,
    async (req, res) => {
      const restored = await artifactService.undoDelete(
        req.authUser!.id,
        paramStr(req.params.id)
      );
      if (!restored) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Artifact could not be restored (undo window expired).',
        });
        return;
      }
      res.json({ restored: true });
    }
  );

  app.post(
    '/api/artifacts/:id/finalize-delete',
    requireSession,
    async (req, res) => {
      const finalized = await artifactService.finalizeDelete(
        req.authUser!.id,
        paramStr(req.params.id)
      );
      res.json({ finalized });
    }
  );

  // Skill Export (FR-036, FR-037, Section 6.8.F)
  app.post('/api/artifacts/:id/export', requireSession, async (req, res) => {
    const target =
      typeof req.body?.target === 'string'
        ? req.body.target
        : 'claude_code_skill';

    const outcome = await skillRenderer.renderAndRecordExport(
      req.authUser!.id,
      paramStr(req.params.id),
      target
    );

    if (!outcome.ok) {
      res.status(400).json({
        error: 'EXPORT_COMPATIBILITY_FAILURE',
        message: outcome.message,
        findings: outcome.findings,
      });
      return;
    }

    res.json({ exportPackage: outcome.pkg });
  });

  // Afterframe Atlas Spatial Graph API (FR-047, Section 6.5, Section 8.3)
  app.get('/api/atlas', requireSession, async (req, res) => {
    const graph = await atlasBuilder.buildUserAtlas(req.authUser!.id, {
      type:
        req.query.type === 'task' || req.query.type === 'ai_skill'
          ? req.query.type
          : undefined,
      topic:
        typeof req.query.topic === 'string' ? req.query.topic : undefined,
      platform:
        req.query.platform === 'youtube' ||
        req.query.platform === 'instagram' ||
        req.query.platform === 'manual'
          ? req.query.platform
          : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      focusNodeId:
        typeof req.query.focus === 'string' ? req.query.focus : undefined,
      maxHops:
        typeof req.query.hops === 'string' ? Number(req.query.hops) : 2,
      expandClusterTopic:
        typeof req.query.expandTopic === 'string'
          ? req.query.expandTopic
          : undefined,
    });
    res.json(graph);
  });

  return {
    app,
    authService,
    jobService,
    artifactService,
    skillRenderer,
    atlasBuilder,
  };
}

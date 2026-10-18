import crypto from 'node:crypto';
import {
  SKILL_SPEC_SCHEMA_VERSION,
  type ConfirmArtifactRequest,
  type SkillSpecPayload,
  type TaskCandidatePayload,
  type ValidationFinding,
} from '../../shared/contracts.js';
import type { DatabaseClient } from '../db/index.js';
import { computeSha256 } from '../jobs/idempotency.js';
import {
  validateSkillSpecCandidate,
  validateTaskCandidate,
  type EvidenceRefContext,
} from '../validation/validator.js';

export interface ConfirmOutcome {
  ok: true;
  artifactId: string;
  artifactType: 'task' | 'ai_skill';
  reusedConfirmation: boolean;
}

export interface ConfirmFailure {
  ok: false;
  message: string;
  findings: ValidationFinding[];
}

export class ArtifactService {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  async confirmArtifact(
    userId: string,
    req: ConfirmArtifactRequest
  ): Promise<ConfirmOutcome | ConfirmFailure> {
    const jobRes = await this.db.query<{
      id: string;
      user_id: string;
      source_id: string;
      status: string;
      confirmed_artifact_id: string | null;
    }>(
      `SELECT id, user_id, source_id, status, confirmed_artifact_id
       FROM processing_jobs WHERE id = $1 AND user_id = $2`,
      [req.job_id, userId]
    );

    if (jobRes.rows.length === 0) {
      return {
        ok: false,
        message: 'Processing job not found or access denied.',
        findings: [],
      };
    }

    const job = jobRes.rows[0];
    if (job.status === 'completed' && job.confirmed_artifact_id) {
      const existingArt = await this.db.query<{
        id: string;
        artifact_type: 'task' | 'ai_skill';
      }>(`SELECT id, artifact_type FROM artifacts WHERE id = $1`, [
        job.confirmed_artifact_id,
      ]);
      if (existingArt.rows.length > 0) {
        return {
          ok: true,
          artifactId: existingArt.rows[0].id,
          artifactType: existingArt.rows[0].artifact_type,
          reusedConfirmation: true,
        };
      }
    }

    const evRes = await this.db.query<{
      id: string;
      kind: 'metadata' | 'caption' | 'transcript' | 'visual_observation' | 'user_provided';
    }>(`SELECT id, kind FROM source_evidence WHERE source_id = $1`, [
      job.source_id,
    ]);

    const availableEvidence: EvidenceRefContext[] = evRes.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
    }));

    const latestRunRes = await this.db.query<{ id: string }>(
      `SELECT id FROM processing_runs WHERE job_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [job.id]
    );
    const latestRunId = latestRunRes.rows[0]?.id ?? null;

    if (req.selected_type === 'task') {
      const val = validateTaskCandidate(req.task_payload, availableEvidence);
      if (val.status === 'invalid' || !val.parsed) {
        return {
          ok: false,
          message:
            'Task candidate has blocking validation errors. Fix the highlighted fields before saving.',
          findings: val.findings,
        };
      }
      const task = val.parsed;
      const artifactId = `art_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

      await this.db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO artifacts (
            id, user_id, artifact_type, title, description, status, provenance_mode
          ) VALUES ($1, $2, 'task', $3, $4, 'active', $5)`,
          [
            artifactId,
            userId,
            task.title,
            task.description,
            req.provenance_mode,
          ]
        );

        await tx.query(
          `INSERT INTO tasks (
            artifact_id, deadline, completion_status, estimated_minutes
          ) VALUES ($1, $2, 'todo', $3)`,
          [
            artifactId,
            req.user_deadline ?? null,
            task.estimated_minutes ?? null,
          ]
        );

        for (let i = 0; i < task.steps.length; i++) {
          const step = task.steps[i];
          const stepDbId = `tstep_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
          await tx.query(
            `INSERT INTO task_steps (
              id, task_artifact_id, position, title, description, status, provenance_kind, is_inferred, is_user_edited
            ) VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8)`,
            [
              stepDbId,
              artifactId,
              i,
              step.title,
              step.description ?? '',
              step.provenance_kind,
              step.is_inferred,
              step.is_user_edited,
            ]
          );

          for (const evId of step.evidence_refs) {
            const linkId = `evl_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
            await tx.query(
              `INSERT INTO evidence_links (
                id, artifact_id, evidence_id, step_id, relationship_kind, provenance_label
              ) VALUES ($1, $2, $3, $4, 'supports', $5)`,
              [linkId, artifactId, evId, stepDbId, step.provenance_kind]
            );
          }
        }

        await this.upsertCategoriesForArtifact(
          tx,
          userId,
          artifactId,
          task.topics
        );

        await tx.query(
          `INSERT INTO artifact_sources (
            artifact_id, source_id, processing_run_id, relationship_kind
          ) VALUES ($1, $2, $3, 'derived_from')`,
          [artifactId, job.source_id, latestRunId]
        );

        await tx.query(
          `UPDATE processing_jobs
           SET status = 'completed',
               confirmed_artifact_id = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [artifactId, job.id]
        );
      });

      return {
        ok: true,
        artifactId,
        artifactType: 'task',
        reusedConfirmation: false,
      };
    }

    // AI Skill confirmation
    const val = validateSkillSpecCandidate(
      req.skill_payload,
      availableEvidence
    );
    if (val.status === 'invalid' || !val.parsed) {
      return {
        ok: false,
        message:
          'AI skill specification has blocking validation errors. Fix the highlighted fields before saving.',
        findings: val.findings,
      };
    }

    const skill = val.parsed;
    const artifactId = `art_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const versionId = `skv_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const specJson = JSON.stringify(skill);
    const contentHash = computeSha256(specJson);

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO artifacts (
          id, user_id, artifact_type, title, description, status, provenance_mode
        ) VALUES ($1, $2, 'ai_skill', $3, $4, 'active', $5)`,
        [
          artifactId,
          userId,
          skill.identity.title,
          skill.identity.description,
          req.provenance_mode,
        ]
      );

      await tx.query(
        `INSERT INTO skills (artifact_id, current_version_id) VALUES ($1, $2)`,
        [artifactId, versionId]
      );

      await tx.query(
        `INSERT INTO skill_versions (
          id, skill_artifact_id, version_number, schema_version, spec_json, content_hash
        ) VALUES ($1, $2, 1, $3, $4::jsonb, $5)`,
        [versionId, artifactId, SKILL_SPEC_SCHEMA_VERSION, specJson, contentHash]
      );

      for (const step of skill.workflow_steps) {
        for (const evId of step.evidence_refs) {
          const linkId = `evl_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
          await tx.query(
            `INSERT INTO evidence_links (
              id, artifact_id, evidence_id, step_id, relationship_kind, provenance_label
            ) VALUES ($1, $2, $3, $4, 'supports', $5)`,
            [linkId, artifactId, evId, step.id, step.provenance_kind]
          );
        }
      }

      await this.upsertCategoriesForArtifact(
        tx,
        userId,
        artifactId,
        skill.topics
      );

      await tx.query(
        `INSERT INTO artifact_sources (
          artifact_id, source_id, processing_run_id, relationship_kind
        ) VALUES ($1, $2, $3, 'derived_from')`,
        [artifactId, job.source_id, latestRunId]
      );

      await tx.query(
        `UPDATE processing_jobs
         SET status = 'completed',
             confirmed_artifact_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [artifactId, job.id]
      );
    });

    return {
      ok: true,
      artifactId,
      artifactType: 'ai_skill',
      reusedConfirmation: false,
    };
  }

  private async upsertCategoriesForArtifact(
    tx: { query: DatabaseClient['query'] },
    userId: string,
    artifactId: string,
    topicSlugs: string[]
  ): Promise<void> {
    await tx.query(`DELETE FROM artifact_categories WHERE artifact_id = $1`, [
      artifactId,
    ]);

    const uniqueSlugs = Array.from(
      new Set(topicSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean))
    );

    for (const slug of uniqueSlugs) {
      const existing = await tx.query<{ id: string }>(
        `SELECT id FROM categories WHERE owner_user_id = $1 AND slug = $2`,
        [userId, slug]
      );
      let catId: string;
      if (existing.rows.length > 0) {
        catId = existing.rows[0].id;
      } else {
        catId = `cat_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
        const displayName = slug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        await tx.query(
          `INSERT INTO categories (id, owner_user_id, name, slug) VALUES ($1, $2, $3, $4)`,
          [catId, userId, displayName, slug]
        );
      }
      await tx.query(
        `INSERT INTO artifact_categories (artifact_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [artifactId, catId]
      );
    }
  }

  async listArtifacts(
    userId: string,
    params: {
      q?: string;
      type?: string;
      topic?: string;
      sort?: 'newest' | 'oldest' | 'title';
      cursor?: string;
      limit?: number;
    } = {}
  ) {
    // Purge any expired pending_delete artifacts for this user first
    await this.purgeExpiredPendingDeletes(userId);

    const limit = Math.min(Math.max(params.limit ?? 25, 1), 50);
    const values: unknown[] = [userId];
    const conditions: string[] = [
      `a.user_id = $1`,
      `a.deleted_at IS NULL`,
      `a.status != 'pending_delete'`,
    ];

    if (params.type && (params.type === 'task' || params.type === 'ai_skill')) {
      values.push(params.type);
      conditions.push(`a.artifact_type = $${values.length}`);
    }

    if (params.topic && params.topic.trim()) {
      values.push(params.topic.trim().toLowerCase());
      conditions.push(`EXISTS (
        SELECT 1 FROM artifact_categories ac
        JOIN categories c ON c.id = ac.category_id
        WHERE ac.artifact_id = a.id AND c.slug = $${values.length}
      )`);
    }

    if (params.q && params.q.trim()) {
      const qTrim = params.q.trim();
      values.push(qTrim);
      const qIdx = values.length;
      values.push(`%${qTrim}%`);
      const likeIdx = values.length;
      conditions.push(`(
        to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, ''))
          @@ plainto_tsquery('simple', $${qIdx})
        OR a.title ILIKE $${likeIdx}
        OR a.description ILIKE $${likeIdx}
      )`);
    }

    if (params.cursor && params.cursor.includes('|')) {
      const [cursorTime, cursorId] = params.cursor.split('|');
      if (cursorTime && cursorId) {
        values.push(cursorTime, cursorId);
        const tIdx = values.length - 1;
        const idIdx = values.length;
        if (params.sort === 'oldest') {
          conditions.push(
            `(a.created_at > $${tIdx}::timestamptz OR (a.created_at = $${tIdx}::timestamptz AND a.id > $${idIdx}))`
          );
        } else {
          conditions.push(
            `(a.created_at < $${tIdx}::timestamptz OR (a.created_at = $${tIdx}::timestamptz AND a.id < $${idIdx}))`
          );
        }
      }
    }

    const orderBy =
      params.sort === 'oldest'
        ? 'a.created_at ASC, a.id ASC'
        : params.sort === 'title'
          ? 'a.title ASC, a.id ASC'
          : 'a.created_at DESC, a.id DESC';

    values.push(limit + 1);
    const limitIdx = values.length;

    const sql = `
      SELECT
        a.id,
        a.artifact_type,
        a.title,
        a.description,
        a.status,
        a.provenance_mode,
        a.created_at,
        a.updated_at,
        t.completion_status AS task_completion_status,
        t.deadline AS task_deadline,
        COALESCE(
          (
            SELECT json_agg(c.slug ORDER BY c.slug ASC)
            FROM artifact_categories ac
            JOIN categories c ON c.id = ac.category_id
            WHERE ac.artifact_id = a.id
          ),
          '[]'::json
        ) AS topics,
        (
          SELECT s.platform
          FROM artifact_sources asrc
          JOIN sources s ON s.id = asrc.source_id
          WHERE asrc.artifact_id = a.id
          LIMIT 1
        ) AS source_platform,
        (
          SELECT s.canonical_url
          FROM artifact_sources asrc
          JOIN sources s ON s.id = asrc.source_id
          WHERE asrc.artifact_id = a.id
          LIMIT 1
        ) AS source_url
      FROM artifacts a
      LEFT JOIN tasks t ON t.artifact_id = a.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${limitIdx}
    `;

    const res = await this.db.query<{
      id: string;
      artifact_type: string;
      title: string;
      description: string;
      status: string;
      provenance_mode: string;
      created_at: string;
      updated_at: string;
      task_completion_status: string | null;
      task_deadline: string | null;
      topics: string[];
      source_platform: string | null;
      source_url: string | null;
    }>(sql, values);

    const hasMore = res.rows.length > limit;
    const items = hasMore ? res.rows.slice(0, limit) : res.rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? `${new Date(last.created_at).toISOString()}|${last.id}` : null;

    // Fetch user's available topics for filter bar
    const topicsRes = await this.db.query<{ slug: string; name: string }>(
      `SELECT DISTINCT c.slug, c.name
       FROM categories c
       JOIN artifact_categories ac ON ac.category_id = c.id
       JOIN artifacts a ON a.id = ac.artifact_id
       WHERE c.owner_user_id = $1 AND a.deleted_at IS NULL AND a.status != 'pending_delete'
       ORDER BY c.slug ASC`,
      [userId]
    );

    return {
      items,
      nextCursor,
      availableTopics: topicsRes.rows,
    };
  }

  async getArtifactDetail(userId: string, artifactId: string) {
    const artRes = await this.db.query<{
      id: string;
      user_id: string;
      artifact_type: 'task' | 'ai_skill';
      title: string;
      description: string;
      status: string;
      provenance_mode: string;
      delete_undo_until: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, user_id, artifact_type, title, description, status, provenance_mode, delete_undo_until, created_at, updated_at
       FROM artifacts
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [artifactId, userId]
    );

    if (artRes.rows.length === 0) return null;
    const artifact = artRes.rows[0];

    const topicsRes = await this.db.query<{ slug: string; name: string }>(
      `SELECT c.slug, c.name
       FROM artifact_categories ac
       JOIN categories c ON c.id = ac.category_id
       WHERE ac.artifact_id = $1
       ORDER BY c.slug ASC`,
      [artifactId]
    );

    const sourcesRes = await this.db.query<{
      id: string;
      platform: string;
      submitted_url: string;
      canonical_url: string;
      platform_content_id: string;
      metadata_json: Record<string, unknown>;
      processing_run_id: string | null;
      pipeline_version: string | null;
      provider_id: string | null;
      model_id: string | null;
    }>(
      `SELECT
        s.id, s.platform, s.submitted_url, s.canonical_url, s.platform_content_id, s.metadata_json,
        asrc.processing_run_id,
        pr.pipeline_version, pr.provider_id, pr.model_id
       FROM artifact_sources asrc
       JOIN sources s ON s.id = asrc.source_id
       LEFT JOIN processing_runs pr ON pr.id = asrc.processing_run_id
       WHERE asrc.artifact_id = $1`,
      [artifactId]
    );

    const sourceIds = sourcesRes.rows.map((s) => s.id);
    let evidenceItems: Array<{
      id: string;
      source_id: string;
      kind: string;
      content_text: string;
      start_ms: number | null;
      end_ms: number | null;
      provenance: string;
      limitations_json: string[];
    }> = [];

    if (sourceIds.length > 0) {
      const evRes = await this.db.query<{
        id: string;
        source_id: string;
        kind: string;
        content_text: string;
        start_ms: number | null;
        end_ms: number | null;
        provenance: string;
        limitations_json: string[];
      }>(
        `SELECT id, source_id, kind, content_text, start_ms, end_ms, provenance, limitations_json
         FROM source_evidence
         WHERE source_id = $1
         ORDER BY start_ms ASC NULLS FIRST, created_at ASC`,
        [sourceIds[0]]
      );
      evidenceItems = evRes.rows;
    }

    const linksRes = await this.db.query<{
      id: string;
      evidence_id: string;
      step_id: string | null;
      provenance_label: string;
    }>(
      `SELECT id, evidence_id, step_id, provenance_label
       FROM evidence_links WHERE artifact_id = $1`,
      [artifactId]
    );

    if (artifact.artifact_type === 'task') {
      const taskRes = await this.db.query<{
        deadline: string | null;
        completion_status: string;
        estimated_minutes: number | null;
      }>(
        `SELECT deadline, completion_status, estimated_minutes FROM tasks WHERE artifact_id = $1`,
        [artifactId]
      );

      const stepsRes = await this.db.query<{
        id: string;
        position: number;
        title: string;
        description: string;
        status: string;
        provenance_kind: string;
        is_inferred: boolean;
        is_user_edited: boolean;
      }>(
        `SELECT id, position, title, description, status, provenance_kind, is_inferred, is_user_edited
         FROM task_steps
         WHERE task_artifact_id = $1
         ORDER BY position ASC`,
        [artifactId]
      );

      const stepsWithRefs = stepsRes.rows.map((st) => ({
        ...st,
        evidence_refs: linksRes.rows
          .filter((l) => l.step_id === st.id)
          .map((l) => l.evidence_id),
      }));

      return {
        ...artifact,
        topics: topicsRes.rows.map((t) => t.slug),
        sources: sourcesRes.rows,
        evidence: evidenceItems,
        task: {
          ...(taskRes.rows[0] ?? {
            deadline: null,
            completion_status: 'todo',
            estimated_minutes: null,
          }),
          steps: stepsWithRefs,
        },
        skill: null,
      };
    }

    // AI Skill detail + version history (FR-054)
    const versionsRes = await this.db.query<{
      id: string;
      version_number: number;
      schema_version: string;
      spec_json: SkillSpecPayload;
      content_hash: string;
      created_at: string;
    }>(
      `SELECT id, version_number, schema_version, spec_json, content_hash, created_at
       FROM skill_versions
       WHERE skill_artifact_id = $1
       ORDER BY version_number DESC`,
      [artifactId]
    );

    const exportsRes = await this.db.query<{
      id: string;
      skill_version_id: string;
      target: string;
      renderer_version: string;
      package_hash: string;
      validation_status: string;
      tested_in_target: boolean;
      created_at: string;
    }>(
      `SELECT se.id, se.skill_version_id, se.target, se.renderer_version, se.package_hash, se.validation_status, se.tested_in_target, se.created_at
       FROM skill_exports se
       JOIN skill_versions sv ON sv.id = se.skill_version_id
       WHERE sv.skill_artifact_id = $1
       ORDER BY se.created_at DESC`,
      [artifactId]
    );

    return {
      ...artifact,
      topics: topicsRes.rows.map((t) => t.slug),
      sources: sourcesRes.rows,
      evidence: evidenceItems,
      task: null,
      skill: {
        currentVersion: versionsRes.rows[0] ?? null,
        versions: versionsRes.rows,
        exports: exportsRes.rows,
      },
    };
  }

  async updateTaskArtifact(
    userId: string,
    artifactId: string,
    updates: {
      title?: string;
      description?: string;
      completionStatus?: 'todo' | 'in_progress' | 'completed';
      deadline?: string | null;
      topics?: string[];
      stepToggle?: { stepId: string; status: 'todo' | 'completed' };
    }
  ): Promise<boolean> {
    const own = await this.db.query<{ id: string }>(
      `SELECT id FROM artifacts WHERE id = $1 AND user_id = $2 AND artifact_type = 'task' AND deleted_at IS NULL`,
      [artifactId, userId]
    );
    if (own.rows.length === 0) return false;

    await this.db.transaction(async (tx) => {
      if (updates.title !== undefined || updates.description !== undefined) {
        await tx.query(
          `UPDATE artifacts
           SET title = COALESCE($1, title),
               description = COALESCE($2, description),
               provenance_mode = 'user_edited',
               updated_at = NOW()
           WHERE id = $3`,
          [updates.title ?? null, updates.description ?? null, artifactId]
        );
      }

      if (
        updates.completionStatus !== undefined ||
        updates.deadline !== undefined
      ) {
        await tx.query(
          `UPDATE tasks
           SET completion_status = COALESCE($1, completion_status),
               deadline = $2
           WHERE artifact_id = $3`,
          [
            updates.completionStatus ?? null,
            updates.deadline === undefined ? null : updates.deadline,
            artifactId,
          ]
        );
      }

      if (updates.stepToggle) {
        await tx.query(
          `UPDATE task_steps SET status = $1 WHERE id = $2 AND task_artifact_id = $3`,
          [updates.stepToggle.status, updates.stepToggle.stepId, artifactId]
        );
      }

      if (updates.topics && updates.topics.length > 0) {
        await this.upsertCategoriesForArtifact(
          tx,
          userId,
          artifactId,
          updates.topics
        );
      }
    });

    return true;
  }

  /**
   * Updates a saved AI Skill by creating a new immutable skill_versions record (FR-054).
   */
  async updateSkillArtifactVersion(
    userId: string,
    artifactId: string,
    newSpec: SkillSpecPayload
  ): Promise<{ ok: boolean; versionNumber?: number; message?: string }> {
    const own = await this.db.query<{ id: string }>(
      `SELECT id FROM artifacts WHERE id = $1 AND user_id = $2 AND artifact_type = 'ai_skill' AND deleted_at IS NULL`,
      [artifactId, userId]
    );
    if (own.rows.length === 0) {
      return { ok: false, message: 'Skill artifact not found.' };
    }

    const latestVer = await this.db.query<{ version_number: number }>(
      `SELECT COALESCE(MAX(version_number), 0) AS version_number FROM skill_versions WHERE skill_artifact_id = $1`,
      [artifactId]
    );
    const nextVersion = (latestVer.rows[0]?.version_number ?? 0) + 1;
    const versionId = `skv_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const specJson = JSON.stringify(newSpec);
    const contentHash = computeSha256(specJson);

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO skill_versions (
          id, skill_artifact_id, version_number, schema_version, spec_json, content_hash
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          versionId,
          artifactId,
          nextVersion,
          SKILL_SPEC_SCHEMA_VERSION,
          specJson,
          contentHash,
        ]
      );

      await tx.query(
        `UPDATE skills SET current_version_id = $1 WHERE artifact_id = $2`,
        [versionId, artifactId]
      );

      await tx.query(
        `UPDATE artifacts
         SET title = $1,
             description = $2,
             provenance_mode = 'user_edited',
             updated_at = NOW()
         WHERE id = $3`,
        [newSpec.identity.title, newSpec.identity.description, artifactId]
      );

      await this.upsertCategoriesForArtifact(
        tx,
        userId,
        artifactId,
        newSpec.topics
      );
    });

    return { ok: true, versionNumber: nextVersion };
  }

  /**
   * 10-second undoable deletion (FR-063) + evidence retention policy (FR-057, Section 7.4).
   */
  async initiateDelete(
    userId: string,
    artifactId: string
  ): Promise<{ ok: boolean; undoUntil?: string }> {
    const undoUntil = new Date(Date.now() + 10_000).toISOString();
    const res = await this.db.query(
      `UPDATE artifacts
       SET status = 'pending_delete',
           delete_undo_until = $1,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL`,
      [undoUntil, artifactId, userId]
    );
    if (res.rowCount === 0) return { ok: false };
    return { ok: true, undoUntil };
  }

  async undoDelete(userId: string, artifactId: string): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE artifacts
       SET status = 'active',
           delete_undo_until = NULL,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'pending_delete' AND deleted_at IS NULL`,
      [artifactId, userId]
    );
    return res.rowCount > 0;
  }

  async finalizeDelete(userId: string, artifactId: string): Promise<boolean> {
    return await this.db.transaction(async (tx) => {
      const own = await tx.query<{ id: string }>(
        `SELECT id FROM artifacts WHERE id = $1 AND user_id = $2`,
        [artifactId, userId]
      );
      if (own.rows.length === 0) return false;

      // Capture linked sources before removing artifact_sources
      const srcRes = await tx.query<{ source_id: string }>(
        `SELECT source_id FROM artifact_sources WHERE artifact_id = $1`,
        [artifactId]
      );
      const sourceIds = srcRes.rows.map((r) => r.source_id);

      // Delete evidence_links and artifact_sources for this artifact
      await tx.query(`DELETE FROM evidence_links WHERE artifact_id = $1`, [
        artifactId,
      ]);
      await tx.query(`DELETE FROM artifact_sources WHERE artifact_id = $1`, [
        artifactId,
      ]);
      await tx.query(`DELETE FROM artifacts WHERE id = $1 AND user_id = $2`, [
        artifactId,
        userId,
      ]);

      // FR-057 & Section 7.4: Only delete source & source_evidence if NO other artifact references that source
      for (const sourceId of sourceIds) {
        const remainingRefs = await tx.query<{ cnt: string }>(
          `SELECT COUNT(*)::text AS cnt FROM artifact_sources WHERE source_id = $1`,
          [sourceId]
        );
        const count = Number(remainingRefs.rows[0]?.cnt ?? '0');
        if (count === 0) {
          await tx.query(
            `DELETE FROM source_evidence WHERE source_id = $1 AND id NOT IN (SELECT evidence_id FROM evidence_links)`,
            [sourceId]
          );
          await tx.query(
            `DELETE FROM sources WHERE id = $1 AND user_id = $2 AND id NOT IN (SELECT source_id FROM artifact_sources)`,
            [sourceId, userId]
          );
        }
      }

      return true;
    });
  }

  async purgeExpiredPendingDeletes(userId: string): Promise<void> {
    const expired = await this.db.query<{ id: string }>(
      `SELECT id FROM artifacts
       WHERE user_id = $1
         AND status = 'pending_delete'
         AND delete_undo_until IS NOT NULL
         AND delete_undo_until <= NOW()`,
      [userId]
    );
    for (const row of expired.rows) {
      await this.finalizeDelete(userId, row.id);
    }
  }
}

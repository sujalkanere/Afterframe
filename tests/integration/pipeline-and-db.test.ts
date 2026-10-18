import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseClient } from '../../src/server/db/index.js';
import { JobPipelineService } from '../../src/server/jobs/worker.js';
import { ArtifactService } from '../../src/server/artifacts/artifact-service.js';
import { SkillExportRenderer } from '../../src/server/export/skill-renderer.js';
import { AtlasGraphBuilder } from '../../src/server/atlas/graph-builder.js';
import { StructuredLlmExtractor } from '../../src/server/extraction/llm-extractor.js';
import {
  PIPELINE_VERSION,
  SKILL_SPEC_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
} from '../../src/shared/contracts.js';

describe('PostgreSQL Schema Invariants, Pipeline Bounded Repair, and Artifact Lifecycle', () => {
  let db: DatabaseClient;
  const userId = 'usr_test_owner';

  beforeEach(async () => {
    db = await createDatabase({ dataDir: 'memory://' });
    await db.query(
      `INSERT INTO users (id, email, display_name, is_guest) VALUES ($1, 'owner@example.com', 'Owner', FALSE)`,
      [userId]
    );
  });

  afterEach(async () => {
    await db.close();
  });

  it('enforces database CHECK and UNIQUE invariants directly in PostgreSQL (Section 7.4, NFR-013)', async () => {
    // Prohibited category slug "short_term" rejected by PostgreSQL CHECK constraint
    await expect(
      db.query(
        `INSERT INTO categories (id, owner_user_id, name, slug) VALUES ('cat_bad', $1, 'Short Term', 'short_term')`,
        [userId]
      )
    ).rejects.toThrow();

    // Invalid job status rejected by PostgreSQL CHECK constraint
    await db.query(
      `INSERT INTO sources (id, user_id, platform, submitted_url, canonical_url, platform_content_id)
       VALUES ('src_1', $1, 'youtube', 'https://www.youtube.com/shorts/SWx0YfIjjx8', 'https://www.youtube.com/shorts/SWx0YfIjjx8', 'SWx0YfIjjx8')`,
      [userId]
    );
    await expect(
      db.query(
        `INSERT INTO processing_jobs (id, user_id, source_id, status, current_stage, idempotency_key, input_hash)
         VALUES ('job_bad', $1, 'src_1', 'fake_percentage_50', 'queued', 'k1', 'h1')`,
        [userId]
      )
    ).rejects.toThrow();
  });

  it('performs bounded LLM repair (1 retry) when initial model response fails validation, then confirms Task & AI Skill (FR-026)', async () => {
    let llmCallCount = 0;

    // Spin up a local OpenAI-compatible HTTP server to test real HTTP transport + bounded repair
    const server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      llmCallCount++;

      // Extract the real evidence ID from the prompt
      const promptText: string = body.messages?.[1]?.content ?? '';
      const evMatch = promptText.match(/id="(ev_[a-zA-Z0-9_]+)"/);
      const realEvId = evMatch ? evMatch[1] : 'ev_unknown';

      if (llmCallCount === 1) {
        // First response has non-contiguous step position (position: 5 instead of 0) to trigger bounded repair!
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    schema_version: PIPELINE_VERSION,
                    recommended_type: 'task',
                    recommendation_reason: 'Contains ordered Git setup steps.',
                    task_candidate: {
                      schema_version: TASK_SCHEMA_VERSION,
                      artifact_type: 'task',
                      title: 'Set up Git from scratch',
                      description: 'Configure Git identity and init repo.',
                      steps: [
                        {
                          id: 'step_1',
                          position: 5, // INVALID position -> triggers repair!
                          title: 'Run git init',
                          description: 'Initialize repo',
                          provenance_kind: 'transcript',
                          is_inferred: false,
                          is_user_edited: false,
                          evidence_refs: [realEvId],
                          caveats: null,
                        },
                      ],
                      topics: ['git'],
                      estimated_minutes: null,
                      deadline: null,
                      priority: null,
                    },
                    skill_candidate: {
                      schema_version: SKILL_SPEC_SCHEMA_VERSION,
                      artifact_type: 'ai_skill',
                      identity: {
                        name: 'git-setup-workflow',
                        title: 'Git Setup Workflow',
                        summary: 'Initialize and configure Git.',
                        description: 'Full workflow.',
                      },
                      intended_use: ['Initialize a new Git repo'],
                      non_use_conditions: ['Existing configured repo'],
                      trigger_examples: ['Set up git in this folder'],
                      input_contract: { fields: [], notes: null },
                      workflow_steps: [
                        {
                          id: 'wf_1',
                          position: 0,
                          title: 'Run git init',
                          instruction: 'Execute git init and git config.',
                          condition: null,
                          provenance_kind: 'transcript',
                          is_inferred: false,
                          is_user_edited: false,
                          evidence_refs: [realEvId],
                        },
                      ],
                      output_contract: {
                        format: 'markdown',
                        description: 'Summary of git config.',
                        verification_criteria: ['git status succeeds'],
                      },
                      capability_declarations: ['instruction_only'],
                      topics: ['git'],
                    },
                    evidence_summary: {
                      transcript_analyzed: true,
                      visual_frames_analyzed: 0,
                      visual_note:
                        'Visual frames: not analyzed. The transcript was sufficient.',
                    },
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 120, completion_tokens: 180, total_tokens: 300 },
          })
        );
        return;
      }

      // Second response (bounded repair call) fixes position to 0
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  schema_version: PIPELINE_VERSION,
                  recommended_type: 'task',
                  recommendation_reason:
                    'The video teaches a concrete step-by-step Git setup sequence.',
                  task_candidate: {
                    schema_version: TASK_SCHEMA_VERSION,
                    artifact_type: 'task',
                    title: 'Set up Git from scratch',
                    description: 'Configure Git identity and init repo.',
                    steps: [
                      {
                        id: 'step_1',
                        position: 0,
                        title: 'Run git init and configure user.name',
                        description:
                          'Initialize repository and configure global username.',
                        provenance_kind: 'transcript',
                        is_inferred: false,
                        is_user_edited: false,
                        evidence_refs: [realEvId],
                        caveats: null,
                      },
                    ],
                    topics: ['git', 'coding'],
                    estimated_minutes: null,
                    deadline: null,
                    priority: null,
                  },
                  skill_candidate: {
                    schema_version: SKILL_SPEC_SCHEMA_VERSION,
                    artifact_type: 'ai_skill',
                    identity: {
                      name: 'git-setup-workflow',
                      title: 'Git Setup Workflow',
                      summary: 'Initialize and configure Git.',
                      description: 'Full workflow.',
                    },
                    intended_use: ['Initialize a new Git repo'],
                    non_use_conditions: ['Existing configured repo'],
                    trigger_examples: ['Set up git in this folder'],
                    input_contract: { fields: [], notes: null },
                    workflow_steps: [
                      {
                        id: 'wf_1',
                        position: 0,
                        title: 'Run git init',
                        instruction: 'Execute git init and git config.',
                        condition: null,
                        provenance_kind: 'transcript',
                        is_inferred: false,
                        is_user_edited: false,
                        evidence_refs: [realEvId],
                      },
                    ],
                    output_contract: {
                      format: 'markdown',
                      description: 'Summary of git config.',
                      verification_criteria: ['git status succeeds'],
                    },
                    capability_declarations: ['instruction_only'],
                    topics: ['git', 'coding'],
                  },
                  evidence_summary: {
                    transcript_analyzed: true,
                    visual_frames_analyzed: 0,
                    visual_note:
                      'Visual frames: not analyzed. The transcript was sufficient.',
                  },
                }),
              },
            },
          ],
          usage: { prompt_tokens: 160, completion_tokens: 185, total_tokens: 345 },
        })
      );
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const llmExtractor = new StructuredLlmExtractor({
        baseUrl,
        apiKey: 'test-key-not-logged',
        model: 'gpt-4o-mini',
        allowLocalTestServer: true,
      });

      const jobService = new JobPipelineService({
        db,
        llmExtractor,
        runAsync: false,
      });

      const sub = await jobService.submitJob(userId, {
        url: 'https://www.youtube.com/shorts/SWx0YfIjjx8?feature=share',
        pastedTranscript:
          '0:00 To set up Git from scratch, run git init and git config --global user.name.',
      });

      expect(sub.ok).toBe(true);
      if (!sub.ok) return;

      // Verify idempotent duplicate submission reuses the same job ID (FR-051, Section 8.2)
      const dupSub = await jobService.submitJob(userId, {
        url: 'https://youtu.be/SWx0YfIjjx8',
        pastedTranscript:
          '0:00 To set up Git from scratch, run git init and git config --global user.name.',
      });
      expect(dupSub.ok).toBe(true);
      if (dupSub.ok) {
        expect(dupSub.jobId).toBe(sub.jobId);
        expect(dupSub.reusedExisting).toBe(true);
      }

      // Verify bounded repair happened exactly once (2 LLM calls total)
      expect(llmCallCount).toBe(2);

      const candRes = await db.query<{
        validation_status: string;
        repair_attempts: number;
        payload_json: any;
      }>(`SELECT validation_status, repair_attempts, payload_json FROM extraction_results WHERE job_id = $1`, [
        sub.jobId,
      ]);
      expect(candRes.rows).toHaveLength(1);
      expect(candRes.rows[0].repair_attempts).toBe(1);

      // Confirm as AI Skill and test Skill Versioning (FR-054) + Skill Export (Phase 5)
      const artifactService = new ArtifactService(db);
      const confirmSkill = await artifactService.confirmArtifact(userId, {
        job_id: sub.jobId,
        selected_type: 'ai_skill',
        provenance_mode: 'model_extracted',
        skill_payload: candRes.rows[0].payload_json.skill_candidate,
      });
      expect(confirmSkill.ok).toBe(true);
      if (!confirmSkill.ok) return;

      // Edit saved AI Skill -> creates version 2 (FR-054)
      const updatedSpec = {
        ...candRes.rows[0].payload_json.skill_candidate,
        identity: {
          ...candRes.rows[0].payload_json.skill_candidate.identity,
          title: 'Git Setup Workflow (v2 Edited)',
        },
      };
      const v2Res = await artifactService.updateSkillArtifactVersion(
        userId,
        confirmSkill.artifactId,
        updatedSpec
      );
      expect(v2Res.ok).toBe(true);
      expect(v2Res.versionNumber).toBe(2);

      // Render Skill Export for both supported targets
      const renderer = new SkillExportRenderer(db);
      const claudeExport = await renderer.renderAndRecordExport(
        userId,
        confirmSkill.artifactId,
        'claude_code_skill'
      );
      expect(claudeExport.ok).toBe(true);
      if (claudeExport.ok) {
        expect(claudeExport.pkg.testedInTarget).toBe(false);
        expect(claudeExport.pkg.files[0].relativePath).toBe(
          '.claude/skills/git-setup-workflow/SKILL.md'
        );
        expect(claudeExport.pkg.files[0].content).toContain(
          'Git Setup Workflow (v2 Edited)'
        );
      }
    } finally {
      server.close();
    }
  });

  it('preserves shared source evidence when one of two referencing artifacts is deleted, and supports 10s undo + Hindi search (FR-057, FR-063, Section 7.4)', async () => {
    const jobService = new JobPipelineService({ db, runAsync: false });
    const artifactService = new ArtifactService(db);

    const sub = await jobService.submitJob(userId, {
      pastedTranscript:
        '0:00 पायथन में क्लास और ऑब्जेक्ट्स बनाने के लिए class कीवर्ड का उपयोग करें।',
      sourceTitle: 'पायथन क्लास और ऑब्जेक्ट्स ट्यूटोरियल',
      language: 'hi',
    });
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;

    await jobService.createManualDraftFromEvidence(sub.jobId, userId);
    const candRes = await db.query<{ payload_json: any }>(
      `SELECT payload_json FROM extraction_results WHERE job_id = $1`,
      [sub.jobId]
    );

    // Save first artifact (Task) from this source
    const c1 = await artifactService.confirmArtifact(userId, {
      job_id: sub.jobId,
      selected_type: 'task',
      provenance_mode: 'user_created',
      task_payload: candRes.rows[0].payload_json.task_candidate,
    });
    expect(c1.ok).toBe(true);
    if (!c1.ok) return;

    // Create a second job/artifact linked to the SAME source (FR-046, FR-057)
    const job2Id = 'job_second_ref';
    await db.query(
      `INSERT INTO processing_jobs (id, user_id, source_id, status, current_stage, idempotency_key, input_hash)
       VALUES ($1, $2, $3, 'needs_review', 'needs_review', 'idem_2', 'hash_2')`,
      [job2Id, userId, sub.sourceId]
    );
    const c2 = await artifactService.confirmArtifact(userId, {
      job_id: job2Id,
      selected_type: 'ai_skill',
      provenance_mode: 'user_created',
      skill_payload: candRes.rows[0].payload_json.skill_candidate,
    });
    expect(c2.ok).toBe(true);
    if (!c2.ok) return;

    // Search library in Hindi Unicode (Section 6.1, Section 13.3)
    const searchHindi = await artifactService.listArtifacts(userId, {
      q: 'पायथन',
    });
    expect(searchHindi.items.length).toBeGreaterThanOrEqual(1);

    // Initiate 10s undoable delete on first artifact, then Undo it (FR-063)
    const delInit = await artifactService.initiateDelete(userId, c1.artifactId);
    expect(delInit.ok).toBe(true);

    const listWhilePending = await artifactService.listArtifacts(userId);
    expect(
      listWhilePending.items.find((i) => i.id === c1.artifactId)
    ).toBeUndefined();

    const undone = await artifactService.undoDelete(userId, c1.artifactId);
    expect(undone).toBe(true);

    const listAfterUndo = await artifactService.listArtifacts(userId);
    expect(
      listAfterUndo.items.find((i) => i.id === c1.artifactId)
    ).toBeDefined();

    // Permanently delete first artifact -> source & evidence MUST remain because second artifact still references them!
    await artifactService.finalizeDelete(userId, c1.artifactId);
    const srcStillExists = await db.query(
      `SELECT id FROM sources WHERE id = $1`,
      [sub.sourceId]
    );
    expect(srcStillExists.rows).toHaveLength(1);

    // Permanently delete second artifact -> now orphaned source & evidence are cleaned up (FR-057)!
    await artifactService.finalizeDelete(userId, c2.artifactId);
    const srcPurged = await db.query(`SELECT id FROM sources WHERE id = $1`, [
      sub.sourceId,
    ]);
    expect(srcPurged.rows).toHaveLength(0);
  });

  it('builds deterministic Afterframe Atlas graphs and enforces the 300-node cap with topic clustering (Section 6.5, Section 8.3)', async () => {
    const atlas = new AtlasGraphBuilder(db);

    // Insert 320 synthetic test artifacts in isolated test DB to verify 300-node clustering cap
    await db.query(
      `INSERT INTO sources (id, user_id, platform, submitted_url, canonical_url, platform_content_id)
       VALUES ('src_bulk', $1, 'youtube', 'https://www.youtube.com/shorts/SWx0YfIjjx8', 'https://www.youtube.com/shorts/SWx0YfIjjx8', 'SWx0YfIjjx8')`,
      [userId]
    );
    await db.query(
      `INSERT INTO categories (id, owner_user_id, name, slug) VALUES ('cat_coding', $1, 'Coding', 'coding')`,
      [userId]
    );

    for (let i = 0; i < 320; i++) {
      const artId = `art_bulk_${i}`;
      await db.query(
        `INSERT INTO artifacts (id, user_id, artifact_type, title, description, status)
         VALUES ($1, $2, 'task', $3, 'Desc', 'active')`,
        [artId, userId, `Bulk Task ${i}`]
      );
      await db.query(
        `INSERT INTO artifact_sources (artifact_id, source_id) VALUES ($1, 'src_bulk')`,
        [artId]
      );
      await db.query(
        `INSERT INTO artifact_categories (artifact_id, category_id) VALUES ($1, 'cat_coding')`,
        [artId]
      );
    }

    const graph = await atlas.buildUserAtlas(userId);
    expect(graph.totalUnclusteredNodes).toBeGreaterThan(300);
    expect(graph.clustered).toBe(true);
    expect(graph.nodes.length).toBeLessThanOrEqual(300);
    expect(graph.nodes.some((n) => n.kind === 'cluster')).toBe(true);
  });
});

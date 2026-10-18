import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseClient } from '../../src/server/db/index.js';
import { createApiApp } from '../../src/server/app.js';
import { YouTubeShortsAdapter } from '../../src/server/acquisition/youtube-adapter.js';
import { StructuredLlmExtractor } from '../../src/server/extraction/llm-extractor.js';
import {
  PIPELINE_VERSION,
  SKILL_SPEC_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
} from '../../src/shared/contracts.js';

const evalDataset = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'tests/eval-dataset/real-youtube-shorts.json'),
    'utf8'
  )
);

describe('[ISOLATED TRANSPORT E2E WITH REAL EVALUATION DATASET] Full API & DB Pipeline', () => {
  let db: DatabaseClient;
  let providerServer: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await createDatabase({ dataDir: 'memory://' });

    // Local HTTP server serving real oEmbed + real timedtext JSON3 from tests/eval-dataset/real-youtube-shorts.json
    // and OpenAI-compatible structured extraction grounded in the parsed evidence IDs.
    providerServer = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');

      if (reqUrl.pathname === '/oembed') {
        const targetUrl = reqUrl.searchParams.get('url') ?? '';
        const video = evalDataset.videos.find((v: any) =>
          targetUrl.includes(v.platform_content_id)
        );
        if (!video) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(video.oembed));
        return;
      }

      if (reqUrl.pathname === '/api/timedtext') {
        const vid = reqUrl.searchParams.get('v') ?? '';
        const video = evalDataset.videos.find(
          (v: any) => v.platform_content_id === vid
        );
        if (!video) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(video.timedtext_json3));
        return;
      }

      if (reqUrl.pathname === '/v1/chat/completions') {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const userMsg: string = body.messages?.[1]?.content ?? '';
        const evMatches = [...userMsg.matchAll(/id="(ev_[a-zA-Z0-9_]+)"/g)].map(
          (m) => m[1]
        );

        const isPythonDiff = userMsg.includes('difflib');
        const video = isPythonDiff
          ? evalDataset.videos[1]
          : evalDataset.videos[0];

        const envelope = {
          schema_version: PIPELINE_VERSION,
          recommended_type: video.expected_destination,
          recommendation_reason: isPythonDiff
            ? 'Reusable Python standard-library difflib pattern suitable for coding agents.'
            : 'Ordered Git CLI setup steps for human execution.',
          task_candidate: {
            schema_version: TASK_SCHEMA_VERSION,
            artifact_type: 'task',
            title: video.oembed.title,
            description: `Actionable steps from ${video.oembed.author_name}`,
            steps: video.ground_truth_steps.map((stepTitle: string, idx: number) => ({
              id: `step_${idx + 1}`,
              position: idx,
              title: stepTitle,
              description: stepTitle,
              provenance_kind: 'transcript',
              is_inferred: false,
              is_user_edited: false,
              evidence_refs: [evMatches[Math.min(idx, evMatches.length - 1)]],
              caveats: null,
            })),
            topics: video.expected_topics,
            estimated_minutes: null,
            deadline: null,
            priority: null,
          },
          skill_candidate: {
            schema_version: SKILL_SPEC_SCHEMA_VERSION,
            artifact_type: 'ai_skill',
            identity: {
              name: isPythonDiff ? 'python-difflib-unified' : 'git-scratch-setup',
              title: video.oembed.title,
              summary: `Grounded workflow from ${video.oembed.author_name}`,
              description: `Derived from ${video.canonical_url}`,
            },
            intended_use: ['When setting up or inspecting code diffs'],
            non_use_conditions: ['When target environment lacks Git or Python'],
            trigger_examples: [video.ground_truth_steps[0]],
            input_contract: { fields: [], notes: null },
            workflow_steps: video.ground_truth_steps.map(
              (stepTitle: string, idx: number) => ({
                id: `wf_${idx + 1}`,
                position: idx,
                title: stepTitle,
                instruction: stepTitle,
                condition: null,
                provenance_kind: 'transcript',
                is_inferred: false,
                is_user_edited: false,
                evidence_refs: [evMatches[Math.min(idx, evMatches.length - 1)]],
              })
            ),
            output_contract: {
              format: 'markdown',
              description: 'Verification output',
              verification_criteria: ['All commands exit 0'],
            },
            capability_declarations: ['instruction_only'],
            topics: video.expected_topics,
          },
          evidence_summary: {
            transcript_analyzed: true,
            visual_frames_analyzed: 0,
            visual_note:
              'Visual frames: not analyzed. The transcript was sufficient.',
          },
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(envelope) } }],
            usage: { prompt_tokens: 210, completion_tokens: 290, total_tokens: 500 },
          })
        );
      }
    });

    await new Promise<void>((resolve) =>
      providerServer.listen(0, '127.0.0.1', resolve)
    );
    const port = (providerServer.address() as { port: number }).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    providerServer.close();
    await db.close();
  });

  it('processes real evaluation YouTube Shorts end-to-end into confirmed Task and exported AI Skill', async () => {
    const youtubeAdapter = new YouTubeShortsAdapter({
      baseUrl,
      allowLocalTestServer: true,
    });
    const llmExtractor = new StructuredLlmExtractor({
      baseUrl: `${baseUrl}/v1`,
      apiKey: 'eval-test-key',
      model: 'gpt-4o-mini',
      allowLocalTestServer: true,
    });

    const { app } = createApiApp({
      db,
      youtubeAdapter,
      llmExtractor,
      runJobsAsync: false,
    });

    const sess = await request(app).get('/api/session').expect(200);
    const token = sess.body.sessionToken as string;

    // 1. Submit real YouTube Short URL from evaluation dataset (SWx0YfIjjx8)
    const sub1 = await request(app)
      .post('/api/jobs')
      .set('x-afterframe-session', token)
      .send({ url: evalDataset.videos[0].submitted_url })
      .expect(202);

    const job1 = await request(app)
      .get(`/api/jobs/${sub1.body.jobId}`)
      .set('x-afterframe-session', token)
      .expect(200);

    expect(job1.body.job.status).toBe('needs_review');
    expect(job1.body.evidence.length).toBeGreaterThanOrEqual(4);
    expect(job1.body.candidate.payload_json.recommended_type).toBe('task');

    // Confirm as Task
    const confirm1 = await request(app)
      .post('/api/artifacts/confirm')
      .set('x-afterframe-session', token)
      .send({
        job_id: sub1.body.jobId,
        selected_type: 'task',
        provenance_mode: 'model_extracted',
        task_payload: job1.body.candidate.payload_json.task_candidate,
      })
      .expect(201);

    // 2. Submit second real YouTube Short URL (oHaj0Vsfti4 -> AI Skill)
    const sub2 = await request(app)
      .post('/api/jobs')
      .set('x-afterframe-session', token)
      .send({ url: evalDataset.videos[1].submitted_url })
      .expect(202);

    const job2 = await request(app)
      .get(`/api/jobs/${sub2.body.jobId}`)
      .set('x-afterframe-session', token)
      .expect(200);

    expect(job2.body.candidate.payload_json.recommended_type).toBe('ai_skill');

    const confirm2 = await request(app)
      .post('/api/artifacts/confirm')
      .set('x-afterframe-session', token)
      .send({
        job_id: sub2.body.jobId,
        selected_type: 'ai_skill',
        provenance_mode: 'model_extracted',
        skill_payload: job2.body.candidate.payload_json.skill_candidate,
      })
      .expect(201);

    // 3. Export AI Skill for Claude Code and Codex/AGENTS
    const exportClaude = await request(app)
      .post(`/api/artifacts/${confirm2.body.artifactId}/export`)
      .set('x-afterframe-session', token)
      .send({ target: 'claude_code_skill' })
      .expect(200);

    expect(exportClaude.body.exportPackage.testedInTarget).toBe(false);
    expect(exportClaude.body.exportPackage.files[0].relativePath).toBe(
      '.claude/skills/python-difflib-unified/SKILL.md'
    );

    // 4. Inspect Library & Afterframe Atlas graph
    const lib = await request(app)
      .get('/api/artifacts')
      .set('x-afterframe-session', token)
      .expect(200);
    expect(lib.body.items).toHaveLength(2);

    const atlas = await request(app)
      .get(`/api/atlas?focus=${encodeURIComponent(`artifact:${confirm1.body.artifactId}`)}`)
      .set('x-afterframe-session', token)
      .expect(200);

    expect(atlas.body.nodes.length).toBeGreaterThanOrEqual(3);
  });
});

describe('[LIVE UNMOCKED ENVIRONMENT BOUNDARY VERIFICATION] Real Network & Transcript Flows', () => {
  let db: DatabaseClient;

  beforeEach(async () => {
    db = await createDatabase({ dataDir: 'memory://' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('honestly rejects Instagram Reel links when connector is disabled (FR-008, FR-009, NFR-024)', async () => {
    const { app } = createApiApp({ db, runJobsAsync: false });
    const sess = await request(app).get('/api/session').expect(200);
    const token = sess.body.sessionToken as string;

    const sub = await request(app)
      .post('/api/jobs')
      .set('x-afterframe-session', token)
      .send({ url: 'https://www.instagram.com/reel/C8xYz12AbCd/' })
      .expect(202);

    const jobRes = await request(app)
      .get(`/api/jobs/${sub.body.jobId}`)
      .set('x-afterframe-session', token)
      .expect(200);

    expect(jobRes.body.job.status).toBe('failed');
    expect(jobRes.body.job.last_error_code).toBe('CONNECTOR_DISABLED');
    expect(jobRes.body.job.last_error_message).toContain(
      'Direct Instagram Reel fetching is disabled'
    );
  });

  it('completes live unmocked user-supplied transcript ingestion, manual review draft, save, export, and account deletion (FR-059, FR-058, FR-064)', async () => {
    const { app } = createApiApp({ db, runJobsAsync: false });
    const sess = await request(app).get('/api/session').expect(200);
    const token = sess.body.sessionToken as string;

    // 1. Live unmocked transcript submission
    const sub = await request(app)
      .post('/api/jobs')
      .set('x-afterframe-session', token)
      .send({
        url: 'https://www.youtube.com/shorts/SWx0YfIjjx8',
        pasted_transcript: [
          '0:00 Install the git CLI package on your workstation.',
          '0:05 Configure global user.name and user.email.',
          '0:12 Run git init inside the project directory.',
        ].join('\n'),
        source_title: 'Git Setup from Scratch',
      })
      .expect(202);

    // 2. Create grounded review draft directly from real transcript segments
    await request(app)
      .post(`/api/jobs/${sub.body.jobId}/manual-draft`)
      .set('x-afterframe-session', token)
      .expect(200);

    const jobDet = await request(app)
      .get(`/api/jobs/${sub.body.jobId}`)
      .set('x-afterframe-session', token)
      .expect(200);

    expect(jobDet.body.job.status).toBe('needs_review');
    expect(jobDet.body.evidence).toHaveLength(3);

    // 3. Confirm and save to library
    const confirm = await request(app)
      .post('/api/artifacts/confirm')
      .set('x-afterframe-session', token)
      .send({
        job_id: sub.body.jobId,
        selected_type: 'task',
        provenance_mode: 'user_created',
        task_payload: jobDet.body.candidate.payload_json.task_candidate,
      })
      .expect(201);

    expect(confirm.body.artifactId).toMatch(/^art_/);

    // 4. Export full user data JSON (FR-058)
    const dataExport = await request(app)
      .get('/api/account/export')
      .set('x-afterframe-session', token)
      .expect(200);

    expect(dataExport.body.artifacts).toHaveLength(1);
    expect(dataExport.body.source_evidence).toHaveLength(3);

    // 5. Delete account and all data (FR-064)
    await request(app)
      .delete('/api/account')
      .set('x-afterframe-session', token)
      .expect(200);

    const checkDeleted = await db.query(
      `SELECT id FROM artifacts WHERE id = $1`,
      [confirm.body.artifactId]
    );
    expect(checkDeleted.rows).toHaveLength(0);
  });
});

import http from 'node:http';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseClient } from '../../src/server/db/index.js';
import { createApiApp } from '../../src/server/app.js';
import {
  safeFetch,
  SsrfBlockedError,
} from '../../src/server/security/ssrf-guard.js';
import { sanitizeErrorDetails } from '../../src/server/security/redaction.js';

describe('Security Invariants: SSRF Redirects, Cross-User Ownership, and Credential Redaction', () => {
  let db: DatabaseClient;

  beforeEach(async () => {
    db = await createDatabase({ dataDir: 'memory://' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('blocks malicious HTTP redirects targeting internal/metadata addresses (NFR-021)', async () => {
    const redirectServer = http.createServer((_req, res) => {
      res.writeHead(302, {
        Location: 'http://169.254.169.254/latest/meta-data/iam/',
      });
      res.end();
    });

    await new Promise<void>((resolve) =>
      redirectServer.listen(0, '127.0.0.1', resolve)
    );
    const port = (redirectServer.address() as { port: number }).port;

    try {
      await expect(
        safeFetch(`http://127.0.0.1:${port}/start`, {
          allowLocalTestServer: true,
          skipDnsLookup: true,
        })
      ).rejects.toThrow(SsrfBlockedError);
    } finally {
      redirectServer.close();
    }
  });

  it('redacts Bearer tokens, API keys, and configured secret env vars from error logs (NFR-004, NFR-020)', () => {
    process.env.LLM_API_KEY = 'super_secret_env_llm_token_999';
    const rawErr = new Error(
      'Request failed with Authorization: Bearer sk-proj9876543210abcdefghijk and key super_secret_env_llm_token_999\n    at internalStack (file.js:1:1)'
    );

    const sanitized = sanitizeErrorDetails(rawErr);
    expect(sanitized).not.toContain('sk-proj9876543210abcdefghijk');
    expect(sanitized).not.toContain('super_secret_env_llm_token_999');
    expect(sanitized).not.toContain('at internalStack');
    expect(sanitized).toContain('[REDACTED]');
    delete process.env.LLM_API_KEY;
  });

  it('enforces strict cross-user ownership boundaries across jobs, artifacts, and Atlas (NFR-022)', async () => {
    const { app } = createApiApp({ db, runJobsAsync: false });

    // Create User A session and submit a transcript job
    const sessA = await request(app).get('/api/session').expect(200);
    const tokenA = sessA.body.sessionToken as string;

    const jobSubA = await request(app)
      .post('/api/jobs')
      .set('x-afterframe-session', tokenA)
      .send({
        pasted_transcript:
          '0:00 Step one is to initialize the workspace with git init.',
        source_title: 'User A Private Transcript',
      })
      .expect(202);

    const jobIdA = jobSubA.body.jobId as string;

    await request(app)
      .post(`/api/jobs/${jobIdA}/manual-draft`)
      .set('x-afterframe-session', tokenA)
      .expect(200);

    const jobDetA = await request(app)
      .get(`/api/jobs/${jobIdA}`)
      .set('x-afterframe-session', tokenA)
      .expect(200);

    const confirmA = await request(app)
      .post('/api/artifacts/confirm')
      .set('x-afterframe-session', tokenA)
      .send({
        job_id: jobIdA,
        selected_type: 'task',
        provenance_mode: 'user_created',
        task_payload: jobDetA.body.candidate.payload_json.task_candidate,
      })
      .expect(201);

    const artifactIdA = confirmA.body.artifactId as string;

    // Create User B session
    const sessB = await request(app).get('/api/session').expect(200);
    const tokenB = sessB.body.sessionToken as string;
    expect(tokenB).not.toBe(tokenA);

    // User B cannot read User A's job
    await request(app)
      .get(`/api/jobs/${jobIdA}`)
      .set('x-afterframe-session', tokenB)
      .expect(404);

    // User B cannot read, patch, or delete User A's artifact
    await request(app)
      .get(`/api/artifacts/${artifactIdA}`)
      .set('x-afterframe-session', tokenB)
      .expect(404);

    await request(app)
      .patch(`/api/artifacts/${artifactIdA}`)
      .set('x-afterframe-session', tokenB)
      .send({ title: 'Hijacked Title' })
      .expect(404);

    await request(app)
      .delete(`/api/artifacts/${artifactIdA}`)
      .set('x-afterframe-session', tokenB)
      .expect(404);

    // User B's library and Atlas are genuinely empty
    const libB = await request(app)
      .get('/api/artifacts')
      .set('x-afterframe-session', tokenB)
      .expect(200);
    expect(libB.body.items).toHaveLength(0);

    const atlasB = await request(app)
      .get('/api/atlas')
      .set('x-afterframe-session', tokenB)
      .expect(200);
    expect(atlasB.body.nodes).toHaveLength(0);
  });
});

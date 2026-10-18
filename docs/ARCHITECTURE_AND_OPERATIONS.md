# Afterframe — System Architecture, Security, & Operational Runbook

**Document Reference:** `AFTERFRAME-SRS-v1.1` Sections 7, 10, 11, 12 & Phase 8  
**Date:** 2026-10-18

---

## 1. Architectural Overview

```text
+-----------------------------------------------------------------------------------+
|                      AFTERFRAME CLIENT (React 19 + Vite PWA)                      |
|  - Dark Room + Amber Frame Tokens (Instrument Serif + Schibsted Grotesk)          |
|  - Screens A–H: Capture, Processing, Review & Edit, Library List + 2D/3D Atlas,   |
|    Artifact Detail, Skill Export Modal, Auth & Data Control                       |
|  - Web Share Target (/share-target), Clipboard Detection, Local Draft Autosave    |
+-----------------------------------------+-----------------------------------------+
                                          | HTTPS / JSON REST API (/api/*)
                                          v
+-----------------------------------------------------------------------------------+
|                     AFTERFRAME SERVER (Express + TypeScript)                      |
|                                                                                   |
|  +-----------------------+  +------------------------+  +----------------------+  |
|  | Acquisition Boundary  |  | Job Pipeline & LLM     |  | 5-Layer Validator    |  |
|  | - URL Canonicalizer   |  | - Idempotency Hash     |  | - Zod Strict Schema  |  |
|  | - SSRF Redirect Guard |  | - Stage Reuse          |  | - Semantic & Evidence|  |
|  | - YouTubeShortsAdapter|  | - Untrusted Evidence   |  | - Safety & Path Guard|  |
|  | - InstagramReelAdapter|  |   Boundary Tagging     |  | - 1x Bounded Repair  |  |
|  +-----------+-----------+  +-----------+------------+  +----------+-----------+  |
|              |                          |                          |              |
|  +-----------v--------------------------v--------------------------v-----------+  |
|  | ArtifactService | SkillExportRenderer | AtlasGraphBuilder | AuthService     |  |
|  +--------------------------------------+--------------------------------------+  |
+-----------------------------------------|-----------------------------------------+
                                          | ACID Transactions & GIN FTS
                                          v
+-----------------------------------------------------------------------------------+
|              POSTGRESQL 16 (pg.Pool via DATABASE_URL or PGlite 16.4)              |
|  users | auth_sessions | sources | source_evidence | processing_jobs              |
|  processing_runs | extraction_results | validation_runs | artifacts | tasks       |
|  task_steps | skills | skill_versions | artifact_sources | evidence_links         |
|  categories | artifact_categories | skill_exports | operational_metrics           |
+-----------------------------------------------------------------------------------+
```

---

## 2. REST API Endpoints

| Method & Path | Description |
|---|---|
| `GET /api/health` | Returns DB engine status, connector availability (`youtube`, `instagram`, `llm`), and aggregated stage latency/failure metrics (`Section 12.1`). |
| `GET /api/session` | Resolves or initializes guest/authenticated user session, connector capabilities, and retention policy schedule. |
| `POST /api/auth/signin` | Passwordless email sign-in; merges guest-session artifacts and sources into the authenticated account in a single ACID transaction (`Section 6.8.G`). |
| `PUT /api/settings` | Updates user theme (`dark`/`light`), `reducedMotion`, and `defaultExportTarget`. |
| `GET /api/account/export` | Exports all user-owned sources, evidence segments, categories, tasks, and skill versions as downloadable JSON (`FR-058`). |
| `DELETE /api/account` | Permanently deletes user account and cascades across all owned artifacts, jobs, sources, and evidence (`FR-064`). |
| `POST /api/jobs` | Validates URL/transcript input, computes idempotency key, creates or reuses `processing_jobs`, and runs the staged pipeline (`FR-001`, `FR-048`, `FR-059`). |
| `GET /api/jobs` | Lists recent jobs and count of `"Ready for review"` candidates (`needs_review`). |
| `GET /api/jobs/:id` | Returns job stage state, `processing_runs` history, `source_evidence` segments, and latest `extraction_results` candidate. |
| `POST /api/jobs/:id/retry` | Retries failed stage while reusing already-persisted `source_evidence` (`FR-053`). |
| `POST /api/jobs/:id/cancel` | Cancels an active job and preserves reusable evidence (`FR-050`). |
| `POST /api/jobs/:id/manual-draft` | Builds a grounded manual review candidate directly from persisted transcript/caption evidence when automatic LLM extraction is unavailable (`FR-019`, `FR-059`). |
| `POST /api/artifacts/confirm` | Validates and atomically persists a user-confirmed `task` or `ai_skill` with `evidence_links`, `artifact_sources`, and `artifact_categories` (`FR-027`, `NFR-010`). |
| `GET /api/artifacts` | Full-text search + multi-faceted filter (`type`, `status`, `topic`, `platform`) with keyset cursor pagination (`FR-042`–`FR-046`). |
| `GET /api/artifacts/:id` | Returns full artifact detail, steps or versioned `SkillSpec`, linked sources, cited evidence segments, and export history. |
| `PATCH /api/artifacts/:id` | Updates task steps/status or creates a new immutable `skill_versions` record for edited AI Skills (`FR-054`, `FR-055`). |
| `DELETE /api/artifacts/:id` | Initiates 10-second undoable deletion (`FR-063`) or immediate permanent deletion (`?immediate=true`) while preserving shared source evidence (`FR-057`). |
| `POST /api/artifacts/:id/undo-delete` | Restores an artifact within the 10-second undo window (`FR-063`). |
| `POST /api/artifacts/:id/finalize-delete` | Finalizes deletion after the 10-second undo timer expires and purges unreferenced orphan sources. |
| `POST /api/artifacts/:id/export` | Renders a validated `claude_code_skill` or `codex_agents_skill` package with SHA-256 hash and `tested_in_target: false` (`FR-036`, `FR-037`). |
| `GET /api/atlas` | Returns the user's normalized spatial graph (`nodes`, `edges`, `adjacency`) with 2-hop BFS focus and 300-node topic clustering (`FR-047`, `Section 8.3`). |

---

## 3. Data Retention & Deletion Policy (`FR-017`, `FR-057`, `FR-063`, `FR-064`, `NFR-025`)

1. **Temporary Acquisition Media (`tmp/media/<jobId>`):** Deleted immediately in a `finally` block upon stage completion or failure (`0 days` retention).
2. **Unconfirmed Review Candidates (`extraction_results`):** Stored with `expires_at = NOW() + INTERVAL '7 days'` (`Section 6.8.A`).
3. **Confirmed Artifacts & Shared Evidence (`artifacts`, `sources`, `source_evidence`):**
   - Deleting an artifact enters a 10-second soft-delete window (`deleted_at`, `delete_undo_until`) so the user can click **Undo** (`FR-063`).
   - Upon finalization, `artifacts`, `tasks`/`task_steps`, `skills`/`skill_versions`, and `evidence_links` for that artifact are purged in an ACID transaction.
   - `sources` and `source_evidence` are purged **if and only if** zero remaining `artifact_sources` rows reference that `source_id` (`FR-057`).

---

## 4. Operational Runbook

- **Database Migrations:** `npm run db:migrate` (applies `src/server/db/migrations/001_initial_schema.sql`).
- **Typecheck & Production Build:** `npm run typecheck && npm run build`.
- **Automated Verification Suite:** `npm test` (runs unit, integration, security, UI/accessibility, and E2E suites).
- **Performance & Query-Plan Benchmark:** `npm run bench` (verifies `p95 < 300 ms` search budget and prints `EXPLAIN ANALYZE` query plans).
- **Production Start:** `npm start` (starts Express + static asset server on `0.0.0.0:${PORT:-3000}`).

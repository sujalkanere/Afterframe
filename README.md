# Afterframe

**Turn short-form video into something you can actually use.**

Afterframe is a mobile-first responsive web application (`AFTERFRAME-SRS-v1.1`) that transforms short-form instructional videos (YouTube Shorts first, plus direct transcript ingestion) into **user-confirmed, evidence-backed structured artifacts**:

1. **Tasks (`task`)** — Grounded checklists with ordered steps, timestamped provenance chips, and notes for human execution.
2. **AI Skills (`ai_skill`)** — Versioned, schema-validated `SkillSpec` packages exportable to **Claude Code (`.claude/skills/<slug>/SKILL.md`)** and **Codex / AGENTS-compatible (`.agents/skills/<slug>/SKILL.md`)** skill folders.

---

## Table of Contents

1. [Core Principles & Capabilities](#1-core-principles--capabilities)
2. [APIs & Environment Configuration](#2-apis--environment-configuration)
3. [Quick Start](#3-quick-start)
4. [System Architecture & Pipeline](#4-system-architecture--pipeline)
5. [Screens & Experience System ("The Frame")](#5-screens--experience-system-the-frame)
6. [PostgreSQL Data Model & Invariants](#6-postgresql-data-model--invariants)
7. [Security, Privacy, & Data Retention](#7-security-privacy--data-retention)
8. [Verification, Tests, & Empirical Benchmarks](#8-verification-tests--empirical-benchmarks)
9. [Documentation Index](#9-documentation-index)

---

## 1. Core Principles & Capabilities

- **Real Content Only (`NFR-001`):** Zero fabricated extraction outputs, zero simulated percentage bars, and a genuinely empty library until you save your first artifact (`FR-041`).
- **Evidence-Backed Provenance (`Section 6.3`):** Every extracted step carries an accessible provenance chip (`Transcript 0:14`, `Frame 0:22`, `Inferred`, `Edited by you`) distinguished by text label, icon, and border style (solid cyan, solid violet, dashed amber, double neutral) so provenance never relies on color alone (`WCAG 2.2 AA`).
- **5-Layer Runtime Validation & Bounded Repair (`Section 8.6`, `Section 9.4`):** Validates structural schema (`Zod`), semantic invariants, source evidence linkage, safety/prompt-injection guards, and export path safety (`NFR-026`), with at most **1 bounded repair retry** (`FR-026`).
- **First-Class Transcript Ingestion (`FR-059`):** Users can paste a transcript directly from the Capture screen (`"Paste the transcript instead"`) without needing a failed URL attempt first, and can build a grounded manual review draft even when external LLM APIs are offline.
- **Afterframe Atlas (`Section 6.5`, `Section 8.3`):** Normalized adjacency-list knowledge graph with 2-hop BFS neighborhood focus, a 300-node cap with automatic topic clustering, an accessible 2D SVG canvas + keyboard arrow navigation + node directory, and a lazy-loaded 3D Three.js orbital inspector.
- **Editorial Dark Room + Amber Frame Aesthetic (`Section 6`):** Warm obsidian dark mode default (`#0B0C0E` + `#F5A524` amber frame accent) and warm archival paper light mode (`#F7F4EE` + `#B86B11` deep ochre), `Instrument Serif` + `Schibsted Grotesk` typography, **Frame Lock** and **The Kept Moment** signature interactions, and full `prefers-reduced-motion` support.

---

## 2. APIs & Environment Configuration

### What Works with Zero API Keys Out of the Box
- **Database:** Embedded **PostgreSQL 16.4 (`@electric-sql/pglite`)** persisted locally in `./data/pglite` (no external DB server required).
- **YouTube Shorts Metadata & Captions:** Uses YouTube’s public unauthenticated endpoints (`youtube.com/oembed` and `youtube.com/api/timedtext`) when the server has standard internet egress to `youtube.com`.
- **Direct Transcript Ingestion, Manual Drafts, Library, Atlas, & Skill Export:** Pasting a transcript, generating a grounded review draft (`POST /api/jobs/:id/manual-draft`), editing steps, saving Tasks or AI Skills, full-text search (including non-Latin scripts like Hindi), exploring the 2D/3D Atlas, and exporting `SKILL.md` packages all work with **0 API keys**.

### Required for Automatic AI Extraction (1 OpenAI-Compatible API Key)
To automatically synthesize video transcripts into dual **Task + AI Skill (`SkillSpec`)** candidates with destination recommendations and bounded repair (`src/server/extraction/llm-extractor.ts`), configure any **OpenAI-compatible Chat Completions API**:

| Environment Variable | Default | Description & Examples |
|---|---|---|
| `LLM_API_KEY` | *(unset)* | API key for your LLM provider (`sk-...` for OpenAI / OpenRouter / Groq / Together, or `ollama` for local Ollama). |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible base URL:<br>• Google AI Studio: `https://generativelanguage.googleapis.com/v1beta/openai`<br>• OpenAI: `https://api.openai.com/v1`<br>• OpenRouter: `https://openrouter.ai/api/v1`<br>• Groq: `https://api.groq.com/openai/v1`<br>• Local Ollama: `http://localhost:11434/v1` |
| `LLM_MODEL` | `gpt-4o-mini` | Model identifier supporting JSON mode (`gemini-3.6-flash`, `gpt-4o-mini`, `gpt-4o`, `llama-3.3-70b-versatile`, `qwen2.5-coder:14b`). |
| `LLM_TIMEOUT_MS` | `30000` | Per-request timeout in milliseconds for LLM extraction calls. |

### Optional Infrastructure & Connector Variables

| Environment Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP server port (binds to `0.0.0.0`). |
| `DATABASE_URL` | *(unset → uses `./data/pglite`)* | Optional external PostgreSQL connection string (`postgresql://user:pass@host:5432/afterframe`). |
| `PGLITE_DATA_DIR` | `./data/pglite` | Local directory for embedded PostgreSQL storage when `DATABASE_URL` is unset (`memory://` for in-memory tests). |
| `YOUTUBE_CONNECTOR_ENABLED` | `true` | Enables/disables automatic YouTube Shorts metadata & caption acquisition. |
| `YOUTUBE_ACQUISITION_BASE_URL` | `https://www.youtube.com` | Base URL for YouTube `oembed` and `api/timedtext` requests. |
| `TRANSCRIPTION_BASE_URL` | *(unset)* | Optional speech-to-text endpoint when a Short has no public/auto-generated captions. |
| `TRANSCRIPTION_API_KEY` | *(unset)* | Optional API key for the speech-to-text fallback provider. |
| `INSTAGRAM_CONNECTOR_ENABLED` | `false` | Disabled by default (`FR-008`, `FR-009`, `NFR-024`) because Instagram blocks unauthenticated Reel fetching. |
| `INSTAGRAM_PUBLIC_API_BASE_URL` | *(unset)* | Authorized Instagram oEmbed/Graph proxy endpoint if `INSTAGRAM_CONNECTOR_ENABLED=true`. |

---

## 3. Quick Start

### 1. Install Dependencies & Apply Database Migrations
```bash
npm install
npm run db:migrate
```

### 2. Configure Environment (Optional for Manual Mode, Required for Auto LLM Extraction)
```bash
export LLM_API_KEY="sk-your-api-key"
export LLM_BASE_URL="https://api.openai.com/v1"
export LLM_MODEL="gpt-4o-mini"
```

### 3. Start the Server
```bash
# Development server with Vite HMR (http://0.0.0.0:3000)
npm run dev

# Production build & start
npm run build
npm start
```

### 4. Available NPM Scripts
| Command | Description |
|---|---|
| `npm run dev` | Starts the Express + Vite middleware server on `0.0.0.0:3000`. |
| `npm run build` | Builds the production client bundle (`dist/client`) and compiles server TypeScript (`dist/server`). |
| `npm start` | Runs the compiled production server (`dist/server/server/index.js`). |
| `npm run db:migrate` | Applies `src/server/db/migrations/001_initial_schema.sql` idempotently. |
| `npm run typecheck` | Runs strict TypeScript checking (`tsc --noEmit`). |
| `npm test` | Runs all 5 Vitest suites (unit, integration, security, UI/accessibility, and E2E). |
| `npm run bench` | Runs the 500-item FTS + `EXPLAIN ANALYZE` + 530-node Atlas clustering benchmark (`scripts/benchmark.ts`). |

---

## 4. System Architecture & Pipeline

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

### Staged Job Lifecycle (`src/server/jobs/worker.ts`)
1. **`queued` → `acquiring`:** Canonicalizes URL, enforces SSRF protections, resolves public metadata (`oEmbed`), or ingests user-supplied transcript segments.
2. **`transcribing`:** Fetches timed caption segments (`json3`) or parses user-pasted timestamps (`0:14`, `[0:14 - 0:22]`). Reuses existing `source_evidence` on retry (`Section 8.5`).
3. **`analyzing` → `validating`:** Sends evidence inside `<untrusted_source_evidence>` boundary tags to the configured LLM, runs the 5-layer validator, and performs at most 1 targeted repair retry if validation fails (`FR-026`).
4. **`needs_review` → `confirmed`:** Stores the candidate in `extraction_results` (`7-day` TTL) until the user reviews, edits, chooses **Task** or **AI Skill**, and confirms (`POST /api/artifacts/confirm`).

---

## 5. Screens & Experience System ("The Frame")

- **Screen A — Capture / Home (`CaptureScreen.tsx`):** Viewfinder-framed link input, direct `"Paste the transcript instead"` toggle (`FR-059`), focus-triggered clipboard link prompt, `"Ready for review"` banner for unconfirmed jobs, and a honest empty library state.
- **Screen B — Staged Processing (`ProcessingScreen.tsx`):** Real stage indicators (`Checking source link`, `Reading captions and spoken steps`, `Building your review draft`, `Ready for your review`), retry/cancel controls, and direct fallback to manual transcript draft mode.
- **Screen C — Review & Edit (`ReviewScreen.tsx`):** Bidirectional step-to-evidence highlighting, **Task** vs. **AI Skill** destination switch with source-grounded recommendation reason, step add/edit/reorder/delete, local `localStorage` draft autosave, inline inference warning (`"No spoken evidence for this detail. Kept as inference."`), and **The Kept Moment** confirmation.
- **Screen D — Library List & Afterframe Atlas (`LibraryScreen.tsx`, `AtlasView.tsx`, `Atlas3DCanvas.tsx`):** Full-text search, type/status/topic/platform filters, 10-second undoable deletion banner, and the **Afterframe Atlas** (`Square = Source`, `Circle = Task`, `Diamond = AI skill`, `Ring = Topic`) with 2D SVG + keyboard navigation + accessible node directory and optional lazy-loaded 3D Three.js canvas.
- **Screen E & F — Artifact Detail & Skill Export (`ArtifactDetailScreen.tsx`):** Interactive checklist completion for Tasks, immutable `SkillSpec` version editor for AI Skills (`FR-054`), cited transcript drawer, and Skill Export modal (`claude_code_skill` and `codex_agents_skill`) with honest `"Validated against Afterframe schema; not yet tested in target environment"` status (`FR-037`).
- **Screen G & H — Auth, Settings, & Data Control (`SettingsScreen.tsx`):** Guest trial with seamless artifact merge on passwordless sign-in, Dark/Light theme and Reduced Motion toggles, full JSON data export (`GET /api/account/export`, `FR-058`), and cascading account deletion (`DELETE /api/account`, `FR-064`).
- **Global Command Palette (`CommandPalette.tsx`):** Accessible via `Ctrl+K` / `Cmd+K` from any screen.

---

## 6. PostgreSQL Data Model & Invariants

Defined in [`src/server/db/migrations/001_initial_schema.sql`](src/server/db/migrations/001_initial_schema.sql):
- **19 Relational Tables:** `schema_migrations`, `users`, `auth_sessions`, `sources`, `source_evidence`, `processing_jobs`, `processing_runs`, `extraction_results`, `validation_runs`, `artifacts`, `tasks`, `task_steps`, `skills`, `skill_versions`, `artifact_sources`, `evidence_links`, `categories`, `artifact_categories`, `skill_exports`, `operational_metrics`.
- **Database-Enforced Invariants:**
  - `categories_prohibited_slug_check`: Blocks temporal/status labels (`short_term`, `short-term`, `task`, `ai_skill`, `todo`, `urgent`) from being stored as topic categories (`UC-04`, `FR-043`).
  - `UNIQUE (task_artifact_id, position)` and `UNIQUE (skill_id, version_number)`: Guarantees contiguous step ordering and immutable skill version history.
  - `ON DELETE RESTRICT` on `evidence_links.source_evidence_id`: Prevents silent deletion of evidence still cited by an active artifact.

---

## 7. Security, Privacy, & Data Retention

- **SSRF & Redirect Protection (`NFR-021`):** `validateOutboundUrl` and `safeFetch` block loopback, private RFC1918 ranges, link-local/cloud metadata (`169.254.169.254`), IPv6 private ranges, embedded URL credentials, and open-redirect hops.
- **Cross-User Isolation (`NFR-022`):** Every job, source, artifact, category, and Atlas query is scoped to the authenticated `user_id`.
- **Secret Redaction (`NFR-004`, `NFR-020`):** `sanitizeErrorDetails` strips `Bearer` tokens, `sk-...` / `ghp_...` keys, stack traces, and configured secret environment values before logging or persisting error details.
- **Safe Export Paths (`NFR-026`):** `validateSafePackagePath` rejects `..` traversal, absolute paths, and executable extensions (`.sh`, `.exe`, `.py`, `.bat`).
- **Data Retention Schedule (`FR-017`, `FR-057`, `FR-063`, `NFR-025`):**
  - *Temporary job media (`tmp/media/<jobId>`):* `0 days` (deleted immediately on stage completion/failure).
  - *Unconfirmed review candidates:* `7 days` (`expires_at`).
  - *Deleted artifacts:* `10-second` undo window before permanent purge; shared `sources` and `source_evidence` are retained if and only if referenced by another saved artifact.

---

## 8. Verification, Tests, & Empirical Benchmarks

- **Automated Test Suites (`npm test` — 5 suites, 24 tests passing):**
  - `tests/unit/canonicalizer-and-validator.test.ts` — URL canonicalization, SSRF host checks, idempotency hashing, timestamp parsing, 5-layer validator, and export path safety.
  - `tests/integration/pipeline-and-db.test.ts` — PostgreSQL `CHECK`/`UNIQUE` constraints, bounded single-retry LLM repair, `SkillSpec` versioning, Hindi Unicode FTS search, 10s undoable delete, shared-source evidence retention, and 300-node Atlas topic clustering.
  - `tests/security/security-invariants.test.ts` — Malicious HTTP 302 redirect SSRF blocking, credential redaction, and cross-user authorization isolation.
  - `tests/ui/screens-and-a11y.test.tsx` — Genuine empty state, single primary button rule, provenance chip non-color distinction, Review screen inference warnings + **The Kept Moment**, and Atlas shape legend + accessible node directory.
  - `tests/e2e/end-to-end-pipeline.test.ts` — Separated into `[ISOLATED TRANSPORT E2E WITH REAL EVALUATION DATASET]` (using `tests/eval-dataset/real-youtube-shorts.json`) and `[LIVE UNMOCKED ENVIRONMENT BOUNDARY VERIFICATION]`.
- **Performance & Bundle Budget Results (`npm run build && npm run bench`):**
  - **Initial Client JS Bundle:** `87.62 KB gzip` (Budget: `< 170 KB` compressed excluding fonts, `Section 6.11`).
  - **3D Atlas Chunk (`atlas-3d`):** `118.85 KB gzip`, lazy-loaded exclusively when the user toggles `3D Orbit`.
  - **Library Search + Filter (500 items, PostgreSQL 16.4 `GIN` Index):** `p50 = 8.71 ms`, `p95 = 11.69 ms` (Budget: `p95 < 300 ms`, `NFR-005`).
  - **Atlas 2-Hop BFS + 300-Node Clustering (530 nodes):** `p50 = 17.45 ms`, `p95 = 21.35 ms`.

---

## 9. Documentation Index

- [`docs/AFTERFRAME_SRS_v1.1.md`](docs/AFTERFRAME_SRS_v1.1.md) — Canonical Software Requirements Specification (v1.1).
- [`docs/PHASE_0_AUDIT_AND_FEASIBILITY.md`](docs/PHASE_0_AUDIT_AND_FEASIBILITY.md) — Phase 0 Repository Inventory, REA Audit, and Open-Source Acquisition Feasibility Report.
- [`docs/DESIGN_RESEARCH_AND_REA.md`](docs/DESIGN_RESEARCH_AND_REA.md) — Phase 0 Reverse Engineer Anything (`rea-agents`) Evidence Report & Design Synthesis.
- [`docs/ADR_ALGORITHMS.md`](docs/ADR_ALGORITHMS.md) — Algorithmic Decision Records, Complexity Proofs, and Empirical `EXPLAIN ANALYZE` Benchmarks.
- [`docs/ARCHITECTURE_AND_OPERATIONS.md`](docs/ARCHITECTURE_AND_OPERATIONS.md) — System Architecture, REST API Reference, Data Retention Policy, and Operational Runbook.

# Afterframe — Algorithmic Decision Records (ADRs) & Empirical Benchmarks

**Document Reference:** `AFTERFRAME-SRS-v1.1` Section 8 & Phase 7 Task 4  
**Date:** 2026-10-18

---

## ADR-001: Platform-Aware URL Canonicalization & SSRF Pre-Flight

### Context
Users share short-form video links across mobile and desktop clients in varied formats (`youtube.com/shorts/<id>?feature=share`, `youtu.be/<id>?si=...`, `m.youtube.com/watch?v=<id>`, `instagram.com/reel/<shortcode>/?igsh=...`). Without canonicalization, equivalent URLs create duplicate sources and redundant extraction jobs. Additionally, arbitrary URL submission presents a Server-Side Request Forgery (SSRF) surface (`NFR-021`).

### Selected Design (`src/shared/url-canonicalizer.ts` & `src/server/security/ssrf-guard.ts`)
1. Parse input with the WHATWG `URL` parser after length bounds checking (`<= 2048` chars).
2. Enforce `https:`/`http:`, reject embedded credentials (`username`/`password`), non-standard ports, and private/loopback/link-local/metadata IPv4/IPv6 ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`, `.local`, `.internal`).
3. Match host against platform allowlist (`youtube.com`, `youtu.be`, `instagram.com`), extract `(platform, platform_content_id)`, strip tracking query parameters (`si`, `feature`, `igsh`, `utm_*`), and emit deterministic `canonical_url` while preserving `submitted_url`.
4. During outbound HTTP resolution (`safeFetch`), follow redirects manually (`redirect: 'manual'`, max 3 hops) and re-validate both hostname and DNS-resolved IP addresses on every hop.

### Complexity & Empirical Benchmark
- **Time Complexity:** $O(L)$ where $L$ is URL string length ($L \le 2048$).
- **Space Complexity:** $O(L)$.
- **Empirical Latency (1,000 runs, `scripts/benchmark.ts`):** `p50 = 0.0035 ms`, `p95 = 0.0044 ms`.

### Rejected Alternatives
- **Naive string equality or full query-string preservation:** Fails to deduplicate mobile share links containing ephemeral `si=` or `igsh=` tokens.
- **Unrestricted `fetch()` with automatic redirect following:** Vulnerable to open-redirect SSRF targeting `169.254.169.254` or internal services.

---

## ADR-002: Content-Addressed Idempotency & Stage-Level Pipeline Reuse

### Context
Users may double-click "Extract", retry a job that failed at the LLM stage, or create multiple artifacts from the same source video (`FR-051`, `FR-052`, `FR-053`).

### Selected Design (`src/server/jobs/idempotency.ts` & `src/server/jobs/worker.ts`)
1. Compute deterministic SHA-256 `idempotency_key = SHA256(user_id || platform || platform_content_id || normalized_transcript_hash || PIPELINE_VERSION)`.
2. Store an explicit stage state machine on `processing_jobs` (`queued -> acquiring -> transcribing -> analyzing -> validating -> needs_review -> confirmed | failed | cancelled`) with per-stage execution records in `processing_runs`.
3. On stage retry (`POST /api/jobs/:id/retry`), inspect `source_evidence`: if caption/transcript segments already exist for `source_id`, reuse them directly and resume at `analyzing` without re-fetching from the upstream video platform (`Section 8.5`).

### Complexity
- **Time Complexity:** $O(N)$ over transcript byte length $N$ for SHA-256 hashing; $O(\log J)$ B-tree index lookup on `(user_id, idempotency_key)`.
- **Space Complexity:** $O(1)$ auxiliary memory for streaming SHA-256 digest.

---

## ADR-003: PostgreSQL GIN Full-Text Search & Composite Indexed Filtering

### Context
Library views must support fast search across artifact titles, descriptions, step content, and source metadata combined with structured filters (`artifact_type`, `status`, `topic`, `platform`) within a `p95 < 300 ms` budget for 500 items (`NFR-005`, `Section 8.4`).

### Selected Design (`src/server/db/migrations/001_initial_schema.sql` & `src/server/artifacts/artifact-service.ts`)
1. Maintain a PostgreSQL `GIN` index (`idx_artifacts_fts_gin`) over `to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))` alongside composite B-tree indexes `idx_artifacts_user_status_created (user_id, status, created_at DESC)` and `idx_artifacts_user_type_created (user_id, artifact_type, created_at DESC)`.
2. Use the `'simple'` text search configuration so language-neutral tokenization works consistently across English and non-Latin scripts such as Hindi (`पायथन`) without language-stemmer data loss, supplemented by `ILIKE` matching on step bodies and source metadata.
3. Use keyset pagination (`(created_at, id) < ($cursorCreatedAt, $cursorId)`) for $O(\log N)$ page traversal without `OFFSET` scan degradation.

### Complexity & Empirical `EXPLAIN ANALYZE` Verification
- **Time Complexity:** $O(\log N + K)$ where $N$ is user artifact count and $K$ is matching result count.
- **Empirical Latency (500 artifacts, 50 runs, `scripts/benchmark.ts`):**
  - `p50 = 8.71 ms`
  - `p95 = 11.69 ms` (Target `< 300 ms` per `NFR-005` — **passes with 25x margin**).
- **Verified PostgreSQL 16.4 `EXPLAIN ANALYZE` Plan:**
  ```text
  Limit  (cost=275.68..275.81 rows=50 width=57) (actual time=2.602..2.697 rows=50 loops=1)
    ->  Sort  (cost=275.68..276.93 rows=500 width=57) (actual time=2.599..2.658 rows=50 loops=1)
          Sort Key: created_at DESC
          Sort Method: top-N heapsort  Memory: 30kB
          ->  Bitmap Heap Scan on artifacts a  (cost=109.07..259.07 rows=500 width=57) (actual time=0.980..1.612 rows=500 loops=1)
                Recheck Cond: (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text))) @@ '''git'' & ''workflow'''::tsquery)
                Filter: ((deleted_at IS NULL) AND (user_id = 'usr_bench_500'::text))
                Heap Blocks: exact=15
                ->  Bitmap Index Scan on idx_artifacts_fts_gin  (cost=0.00..108.95 rows=500 width=0) (actual time=0.963..0.963 rows=500 loops=1)
  Planning Time: 0.287 ms
  Execution Time: 2.887 ms
  ```

---

## ADR-004: Normalized Adjacency-List Graph, 2-Hop BFS, and 300-Node Topic Clustering for Afterframe Atlas

### Context
The Afterframe Atlas (`Section 6.5`, `Section 8.3`) visualizes relationships between Sources (`square`), Tasks (`circle`), AI Skills (`diamond`), and Topics (`ring`). Force-directed simulations degrade on mobile viewports above ~300 nodes and cause non-deterministic node drift across page loads.

### Selected Design (`src/server/atlas/graph-builder.ts`)
1. Construct a normalized adjacency list (`Record<string, string[]>`) from relational joins over `artifacts`, `artifact_sources`, and `artifact_categories` in $O(V + E)$ time.
2. Assign deterministic initial 2D/3D coordinates `(x, y, z)` using an FNV-1a 32-bit hash of the canonical node ID mapped onto concentric radial rings by node kind (`topic` inner ring, `task`/`ai_skill` middle ring, `source` outer ring).
3. When `focusNodeId` is specified, execute a queue-based Breadth-First Search (`bfsNeighborhood`) bounded to `maxHops = 2` in $O(V_f + E_f)$ time.
4. Enforce `HARD_ATLAS_NODE_CAP = 300`: when $|V| > 300$, automatically collapse leaf artifacts under each topic into deterministic `cluster` nodes (`topic -> cluster`) until $|V| \le 300$, allowing on-demand expansion via `?expandCluster=topic:<id>`.

### Complexity & Empirical Benchmark
- **Time Complexity:** $O(V + E)$ full build; $O(V_f + E_f)$ focused 2-hop neighborhood.
- **Space Complexity:** $O(V + E)$.
- **Empirical Latency (530 unclustered nodes clustered to $\le 300$, 30 runs, `scripts/benchmark.ts`):** `p50 = 17.45 ms`, `p95 = 21.35 ms`.

---

## ADR-005: 5-Layer Runtime Validation & Bounded Single-Retry Repair

### Context
LLM outputs are probabilistic and untrusted (`Principle 5`, `Section 8.6`, `Section 9.4`). Unvalidated outputs can hallucinate unsupported deadlines/priorities (`FR-025`), cite non-existent evidence IDs, claim visual frame analysis when zero frames were extracted (`FR-014`), or embed unsafe shell commands.

### Selected Design (`src/server/validation/validator.ts` & `src/server/extraction/llm-extractor.ts`)
1. Validate every candidate envelope through 5 sequential deterministic layers:
   - **Layer 1 (Structural):** Strict Zod schema (`z.object(...).strict()`) rejecting unknown fields and invented `deadline`/`priority`.
   - **Layer 2 (Semantic):** Contiguous 0-based step positions, unique step IDs, non-contradictory `intended_use` vs `non_use_conditions`, prohibited temporal topics (`short_term`, `task`), and explicit `capability_declarations`.
   - **Layer 3 (Evidence):** Every `evidence_refs` entry must match a persisted `source_evidence.id` for the job's source; `visual` provenance is rejected if zero visual frames exist; `inferred` steps emit `INFERRED_STEP_NOTICE`.
   - **Layer 4 (Safety):** Regex guards blocking prompt-injection directives, destructive commands (`rm -rf /`, `mkfs`, fork bombs), and secret tokens (`sk-...`, `ghp_...`).
   - **Layer 5 (Export Target Compatibility):** Validates path traversal (`..`, leading `/`) and blocks executable file extensions (`.sh`, `.exe`, `.py`, `.bat`) before writing export packages (`NFR-026`).
2. **Bounded Repair (`MAX_REPAIR_ATTEMPTS = 1`):** If validation returns `invalid`, the extractor sends one targeted repair prompt containing the structured `ValidationFinding[]` list. If the repaired output still fails, the job transitions to `failed` (`EXTRACTION_INVALID_SCHEMA`) and offers manual transcript draft review — never fabricating fallback output (`FR-026`, `NFR-001`).

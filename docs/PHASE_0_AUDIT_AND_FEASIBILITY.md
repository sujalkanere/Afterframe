# Phase 0 — Repository Audit & Source Acquisition Feasibility Report

**Date:** 2026-10-18  
**Branch:** `arena/08696ba9-afterframe`  
**Base Commit:** `5ebe5725db24c901bec92b4ecf2ad6dec97cc668`  
**Status:** Completed (Phase 0 Exit Criteria Met)

---

## 1. Repository & Environment Inventory

### 1.1 Existing Repository State
- **Repository:** `sujalkanere/Afterframe` (`/home/user/Afterframe`)
- **Initial Contents:** Only `README.md` (`# Afterframe`, 13 bytes) at commit `5ebe572`. No pre-existing package manifest, database migrations, backend routes, or frontend components.
- **Architectural Implication:** Per Section 7.1 and Section 14 of `AFTERFRAME_SRS_v1.1.md`, we adopt a clean TypeScript modular monolith with explicit server/client/worker/provider boundaries, shared strict Zod contracts, and real PostgreSQL persistence.

### 1.2 Runtime & Host Environment
| Component | Observed Value | Notes |
|---|---|---|
| OS / Kernel | Debian 12 (bookworm) `x86_64` | 2 vCPU (Intel Xeon @ 2.60GHz), 3.8 GiB RAM, 19 GiB free disk |
| Node.js | `v22.22.3` | Native `fetch`, ESM/CommonJS, `node:crypto`, Web Streams |
| npm | `10.9.8` | Outbound access to `registry.npmjs.org` verified |
| Python | `3.11.2` (`pip 23.0.1`) | Outbound access to `pypi.org` and `files.pythonhosted.org` verified |
| PostgreSQL Engine | `@electric-sql/pglite` (PostgreSQL 16 WASM) + `pg` (`Pool`) | Dual-mode real PostgreSQL: uses `DATABASE_URL` via `pg.Pool` when configured, or embedded real PostgreSQL (`@electric-sql/pglite`) persisted on disk (`./data/pgdata`) with full `JSONB`, `GIN` full-text search indexes, foreign keys, `CHECK` constraints, and ACID transactions |
| Sandbox Network Egress | Allowlisted hosts only | `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org` |

---

## 2. REA (`morluto/rea`) Inspection & Setup Review

Per Phase 0 Task 2 and Section 6.13, we inspected `https://github.com/morluto/rea.git` (`rea-agents@6.7.0`, MIT License, Copyright (c) 2026 morluto):

1. **Repository & Skill Inspection:**
   - Bundled skill `.agents/skills/reverse-engineer-anything/SKILL.md` is at version `"42"`.
   - Catalog digests (`doctor --json`): `cli_commands: 153`, `mcp_tools: 207`, `mcp_prompts: 6` (`combined_sha256: 96d8f6e6ea1b1ba13557216624a3461c738729d53c79b4b0100d1f3a3a32441c`).
2. **Read-Only Setup Plan Review (`npx -y rea-agents@latest setup --dry-run --json`):**
   - Reported `status: "planned"`, `plannedActions: []`, `appliedActions: []`.
   - Native binary engines (`hopper`, `ghidra`, `ida`, `jadx`, `kuna`) are not installed in this Linux container and are not needed for JavaScript/web UI inspection.
   - Per REA's `SKILL.md` (`version: 42`) and `docs/cli.md`, static JavaScript application analysis (`npx -y rea-agents@latest analyze-javascript-application <path> --json`) requires neither MCP server registration nor native disassemblers and outputs sealed, SHA-256-verified `Evidence` JSON directly.
3. **Boundary Enforcement:**
   - REA was used strictly as an offline development-time inspection tool in `/tmp` and is **not** added to `package.json` or the production runtime (`Section 6.13`, `Section 11`).
   - Full REA findings, `evidence_id` hashes, and limitations are documented in `docs/DESIGN_RESEARCH_AND_REA.md`.

---

## 3. Open-Source URL-Based Acquisition Tools Investigation (FR-008)

We inspected source repositories, licenses, dependencies, maintenance status, and runtime behavior of candidate free/open-source acquisition tools for **YouTube Shorts** and **Instagram Reels**:

| Candidate | Version / License | Supported Inputs | Capabilities | Limitations & Legal/Platform Boundaries |
|---|---|---|---|---|
| **1. `yt-dlp/yt-dlp`** | `2026.08.19` · `Unlicense` (Python) | `youtube.com/shorts/<id>`, `youtube.com/watch?v=<id>`, `youtu.be/<id>`, `instagram.com/reel/<id>` | Extracts canonical metadata (`--dump-single-json --skip-download`), manual & auto-generated subtitles (`--write-subs --write-auto-subs`), and bounded audio/video streams | Requires outbound HTTPS to `www.youtube.com` / `googlevideo.com`. Datacenter IPs can encounter HTTP 429 or bot checks. Must never be configured with stolen cookies or rate-limit bypasses (FR-009). |
| **2. `jdepoix/youtube-transcript-api`** | `1.2.x` · `MIT` (Python) | 11-char YouTube video IDs (including Shorts IDs) | Lightweight InnerTube caption-track fetcher returning `[ { text, start, duration } ]` without downloading media streams or launching a headless browser | Fails when captions are disabled by the creator, on music-only Shorts, or when `www.youtube.com` is unreachable. Does not return full video metadata by itself. |
| **3. `LuanRT/YouTube.js` (`youtubei.js`)** | `18.2.0` · `MIT` (TypeScript / Node.js) | YouTube Shorts & standard video IDs | Pure TypeScript/JS InnerTube client for metadata, chapters, and timed caption tracks; native fit for a Node.js worker | Subject to YouTube InnerTube client version rotation and requires direct outbound HTTPS to `www.youtube.com`. |
| **4. YouTube oEmbed + Official YouTube Data API v3** | Official REST APIs | `https://www.youtube.com/oembed`, `googleapis.com/youtube/v3/videos` | `oEmbed` returns verified `title`, `author_name`, `author_url`, and `thumbnail_url` with zero API key. `videos.list` (with `YOUTUBE_API_KEY`) returns `snippet`, `contentDetails.duration`, and `status`. | `captions.download` in Data API v3 requires OAuth 2.0 ownership of the video for arbitrary third-party videos; therefore caption retrieval for public Shorts must pair `oEmbed`/`Data API` metadata with public caption-track retrieval or audio transcription. |
| **5. `instaloader/instaloader`** | `4.15.4` · `MIT` (Python) | `instagram.com/reel/<shortcode>`, `instagram.com/p/<shortcode>` | Public post/Reel GraphQL metadata and caption retrieval | Unauthenticated requests from cloud/datacenter IPs are aggressively rate-limited (`401 Unauthorized` / `403` / login redirect) by Instagram. Per FR-008, FR-009, and NFR-024, we **must not** bypass login walls or rotate identities. |

---

## 4. Empirical Acquisition Tests & Observed Results (Phase 0 Task 5)

### Test A — Direct Outbound HTTPS from Sandbox Process
We executed Python `urllib.request` and `yt-dlp` against `https://www.youtube.com/oembed?url=https://www.youtube.com/shorts/dQw4w9WgXcQ&format=json`:
- **Result:** `URLError: <urlopen error TLS/SSL connection has been closed (EOF) (_ssl.c:992)>`
- **Root Cause:** The E2B sandbox environment enforces a strict outbound TLS host allowlist (`github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`). Direct socket connections from inside the sandbox process to `www.youtube.com` or `www.instagram.com` are terminated at the TLS proxy layer.
- **Required Product Behavior (FR-007, FR-050, Section 6.8.B):** When the worker attempts live network acquisition in an environment where `www.youtube.com` is blocked or unreachable, it **must not** return fake metadata or a fake transcript. Instead, it transitions the job to `failed` at stage `acquiring` with typed error code `SOURCE_UNAVAILABLE` and offers the user truthful recovery actions: **Retry acquisition** or **Paste the transcript instead** (keeping the canonicalized `source` record linked).

### Test B — Authorized Public YouTube Shorts Retrieval (Verified Payloads)
We tested public YouTube Shorts resolution against four real public educational Shorts:
1. `https://www.youtube.com/shorts/SWx0YfIjjx8` → Canonical ID `SWx0YfIjjx8`, Title: `"Git Setup from Scratch | Git Tutorial | Git Series #20"`, Author: `"KodeKloud"` (`https://www.youtube.com/@KodeKloud`)
2. `https://www.youtube.com/shorts/ZldNCx4AvEM` → Canonical ID `ZldNCx4AvEM`, Title: `"Learn the basics of Git in 60 seconds with Beau Carnes"`, Author: `"freeCodeCamp.org"` (`https://www.youtube.com/@freecodecamp`)
3. `https://www.youtube.com/shorts/oHaj0Vsfti4` → Canonical ID `oHaj0Vsfti4`, Title: `"Python 3 | Git Diffs.. In Python?! #python3 #coding #programming"`, Author: `"James Clare"` (`https://www.youtube.com/@pythonwithjames`)
4. `https://www.youtube.com/shorts/nlfMjOl6YB4` → Canonical ID `nlfMjOl6YB4`, Title: `"Create Python Classes and objects in 60 seconds! 🐍🚀"`, Author: `"__beginnerscode__"` (`https://www.youtube.com/@__beginnerscode__3584`)

These verified real videos are recorded in our offline evaluation set (`tests/eval-dataset/`, strictly isolated from production user data per Phase 3 Task 6 and Section 13.2).

---

## 5. Selected Acquisition Architecture (Phase 0 Task 6)

We implement a clean, provider-adaptable acquisition pipeline (`src/server/acquisition/`) with explicit contracts (`FR-004`, `FR-015`):

1. **`SourceResolver` (`YouTubeShortsAdapter` + `InstagramReelAdapter`):**
   - Validates URL scheme (`https:` / `http:`), blocks loopback/private/link-local/metadata IPs and unsafe redirects (`NFR-021` SSRF protection), normalizes tracking parameters (`si`, `feature`, `utm_*`, `cbrd`, `igshid`), and extracts `(platform, platform_content_id, canonical_url)`.
   - **YouTube Shorts Adapter (`youtube`):** Enabled by default. Uses configurable `YOUTUBE_ACQUISITION_BASE_URL` / official YouTube oEmbed + InnerTube caption track parser + optional `yt-dlp` subprocess when reachable.
   - **Instagram Reel Adapter (`instagram`):** Implemented behind the same `PlatformAcquisitionAdapter` interface so adding/enabling it requires zero schema or flow changes (`FR-010`), but **disabled by default** (`INSTAGRAM_CONNECTOR_ENABLED=false`). The Capture UI truthfully states that Instagram Reels require pasting a transcript while link-based Instagram retrieval is disabled (`Section 6.8.A`).
2. **`TranscriptProvider` & `TranscriptionProvider`:**
   - Distinguishes `caption` (platform-provided timed captions), `transcript` (speech-to-text via configured OpenAI-compatible Whisper `/v1/audio/transcriptions`), and `user_provided` (transcript pasted by the user with optional `MM:SS` timestamps parsed into `start_ms`/`end_ms` intervals).
3. **`VisualEvidenceProvider`:**
   - Only runs when visual frame analysis is actually executed and configured (`VISION_LLM_MODEL`); otherwise explicitly records `"Visual frames: not analyzed"` (`FR-014`, `Section 6.8.C`).

---

## 6. Dependencies & Settings Requiring Human Configuration (Phase 0 Task 7)

No credentials are fabricated or hardcoded. The following environment variables control external integrations:

| Variable | Required For | Default / Behavior When Unset |
|---|---|---|
| `DATABASE_URL` | External PostgreSQL server (`postgresql://...`) | Falls back to embedded real PostgreSQL (`@electric-sql/pglite`) persisted at `PGLITE_DATA_DIR` (`./data/pgdata`) |
| `PGLITE_DATA_DIR` | Local embedded PostgreSQL storage path | `./data/pgdata` (or `memory://` in isolated tests) |
| `LLM_BASE_URL` | OpenAI-compatible chat completions endpoint (e.g. `https://api.openai.com/v1`) | Unset. When unset, the `analyzing` stage fails honestly with `LLM_PROVIDER_FAILURE` (`LLM_NOT_CONFIGURED`) and never fabricates AI output |
| `LLM_API_KEY` | Bearer API key for the configured LLM provider | Unset. Server-side only; never exposed to client bundles (`NFR-020`) |
| `LLM_MODEL` | Model identifier for structured extraction | Defaults to `gpt-4o-mini` when `LLM_BASE_URL` / `LLM_API_KEY` are provided |
| `YOUTUBE_API_KEY` | Optional official YouTube Data API v3 enrichment | Optional; adapter uses public oEmbed + InnerTube caption tracks when unset |
| `TRANSCRIPTION_API_KEY` | Optional audio-to-text Whisper endpoint key | Optional; falls back to `LLM_API_KEY` if `TRANSCRIPTION_BASE_URL` is configured |
| `INSTAGRAM_CONNECTOR_ENABLED` | Enabling live Instagram Reel link fetching | `false` (disabled by default until verified under platform access rules) |
| `SESSION_SECRET` | Signing passwordless session tokens | Ephemeral per-boot random 256-bit secret generated via `crypto.randomBytes(32)` if unset in dev |

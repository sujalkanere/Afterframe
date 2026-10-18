# AFTERFRAME — Software Requirements Specification (SRS)

**Document status:** Product and engineering specification  
**Version:** 1.1 (UI/UX specification revised)  
**Date:** 18 October 2026  
**Working product name:** Afterframe (renameable)  
**Audience:** AI coding agent, product designer, frontend/backend engineers, QA  
**Document structure:** Final-product SRS first; phased implementation plan at the end

---

## 1. Product vision

Afterframe turns short-form video content into things a person can actually use.

A user pastes a YouTube Short or Instagram Reel link. Afterframe attempts to retrieve the accessible source material, understands the transcript and relevant visual information, extracts the useful substance, recommends an appropriate destination, and lets the user approve and save it as a structured artifact.

The product should feel less like a generic productivity dashboard and more like entering a beautifully designed, spatial knowledge instrument: cinematic, quiet, tactile, responsive, and unusually intentional. Its visual spectacle must serve comprehension and navigation rather than distract from them.

Its technical quality matters just as much as its appearance. Data structures, algorithms, data provenance, processing reliability, and query performance must be visible in the quality of the experience—not decorative claims in the README.

### 1.1 Product promise

> Send a video. Keep what matters. Turn it into something useful.

### 1.2 Core product principles

1. **Real content only.** Displayed source data and extracted content must originate from a real provider response, actual media evidence, or an explicit user edit. Never substitute fabricated data.
2. **Evidence before inference.** Preserve what the source actually said or showed and distinguish it from model interpretation.
3. **User-confirmed artifacts.** AI recommends; the user reviews and confirms what gets saved.
4. **A canonical data model.** The application stores structured artifacts, not only blobs of generated Markdown.
5. **Original design informed by research.** Analyze the strongest product experiences, but create a distinct visual language and do not copy proprietary code, assets, or protected expression.
6. **Mobile-first clarity with spatial beauty.** Capture and review work first on a phone. The spatial library is a 2D-first, optionally 3D view that makes organization understandable without slowing ordinary tasks or excluding users.
7. **Measured engineering.** Performance, retrieval quality, extraction quality, and accessibility are tested against defined acceptance criteria.
8. **Failure honesty.** If a source cannot be retrieved or a model fails, show the actual state and reason where known. Never fake success.

---

## 2. Scope and release boundaries

This document describes the intended final product and defines the first demo release separately. Do not try to deliver every final-product capability in the first iteration.

### 2.1 Final-product scope

The product is a personal execution and knowledge system centered on turning short videos into useful artifacts:

- Accept supported YouTube Shorts and Instagram Reel URLs.
- Retrieve available metadata, transcript/audio evidence, and relevant visual evidence using a replaceable acquisition layer.
- Analyze source evidence with a configured LLM and validated structured output.
- Recommend an artifact destination and let the user choose or correct it.
- Save and organize tasks, multi-step plans/roadmaps, habits/routines, tips/references, and AI skills.
- Relate saved artifacts back to their source evidence.
- Search, filter, browse, and explore the user's library.
- Generate tool-specific skill packages using target-specific renderers.
- Offer a visually distinctive 3D/spatial library view alongside efficient conventional list/search views.
- Maintain versioning, retryability, provenance, deletion, and privacy boundaries.

### 2.2 Demo MVP scope

The MVP must prove the core pipeline with **real YouTube Shorts first**:

1. Submit a real Shorts URL.
2. Retrieve real accessible source evidence.
3. Transcribe or use accessible transcript/caption material as permitted and available.
4. Analyze visual frames when the transcript is insufficient.
5. Call a real LLM endpoint.
6. produce a strict structured Task or AI Skill candidate.
7. Validate it and expose source evidence.
8. Let the user edit and confirm the candidate.
9. Persist it in the database and show it in the library.
10. Export a validated skill in one target format, if skill export is included in the current build phase.

During discovery, the build agent must also investigate **free or open-source, URL-based retrieval methods for both YouTube and Instagram**, without assuming a specific vendor or preselected integration. YouTube Shorts is the first end-to-end acceptance path. An Instagram connector may remain disabled until its acquisition method is verified to work reliably and within applicable platform rules. The architecture must not require a rewrite to add the second platform.

The implementation prompt must not prescribe a particular paid provider or a predetermined API-key strategy as the solution. The agent must research, inspect actual repositories, test feasible methods, and document what works. It must not bypass authentication, access controls, rate limits, or other platform protections. “Free” means no required per-video paid extraction service for the chosen MVP path; it does not mean unrestricted access to all content or a guarantee that every URL is fetchable.

### 2.3 Explicitly out of scope for the MVP

- Telegram bot, browser extension, or automatic saved-items synchronization.
- Autonomous execution of generated skills.
- Complex project-management features, team collaboration, social feeds, gamification, or calendar automation.
- A bespoke ML classifier trained from scratch.
- Distributed microservices, Kafka, a graph database, or a vector database without measured need.
- Support for every AI platform from day one.
- Downloading or permanently storing original video files unless necessary, authorized, and explicitly justified.
- Any demo data that resembles real user content.

---

## 3. Target users and key use cases

### 3.1 Primary user

A person who encounters useful short-form content and wants to convert it into an actionable task, a reusable AI instruction, or an item worth remembering—without manually rewriting the video.

### 3.2 Core use cases

**UC-01 — Convert a video into a task**  
The user submits a supported URL. Afterframe returns a title, practical description, ordered subtasks where warranted, topical categories, and evidence references. The user edits and saves it.

**UC-02 — Convert a video into an AI skill**  
The user submits a tutorial or workflow video. Afterframe creates a canonical tool-independent skill specification, validates it, and offers a tool-specific export after user review.

**UC-03 — Keep useful information without turning it into a task**  
In the final product, the user can save a tip/reference when the source contains helpful information but no meaningful action plan.

**UC-04 — Organize long-term efforts**  
In the final product, the user can collect related tasks into a multi-step plan or roadmap. Examples include a learning roadmap or a multi-week fitness program. “Short-term” is not a topical category.

**UC-05 — Maintain recurring practices**  
In the final product, the user can define habits/routines such as daily coding practice or workouts. Recurrence is a behavior of the artifact, while topics such as `coding` and `health` remain independent categories.

**UC-06 — Find and revisit an artifact**  
The user searches by title, contents, topic, source, or artifact type and can navigate from an artifact to the source and extraction evidence.

**UC-07 — Explore the library spatially**  
The user opens an interactive visual library to discover connections between sources, artifacts, categories, and plans. A conventional list remains available for fast, predictable navigation.

**UC-08 — Recover from a failed extraction**  
The user sees a truthful failure reason and can retry a safe failed stage without creating duplicate artifacts or losing earlier successful evidence.

---

## 4. Functional requirements

Priority definitions: **P0** = required for the MVP; **P1** = final-product foundation / next increment; **P2** = optional later enhancement.

### 4.1 Link intake and source resolution

- **FR-001 (P0):** The app shall accept a video URL through a clear paste-and-submit interaction.
- **FR-002 (P0):** The backend shall validate scheme, hostname, platform, supported URL pattern, and normalized content identifier before acquisition.
- **FR-003 (P0):** The system shall identify whether a URL refers to an expected video type, including YouTube Shorts, and reject unsupported inputs clearly.
- **FR-004 (P0):** The acquisition layer shall be provider-adaptable. Platform-specific retrieval logic shall not be embedded in the UI or extraction prompt.
- **FR-005 (P0):** The system shall use actual fetched metadata and actual evidence only. Missing fields must remain missing, not be guessed.
- **FR-006 (P0):** The system shall preserve the original submitted URL alongside a canonical URL and provider/platform identifier where available.
- **FR-007 (P0):** A failed source resolution shall yield a visible, typed failure state and no fake extraction result.
- **FR-008 (P0):** Before selecting an acquisition approach, the implementation agent shall inspect and test available free/open-source URL-based tools for both YouTube and Instagram, documenting supported content, requirements, limitations, licensing, maintenance, and deployment compatibility.
- **FR-009 (P0):** The system shall not bypass authentication or content-access restrictions, rotate identities to evade rate limits, or represent an unsupported/private URL as successfully retrieved.
- **FR-010 (P1):** Add new platform adapters without changes to artifact schemas or the core application flow.

### 4.2 Evidence acquisition and preparation

- **FR-011 (P0):** The system shall distinguish metadata, transcript/captions, speech-to-text transcript, visual observations, and derived interpretations.
- **FR-012 (P0):** Transcript segments shall preserve timestamps when provided or produced by the transcription method.
- **FR-013 (P0):** Visual observations shall retain frame timestamps and acquisition provenance.
- **FR-014 (P0):** The system shall not claim visual analysis if no frames were analyzed.
- **FR-015 (P0):** Evidence acquisition shall be modular: source resolver, transcript provider, transcription provider, and visual-evidence provider must have explicit input/output contracts.
- **FR-016 (P0):** The pipeline should use transcript-first processing when sufficient and add visual analysis when useful information appears in on-screen text, code, diagrams, demonstrations, or nonverbal content.
- **FR-017 (P0):** Temporary media files shall be bounded by size/duration limits and deleted after processing according to the configured retention policy.
- **FR-018 (P1):** The system shall support reprocessing from retained evidence using a newer extraction pipeline without silently overwriting a user's confirmed artifact.

### 4.3 Content interpretation and artifact recommendation

- **FR-019 (P0):** A real configured LLM endpoint shall interpret the fetched evidence; generated sample content is prohibited.
- **FR-020 (P0):** The model shall return schema-constrained JSON for a candidate artifact rather than writing directly to the database.
- **FR-021 (P0):** For the MVP, the canonical destination choices shall be `task` or `ai_skill`. A future extension may add `plan`, `habit`, or `tip_reference` without changing the ingestion model.
- **FR-022 (P0):** The model shall recommend a destination and provide a short reason grounded in the source; the user can override the recommendation.
- **FR-023 (P0):** The extractor shall preserve important steps, order, conditions, and caveats when they occur in the evidence.
- **FR-024 (P0):** Claims derived from source content shall carry evidence references when feasible. Inferences must be labelled as inferences rather than attributed directly to the creator.
- **FR-025 (P0):** The model shall not invent a deadline, priority, estimated duration, tool capability, demonstrated result, or external fact. Unsupported optional fields remain null/unset.
- **FR-026 (P0):** Failed schema or semantic validation shall not produce a completed candidate. Permit a bounded repair attempt, then show a truthful failure.
- **FR-027 (P1):** A second-pass critique may be triggered by uncertainty, missing evidence coverage, or observed quality failure; it shall not be required for every request by default.

### 4.4 Tasks

- **FR-028 (P0):** A task shall support title, description, ordered subtasks, optional user-supplied deadline, completion status, topic categories, source links, and timestamps.
- **FR-029 (P0):** Subtasks shall have stable IDs and an explicit position field; UI order shall not depend on database row order.
- **FR-030 (P0):** The user shall be able to edit the candidate before saving it.
- **FR-031 (P1):** Tasks may later be grouped into plans/roadmaps, with dependencies represented explicitly only where users need them.
- **FR-032 (P1):** Plan tasks and daily tasks should remain the same core task entity with a relationship/context, not duplicative separate models.

### 4.5 AI skills

- **FR-033 (P0):** The system shall create a canonical, tool-independent `SkillSpec` object before rendering a tool-specific file.
- **FR-034 (P0):** `SkillSpec` shall include identity, intended use, trigger/non-trigger conditions, input contract, ordered workflow, output contract, evidence links, capability requirements, safety findings, schema version, and provenance.
- **FR-035 (P0):** The first version shall support instruction-only skills. Generating a skill shall not execute commands or grant capabilities.
- **FR-036 (P0):** Every skill export shall be derived from a validated canonical version and record its target and renderer version.
- **FR-037 (P0):** The UI shall never claim a skill was tested inside a target tool unless a corresponding real test occurred.
- **FR-038 (P0):** The UI shall allow review/edit before save or export.
- **FR-039 (P1):** Add tool-specific renderers incrementally after official format constraints have been verified and tests exist.

### 4.6 Library, topics, and navigation

- **FR-040 (P0):** A user's saved library shall display only real persisted artifacts owned by that user.
- **FR-041 (P0):** Empty states shall be genuine empty states, not pre-populated sample lists.
- **FR-042 (P0):** The library shall support keyword search and filters for artifact type and topic.
- **FR-043 (P0):** Topics shall be independent of artifact type. Examples of topics include coding and health; `task` and `ai_skill` are types, not topics.
- **FR-044 (P0):** An artifact detail view shall link to its source and extraction provenance.
- **FR-045 (P1):** Add plans/roadmaps, habits/routines, and tips/references as distinct canonical artifact types with their own validation rules.
- **FR-046 (P1):** A source may support multiple saved artifacts, and an artifact may relate to multiple sources.
- **FR-047 (P1):** Provide an interactive graph view (2D by default, optional lazy-loaded 3D) of source, artifact, plan, and topic relationships, capped at 300 rendered nodes with clustering beyond that, with a conventional list as an always-available alternative.

### 4.7 Processing status, retries, and history

- **FR-048 (P0):** The backend shall create a durable processing job before long-running acquisition and LLM work begins.
- **FR-049 (P0):** Supported states shall include equivalents of `queued`, `acquiring`, `transcribing`, `analyzing`, `needs_review`, `completed`, `failed`, and `cancelled`.
- **FR-050 (P0):** UI status must reflect actual backend state. No made-up percentage bars.
- **FR-051 (P0):** Retry operations shall be bounded, idempotent where appropriate, and stage-aware.
- **FR-052 (P0):** Each run shall record pipeline/schema version, provider/model identity where available, duration, status, and a safe error code.
- **FR-053 (P0):** A retry shall not duplicate a confirmed artifact unless the user explicitly requests a separate copy.
- **FR-054 (P1):** Preserve artifact versions when the user edits a saved AI skill or when new extraction output is accepted.

### 4.8 Deletion and user control

- **FR-055 (P0):** Users shall be able to delete their saved artifacts.
- **FR-056 (P0):** The system shall document what source evidence is retained and for how long.
- **FR-057 (P0):** Where a user deletes a source or artifact, related retained evidence shall follow a consistent deletion policy without deleting unrelated artifacts.
- **FR-058 (P1):** Provide export of the user's saved structured data in a documented format.

### 4.9 Capture, access and front-end behavior

- **FR-059 (P0):** The capture screen shall offer a paste-a-transcript path that does not require a failed link attempt first.
- **FR-060 (P0):** The product shall be an installable PWA; on supporting platforms it shall register a Web Share Target so a shared video link opens Afterframe with the link prefilled.
- **FR-061 (P0):** When the link field is focused and the clipboard contains a supported link, the UI shall offer to paste it, handling denied clipboard permission gracefully.
- **FR-062 (P0):** In-progress review edits shall be preserved locally across refresh and interruption, clearly distinct from saving the artifact.
- **FR-063 (P0):** Deleting an artifact shall offer a 10-second undo before the deletion policy executes.
- **FR-064 (P0):** The product shall provide passwordless sign-in and a settings screen offering theme, reduced motion, content language, timezone, data export and account deletion.
- **FR-065 (P1):** A command palette (Ctrl/Cmd+K) shall provide search, navigation and common actions.

---

## 5. Non-functional requirements

### 5.1 Correctness and trust

- **NFR-001:** No fabricated user-visible extraction content, fake provider status, or fake completion state.
- **NFR-002:** Every confirmed artifact shall have traceable provenance to at least one source or be clearly labelled as user-created.
- **NFR-003:** LLM output is untrusted input and must pass server-side structural, semantic, and safety validation.
- **NFR-004:** Logs and error messages must not leak credentials, cookies, secret environment values, or private source payloads unnecessarily.

### 5.2 Performance

Performance targets are initial engineering targets and must be measured on the deployed environment. Do not advertise them as achieved until load tests confirm them.

- **NFR-005:** Ordinary library queries should target p95 under 300 ms for a representative MVP-sized dataset, excluding network transfer and cold starts.
- **NFR-006:** URL submission should return a durable job identifier promptly rather than keeping the browser request open for the entire extraction pipeline.
- **NFR-007:** UI interactions unrelated to 3D rendering must remain responsive while the spatial scene is active.
- **NFR-008:** The app shall use pagination, bounded result sizes, and indexed queries instead of loading the entire library into the browser.
- **NFR-009:** Processing timeout, media size, duration, queue concurrency, retry count, and LLM token usage shall have configurable limits.

### 5.3 Scalability and maintainability

- **NFR-010:** Core domain logic must be separated from UI components and platform-specific providers.
- **NFR-011:** Data schemas and artifact versions must be explicitly versioned.
- **NFR-012:** Use modular monolith architecture first. Split services only when a measured scaling or ownership requirement justifies it.
- **NFR-013:** Important database invariants must be enforced by constraints/transactions as well as UI validation.
- **NFR-014:** API contracts, environment variables, migrations, and operational setup must be documented.

### 5.4 Accessibility and inclusiveness

- **NFR-015:** The product shall support keyboard navigation, visible focus, semantic structure, accessible names, and screen-reader-usable status messages.
- **NFR-016:** The interface shall respect `prefers-reduced-motion` and expose a reduced-motion mode.
- **NFR-017:** No critical action or information may depend exclusively on depth, color, parallax, 3D position, or hover.
- **NFR-018:** If WebGL fails or reduced motion is enabled, provide a high-quality 2D/list fallback with full functionality.
- **NFR-019:** Maintain usable layouts from 320 px to large desktop widths, designed mobile first.
- **NFR-019a:** Meet WCAG 2.2 AA, including contrast thresholds and 44 px touch targets for primary controls, as detailed in Section 6.10.
- **NFR-019b:** Meet the front-end performance budgets in Section 6.11, measured and reported.

### 5.5 Security and privacy

- **NFR-020:** Use server-side credentials only. Never bundle API keys or session cookies into frontend assets.
- **NFR-021:** Validate all submitted URLs and each redirect; block loopback, private, link-local, and internal network destinations to prevent SSRF.
- **NFR-022:** Enforce authentication and server-side ownership checks for all user-owned data.
- **NFR-023:** Treat external media, captions, visual text, metadata, and model output as untrusted data and potential prompt injection.
- **NFR-024:** Do not circumvent sign-in walls, access controls, rate limits, or technical restrictions to retrieve content.
- **NFR-025:** Temporary files and provider responses must follow documented retention and deletion rules.
- **NFR-026:** Generate export archives safely; reject path traversal, unexpected executables, and unsafe filenames.

---

## 6. Experience and visual design specification

### 6.1 Audience and design context

- **Scale:** 100–500 daily active users, peak concurrency roughly 20–60 sessions. The UI is optimized for clarity and speed, not for massive-scale personalization.
- **Where users arrive from:** most people encounter Shorts and Reels on a phone and switch to Afterframe to capture them. **Mobile is the primary context; desktop is the review-and-organize context.** Design mobile first, then expand.
- **Session shape:** short capture sessions (under 60 seconds of user effort) and occasional longer review/library sessions.
- **Language:** the audience will include Hindi, English and code-mixed content. All UI must support Unicode, avoid fixed-width text assumptions, and allow longer strings in translation.
- **Time to first value:** a new user must be able to reach a real saved artifact in under 3 minutes without reading documentation.

### 6.2 Experience principles

Each principle is a design rule with a reason. Where a psychology effect is cited, the design applies it to help the user finish their goal, never to manipulate.

1. **One obvious next action per screen (Hick’s law).** Every screen has a single primary action. Secondary actions are visually quieter. No screen offers more than one primary button.
2. **Instant acknowledgement (responsiveness threshold of about 400 ms).** Any user action receives visible feedback within 100 ms and a meaningful state change within 400 ms. Submitting a URL immediately shows the processing screen; the user never stares at a frozen form.
3. **Honest progress builds trust.** Progress is communicated through real pipeline stage labels and events (FR-050). No fake percentage bars, no timers pretending to be progress. Reassurance comes from naming what the system is doing and what it found.
4. **Finish what was started (Zeigarnik effect, used honestly).** Drafts awaiting review are shown on the Capture screen as “Ready for review” with the real count. This is a reminder of real unfinished work, not a manufactured prompt. Unconfirmed candidates expire after a documented period and the UI says so.
5. **A meaningful ending (peak–end rule).** Saving an artifact is the product’s reward moment. It receives a distinct, brief, tasteful confirmation (see 6.4) and immediately shows where the artifact now lives and how to find it. Failures also get a considered ending: what happened, what was saved or not, and the next valid action.
6. **Recognition over recall.** Provenance chips, type labels, legends and breadcrumbs make meaning visible. The user never has to remember what a color or shape stood for.
7. **User control and reversibility.** Nothing is saved without an explicit action (FR-030). Discard, edit, undo-after-delete (for 10 seconds), and export are always available.
8. **Quiet by default, spectacle by exception.** The visual signature appears at a few high-value moments. Text, forms and tables use conventional, highly legible layouts.
9. **Beautiful and usable under every condition** (empty, one item, many, failed, slow, offline, WebGL unavailable, reduced motion, small phone).

**Prohibited engagement patterns.** No fabricated statistics, streak counters, confetti for its own sake, variable-reward mechanics, fake scarcity or urgency, guilt-based copy, notification nagging, or dark patterns that make deletion/export hard. Any engagement mechanic must be based on real data and must help the user complete their own goal.

### 6.3 Visual language and design tokens

**Concept: “the frame.”** Afterframe is about taking a moment from a video and keeping what matters. The visual identity is a film-frame and viewfinder motif: corner brackets around the capture area, a calm dark “projection room” environment, and warm light used to mark the one thing that matters on a screen. This is an original motif, not an imitation of any existing product.

**Design tokens are required.** All values below are defined once as tokens (CSS variables) and consumed by components. No one-off hex values or pixel sizes in component code.

**Color (dark theme is the default; a complete light theme is required).**

| Role | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#15181C` | `#EEF0F2` | App background |
| `--surface-1` | `#1C2025` | `#FFFFFF` | Panels, inputs |
| `--surface-2` | `#252A31` | `#E3E7EB` | Raised/selected surfaces |
| `--line` | `#363D46` | `#C8CDD4` | Borders, dividers |
| `--text` | `#ECEAE4` | `#1A1D21` | Primary text |
| `--text-muted` | `#9BA4AE` | `#56606B` | Secondary text |
| `--accent` (projector amber) | `#F0B35A` | `#8F5400` (text) / `#F0B35A` (fills) | Primary action, the “kept” moment, inferred markers |
| `--evidence-transcript` (cyan) | `#7CC4D2` | `#0B6171` | Transcript evidence, success/completed states |
| `--evidence-visual` (violet) | `#B9A6E8` | `#5A3EB0` | Visual-frame observations |
| `--danger` | `#EF8A7A` | `#B3321F` | Errors, destructive actions |
| `--focus` | `#8FD0FF` | `#0B5CC4` | Focus ring |

Rules: body text contrast at least 4.5:1, large text and UI boundaries at least 3:1, in both themes. Follow `prefers-color-scheme` by default and allow an explicit user override that is persisted. No gradients as decoration; the only ambient effect is one soft warm light near the top of the viewport.

**Typography.**
- **Display (sparingly):** Instrument Serif (SIL OFL) for the product name, page titles and key moments only.
- **Interface and body:** Schibsted Grotesk (SIL OFL) for all other text. Provide a system-font fallback stack and `font-display: swap`.
- **Scale (rem):** 0.8125, 0.875, 1, 1.125, 1.5, 1.75, 2.25–3.75 (fluid for page titles). Body 16 px minimum. Line height 1.5–1.6 for body, 1.05–1.15 for display. Line length under 75 characters.
- Sentence case for all labels. No all-caps tracking labels.

**Spacing, shape and depth.**
- 4 px spacing base; scale 4, 8, 12, 16, 20, 24, 32, 48.
- Radii: 6 px (frame/brackets, sharp by design), 8 px (controls), 12 px (panels). Different radii express hierarchy; not everything is one rounded card.
- Depth is expressed with surface color and 1 px borders, not heavy shadows. Maximum one elevated layer at a time (sheet, menu or toast).
- Touch targets at least 44 × 44 px for primary controls on touch devices.

**Iconography.** One line-icon set (Lucide, ISC) at consistent 1.5 px stroke and 20 px size. No emoji as UI icons.

**Provenance chip system (core component).** Evidence kinds must be distinguishable by *label, icon and border style*, never by color alone:

| Kind | Label | Border | Meaning |
|---|---|---|---|
| Transcript | “Transcript 0:14” | Solid, cyan | Taken from spoken/caption text with timestamp |
| Visual | “Frame 0:22” | Solid, violet | From an analyzed frame |
| Inferred | “Inferred” | Dashed, amber | Model inference, not stated in the source |
| Edited | “Edited by you” | Double, neutral | User changed or added this |

Selecting a chip highlights the corresponding evidence segment and scrolls it into view.

### 6.4 Signature moments

The product spends its visual boldness in three places and keeps everything else quiet.

1. **The frame lock (capture).** On first load of the Capture screen, four amber corner brackets contract once around the URL field and settle. This plays once per session, takes under 900 ms, and is skipped under reduced motion.
2. **The kept moment (save).** When the user saves, the brackets reappear around the saved item’s title for about 500 ms, a status message (“Kept. Saved to your Library.”) is announced to assistive technology, and the next step (view in Library) is offered. No confetti, sound, or counters.
3. **The Atlas (library).** See 6.5.

### 6.5 The Afterframe Atlas (spatial library)

The Atlas is a view of the user’s real library relationships among sources, artifacts and topics. It must never contain decorative or invented nodes or links.

**Requirements**

1. Nodes have stable identities and types; layout is deterministic (seeded from node IDs) so small data changes do not rearrange the scene.
2. **Default rendering is 2D** (canvas/WebGL via Sigma.js and graphology, or SVG for small graphs). A 3D mode (react-three-fiber with d3-force-3d) is an optional enhancement, lazy-loaded, and must not be required for any task.
3. Hard cap of 300 rendered nodes; beyond that, cluster by topic and allow expanding a cluster. Server returns a bounded subgraph (maximum 2 hops from a focus node).
4. Selecting a node opens a detail panel with real fields and provenance. Clicking a source reveals its artifacts; clicking an artifact reveals its evidence.
5. Filters (type, topic, date range, platform) and search-to-focus operate on real data through backend queries.
6. **Encoding with a visible legend:** square = source, circle = task, diamond = AI skill, ring = topic. Shape and label carry meaning; color is secondary.
7. Every node is reachable and operable by keyboard (arrow keys move between connected nodes, Enter opens details, Escape returns to the list). A screen-reader-friendly list is always available as an equivalent.
8. The Atlas is never the only way to reach content. The list view is the default on mobile and when reduced motion or low performance is detected.
9. Frame rate target: 50 fps or higher for up to 300 nodes on a mid-range laptop and a recent mid-range phone, measured and reported. If measured performance drops, reduce effects first, then node count.

### 6.6 Motion principles

- Motion explains change (an item appearing, a panel opening, a state completing); it never decorates idle screens.
- Durations: 100–150 ms for control feedback, 200–300 ms for panels and transitions, 500–900 ms only for the two signature moments. Use ease-out curves; avoid springy overshoot on text.
- No autoplay loops, persistent camera drift, parallax tied to pointer movement, or background animation behind text.
- `prefers-reduced-motion` and an in-app “Reduce motion” setting disable all non-essential animation; state changes become instant while remaining perceivable (for example, a color or label change).
- Lazy-load all 3D and graph code with dynamic imports; do not load it on Capture or Review.

### 6.7 Information architecture and navigation

- **Primary destinations:** Capture and Library. Settings and account sit behind a profile menu.
- **Mobile:** fixed bottom navigation with two destinations, safe-area aware. The processing and review screens hide the bottom bar when it would obscure the sticky action bar.
- **Desktop/tablet:** a slim top bar with the same destinations, and a **command palette** (Ctrl/Cmd+K) for search, navigation and common actions (P1).
- **Deep links:** every job, candidate, artifact and source has a stable URL; the browser back button always works as expected.
- **Installable PWA (P0):** web manifest, offline shell, and on Android a **Web Share Target** so a user can share a Short or Reel directly into Afterframe. Where share targets are not supported (for example iOS), detect a valid link on the clipboard when the input receives focus and offer to paste it, and document a Shortcut-based alternative.

### 6.8 Screen requirements

**A. Capture / home**
- Heading and one primary field for the video link with a single primary button (“Extract”). Enter submits. Large touch targets.
- On focus, if the clipboard contains a supported link, offer it (user-initiated; permission handled gracefully and never required).
- A truthful capability line: which platforms work from a link, and which require a pasted transcript or an uploaded clip. Do not mark a platform as supported if its connector is disabled.
- A visible secondary path: “Paste the transcript instead” (and, when implemented, “Upload a clip”). This path must be reachable without first failing.
- Inline validation with specific messages (for example, “That doesn’t look like a YouTube Short or Instagram Reel link. Check it and try again.”). No toast-only errors.
- “Ready for review” section listing real unconfirmed candidates; “Recently kept” listing the latest real artifacts. Both appear only when data exists.
- Genuine empty state: a short explanation and the action to take. No sample items.

**B. Processing**
- Show the source URL and an ordered list of real stages (queued, acquiring, transcribing, analyzing, ready for review) with one current stage, completed stages marked, and a live-region announcement of each change.
- Provide Cancel at all times. Provide Retry only for failed stages where retry is valid, labeled with the stage (“Retry transcription”).
- Failure state: states what failed, what was and was not saved, and the valid next actions (retry the stage, paste a transcript, upload a clip, cancel). Never display a generic “Something went wrong.”
- Slow processing: after a configurable threshold, show that the job is still running and that the user may leave; a notification or the “Ready for review” list brings them back. Do not block navigation.
- No placeholder result cards or fake transcripts while waiting.

**C. Review and edit (the central screen)**
- **Desktop:** two columns. Left: editable draft (Task / AI skill switch, title, description, steps, topics). Right: evidence pane (timestamped transcript, frame observations, limitations). **Mobile:** single column with the evidence shown in a bottom sheet opened from each step’s provenance chip.
- A type switch with a one-sentence, source-grounded reason for the recommendation.
- Each step shows its provenance chips (6.3). Selecting a step highlights the supporting evidence; selecting evidence highlights the steps that cite it.
- Inline validation and warnings next to the affected field (for example “No spoken evidence for this detail. Kept as inference.”). Blocking errors disable Save with an explanation; warnings do not.
- A short note stating which evidence kinds were and were not analyzed (for example “Visual frames: not analyzed. The transcript was sufficient.”).
- A sticky action bar with Discard (secondary) and **Save task / Save AI skill** (primary). Saving is an explicit action; it triggers the kept moment (6.4).
- Autosave of the in-progress *draft edits* locally so a refresh or interruption does not lose work; this is clearly distinct from saving the artifact.

**D. Library**
- Search field, type filter, topic filter, sort, and a List / Atlas switch. Search and filters call real backend queries with keyset pagination and virtualized lists for large results.
- List rows show type (label and icon), title, topics, source platform and date, and open the artifact detail. Long titles truncate predictably with full text available on detail.
- No library statistics, charts or counters unless derived from real data and useful to a task.
- Genuine empty state and a “no matches” state with a clear way to reset filters.

**E. Artifact detail**
- Editable fields, topics, version history where relevant, original source link and extraction evidence in a compact provenance section.
- Delete with a 10-second undo, then follow the documented evidence-retention policy; copy/export only when implemented.

**F. Skill export**
- Preview generated files before download; list validation findings; show only actually implemented targets, and distinguish *valid*, *compatible* and *tested*.

**G. Sign-in and first run (new, P0)**
- Passwordless sign-in (email link and one OAuth provider). Optionally allow a limited guest trial of one or two extractions with a prompt to create an account to keep results.
- First run lands on Capture with the empty state. No multi-screen onboarding carousel.

**H. Settings and data control (new, P0)**
- Theme (system/dark/light), reduce motion, language of generated content, timezone, export all my data, delete my account and data, and a plain-language statement of what evidence is retained and for how long.

### 6.9 Content and microcopy rules

- Write from the user’s point of view in plain language; name things by what they do. Use “Extract,” “Save task,” “Retry transcription,” “Discard.”
- A button names the action it performs, and the confirmation uses the same word (“Save task” leads to “Saved”).
- Errors state what happened and what to do, without apology or blame, and never expose stack traces, credentials or raw provider output.
- Empty states explain how to fill them with a single action.
- Avoid claiming capabilities that are not implemented (for example, “works with every platform”).

### 6.10 Accessibility requirements (WCAG 2.2 AA target)

- Full keyboard operability and a logical focus order; visible 2 px focus ring in both themes; focus is moved to the main region on route change.
- Semantic landmarks, headings, labelled form controls, and `aria-live` regions for processing status and save confirmation.
- Color is never the sole carrier of meaning (provenance chips, graph legend, error states).
- Sufficient target size (44 px for primary touch controls), reflow at 320 px width and 400% zoom, and text resizable to 200% without loss.
- Atlas and any canvas content have an accessible equivalent (6.5, requirement 7).
- Automated checks (axe or equivalent) in CI plus a manual keyboard and screen-reader pass on Capture, Review, Library and Detail before release.

### 6.11 Performance and responsiveness budgets

Targets to be measured on a mid-range phone over a throttled network and reported (do not claim as achieved before measuring):

- Capture screen: largest contentful paint under 2.5 s; initial JavaScript under 170 KB compressed excluding fonts.
- Interaction latency (input to visible response) under 100 ms for ordinary controls.
- Graph/3D code and any model-heavy libraries load only on the Library Atlas route.
- Fonts: subset, at most two families, preloaded for the display face used on first paint.
- Images: the product has no decorative imagery; video thumbnails, if shown, come from real source metadata and are lazy-loaded with fixed aspect-ratio placeholders to avoid layout shift.

### 6.12 Recommended UI assets and libraries

Prefer permissively licensed, widely used components. Verify each license at the time of adoption.

| Need | Recommendation | License (verify) |
|---|---|---|
| Styling and tokens | Tailwind CSS with CSS variables | MIT |
| Accessible primitives | Radix UI, shadcn/ui components | MIT |
| Icons | Lucide | ISC |
| Motion | Motion (formerly Framer Motion) | MIT |
| Command palette | cmdk | MIT |
| Toasts and sheets | Sonner, Vaul | MIT |
| Fonts | Instrument Serif, Schibsted Grotesk via Fontsource | SIL OFL |
| 2D graph | graphology + Sigma.js, d3-force | MIT / ISC |
| Optional 3D | react-three-fiber, d3-force-3d | MIT |
| Virtualized lists | TanStack Virtual | MIT |
| Forms | React Hook Form with Zod resolver | MIT |

### 6.13 Design research and REA workflow

The implementation agent must inspect and use the requested repository:

`https://github.com/morluto/rea.git`

REA describes itself as a CLI/MCP system for evidence-backed reverse engineering of applications, binaries, and runtime behavior. Its published docs emphasize observations, limitations, and retained evidence rather than unsupported assumptions. See the [REA documentation](https://github.com/morluto/rea/tree/main/docs), [repository](https://github.com/morluto/rea), and [license](https://github.com/morluto/rea/blob/main/LICENSE).

Use REA when it materially helps investigate a specific design or interaction in an app or website. Do not run it indiscriminately or treat setup instructions as proof that capabilities are installed. Confirm the tools actually available to the coding agent and inspect installation changes before approval.

**Permitted research outputs:**
- documented user journeys;
- interaction state diagrams;
- component behavior descriptions;
- timing and transition observations;
- accessibility and layout observations;
- high-level architecture hypotheses with evidence and uncertainty clearly labeled;
- original implementations that solve a similar user problem.

**Prohibited practices:**
- copying proprietary source code, private APIs, protected illustrations, animations, brand assets, or exact expressive layouts;
- bypassing access controls or extracting secrets, credentials, private data, or non-public source material;
- representing guesses as verified findings;
- adding REA or other analysis tools to the production runtime when they are only needed during development.

Study a handful of high-quality references selected by the agent for specific questions such as capture flow, command surfaces, spatial navigation, timeline interactions, detail inspectors, and empty states. Produce a reference-analysis document with links, observations, evidence, limitations, and a clear “what we will adapt vs. what we will do differently” section. The tokens and principles in 6.2–6.6 are the starting design system; research may refine them but must not replace them with copied expression.

### 6.14 Design acceptance checklist

Before the UI is considered complete, verify each item at 360 px, 768 px and 1280 px widths, in both themes, with and without reduced motion:

1. Capture is understandable within five seconds and a link can be submitted with one hand on a phone.
2. Every screen has exactly one primary action.
3. Processing, failure, slow, empty, one-item, many-items and long-title states are designed and tested.
4. Provenance chips are distinguishable without color.
5. The Atlas has a legend, keyboard access, a list equivalent and a measured frame rate.
6. All text and UI contrast thresholds in 6.3 and 6.10 are met.
7. No fabricated data, metrics or fake progress appears anywhere.

---

## 7. Data architecture

### 7.1 Architectural style

Use a modular monolith for the MVP:

- **Frontend:** application screens, review editor, library/list and spatial visualization.
- **Backend API:** authentication, URL validation, job creation, artifact operations, search, and exports.
- **Worker:** source acquisition, evidence preparation, transcription, visual analysis, LLM extraction, validation, and retries.
- **PostgreSQL:** canonical records, constraints, relational queries, and JSONB for genuinely variable payloads.
- **Queue:** a durable job queue appropriate to the selected stack. Prefer the simplest reliable approach that survives worker restarts.
- **Temporary media storage:** bounded and time-limited; do not turn media storage into a permanent archive by default.

Recommended baseline for a new repository: TypeScript; a mature React framework; PostgreSQL; a typed database layer with migrations; a durable worker/queue; a schema validation library; a real LLM API; and a WebGL layer such as Three.js/React Three Fiber for spatial visualization. The agent must inspect the repository first and retain existing working choices where reasonable. Do not rewrite functioning code solely to match this recommendation.

### 7.2 Canonical entities

The database shall keep source, evidence, processing run, extraction candidate, confirmed artifact, and export distinct. Example entity set:

| Entity | Purpose | Representative fields |
|---|---|---|
| `users` | Account and preferences | `id`, `created_at`, `settings_json` |
| `sources` | Submitted content identity | `id`, `user_id`, `platform`, `submitted_url`, `canonical_url`, `platform_content_id`, `metadata_json`, `created_at` |
| `source_evidence` | Retrieved/derived evidence | `id`, `source_id`, `kind`, `content_ref`, `content_text`, `start_ms`, `end_ms`, `provenance`, `metadata_json` |
| `processing_jobs` | Durable job lifecycle | `id`, `user_id`, `source_id`, `status`, `current_stage`, `attempt_count`, `idempotency_key`, `created_at`, `updated_at` |
| `processing_runs` | Each processing attempt | `id`, `job_id`, `pipeline_version`, `provider_id`, `model_id`, `status`, `started_at`, `finished_at`, `error_code`, `safe_error_details` |
| `extraction_results` | Candidate before confirmation | `id`, `run_id`, `candidate_type`, `schema_version`, `payload_json`, `validation_status`, `findings_json` |
| `artifacts` | Common artifact identity | `id`, `user_id`, `artifact_type`, `title`, `description`, `status`, `created_at`, `updated_at` |
| `tasks` | Task-specific fields | `artifact_id`, `deadline`, `completion_status`, `estimated_minutes` nullable |
| `task_steps` | Ordered task steps | `id`, `task_artifact_id`, `position`, `title`, `description`, `status` |
| `skills` | Skill identity/current version | `artifact_id`, `current_version_id` |
| `skill_versions` | Canonical skill specification | `id`, `skill_artifact_id`, `schema_version`, `spec_json`, `content_hash`, `created_at` |
| `artifact_sources` | Many-to-many provenance | `artifact_id`, `source_id`, `processing_run_id`, `relationship_kind` |
| `evidence_links` | Artifact/step to evidence | `artifact_id`, `evidence_id`, `step_id` nullable, `relationship_kind` |
| `categories` | User/system topic vocabulary | `id`, `owner_user_id` nullable, `name`, `slug` |
| `artifact_categories` | Many-to-many topic association | `artifact_id`, `category_id` |
| `skill_exports` | Tool-specific rendered output | `id`, `skill_version_id`, `target`, `renderer_version`, `package_hash`, `validation_status`, `created_at` |
| `validation_runs` | Auditable validators | `id`, `candidate_id`, `validator_version`, `result`, `findings_json`, `created_at` |

Use normal relational columns for ownership, identity, relationships, important query fields, and states. JSONB is appropriate for variable provider metadata and the canonical structured skill payload. Do not put the entire product state into one JSON field.

### 7.3 Artifact type evolution

MVP artifact types: `task`, `ai_skill`.  
Planned final-product types: `plan`, `habit`, `tip_reference`.

Keep a common artifact identity for search and navigation, with type-specific tables or schema-validated payloads. Do not make a task and skill identical just because they share a title and source. Their semantics, versions, and validation rules differ.

Topical categories (for example, `coding`, `health`, or `career`) are independent from artifact type. Recurrence belongs to habits/routines; multi-step organization belongs to plans/roadmaps; neither should be represented as a `short_term` category.

### 7.4 Key invariants

- Every user-owned record has a verifiable owner or an explicit ownership path.
- Every evidence record points to the source from which it originated.
- Every completed processing job references its final successful run or a clearly recorded outcome.
- Every confirmed artifact is linked to a source/run or labeled user-created.
- Every `task_steps.position` is explicit; ordering is deterministic.
- Every skill export references a specific immutable skill version and renderer version.
- A failed run cannot be treated as a completed extraction.
- Deleting an artifact must not accidentally delete evidence still referenced by another artifact.
- Deduplication must not leak another user's saved records or private state.
- Database transactions and constraints enforce invariants, not only frontend code.

---

## 8. Data structures and algorithms: requirements that must be real

The product must be an example of thoughtful algorithmic design, not a collection of trendy tools. Choose algorithms that solve measured product problems and document their complexity and boundaries.

### 8.1 URL canonicalization and source identity

Implement a platform-aware URL parser rather than substring checks. Normalize valid URL variants by removing irrelevant tracking parameters, validating hostnames, and extracting a stable platform content identifier when possible.

Use canonical `(platform, platform_content_id)` identity when reliable. Otherwise use a normalized canonical URL and an explicit fallback strategy. Add database uniqueness constraints consistent with the intended deduplication scope. Preserve the user's original URL for traceability.

**Acceptance:** equivalent known URL variants resolve to one source identity according to documented rules, and malformed/untrusted URLs are rejected before fetch.

### 8.2 Idempotent job creation

Use an idempotency key derived from the authenticated user, normalized source identity, and operation intent. Enforce uniqueness in the database where appropriate. Duplicate submissions should reuse or reference existing in-progress/completed work according to product behavior rather than create uncontrolled duplicate jobs.

Do not assume that a globally repeated video means every user should see another user's artifacts. Source evidence reuse and user-owned artifact identity are separate concerns.

### 8.3 Efficient graph representation

The spatial library is a graph of actual relationships. Use a normalized relational model as the source of truth and materialize an adjacency-list representation for the frontend/query response when useful.

Recommended structures:
- stable node-ID map for direct lookup;
- adjacency list for source/artifact/category links;
- indexed node-type and category filters;
- bounded subgraph queries centered on the selected node;
- explicit graph version or stable layout seed where needed for deterministic layout.

Use graph traversal only when a feature needs it: for example, finding related artifacts within one or two hops or building a focused neighborhood around a source. Document complexity as `O(V + E)` for a traversal of the visited subgraph, rather than claiming the whole app is `O(1)`.

A force-directed layout may use iterative simulation, but cap node counts, stabilize after interaction, and use clustering/collapsing for large libraries. A graph should never be built by downloading every record into the browser without limits.

### 8.4 Search and filtering

Start with PostgreSQL full-text search and a GIN index for title/description/content fields needed by real use cases. Use indexed filters for owner, artifact type, category, and dates. Add trigram/fuzzy search only if spelling tolerance is required and tested.

Do not introduce vector search in the MVP simply because the product uses AI. Evaluate the quality of ordinary full-text search first. Search results must be scoped to the current user's permissions in the query itself.

### 8.5 Extraction pipeline and stage reuse

Represent work as a staged state machine. Each stage takes a versioned, typed input and writes a typed result. Retrying a failed downstream stage must not repeat successful expensive upstream work unless its input has changed or the evidence is no longer valid.

Use content hashes for detecting unchanged inputs and caching deterministic preprocessing. Include relevant pipeline/model/prompt/schema versions in cache identity; do not return stale results merely because the URL is unchanged.

### 8.6 Schema validation and bounded repair

Validate LLM results at runtime. Use strict schemas, unknown-field rejection, unique identifiers, bounded arrays and strings, reference integrity, and semantic checks. A bounded repair call may be made after validation failure. After the retry limit, fail visibly and preserve safe diagnostics.

LLM-supplied confidence is not a calibrated probability. Evaluate extraction quality on a small, manually reviewed real-video dataset with explicit completeness and groundedness criteria.

### 8.7 Performance discipline

- Add indexes based on query patterns, verify with query plans, and avoid speculative indexing.
- Use pagination/cursors for large library results.
- Use virtualization for large lists and graph side panels.
- Lazy-load heavy 3D code and avoid loading it on simple routes where it is unnecessary.
- Instrument expensive steps before optimizing them.
- Record representative dataset sizes and benchmark environment in performance reports.

### 8.8 Algorithmic decision record

For every nontrivial algorithm introduced, document:
- the problem it solves;
- selected data structure/algorithm;
- alternatives considered;
- expected complexity;
- real input-size assumptions;
- test strategy;
- measured performance if a benchmark was run;
- the conditions under which the design should be revisited.

No complexity claims without matching assumptions. No “advanced DSA” code whose only purpose is spectacle.

---

## 9. Canonical extraction contracts

### 9.1 Evidence contract

A normalized evidence record should capture:

- unique evidence ID;
- source ID;
- kind: metadata, caption, transcript, visual observation, or user-provided material;
- content or secure content reference;
- timestamp interval when applicable;
- acquisition provenance and method version;
- language when known;
- hash where useful;
- limitations and warnings.

Keep raw content separate from interpreted summaries. Avoid retaining the original media file unless required for processing and permitted under the selected acquisition method.

### 9.2 Task candidate contract

A candidate task should contain:

- `artifact_type: task`;
- title and description;
- ordered steps with stable IDs;
- topical categories;
- optional duration estimate only if defensible;
- evidence links for the major steps;
- explicit inference markers where appropriate;
- schema version and processing provenance.

Deadlines, priorities, and completion states are user-controlled unless directly and intentionally requested by the user. Do not infer a due date from a creator's vague advice.

### 9.3 SkillSpec contract

A canonical `SkillSpec` should contain:

- `schema_version`;
- identity: name, title, summary, description;
- intended use and non-use conditions;
- trigger examples grounded in the intended behavior;
- required/optional input contract;
- ordered workflow steps with unique IDs;
- expected output contract;
- evidence references for major instructions;
- provenance labels: source observation, model inference, or user-added;
- capability declarations from a fixed allowlist;
- safety findings and validation status;
- generation and renderer version metadata.

Instruction-only is the default capability level. The LLM may not invent arbitrary permissions. Do not accept a skill's self-declared safety status as authoritative.

### 9.4 Strict validation layers

1. **Structural:** schema, types, required fields, unknown fields, limits.
2. **Semantic:** uniqueness, valid references, valid step order, compatible field combinations.
3. **Evidence:** claims/steps linked to real retrieved evidence where possible; inference explicitly labeled.
4. **Safety:** suspicious instructions, secrets, destructive command patterns, requests to ignore higher-priority instructions, and unnecessary capabilities.
5. **Target compatibility:** valid file metadata, supported feature set, path safety, and renderer output contract.

A valid JSON object is not by itself a correct, grounded, safe, or compatible skill.

---

## 10. API and processing contracts

Exact route syntax may adapt to the chosen framework, but behavior and authorization requirements must remain.

### 10.1 Core operations

- Submit a source URL and receive a durable job ID.
- Read a processing job and its current stage.
- Retrieve a review candidate after the pipeline completes.
- Validate and save a confirmed artifact.
- Read/search/filter the current user's artifacts.
- Read source metadata and evidence that the user is allowed to access.
- Edit and version saved artifacts.
- Export a validated skill package.
- Delete artifacts and apply the documented evidence-retention policy.

### 10.2 Processing job lifecycle

1. Validate request and authentication.
2. Normalize source URL and compute operation identity.
3. Create/reuse a durable job idempotently.
4. Acquire source evidence.
5. Normalize and persist eligible evidence.
6. Run structured extraction.
7. Validate and optionally repair within a fixed budget.
8. Store candidate and transition to `needs_review`.
9. User edits and confirms.
10. Persist artifact, categories, evidence links, and confirmation atomically.

### 10.3 Error taxonomy

Use safe, typed errors such as:

- invalid/unsupported URL;
- source unavailable;
- access denied or authorization required;
- platform throttling/rate limit;
- media too large or unsupported;
- transcript unavailable;
- transcription provider failure;
- visual processing failure;
- LLM timeout/provider failure;
- schema validation failure;
- safety review required;
- database/persistence failure;
- export compatibility failure.

Show actionable user messages and retain sanitized operational context. Never show raw credentials, cookies, full environment values, or unnecessary stack traces in the user interface.

---

## 11. Safety, legal, and source-access requirements

The agent must investigate available open-source acquisition tools instead of presuming the preferred route. It must check the current repository license, dependency health, actual code behavior, deployment requirements, and whether the method can retrieve public content without unauthorized access.

The design shall not attempt to defeat private-account permissions, sign-in restrictions, paywalls, anti-abuse systems, technical restrictions, or rate controls. Do not use stolen sessions or secrets. Do not harvest identifying information unrelated to the user's requested processing. If platform requirements or access limitations make a method unsuitable, document the limitation and disable that connector rather than adding a bypass.

For video content:
- retrieve only what the selected method permits;
- do not retain media longer than needed without a documented product reason;
- avoid republishing original video or extensive transcripts as the user's own output;
- keep extracted summaries and user artifacts linked to source attribution;
- permit source/artifact deletion under the product retention rules.

REA is a development-time inspection tool, not a production feature. Its presence must not expand the product's permissions or change the runtime attack surface unnecessarily.

---

## 12. Observability and quality measurement

The MVP shall collect internal operational metrics needed to understand true reliability. Do not log full private transcripts or media by default.

### 12.1 Operational measures

- source resolution success/failure by platform and error class;
- transcript/evidence acquisition success;
- processing duration by stage;
- retry counts and final job status;
- LLM latency and token/cost information where available;
- schema-validation failure rate;
- export-validation results;
- duplicate-job rate;
- persistence failures;
- 3D frame rate and graph render time in supported test environments.

### 12.2 Extraction quality measures

Build a manually reviewed set of authorized real videos. For each, record the important facts/actions, supported evidence, correct artifact destination, and known ambiguities.

Track:
- extraction completeness;
- unsupported-claim rate;
- ordering/condition errors;
- structural validation pass rate;
- user edit/rejection rate;
- percentage saved without substantial correction;
- skill-package validation pass rate;
- actual target-tool behavior only when tested.

Do not use model self-confidence alone as truth. A model's claim that its output is accurate does not replace evaluation.

---

## 13. Testing and acceptance criteria

### 13.1 Engineering tests

- Unit tests for URL normalization, schema validators, state transitions, hashing, authorization, and renderer rules.
- Integration tests for database transactions, queue/retry behavior, real provider clients, and export generation.
- Security tests for malformed URLs, redirect validation, SSRF, untrusted content, authorization boundaries, archive paths, and credential redaction.
- UI tests for capture, processing, review/edit, save, search, delete, reduced motion, keyboard flow, and 2D fallback.
- Performance tests with documented synthetic graph shapes are allowed for algorithmic/load testing, but these synthetic records must never appear in production or be presented as real user content.
- At least one end-to-end test must use a real authorized public YouTube Short and real configured processing/LLM services. Report exact conditions and outcome; do not overgeneralize from one video.

### 13.2 Definition of done for the MVP

The MVP is not done until all applicable points are true:

1. A real YouTube Shorts URL is accepted and normalized correctly.
2. The chosen real acquisition method retrieves usable source metadata and/or media evidence.
3. Transcript and visual stages report honestly what was and was not obtained.
4. The configured LLM produces structured content from the actual retrieved evidence.
5. Schema, semantic, provenance, and safety checks run server-side.
6. The user can review, edit, choose Task or AI Skill, and explicitly confirm.
7. The artifact is saved in PostgreSQL and survives reload/re-login.
8. Source/evidence links and processing-run provenance remain available.
9. Repeated submissions follow the documented idempotency behavior.
10. Failed access or API calls produce real errors, not fallback content.
11. Search and filters operate on real persisted records.
12. The interface's 3D/spatial experience uses actual data and has a functional accessible fallback.
13. No fake example items or seeded sample content appear in the user-facing app.
14. Setup docs list every real dependency and human configuration still needed.
15. Automated tests pass and the report distinguishes mocks/unit tests from real end-to-end tests.

### 13.3 Visual quality review

The interface should be reviewed at minimum on desktop and mobile widths, with normal motion and reduced motion, and with the following data conditions:
- genuinely empty library;
- one real saved artifact;
- multiple real artifacts and categories;
- long titles and long descriptions;
- processing failure;
- slow processing;
- WebGL unavailable;
- low rendering performance;
- offline or flaky network;
- Hindi and other non-Latin content with long strings;
- 320 px width and 200% text zoom.

A visually impressive screenshot alone is not acceptance. The product must remain usable, correct, and responsive in each condition.

---

## 14. Recommended implementation stack (adapt after repository audit)

If creating the product from scratch, a sensible starting point is:

- **Language:** TypeScript for shared types and contracts.
- **Frontend:** React-based framework with server/client boundaries made explicit.
- **Visual layer:** ordinary DOM/CSS for all text, forms and screens; 2D graph (Sigma.js + graphology) for the Atlas, with optional lazy-loaded React Three Fiber for a 3D mode. Component and asset choices follow Section 6.12.
- **Motion:** a restrained motion library for transitions; respect reduced motion.
- **Styling:** design tokens and reusable components, not one-off arbitrary styles on every page.
- **Persistence:** PostgreSQL with a typed query/ORM layer and migrations.
- **Validation:** runtime schema validation for HTTP inputs and LLM outputs.
- **Jobs:** a durable queue/worker approach that survives restarts.
- **Testing:** unit, database integration, browser/UI, security, and end-to-end integration tests.
- **Operations:** structured logging, health checks, sanitized errors, and configuration through environment variables/secrets management.

This is a recommendation, not permission to rewrite the existing project indiscriminately. Audit and retain good existing architecture first. Do not add a vector database, graph database, message bus, or multiple microservices without a measured need.

---

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Link-based acquisition is unreliable or unavailable | Research multiple real methods; test early; isolate providers; make unsupported cases honest failures. |
| Platform terms or restrictions invalidate an extraction method | Review requirements; do not bypass controls; disable unsuitable connectors and document limitations. |
| Captions are unavailable or incomplete | Separate caption, transcription, and visual evidence paths; preserve uncertainty. |
| LLM omits or invents instructions | Strict schema, evidence links, validation, reviewed evaluation set, user confirmation. |
| Overdesigned 3D interface hurts task completion | Keep capture/edit/search in DOM; measure performance; provide list/2D fallback. |
| “DSA showcase” becomes unnecessary complexity | Tie every algorithm to a user-visible problem and record complexity assumptions. |
| Duplicate processing wastes time and costs | Idempotency, unique constraints, stage-level caching and retries. |
| Private user data leaks via logs or graph queries | User-scoped server queries, redaction, retention limits, authorization tests. |
| Reference research leads to copied designs | Use REA for evidence and behavior analysis; document abstraction; create original design tokens and components. |
| Skill export is incompatible with target tools | One renderer at a time; verify current target format; distinguish valid, compatible, and tested. |

---

## 16. External references for the implementation agent

These links are starting points for current verification, not proof that a proposed integration is suitable.

- [REA repository](https://github.com/morluto/rea)
- [REA documentation](https://github.com/morluto/rea/tree/main/docs)
- [REA license](https://github.com/morluto/rea/blob/main/LICENSE)
- [YouTube Data API reference](https://developers.google.com/youtube/data/reference/rest)
- [YouTube Terms of Service](https://www.youtube.com/t/terms)
- [YouTube captions API reference](https://developers.google.com/youtube/data/reference/rest/v3/captions)

The agent must check the current official documentation and the specific behavior of any selected method. The presence of a metadata API does not automatically prove that arbitrary media or caption tracks can be downloaded for any video.

---

# Appendix A — Implementation plan

This plan is intentionally phased to reduce the risk of building a beautiful interface around an unworkable source-acquisition method. Execute each phase, test it, and report evidence before moving to the next. Do not promise work for a later time; perform the work in the current task and clearly report any blocker that genuinely requires external credentials or human authorization.

## Phase 0 — Repository audit and acquisition feasibility

### Tasks
1. Inspect the existing repository, framework, package scripts, database, tests, existing API integrations, and environment configuration.
2. Inspect `morluto/rea` and determine how to install/use its relevant skill or MCP tools with the current coding agent. Review the intended setup changes before approving them. Do not assume that installing the skill automatically registers or starts every analysis tool.
3. Select a few relevant reference experiences and use REA only where it can provide evidence about real behavior or interaction. Produce a concise reference-analysis record and original design principles.
4. Investigate free/open-source, URL-based YouTube Shorts and Instagram Reel acquisition approaches. Inspect repositories/source, licenses, dependencies, security issues, maintenance, supported URL types, deployment compatibility, and actual outputs.
5. Test candidates with content the agent is authorized to access. Record the precise result, environment, errors, and unsupported cases.
6. Decide which acquisition implementation can safely support the first end-to-end path. The first implemented path is YouTube Shorts; maintain the planned adapter boundary for Instagram even if its connector remains disabled.
7. Write down all dependencies and settings that require human configuration. Do not fabricate credentials or mark an untested connection as operational.

### Exit criteria
- Repository and architecture inventory exists.
- REA use is documented and configured only as needed.
- Acquisition feasibility report contains evidence rather than guesses.
- The team has selected a testable first path and knows its limitations.
- No production UI or seeded mock content has been added.

## Phase 1 — Domain model, contracts, and persistence

### Tasks
1. Define typed contracts for `Source`, `Evidence`, `ProcessingJob`, `ProcessingRun`, `ExtractionResult`, `Task`, `SkillSpec`, `Artifact`, `Category`, and `SkillExport`.
2. Create database schema and migrations for source/evidence/run/candidate/artifact relationships.
3. Add ownership and foreign-key constraints, useful unique constraints, state checks, and indexes based on anticipated queries.
4. Implement URL canonicalization and idempotent job creation.
5. Define versioned strict schemas for Task and SkillSpec.
6. Create unit tests for normalization, validation, invariants, and duplicate submissions.

### Exit criteria
- Migrations run on a clean database.
- Invalid states and broken relationships are rejected.
- URL normalization is covered by tests.
- No fixture data is loaded into production.

## Phase 2 — Real source acquisition and evidence pipeline

### Tasks
1. Implement the chosen YouTube Shorts resolver behind an acquisition interface.
2. Retrieve actual source metadata/media/captions according to the chosen method's capabilities and rules.
3. Implement actual transcription where necessary and relevant visual-frame analysis where the source requires it.
4. Normalize all outputs into `source_evidence` records, preserving timestamps, provenance, and acquisition limitations.
5. Implement a worker and durable job states with timeouts, bounded retries, and sanitized failures.
6. Add cleanup for temporary media and intermediate files.
7. Integrate safe URL/redirect validation and protect against SSRF.
8. Keep Instagram as a separately tested adapter or an explicitly disabled/unavailable connector until it passes feasibility tests.

### Exit criteria
- At least one real authorized YouTube Short completes acquisition in the target environment.
- Evidence persisted is demonstrably from that content.
- Failures appear as failures; no fabricated transcript or metadata is rendered.
- Worker retries do not create duplicate jobs or uncontrolled media retention.

## Phase 3 — Structured LLM extraction and validation

### Tasks
1. Build prompts around normalized evidence rather than sending an unbounded raw media dump.
2. Call a real configured LLM provider using structured output if supported.
3. Implement strict structural, semantic, evidence, and safety validators.
4. Implement one bounded repair attempt/strategy and clear failure handling.
5. Record model/provider, schema, prompt/pipeline version, latency, and safe validation findings.
6. Create a manually reviewed evaluation set from real authorized videos; keep it out of user-facing production data.
7. Measure completeness, groundedness, schema failures, and extraction costs before tuning prompts/models.

### Exit criteria
- A real video produces a valid candidate derived from retrieved evidence.
- Unsupported claims and invalid structures are rejected or flagged.
- The test report separates unit tests and mocked provider tests from real provider calls.

## Phase 4 — Confirmation flow and saved artifacts

### Tasks
1. Implement the capture screen and real backend job submission.
2. Implement truthful processing states.
3. Implement candidate review with evidence context and inline validation findings.
4. Implement Task/AI Skill destination switching where the evidence supports it.
5. Let users edit titles, descriptions, steps, and topic categories.
6. Save only after explicit confirmation, in a database transaction with evidence links.
7. Implement real artifact detail, library, search, filters, edit, and delete.
8. Implement empty states that contain no fake items.

### Exit criteria
- A user can process a real video, review the actual output, edit it, save it, refresh, and retrieve it again.
- Duplicate submission behavior is deterministic.
- Library screens query actual persisted data and are scoped to the current user.

## Phase 5 — Skill export

### Tasks
1. Verify the current official format of one target AI tool.
2. Implement a versioned renderer from the canonical SkillSpec.
3. Validate frontmatter/metadata, names, package paths, allowed files, and required fields.
4. Create the export preview and download flow.
5. Record renderer version and package hash.
6. Test the package with target-specific validation; only perform an in-product target test if authorized and actually available.

### Exit criteria
- One genuinely supported export target passes the renderer and package validation suite.
- Compatibility and actual behavior testing are clearly distinguished.
- No generated executable or extra file is bundled unexpectedly.

## Phase 6 — Design system, core screens and Atlas

Run the design-system and core-screen work in parallel with Phases 2–4 so the review screen is designed with the pipeline, not after it.

### Tasks
1. Implement the tokens, themes, typography and provenance chip component from Section 6.3 as a reusable component library on accessible primitives.
2. Build Capture, Processing, Review, Library, Artifact detail, Sign-in and Settings per Section 6.8, mobile first, with all states in 6.14.
3. Implement PWA installability and the Android Web Share Target; clipboard-paste detection; local draft preservation.
4. Implement the frame-lock and kept moments (6.4) with reduced-motion variants.
5. Build the 2D Atlas from real source/artifact/topic relationships: stable seeded layout, adjacency-list payloads, bounded 2-hop subgraphs, 300-node cap, clustering, filters, search-to-focus, node detail panel, legend, keyboard navigation and list equivalent.
6. Add the optional lazy-loaded 3D mode only after the 2D Atlas meets its acceptance criteria.
7. Run automated accessibility checks plus manual keyboard and screen-reader passes.
8. Measure performance against Section 6.11 and Atlas frame rate against Section 6.5. Use synthetic graph data only in test/benchmark environments.

### Exit criteria
- All screens in Section 6.8 work at 360, 768 and 1280 px in both themes, with and without reduced motion.
- The Atlas displays exclusively actual library entities and has a functional list/keyboard equivalent.
- The Section 6.14 checklist passes; measured performance and the benchmark conditions are documented.

## Phase 7 — Algorithmic hardening, security, and quality

### Tasks
1. Review canonicalization, idempotency, transactionality, foreign keys, graph payload limits, and search indexes.
2. Verify query plans for representative search/list/detail queries.
3. Add security tests for untrusted URLs, redirects, SSRF, cross-user access, prompt injection, archive paths, and secret redaction.
4. Add a privacy-aware observability dashboard or structured reporting for acquisition errors, processing latency, validation failures, and costs.
5. Create algorithm decision records for graph navigation, search, deduplication, and caching.
6. Tune only after measurements; remove unnecessary dependencies/algorithms.

### Exit criteria
- No known critical ownership, URL-validation, or secret-leakage bug remains.
- Measured performance and correctness reports exist.
- Complex algorithms have documented purposes, assumptions, and complexity.

## Phase 8 — Release verification and delivery

### Tasks
1. Run migrations against a clean environment.
2. Run unit, integration, UI, security, and end-to-end tests.
3. Perform real provider tests with authorized live content.
4. Test empty library, one item, multiple items, large titles, unavailable content, provider outage, invalid model output, WebGL unavailable, and reduced-motion mode.
5. Remove development logging that exposes source text or secrets.
6. Verify there are no fake list items, placeholder output, example “successful” runs, or success-shaped API fallbacks.
7. Document local setup, environment variable names, provider setup, run/test commands, current limitations, and how to troubleshoot each failure class.
8. Deliver a completion report with exact tests run, which tests use mocks, actual external integrations exercised, unresolved blockers, and measured limitations.

### Final exit criteria
The MVP definition of done in Section 13.2 is fully satisfied. Any unmet item must be identified plainly rather than marked complete.

---

## Appendix B — Required implementation-agent behavior

The coding agent shall:

- inspect before replacing;
- research before committing to a platform-acquisition method;
- use REA for evidence-based reference analysis when it materially helps;
- use real provider calls and real persisted data for end-to-end acceptance;
- never insert demo records to make empty screens look populated;
- never hardcode secrets;
- never bypass platform access controls or falsify successful retrieval;
- implement and test one vertical slice end-to-end before broadening scope;
- preserve a coherent architecture rather than overengineering;
- report blockers, failures, security concerns, and unverified assumptions explicitly;
- distinguish “implemented,” “tested,” “compatible,” and “verified” in its final report.

**Final product standard:** visually exceptional, data-model disciplined, evidence-backed, safe, responsive, and honest. Every major technical decision must improve correctness, usability, performance, reliability, or maintainability—not just sound impressive.

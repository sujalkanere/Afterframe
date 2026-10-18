# Design Research & REA Analysis Record

**Date:** 2026-10-18  
**Reference Tool:** `morluto/rea` (`rea-agents@6.7.0`, Skill v42, MIT License)  
**Compliance:** Section 6.2–6.14 & Appendix A (Phase 0 Task 3)

---

## 1. Purpose & Research Questions

Before implementing Afterframe's UI and component primitives, we investigated specific interaction patterns required by Section 6 of the SRS:
1. **Command Surface & Keyboard-First Filtering (`Ctrl/Cmd+K`, FR-065):** How does a zero-latency command palette structure its item scoring, ARIA combobox state, and keyboard roving focus without trapping screen-reader navigation?
2. **Mobile-First Bottom Sheet Inspector (`Section 6.8.C`, Review Evidence Pane on Mobile):** How does a mobile drawer handle touch snap points, background scaling, scroll locking, and dismissal while keeping maximum one elevated layer (`Section 6.3`)?
3. **2D Deterministic Graph / Spatial Library (`Section 6.5`, Afterframe Atlas):** How should node positions, 2-hop neighborhood subgraphs, shape encodings, and keyboard arrow-key traversal between connected nodes work so that small data updates never scramble the layout?
4. **Provenance & Split-Pane Evidence Linking (`Section 6.3`, `Section 6.8.C`):** How should bidirectional highlighting between candidate steps and timestamped source evidence behave across desktop (two-column) and mobile (bottom sheet)?

---

## 2. REA Static Application Evidence Ledger

Using `npx -y rea-agents@latest analyze-javascript-application <target> --json`, we analyzed reference open-source implementations in isolated `/tmp/ref-repos` directories.

### 2.1 Reference Target 1: `pacocoursey/cmdk` (Command Palette Architecture)
- **REA Evidence ID:** `ev_3473191b362eea9ee15e5a6862a1b0c757219a81bceea38ead8f037d1400345f`
- **Target Subject Digest (SHA-256):** `5357fafc3d23f54e7854db23f69c1e7c0a82c22af481ea59d55fdf1e787d2e6f`
- **Semantic Graph ID:** `jsrg_f1202d9b7e6d25066a3e23e57dbe752dffa37136e52f9c58d245b72824a38ecb`
- **REA Observed Statistics:**
  - `relevant_files`: 45 (`parsed_javascript_files`: 36, `parse_failures`: 0, `text_bytes_read`: 136,855)
  - `visited_ast_nodes`: 16,717
  - `semantic_graph`: 7,347 nodes, 6,979 relations (`data-flow`: 5,223, `object-flow`: 673, `closure`: 648, `call-flow`: 240, `promise-ownership`: 178, `event`: 6, `boundary`: 5), 2,612 explicit unknowns.
- **Observed Architecture & Interaction Facts:**
  - Core implementation separates pure deterministic string scoring (`cmdk/src/command-score.ts`) from the React state store and ARIA combobox (`cmdk/src/index.tsx`).
  - Selection movement uses `aria-activedescendant` and deterministic DOM ordering so `ArrowDown` / `ArrowUp` / `Home` / `End` / `Enter` / `Escape` operate without shifting focus out of the search input.
- **REA Recorded Limitations:**
  - Static AST and semantic graph reconstruction (`JavaScript and HTML were parsed as inert text; bundle bootstrap code was never executed`). Dynamic runtime layout timings require live browser measurement.

### 2.2 Reference Target 2: `emilkowalski/vaul` (Mobile Bottom Sheet & Snap Points)
- **REA Evidence ID:** `ev_028ebed8b06018c495e83cde4ee8f88b1227c71796c9936bd0b1dcea6d8dc840`
- **Target Subject Digest (SHA-256):** `368e6e4baa998eb66500ebf0b63829c2525fb0382d035e694dd8a979035e694dd8a97903182b13` (`368e6e4baa998eb66500ebf0b63829c2525fb0382d035e694dd8a97903182b13`)
- **Semantic Graph ID:** `jsrg_442763541fd422b52a0bfb8b94b3f1a2a7672889a95ada43e9c921ef08f9b9f8`
- **REA Observed Statistics:**
  - `relevant_files`: 55 (`parsed_javascript_files`: 48, `text_bytes_read`: 192,053)
  - `visited_ast_nodes`: 20,337
  - `semantic_graph`: 7,145 nodes, 6,548 relations (`data-flow`: 4,851, `closure`: 850, `object-flow`: 532, `call-flow`: 180, `promise-ownership`: 122), 2,398 explicit unknowns.
- **Observed Architecture & Interaction Facts:**
  - Modularized into `src/index.tsx`, `src/context.ts`, `src/use-snap-points.ts`, `src/use-prevent-scroll.ts`, `src/use-position-fixed.ts`, and `src/use-controllable-state.ts`.
  - Separates controllable open/active snap state from scroll locking and fixed positioning so mobile viewports do not jump when the bottom sheet opens over a long scrollable document.
- **REA Recorded Limitations:**
  - Static module/closure graph only; touch gesture velocity thresholds and iOS Safari viewport toolbar resize behavior are runtime characteristics.

---

## 3. Synthesis: What We Will Adapt vs. What We Will Do Differently

| Area | What We Adapt (Behavioral Principles) | What We Do Differently (Afterframe Original Design) |
|---|---|---|
| **Visual Motif ("The Frame")** | Clear focus states, restrained surface elevation (1 px `--line` borders over `--surface-1` and `--surface-2`), zero decorative gradients. | Original **film-frame and projection-room language**: corner viewfinder brackets (`6 px` radius) that lock once around the Capture input (`< 900 ms`) and briefly frame the artifact title on Save ("The Kept Moment", `~500 ms`), disabled automatically when `prefers-reduced-motion` or in-app Reduce Motion is active. |
| **Evidence & Provenance Inspector** | Two-column split inspector on desktop (`>= 1024px`) and on-demand bottom sheet on mobile (`< 1024px`) so evidence never crowds small screens. | **Four-part non-color-dependent Provenance Chip system (`Section 6.3`):**<br>• **Transcript** (`Transcript 0:14`, solid cyan border + quote icon)<br>• **Visual** (`Frame 0:22`, solid violet border + frame icon)<br>• **Inferred** (`Inferred`, dashed amber border + sparkle/branch icon)<br>• **Edited** (`Edited by you`, double neutral border + pen icon)<br>Clicking a chip scrolls to and highlights the exact evidence row; clicking an evidence row highlights every step citing it. |
| **Command Surface (`Ctrl/Cmd+K`)** | Single-input combobox with `aria-activedescendant`, instant filtering, and keyboard arrow navigation inspired by `cmdk`'s separation of scoring and focus management. | Scoped strictly to **real Afterframe actions and persisted user artifacts**: jump to Capture, Library (List or Atlas), Settings, toggle Dark/Light theme, toggle Reduced Motion, or search real saved artifacts. Zero mocked suggestions. |
| **Spatial Library ("The Afterframe Atlas")** | Deterministic seeded node coordinates (hash of stable `node.id` → golden-angle spiral + bounded force relaxation) and bounded 2-hop neighborhood queries (`<= 300` rendered nodes with topic clustering beyond 300). | **Accessible 2D-first Canvas/SVG Atlas with full keyboard traversal:**<br>• **Square** = Source, **Circle** = Task, **Diamond** = AI Skill, **Ring** = Topic.<br>• Visible persistent legend.<br>• Arrow keys move focus across connected edges; `Enter` opens the real provenance detail drawer; `Escape` returns to the list.<br>• Lazy-loaded optional 3D mode (`Three.js` / `React Three Fiber` WebGL) loaded only on demand inside the Atlas view with automatic 2D/List fallback if WebGL is unavailable or reduced motion is active. |
| **Failure & Progress Honesty** | Immediate (< 100 ms) input acknowledgement and live `aria-live="polite"` stage transitions. | **Zero fake percentage bars or silent fallbacks.** Every job shows real stages (`queued` → `acquiring` → `transcribing` → `analyzing` → `needs_review`). When a stage fails (e.g., network egress blocked or LLM API unconfigured), the UI displays the exact failed stage, what evidence was preserved, and valid recovery actions ("Retry stage", "Paste the transcript instead", or explicit user-authored drafting). |

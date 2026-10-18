# Reference Analysis: Aside.com Landing Page Archetype

This analysis inspects `https://aside.com/` as a structural reference for the Afterframe public marketing site. Observations were gathered using headless browser inspection at desktop (1440 px), tablet (768 px), and mobile (390 px) viewports. Per the prompt instructions, every observation is strictly classified as either **Observed** (directly verified via DOM/render output) or **Inferred** (deduced from visual styling, motion behavior, or layout architecture).

---

## 1. Section Order & Layout Archetype Mapping

| # | Reference Section (Aside.com) | Observed Archetype | Afterframe Adaptation | Expression Safeguard (What We Must NOT Copy) |
|---|---|---|---|---|
| **1** | Top Navigation Bar | Sticky translucent bar; logo left, horizontal text links center, primary action right ("Download"). | Sticky translucent top bar with Afterframe logo, navigation links, and primary CTA **"Log in"** (switches to **"Open app"** if active session exists). Mobile collapses to hamburger menu sheet. | Use Afterframe tokens (`--bg`, `--surface-1`, `--line`, `--accent`), no external badges or copied SVG marks. |
| **2** | Hero Section | Two-tone headline (bold lead + muted trailing line), subheadline, primary CTA pill, floating app window mockup with soft ambient glow. | Two-part headline using Schibsted Grotesk + Instrument Serif accents, subheadline, primary CTA **"Log in"**, secondary link **"See how it works"**. Below: real app mockup frame with sidebar, URL input with frame brackets, and 3 recent cards. | Ambient lighting uses Afterframe's projector amber warm light token (`--accent`), not Aside's cyan cloud background. |
| **3** | Problem & Vision Statement | Asymmetrical split: small eyebrow link on left ("Introducing Aside >"), two large paragraphs on right. | Eyebrow link ("Why Afterframe >"), short paragraph contrasting chaotic video saves with structured, evidence-backed knowledge extraction. | Original text; no AI browser critique; no paraphrased phrasing. |
| **4** | Core Capabilities Block | Centered eyebrow + large heading + paragraph; 3-column card grid with visual slots on top and bold title + sentence below. | Eyebrow ("Capabilities >") + heading ("Turn fleeting frames into durable knowledge") + 3-card grid: *Paste any link*, *Review before you keep*, *Evidence on every step* with Lucide icons. | Original card copy, media placeholder tokens with viewfinder brackets, no copied artwork. |
| **5** | Evidence & Provenance ("SOTA Benchmark" archetype) | Centered heading with muted badge, subline, benchmark category pills, horizontal comparison cards. | **"Evidence you can check"** archetype: replaces benchmark charts with Afterframe Provenance Chips (`Transcript`, `Frame`, `Inferred`, `Edited`) beside a review-screen media placeholder. | Absolutely no benchmark rankings, percentage comparisons, or claims against third parties. |
| **6** | Spatial Library / Topic Graph ("Memory" archetype) | Gradient-accented headline ("Memory that knows..."), description, tabbed viewports / interactive canvas preview. | Headline on organizing by topic without manual tagging, sample topic chip, dual media placeholders showing List View and Atlas 2D graph view. | Purely Afterframe data structures (Task, AI Skill, Topic clusters); no browser memory or local browsing history claims. |
| **7** | Human-in-the-Loop Trust Block ("Password Manager" archetype) | 3 feature cards with top media + text; wide split banner below (left: feature bullets, right: vault illustration). | 3 trust cards (*You confirm everything*, *Nothing saved without you*, *Honest about what it didn't see*). Wide banner below for *Export & Integrations* (*Send tasks to Google Tasks [coming soon]* and *Export AI skills*). | Replaces password/credential vault concept with human review gate and explicit user confirmation guarantee (FR-030). |
| **8** | Privacy & Data Control Block | Masked asterisk headline revealing on interaction ("******* enough to use real data"), 4-column card grid with security guarantees. | Masked reveal heading ("******* enough for real workflows" resolving to "Private"), 4 cards reflecting true SRS Section 7 retention rules: *Zero media retention*, *Local draft autosave*, *Full account export & purge*, *BYO model keys*. | Only state documented truths from SRS Section 7. Mark any speculative claims `[VERIFY]`. |
| **9** | Closing CTA Banner | High-contrast atmospheric container with warm radial glow, large centered statement, primary CTA pill. | Calm "projection room" container with projector amber glow, prompt headline, primary CTA **"Log in"** (or **"Open app"**). | Original copy; consistent 44 px touch target. |
| **10** | Global Footer | Multi-column directory grid (Features, Use cases, Resources, Company, Legal), bottom bar with copyright and icon links. | 4 columns (Product, Use cases, Resources, Legal). Links to `/terms`, `/privacy`, contact, GitHub. Copyright "© 2026 Afterframe". No third-party trackers or pixels. | No tracking scripts; clear `[VERIFY]` markers on stub legal links. |

---

## 2. Spacing Rhythm & Layout Archetypes

### Spacing Rhythm
- **Observed:**
  - Section vertical padding: 96 px to 128 px on desktop (1440 px), collapsing to 64 px to 80 px on tablet (768 px), and 48 px to 64 px on mobile (390 px).
  - Container widths: Max-width 1200 px for content grids; hero mockup expands to 1280 px max-width with subtle negative margin bleed on ultra-wide viewports.
  - Card gap spacing: 24 px on desktop (`gap-6`), 16 px on mobile (`gap-4`).
  - Card inner padding: 24 px to 32 px.
- **Inferred:**
  - Employs an 8 px grid base (consistent with Afterframe's 4/8 px spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128 px).
  - Section separators rely on generous whitespace and 1 px borders (`--line`) rather than drop shadows or abrupt color transitions.

---

## 3. Typography Hierarchy

- **Observed:**
  - Hero Display: ~56 px–64 px on desktop, fluid down to 32 px on mobile. Line height ~1.1.
  - Section Headings (H2): 36 px–44 px on desktop, 28 px on mobile. Line height ~1.15.
  - Eyebrows: 14 px uppercase/sentence-case with trailing chevron arrow (`>`). Letter spacing ~0.05em.
  - Card Headings (H3): 18 px–20 px semibold. Line height ~1.3.
  - Body Text: 16 px–18 px with 1.5–1.6 line height. Secondary text muted to ~60% opacity.
- **Afterframe Tokens Adaptation:**
  - Display Font: `Instrument Serif` (SIL OFL) used sparingly for key emotional display moments.
  - Interface Font: `Schibsted Grotesk` (SIL OFL) for all body copy, UI buttons, eyebrows, and technical labels.
  - All labels follow strict sentence case (no aggressive all-caps).

---

## 4. Scroll, Hover & Motion Behaviors

- **Observed:**
  - **Sticky Header:** Background opacity transitions from 0% to ~85% with backdrop blur (`backdrop-filter: blur(12px)`) after 20 px scroll. Header height slightly compresses from 72 px to 60 px.
  - **Scroll Reveal:** Sections and cards fade in with a slight upward translation (`translateY(16px)` to `0`, duration ~400–600 ms, ease-out curve). Plays once per session.
  - **Masked Text Reveal:** Heading in privacy section displays asterisks (`*******`) that progressively or instantly decode into letters upon hover or viewport intersection.
  - **Card Hover:** Micro-lift (`translateY(-2px)`) with subtle border highlight enhancement.
- **Afterframe Motion Principles (SRS Section 6.6):**
  - All transitions capped at 200–300 ms (except signature 500 ms frame lock).
  - Strictly observe `prefers-reduced-motion` and `data-reduced-motion="true"`: animations turn instant (opacity 1, translateY 0, static decoded text).
  - No scroll-jacking, no infinite drifting camera animations, no autoplay video.

---

## 5. Responsive Breakpoint Matrix

| Component | Desktop (1440 px) | Tablet (768 px) | Mobile (390 px & 320 px) |
|---|---|---|---|
| **Top Bar** | Logo left, centered link group, CTA right. | Logo left, CTA right, menu button. | Logo left, CTA right, slide-over navigation drawer. Full 44 px touch targets. |
| **Hero Layout** | Centered copy (max 800 px), full 1200 px wide floating app window frame with sidebar and 3 recent cards. | Scaled app window frame; recent cards scroll horizontally or stack to 2. | Single column. App window hides decorative sidebar and focuses on the link input + frame brackets + 1 sample card. |
| **Intro Statement** | 2-column asymmetric: Left eyebrow column (30%), right text column (70%). | Vertical stack: eyebrow above paragraph. | Vertical stack: tight 16 px spacing, large legible font (18 px). |
| **3-Card Grids** | 3 columns equal width (`grid-template-columns: repeat(3, 1fr)`). | 2 columns with 3rd wrapping or horizontal swipe. | 1 column stacked (`grid-template-columns: 1fr`). |
| **Wide Banner** | 2 columns: 50% left copy + bullets, 50% right media preview. | Stacked: copy above, media preview below. | Stacked: media preview maintains 16:9 ratio, compact copy. |
| **Privacy Grid** | 4-card grid (`repeat(4, 1fr)`) or 2x2. | 2x2 grid. | 1 column stacked. |
| **Footer** | 4 columns + copyright line. | 2x2 columns. | Single accordion/stack, centered copyright and links. |

---

## 6. Expression & IP Safeguards (The Line We Must Not Cross)

1. **No Text Copying:** All text is 100% original to Afterframe (extracting tasks and AI skills from video with frame-level provenance).
2. **No Asset Theft:** We do not download, hotlink, or clone SVGs, webp, images, or CSS/JS bundles from Aside.com.
3. **No Decorative Gimmicks:** Aside uses blue sky/cloud imagery and macOS-specific window graphics. Afterframe uses the projection room motif: deep neutral dark theme (`#15181C`), warm projector amber light (`#F0B35A`), and viewfinder frame brackets (`FrameBrackets`).
4. **No Unsubstantiated Claims:** Replaced benchmark leaderboards and hardware enclave claims with true Afterframe provenance verification chips and transparent retention policies.

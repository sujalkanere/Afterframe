# Agent prompt: Afterframe landing page, login page and marketing shell

Read `AFTERFRAME_SRS_v1.1.md` (especially Section 6) before starting. Work in the existing repository and follow its stack. This prompt adds a public marketing site and a login page. It does not change the app's data model.

## What we are building

A public landing page for **Afterframe** (turns Shorts and Reels into reviewed tasks and AI skills, with evidence for every step) that follows the *structure and interaction patterns* of a modern product-launch page, plus a **login page** that replaces the usual "Download" button.

**Reference for structure only:** https://aside.com/. Study it with a real browser or screenshot tool at 390, 768 and 1440 px, in the light and dark states if present. Record what you observe in `docs/landing-reference-analysis.md`: section order, layout archetype of each section, spacing rhythm, type hierarchy, scroll and hover behaviors, motion timing, responsive changes. Label each item *observed* or *inferred*.

### The line you must not cross

Reproduce the **layout archetypes, section order, hierarchy, rhythm and interaction patterns**. Do **not** copy or closely imitate:
- any text, headlines, microcopy or legal wording;
- logos, icons, images, illustrations, screenshots, videos, page-curl or other artwork, or file names;
- their CSS, JavaScript, markup or build output; do not hotlink or download their assets;
- their brand colors, typeface choices or distinctive visual identity (use Afterframe's own tokens from SRS Section 6.3);
- their analytics, tracking pixels or tag-manager scripts;
- their claims: no "backed by" badges, benchmark charts or rankings, encryption or hardware-security claims, or any statistic we cannot prove.

If following the structure closely would require copying protected expression, choose a different expression and tell me. The result should feel like the same *kind* of page, not like their page.

## Section map (reference archetype to Afterframe content)

Build these sections in this order. All copy below is *draft placeholder copy*; mark anything uncertain `[VERIFY]` in a content file and do not present it as fact.

1. **Top bar:** logo at left, a small set of text links, and one primary button **"Log in"** at right (replaces "Download"). Sticky, translucent, shrinks slightly on scroll. Mobile: logo plus Log in button and a menu sheet. Omit any investor/endorsement badge.
2. **Hero:** large two-part headline (a strong first line and a muted second line), a short supporting sentence, and a primary CTA **"Log in"** (secondary: "See how it works", anchor link). Below the text, a large **app-window mockup** built from real UI components in a decorative frame: sidebar (Capture, Library, Topics), the link input with the frame-lock brackets, and a short "Recent" row of three cards. Card thumbnails are media placeholders. Entrance animation once, reduced-motion safe. A soft section transition into the next block (original, not a copy of any curl or fold graphic).
3. **Intro statement:** a small eyebrow link, then a short paragraph stating the problem (saving ideas from short videos is messy and unreliable) and the solution. Plain, large body text.
4. **Capability block:** heading, one paragraph, and three compact rows with icon, title and one sentence each: *Paste any link*, *Review before you keep*, *Evidence on every step*. Icons from Lucide.
5. **In place of benchmarks: "Evidence you can check".** Show the provenance chips (Transcript, Frame, Inferred, Edited) next to a media placeholder of the review screen. No numbers, no rankings, no charts of performance.
6. **Library block ("memory" archetype):** heading about a library that organizes by topic, a sample prompt-style chip, and two media placeholders (list view and Atlas view).
7. **Three-card trust block plus wide banner (the "password manager" archetype):** three cards, each with a media placeholder, title and sentence: *You confirm everything*, *Nothing saved without you*, *Honest about what it didn't see*. Below, a wide banner with two bullet features: *Send tasks to Google Tasks (coming soon)* and *Export AI skills*. Show Google Tasks as "coming soon" until the integration is enabled by the feature flag.
8. **Privacy and control block:** heading with a masked-text reveal effect (asterisks resolving into the word on scroll or hover; static fallback for reduced motion and screen readers), three cards with placeholders, and one wide row. Only state what is true of our implementation, such as the retention policy in SRS Section 7; mark everything else `[VERIFY]`.
9. **Closing CTA:** short heading, **"Log in"** button.
10. **Footer:** columns for Product, Use cases, Resources, Company/Legal. Links: Terms, Privacy, Contact. Copyright line, social placeholders. No tracking scripts.

## Login page (`/login`)

- Centered card on the same design tokens. Passwordless email link and a **Continue with Google** button (sign-in scopes only: `openid email profile`; no Tasks scope here).
- Clear states: idle, sending, "check your email" confirmation with resend and a cooldown, expired link, error, and signed-in redirect.
- Short plain-language note about what we store and a link to Privacy and Terms.
- Accessible: labelled input, `aria-live` status, visible focus, works at 320 px.
- Already-signed-in visitors to `/login` go to the app; signed-in visitors to `/` see the landing page with the button changed to "Open app".
- Route map: `/` landing, `/login`, `/privacy`, `/terms`, `/app/...` for the product. Add stub Terms and Privacy pages with `[VERIFY]` markers and a note that they need legal review.

## Media placeholders (no real images or video)

- Create one `MediaPlaceholder` component: fixed aspect ratio (no layout shift), token-based surface, subtle frame brackets, and a visible label such as "Screenshot: review screen, 16:10". Variants: image, video (with a play-icon poster; no autoplay), and illustration.
- Create `docs/media-slots.md` listing every slot: ID, page and section, aspect ratio, recommended pixel size, light/dark variants, and what should be shown. I will supply assets later, so swapping a placeholder for a real file must be a one-line change per slot.
- Prepare optimized loading for later: `next/image` or equivalent with width/height, `loading="lazy"` except the hero, `preload` only for the hero asset, `alt` text slots in a content file, and video with `poster`, `muted`, `playsinline` and no autoplay under reduced motion.

## Visual and interaction requirements

- Use the Afterframe tokens, fonts and components from SRS Section 6 so the landing page and the app feel like one product. Dark default with a full light theme.
- Generous whitespace, one idea per viewport on desktop, large type hierarchy, and consistent vertical rhythm. Define a spacing scale for sections and use it everywhere.
- Motion: scroll-triggered fade/translate reveals (short, once), hero window entrance, masked-text effect, hover states on cards and buttons. All disabled or simplified under `prefers-reduced-motion`. No scroll-jacking and no autoplaying loops.
- Responsive from 320 px to 1920 px: define explicit changes at each breakpoint (hero mockup scales or crops, cards stack, nav collapses).
- Accessibility to WCAG 2.2 AA: semantic landmarks and headings, skip link, focus order, contrast in both themes, 44 px touch targets, meaningful `alt` text, keyboard operable menu.
- Performance budgets to measure and report: LCP under 2.5 s on a throttled mid-range phone, initial JavaScript under 170 KB compressed, no layout shift from media, fonts subset and preloaded.
- SEO: title, description, canonical, Open Graph and Twitter tags with an OG image placeholder, `sitemap.xml`, `robots.txt`, structured data for the product only where accurate.
- Analytics: none by default. If I later want analytics, add a consent-aware, privacy-respecting option behind a flag.

## Content rules

- Keep all marketing copy in one content module (`content/landing.ts` or similar) so I can edit text without touching components.
- Copy must be honest and specific. Do not claim support for platforms or features that are disabled (for example, automatic Instagram Reel fetching). Do not invent testimonials, user counts, logos, awards or press.
- Write original copy. Do not paraphrase the reference site's wording closely.

## Process and verification

1. Write `docs/landing-reference-analysis.md` first and show me a one-page plan before coding. Wait for my approval only if something in the plan conflicts with the rules above.
2. Build mobile first, then widen. Commit in small steps.
3. Verify with typecheck, lint, unit tests for the login states, Playwright tests for the main flows (landing renders, Log in navigates to `/login`, email-link form validation, Google button present, signed-in redirects), an automated accessibility check, and Lighthouse or equivalent for performance and SEO. Report real numbers and anything you could not run.
4. Produce screenshots of each section at 390, 768 and 1440 px in both themes under `docs/landing-screenshots/`.
5. Finish with a report: what was built, the media slot list, the `[VERIFY]` items needing my decision, and any places where you deliberately departed from the reference structure to avoid copying its expression.

## Stop and ask me if

- a section would need a claim we cannot substantiate;
- matching the reference structure would require copying protected expression;
- the route changes conflict with existing app routes;
- a dependency has an unclear or restrictive license (permissive MIT/Apache-2.0/ISC/BSD only, and record each in `docs/dependencies.md`).
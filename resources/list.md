# Afterframe Visual Assets & Component Requirements

This document specifies all visual assets, media files, icon packs, component codes, and typography files needed to replace placeholders and deliver a production-grade visual experience for Afterframe.

Drop all supplied files directly into the corresponding subdirectories inside `resources/`.

---

## 1. Directory Structure

Organize incoming assets within `resources/` as follows:

```text
resources/
├── brand/               # Logos, wordmarks, favicons, social preview cards
├── video/               # MP4/WebM video captures and animated loops
├── images/              # High-resolution screenshots, mockups, and thumbnails
├── illustrations/       # Vector diagrams, pipeline schematics, and trust graphics
├── lottie/              # Micro-interaction Lottie animations (.json)
├── icons/               # Tech stack, provider, and export target vector logos
├── components/          # Standalone React component code files (.tsx, .css)
└── fonts/               # Self-hosted WOFF2 font files
```

---

## 2. Brand Identity & Logos (`resources/brand/`)

All logo vectors must have a **transparent background** so they blend into navbar and footer surfaces.

### Orientation & Specifications Summary

| Filename | Format | Orientation | Target Dimensions | Aspect Ratio | Visual Description & Color Breakdown |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `logo-wordmark-dark.svg` | SVG | **Horizontal (Landscape)** | 240 × 48 px (viewBox: `0 0 240 48`) | 5:1 | **For Dark Mode navigation bars and footers.**<br>• Layout: Icon on the left + text on the right.<br>• Icon: 14 × 14 px projector amber square (`#F0B35A`) with subtle rounded corners (`rx="3"`).<br>• Text: "Afterframe" rendered in *Instrument Serif* font, light cream (`#ECEAE4`), 32px font size, vertically centered.<br>• Background: Transparent. |
| `logo-wordmark-light.svg` | SVG | **Horizontal (Landscape)** | 240 × 48 px (viewBox: `0 0 240 48`) | 5:1 | **For Light Mode navigation bars and footers.**<br>• Layout: Same as above, but with dark text.<br>• Icon: Projector amber square (`#F0B35A`) or dark charcoal (`#15181C`).<br>• Text: "Afterframe" rendered in dark charcoal (`#15181C`), 32px font size.<br>• Background: Transparent. |
| `logo-mark.svg` | SVG | **Square (1:1)** | 64 × 64 px (viewBox: `0 0 64 64`) | 1:1 | **Standalone app icon / favicon / mobile drawer.**<br>• Anatomy: Stylized camera viewfinder corner brackets surrounding a central glowing amber focal square (`#F0B35A`).<br>• Lines: Clean hairline strokes (`2px` stroke width) in white (`#ECEAE4`) or amber.<br>• Background: Transparent. |
| `favicon.ico` | ICO | **Square (1:1)** | Multi-size (16×16, 32×32, 48×48 px) | 1:1 | Standard browser tab favicon containing the `logo-mark` aperture on a dark background. |
| `apple-touch-icon.png` | PNG | **Square (1:1)** | 180 × 180 px | 1:1 | iOS home screen bookmark icon with solid dark background (`#15181C`) and rounded amber aperture in the center. |
| `icon-192.png` | PNG | **Square (1:1)** | 192 × 192 px | 1:1 | Android / PWA mobile launcher icon on dark background (`#15181C`). |
| `icon-512.png` | PNG | **Square (1:1)** | 512 × 512 px | 1:1 | High-density splash screen icon for PWA installation on dark background (`#15181C`). |
| `og-image.png` | PNG/WebP | **Horizontal (Landscape)** | 1200 × 630 px | 1.91:1 | **Open Graph social share card for Twitter, LinkedIn, and Discord.**<br>• Background: Dark graphite (`#15181C`) with a subtle radial amber light bloom emanating from top center.<br>• Headline: "Keep what matters from a short video." in *Instrument Serif* (~64px).<br>• Subhead: "Turn YouTube Shorts into structured tasks and reusable AI skills." in *Schibsted Grotesk* (~28px).<br>• Artwork: Centered perspective floating preview card showing an extracted task checklist with cyan/amber provenance chips. |
| `twitter-card.png` | PNG/WebP | **Horizontal (Landscape)** | 1200 × 600 px | 2:1 | Twitter summary large image card, structured similarly to `og-image.png`. |

---

## 3. Video Assets & Looping Screen Captures (`resources/video/`)

All videos should be encoded in **MP4 (H.264 / AAC)** and **WebM (VP9)**. Keep files silent (no audio tracks) and between 6 and 14 seconds in length.

| Filename | Orientation | Dimensions | Aspect Ratio | Detailed Scene Description |
| :--- | :--- | :--- | :--- | :--- |
| `hero-viewport-preview.mp4`<br>`hero-viewport-preview.webm` | **Horizontal (Landscape)** | 1920 × 1080 px | 16:9 | **Hero Section Main Product Video:**<br>1. Begins with a YouTube Short URL being pasted into the search bar (`0:00 - 0:02`).<br>2. The interface zooms into the Dual-Pane Ingestion Console (`0:03 - 0:06`).<br>3. An audio waveform scrolls along the timeline while optical OCR bounding boxes highlight on video frames (`0:07 - 0:10`).<br>4. A clean, structured Markdown task checklist populates on the right pane with clickable provenance chips (`0:11 - 0:14`). |
| `cap-temporal-scrub.mp4`<br>`cap-temporal-scrub.webm` | **Horizontal (Landscape)** | 1200 × 750 px | 16:10 | **Capabilities: Timeline Scrubbing Demo:**<br>• Demonstrates scrubbing across a 60-second video timeline with instantaneous frame previews and synchronized transcript lines snapping to the current playhead cursor. |
| `cap-multimodal-indexing.mp4`<br>`cap-multimodal-indexing.webm` | **Horizontal (Landscape)** | 1200 × 750 px | 16:10 | **Capabilities: Multimodal OCR & Extraction:**<br>• Shows computer vision bounding boxes locking onto terminal commands, code snippets, and whiteboard notes inside a video frame, converting them into structured text. |
| `cap-actionable-artifacts.mp4`<br>`cap-actionable-artifacts.webm` | **Horizontal (Landscape)** | 1200 × 750 px | 16:10 | **Capabilities: Actionable Task & Skill Export:**<br>• Demonstrates reviewing an extracted candidate checklist, checking off a completed item, and clicking "Export to Google Tasks" and "Download Markdown". |

---

## 4. High-Resolution Screenshots & Mockups (`resources/images/`)

Export images in **WebP** or **PNG** at 2x resolution.

| Filename | Orientation | Dimensions | Aspect Ratio | Detailed Visual Description |
| :--- | :--- | :--- | :--- | :--- |
| `hero-card-1.webp` | **Horizontal (Landscape)** | 720 × 404 px | 16:9 | **Hero Sample Card 1:**<br>• A high-resolution video thumbnail of a coding tutorial: a dark terminal or VS Code window displaying Python decorator syntax (`@contextmanager`), with a duration badge `0:45`. |
| `hero-card-2.webp` | **Horizontal (Landscape)** | 720 × 404 px | 16:9 | **Hero Sample Card 2:**<br>• A high-resolution video thumbnail of a technical culinary process: sourdough loaf cross-section showing gluten crumb development, with duration badge `0:58`. |
| `hero-card-3.webp` | **Horizontal (Landscape)** | 720 × 404 px | 16:9 | **Hero Sample Card 3:**<br>• A high-resolution video thumbnail of a DevOps workflow: Docker multi-stage build terminal command output showing image reduction from 1.2GB to 85MB. |
| `evidence-review-pane.webp` | **Horizontal (Landscape)** | 1920 × 1200 px | 16:10 | **Section 5 Evidence Check Screenshot:**<br>• Screenshot of the Review Screen showing the split-pane draft: editable task instructions on the left and the grounded evidence drawer on the right with active provenance chips (`Transcript`, `Frame`, `Inferred`, `Edited`). |
| `library-list-view.webp` | **Horizontal (Landscape)** | 1920 × 1080 px | 16:9 | **Section 6 Library Screenshot (List View):**<br>• Screenshot of the Library screen showing table/list rows, topic pills (`#coding`, `#devops`, `#cooking`), search input, and filter controls. |
| `library-atlas-view.webp` | **Horizontal (Landscape)** | 1920 × 1080 px | 16:9 | **Section 6 Library Screenshot (Spatial Atlas):**<br>• Screenshot of the 2D Atlas knowledge graph showing cluster nodes connected by glowing hairline edges, grouped around semantic topic hubs. |
| `closing-hud-preview.webp` | **Horizontal (Landscape)** | 1920 × 1080 px | 16:9 | **Section 9 Closing CTA Background:**<br>• Sleek dark desktop environment with a glowing Afterframe capture HUD floating in the center. |

---

## 5. Vector Schematics & Technical Illustrations (`resources/illustrations/`)

All vector illustrations must use **transparent backgrounds**, hairline strokes (`1px` or `1.5px`), monospace text labels, and Afterframe colors (`#F0B35A`, `#ECEAE4`, `#7CC4D2`, `#B9A6E8`).

| Filename | Orientation | Dimensions | Aspect Ratio | Detailed Anatomical Description |
| :--- | :--- | :--- | :--- | :--- |
| `chip-transcript.svg` | **Horizontal (Landscape)** | 800 × 500 px | 16:10 | **Transcript Provenance Micro-Sample:**<br>• Visualizes audio transcript ground-truth.<br>• Shows an audio waveform in cyan (`#7CC4D2`), millisecond timecode brackets `[00:14.220 - 00:18.500]`, and a speech bubble showing extracted spoken text. |
| `chip-frame.svg` | **Horizontal (Landscape)** | 800 × 500 px | 16:10 | **Video Frame OCR Micro-Sample:**<br>• Visualizes optical ground-truth.<br>• Shows an optical zoom viewfinder loupe over a high-res video frame, highlighting code characters with purple OCR bounding box corners (`#B9A6E8`). |
| `chip-inferred.svg` | **Horizontal (Landscape)** | 800 × 500 px | 16:10 | **Model Reasoning Micro-Sample:**<br>• Visualizes AI reasoning synthesis.<br>• Shows a flowchart branching from raw transcript text into structured task steps with an amber confidence score badge (`98.4% Confidence`). |
| `chip-edited.svg` | **Horizontal (Landscape)** | 800 × 500 px | 16:10 | **Human Revisions Micro-Sample:**<br>• Visualizes user auditability.<br>• Shows a clean diff viewer with green additions (`+`), strikethrough deletions (`-`), and a human author badge (`Edited by Sujal · 2m ago`). |
| `trust-confirm-everything.svg` | **Horizontal (Landscape)** | 800 × 450 px | 16:9 | **Trust Block: Human Confirmation Barrier:**<br>• Isometric or flat schematic showing a security checkpoint. Candidate data cannot enter persistent database storage without an explicit user approval check. |
| `trust-nothing-saved.svg` | **Horizontal (Landscape)** | 800 × 450 px | 16:9 | **Trust Block: Zero Background Scrapers:**<br>• Diagram showing sandboxed local execution and zero remote background scraping or telemetry tracking. |
| `trust-honest-limits.svg` | **Horizontal (Landscape)** | 800 × 450 px | 16:9 | **Trust Block: Verified vs Inferred Distinction:**<br>• Two-column comparative schematic contrasting ground-truth citations against model inference assumptions. |
| `banner-export-pipeline.svg` | **Horizontal (Landscape)** | 1600 × 600 px | 8:3 (Wide) | **Trust Wide Banner Architecture Diagram:**<br>• Full architectural flow from left to right: (1) Video URL Input → (2) Dual-Engine Audio & Optical Indexer → (3) Human Review & Edit → (4) Multi-Format Export (Google Tasks, Markdown, JSON-LD, Agent Skills). |
| `dashboard-provenance-diagram.svg` | **Horizontal (Landscape)** | 1200 × 400 px | 3:1 (Wide) | **Dashboard Spatial Provenance Spectrum:**<br>• Segmented visual bar comparing the 4 provenance tiers: 42% Audio Transcript, 28% Visual Frame OCR, 18% Model Reasoning, and 12% Human Confirmed. |
| `dashboard-topic-radar.svg` | **Square (1:1)** | 800 × 800 px | 1:1 | **Dashboard Topic Gravity Radar:**<br>• Circular radar chart showing semantic knowledge clusters (Coding, DevOps, Architecture, Cooking, Design) with node sizes weighted by artifact count. |
| `privacy-zero-retention.svg` | **Horizontal (Landscape)** | 480 × 360 px | 4:3 | **Privacy Block: Ephemeral Purge:**<br>• Diagram showing temporary video chunks and extracted frames deleted from disk immediately upon candidate confirmation. |
| `privacy-local-draft.svg` | **Horizontal (Landscape)** | 480 × 360 px | 4:3 | **Privacy Block: Local Storage Isolation:**<br>• Diagram showing active drafts stored locally in browser IndexedDB with zero cloud transmission. |
| `privacy-export-purge.svg` | **Horizontal (Landscape)** | 480 × 360 px | 4:3 | **Privacy Block: 1-Click Wipe:**<br>• Iconography showing full JSON data export and permanent account wipe action. |
| `privacy-byo-keys.svg` | **Horizontal (Landscape)** | 480 × 360 px | 4:3 | **Privacy Block: Direct BYO Keys:**<br>• Schematic showing user API keys connecting directly to Gemini and Claude endpoints without intermediate proxy servers. |

---

## 6. Lottie Micro-Animations (`resources/lottie/`)

Supplied Lottie `.json` files will be mounted into interactive hover states and loading indicators. All animations should be smooth, lightweight (< 100KB), and use transparent backgrounds.

| Filename | Orientation | Dimensions | Intended Visual Motion |
| :--- | :--- | :--- | :--- |
| `viewfinder-target.json` | **Square (1:1)** | 200 × 200 px | Corner brackets smoothly expanding and snapping inwards to lock focus on the center. |
| `waveform-analyzer.json` | **Horizontal (Landscape)** | 300 × 80 px | 16-bar audio frequency spectrum dancing smoothly with soft amber and cyan highlights. |
| `optical-scan.json` | **Horizontal (Landscape)** | 400 × 250 px | A thin horizontal laser scanning line sweeping vertically across a video frame. |
| `vault-lock.json` | **Square (1:1)** | 160 × 160 px | A clean geometric padlock body clicking shut and emitting a warm amber pulse ring. |
| `success-check.json` | **Square (1:1)** | 120 × 120 px | A minimalist checkmark drawing itself inside an amber circular badge. |

---

## 7. Tech Stack & Platform Vector Icons (`resources/icons/`)

Monochrome SVG icons (viewBox `0 0 24 24`) that adapt dynamically via CSS `currentColor`.

| Category | Filenames | Orientation | Usage Location |
| :--- | :--- | :--- | :--- |
| **AI Models** | `gemini.svg`, `anthropic.svg`, `openai.svg`, `ollama.svg` | **Square (1:1)** | Model selector pills in Settings and Studio. |
| **Video Platforms** | `youtube.svg`, `tiktok.svg`, `instagram.svg`, `vimeo.svg` | **Square (1:1)** | Supported video source badges in Hero and Studio. |
| **Export Targets** | `google-tasks.svg`, `notion.svg`, `obsidian.svg`, `github.svg`, `linear.svg` | **Square (1:1)** | Export dropdown menu items. |
| **Operating Systems** | `apple.svg`, `windows.svg`, `linux.svg` | **Square (1:1)** | Platform compatibility pills in footer and CTA. |

---

## 8. Ready-Made Component Codes (`resources/components/`)

If you have pre-built React components or UI snippets, place them here:

1. **Interactive Spatial Knowledge Graph (`AtlasGraph.tsx`)**:
   - Force-directed graph component (Canvas or SVG) visualizing semantic links between video sources, topics, and tasks.
2. **Projector Ambient Beam Canvas (`ProjectorGlowCanvas.tsx`)**:
   - Lightweight HTML5 Canvas component that renders subtle amber projector rays and micro-particles in the background.
3. **Interactive Timecode Scrubber (`TimelineScrubber.tsx`)**:
   - Scrubbing bar component with frame thumbnail preview loupe, playback rate selector, and keyframe markers.
4. **Interactive Masked Text Reveal (`MaskedTextReveal.tsx`)**:
   - Scroll-driven text illumination component for the Privacy section heading.
5. **Real-Time Spectral Audio Visualizer (`SpectralAudioVisualizer.tsx`)**:
   - Canvas/Web Audio API multi-bar visualizer that pulses during video playback and transcription.

---

## 9. Typography & Web Fonts (`resources/fonts/`)

To eliminate Google Fonts CDN latency and ensure 100% offline reliability, provide self-hosted WOFF2 font files:

| Font Family | Filenames | Weights & Styles |
| :--- | :--- | :--- |
| **Instrument Serif** | `InstrumentSerif-Regular.woff2`<br>`InstrumentSerif-Italic.woff2` | Regular 400, Italic 400 |
| **Schibsted Grotesk** | `SchibstedGrotesk-Regular.woff2`<br>`SchibstedGrotesk-Medium.woff2`<br>`SchibstedGrotesk-SemiBold.woff2`<br>`SchibstedGrotesk-Bold.woff2` | Regular 400, Medium 500, SemiBold 600, Bold 700 |
| **JetBrains Mono** | `JetBrainsMono-Regular.woff2`<br>`JetBrainsMono-Medium.woff2` | Regular 400, Medium 500 |

---

## 10. Categorical Asset Checklist

Use this checklist to track assets as you collect and drop them into `resources/`.

### Category A: Brand Identity & Logos (`resources/brand/`)
- [x] `logo.svg` (Provided & integrated: 2752 × 1536 px full vector brand art in navbar, instrument header, mockup, wide banner, and footer)
- [ ] `logo-wordmark-dark.svg` (Horizontal, 240 × 48 px, cream text on transparent)
- [ ] `logo-wordmark-light.svg` (Horizontal, 240 × 48 px, dark text on transparent)
- [ ] `logo-mark.svg` (Square, 64 × 64 px, viewfinder brackets with amber square)
- [ ] `favicon.ico` (Square, 16/32/48 px multi-size browser favicon)
- [ ] `apple-touch-icon.png` (Square, 180 × 180 px iOS bookmark icon)
- [ ] `icon-192.png` (Square, 192 × 192 px Android launcher icon)
- [ ] `icon-512.png` (Square, 512 × 512 px PWA splash screen icon)
- [ ] `og-image.png` (Horizontal 1.91:1, 1200 × 630 px social share card)
- [ ] `twitter-card.png` (Horizontal 2:1, 1200 × 600 px Twitter summary card)

### Category B: Video Demos (`resources/video/`)
- [ ] `hero-viewport-preview.mp4` & `.webm` (Horizontal 16:9, 1920 × 1080 px, main product flow)
- [ ] `cap-temporal-scrub.mp4` & `.webm` (Horizontal 16:10, 1200 × 750 px, scrubber demo)
- [ ] `cap-multimodal-indexing.mp4` & `.webm` (Horizontal 16:10, 1200 × 750 px, OCR bounding boxes)
- [ ] `cap-actionable-artifacts.mp4` & `.webm` (Horizontal 16:10, 1200 × 750 px, checklist export)

### Category C: High-Resolution Mockups & Screenshots (`resources/images/`)
- [ ] `hero-card-1.webp` (Horizontal 16:9, 720 × 404 px, Python decorator video still)
- [ ] `hero-card-2.webp` (Horizontal 16:9, 720 × 404 px, sourdough crumb video still)
- [ ] `hero-card-3.webp` (Horizontal 16:9, 720 × 404 px, Docker multi-stage build video still)
- [ ] `evidence-review-pane.webp` (Horizontal 16:10, 1920 × 1200 px, split-pane review screen)
- [ ] `library-list-view.webp` (Horizontal 16:9, 1920 × 1080 px, library table list view)
- [ ] `library-atlas-view.webp` (Horizontal 16:9, 1920 × 1080 px, 2D spatial atlas graph)
- [ ] `closing-hud-preview.webp` (Horizontal 16:9, 1920 × 1080 px, floating capture HUD)

### Category D: Vector Schematics & Diagrams (`resources/illustrations/`)
- [ ] `chip-transcript.svg` (Horizontal 16:10, 800 × 500 px, audio waveform snippet)
- [ ] `chip-frame.svg` (Horizontal 16:10, 800 × 500 px, optical frame OCR loupe)
- [ ] `chip-inferred.svg` (Horizontal 16:10, 800 × 500 px, model reasoning confidence)
- [ ] `chip-edited.svg` (Horizontal 16:10, 800 × 500 px, author revision diff)
- [ ] `trust-confirm-everything.svg` (Horizontal 16:9, 800 × 450 px, gatekeeper checkpoint)
- [ ] `trust-nothing-saved.svg` (Horizontal 16:9, 800 × 450 px, memory sandbox isolation)
- [ ] `trust-honest-limits.svg` (Horizontal 16:9, 800 × 450 px, ground truth vs inferred comparison)
- [ ] `banner-export-pipeline.svg` (Horizontal 8:3 wide, 1600 × 600 px, end-to-end architecture)
- [ ] `dashboard-provenance-diagram.svg` (Horizontal 3:1 wide, 1200 × 400 px, 4-tier spectrum)
- [ ] `dashboard-topic-radar.svg` (Square 1:1, 800 × 800 px, topic gravity radar)
- [ ] `privacy-zero-retention.svg` (Horizontal 4:3, 480 × 360 px, ephemeral disk purge)
- [ ] `privacy-local-draft.svg` (Horizontal 4:3, 480 × 360 px, browser IndexedDB encryption)
- [ ] `privacy-export-purge.svg` (Horizontal 4:3, 480 × 360 px, one-click wipe action)
- [ ] `privacy-byo-keys.svg` (Horizontal 4:3, 480 × 360 px, direct BYO API key connection)

### Category E: Lottie Micro-Animations (`resources/lottie/`)
- [ ] `viewfinder-target.json` (Square, 200 × 200 px, corner brackets locking focus)
- [ ] `waveform-analyzer.json` (Horizontal, 300 × 80 px, 16-bar spectral frequency animation)
- [ ] `optical-scan.json` (Horizontal, 400 × 250 px, vertical laser scan line)
- [ ] `vault-lock.json` (Square, 160 × 160 px, geometric padlock latching with amber glow)
- [ ] `success-check.json` (Square, 120 × 120 px, animated circular checkmark)

### Category F: Tech Stack & Platform Icons (`resources/icons/`)
- [x] `gemini.svg` (Integrated into Multimodal Vision telemetry)
- [x] `claude.svg` (Integrated into Multimodal Vision telemetry & Claude Code export)
- [x] `openai.svg` (Integrated into Reasoning Model telemetry)
- [x] `ollama.svg` (Integrated into Local Model telemetry)
- [x] `youtube.svg` (Integrated into Mockup URL input, Studio source pills, and Quick-Try presets)
- [x] `tiktok.svg` (Integrated into Mockup and Studio source indicators)
- [x] `instagram.svg` (Integrated into Mockup and Studio source indicators)
- [ ] `vimeo.svg` (Square 1:1, monochrome vector)
- [x] `google-tasks.svg` (Integrated into Wide Banner export grid & Dashboard export ecosystem)
- [x] `notion.svg` (Integrated into Wide Banner export grid & Dashboard export ecosystem)
- [x] `obsidian.svg` (Integrated into Wide Banner export grid & Dashboard export ecosystem)
- [x] `github.svg` (Integrated into Wide Banner export grid & Dashboard export ecosystem)
- [x] `linear.svg` (Integrated into Wide Banner export grid & Dashboard export ecosystem)
- [x] `apple.svg` (Integrated into Closing CTA desktop availability strip)
- [x] `windows.svg` (Integrated into Closing CTA desktop availability strip)
- [x] `linux.svg` (Integrated into Closing CTA desktop availability strip)

### Category G: Ready-Made Component Codes (`resources/components/`)
- [x] `vapor-ribbons.tsx` (Vapor Ribbons WebGL animated atmospheric background, mounted in `app/components/backgrounds/effects/vapor-ribbons.tsx` behind Landing Hero)
- [ ] `AtlasGraph.tsx` (Interactive force-directed knowledge graph)
- [ ] `ProjectorGlowCanvas.tsx` (Ambient amber projector ray particle canvas)
- [ ] `TimelineScrubber.tsx` (Timecode scrubber with frame preview loupe)
- [ ] `MaskedTextReveal.tsx` (Proximity text illumination component)
- [ ] `SpectralAudioVisualizer.tsx` (Real-time Web Audio frequency bars)

### Category H: Self-Hosted Web Fonts (`resources/fonts/`)
- [x] `InstrumentSerif-Regular.ttf` & `InstrumentSerif-Italic.ttf` (Provided & mounted in `public/fonts/`)
- [x] `SchibstedGrotesk-VariableFont_wght.ttf` & `SchibstedGrotesk-Italic-VariableFont_wght.ttf` (Provided & mounted in `public/fonts/`)
- [x] `JetBrainsMono-VariableFont_wght.ttf` & `JetBrainsMono-Italic-VariableFont_wght.ttf` (Provided & mounted in `public/fonts/`)


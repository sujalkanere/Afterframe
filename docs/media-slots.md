# Afterframe Media Slots Registry

This document catalogues every media slot on the Afterframe marketing site. Each slot uses the `MediaPlaceholder` component until production media assets are supplied. Replacing any placeholder with a real production asset requires changing only one file URL or slot entry in `src/client/content/landing.ts`.

---

## Media Slots Inventory

| Slot ID | Page & Section | Aspect Ratio | Target Dimensions | Variant | Light / Dark Variant | Intended Content & Description |
|---|---|---|---|---|---|---|
| `hero-app-mockup` | Landing: Hero (Section 2) | 16:10 | 1280 × 800 px | `illustration` | Yes (Theme-aware UI tokens) | Interactive mockup of the Afterframe application window showing sidebar (Capture, Library, Topics), URL extraction input with active frame brackets, and three recent cards. |
| `hero-card-1` | Landing: Hero App Window | 16:9 | 360 × 202 px | `image` | Neutral | Thumbnail placeholder for recent Short candidate: "Quick Python decorator pattern". |
| `hero-card-2` | Landing: Hero App Window | 16:9 | 360 × 202 px | `image` | Neutral | Thumbnail placeholder for recent Short candidate: "Sourdough hydration technique". |
| `hero-card-3` | Landing: Hero App Window | 16:9 | 360 × 202 px | `image` | Neutral | Thumbnail placeholder for recent Short candidate: "Docker multi-stage build optimization". |
| `cap-paste-link` | Landing: Capabilities (Section 4) | 4:3 | 480 × 360 px | `illustration` | Yes | Viewfinder brackets locking onto a pasted mobile video link with URL badge. |
| `cap-review-keep` | Landing: Capabilities (Section 4) | 4:3 | 480 × 360 px | `illustration` | Yes | Human review step interface highlighting candidate task checklist with Keep and Discard controls. |
| `cap-evidence-step` | Landing: Capabilities (Section 4) | 4:3 | 480 × 360 px | `illustration` | Yes | Step citation connecting task step directly to timestamped transcript and video frame evidence. |
| `evidence-review-pane` | Landing: Evidence Check (Section 5) | 16:10 | 960 × 600 px | `image` | Yes | High-fidelity screenshot of the Review Screen showing the split-pane draft and evidence drawer with active provenance chips (`Transcript`, `Frame`, `Inferred`, `Edited`). |
| `library-list-view` | Landing: Library Block (Section 6) | 16:9 | 640 × 360 px | `image` | Yes | Screenshot of the organized Library list view with type filters, topic tags, and search bar. |
| `library-atlas-view` | Landing: Library Block (Section 6) | 16:9 | 640 × 360 px | `image` | Yes | Spatial 2D Atlas visualization depicting cluster relationships between sources, topics, tasks, and AI skills. |
| `trust-confirm-everything` | Landing: Trust Block (Section 7) | 16:9 | 400 × 225 px | `illustration` | Yes | Visual representation of user confirmation barrier before anything enters database storage. |
| `trust-nothing-saved` | Landing: Trust Block (Section 7) | 16:9 | 400 × 225 px | `illustration` | Yes | Visual showing zero background scrapers and no auto-committing without human approval. |
| `trust-honest-limits` | Landing: Trust Block (Section 7) | 16:9 | 400 × 225 px | `illustration` | Yes | Visual showing explicit distinction between verified transcript segments and inferred model steps. |
| `banner-export-preview` | Landing: Trust Wide Banner (Section 7) | 16:9 | 560 × 315 px | `illustration` | Yes | Illustration showing export to Google Tasks and AI skill prompt packaging (.md / schema files). |
| `privacy-zero-retention` | Landing: Privacy Block (Section 8) | 4:3 | 360 × 270 px | `illustration` | Yes | Diagram showing temporary video clips and audio streams purged immediately upon extraction. |
| `privacy-local-draft` | Landing: Privacy Block (Section 8) | 4:3 | 360 × 270 px | `illustration` | Yes | Local browser storage indicator securing active review edits without remote tracking. |
| `privacy-export-purge` | Landing: Privacy Block (Section 8) | 4:3 | 360 × 270 px | `illustration` | Yes | One-click JSON data export and permanent account deletion button with immediate database purge. |
| `privacy-byo-keys` | Landing: Privacy Block (Section 8) | 4:3 | 360 × 270 px | `illustration` | Yes | Direct user-configured LLM provider keys and local model fallback options. |

---

## Technical Integration Rules

1. **Aspect Ratio Enforcement:** All placeholder containers apply `aspect-ratio: <ratio>` directly in CSS to prevent layout shift (CLS budget = 0).
2. **One-Line Asset Swapping:** To replace a placeholder with a production asset, pass `src="/path/to/asset.webp"` and `alt="..."` to the `MediaPlaceholder` call for that slot ID.
3. **Responsive Images:** Future production images should be provided in WebP or AVIF format at 1x and 2x resolution.
4. **Video Placeholders:** Video variants display an accessible play badge with the label. Real videos will use `poster`, `muted`, `playsinline`, and will strictly honor `prefers-reduced-motion` with no autoplaying loops.

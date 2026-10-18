/**
 * Afterframe Marketing Site Content
 * Central content registry for the landing page and public marketing shell.
 * Items requiring legal, product, or partner confirmation are marked [VERIFY].
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface CapabilityCard {
  iconName: 'Link' | 'CheckSquare' | 'FileCheck';
  title: string;
  description: string;
  slotId: string;
}

export interface TrustCard {
  title: string;
  description: string;
  slotId: string;
}

export interface PrivacyCard {
  title: string;
  description: string;
  slotId: string;
  badge?: string;
}

export interface FooterColumn {
  title: string;
  links: Array<{
    label: string;
    href: string;
    isExternal?: boolean;
    needsVerification?: boolean;
  }>;
}

export const landingContent = {
  meta: {
    title: 'Afterframe — Turn Short Videos into Structured Tasks and AI Skills',
    description:
      'Extract actionable tasks and AI skill packages from YouTube Shorts with verifiable frame and transcript evidence. Human-reviewed and local by default.',
    canonicalUrl: 'https://afterframe.app/',
    ogImageSlot: 'og-image-preview',
  },

  navigation: {
    logoLabel: 'Afterframe',
    links: [
      { label: 'Capabilities', href: '#capabilities' },
      { label: 'Evidence', href: '#evidence' },
      { label: 'Library', href: '#library' },
      { label: 'Trust & Privacy', href: '#privacy' },
    ] as NavLink[],
    ctaLoggedIn: 'Open app',
    ctaLoggedOut: 'Log in',
    tryGuestLabel: 'Try guest extraction',
  },

  hero: {
    badge: 'Spatial Knowledge Instrument',
    headlineLead: 'Turn short-form video into actionable knowledge.',
    headlineMuted: 'With evidence for every single step.',
    subheadline:
      'Afterframe transforms YouTube Shorts into structured, human-reviewed tasks and AI skills. Every claim links to an exact frame or transcript line.',
    ctaPrimary: 'Log in',
    ctaLoggedIn: 'Open app',
    ctaSecondary: 'See how it works',
    ctaSecondaryHref: '#capabilities',
    windowMockup: {
      urlBarPlaceholder: 'https://youtube.com/shorts/...',
      extractButtonLabel: 'Extract',
      sidebarNav: [
        { label: 'Capture', active: true },
        { label: 'Library', count: 12 },
        { label: 'Topics', count: 4 },
      ],
      recentTitle: 'Recently extracted',
      recentCards: [
        {
          id: 'hero-card-1',
          title: 'FastAPI dependency injection pattern',
          type: 'AI skill',
          source: 'YouTube Short',
          evidenceCount: 4,
        },
        {
          id: 'hero-card-2',
          title: 'Precision bread scoring angle',
          type: 'Task',
          source: 'YouTube Short',
          evidenceCount: 3,
        },
        {
          id: 'hero-card-3',
          title: 'Multi-stage Docker caching setup',
          type: 'AI skill',
          source: 'YouTube Short',
          evidenceCount: 5,
        },
      ],
    },
  },

  intro: {
    eyebrow: 'Why Afterframe',
    eyebrowHref: '#capabilities',
    problem:
      'Saving ideas from short videos is broken. You bookmark dozens of Reels and Shorts into infinite feeds, never review them, and lose the specific recipe, command, or nuance that made the clip useful.',
    solution:
      'Afterframe extracts the real substance. It parses spoken transcripts and key visual frames, drafts structured checklists or skill specs, and leaves you in total control to review, edit, and keep.',
  },

  capabilities: {
    eyebrow: 'Capabilities',
    heading: 'A disciplined pipeline from frame to artifact',
    subheading:
      'Designed for researchers, builders, and learners who want durable notes instead of forgotten bookmarks.',
    cards: [
      {
        iconName: 'Link',
        title: 'Paste any link',
        description:
          'Submit a supported video URL or paste a transcript directly. Extraction starts immediately with honest pipeline status.',
        slotId: 'cap-paste-link',
      },
      {
        iconName: 'CheckSquare',
        title: 'Review before you keep',
        description:
          'Nothing enters your library automatically. Inspect the draft task or AI skill in a clean two-column review workspace.',
        slotId: 'cap-review-keep',
      },
      {
        iconName: 'FileCheck',
        title: 'Evidence on every step',
        description:
          'Every step cites exact timestamped transcript lines or captured video frames so you can audit the source at any time.',
        slotId: 'cap-evidence-step',
      },
    ] as CapabilityCard[],
  },

  evidenceSection: {
    eyebrow: 'Zero Guesswork',
    heading: 'Evidence you can check.',
    subheading:
      'No black-box summaries. Every detail is tagged by origin so you always know what was spoken, what was seen, and what was inferred.',
    chips: [
      {
        kind: 'transcript',
        label: 'Transcript 0:14',
        explanation: 'Direct spoken quote extracted from captions or audio.',
      },
      {
        kind: 'visual',
        label: 'Frame 0:22',
        explanation: 'Visual observation detected in a captured keyframe.',
      },
      {
        kind: 'inferred',
        label: 'Inferred',
        explanation:
          'Model inference supplied to bridge logical gaps, explicitly marked.',
      },
      {
        kind: 'edited',
        label: 'Edited by you',
        explanation:
          'Human-authored refinement that overrides machine output.',
      },
    ],
    reviewPlaceholder: {
      slotId: 'evidence-review-pane',
      label: 'Screenshot: Review screen with active evidence pane, 16:10',
    },
  },

  librarySection: {
    eyebrow: 'Spatial Organization',
    headingLead: 'A library that understands',
    headingAccent: 'what you are building.',
    description:
      'Your artifacts organize automatically by topic and relationship. Switch seamlessly between a high-density list and a 2D spatial Atlas graph.',
    promptChip: 'Topic: Systems Architecture • 7 artifacts connected',
    slots: {
      list: {
        slotId: 'library-list-view',
        label: 'Screenshot: Library list view with type and topic filters, 16:9',
      },
      atlas: {
        slotId: 'library-atlas-view',
        label:
          'Screenshot: Atlas spatial graph showing topic clusters and provenance links, 16:9',
      },
    },
  },

  trustSection: {
    eyebrow: 'Human in the Loop',
    heading: 'The machine drafts. You decide.',
    subheading:
      'We never silently save to your database or push data to external systems without your explicit confirmation.',
    cards: [
      {
        title: 'You confirm everything',
        description:
          'Every candidate remains in Ready for Review until you click Keep. You can reorder, edit, or discard with one click.',
        slotId: 'trust-confirm-everything',
      },
      {
        title: 'Nothing saved without you',
        description:
          'Unconfirmed candidates expire after 7 days. Your library contains only what you explicitly chose to preserve.',
        slotId: 'trust-nothing-saved',
      },
      {
        title: "Honest about what it didn't see",
        description:
          'When visual frames lack clarity or audio is muffled, Afterframe tells you rather than hallucinating details.',
        slotId: 'trust-honest-limits',
      },
    ] as TrustCard[],
    wideBanner: {
      badge: 'Integrations & Portability',
      title: 'Take your knowledge wherever you work',
      description:
        'Your knowledge is never locked into Afterframe. Export structured skill packages for Cursor, Claude, or Codex, or sync tasks to your external tools.',
      bullets: [
        {
          text: 'Send tasks to Google Tasks (coming soon)',
          note: 'Requires integration feature flag activation [VERIFY].',
        },
        {
          text: 'Export AI skills to SKILL.md and JSON formats',
          note: 'Production-ready packages ready to paste into any LLM agent context.',
        },
      ],
      slotId: 'banner-export-preview',
      slotLabel: 'Illustration: Exporting AI skill package and Google Tasks sync, 16:9',
    },
  },

  privacySection: {
    eyebrow: 'Privacy & Control',
    maskedWord: 'Private',
    maskedRevealText: 'Private enough for your actual research.',
    subheading:
      'Afterframe runs strictly within documented boundaries. We do not sell user data, train public foundation models on your notes, or retain raw video streams.',
    cards: [
      {
        title: 'Zero media retention',
        description:
          'Temporary video audio and video frames are deleted immediately after transcription and analysis finish (0 days retained).',
        slotId: 'privacy-zero-retention',
        badge: 'SRS Section 7',
      },
      {
        title: 'Local draft protection',
        description:
          'In-progress review edits save locally in your browser so network interruptions never lose your typing.',
        slotId: 'privacy-local-draft',
        badge: 'Local storage',
      },
      {
        title: 'Complete data export and purge',
        description:
          'Export all your data as structured JSON at any time. Account deletion removes all sources, evidence, and artifacts permanently.',
        slotId: 'privacy-export-purge',
        badge: 'FR-064',
      },
      {
        title: 'Transparent LLM governance',
        description:
          'Configured with strict system boundaries. Supports bring-your-own API keys with zero prompt retention on public models [VERIFY].',
        slotId: 'privacy-byo-keys',
        badge: 'Controlled',
      },
    ] as PrivacyCard[],
  },

  closingCta: {
    heading: 'Stop losing valuable ideas to the feed.',
    subheading:
      'Sign in with your email or Google account to start turning video clips into verifiable skills and tasks.',
    ctaPrimary: 'Log in',
    ctaLoggedIn: 'Open app',
    note: 'Free trial includes guest extractions with no credit card required.',
  },

  footer: {
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Capture', href: '/app' },
          { label: 'Library', href: '/library' },
          { label: 'Atlas Graph', href: '/library?view=atlas' },
          { label: 'Sign in', href: '/login' },
        ],
      },
      {
        title: 'Use Cases',
        links: [
          { label: 'Software Engineering', href: '#capabilities' },
          { label: 'Cooking & Craft', href: '#capabilities' },
          { label: 'Technical Tutorials', href: '#capabilities' },
          { label: 'Research & AI Skills', href: '#capabilities' },
        ],
      },
      {
        title: 'Resources',
        links: [
          { label: 'Documentation', href: '#capabilities' },
          { label: 'API & Schemas', href: '#capabilities' },
          {
            label: 'GitHub Repository [VERIFY]',
            href: 'https://github.com/morluto/rea',
            isExternal: true,
            needsVerification: true,
          },
        ],
      },
      {
        title: 'Legal & Security',
        links: [
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Terms of Service', href: '/terms' },
          { label: 'Data Retention Policy', href: '#privacy' },
          { label: 'Security & Access', href: '#privacy' },
        ],
      },
    ] as FooterColumn[],
    copyright: '© 2026 Afterframe. All rights reserved.',
    disclaimer:
      'All product names, logos, and brands are property of their respective owners. Afterframe is an independent tool.',
  },
};

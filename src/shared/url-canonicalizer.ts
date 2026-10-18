import type { ErrorCode, Platform } from './contracts.js';

export interface CanonicalizedSourceUrl {
  ok: true;
  platform: Platform;
  platformContentId: string;
  canonicalUrl: string;
  watchUrl?: string;
  submittedUrl: string;
  isShortsPath: boolean;
}

export interface CanonicalizationFailure {
  ok: false;
  errorCode: ErrorCode;
  message: string;
}

export type CanonicalizeResult =
  | CanonicalizedSourceUrl
  | CanonicalizationFailure;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
]);

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const INSTAGRAM_SHORTCODE_RE = /^[A-Za-z0-9_-]{5,32}$/;

/**
 * Checks if a hostname or IP literal targets loopback, private, link-local,
 * cloud metadata, or internal network addresses (NFR-021 SSRF defense).
 */
export function isPrivateOrInternalHost(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return true;

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.arpa') ||
    host === 'metadata.google.internal' ||
    host === 'instance-data'
  ) {
    return true;
  }

  // IPv6 literal in brackets [::1]
  const unwrapped = host.startsWith('[') && host.endsWith(']')
    ? host.slice(1, -1)
    : host;

  if (unwrapped.includes(':')) {
    const lowerV6 = unwrapped.toLowerCase();
    if (
      lowerV6 === '::1' ||
      lowerV6 === '::' ||
      lowerV6 === '0:0:0:0:0:0:0:1' ||
      lowerV6 === '0:0:0:0:0:0:0:0' ||
      lowerV6.startsWith('fc') ||
      lowerV6.startsWith('fd') ||
      lowerV6.startsWith('fe8') ||
      lowerV6.startsWith('fe9') ||
      lowerV6.startsWith('fea') ||
      lowerV6.startsWith('feb') ||
      lowerV6.startsWith('::ffff:')
    ) {
      return true;
    }
    return true; // Disallow raw IPv6 literals for video platform URLs
  }

  // Check IPv4 numeric / dotted quad / integer representations
  if (/^\d+$/.test(unwrapped) || /^0x[0-9a-f]+$/i.test(unwrapped)) {
    return true;
  }

  const ipv4Match = unwrapped.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map((n) => Number(n));
    if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
      return true;
    }
    const [a, b] = octets;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    ) {
      return true;
    }
    // Disallow raw IPv4 literals for platform URLs
    return true;
  }

  return false;
}

/**
 * Platform-aware URL parser and canonicalizer (Section 8.1, FR-002, FR-003, FR-006, NFR-021).
 */
export function canonicalizeVideoUrl(rawInput: string): CanonicalizeResult {
  const submittedUrl = (rawInput ?? '').trim();
  if (!submittedUrl) {
    return {
      ok: false,
      errorCode: 'INVALID_URL',
      message: 'Paste a YouTube Short or Instagram Reel link to extract.',
    };
  }

  if (submittedUrl.length > 2048) {
    return {
      ok: false,
      errorCode: 'INVALID_URL',
      message: 'The link is too long (maximum 2048 characters).',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(submittedUrl);
  } catch {
    return {
      ok: false,
      errorCode: 'INVALID_URL',
      message:
        'That doesn’t look like a YouTube Short or Instagram Reel link. Check it and try again.',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      errorCode: 'INVALID_URL',
      message: 'Only HTTP and HTTPS video links are supported.',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      errorCode: 'SSRF_BLOCKED',
      message: 'Links containing embedded credentials are not allowed.',
    };
  }

  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    return {
      ok: false,
      errorCode: 'SSRF_BLOCKED',
      message: 'Non-standard network ports are not allowed.',
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (isPrivateOrInternalHost(host)) {
    return {
      ok: false,
      errorCode: 'SSRF_BLOCKED',
      message:
        'Private, loopback, and internal network addresses are blocked for security.',
    };
  }

  // YouTube handling
  if (YOUTUBE_HOSTS.has(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    let videoId: string | null = null;
    let isShortsPath = false;

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      if (segments.length === 1) {
        videoId = segments[0];
      } else if (segments.length === 2 && segments[0] === 'shorts') {
        videoId = segments[1];
        isShortsPath = true;
      }
    } else if (segments[0] === 'shorts' && segments.length >= 2) {
      videoId = segments[1];
      isShortsPath = true;
    } else if (segments[0] === 'watch' && segments.length === 1) {
      videoId = parsed.searchParams.get('v');
    }

    if (!videoId || !YOUTUBE_VIDEO_ID_RE.test(videoId)) {
      return {
        ok: false,
        errorCode: 'UNSUPPORTED_URL_PATTERN',
        message:
          'That YouTube link does not point to a single video or Short (expected /shorts/<11-char-id> or /watch?v=<id>). Channel and playlist links are not supported.',
      };
    }

    return {
      ok: true,
      platform: 'youtube',
      platformContentId: videoId,
      canonicalUrl: `https://www.youtube.com/shorts/${videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      submittedUrl,
      isShortsPath,
    };
  }

  // Instagram handling
  if (INSTAGRAM_HOSTS.has(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    let shortcode: string | null = null;

    if (
      segments.length >= 2 &&
      (segments[0] === 'reel' || segments[0] === 'reels' || segments[0] === 'p')
    ) {
      shortcode = segments[1];
    } else if (
      segments.length >= 3 &&
      (segments[1] === 'reel' || segments[1] === 'reels')
    ) {
      shortcode = segments[2];
    }

    if (!shortcode || !INSTAGRAM_SHORTCODE_RE.test(shortcode)) {
      return {
        ok: false,
        errorCode: 'UNSUPPORTED_URL_PATTERN',
        message:
          'That Instagram link does not point to a specific Reel (expected instagram.com/reel/<id>). Profile and story links are not supported.',
      };
    }

    return {
      ok: true,
      platform: 'instagram',
      platformContentId: shortcode,
      canonicalUrl: `https://www.instagram.com/reel/${shortcode}/`,
      submittedUrl,
      isShortsPath: false,
    };
  }

  return {
    ok: false,
    errorCode: 'UNSUPPORTED_PLATFORM',
    message:
      'That doesn’t look like a YouTube Short or Instagram Reel link. Check it and try again.',
  };
}

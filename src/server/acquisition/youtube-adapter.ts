import fs from 'node:fs';
import path from 'node:path';
import { safeFetch, SsrfBlockedError } from '../security/ssrf-guard.js';
import { sanitizeErrorDetails } from '../security/redaction.js';
import type {
  AcquiredEvidenceItem,
  SourceResolutionInput,
  SourceResolutionResult,
  SourceResolver,
  TranscriptAcquisitionResult,
  TranscriptProvider,
  TranscriptionProvider,
  VisualEvidenceProvider,
  VisualEvidenceResult,
} from './types.js';

export interface YouTubeAdapterConfig {
  baseUrl?: string;
  allowLocalTestServer?: boolean;
  timeoutMs?: number;
}

export class YouTubeShortsAdapter
  implements
    SourceResolver,
    TranscriptProvider,
    TranscriptionProvider,
    VisualEvidenceProvider
{
  readonly platform = 'youtube' as const;
  readonly providerId = 'youtube-oembed-timedtext-v1';
  private readonly config: YouTubeAdapterConfig;

  constructor(config: YouTubeAdapterConfig = {}) {
    this.config = config;
  }

  isEnabled(): boolean {
    return process.env.YOUTUBE_CONNECTOR_ENABLED !== 'false';
  }

  private getBaseUrl(): string {
    return (
      this.config.baseUrl ??
      process.env.YOUTUBE_ACQUISITION_BASE_URL ??
      'https://www.youtube.com'
    ).replace(/\/$/, '');
  }

  private isLocalAllowed(): boolean {
    if (this.config.allowLocalTestServer !== undefined) {
      return this.config.allowLocalTestServer;
    }
    const base = this.getBaseUrl();
    return (
      process.env.ALLOW_LOCAL_ACQUISITION_TEST_SERVER === 'true' &&
      (base.startsWith('http://127.0.0.1:') ||
        base.startsWith('http://localhost:'))
    );
  }

  async resolveMetadata(
    input: SourceResolutionInput
  ): Promise<SourceResolutionResult> {
    if (!this.isEnabled()) {
      return {
        ok: false,
        errorCode: 'CONNECTOR_DISABLED',
        safeErrorDetails: 'YouTube connector is disabled via configuration.',
        userMessage:
          'YouTube link retrieval is currently disabled. Paste the transcript instead.',
      };
    }

    const baseUrl = this.getBaseUrl();
    const watchUrl = `https://www.youtube.com/watch?v=${input.platformContentId}`;
    const oembedUrl = `${baseUrl}/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

    try {
      const resp = await safeFetch(oembedUrl, {
        timeoutMs: this.config.timeoutMs ?? 10000,
        allowLocalTestServer: this.isLocalAllowed(),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Afterframe/1.1 (+https://github.com/sujalkanere/Afterframe)',
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        return {
          ok: false,
          errorCode: 'ACCESS_DENIED',
          safeErrorDetails: `YouTube oEmbed returned HTTP ${resp.status}`,
          userMessage:
            'This Short is private, age-restricted, or disallowing embedding. Paste the transcript instead.',
        };
      }

      if (resp.status === 429) {
        return {
          ok: false,
          errorCode: 'PLATFORM_RATE_LIMITED',
          safeErrorDetails: 'YouTube oEmbed returned HTTP 429',
          userMessage:
            'YouTube rate-limited the request. Wait a moment and retry, or paste the transcript instead.',
        };
      }

      if (resp.status === 404 || !resp.ok) {
        return {
          ok: false,
          errorCode: 'SOURCE_UNAVAILABLE',
          safeErrorDetails: `YouTube oEmbed returned HTTP ${resp.status}`,
          userMessage:
            'This YouTube Short could not be found or is unavailable. Check the link or paste the transcript instead.',
        };
      }

      const data = (await resp.json()) as Record<string, unknown>;
      const title =
        typeof data.title === 'string' && data.title.trim()
          ? data.title.trim()
          : null;
      const authorName =
        typeof data.author_name === 'string' && data.author_name.trim()
          ? data.author_name.trim()
          : null;
      const authorUrl =
        typeof data.author_url === 'string' && data.author_url.trim()
          ? data.author_url.trim()
          : null;
      const thumbnailUrl =
        typeof data.thumbnail_url === 'string' && data.thumbnail_url.trim()
          ? data.thumbnail_url.trim()
          : null;

      const metadataItem: AcquiredEvidenceItem = {
        kind: 'metadata',
        contentText: [
          title ? `Title: ${title}` : null,
          authorName ? `Creator: ${authorName}` : null,
          `Canonical URL: ${input.canonicalUrl}`,
        ]
          .filter(Boolean)
          .join('\n'),
        contentRef: input.canonicalUrl,
        startMs: null,
        endMs: null,
        language: null,
        provenance: this.providerId,
        limitations: [
          'oEmbed metadata provides verified title and creator identity without full video description or duration.',
        ],
        metadata: {
          title,
          authorName,
          authorUrl,
          thumbnailUrl,
        },
      };

      return {
        ok: true,
        metadata: {
          title,
          authorName,
          authorUrl,
          thumbnailUrl,
          durationSeconds:
            typeof data.duration_seconds === 'number'
              ? data.duration_seconds
              : null,
          language: typeof data.language === 'string' ? data.language : null,
          providerId: this.providerId,
          rawMetadata: {
            title,
            author_name: authorName,
            author_url: authorUrl,
            thumbnail_url: thumbnailUrl,
            provider_name: data.provider_name ?? 'YouTube',
          },
        },
        evidenceItems: [metadataItem],
      };
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        return {
          ok: false,
          errorCode: 'SSRF_BLOCKED',
          safeErrorDetails: sanitizeErrorDetails(err),
          userMessage: 'Outbound request was blocked by SSRF security policy.',
        };
      }

      const details = sanitizeErrorDetails(err);
      return {
        ok: false,
        errorCode: 'SOURCE_UNAVAILABLE',
        safeErrorDetails: details,
        userMessage:
          'Could not reach YouTube from this server environment to retrieve the Short automatically. Retry acquisition or paste the transcript instead.',
      };
    }
  }

  async fetchCaptions(
    input: SourceResolutionInput
  ): Promise<TranscriptAcquisitionResult> {
    const baseUrl = this.getBaseUrl();
    const timedTextUrl = `${baseUrl}/api/timedtext?v=${encodeURIComponent(
      input.platformContentId
    )}&lang=en&fmt=json3`;

    try {
      const resp = await safeFetch(timedTextUrl, {
        timeoutMs: this.config.timeoutMs ?? 10000,
        allowLocalTestServer: this.isLocalAllowed(),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Afterframe/1.1 (+https://github.com/sujalkanere/Afterframe)',
        },
      });

      if (resp.status === 429) {
        return {
          ok: false,
          errorCode: 'PLATFORM_RATE_LIMITED',
          safeErrorDetails: 'YouTube timedtext returned HTTP 429',
          userMessage:
            'YouTube rate-limited caption retrieval. Retry transcription or paste the transcript instead.',
        };
      }

      if (!resp.ok) {
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: `YouTube timedtext returned HTTP ${resp.status}`,
          userMessage:
            'No public caption track was returned for this Short. Paste the transcript instead.',
        };
      }

      const bodyText = await resp.text();
      if (!bodyText.trim()) {
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: 'Empty timedtext response body.',
          userMessage:
            'This Short has no accessible spoken captions. Paste the transcript instead.',
        };
      }

      const parsed = JSON.parse(bodyText) as {
        events?: Array<{
          tStartMs?: number;
          dDurationMs?: number;
          segs?: Array<{ utf8?: string }>;
        }>;
        language?: string;
      };

      const events = Array.isArray(parsed.events) ? parsed.events : [];
      const segments: AcquiredEvidenceItem[] = [];

      for (const ev of events) {
        const text = (ev.segs ?? [])
          .map((s) => s.utf8 ?? '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();

        if (!text) continue;

        const startMs =
          typeof ev.tStartMs === 'number' && ev.tStartMs >= 0
            ? Math.round(ev.tStartMs)
            : null;
        const durationMs =
          typeof ev.dDurationMs === 'number' && ev.dDurationMs >= 0
            ? Math.round(ev.dDurationMs)
            : 3000;
        const endMs = startMs !== null ? startMs + durationMs : null;

        segments.push({
          kind: 'caption',
          contentText: text,
          contentRef: `${input.canonicalUrl}#t=${
            startMs !== null ? Math.floor(startMs / 1000) : 0
          }`,
          startMs,
          endMs,
          language: parsed.language ?? 'en',
          provenance: 'youtube-timedtext-json3-v1',
          limitations: [
            'Caption track captures spoken words only and does not include silent on-screen code overlays.',
          ],
          metadata: {},
        });
      }

      if (segments.length === 0) {
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: 'Zero non-empty caption segments in timedtext payload.',
          userMessage:
            'This Short contains no spoken caption segments. Paste the transcript instead.',
        };
      }

      return {
        ok: true,
        segments,
        providerId: 'youtube-timedtext-json3-v1',
      };
    } catch (err) {
      return {
        ok: false,
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        safeErrorDetails: sanitizeErrorDetails(err),
        userMessage:
          'Captions could not be retrieved from YouTube. Retry transcription or paste the transcript instead.',
      };
    }
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.TRANSCRIPTION_BASE_URL && process.env.TRANSCRIPTION_API_KEY
    );
  }

  async transcribeAudio(
    _input: SourceResolutionInput
  ): Promise<TranscriptAcquisitionResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        safeErrorDetails:
          'Speech-to-text provider is not configured (TRANSCRIPTION_BASE_URL / TRANSCRIPTION_API_KEY unset).',
        userMessage:
          'Public captions were unavailable and no external speech-to-text API key is configured. Paste the transcript instead.',
      };
    }

    return {
      ok: false,
      errorCode: 'TRANSCRIPTION_PROVIDER_FAILURE',
      safeErrorDetails:
        'Direct media stream download is disabled under current retention/network policy.',
      userMessage:
        'Audio stream transcription could not be completed. Paste the transcript instead.',
    };
  }

  async analyzeVisualFrames(
    _input: SourceResolutionInput,
    transcriptSufficient: boolean
  ): Promise<VisualEvidenceResult> {
    // FR-014 & FR-016: Never claim visual analysis if no frames were analyzed.
    if (transcriptSufficient) {
      return {
        ok: true,
        framesAnalyzed: 0,
        observations: [],
        note: 'Visual frames: not analyzed. The transcript was sufficient.',
      };
    }

    return {
      ok: true,
      framesAnalyzed: 0,
      observations: [],
      note: 'Visual frames: not analyzed (no visual frames extracted).',
    };
  }
}

/**
 * Bounded temporary media cleanup (FR-017, NFR-025).
 */
export function cleanupTempJobMedia(jobId: string): void {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return;
  const dir = path.resolve(process.cwd(), 'tmp/media', safeId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

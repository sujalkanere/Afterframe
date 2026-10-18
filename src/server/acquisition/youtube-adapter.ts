import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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

function getYtDlpPath(): string | null {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
    return process.env.YTDLP_PATH;
  }
  const wingetBase = path.join(
    process.env.LOCALAPPDATA ?? 'C:\\Users\\Sujal\\AppData\\Local',
    'Microsoft\\WinGet\\Packages'
  );
  if (fs.existsSync(wingetBase)) {
    try {
      const entries = fs.readdirSync(wingetBase);
      const ytDir = entries.find((e) => e.startsWith('yt-dlp.yt-dlp'));
      if (ytDir) {
        const fullPath = path.join(wingetBase, ytDir, 'yt-dlp.exe');
        if (fs.existsSync(fullPath)) return fullPath;
      }
    } catch {}
  }
  return 'yt-dlp';
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
        timeoutMs: this.config.timeoutMs ?? 1500,
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
        return await this.transcribeVideoFallback(input);
      }

      const bodyText = await resp.text();
      if (!bodyText.trim()) {
        return await this.transcribeVideoFallback(input);
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
        return await this.transcribeVideoFallback(input);
      }

      return {
        ok: true,
        segments,
        providerId: 'youtube-timedtext-json3-v1',
      };
    } catch {
      return await this.transcribeVideoFallback(input);
    }
  }

  private async transcribeVideoFallback(
    input: SourceResolutionInput
  ): Promise<TranscriptAcquisitionResult> {
    const apiKey = (process.env.LLM_API_KEY ?? '').trim();
    const geminiKey = (process.env.GEMINI_API_KEY ?? '').trim();
    const baseUrl = (process.env.LLM_BASE_URL ?? '').trim();

    const isGroq = apiKey.startsWith('gsk_') || baseUrl.includes('groq.com');
    if (isGroq) {
      const groqResult = await this.transcribeViaGroqWhisper(input);
      if (groqResult.ok) {
        return groqResult;
      }
    }

    const isGoogleKey =
      Boolean(geminiKey) ||
      apiKey.startsWith('AIza') ||
      baseUrl.includes('googleapis.com');

    if (isGoogleKey) {
      const geminiResult = await this.transcribeViaGemini(input);
      if (geminiResult.ok) {
        return geminiResult;
      }
    }

    return {
      ok: false,
      errorCode: 'TRANSCRIPT_UNAVAILABLE',
      safeErrorDetails:
        'Captions are unavailable on this video track and automatic audio transcription did not produce segments.',
      userMessage:
        'Captions could not be retrieved from YouTube. Retry transcription or paste the transcript instead.',
    };
  }

  /**
   * Transcribe YouTube video audio using Groq Whisper API (whisper-large-v3-turbo).
   * Downloads the lightweight audio stream via yt-dlp and posts to Groq transcriptions endpoint.
   */
  private async transcribeViaGroqWhisper(
    input: SourceResolutionInput
  ): Promise<TranscriptAcquisitionResult> {
    const apiKey = (process.env.LLM_API_KEY ?? '').trim();
    if (!apiKey) {
      return {
        ok: false,
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        safeErrorDetails: 'LLM_API_KEY is not configured for Groq Whisper transcription.',
        userMessage: 'No captions found and LLM_API_KEY is not configured. Paste the transcript instead.',
      };
    }

    const ytdlp = getYtDlpPath();
    if (!ytdlp) {
      return {
        ok: false,
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        safeErrorDetails: 'yt-dlp binary not found for audio download.',
        userMessage: 'Audio download tool not available on this server. Paste the transcript instead.',
      };
    }

    const videoUrl = `https://www.youtube.com/watch?v=${input.platformContentId}`;
    const tempFile = path.resolve(
      os.tmpdir(),
      `af_audio_${input.platformContentId}_${Date.now()}.m4a`
    );

    try {
      const { spawnSync } = await import('node:child_process');
      const dlRes = spawnSync(
        ytdlp,
        [
          '-f',
          'worstaudio[ext=m4a]/ba[ext=m4a]/worst',
          '-o',
          tempFile,
          '--force-overwrites',
          '--no-warnings',
          '--no-playlist',
          '--fixup',
          'never',
          '--socket-timeout',
          '5',
          videoUrl,
        ],
        { timeout: 25000, stdio: ['ignore', 'ignore', 'pipe'] }
      );

      if (!fs.existsSync(tempFile)) {
        const stderr = dlRes.stderr ? dlRes.stderr.toString('utf-8') : '';
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: `yt-dlp audio download failed: ${stderr.slice(0, 200)}`,
          userMessage: 'Could not extract audio from this video. Paste the transcript instead.',
        };
      }

      const fileBuffer = fs.readFileSync(tempFile);
      const audioBlob = new Blob([fileBuffer], { type: 'audio/m4a' });
      const form = new FormData();
      form.append('file', audioBlob, 'audio.m4a');
      form.append('model', 'whisper-large-v3-turbo');
      form.append('response_format', 'verbose_json');

      const whisperUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
      const resp = await safeFetch(whisperUrl, {
        method: 'POST',
        timeoutMs: 45000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: `Groq Whisper returned HTTP ${resp.status}: ${errText.slice(0, 200)}`,
          userMessage: `Automatic transcription failed (HTTP ${resp.status}). Paste the transcript instead.`,
        };
      }

      const data = (await resp.json()) as {
        text?: string;
        segments?: Array<{ start?: number; end?: number; text?: string }>;
        language?: string;
      };

      const rawSegments = data.segments ?? [];
      const segments: AcquiredEvidenceItem[] = [];

      for (const seg of rawSegments) {
        const text = (seg.text ?? '').trim();
        if (!text) continue;
        const startMs =
          typeof seg.start === 'number' && seg.start >= 0
            ? Math.round(seg.start * 1000)
            : null;
        const endMs =
          typeof seg.end === 'number' && seg.end >= 0
            ? Math.round(seg.end * 1000)
            : null;

        segments.push({
          kind: 'caption',
          contentText: text,
          contentRef: `${input.canonicalUrl}#t=${
            startMs !== null ? Math.floor(startMs / 1000) : 0
          }`,
          startMs,
          endMs,
          language: data.language ?? 'en',
          provenance: 'groq-whisper-v3-turbo',
          limitations: [
            'Auto-transcribed directly from video audio stream via Groq Whisper API.',
          ],
          metadata: {},
        });
      }

      if (segments.length === 0 && data.text?.trim()) {
        segments.push({
          kind: 'caption',
          contentText: data.text.trim(),
          contentRef: `${input.canonicalUrl}#t=0`,
          startMs: 0,
          endMs: 60000,
          language: data.language ?? 'en',
          provenance: 'groq-whisper-v3-turbo',
          limitations: [
            'Auto-transcribed directly from video audio stream via Groq Whisper API.',
          ],
          metadata: {},
        });
      }

      if (segments.length === 0) {
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: 'Groq Whisper returned 0 segments.',
          userMessage:
            'This video contains no audible speech. Paste the transcript instead.',
        };
      }

      return {
        ok: true,
        segments,
        providerId: 'groq-whisper-v3-turbo',
      };
    } catch (err) {
      return {
        ok: false,
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        safeErrorDetails: sanitizeErrorDetails(err),
        userMessage: 'Automatic video transcription failed. Paste the transcript instead.',
      };
    } finally {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch {}
      }
    }
  }

  /**
   * Directly transcribe YouTube video audio via Gemini multimodal generateContent API.
   * Works on all public YouTube Shorts & Videos without scraping blocks.
   */
  private async transcribeViaGemini(
    input: SourceResolutionInput
  ): Promise<TranscriptAcquisitionResult> {
    const apiKey =
      (process.env.GEMINI_API_KEY ?? '').trim() ||
      ((process.env.LLM_BASE_URL ?? '').includes('googleapis.com')
        ? (process.env.LLM_API_KEY ?? '').trim()
        : '');

    if (!apiKey || apiKey.startsWith('gsk_')) {
      return {
        ok: false,
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        safeErrorDetails: 'GEMINI_API_KEY is not configured for automatic Gemini transcription.',
        userMessage: 'No captions found and GEMINI_API_KEY is not configured. Paste the transcript instead.',
      };
    }

    const model = process.env.GEMINI_MODEL ?? process.env.LLM_MODEL ?? 'gemini-2.5-flash';
    const videoUrl = `https://www.youtube.com/watch?v=${input.platformContentId}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const resp = await safeFetch(endpoint, {
        method: 'POST',
        timeoutMs: 45000,
        allowLocalTestServer: this.isLocalAllowed(),
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  file_data: {
                    file_uri: videoUrl,
                    mime_type: 'video/mp4',
                  },
                },
                {
                  text: 'Transcribe the spoken audio of this video into a JSON array of caption segments with start_ms, end_ms, and text. Keep segments concise (1-2 sentences each). Output format: [{"start_ms": 0, "end_ms": 5000, "text": "..."}]',
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: `Gemini video transcription returned HTTP ${resp.status}: ${errText.slice(0, 200)}`,
          userMessage: `Automatic video transcription failed (HTTP ${resp.status}: ${errText.slice(0, 150)}). Paste the transcript instead.`,
        };
      }

      const data = (await resp.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      let parsedSegments: Array<{ start_ms?: number; end_ms?: number; text?: string }> = [];

      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          parsedSegments = parsed;
        } else if (Array.isArray((parsed as any).segments)) {
          parsedSegments = (parsed as any).segments;
        }
      } catch {
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: 'Could not parse Gemini transcription JSON.',
          userMessage: 'Transcription parsing failed. Paste the transcript instead.',
        };
      }

      const segments: AcquiredEvidenceItem[] = [];
      for (const seg of parsedSegments) {
        const text = (seg.text ?? '').trim();
        if (!text) continue;

        const startMs = typeof seg.start_ms === 'number' && seg.start_ms >= 0 ? Math.round(seg.start_ms) : null;
        const endMs = typeof seg.end_ms === 'number' && seg.end_ms >= 0 ? Math.round(seg.end_ms) : null;

        segments.push({
          kind: 'caption',
          contentText: text,
          contentRef: `${input.canonicalUrl}#t=${startMs !== null ? Math.floor(startMs / 1000) : 0}`,
          startMs,
          endMs,
          language: 'en',
          provenance: 'gemini-multimodal-transcription-v1',
          limitations: [
            'Auto-transcribed directly from video stream via Gemini API.',
          ],
          metadata: {},
        });
      }

      if (segments.length === 0) {
        return {
          ok: false,
          errorCode: 'TRANSCRIPT_UNAVAILABLE',
          safeErrorDetails: 'Gemini transcription produced 0 segments.',
          userMessage: 'This video contains no audible speech. Paste the transcript instead.',
        };
      }

      return {
        ok: true,
        segments,
        providerId: 'gemini-multimodal-transcription-v1',
      };
    } catch (err) {
      const details = sanitizeErrorDetails(err);
      return {
        ok: false,
        errorCode: 'TRANSCRIPT_UNAVAILABLE',
        safeErrorDetails: details,
        userMessage: `Automatic transcription failed (${details}). Paste the transcript instead.`,
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

import crypto from 'node:crypto';
import { PIPELINE_VERSION } from '../../shared/contracts.js';

export function computeSha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface IdempotencyParams {
  userId: string;
  platform: 'youtube' | 'instagram' | 'manual';
  platformContentId: string;
  pastedTranscript?: string;
  pipelineVersion?: string;
}

/**
 * Computes a deterministic idempotency key for job creation (Section 8.2, FR-051, FR-053).
 * Scoped to the authenticated user, normalized source identity, optional transcript digest,
 * and pipeline version.
 */
export function computeIdempotencyKey(params: IdempotencyParams): {
  idempotencyKey: string;
  inputHash: string;
} {
  const normalizedTranscript = (params.pastedTranscript ?? '')
    .trim()
    .replace(/\r\n/g, '\n');
  const transcriptDigest = normalizedTranscript
    ? computeSha256(normalizedTranscript)
    : 'link_only';

  const inputHash = computeSha256(
    `${params.platform}:${params.platformContentId}:${transcriptDigest}`
  );

  const idempotencyKey = computeSha256(
    [
      params.userId,
      params.platform,
      params.platformContentId,
      transcriptDigest,
      params.pipelineVersion ?? PIPELINE_VERSION,
    ].join('|')
  );

  return { idempotencyKey, inputHash };
}

export interface ParsedTranscriptSegment {
  text: string;
  startMs: number | null;
  endMs: number | null;
}

/**
 * Parses timestamped or plain text transcripts into ordered segments (FR-012).
 * Supports formats like:
 * - "0:14 Some spoken line"
 * - "[00:14] Some spoken line"
 * - "0:14 - 0:22 Some spoken line"
 * - Plain paragraphs when no timestamps are present (startMs: null, endMs: null)
 */
export function parseTranscriptSegments(
  rawTranscript: string
): ParsedTranscriptSegment[] {
  const lines = rawTranscript
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const tsRegex =
    /^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?(?:\s*[-–—>to]+\s*\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?)?\s+(.+)$/i;

  const parsed: ParsedTranscriptSegment[] = [];

  for (const line of lines) {
    const m = line.match(tsRegex);
    if (m) {
      const startMs = toMillis(m[1], m[2], m[3]);
      const endMs = m[4] && m[5] ? toMillis(m[4], m[5], m[6]) : null;
      const text = m[7].trim();
      if (text) {
        parsed.push({ text, startMs, endMs });
      }
    } else {
      // Split long un-timestamped paragraphs into sentence-bounded chunks if needed
      parsed.push({
        text: line,
        startMs: null,
        endMs: null,
      });
    }
  }

  // Infer endMs from subsequent segment's startMs when not explicitly given
  for (let i = 0; i < parsed.length; i++) {
    const seg = parsed[i];
    if (seg.startMs !== null && seg.endMs === null) {
      const next = parsed[i + 1];
      if (next && next.startMs !== null && next.startMs >= seg.startMs) {
        seg.endMs = next.startMs;
      } else {
        seg.endMs = seg.startMs + 4000;
      }
    }
  }

  return parsed;
}

function toMillis(p1: string, p2: string, p3?: string): number {
  if (p3 !== undefined) {
    const hours = Number(p1);
    const mins = Number(p2);
    const secs = Number(p3);
    return ((hours * 3600) + (mins * 60) + secs) * 1000;
  }
  const mins = Number(p1);
  const secs = Number(p2);
  return ((mins * 60) + secs) * 1000;
}

export function formatTimestampMs(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || Number.isNaN(ms) || ms < 0) {
    return null;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

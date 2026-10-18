import type { ErrorCode, EvidenceKind, Platform } from '../../shared/contracts.js';

export interface AcquiredMetadata {
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  language: string | null;
  providerId: string;
  rawMetadata: Record<string, unknown>;
}

export interface AcquiredEvidenceItem {
  kind: EvidenceKind;
  contentText: string;
  contentRef: string | null;
  startMs: number | null;
  endMs: number | null;
  language: string | null;
  provenance: string;
  limitations: string[];
  metadata: Record<string, unknown>;
}

export interface SourceResolutionInput {
  platform: Platform;
  platformContentId: string;
  canonicalUrl: string;
  submittedUrl: string;
}

export type SourceResolutionResult =
  | {
      ok: true;
      metadata: AcquiredMetadata;
      evidenceItems: AcquiredEvidenceItem[];
    }
  | {
      ok: false;
      errorCode: ErrorCode;
      safeErrorDetails: string;
      userMessage: string;
    };

export type TranscriptAcquisitionResult =
  | {
      ok: true;
      segments: AcquiredEvidenceItem[];
      providerId: string;
    }
  | {
      ok: false;
      errorCode: ErrorCode;
      safeErrorDetails: string;
      userMessage: string;
    };

export type VisualEvidenceResult =
  | {
      ok: true;
      framesAnalyzed: number;
      observations: AcquiredEvidenceItem[];
      note: string;
    }
  | {
      ok: false;
      errorCode: ErrorCode;
      safeErrorDetails: string;
      userMessage: string;
    };

/**
 * Explicit modular contracts required by FR-015.
 */
export interface SourceResolver {
  readonly platform: Platform;
  readonly providerId: string;
  isEnabled(): boolean;
  resolveMetadata(input: SourceResolutionInput): Promise<SourceResolutionResult>;
}

export interface TranscriptProvider {
  readonly providerId: string;
  fetchCaptions(input: SourceResolutionInput): Promise<TranscriptAcquisitionResult>;
}

export interface TranscriptionProvider {
  readonly providerId: string;
  isConfigured(): boolean;
  transcribeAudio(input: SourceResolutionInput): Promise<TranscriptAcquisitionResult>;
}

export interface VisualEvidenceProvider {
  readonly providerId: string;
  isConfigured(): boolean;
  analyzeVisualFrames(
    input: SourceResolutionInput,
    transcriptSufficient: boolean
  ): Promise<VisualEvidenceResult>;
}

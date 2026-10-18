import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Clipboard,
  FileText,
  Clock,
  CheckSquare,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { canonicalizeVideoUrl } from '../../shared/url-canonicalizer.js';
import { FrameBrackets } from '../components/FrameBrackets.js';

export interface ReadyJobSummary {
  id: string;
  status: string;
  current_stage: string;
  platform: string;
  canonical_url: string;
  candidate_title: string | null;
  recommended_type: string | null;
  expires_at: string | null;
  updated_at: string;
}

export interface RecentArtifactSummary {
  id: string;
  artifact_type: string;
  title: string;
  topics: string[];
  source_platform: string | null;
  created_at: string;
}

export interface CaptureScreenProps {
  initialSharedUrl?: string;
  reducedMotion: boolean;
  capabilities: {
    youtubeLinkEnabled: boolean;
    instagramLinkEnabled: boolean;
    pasteTranscriptEnabled: boolean;
    llmConfigured: boolean;
  };
  readyJobs: ReadyJobSummary[];
  recentArtifacts: RecentArtifactSummary[];
  onSubmitJob: (payload: {
    url?: string;
    pasted_transcript?: string;
    source_title?: string;
  }) => Promise<{ ok: boolean; jobId?: string; message?: string }>;
  onOpenJob: (jobId: string) => void;
  onOpenArtifact: (artifactId: string) => void;
}

/**
 * Screen A — Capture / Home (Section 6.8.A).
 * - Single primary action ("Extract").
 * - The Frame Lock signature moment on first load (< 900ms, skipped under reduced motion).
 * - Clipboard supported-link detection on focus (FR-061).
 * - Reachable "Paste the transcript instead" secondary path without failing first (FR-059).
 * - Inline validation with specific microcopy.
 * - Real "Ready for review" and "Recently kept" lists (never pre-populated with sample data).
 */
export const CaptureScreen: React.FC<CaptureScreenProps> = ({
  initialSharedUrl = '',
  reducedMotion,
  capabilities,
  readyJobs,
  recentArtifacts,
  onSubmitJob,
  onOpenJob,
  onOpenArtifact,
}) => {
  const [url, setUrl] = useState(initialSharedUrl);
  const [showTranscriptMode, setShowTranscriptMode] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('');
  const [pastedTranscript, setPastedTranscript] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clipboardCandidate, setClipboardCandidate] = useState<string | null>(
    null
  );
  const [playFrameLock, setPlayFrameLock] = useState(false);

  // Signature Moment 1: The Frame Lock plays once per session (Section 6.4.1)
  useEffect(() => {
    if (reducedMotion) return;
    try {
      const alreadyLocked = sessionStorage.getItem('af_frame_locked');
      if (!alreadyLocked) {
        setPlayFrameLock(true);
        sessionStorage.setItem('af_frame_locked', '1');
      }
    } catch {
      // Ignore storage restrictions
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (initialSharedUrl) {
      setUrl(initialSharedUrl);
    }
  }, [initialSharedUrl]);

  // Clipboard detection on input focus (FR-061, Section 6.8.A)
  const handleUrlFocus = async () => {
    if (url.trim()) return;
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = (await navigator.clipboard.readText()).trim();
        if (clipText) {
          const check = canonicalizeVideoUrl(clipText);
          if (check.ok) {
            setClipboardCandidate(clipText);
          }
        }
      }
    } catch {
      // Permission denied or unsupported — handled silently and gracefully per FR-061
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedUrl = url.trim();
    const trimmedTranscript = pastedTranscript.trim();

    if (trimmedUrl) {
      const check = canonicalizeVideoUrl(trimmedUrl);
      if (!check.ok) {
        setValidationError(check.message);
        return;
      }
      if (
        check.platform === 'instagram' &&
        !capabilities.instagramLinkEnabled &&
        !trimmedTranscript
      ) {
        setShowTranscriptMode(true);
        setValidationError(
          'Instagram Reel link retrieval is disabled because Instagram requires authenticated access. Paste the Reel transcript below to extract from this link.'
        );
        return;
      }
    } else if (!showTranscriptMode || trimmedTranscript.length < 10) {
      setValidationError(
        showTranscriptMode
          ? 'Paste a transcript of at least 10 characters to extract.'
          : 'That doesn’t look like a YouTube Short or Instagram Reel link. Check it and try again.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmitJob({
        url: trimmedUrl || undefined,
        pasted_transcript:
          showTranscriptMode && trimmedTranscript
            ? trimmedTranscript
            : undefined,
        source_title:
          showTranscriptMode && sourceTitle.trim()
            ? sourceTitle.trim()
            : undefined,
      });
      if (!res.ok) {
        setValidationError(
          res.message ?? 'Could not start extraction. Check your input.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reviewJobs = readyJobs.filter((j) => j.status === 'needs_review');

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1
          className="af-display"
          style={{
            fontSize: 'var(--text-display)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Keep what matters from a short video.
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-md)' }}>
          Send a YouTube Short or paste a transcript. Review the grounded
          evidence and save a structured task or reusable AI skill.
        </p>
      </header>

      <FrameBrackets animate={playFrameLock} active={true}>
        <form
          onSubmit={handleSubmit}
          className="af-panel"
          aria-label="Capture video or transcript"
          noValidate
        >
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label
              htmlFor="af-capture-url"
              style={{
                display: 'block',
                fontWeight: 500,
                marginBottom: 'var(--space-2)',
              }}
            >
              Video link
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              <input
                id="af-capture-url"
                type="url"
                value={url}
                onFocus={handleUrlFocus}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="https://www.youtube.com/shorts/..."
                aria-invalid={Boolean(validationError)}
                aria-describedby={
                  validationError ? 'af-capture-error' : 'af-capture-capability'
                }
                className="af-input"
                style={{ flex: '1 1 260px' }}
              />
              {/* Single Primary Action on Screen (Hick's law, Section 6.2.1 & 6.8.A) */}
              <button
                type="submit"
                disabled={submitting}
                className="af-btn af-btn-primary"
              >
                <span>{submitting ? 'Starting…' : 'Extract'}</span>
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </div>

          {clipboardCandidate && !url && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <button
                type="button"
                className="af-btn"
                onClick={() => {
                  setUrl(clipboardCandidate);
                  setClipboardCandidate(null);
                }}
                style={{ fontSize: 'var(--text-sm)' }}
              >
                <Clipboard size={16} strokeWidth={1.5} />
                <span>Paste link from clipboard: {clipboardCandidate}</span>
              </button>
            </div>
          )}

          {validationError && (
            <div
              id="af-capture-error"
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                marginBottom: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <AlertCircle
                size={18}
                strokeWidth={1.5}
                style={{ flexShrink: 0, marginTop: '2px' }}
              />
              <span>{validationError}</span>
            </div>
          )}

          {/* Truthful capability line (Section 6.8.A) */}
          <p
            id="af-capture-capability"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <strong>Platform status:</strong> YouTube Shorts links{' '}
            {capabilities.youtubeLinkEnabled ? 'enabled' : 'disabled'}.
            Instagram Reel link retrieval is{' '}
            {capabilities.instagramLinkEnabled
              ? 'enabled'
              : 'disabled (requires pasted transcript)'}
            .
          </p>

          {/* Secondary path reachable without first failing (FR-059, Section 6.8.A) */}
          <div
            style={{
              borderTop: '1px solid var(--line)',
              paddingTop: 'var(--space-3)',
            }}
          >
            <button
              type="button"
              className="af-btn"
              aria-expanded={showTranscriptMode}
              onClick={() => setShowTranscriptMode((v) => !v)}
              style={{ fontSize: 'var(--text-sm)' }}
            >
              <FileText size={16} strokeWidth={1.5} />
              <span>
                {showTranscriptMode
                  ? 'Hide transcript input'
                  : 'Paste the transcript instead'}
              </span>
            </button>

            {showTranscriptMode && (
              <div
                style={{
                  marginTop: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <label
                    htmlFor="af-source-title"
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    Source title (optional)
                  </label>
                  <input
                    id="af-source-title"
                    type="text"
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="e.g. Git Setup from Scratch in 60 Seconds"
                    className="af-input"
                  />
                </div>

                <div>
                  <label
                    htmlFor="af-transcript-textarea"
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    Spoken transcript or captions (include optional 0:00
                    timestamps)
                  </label>
                  <textarea
                    id="af-transcript-textarea"
                    value={pastedTranscript}
                    onChange={(e) => {
                      setPastedTranscript(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder={
                      '0:00 Run git init to initialize a new repository.\n0:14 Configure your user name and email with git config.\n0:28 Stage files with git add and commit your snapshot.'
                    }
                    className="af-textarea"
                    rows={5}
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      </FrameBrackets>

      {/* Ready for review section — Zeigarnik effect used honestly (Section 6.2.4 & 6.8.A) */}
      {reviewJobs.length > 0 && (
        <section
          aria-labelledby="af-ready-heading"
          style={{ marginTop: 'var(--space-8)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-3)',
            }}
          >
            <h2 id="af-ready-heading" style={{ fontSize: 'var(--text-lg)' }}>
              Ready for review ({reviewJobs.length})
            </h2>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}
            >
              Unconfirmed candidates expire after 7 days
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {reviewJobs.map((job) => (
              <div
                key={job.id}
                className="af-panel-raised"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {job.candidate_title || job.canonical_url}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Recommended:{' '}
                    {job.recommended_type === 'ai_skill' ? 'AI skill' : 'Task'}{' '}
                    · {job.platform}
                  </div>
                </div>
                <button
                  type="button"
                  className="af-btn"
                  onClick={() => onOpenJob(job.id)}
                >
                  Review draft
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently kept section — appears only when real data exists (Section 6.8.A) */}
      {recentArtifacts.length > 0 ? (
        <section
          aria-labelledby="af-recent-heading"
          style={{ marginTop: 'var(--space-8)' }}
        >
          <h2
            id="af-recent-heading"
            style={{
              fontSize: 'var(--text-lg)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Recently kept
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {recentArtifacts.slice(0, 5).map((art) => (
              <button
                key={art.id}
                type="button"
                onClick={() => onOpenArtifact(art.id)}
                className="af-panel-raised"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    minWidth: 0,
                  }}
                >
                  {art.artifact_type === 'ai_skill' ? (
                    <Sparkles
                      size={18}
                      strokeWidth={1.5}
                      color="var(--evidence-visual)"
                    />
                  ) : (
                    <CheckSquare
                      size={18}
                      strokeWidth={1.5}
                      color="var(--accent)"
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {art.title}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {art.artifact_type === 'ai_skill' ? 'AI skill' : 'Task'}
                      {art.topics.length > 0
                        ? ` · ${art.topics.join(', ')}`
                        : ''}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Open
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        reviewJobs.length === 0 && (
          <section
            aria-label="Empty library state"
            className="af-panel"
            style={{
              marginTop: 'var(--space-8)',
              textAlign: 'center',
              padding: 'var(--space-6)',
            }}
          >
            <Clock
              size={24}
              strokeWidth={1.5}
              color="var(--text-muted)"
              style={{ marginBottom: 'var(--space-2)' }}
            />
            <h2
              style={{
                fontSize: 'var(--text-md)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                marginBottom: 'var(--space-1)',
              }}
            >
              Your library is empty
            </h2>
            <p
              style={{
                margin: '0 auto',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
              }}
            >
              Paste a YouTube Short link above or select “Paste the transcript
              instead” to extract your first task or AI skill.
            </p>
          </section>
        )
      )}
    </div>
  );
};

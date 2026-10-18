import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Clipboard,
  FileText,
  Clock,
  CheckSquare,
  Sparkles,
  AlertCircle,
  Video,
  Zap,
  Layers,
  FileCode,
  ShieldAlert,
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
 * Screen A — Capture / Ingestion Studio (Section 6.8.A).
 * Enhanced into an intentional, cinematic Spatial Knowledge Instrument.
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
      // Permission denied or unsupported
    }
  };

  const handleApplyPreset = (presetUrl: string, presetTitle?: string, presetTranscript?: string) => {
    setValidationError(null);
    if (presetTranscript) {
      setShowTranscriptMode(true);
      setSourceTitle(presetTitle || '');
      setPastedTranscript(presetTranscript);
      setUrl('');
    } else {
      setShowTranscriptMode(false);
      setUrl(presetUrl);
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
    <div className="af-instrument-container" data-testid="capture-screen">
      {/* Header */}
      <header className="af-instrument-hero">
        <div className="af-instrument-hero-top">
          <div>
            <h1 className="af-instrument-title">Video Ingestion Console</h1>
            <p className="af-instrument-subtitle">
              Submit a YouTube Short or Instagram Reel link. Afterframe locks onto audio and optical frames, generates grounded evidence, and prepares a structured task or reusable AI skill.
            </p>
          </div>
          <div className="af-instrument-beacon">
            <span className="af-beacon-dot" />
            <span>Dual-Engine Active</span>
          </div>
        </div>
      </header>

      {/* Main Aperture Viewfinder Console */}
      <div className="af-aperture-console">
        {/* Optical HUD Overlays */}
        <div className="af-aperture-hud">
          <div className="af-aperture-telemetry">
            <span className="af-hud-badge active">
              <span className="af-beacon-dot" style={{ width: 5, height: 5 }} />
              Aperture Ready
            </span>
            <span className="af-hud-badge">FPS: 60</span>
            <span className="af-hud-badge">48 kHz Waveform</span>
          </div>
          <div className="af-aperture-telemetry">
            <span>RES: 1080×1920 (9:16)</span>
            <span>OCR: Active</span>
          </div>
        </div>

        <FrameBrackets animate={playFrameLock} active={true}>
          <form
            onSubmit={handleSubmit}
            className="af-capture-box"
            aria-label="Capture video or transcript"
            noValidate
          >
            <div>
              <label
                htmlFor="af-capture-url"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: 600,
                  fontSize: 'var(--text-sm)',
                  marginBottom: 'var(--space-2)',
                  color: 'var(--text)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <span>Target Video URL</span>
                <span className="af-input-sources-pills">
                  <span className="af-source-chip">
                    <img src="/icons/youtube.svg" alt="" className="af-source-chip-icon" aria-hidden="true" />
                    <span>YouTube Shorts</span>
                  </span>
                  <span className="af-source-chip">
                    <img src="/icons/tiktok.svg" alt="" className="af-source-chip-icon" aria-hidden="true" />
                    <span>TikTok</span>
                  </span>
                  <span className="af-source-chip">
                    <img src="/icons/instagram.svg" alt="" className="af-source-chip-icon" aria-hidden="true" />
                    <span>Instagram Reels</span>
                  </span>
                </span>
              </label>

              <div className="af-input-group">
                <div className="af-input-viewport">
                  {url.toLowerCase().includes('youtube') || url.toLowerCase().includes('youtu.be') ? (
                    <img src="/icons/youtube.svg" alt="YouTube" className="af-input-brand-icon" />
                  ) : url.toLowerCase().includes('tiktok') ? (
                    <img src="/icons/tiktok.svg" alt="TikTok" className="af-input-brand-icon" />
                  ) : url.toLowerCase().includes('instagram') ? (
                    <img src="/icons/instagram.svg" alt="Instagram" className="af-input-brand-icon" />
                  ) : (
                    <Video size={18} className="af-input-icon" />
                  )}
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
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="af-btn-extract"
                >
                  <Zap size={18} strokeWidth={2} />
                  <span>{submitting ? 'Locking Frame…' : 'Extract'}</span>
                  <ArrowRight size={18} strokeWidth={2} />
                </button>
              </div>
            </div>

            {clipboardCandidate && !url && (
              <div>
                <button
                  type="button"
                  className="af-btn"
                  onClick={() => {
                    setUrl(clipboardCandidate);
                    setClipboardCandidate(null);
                  }}
                  style={{ fontSize: 'var(--text-sm)', padding: '6px 12px' }}
                >
                  <Clipboard size={16} strokeWidth={1.5} />
                  <span>Paste detected link from clipboard: {clipboardCandidate}</span>
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
                  background: 'rgba(239, 138, 122, 0.08)',
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

            {/* Platform status indicator */}
            <p
              id="af-capture-capability"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                margin: 0,
              }}
            >
              <strong>Platform status:</strong> YouTube Shorts links{' '}
              {capabilities.youtubeLinkEnabled ? 'enabled' : 'disabled'}. Instagram Reel link retrieval is{' '}
              {capabilities.instagramLinkEnabled
                ? 'enabled'
                : 'disabled (requires pasted transcript)'}
              .
            </p>

            {/* Secondary transcript path */}
            <div
              style={{
                borderTop: '1px solid var(--line)',
                paddingTop: 'var(--space-3)',
                marginTop: 'var(--space-2)',
              }}
            >
              <button
                type="button"
                className="af-btn"
                aria-expanded={showTranscriptMode}
                onClick={() => setShowTranscriptMode((v) => !v)}
                style={{ fontSize: 'var(--text-sm)', height: 38 }}
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
                      Spoken transcript or captions (include optional 0:00 timestamps)
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

        {/* Quick-Try Interactive Presets */}
        <div className="af-presets-section">
          <div className="af-presets-header">
            <span>Quick-Try Extraction Presets (Click to load sample)</span>
            <Sparkles size={14} color="var(--accent)" />
          </div>

          <div className="af-presets-grid">
            <button
              type="button"
              className="af-preset-card"
              onClick={() =>
                handleApplyPreset(
                  'https://www.youtube.com/shorts/5vJ4y6_example1',
                  'Python Async Context Manager Pattern'
                )
              }
            >
              <div className="af-preset-top">
                <span className="af-preset-tag">
                  <img src="/icons/youtube.svg" alt="" style={{ width: 13, height: 13, verticalAlign: -1, marginRight: 5 }} aria-hidden="true" />
                  <span>Python · Task</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>0:45</span>
              </div>
              <h4 className="af-preset-title">Async Context Manager</h4>
              <p className="af-preset-desc">
                Learn __aenter__ and __aexit__ protocol for resilient database connections in Python.
              </p>
            </button>

            <button
              type="button"
              className="af-preset-card"
              onClick={() =>
                handleApplyPreset(
                  'https://www.youtube.com/shorts/7kM9p0_example2',
                  'Docker Multi-Stage Build Optimization'
                )
              }
            >
              <div className="af-preset-top">
                <span className="af-preset-tag">
                  <img src="/icons/youtube.svg" alt="" style={{ width: 13, height: 13, verticalAlign: -1, marginRight: 5 }} aria-hidden="true" />
                  <span>DevOps · AI Skill</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>0:58</span>
              </div>
              <h4 className="af-preset-title">Docker Multi-Stage Optimization</h4>
              <p className="af-preset-desc">
                Shrink production image sizes by 85% using separate builder and runner layers.
              </p>
            </button>

            <button
              type="button"
              className="af-preset-card"
              onClick={() =>
                handleApplyPreset(
                  '',
                  'Sourdough Autolyse & Hydration Curve',
                  '0:00 Mix 400 grams of bread flour with 300 milliliters of lukewarm water for autolyse.\n0:15 Rest covered for thirty minutes to allow gluten development before salt.\n0:30 Add 80 grams of active levain and 9 grams of sea salt, then perform coil folds every 45 minutes.'
                )
              }
            >
              <div className="af-preset-top">
                <span className="af-preset-tag">Culinary · Routine</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Transcript</span>
              </div>
              <h4 className="af-preset-title">Sourdough Autolyse & Folds</h4>
              <p className="af-preset-desc">
                Loads sample transcript with timestamped coil fold cadence for gluten strength.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Ready for review section */}
      {reviewJobs.length > 0 && (
        <section
          aria-labelledby="af-ready-heading"
          className="af-card-section"
          style={{ marginBottom: 'var(--space-8)' }}
        >
          <div className="af-section-header">
            <h2 id="af-ready-heading" className="af-section-title">
              <Clock size={18} strokeWidth={1.5} color="var(--accent)" />
              <span>Ready for Review ({reviewJobs.length})</span>
            </h2>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Unconfirmed candidates expire after 7 days
            </span>
          </div>

          <div className="af-activity-list">
            {reviewJobs.map((job) => (
              <div
                key={job.id}
                className="af-activity-item"
                onClick={() => onOpenJob(job.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onOpenJob(job.id)}
              >
                <div className="af-activity-info">
                  <div className="af-stat-icon">
                    <Zap size={16} color="var(--accent)" />
                  </div>
                  <div>
                    <div className="af-activity-title">
                      {job.candidate_title || job.canonical_url}
                    </div>
                    <div className="af-activity-meta">
                      Recommended:{' '}
                      {job.recommended_type === 'ai_skill' ? 'AI skill' : 'Task'} ·{' '}
                      {job.platform}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="af-btn af-btn-primary"
                  style={{ height: 36, fontSize: 'var(--text-xs)', padding: '0 12px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenJob(job.id);
                  }}
                >
                  Review Draft
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently kept section */}
      {recentArtifacts.length > 0 && (
        <section
          aria-labelledby="af-recent-heading"
          className="af-card-section"
        >
          <div className="af-section-header">
            <h2 id="af-recent-heading" className="af-section-title">
              <CheckSquare size={18} strokeWidth={1.5} color="var(--accent)" />
              <span>Recently Kept Knowledge</span>
            </h2>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Permanent Local Storage
            </span>
          </div>

          <div className="af-activity-list">
            {recentArtifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="af-activity-item"
                onClick={() => onOpenArtifact(artifact.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onOpenArtifact(artifact.id)}
              >
                <div className="af-activity-info">
                  <div className="af-stat-icon">
                    {artifact.artifact_type === 'skill' ? (
                      <FileCode size={16} />
                    ) : (
                      <Layers size={16} />
                    )}
                  </div>
                  <div>
                    <div className="af-activity-title">{artifact.title}</div>
                    <div className="af-activity-meta">
                      {artifact.artifact_type.toUpperCase()} ·{' '}
                      {artifact.topics.length > 0
                        ? artifact.topics.join(', ')
                        : 'Uncategorized'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {new Date(artifact.created_at).toLocaleDateString()}
                  </span>
                  <ArrowRight size={14} color="var(--text-muted)" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

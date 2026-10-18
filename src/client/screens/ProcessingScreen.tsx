import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  RotateCw,
  XCircle,
  FileText,
  PenTool,
} from 'lucide-react';

export interface ProcessingStageJob {
  id: string;
  status: string;
  current_stage: string;
  failed_stage: string | null;
  attempt_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
}

export interface ProcessingScreenProps {
  job: ProcessingStageJob;
  sourceUrl: string;
  evidenceCount: number;
  onRetryStage: (pastedTranscript?: string) => Promise<void>;
  onManualDraft: () => Promise<void>;
  onCancelJob: () => Promise<void>;
  onLeaveScreen: () => void;
}

const ORDERED_STAGES = [
  { id: 'queued', label: 'Queued', detail: 'Durable processing job recorded' },
  {
    id: 'acquiring',
    label: 'Acquiring source',
    detail: 'Validating link and retrieving source metadata',
  },
  {
    id: 'transcribing',
    label: 'Preparing transcript & evidence',
    detail: 'Extracting timestamped captions or user-supplied transcript',
  },
  {
    id: 'analyzing',
    label: 'Analyzing with configured model',
    detail: 'Generating structured candidate and running 5-layer validation',
  },
  {
    id: 'needs_review',
    label: 'Ready for review',
    detail: 'Candidate validated and ready for your confirmation',
  },
];

/**
 * Screen B — Processing (Section 6.8.B, FR-049, FR-050).
 * - Ordered list of real backend stages (no fake percentage bars).
 * - Live-region announcement of each stage transition.
 * - Cancel available at all times; stage-labeled Retry only for failed stages.
 * - Honest failure state stating what happened, what was saved, and next valid actions.
 */
export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({
  job,
  sourceUrl,
  evidenceCount,
  onRetryStage,
  onManualDraft,
  onCancelJob,
  onLeaveScreen,
}) => {
  const [slowNotice, setSlowNotice] = useState(false);
  const [showTranscriptFallback, setShowTranscriptFallback] = useState(false);
  const [fallbackTranscript, setFallbackTranscript] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (job.status === 'failed' || job.status === 'cancelled') return;
    const timer = setTimeout(() => setSlowNotice(true), 4500);
    return () => clearTimeout(timer);
  }, [job.status]);

  const currentStageIndex = ORDERED_STAGES.findIndex(
    (s) => s.id === (job.failed_stage ?? job.current_stage)
  );

  const retryButtonLabel =
    job.failed_stage === 'acquiring'
      ? 'Retry acquisition'
      : job.failed_stage === 'transcribing'
        ? 'Retry transcription'
        : 'Retry analysis';

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1
          className="af-display"
          style={{
            fontSize: 'var(--text-xl)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {job.status === 'failed'
            ? 'Extraction paused at a failed stage'
            : job.status === 'cancelled'
              ? 'Extraction cancelled'
              : 'Extracting from source'}
        </h1>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            wordBreak: 'break-all',
          }}
        >
          Source: {sourceUrl}
        </p>
      </header>

      {/* Screen-reader live region announcing real stage updates (FR-050, Section 6.10) */}
      <div className="af-sr-only" role="status" aria-live="polite">
        Job status: {job.status}. Current stage: {job.current_stage}.
        {job.last_error_message ? ` Error: ${job.last_error_message}` : ''}
      </div>

      <div className="af-panel" style={{ marginBottom: 'var(--space-6)' }}>
        <ol
          aria-label="Processing pipeline stages"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {ORDERED_STAGES.map((stage, idx) => {
            const isFailedHere =
              job.status === 'failed' && job.failed_stage === stage.id;
            const isCompleted =
              idx < currentStageIndex || job.status === 'needs_review';
            const isCurrent =
              idx === currentStageIndex &&
              job.status !== 'failed' &&
              job.status !== 'cancelled';

            return (
              <li
                key={stage.id}
                aria-current={isCurrent ? 'step' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  opacity: idx > currentStageIndex ? 0.48 : 1,
                }}
              >
                <span style={{ marginTop: '2px' }}>
                  {isFailedHere ? (
                    <AlertTriangle
                      size={20}
                      strokeWidth={1.5}
                      color="var(--danger)"
                    />
                  ) : isCompleted ? (
                    <CheckCircle2
                      size={20}
                      strokeWidth={1.5}
                      color="var(--evidence-transcript)"
                    />
                  ) : (
                    <Circle
                      size={20}
                      strokeWidth={1.5}
                      color={isCurrent ? 'var(--accent)' : 'var(--text-muted)'}
                    />
                  )}
                </span>
                <div>
                  <div style={{ fontWeight: isCurrent || isFailedHere ? 600 : 500 }}>
                    {stage.label}
                    {isCurrent && (
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--accent-label)',
                        }}
                      >
                        (in progress)
                      </span>
                    )}
                    {isFailedHere && (
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--danger)',
                        }}
                      >
                        (failed)
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {stage.detail}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Honest Failure State (Section 6.8.B, FR-007, Principle 8) */}
      {job.status === 'failed' && (
        <div
          role="alert"
          className="af-panel"
          style={{
            borderColor: 'var(--danger)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--text-md)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              color: 'var(--danger)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Stage failed: {job.failed_stage ?? job.current_stage} (
            {job.last_error_code ?? 'ERROR'})
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-2)',
            }}
          >
            {job.last_error_message ||
              'The stage could not complete with the current provider configuration.'}
          </p>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <strong>What was saved:</strong> Canonical source record and{' '}
            {evidenceCount} retrieved/supplied evidence segment(s) are preserved
            in your job history. No artifact has been saved to your Library.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            {/* Single Primary Action on Failed Screen */}
            <button
              type="button"
              disabled={busy}
              className="af-btn af-btn-primary"
              onClick={async () => {
                setBusy(true);
                try {
                  await onRetryStage();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RotateCw size={16} strokeWidth={1.5} />
              <span>{retryButtonLabel}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              className="af-btn"
              onClick={() => setShowTranscriptFallback((v) => !v)}
            >
              <FileText size={16} strokeWidth={1.5} />
              <span>Paste a transcript instead</span>
            </button>

            {evidenceCount > 0 && (
              <button
                type="button"
                disabled={busy}
                className="af-btn"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onManualDraft();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <PenTool size={16} strokeWidth={1.5} />
                <span>Draft manually from transcript (no AI)</span>
              </button>
            )}
          </div>

          {showTranscriptFallback && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <label
                htmlFor="af-retry-transcript"
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  marginBottom: 'var(--space-1)',
                }}
              >
                Paste spoken transcript to resume from analysis
              </label>
              <textarea
                id="af-retry-transcript"
                className="af-textarea"
                value={fallbackTranscript}
                onChange={(e) => setFallbackTranscript(e.target.value)}
                placeholder="0:00 First step spoken in the video..."
                rows={4}
              />
              <div style={{ marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  disabled={busy || fallbackTranscript.trim().length < 10}
                  className="af-btn"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onRetryStage(fallbackTranscript.trim());
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Save transcript & run analysis
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slow processing notice (Section 6.8.B) */}
      {slowNotice &&
        job.status !== 'failed' &&
        job.status !== 'cancelled' &&
        job.status !== 'needs_review' && (
          <div
            className="af-panel-raised"
            style={{
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--text-sm)',
            }}
          >
            This job is still running in the background. You may leave this
            screen safely—when ready, it will appear under “Ready for review” on
            Capture.
          </div>
        )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="button"
          className="af-btn"
          onClick={onCancelJob}
          disabled={job.status === 'cancelled'}
        >
          <XCircle size={16} strokeWidth={1.5} />
          <span>Cancel</span>
        </button>
        <button type="button" className="af-btn" onClick={onLeaveScreen}>
          Back to Capture
        </button>
      </div>
    </div>
  );
};

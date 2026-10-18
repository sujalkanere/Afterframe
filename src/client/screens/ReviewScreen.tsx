import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  PROHIBITED_TOPIC_SLUGS,
  type ExtractionCandidateEnvelope,
  type MvpArtifactType,
  type ProvenanceKind,
  type SkillSpecPayload,
  type TaskCandidatePayload,
  type ValidationFinding,
} from '../../shared/contracts.js';
import { formatTimestampMs } from '../../shared/time.js';
import { ProvenanceChip } from '../components/ProvenanceChip.js';
import { FrameBrackets } from '../components/FrameBrackets.js';

export interface ReviewEvidenceSegment {
  id: string;
  kind: 'metadata' | 'caption' | 'transcript' | 'visual_observation' | 'user_provided';
  content_text: string;
  start_ms: number | null;
  end_ms: number | null;
  provenance: string;
  limitations_json: string[];
}

export interface ReviewScreenProps {
  jobId: string;
  sourceUrl: string;
  initialEnvelope: ExtractionCandidateEnvelope;
  initialFindings: ValidationFinding[];
  evidence: ReviewEvidenceSegment[];
  reducedMotion: boolean;
  onConfirmSave: (payload: {
    job_id: string;
    selected_type: MvpArtifactType;
    provenance_mode: 'model_extracted' | 'user_edited' | 'user_created';
    task_payload?: TaskCandidatePayload;
    skill_payload?: SkillSpecPayload;
    user_deadline?: string | null;
  }) => Promise<{
    ok: boolean;
    artifactId?: string;
    message?: string;
    findings?: ValidationFinding[];
  }>;
  onDiscard: () => void;
  onOpenSavedArtifact: (artifactId: string) => void;
}

/**
 * Screen C — Review and Edit (Section 6.8.C).
 * - Two columns on desktop; single column + mobile evidence bottom sheet on small viewports.
 * - Task / AI Skill switch with source-grounded recommendation reason.
 * - Bidirectional step <-> evidence highlighting via ProvenanceChip.
 * - Local draft preservation across refresh (FR-062), distinct from saving to Library.
 * - "The Kept Moment" signature confirmation on save (Section 6.4.2).
 */
export const ReviewScreen: React.FC<ReviewScreenProps> = ({
  jobId,
  sourceUrl,
  initialEnvelope,
  initialFindings,
  evidence,
  reducedMotion,
  onConfirmSave,
  onDiscard,
  onOpenSavedArtifact,
}) => {
  const storageKey = `af_review_draft_${jobId}`;

  const [selectedType, setSelectedType] = useState<MvpArtifactType>(
    initialEnvelope.recommended_type
  );
  const [taskDraft, setTaskDraft] = useState<TaskCandidatePayload>(
    initialEnvelope.task_candidate
  );
  const [skillDraft, setSkillDraft] = useState<SkillSpecPayload>(
    initialEnvelope.skill_candidate
  );
  const [topicsInput, setTopicsInput] = useState<string>(
    initialEnvelope.task_candidate.topics.join(', ')
  );
  const [userDeadline, setUserDeadline] = useState<string>('');
  const [hasUserEdits, setHasUserEdits] = useState<boolean>(false);
  const [restoredFromLocal, setRestoredFromLocal] = useState<boolean>(false);

  const [activeStepId, setActiveStepId] = useState<string | null>(
    initialEnvelope.task_candidate.steps[0]?.id ?? null
  );
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(false);

  const [serverFindings, setServerFindings] =
    useState<ValidationFinding[]>(initialFindings);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedArtifactId, setSavedArtifactId] = useState<string | null>(null);

  const evidenceRefsMap = useRef<Record<string, HTMLElement | null>>({});

  // Restore local draft edits on mount if present (FR-062)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.selectedType) setSelectedType(saved.selectedType);
        if (saved.taskDraft) setTaskDraft(saved.taskDraft);
        if (saved.skillDraft) setSkillDraft(saved.skillDraft);
        if (saved.topicsInput) setTopicsInput(saved.topicsInput);
        if (saved.userDeadline) setUserDeadline(saved.userDeadline);
        setHasUserEdits(true);
        setRestoredFromLocal(true);
      }
    } catch {
      // Ignore storage parse errors
    }
  }, [storageKey]);

  // Autosave in-progress review edits locally (FR-062)
  useEffect(() => {
    if (!hasUserEdits || savedArtifactId) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          selectedType,
          taskDraft,
          skillDraft,
          topicsInput,
          userDeadline,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [
    hasUserEdits,
    savedArtifactId,
    selectedType,
    skillDraft,
    storageKey,
    taskDraft,
    topicsInput,
    userDeadline,
  ]);

  const evidenceMap = useMemo(() => {
    const map = new Map<string, ReviewEvidenceSegment>();
    for (const ev of evidence) {
      map.set(ev.id, ev);
    }
    return map;
  }, [evidence]);

  const parsedTopics = useMemo(() => {
    return topicsInput
      .split(',')
      .map((s) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-|-$/g, '')
      )
      .filter(Boolean);
  }, [topicsInput]);

  // Client-side live validation checks (blocking errors vs non-blocking warnings)
  const liveBlockingErrors = useMemo(() => {
    const errs: string[] = [];
    if ( parsedTopics.length === 0) {
      errs.push('Add at least one topical category (for example: coding, git, health).');
    }
    for (const t of parsedTopics) {
      if (PROHIBITED_TOPIC_SLUGS.has(t)) {
        errs.push(
          `"${t}" is not a valid topical category (artifact types and "short-term" are not topics).`
        );
      }
    }
    if (selectedType === 'task') {
      if (!taskDraft.title.trim()) errs.push('Task title is required.');
      if (taskDraft.steps.length === 0) {
        errs.push('At least one ordered step is required.');
      }
      taskDraft.steps.forEach((s, idx) => {
        if (!s.title.trim()) errs.push(`Step ${idx + 1} requires a title.`);
      });
    } else {
      if (!skillDraft.identity.title.trim()) {
        errs.push('Skill title is required.');
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillDraft.identity.name.trim())) {
        errs.push('Skill slug name must be lowercase kebab-case.');
      }
      if (skillDraft.workflow_steps.length === 0) {
        errs.push('At least one workflow step is required.');
      }
    }
    return errs;
  }, [parsedTopics, selectedType, skillDraft, taskDraft]);

  const activeSteps =
    selectedType === 'task' ? taskDraft.steps : skillDraft.workflow_steps;

  const activeStepEvidenceRefs = useMemo(() => {
    if (!activeStepId) return [];
    const found = activeSteps.find((s) => s.id === activeStepId);
    return found ? found.evidence_refs : [];
  }, [activeStepId, activeSteps]);

  const getPrimaryTimestampForRefs = (refs: string[]): string | null => {
    for (const ref of refs) {
      const ev = evidenceMap.get(ref);
      if (ev && ev.start_ms !== null) {
        return formatTimestampMs(ev.start_ms);
      }
    }
    return null;
  };

  const handleSelectChip = (stepId: string, refs: string[]) => {
    setActiveStepId(stepId);
    if (refs.length > 0) {
      const firstId = refs[0];
      setActiveEvidenceId(firstId);
      const el = evidenceRefsMap.current[firstId];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
      }
    }
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileSheetOpen(true);
    }
  };

  const handleToggleEvidenceRefForActiveStep = (evId: string) => {
    if (!activeStepId) return;
    setHasUserEdits(true);

    if (selectedType === 'task') {
      setTaskDraft((prev) => ({
        ...prev,
        steps: prev.steps.map((st) => {
          if (st.id !== activeStepId) return st;
          const exists = st.evidence_refs.includes(evId);
          const nextRefs = exists
            ? st.evidence_refs.filter((r) => r !== evId)
            : [...st.evidence_refs, evId];
          const nextKind: ProvenanceKind =
            nextRefs.length > 0 ? 'transcript' : 'inferred';
          return {
            ...st,
            evidence_refs: nextRefs,
            provenance_kind: st.is_user_edited ? 'user_edited' : nextKind,
            is_inferred: nextRefs.length === 0,
          };
        }),
      }));
    } else {
      setSkillDraft((prev) => ({
        ...prev,
        workflow_steps: prev.workflow_steps.map((st) => {
          if (st.id !== activeStepId) return st;
          const exists = st.evidence_refs.includes(evId);
          const nextRefs = exists
            ? st.evidence_refs.filter((r) => r !== evId)
            : [...st.evidence_refs, evId];
          return {
            ...st,
            evidence_refs: nextRefs,
          };
        }),
      }));
    }
  };

  const handleSave = async () => {
    if (liveBlockingErrors.length > 0) return;
    setSaving(true);
    setSaveError(null);

    try {
      const normalizedTask: TaskCandidatePayload = {
        ...taskDraft,
        topics: parsedTopics,
        steps: taskDraft.steps.map((s, idx) => ({
          ...s,
          position: idx,
        })),
      };

      const normalizedSkill: SkillSpecPayload = {
        ...skillDraft,
        topics: parsedTopics,
        workflow_steps: skillDraft.workflow_steps.map((s, idx) => ({
          ...s,
          position: idx,
        })),
      };

      const res = await onConfirmSave({
        job_id: jobId,
        selected_type: selectedType,
        provenance_mode: hasUserEdits ? 'user_edited' : 'model_extracted',
        task_payload: selectedType === 'task' ? normalizedTask : undefined,
        skill_payload:
          selectedType === 'ai_skill' ? normalizedSkill : undefined,
        user_deadline:
          selectedType === 'task' && userDeadline
            ? new Date(userDeadline).toISOString()
            : null,
      });

      if (!res.ok || !res.artifactId) {
        setSaveError(res.message ?? 'Validation failed.');
        if (res.findings) setServerFindings(res.findings);
        return;
      }

      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
      setSavedArtifactId(res.artifactId);
    } finally {
      setSaving(false);
    }
  };

  // Signature Moment 2: The Kept Moment (Section 6.4.2)
  if (savedArtifactId) {
    const savedTitle =
      selectedType === 'task' ? taskDraft.title : skillDraft.identity.title;
    return (
      <div style={{ maxWidth: '640px', margin: '48px auto' }}>
        <div role="status" aria-live="polite" className="af-panel">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--evidence-transcript)',
              marginBottom: 'var(--space-3)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={20} strokeWidth={1.5} />
            <span>Kept. Saved to your Library.</span>
          </div>

          <FrameBrackets animate={!reducedMotion} active={true}>
            <div
              style={{
                padding: 'var(--space-4)',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-frame)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent-label)',
                  marginBottom: '4px',
                }}
              >
                {selectedType === 'ai_skill'
                  ? 'Saved AI skill specification'
                  : 'Saved task'}
              </div>
              <h1
                className="af-display"
                style={{ fontSize: 'var(--text-xl)' }}
              >
                {savedTitle}
              </h1>
            </div>
          </FrameBrackets>

          <p
            style={{
              marginTop: 'var(--space-4)',
              marginBottom: 'var(--space-6)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
            }}
          >
            Your confirmed artifact and its linked source provenance are now
            stored in your Library and visible in the Afterframe Atlas.
          </p>

          {/* Single Primary Action */}
          <button
            type="button"
            className="af-btn af-btn-primary"
            onClick={() => onOpenSavedArtifact(savedArtifactId)}
          >
            View in Library
          </button>
        </div>
      </div>
    );
  }

  const renderEvidencePane = () => (
    <div className="af-panel">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Source evidence</h2>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {evidence.length} segment(s)
        </span>
      </div>

      {/* Explicit note stating which evidence kinds were and were not analyzed (Section 6.8.C, FR-014) */}
      <div
        className="af-panel-raised"
        style={{
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        <div>
          <strong>Evidence coverage:</strong>{' '}
          {initialEnvelope.evidence_summary?.visual_note ||
            'Visual frames: not analyzed. The transcript was sufficient.'}
        </div>
        <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
          <strong>Source:</strong> {sourceUrl}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          maxHeight: '540px',
          overflowY: 'auto',
        }}
      >
        {evidence.map((ev) => {
          const isCitedByActiveStep = activeStepEvidenceRefs.includes(ev.id);
          const isFocused = activeEvidenceId === ev.id || isCitedByActiveStep;
          const tsLabel = formatTimestampMs(ev.start_ms);

          // Find which steps cite this evidence
          const citingStepNumbers = activeSteps
            .map((st, idx) => (st.evidence_refs.includes(ev.id) ? idx + 1 : null))
            .filter((n): n is number => n !== null);

          return (
            <div
              key={ev.id}
              ref={(el) => {
                evidenceRefsMap.current[ev.id] = el;
              }}
              onClick={() => {
                setActiveEvidenceId(ev.id);
                handleToggleEvidenceRefForActiveStep(ev.id);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleEvidenceRefForActiveStep(ev.id);
                }
              }}
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-control)',
                border: isFocused
                  ? '2px solid var(--evidence-transcript)'
                  : '1px solid var(--line)',
                background: isFocused ? 'var(--surface-2)' : 'var(--surface-1)',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <span
                  style={{
                    color: 'var(--evidence-transcript)',
                    fontWeight: 600,
                  }}
                >
                  {ev.kind === 'visual_observation'
                    ? `Frame ${tsLabel ?? ''}`
                    : ev.kind === 'metadata'
                      ? 'Metadata'
                      : `Transcript ${tsLabel ?? 'segment'}`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {citingStepNumbers.length > 0
                    ? `Cited by step ${citingStepNumbers.join(', ')}`
                    : 'Click to cite in active step'}
                </span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)' }}>{ev.content_text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <h1
            className="af-display"
            style={{ fontSize: 'var(--text-xl)' }}
          >
            Review and confirm candidate
          </h1>
          {hasUserEdits && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent-label)',
                border: '1px dashed var(--accent-label)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-frame)',
              }}
            >
              {restoredFromLocal
                ? 'Restored unsaved local draft edits (not yet saved to Library)'
                : 'Draft edits preserved locally on this device (not yet saved to Library)'}
            </span>
          )}
        </div>

        {/* Destination switch + one-sentence source-grounded reason (Section 6.8.C, FR-022) */}
        <div
          className="af-panel-raised"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Recommended destination:{' '}
              {initialEnvelope.recommended_type === 'ai_skill'
                ? 'AI skill'
                : 'Task'}
            </div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
              }}
            >
              {initialEnvelope.recommendation_reason}
            </div>
          </div>

          <div
            role="group"
            aria-label="Choose artifact destination"
            style={{ display: 'flex', gap: 'var(--space-2)' }}
          >
            <button
              type="button"
              className="af-btn"
              aria-pressed={selectedType === 'task'}
              onClick={() => {
                setSelectedType('task');
                setHasUserEdits(true);
              }}
              style={{
                borderColor:
                  selectedType === 'task' ? 'var(--accent)' : 'var(--line)',
                background:
                  selectedType === 'task'
                    ? 'var(--surface-1)'
                    : 'transparent',
              }}
            >
              <CheckSquare size={16} strokeWidth={1.5} />
              <span>Task</span>
            </button>
            <button
              type="button"
              className="af-btn"
              aria-pressed={selectedType === 'ai_skill'}
              onClick={() => {
                setSelectedType('ai_skill');
                setHasUserEdits(true);
              }}
              style={{
                borderColor:
                  selectedType === 'ai_skill' ? 'var(--accent)' : 'var(--line)',
                background:
                  selectedType === 'ai_skill'
                    ? 'var(--surface-1)'
                    : 'transparent',
              }}
            >
              <Sparkles size={16} strokeWidth={1.5} />
              <span>AI skill</span>
            </button>
          </div>
        </div>
      </header>

      {(liveBlockingErrors.length > 0 || saveError) && (
        <div
          role="alert"
          className="af-panel"
          style={{
            borderColor: 'var(--danger)',
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--danger)',
              fontWeight: 600,
              marginBottom: 'var(--space-2)',
            }}
          >
            <AlertCircle size={18} strokeWidth={1.5} />
            <span>Fix the following before saving:</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: 'var(--text-sm)' }}>
            {saveError && <li>{saveError}</li>}
            {liveBlockingErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {serverFindings
              .filter((f) => f.severity === 'error')
              .map((f, i) => (
                <li key={`srv-${i}`}>
                  [{f.layer}] {f.message}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="af-review-grid">
        {/* Left Column: Editable Draft */}
        <div className="af-panel">
          {selectedType === 'task' ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
              }}
            >
              <div>
                <label
                  htmlFor="af-review-task-title"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: '4px',
                  }}
                >
                  Task title
                </label>
                <input
                  id="af-review-task-title"
                  type="text"
                  className="af-input"
                  value={taskDraft.title}
                  onChange={(e) => {
                    setHasUserEdits(true);
                    setTaskDraft((p) => ({ ...p, title: e.target.value }));
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="af-review-task-desc"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: '4px',
                  }}
                >
                  Practical description
                </label>
                <textarea
                  id="af-review-task-desc"
                  className="af-textarea"
                  rows={3}
                  value={taskDraft.description}
                  onChange={(e) => {
                    setHasUserEdits(true);
                    setTaskDraft((p) => ({
                      ...p,
                      description: e.target.value,
                    }));
                  }}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <label
                    htmlFor="af-review-topics"
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      marginBottom: '4px',
                    }}
                  >
                    Topics (comma-separated, e.g. coding, git)
                  </label>
                  <input
                    id="af-review-topics"
                    type="text"
                    className="af-input"
                    value={topicsInput}
                    onChange={(e) => {
                      setHasUserEdits(true);
                      setTopicsInput(e.target.value);
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="af-review-deadline"
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      marginBottom: '4px',
                    }}
                  >
                    Optional deadline (user-set only)
                  </label>
                  <input
                    id="af-review-deadline"
                    type="date"
                    className="af-input"
                    value={userDeadline}
                    onChange={(e) => {
                      setHasUserEdits(true);
                      setUserDeadline(e.target.value);
                    }}
                  />
                </div>
              </div>

              {/* Ordered Task Steps with Provenance Chips */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <h3 style={{ fontSize: 'var(--text-md)' }}>
                    Ordered subtasks ({taskDraft.steps.length})
                  </h3>
                  <button
                    type="button"
                    className="af-btn"
                    onClick={() => {
                      setHasUserEdits(true);
                      const newId = `step_${Date.now()}`;
                      setTaskDraft((p) => ({
                        ...p,
                        steps: [
                          ...p.steps,
                          {
                            id: newId,
                            position: p.steps.length,
                            title: 'New subtask',
                            description: '',
                            provenance_kind: 'user_edited',
                            is_inferred: false,
                            is_user_edited: true,
                            evidence_refs: [],
                            caveats: null,
                          },
                        ],
                      }));
                      setActiveStepId(newId);
                    }}
                  >
                    <Plus size={16} strokeWidth={1.5} />
                    <span>Add step</span>
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  {taskDraft.steps.map((step, idx) => {
                    const isSelected = activeStepId === step.id;
                    const tsLabel = getPrimaryTimestampForRefs(
                      step.evidence_refs
                    );
                    const isInferredWarning =
                      step.provenance_kind === 'inferred' || step.is_inferred;

                    return (
                      <div
                        key={step.id}
                        onClick={() => setActiveStepId(step.id)}
                        className="af-panel-raised"
                        style={{
                          borderColor: isSelected
                            ? 'var(--focus)'
                            : 'var(--line)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            marginBottom: 'var(--space-2)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-2)',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              Step {idx + 1}
                            </span>
                            <ProvenanceChip
                              kind={step.provenance_kind}
                              timestampLabel={tsLabel}
                              active={isSelected}
                              onClick={() =>
                                handleSelectChip(step.id, step.evidence_refs)
                              }
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="af-btn"
                              disabled={idx === 0}
                              aria-label={`Move step ${idx + 1} up`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setHasUserEdits(true);
                                setTaskDraft((p) => {
                                  const copy = [...p.steps];
                                  const tmp = copy[idx - 1];
                                  copy[idx - 1] = copy[idx];
                                  copy[idx] = tmp;
                                  return {
                                    ...p,
                                    steps: copy.map((s, i) => ({
                                      ...s,
                                      position: i,
                                    })),
                                  };
                                });
                              }}
                            >
                              <ArrowUp size={15} strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              className="af-btn"
                              disabled={idx === taskDraft.steps.length - 1}
                              aria-label={`Move step ${idx + 1} down`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setHasUserEdits(true);
                                setTaskDraft((p) => {
                                  const copy = [...p.steps];
                                  const tmp = copy[idx + 1];
                                  copy[idx + 1] = copy[idx];
                                  copy[idx] = tmp;
                                  return {
                                    ...p,
                                    steps: copy.map((s, i) => ({
                                      ...s,
                                      position: i,
                                    })),
                                  };
                                });
                              }}
                            >
                              <ArrowDown size={15} strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              className="af-btn af-btn-danger"
                              disabled={taskDraft.steps.length <= 1}
                              aria-label={`Remove step ${idx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setHasUserEdits(true);
                                setTaskDraft((p) => ({
                                  ...p,
                                  steps: p.steps
                                    .filter((s) => s.id !== step.id)
                                    .map((s, i) => ({ ...s, position: i })),
                                }));
                              }}
                            >
                              <Trash2 size={15} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          aria-label={`Step ${idx + 1} title`}
                          className="af-input"
                          value={step.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHasUserEdits(true);
                            setTaskDraft((p) => ({
                              ...p,
                              steps: p.steps.map((s) =>
                                s.id === step.id
                                  ? {
                                      ...s,
                                      title: val,
                                      provenance_kind: 'user_edited',
                                      is_user_edited: true,
                                    }
                                  : s
                              ),
                            }));
                          }}
                          style={{ marginBottom: 'var(--space-2)' }}
                        />

                        <textarea
                          aria-label={`Step ${idx + 1} description`}
                          className="af-textarea"
                          rows={2}
                          value={step.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHasUserEdits(true);
                            setTaskDraft((p) => ({
                              ...p,
                              steps: p.steps.map((s) =>
                                s.id === step.id
                                  ? {
                                      ...s,
                                      description: val,
                                      provenance_kind: 'user_edited',
                                      is_user_edited: true,
                                    }
                                  : s
                              ),
                            }));
                          }}
                        />

                        {/* Inline warning next to affected field (Section 6.8.C) */}
                        {isInferredWarning && (
                          <div
                            style={{
                              marginTop: 'var(--space-2)',
                              fontSize: 'var(--text-xs)',
                              color: 'var(--accent-label)',
                            }}
                          >
                            No spoken evidence for this detail. Kept as
                            inference.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* AI Skill Editor */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <label
                    htmlFor="af-skill-title"
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      marginBottom: '4px',
                    }}
                  >
                    Skill title
                  </label>
                  <input
                    id="af-skill-title"
                    type="text"
                    className="af-input"
                    value={skillDraft.identity.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHasUserEdits(true);
                      setSkillDraft((p) => ({
                        ...p,
                        identity: { ...p.identity, title: val },
                      }));
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="af-skill-slug"
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      marginBottom: '4px',
                    }}
                  >
                    Canonical skill slug (kebab-case)
                  </label>
                  <input
                    id="af-skill-slug"
                    type="text"
                    className="af-input"
                    value={skillDraft.identity.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHasUserEdits(true);
                      setSkillDraft((p) => ({
                        ...p,
                        identity: { ...p.identity, name: val },
                      }));
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="af-skill-desc"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: '4px',
                  }}
                >
                  Skill description
                </label>
                <textarea
                  id="af-skill-desc"
                  className="af-textarea"
                  rows={3}
                  value={skillDraft.identity.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHasUserEdits(true);
                    setSkillDraft((p) => ({
                      ...p,
                      identity: { ...p.identity, description: val },
                    }));
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="af-skill-topics"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: '4px',
                  }}
                >
                  Topics (comma-separated)
                </label>
                <input
                  id="af-skill-topics"
                  type="text"
                  className="af-input"
                  value={topicsInput}
                  onChange={(e) => {
                    setHasUserEdits(true);
                    setTopicsInput(e.target.value);
                  }}
                />
              </div>

              <div>
                <h3
                  style={{
                    fontSize: 'var(--text-md)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  Ordered workflow steps ({skillDraft.workflow_steps.length})
                </h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  {skillDraft.workflow_steps.map((step, idx) => {
                    const isSelected = activeStepId === step.id;
                    const tsLabel = getPrimaryTimestampForRefs(
                      step.evidence_refs
                    );
                    return (
                      <div
                        key={step.id}
                        onClick={() => setActiveStepId(step.id)}
                        className="af-panel-raised"
                        style={{
                          borderColor: isSelected
                            ? 'var(--focus)'
                            : 'var(--line)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--space-2)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-2)',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 'var(--text-xs)',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                              }}
                            >
                              Workflow {idx + 1}
                            </span>
                            <ProvenanceChip
                              kind={step.provenance_kind}
                              timestampLabel={tsLabel}
                              active={isSelected}
                              onClick={() =>
                                handleSelectChip(step.id, step.evidence_refs)
                              }
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          aria-label={`Workflow step ${idx + 1} title`}
                          className="af-input"
                          value={step.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHasUserEdits(true);
                            setSkillDraft((p) => ({
                              ...p,
                              workflow_steps: p.workflow_steps.map((s) =>
                                s.id === step.id
                                  ? {
                                      ...s,
                                      title: val,
                                      provenance_kind: 'user_edited',
                                      is_user_edited: true,
                                    }
                                  : s
                              ),
                            }));
                          }}
                          style={{ marginBottom: 'var(--space-2)' }}
                        />
                        <textarea
                          aria-label={`Workflow step ${idx + 1} instruction`}
                          className="af-textarea"
                          rows={2}
                          value={step.instruction}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHasUserEdits(true);
                            setSkillDraft((p) => ({
                              ...p,
                              workflow_steps: p.workflow_steps.map((s) =>
                                s.id === step.id
                                  ? {
                                      ...s,
                                      instruction: val,
                                      provenance_kind: 'user_edited',
                                      is_user_edited: true,
                                    }
                                  : s
                              ),
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Evidence Pane on Desktop */}
        <div>{renderEvidencePane()}</div>
      </div>

      {/* Mobile Bottom Sheet for Evidence (Section 6.8.C) */}
      {mobileSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Supporting source evidence"
          onClick={() => setMobileSheetOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 18, 22, 0.72)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 45,
          }}
        >
          <div
            className="af-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '78vh',
              overflowY: 'auto',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-3)',
              }}
            >
              <strong>Supporting source evidence</strong>
              <button
                type="button"
                className="af-btn"
                onClick={() => setMobileSheetOpen(false)}
              >
                <X size={16} strokeWidth={1.5} />
                <span>Close</span>
              </button>
            </div>
            {renderEvidencePane()}
          </div>
        </div>
      )}

      {/* Sticky Action Bar with Discard (secondary) and ONE Primary Save button (Section 6.8.C) */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 'var(--space-6)',
          padding: 'var(--space-4)',
          background: 'var(--surface-1)',
          borderTop: '1px solid var(--line)',
          borderRadius: 'var(--radius-panel)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          zIndex: 25,
        }}
      >
        <button
          type="button"
          className="af-btn"
          onClick={() => {
            try {
              localStorage.removeItem(storageKey);
            } catch {
              // Ignore
            }
            onDiscard();
          }}
        >
          Discard
        </button>

        <button
          type="button"
          disabled={saving || liveBlockingErrors.length > 0}
          className="af-btn af-btn-primary"
          onClick={handleSave}
        >
          {saving
            ? 'Saving…'
            : selectedType === 'ai_skill'
              ? 'Save AI skill'
              : 'Save task'}
        </button>
      </div>
    </div>
  );
};

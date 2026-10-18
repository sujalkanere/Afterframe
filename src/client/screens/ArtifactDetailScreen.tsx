import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckSquare,
  Sparkles,
  Trash2,
  RotateCcw,
  Download,
  ExternalLink,
  History,
  ShieldCheck,
} from 'lucide-react';
import type {
  ProvenanceKind,
  SkillSpecPayload,
} from '../../shared/contracts.js';
import type { RenderedSkillPackage } from '../../server/export/skill-renderer.js';
import { formatTimestampMs } from '../../shared/time.js';
import { ProvenanceChip } from '../components/ProvenanceChip.js';

export interface ArtifactDetailData {
  id: string;
  artifact_type: 'task' | 'ai_skill';
  title: string;
  description: string;
  status: string;
  provenance_mode: string;
  delete_undo_until: string | null;
  created_at: string;
  updated_at: string;
  topics: string[];
  sources: Array<{
    id: string;
    platform: string;
    submitted_url: string;
    canonical_url: string;
    platform_content_id: string;
    metadata_json: Record<string, unknown>;
    processing_run_id: string | null;
    pipeline_version: string | null;
    provider_id: string | null;
    model_id: string | null;
  }>;
  evidence: Array<{
    id: string;
    kind: string;
    content_text: string;
    start_ms: number | null;
    end_ms: number | null;
    provenance: string;
    limitations_json: string[];
  }>;
  task: {
    deadline: string | null;
    completion_status: string;
    estimated_minutes: number | null;
    steps: Array<{
      id: string;
      position: number;
      title: string;
      description: string;
      status: string;
      provenance_kind: ProvenanceKind;
      is_inferred: boolean;
      is_user_edited: boolean;
      evidence_refs: string[];
    }>;
  } | null;
  skill: {
    currentVersion: {
      id: string;
      version_number: number;
      schema_version: string;
      spec_json: SkillSpecPayload;
      content_hash: string;
      created_at: string;
    } | null;
    versions: Array<{
      id: string;
      version_number: number;
      schema_version: string;
      spec_json: SkillSpecPayload;
      content_hash: string;
      created_at: string;
    }>;
    exports: Array<{
      id: string;
      target: string;
      renderer_version: string;
      package_hash: string;
      validation_status: string;
      tested_in_target: boolean;
      created_at: string;
    }>;
  } | null;
}

export interface ArtifactDetailScreenProps {
  artifact: ArtifactDetailData;
  onBack: () => void;
  onToggleTaskStep: (
    artifactId: string,
    stepId: string,
    nextStatus: 'todo' | 'completed'
  ) => Promise<void>;
  onUpdateTitleAndDesc: (
    artifactId: string,
    title: string,
    description: string
  ) => Promise<void>;
  onSaveNewSkillVersion: (
    artifactId: string,
    spec: SkillSpecPayload
  ) => Promise<void>;
  onInitiateDelete: (
    artifactId: string
  ) => Promise<{ ok: boolean; undoUntil?: string }>;
  onUndoDelete: (artifactId: string) => Promise<boolean>;
  onFinalizeDelete: (artifactId: string) => Promise<void>;
  onExportSkill: (
    artifactId: string,
    target: 'claude_code_skill' | 'codex_agents_skill'
  ) => Promise<{ ok: boolean; pkg?: RenderedSkillPackage; message?: string }>;
}

/**
 * Screen E & Screen F — Artifact Detail & Skill Export (Section 6.8.E & 6.8.F).
 * - Editable fields, topics, version history (FR-054), original source link & extraction provenance.
 * - Delete with a 10-second undo banner (FR-063) before executing retention policy (FR-057).
 * - Skill export preview before download; distinguishes valid, compatible, and tested (FR-037).
 */
export const ArtifactDetailScreen: React.FC<ArtifactDetailScreenProps> = ({
  artifact,
  onBack,
  onToggleTaskStep,
  onUpdateTitleAndDesc,
  onSaveNewSkillVersion,
  onInitiateDelete,
  onUndoDelete,
  onFinalizeDelete,
  onExportSkill,
}) => {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(artifact.title);
  const [editDesc, setEditDesc] = useState(artifact.description);
  const [highlightedEvidenceId, setHighlightedEvidenceId] = useState<
    string | null
  >(null);

  // 10-second Undo Deletion state (FR-063)
  const [pendingDeleteSeconds, setPendingDeleteSeconds] = useState<
    number | null
  >(null);

  // Skill Export state (Section 6.8.F)
  const [exportTarget, setExportTarget] = useState<
    'claude_code_skill' | 'codex_agents_skill'
  >('claude_code_skill');
  const [exportPkg, setExportPkg] = useState<RenderedSkillPackage | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setEditTitle(artifact.title);
    setEditDesc(artifact.description);
  }, [artifact.title, artifact.description]);

  useEffect(() => {
    if (pendingDeleteSeconds === null) return;
    if (pendingDeleteSeconds <= 0) {
      onFinalizeDelete(artifact.id);
      return;
    }
    const timer = setTimeout(() => {
      setPendingDeleteSeconds((s) => (s !== null ? s - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [artifact.id, onFinalizeDelete, pendingDeleteSeconds]);

  const handleDeleteClick = async () => {
    const res = await onInitiateDelete(artifact.id);
    if (res.ok) {
      setPendingDeleteSeconds(10);
    }
  };

  const handleUndoClick = async () => {
    const ok = await onUndoDelete(artifact.id);
    if (ok) {
      setPendingDeleteSeconds(null);
    }
  };

  const handleSaveEdits = async () => {
    if (artifact.artifact_type === 'ai_skill' && artifact.skill?.currentVersion) {
      const currentSpec = artifact.skill.currentVersion.spec_json;
      await onSaveNewSkillVersion(artifact.id, {
        ...currentSpec,
        identity: {
          ...currentSpec.identity,
          title: editTitle.trim() || currentSpec.identity.title,
          description: editDesc.trim() || currentSpec.identity.description,
        },
      });
    } else {
      await onUpdateTitleAndDesc(
        artifact.id,
        editTitle.trim(),
        editDesc.trim()
      );
    }
    setEditing(false);
  };

  const handleRunExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await onExportSkill(artifact.id, exportTarget);
      if (!res.ok || !res.pkg) {
        setExportError(res.message ?? 'Could not generate skill export.');
      } else {
        setExportPkg(res.pkg);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop() || 'SKILL.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* 10-Second Undo Deletion Banner (FR-063) */}
      {pendingDeleteSeconds !== null && (
        <div
          role="alert"
          aria-live="assertive"
          className="af-panel"
          style={{
            borderColor: 'var(--danger)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <strong>Artifact scheduled for deletion in {pendingDeleteSeconds}s.</strong>{' '}
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Unreferenced source evidence will be purged when the timer finishes.
            </span>
          </div>
          <button
            type="button"
            className="af-btn af-btn-primary"
            onClick={handleUndoClick}
          >
            <RotateCcw size={16} strokeWidth={1.5} />
            <span>Undo delete</span>
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-4)',
        }}
      >
        <button type="button" className="af-btn" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span>Back to Library</span>
        </button>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="af-btn"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Cancel edit' : 'Edit'}
          </button>
          <button
            type="button"
            className="af-btn af-btn-danger"
            onClick={handleDeleteClick}
            disabled={pendingDeleteSeconds !== null}
          >
            <Trash2 size={16} strokeWidth={1.5} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="af-review-grid">
        {/* Left: Artifact Content & Steps / SkillSpec */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="af-panel">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
                color: 'var(--accent-label)',
                marginBottom: 'var(--space-2)',
              }}
            >
              {artifact.artifact_type === 'ai_skill' ? (
                <>
                  <Sparkles size={16} strokeWidth={1.5} />
                  <span>AI skill specification</span>
                </>
              ) : (
                <>
                  <CheckSquare size={16} strokeWidth={1.5} />
                  <span>Task artifact</span>
                </>
              )}
              <span>·</span>
              <span>
                Provenance:{' '}
                {artifact.provenance_mode === 'user_created'
                  ? 'User-created'
                  : artifact.provenance_mode === 'user_edited'
                    ? 'Reviewed & edited by you'
                    : 'Model-extracted & confirmed'}
              </span>
            </div>

            {editing ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <label htmlFor="af-detail-edit-title" className="af-sr-only">
                  Artifact title
                </label>
                <input
                  id="af-detail-edit-title"
                  type="text"
                  className="af-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <label htmlFor="af-detail-edit-desc" className="af-sr-only">
                  Artifact description
                </label>
                <textarea
                  id="af-detail-edit-desc"
                  className="af-textarea"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
                <div>
                  <button
                    type="button"
                    className="af-btn af-btn-primary"
                    onClick={handleSaveEdits}
                  >
                    {artifact.artifact_type === 'ai_skill'
                      ? 'Save new skill version'
                      : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1
                  className="af-display"
                  style={{
                    fontSize: 'var(--text-xl)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  {artifact.title}
                </h1>
                <p
                  style={{
                    fontSize: 'var(--text-base)',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  {artifact.description}
                </p>
              </>
            )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              {artifact.topics.map((slug) => (
                <span
                  key={slug}
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-frame)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                  }}
                >
                  #{slug}
                </span>
              ))}
            </div>
          </div>

          {/* Task Steps */}
          {artifact.artifact_type === 'task' && artifact.task && (
            <div className="af-panel">
              <h2
                style={{
                  fontSize: 'var(--text-lg)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                Ordered subtasks ({artifact.task.steps.length})
              </h2>
              <ol
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                {artifact.task.steps.map((step, idx) => {
                  const isDone = step.status === 'completed';
                  return (
                    <li key={step.id} className="af-panel-raised">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 'var(--space-3)',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 'var(--space-3)',
                            cursor: 'pointer',
                            flex: 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() =>
                              onToggleTaskStep(
                                artifact.id,
                                step.id,
                                isDone ? 'todo' : 'completed'
                              )
                            }
                            style={{
                              width: '20px',
                              height: '20px',
                              marginTop: '3px',
                              accentColor: 'var(--accent)',
                            }}
                          />
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                textDecoration: isDone ? 'line-through' : 'none',
                              }}
                            >
                              {idx + 1}. {step.title}
                            </div>
                            {step.description && (
                              <div
                                style={{
                                  fontSize: 'var(--text-sm)',
                                  color: 'var(--text-muted)',
                                  marginTop: '4px',
                                }}
                              >
                                {step.description}
                              </div>
                            )}
                          </div>
                        </label>

                        <ProvenanceChip
                          kind={step.provenance_kind}
                          onClick={() => {
                            if (step.evidence_refs[0]) {
                              setHighlightedEvidenceId(step.evidence_refs[0]);
                            }
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* AI Skill Workflow + Version History + Export Panel (Section 6.8.F, FR-036, FR-037, FR-054) */}
          {artifact.artifact_type === 'ai_skill' &&
            artifact.skill?.currentVersion && (
              <>
                <div className="af-panel">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    <h2 style={{ fontSize: 'var(--text-lg)' }}>
                      Canonical SkillSpec (v
                      {artifact.skill.currentVersion.version_number})
                    </h2>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Capabilities:{' '}
                      {artifact.skill.currentVersion.spec_json.capability_declarations.join(
                        ', '
                      )}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                    }}
                  >
                    {artifact.skill.currentVersion.spec_json.workflow_steps.map(
                      (step, idx) => (
                        <div key={step.id} className="af-panel-raised">
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '6px',
                            }}
                          >
                            <strong>
                              {idx + 1}. {step.title}
                            </strong>
                            <ProvenanceChip
                              kind={step.provenance_kind}
                              onClick={() => {
                                if (step.evidence_refs[0]) {
                                  setHighlightedEvidenceId(
                                    step.evidence_refs[0]
                                  );
                                }
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--text-sm)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {step.instruction}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Screen F — Skill Export Panel (Section 6.8.F) */}
                <div className="af-panel">
                  <h2
                    style={{
                      fontSize: 'var(--text-lg)',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    Skill export
                  </h2>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-muted)',
                      marginBottom: 'var(--space-4)',
                    }}
                  >
                    Render a validated, instruction-only skill package from
                    canonical version v
                    {artifact.skill.currentVersion.version_number}. Preview
                    files before downloading.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--space-3)',
                      alignItems: 'flex-end',
                      marginBottom: 'var(--space-4)',
                    }}
                  >
                    <div style={{ flex: '1 1 240px' }}>
                      <label
                        htmlFor="af-export-target"
                        style={{
                          display: 'block',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          marginBottom: '4px',
                        }}
                      >
                        Implemented target format
                      </label>
                      <select
                        id="af-export-target"
                        className="af-select"
                        value={exportTarget}
                        onChange={(e) =>
                          setExportTarget(
                            e.target.value as
                              | 'claude_code_skill'
                              | 'codex_agents_skill'
                          )
                        }
                      >
                        <option value="claude_code_skill">
                          Claude Code skill (.claude/skills/SKILL.md)
                        </option>
                        <option value="codex_agents_skill">
                          Codex / Agents skill (.agents/skills/SKILL.md)
                        </option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={exporting}
                      className="af-btn af-btn-primary"
                      onClick={handleRunExport}
                    >
                      <span>
                        {exporting ? 'Rendering…' : 'Preview export package'}
                      </span>
                    </button>
                  </div>

                  {exportError && (
                    <div
                      role="alert"
                      style={{
                        color: 'var(--danger)',
                        fontSize: 'var(--text-sm)',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      {exportError}
                    </div>
                  )}

                  {exportPkg && (
                    <div
                      className="af-panel-raised"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      {/* Distinguish Valid, Compatible, and Tested (FR-037, Section 6.8.F) */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 'var(--space-2)',
                          fontSize: 'var(--text-xs)',
                        }}
                      >
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-frame)',
                            border: '1px solid var(--evidence-transcript)',
                            color: 'var(--evidence-transcript)',
                          }}
                        >
                          <ShieldCheck
                            size={14}
                            strokeWidth={1.5}
                            style={{ verticalAlign: 'middle', marginRight: '4px' }}
                          />
                          Schema: Valid
                        </span>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-frame)',
                            border: '1px solid var(--evidence-transcript)',
                            color: 'var(--evidence-transcript)',
                          }}
                        >
                          Target format: Compatible (renderer v
                          {exportPkg.rendererVersion})
                        </span>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-frame)',
                            border: '1px dashed var(--accent-label)',
                            color: 'var(--accent-label)',
                          }}
                        >
                          Tested in target tool: No (instruction-only static
                          export)
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Package SHA-256: <code>{exportPkg.packageHash}</code>
                      </div>

                      {exportPkg.files.map((file) => (
                        <div key={file.relativePath}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '6px',
                            }}
                          >
                            <code style={{ fontSize: 'var(--text-xs)' }}>
                              {file.relativePath}
                            </code>
                            <button
                              type="button"
                              className="af-btn"
                              onClick={() =>
                                handleDownloadFile(
                                  file.relativePath,
                                  file.content
                                )
                              }
                            >
                              <Download size={15} strokeWidth={1.5} />
                              <span>Download file</span>
                            </button>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: 'var(--space-3)',
                              background: 'var(--bg)',
                              border: '1px solid var(--line)',
                              borderRadius: 'var(--radius-control)',
                              fontSize: 'var(--text-xs)',
                              overflowX: 'auto',
                              maxHeight: '260px',
                            }}
                          >
                            {file.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Version History (FR-054) */}
                <div className="af-panel">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    <History size={18} strokeWidth={1.5} />
                    <h3 style={{ fontSize: 'var(--text-md)' }}>
                      Immutable version history (
                      {artifact.skill.versions.length})
                    </h3>
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {artifact.skill.versions.map((ver) => (
                      <li key={ver.id}>
                        <strong>v{ver.version_number}</strong> · schema{' '}
                        {ver.schema_version} · hash{' '}
                        <code>{ver.content_hash.slice(0, 12)}</code> ·{' '}
                        {new Date(ver.created_at).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
        </div>

        {/* Right: Provenance & Source Evidence Inspector (FR-044, Section 6.8.E) */}
        <div className="af-panel">
          <h2
            style={{
              fontSize: 'var(--text-lg)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Source & extraction provenance
          </h2>

          {artifact.sources.map((src) => (
            <div
              key={src.id}
              className="af-panel-raised"
              style={{
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div style={{ marginBottom: '4px' }}>
                <strong>Platform:</strong> {src.platform}
              </div>
              <div
                style={{
                  marginBottom: '4px',
                  wordBreak: 'break-all',
                }}
              >
                <strong>Canonical source:</strong>{' '}
                {src.canonical_url.startsWith('http') ? (
                  <a
                    href={src.canonical_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--evidence-transcript)' }}
                  >
                    {src.canonical_url}{' '}
                    <ExternalLink
                      size={12}
                      strokeWidth={1.5}
                      style={{ verticalAlign: 'middle' }}
                    />
                  </a>
                ) : (
                  src.canonical_url
                )}
              </div>
              {src.pipeline_version && (
                <div>
                  <strong>Pipeline / Model:</strong> v{src.pipeline_version} (
                  {src.provider_id ?? 'provider'} / {src.model_id ?? 'none'})
                </div>
              )}
            </div>
          ))}

          <h3
            style={{
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Retained source evidence ({artifact.evidence.length})
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              maxHeight: '500px',
              overflowY: 'auto',
            }}
          >
            {artifact.evidence.map((ev) => {
              const isHighlighted = highlightedEvidenceId === ev.id;
              const ts = formatTimestampMs(ev.start_ms);
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-control)',
                    border: isHighlighted
                      ? '2px solid var(--evidence-transcript)'
                      : '1px solid var(--line)',
                    background: isHighlighted
                      ? 'var(--surface-2)'
                      : 'var(--surface-1)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--evidence-transcript)',
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                  >
                    {ev.kind} {ts ? `(${ts})` : ''} · {ev.provenance}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)' }}>
                    {ev.content_text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

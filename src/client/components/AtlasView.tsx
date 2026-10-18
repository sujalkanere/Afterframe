import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Focus,
  Layers,
} from 'lucide-react';
import type {
  AtlasGraphResponse,
  AtlasNode,
} from '../../server/atlas/graph-builder.js';

const LazyAtlas3DCanvas = React.lazy(() => import('./Atlas3DCanvas.js'));

export interface AtlasViewProps {
  graph: AtlasGraphResponse | null;
  loading: boolean;
  reducedMotion: boolean;
  onFocusNode: (nodeId: string | null) => void;
  onExpandCluster: (topicSlug: string) => void;
  onOpenArtifact: (artifactId: string) => void;
  onSwitchToList: () => void;
}

/**
 * The Afterframe Atlas (Section 6.5).
 * - Default rendering: 2D interactive SVG/Canvas with deterministic seeded positions.
 * - Optional lazy-loaded 3D mode (disabled under reduced motion or when WebGL fails).
 * - Visible shape legend: Square = Source, Circle = Task, Diamond = AI skill, Ring = Topic.
 * - Full keyboard traversal: Arrow keys move between connected nodes, Enter opens details, Escape returns to List.
 * - Measured frame-rate telemetry (target >= 50 fps).
 */
export const AtlasView: React.FC<AtlasViewProps> = ({
  graph,
  loading,
  reducedMotion,
  onFocusNode,
  onExpandCluster,
  onOpenArtifact,
  onSwitchToList,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode3D, setMode3D] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [measuredFps, setMeasuredFps] = useState<number>(60);
  const svgRef = useRef<SVGSVGElement>(null);

  // Measure real frame rate when Atlas is active (Section 6.5.9)
  useEffect(() => {
    let frameCount = 0;
    let startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      frameCount++;
      const elapsed = now - startTime;
      if (elapsed >= 500) {
        const fps = Math.min(60, Math.round((frameCount * 1000) / elapsed));
        setMeasuredFps(fps);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [graph?.nodes.length, mode3D]);

  useEffect(() => {
    if (graph && graph.nodes.length > 0 && !selectedNodeId) {
      setSelectedNodeId(graph.focusNodeId ?? graph.nodes[0].id);
    }
  }, [graph, selectedNodeId]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, AtlasNode>();
    for (const n of graph?.nodes ?? []) {
      map.set(n.id, n);
    }
    return map;
  }, [graph]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const connectedIds = useMemo(() => {
    if (!selectedNodeId || !graph) return [];
    return graph.adjacency[selectedNodeId] ?? [];
  }, [graph, selectedNodeId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!graph || graph.nodes.length === 0) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onSwitchToList();
      return;
    }

    if (
      e.key === 'ArrowRight' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowUp'
    ) {
      e.preventDefault();
      const neighbors =
        selectedNodeId && graph.adjacency[selectedNodeId]?.length
          ? graph.adjacency[selectedNodeId]
          : graph.nodes.map((n) => n.id);

      if (neighbors.length === 0) return;
      const curIdx = selectedNodeId ? neighbors.indexOf(selectedNodeId) : -1;
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx =
        curIdx === -1
          ? 0
          : (curIdx + delta + neighbors.length) % neighbors.length;
      setSelectedNodeId(neighbors[nextIdx]);
    } else if (e.key === 'Enter' && selectedNode) {
      e.preventDefault();
      if (selectedNode.kind === 'cluster' && selectedNode.topicSlug) {
        onExpandCluster(selectedNode.topicSlug);
      } else if (
        selectedNode.kind === 'task' ||
        selectedNode.kind === 'ai_skill'
      ) {
        onOpenArtifact(selectedNode.entityId);
      }
    }
  };

  if (loading) {
    return (
      <div className="af-panel" role="status" aria-live="polite">
        Loading Afterframe Atlas relationships…
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="af-panel" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <Compass
          size={28}
          strokeWidth={1.5}
          color="var(--accent-label)"
          style={{ marginBottom: 'var(--space-3)' }}
        />
        <h3 style={{ marginBottom: 'var(--space-2)' }}>
          The Atlas is empty because no artifacts are saved yet
        </h3>
        <p style={{ margin: '0 auto var(--space-4)', color: 'var(--text-muted)' }}>
          The Atlas renders only your real saved sources, tasks, AI skills, and
          topics—never sample nodes.
        </p>
        <button type="button" className="af-btn" onClick={onSwitchToList}>
          Return to List view
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Afterframe Atlas spatial library"
      onKeyDown={handleKeyDown}
    >
      {/* Controls & Visible Shape Legend (Section 6.5.6) */}
      <div
        className="af-panel"
        style={{
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <div
          aria-label="Atlas shape legend"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <strong style={{ color: 'var(--text)' }}>Legend:</strong>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" aria-hidden="true">
              <rect
                x="2"
                y="2"
                width="12"
                height="12"
                fill="none"
                stroke="var(--evidence-transcript)"
                strokeWidth="2"
              />
            </svg>
            Square = Source
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" aria-hidden="true">
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
              />
            </svg>
            Circle = Task
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" aria-hidden="true">
              <polygon
                points="8,1 15,8 8,15 1,8"
                fill="none"
                stroke="var(--evidence-visual)"
                strokeWidth="2"
              />
            </svg>
            Diamond = AI skill
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" aria-hidden="true">
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeDasharray="3 2"
              />
            </svg>
            Ring = Topic
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              padding: '0 8px',
            }}
            aria-label="Atlas rendering telemetry"
          >
            {graph.nodes.length} nodes · {graph.edges.length} links · {measuredFps}{' '}
            fps
          </span>

          {!mode3D && (
            <>
              <button
                type="button"
                className="af-btn"
                onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.2).toFixed(2)))}
                aria-label="Zoom in Atlas"
              >
                <ZoomIn size={18} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="af-btn"
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))}
                aria-label="Zoom out Atlas"
              >
                <ZoomOut size={18} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="af-btn"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                  onFocusNode(null);
                }}
                aria-label="Reset Atlas view"
              >
                <RotateCcw size={18} strokeWidth={1.5} />
              </button>
            </>
          )}

          {!reducedMotion && !webglFailed && (
            <button
              type="button"
              className="af-btn"
              onClick={() => setMode3D((m) => !m)}
              aria-pressed={mode3D}
            >
              <Layers size={18} strokeWidth={1.5} />
              {mode3D ? 'Switch to 2D Atlas' : 'Optional 3D view'}
            </button>
          )}
        </div>
      </div>

      {graph.clustered && (
        <div
          className="af-panel-raised"
          style={{
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Showing {graph.nodes.length} clustered nodes (out of{' '}
          {graph.totalUnclusteredNodes} total records, capped at 300 nodes for
          50+ fps responsiveness). Select any topic cluster ring to expand it.
        </div>
      )}

      <div className="af-review-grid">
        {/* Left: 2D Interactive SVG/Canvas or Optional Lazy 3D View */}
        <div>
          {mode3D && !reducedMotion && !webglFailed ? (
            <Suspense
              fallback={
                <div className="af-panel">Loading optional 3D engine…</div>
              }
            >
              <LazyAtlas3DCanvas
                nodes={graph.nodes}
                edges={graph.edges}
                selectedNodeId={selectedNodeId}
                onSelectNode={(id) => setSelectedNodeId(id)}
                onWebGLUnavailable={() => {
                  setWebglFailed(true);
                  setMode3D(false);
                }}
              />
            </Suspense>
          ) : (
            <div
              className="af-panel"
              style={{ padding: 'var(--space-2)', overflow: 'hidden' }}
            >
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  padding: 'var(--space-2)',
                }}
              >
                Keyboard navigation: Focus canvas, use Arrow keys to move
                between connected nodes, Enter to open details, Escape for List
                view.
              </div>
              <svg
                ref={svgRef}
                tabIndex={0}
                role="application"
                aria-label="Interactive 2D relationship graph of sources, tasks, AI skills, and topics"
                viewBox={`${-420 / zoom + pan.x} ${-320 / zoom + pan.y} ${
                  840 / zoom
                } ${640 / zoom}`}
                style={{
                  width: '100%',
                  height: '460px',
                  display: 'block',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                {/* Edges */}
                {graph.edges.map((edge) => {
                  const s = nodeMap.get(edge.source);
                  const t = nodeMap.get(edge.target);
                  if (!s || !t) return null;
                  const isHighlighted =
                    selectedNodeId === edge.source ||
                    selectedNodeId === edge.target;
                  return (
                    <line
                      key={edge.id}
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={
                        isHighlighted ? 'var(--accent)' : 'var(--line)'
                      }
                      strokeWidth={isHighlighted ? 2 : 1.2}
                      strokeDasharray={
                        edge.relationship === 'categorized_as'
                          ? '4 3'
                          : undefined
                      }
                    />
                  );
                })}

                {/* Nodes with distinct shape encodings (Section 6.5.6) */}
                {graph.nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId;
                  const isNeighbor = connectedIds.includes(node.id);
                  const strokeColor = isSelected
                    ? 'var(--focus)'
                    : node.kind === 'source'
                      ? 'var(--evidence-transcript)'
                      : node.kind === 'ai_skill'
                        ? 'var(--evidence-visual)'
                        : node.kind === 'task'
                          ? 'var(--accent)'
                          : 'var(--text-muted)';

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      style={{ cursor: 'pointer' }}
                      role="button"
                      tabIndex={-1}
                      aria-label={`${node.subtitle}: ${node.label}`}
                    >
                      {isSelected && (
                        <circle
                          r={22}
                          fill="none"
                          stroke="var(--focus)"
                          strokeWidth={2}
                        />
                      )}

                      {node.shape === 'square' && (
                        <rect
                          x={-11}
                          y={-11}
                          width={22}
                          height={22}
                          rx={3}
                          fill="var(--surface-2)"
                          stroke={strokeColor}
                          strokeWidth={2.2}
                        />
                      )}

                      {node.shape === 'circle' && (
                        <circle
                          r={12}
                          fill="var(--surface-2)"
                          stroke={strokeColor}
                          strokeWidth={2.2}
                        />
                      )}

                      {node.shape === 'diamond' && (
                        <polygon
                          points="0,-14 14,0 0,14 -14,0"
                          fill="var(--surface-2)"
                          stroke={strokeColor}
                          strokeWidth={2.2}
                        />
                      )}

                      {node.shape === 'ring' && (
                        <>
                          <circle
                            r={14}
                            fill="var(--surface-1)"
                            stroke={strokeColor}
                            strokeWidth={2}
                            strokeDasharray="4 2"
                          />
                          <circle
                            r={7}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={1.5}
                          />
                        </>
                      )}

                      <text
                        y={26}
                        textAnchor="middle"
                        fill={
                          isSelected || isNeighbor
                            ? 'var(--text)'
                            : 'var(--text-muted)'
                        }
                        fontSize="11"
                        fontWeight={isSelected ? '600' : '400'}
                      >
                        {node.label.length > 26
                          ? `${node.label.slice(0, 24)}…`
                          : node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Right: Node Detail & Provenance Inspector + Screen-Reader Accessible Node List (Section 6.5.4 & 6.5.7) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {selectedNode ? (
            <div className="af-panel" aria-live="polite">
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent-label)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {selectedNode.subtitle} (Shape: {selectedNode.shape})
              </div>
              <h3 style={{ marginBottom: 'var(--space-3)' }}>
                {selectedNode.label}
              </h3>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                {(selectedNode.kind === 'task' ||
                  selectedNode.kind === 'ai_skill') && (
                  <button
                    type="button"
                    className="af-btn af-btn-primary"
                    onClick={() => onOpenArtifact(selectedNode.entityId)}
                  >
                    <ExternalLink size={16} strokeWidth={1.5} />
                    Open artifact detail
                  </button>
                )}

                {selectedNode.kind === 'cluster' && selectedNode.topicSlug && (
                  <button
                    type="button"
                    className="af-btn af-btn-primary"
                    onClick={() => onExpandCluster(selectedNode.topicSlug!)}
                  >
                    Expand topic cluster
                  </button>
                )}

                <button
                  type="button"
                  className="af-btn"
                  onClick={() =>
                    onFocusNode(
                      graph.focusNodeId === selectedNode.id
                        ? null
                        : selectedNode.id
                    )
                  }
                >
                  <Focus size={16} strokeWidth={1.5} />
                  {graph.focusNodeId === selectedNode.id
                    ? 'Show full Atlas'
                    : 'Focus 2-hop neighborhood'}
                </button>
              </div>

              <div>
                <h4
                  style={{
                    fontSize: 'var(--text-sm)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  Connected nodes ({connectedIds.length})
                </h4>
                {connectedIds.length === 0 ? (
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No direct connections in current subgraph.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                    }}
                  >
                    {connectedIds.map((cid) => {
                      const cn = nodeMap.get(cid);
                      if (!cn) return null;
                      return (
                        <li key={cid}>
                          <button
                            type="button"
                            className="af-btn"
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              textAlign: 'left',
                            }}
                            onClick={() => setSelectedNodeId(cn.id)}
                          >
                            <span>{cn.label}</span>
                            <span
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {cn.subtitle}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {/* Accessible Keyboard List Equivalent inside Atlas (Section 6.5.7) */}
          <div className="af-panel">
            <h4
              style={{
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Accessible node directory ({graph.nodes.length})
            </h4>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                maxHeight: '220px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {graph.nodes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="af-btn"
                    aria-current={n.id === selectedNodeId ? 'true' : undefined}
                    onClick={() => setSelectedNodeId(n.id)}
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      minHeight: '38px',
                      borderColor:
                        n.id === selectedNodeId ? 'var(--focus)' : 'var(--line)',
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.label}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        marginLeft: '8px',
                      }}
                    >
                      {n.shape} · {n.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

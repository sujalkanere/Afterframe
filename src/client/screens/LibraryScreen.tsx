import React from 'react';
import {
  Search,
  List,
  Compass,
  CheckSquare,
  Sparkles,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import type { AtlasGraphResponse } from '../../server/atlas/graph-builder.js';
import { AtlasView } from '../components/AtlasView.js';

export interface LibraryArtifactRow {
  id: string;
  artifact_type: string;
  title: string;
  description: string;
  status: string;
  provenance_mode: string;
  created_at: string;
  topics: string[];
  source_platform: string | null;
  source_url: string | null;
  task_completion_status: string | null;
}

export interface LibraryScreenProps {
  items: LibraryArtifactRow[];
  availableTopics: Array<{ slug: string; name: string }>;
  nextCursor: string | null;
  loading: boolean;
  viewMode: 'list' | 'atlas';
  searchQuery: string;
  typeFilter: string;
  topicFilter: string;
  sortBy: 'newest' | 'oldest' | 'title';
  atlasGraph: AtlasGraphResponse | null;
  atlasLoading: boolean;
  reducedMotion: boolean;
  onChangeViewMode: (mode: 'list' | 'atlas') => void;
  onChangeSearch: (q: string) => void;
  onChangeTypeFilter: (t: string) => void;
  onChangeTopicFilter: (topic: string) => void;
  onChangeSort: (sort: 'newest' | 'oldest' | 'title') => void;
  onResetFilters: () => void;
  onLoadMore: () => void;
  onOpenArtifact: (id: string) => void;
  onGoToCapture: () => void;
  onFocusAtlasNode: (nodeId: string | null) => void;
  onExpandAtlasCluster: (topicSlug: string) => void;
}

/**
 * Screen D — Library (Section 6.8.D).
 * - Search, Type filter, Topic filter, Sort, and List / Atlas switch.
 * - Real backend queries with keyset pagination.
 * - Genuine empty state and "no matches" state with filter reset.
 */
export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  items,
  availableTopics,
  nextCursor,
  loading,
  viewMode,
  searchQuery,
  typeFilter,
  topicFilter,
  sortBy,
  atlasGraph,
  atlasLoading,
  reducedMotion,
  onChangeViewMode,
  onChangeSearch,
  onChangeTypeFilter,
  onChangeTopicFilter,
  onChangeSort,
  onResetFilters,
  onLoadMore,
  onOpenArtifact,
  onGoToCapture,
  onFocusAtlasNode,
  onExpandAtlasCluster,
}) => {
  const hasActiveFilters = Boolean(
    searchQuery.trim() || typeFilter || topicFilter
  );

  return (
    <div>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div>
          <h1
            className="af-display"
            style={{
              fontSize: 'var(--text-xl)',
              marginBottom: 'var(--space-1)',
            }}
          >
            Library
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Saved tasks, AI skills, and their source provenance.
          </p>
        </div>

        {/* List / Atlas Switch (Section 6.8.D) */}
        <div
          role="group"
          aria-label="Library view mode"
          style={{ display: 'flex', gap: 'var(--space-2)' }}
        >
          <button
            type="button"
            className="af-btn"
            aria-pressed={viewMode === 'list'}
            onClick={() => onChangeViewMode('list')}
            style={{
              borderColor:
                viewMode === 'list' ? 'var(--accent)' : 'var(--line)',
            }}
          >
            <List size={18} strokeWidth={1.5} />
            <span>List</span>
          </button>
          <button
            type="button"
            className="af-btn"
            aria-pressed={viewMode === 'atlas'}
            onClick={() => onChangeViewMode('atlas')}
            style={{
              borderColor:
                viewMode === 'atlas' ? 'var(--accent)' : 'var(--line)',
            }}
          >
            <Compass size={18} strokeWidth={1.5} />
            <span>Atlas</span>
          </button>
        </div>
      </header>

      {/* Search & Filter Bar (Section 6.8.D, FR-042, FR-043) */}
      <div
        className="af-panel"
        style={{
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-4)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-3)',
          alignItems: 'end',
        }}
      >
        <div>
          <label
            htmlFor="af-lib-search"
            style={{
              display: 'block',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginBottom: '4px',
            }}
          >
            Search by keyword
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="af-lib-search"
              type="search"
              className="af-input"
              placeholder="Search titles and descriptions…"
              value={searchQuery}
              onChange={(e) => onChangeSearch(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="af-lib-type"
            style={{
              display: 'block',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginBottom: '4px',
            }}
          >
            Artifact type
          </label>
          <select
            id="af-lib-type"
            className="af-select"
            value={typeFilter}
            onChange={(e) => onChangeTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            <option value="task">Task</option>
            <option value="ai_skill">AI skill</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="af-lib-topic"
            style={{
              display: 'block',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginBottom: '4px',
            }}
          >
            Topic category
          </label>
          <select
            id="af-lib-topic"
            className="af-select"
            value={topicFilter}
            onChange={(e) => onChangeTopicFilter(e.target.value)}
          >
            <option value="">All topics</option>
            {availableTopics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name} (#{t.slug})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="af-lib-sort"
            style={{
              display: 'block',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginBottom: '4px',
            }}
          >
            Sort order
          </label>
          <select
            id="af-lib-sort"
            className="af-select"
            value={sortBy}
            onChange={(e) =>
              onChangeSort(e.target.value as 'newest' | 'oldest' | 'title')
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title (A–Z)</option>
          </select>
        </div>
      </div>

      {viewMode === 'atlas' ? (
        <AtlasView
          graph={atlasGraph}
          loading={atlasLoading}
          reducedMotion={reducedMotion}
          onFocusNode={onFocusAtlasNode}
          onExpandCluster={onExpandAtlasCluster}
          onOpenArtifact={onOpenArtifact}
          onSwitchToList={() => onChangeViewMode('list')}
        />
      ) : loading ? (
        <div className="af-panel" role="status" aria-live="polite">
          Loading saved library…
        </div>
      ) : items.length === 0 ? (
        hasActiveFilters ? (
          /* No matches state with single reset action (Section 6.8.D) */
          <div
            className="af-panel"
            style={{ textAlign: 'center', padding: 'var(--space-8)' }}
          >
            <Search
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
                marginBottom: 'var(--space-2)',
              }}
            >
              No saved items match your current filters
            </h2>
            <p
              style={{
                margin: '0 auto var(--space-4)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
              }}
            >
              Clear your search or topic filters to see all saved items.
            </p>
            <button
              type="button"
              className="af-btn af-btn-primary"
              onClick={onResetFilters}
            >
              <RotateCcw size={16} strokeWidth={1.5} />
              <span>Reset filters</span>
            </button>
          </div>
        ) : (
          /* Genuine empty state (FR-041, Section 6.8.D) */
          <div
            className="af-panel"
            style={{ textAlign: 'center', padding: 'var(--space-8)' }}
          >
            <h2
              style={{
                fontSize: 'var(--text-md)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                marginBottom: 'var(--space-2)',
              }}
            >
              Nothing saved in your Library yet
            </h2>
            <p
              style={{
                margin: '0 auto var(--space-4)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
              }}
            >
              Extract a YouTube Short or paste a transcript on Capture, review
              the candidate, and confirm it to keep it here.
            </p>
            <button
              type="button"
              className="af-btn af-btn-primary"
              onClick={onGoToCapture}
            >
              <PlusCircle size={16} strokeWidth={1.5} />
              <span>Go to Capture</span>
            </button>
          </div>
        )
      ) : (
        <div>
          <ul
            aria-label="Saved library artifacts"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            {items.map((item) => {
              const dateLabel = new Date(item.created_at).toLocaleDateString(
                undefined,
                {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }
              );

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpenArtifact(item.id)}
                    className="af-panel"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: 'var(--space-4)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-3)',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span style={{ marginTop: '2px', flexShrink: 0 }}>
                        {item.artifact_type === 'ai_skill' ? (
                          <Sparkles
                            size={20}
                            strokeWidth={1.5}
                            color="var(--evidence-visual)"
                          />
                        ) : (
                          <CheckSquare
                            size={20}
                            strokeWidth={1.5}
                            color="var(--accent)"
                          />
                        )}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--text-base)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '4px',
                          }}
                        >
                          {item.title}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <span>
                            {item.artifact_type === 'ai_skill'
                              ? 'AI skill'
                              : 'Task'}
                          </span>
                          <span>·</span>
                          <span>
                            Source: {item.source_platform ?? 'transcript'}
                          </span>
                          <span>·</span>
                          <span>{dateLabel}</span>
                          {item.topics.map((slug) => (
                            <span
                              key={slug}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-frame)',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--line)',
                                color: 'var(--text)',
                              }}
                            >
                              #{slug}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {nextCursor && (
            <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
              <button
                type="button"
                className="af-btn"
                onClick={onLoadMore}
              >
                Load more items
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

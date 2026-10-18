import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PlusCircle,
  Library,
  Settings,
  Command,
  User,
} from 'lucide-react';
import type {
  ExtractionCandidateEnvelope,
  MvpArtifactType,
  SkillSpecPayload,
  TaskCandidatePayload,
  UserSettings,
  ValidationFinding,
} from '../shared/contracts.js';
import type { AtlasGraphResponse } from '../server/atlas/graph-builder.js';
import type { RenderedSkillPackage } from '../server/export/skill-renderer.js';
import {
  CaptureScreen,
  type ReadyJobSummary,
  type RecentArtifactSummary,
} from './screens/CaptureScreen.js';
import {
  ProcessingScreen,
  type ProcessingStageJob,
} from './screens/ProcessingScreen.js';
import {
  ReviewScreen,
  type ReviewEvidenceSegment,
} from './screens/ReviewScreen.js';
import {
  LibraryScreen,
  type LibraryArtifactRow,
} from './screens/LibraryScreen.js';
import {
  ArtifactDetailScreen,
  type ArtifactDetailData,
} from './screens/ArtifactDetailScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { CommandPalette } from './components/CommandPalette.js';

interface SessionState {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    isGuest: boolean;
    settings: UserSettings;
  };
  sessionToken: string;
  capabilities: {
    youtubeLinkEnabled: boolean;
    instagramLinkEnabled: boolean;
    pasteTranscriptEnabled: boolean;
    llmConfigured: boolean;
  };
  retentionPolicy: {
    temporaryMedia: string;
    unconfirmedCandidates: string;
    confirmedArtifacts: string;
  };
}

interface ActiveJobDetail {
  job: ProcessingStageJob & {
    confirmed_artifact_id: string | null;
  };
  source: {
    id: string;
    platform: string;
    submitted_url: string;
    canonical_url: string;
  } | null;
  evidence: ReviewEvidenceSegment[];
  candidate: {
    id: string;
    recommended_type: MvpArtifactType;
    recommendation_reason: string;
    payload_json: ExtractionCandidateEnvelope;
    findings_json: ValidationFinding[];
  } | null;
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<string>(() => window.location.pathname);
  const [searchParams, setSearchParams] = useState<URLSearchParams>(
    () => new URLSearchParams(window.location.search)
  );

  const [session, setSession] = useState<SessionState | null>(null);
  const [readyJobs, setReadyJobs] = useState<ReadyJobSummary[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryArtifactRow[]>([]);
  const [availableTopics, setAvailableTopics] = useState<
    Array<{ slug: string; name: string }>
  >([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Library filters
  const [viewMode, setViewMode] = useState<'list' | 'atlas'>(() =>
    new URLSearchParams(window.location.search).get('view') === 'atlas'
      ? 'atlas'
      : 'list'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');

  // Atlas state
  const [atlasGraph, setAtlasGraph] = useState<AtlasGraphResponse | null>(null);
  const [atlasLoading, setAtlasLoading] = useState(false);
  const [atlasFocusNode, setAtlasFocusNode] = useState<string | null>(null);
  const [atlasExpandedTopic, setAtlasExpandedTopic] = useState<
    string | undefined
  >(undefined);

  // Active Job / Artifact Detail state
  const [activeJob, setActiveJob] = useState<ActiveJobDetail | null>(null);
  const [activeArtifact, setActiveArtifact] =
    useState<ArtifactDetailData | null>(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  const sessionTokenRef = useRef<string | null>(null);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers ?? {});
      if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (sessionTokenRef.current) {
        headers.set('x-afterframe-session', sessionTokenRef.current);
      }
      const res = await fetch(path, {
        ...init,
        headers,
      });
      const returnedToken = res.headers.get('x-afterframe-session');
      if (returnedToken) {
        sessionTokenRef.current = returnedToken;
        try {
          localStorage.setItem('af_session_token', returnedToken);
        } catch {
          // Ignore
        }
      }
      return res;
    },
    []
  );

  const navigate = useCallback((nextUrl: string) => {
    window.history.pushState({}, '', nextUrl);
    const parsed = new URL(nextUrl, window.location.origin);
    setRoute(parsed.pathname);
    setSearchParams(parsed.searchParams);
    if (parsed.searchParams.get('view') === 'atlas') {
      setViewMode('atlas');
    } else if (parsed.pathname === '/library') {
      setViewMode('list');
    }
    // Move focus to main landmark on route change (Section 6.10)
    setTimeout(() => {
      mainRef.current?.focus();
    }, 10);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(window.location.pathname);
      const sp = new URLSearchParams(window.location.search);
      setSearchParams(sp);
      setViewMode(sp.get('view') === 'atlas' ? 'atlas' : 'list');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Global Ctrl/Cmd+K shortcut for Command Palette (FR-065)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Load initial session
  const loadSessionAndHomeData = useCallback(async () => {
    try {
      const savedTok = localStorage.getItem('af_session_token');
      if (savedTok) sessionTokenRef.current = savedTok;
    } catch {
      // Ignore
    }

    const sessRes = await apiFetch('/api/session');
    if (sessRes.ok) {
      const data = (await sessRes.json()) as SessionState;
      setSession(data);
    }

    const [jobsRes, libRes] = await Promise.all([
      apiFetch('/api/jobs'),
      apiFetch('/api/artifacts?limit=25'),
    ]);

    if (jobsRes.ok) {
      const jd = await jobsRes.json();
      setReadyJobs(jd.jobs ?? []);
    }
    if (libRes.ok) {
      const ld = await libRes.json();
      setLibraryItems(ld.items ?? []);
      setAvailableTopics(ld.availableTopics ?? []);
      setNextCursor(ld.nextCursor ?? null);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSessionAndHomeData();
  }, [loadSessionAndHomeData]);

  // Apply theme and reduced-motion attributes to documentElement (Section 6.3 & 6.6)
  const effectiveTheme = (() => {
    const pref = session?.user.settings.theme ?? 'dark';
    if (pref === 'system') {
      return typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    }
    return pref;
  })();

  const effectiveReducedMotion = Boolean(
    session?.user.settings.reduced_motion ||
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute(
      'data-reduced-motion',
      effectiveReducedMotion ? 'true' : 'false'
    );
  }, [effectiveReducedMotion, effectiveTheme]);

  // Poll or load active job when on /jobs/:id
  useEffect(() => {
    if (!route.startsWith('/jobs/')) {
      setActiveJob(null);
      return;
    }
    const jobId = route.slice('/jobs/'.length);
    if (!jobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchJob = async () => {
      const res = await apiFetch(`/api/jobs/${jobId}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as ActiveJobDetail;
      if (cancelled) return;
      setActiveJob(data);

      const st = data.job.status;
      if (
        st === 'queued' ||
        st === 'acquiring' ||
        st === 'transcribing' ||
        st === 'analyzing'
      ) {
        timer = setTimeout(fetchJob, 500);
      }
    };

    fetchJob();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [apiFetch, route]);

  // Load library when filters change
  const fetchLibrary = useCallback(
    async (cursor?: string) => {
      setLibraryLoading(true);
      try {
        const qs = new URLSearchParams();
        if (searchQuery.trim()) qs.set('q', searchQuery.trim());
        if (typeFilter) qs.set('type', typeFilter);
        if (topicFilter) qs.set('topic', topicFilter);
        qs.set('sort', sortBy);
        if (cursor) qs.set('cursor', cursor);

        const res = await apiFetch(`/api/artifacts?${qs.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (cursor) {
            setLibraryItems((prev) => [...prev, ...(data.items ?? [])]);
          } else {
            setLibraryItems(data.items ?? []);
          }
          setAvailableTopics(data.availableTopics ?? []);
          setNextCursor(data.nextCursor ?? null);
        }
      } finally {
        setLibraryLoading(false);
      }
    },
    [apiFetch, searchQuery, sortBy, topicFilter, typeFilter]
  );

  useEffect(() => {
    if (route === '/library') {
      fetchLibrary();
    }
  }, [fetchLibrary, route]);

  // Load Atlas graph when in Atlas mode on /library
  useEffect(() => {
    if (route !== '/library' || viewMode !== 'atlas') return;
    let active = true;
    setAtlasLoading(true);

    const qs = new URLSearchParams();
    if (searchQuery.trim()) qs.set('q', searchQuery.trim());
    if (typeFilter) qs.set('type', typeFilter);
    if (topicFilter) qs.set('topic', topicFilter);
    if (atlasFocusNode) qs.set('focus', atlasFocusNode);
    if (atlasExpandedTopic) qs.set('expandTopic', atlasExpandedTopic);

    apiFetch(`/api/atlas?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setAtlasGraph(data);
      })
      .finally(() => {
        if (active) setAtlasLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    apiFetch,
    atlasExpandedTopic,
    atlasFocusNode,
    route,
    searchQuery,
    topicFilter,
    typeFilter,
    viewMode,
  ]);

  // Load artifact detail when on /artifacts/:id
  const fetchArtifactDetail = useCallback(
    async (artifactId: string) => {
      const res = await apiFetch(`/api/artifacts/${artifactId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveArtifact(data.artifact);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    if (!route.startsWith('/artifacts/')) {
      setActiveArtifact(null);
      return;
    }
    const id = route.slice('/artifacts/'.length);
    if (id) fetchArtifactDetail(id);
  }, [fetchArtifactDetail, route]);

  const handleUpdateSettings = async (partial: Partial<UserSettings>) => {
    const res = await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(partial),
    });
    if (res.ok) {
      const data = await res.json();
      setSession((prev) =>
        prev
          ? {
              ...prev,
              user: { ...prev.user, settings: data.settings },
            }
          : prev
      );
    }
  };

  // Hide mobile bottom navigation on Processing & Review screens (Section 6.7)
  const isJobRoute = route.startsWith('/jobs/');

  const recentArtifacts: RecentArtifactSummary[] = libraryItems.map((it) => ({
    id: it.id,
    artifact_type: it.artifact_type,
    title: it.title,
    topics: it.topics,
    source_platform: it.source_platform,
    created_at: it.created_at,
  }));

  return (
    <div className="af-shell">
      {/* Slim Top Navigation Bar (Section 6.7) */}
      <header
        style={{
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface-1)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <nav
          aria-label="Primary navigation"
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className="af-display"
              style={{
                fontSize: '1.5rem',
                color: 'var(--text)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: 'var(--accent)',
                }}
                aria-hidden="true"
              />
              <span>Afterframe</span>
            </a>

            <div className="af-top-nav-links">
              <button
                type="button"
                className="af-btn"
                aria-current={route === '/' ? 'page' : undefined}
                onClick={() => navigate('/')}
                style={{
                  borderColor:
                    route === '/' ? 'var(--accent)' : 'transparent',
                }}
              >
                <PlusCircle size={18} strokeWidth={1.5} />
                <span>Capture</span>
              </button>

              <button
                type="button"
                className="af-btn"
                aria-current={route.startsWith('/library') ? 'page' : undefined}
                onClick={() => navigate('/library')}
                style={{
                  borderColor: route.startsWith('/library')
                    ? 'var(--accent)'
                    : 'transparent',
                }}
              >
                <Library size={18} strokeWidth={1.5} />
                <span>Library</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="af-btn"
              onClick={() => setCmdkOpen(true)}
              aria-label="Open command palette (Ctrl+K)"
              title="Command palette (Ctrl/Cmd+K)"
            >
              <Command size={16} strokeWidth={1.5} />
              <span style={{ fontSize: 'var(--text-xs)' }}>Ctrl+K</span>
            </button>

            <button
              type="button"
              className="af-btn"
              aria-current={route === '/settings' ? 'page' : undefined}
              onClick={() => navigate('/settings')}
              aria-label="Account and settings"
            >
              <User size={16} strokeWidth={1.5} />
              <span style={{ fontSize: 'var(--text-xs)' }}>
                {session?.user.isGuest
                  ? 'Guest · Settings'
                  : session?.user.displayName || 'Account'}
              </span>
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content Landmark (focused on route changes per Section 6.10) */}
      <main ref={mainRef} tabIndex={-1} className="af-main">
        {route === '/' && (
          <CaptureScreen
            initialSharedUrl={searchParams.get('shared') ?? ''}
            reducedMotion={effectiveReducedMotion}
            capabilities={
              session?.capabilities ?? {
                youtubeLinkEnabled: true,
                instagramLinkEnabled: false,
                pasteTranscriptEnabled: true,
                llmConfigured: false,
              }
            }
            readyJobs={readyJobs}
            recentArtifacts={recentArtifacts}
            onSubmitJob={async (payload) => {
              const res = await apiFetch('/api/jobs', {
                method: 'POST',
                body: JSON.stringify(payload),
              });
              const data = await res.json();
              if (!res.ok) {
                return { ok: false, message: data.message };
              }
              navigate(`/jobs/${data.jobId}`);
              return { ok: true, jobId: data.jobId };
            }}
            onOpenJob={(jobId) => navigate(`/jobs/${jobId}`)}
            onOpenArtifact={(artifactId) =>
              navigate(`/artifacts/${artifactId}`)
            }
          />
        )}

        {route.startsWith('/jobs/') && activeJob && (
          <>
            {activeJob.job.status === 'needs_review' && activeJob.candidate ? (
              <ReviewScreen
                jobId={activeJob.job.id}
                sourceUrl={
                  activeJob.source?.canonical_url ??
                  activeJob.source?.submitted_url ??
                  ''
                }
                initialEnvelope={activeJob.candidate.payload_json}
                initialFindings={activeJob.candidate.findings_json ?? []}
                evidence={activeJob.evidence}
                reducedMotion={effectiveReducedMotion}
                onConfirmSave={async (payload) => {
                  const res = await apiFetch('/api/artifacts/confirm', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    return {
                      ok: false,
                      message: data.message,
                      findings: data.findings,
                    };
                  }
                  await loadSessionAndHomeData();
                  return { ok: true, artifactId: data.artifactId };
                }}
                onDiscard={async () => {
                  await apiFetch(`/api/jobs/${activeJob.job.id}/cancel`, {
                    method: 'POST',
                  });
                  await loadSessionAndHomeData();
                  navigate('/');
                }}
                onOpenSavedArtifact={(artifactId) =>
                  navigate(`/artifacts/${artifactId}`)
                }
              />
            ) : (
              <ProcessingScreen
                job={activeJob.job}
                sourceUrl={
                  activeJob.source?.canonical_url ??
                  activeJob.source?.submitted_url ??
                  ''
                }
                evidenceCount={activeJob.evidence.length}
                onRetryStage={async (pastedTranscript) => {
                  await apiFetch(`/api/jobs/${activeJob.job.id}/retry`, {
                    method: 'POST',
                    body: JSON.stringify({
                      pasted_transcript: pastedTranscript,
                    }),
                  });
                  const refreshed = await apiFetch(
                    `/api/jobs/${activeJob.job.id}`
                  );
                  if (refreshed.ok) {
                    setActiveJob(await refreshed.json());
                  }
                }}
                onManualDraft={async () => {
                  const res = await apiFetch(
                    `/api/jobs/${activeJob.job.id}/manual-draft`,
                    { method: 'POST' }
                  );
                  if (res.ok) {
                    const refreshed = await apiFetch(
                      `/api/jobs/${activeJob.job.id}`
                    );
                    if (refreshed.ok) {
                      setActiveJob(await refreshed.json());
                    }
                  }
                }}
                onCancelJob={async () => {
                  await apiFetch(`/api/jobs/${activeJob.job.id}/cancel`, {
                    method: 'POST',
                  });
                  navigate('/');
                }}
                onLeaveScreen={() => navigate('/')}
              />
            )}
          </>
        )}

        {route === '/library' && (
          <LibraryScreen
            items={libraryItems}
            availableTopics={availableTopics}
            nextCursor={nextCursor}
            loading={libraryLoading}
            viewMode={viewMode}
            searchQuery={searchQuery}
            typeFilter={typeFilter}
            topicFilter={topicFilter}
            sortBy={sortBy}
            atlasGraph={atlasGraph}
            atlasLoading={atlasLoading}
            reducedMotion={effectiveReducedMotion}
            onChangeViewMode={(m) => {
              setViewMode(m);
              window.history.replaceState(
                {},
                '',
                m === 'atlas' ? '/library?view=atlas' : '/library'
              );
            }}
            onChangeSearch={(q) => setSearchQuery(q)}
            onChangeTypeFilter={(t) => setTypeFilter(t)}
            onChangeTopicFilter={(top) => setTopicFilter(top)}
            onChangeSort={(s) => setSortBy(s)}
            onResetFilters={() => {
              setSearchQuery('');
              setTypeFilter('');
              setTopicFilter('');
              setSortBy('newest');
            }}
            onLoadMore={() => {
              if (nextCursor) fetchLibrary(nextCursor);
            }}
            onOpenArtifact={(id) => navigate(`/artifacts/${id}`)}
            onGoToCapture={() => navigate('/')}
            onFocusAtlasNode={(nodeId) => setAtlasFocusNode(nodeId)}
            onExpandAtlasCluster={(slug) => setAtlasExpandedTopic(slug)}
          />
        )}

        {route.startsWith('/artifacts/') && activeArtifact && (
          <ArtifactDetailScreen
            artifact={activeArtifact}
            onBack={() => navigate('/library')}
            onToggleTaskStep={async (artifactId, stepId, nextStatus) => {
              await apiFetch(`/api/artifacts/${artifactId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  step_toggle: { stepId, status: nextStatus },
                }),
              });
              await fetchArtifactDetail(artifactId);
            }}
            onUpdateTitleAndDesc={async (artifactId, title, description) => {
              await apiFetch(`/api/artifacts/${artifactId}`, {
                method: 'PATCH',
                body: JSON.stringify({ title, description }),
              });
              await fetchArtifactDetail(artifactId);
              await loadSessionAndHomeData();
            }}
            onSaveNewSkillVersion={async (artifactId, spec) => {
              await apiFetch(`/api/artifacts/${artifactId}`, {
                method: 'PATCH',
                body: JSON.stringify({ skill_spec: spec }),
              });
              await fetchArtifactDetail(artifactId);
              await loadSessionAndHomeData();
            }}
            onInitiateDelete={async (artifactId) => {
              const res = await apiFetch(`/api/artifacts/${artifactId}`, {
                method: 'DELETE',
              });
              const data = await res.json();
              return { ok: res.ok, undoUntil: data.undoUntil };
            }}
            onUndoDelete={async (artifactId) => {
              const res = await apiFetch(
                `/api/artifacts/${artifactId}/undo-delete`,
                { method: 'POST' }
              );
              return res.ok;
            }}
            onFinalizeDelete={async (artifactId) => {
              await apiFetch(`/api/artifacts/${artifactId}/finalize-delete`, {
                method: 'POST',
              });
              await loadSessionAndHomeData();
              navigate('/library');
            }}
            onExportSkill={async (artifactId, target) => {
              const res = await apiFetch(
                `/api/artifacts/${artifactId}/export`,
                {
                  method: 'POST',
                  body: JSON.stringify({ target }),
                }
              );
              const data = await res.json();
              if (!res.ok) {
                return { ok: false, message: data.message };
              }
              await fetchArtifactDetail(artifactId);
              return {
                ok: true,
                pkg: data.exportPackage as RenderedSkillPackage,
              };
            }}
          />
        )}

        {route === '/settings' && session && (
          <SettingsScreen
            user={session.user}
            retentionPolicy={session.retentionPolicy}
            onSignIn={async (email, displayName) => {
              const res = await apiFetch('/api/auth/signin', {
                method: 'POST',
                body: JSON.stringify({ email, displayName }),
              });
              const data = await res.json();
              if (!res.ok) {
                return { ok: false, message: data.message };
              }
              await loadSessionAndHomeData();
              return { ok: true };
            }}
            onUpdateSettings={handleUpdateSettings}
            onExportData={() => {
              window.open('/api/account/export', '_blank');
            }}
            onDeleteAccount={async () => {
              await apiFetch('/api/account', { method: 'DELETE' });
              try {
                localStorage.clear();
              } catch {
                // Ignore
              }
              await loadSessionAndHomeData();
              navigate('/');
            }}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation — hidden on Processing and Review screens (Section 6.7) */}
      {!isJobRoute && (
        <nav className="af-bottom-nav" aria-label="Mobile primary navigation">
          <button
            type="button"
            className="af-btn"
            aria-current={route === '/' ? 'page' : undefined}
            onClick={() => navigate('/')}
            style={{
              flex: 1,
              border: 'none',
              color: route === '/' ? 'var(--accent)' : 'var(--text)',
            }}
          >
            <PlusCircle size={20} strokeWidth={1.5} />
            <span>Capture</span>
          </button>
          <button
            type="button"
            className="af-btn"
            aria-current={route.startsWith('/library') ? 'page' : undefined}
            onClick={() => navigate('/library')}
            style={{
              flex: 1,
              border: 'none',
              color: route.startsWith('/library')
                ? 'var(--accent)'
                : 'var(--text)',
            }}
          >
            <Library size={20} strokeWidth={1.5} />
            <span>Library</span>
          </button>
          <button
            type="button"
            className="af-btn"
            aria-current={route === '/settings' ? 'page' : undefined}
            onClick={() => navigate('/settings')}
            style={{
              flex: 1,
              border: 'none',
              color: route === '/settings' ? 'var(--accent)' : 'var(--text)',
            }}
          >
            <Settings size={20} strokeWidth={1.5} />
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* Command Palette (Ctrl/Cmd+K, FR-065) */}
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onNavigate={(path) => navigate(path)}
        onToggleTheme={() =>
          handleUpdateSettings({
            theme: effectiveTheme === 'dark' ? 'light' : 'dark',
          })
        }
        onToggleReducedMotion={() =>
          handleUpdateSettings({
            reduced_motion: !effectiveReducedMotion,
          })
        }
        artifacts={libraryItems.map((it) => ({
          id: it.id,
          title: it.title,
          artifact_type: it.artifact_type,
        }))}
        currentTheme={effectiveTheme}
        reducedMotion={effectiveReducedMotion}
      />
    </div>
  );
};

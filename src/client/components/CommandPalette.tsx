import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  PlusCircle,
  Library,
  Compass,
  Settings,
  Sun,
  Moon,
  Sparkles,
  CheckSquare,
  Activity,
} from 'lucide-react';

export interface CommandPaletteArtifactItem {
  id: string;
  title: string;
  artifact_type: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onToggleTheme: () => void;
  onToggleReducedMotion: () => void;
  artifacts: CommandPaletteArtifactItem[];
  currentTheme: string;
  reducedMotion: boolean;
}

interface CommandOption {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  action: () => void;
}

/**
 * Accessible Command Palette (Ctrl/Cmd+K, FR-065, Section 6.7).
 * Uses deterministic scoring and aria-activedescendant keyboard navigation.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
  onToggleTheme,
  onToggleReducedMotion,
  artifacts,
  currentTheme,
  reducedMotion,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const options = useMemo<CommandOption[]>(() => {
    const base: CommandOption[] = [
      {
        id: 'cmd-capture',
        label: 'Go to Capture',
        subtitle: 'Extract a new video link or paste a transcript',
        icon: <PlusCircle size={18} strokeWidth={1.5} />,
        action: () => {
          onNavigate('/app');
          onClose();
        },
      },
      {
        id: 'cmd-dashboard',
        label: 'Open Spatial Intelligence Dashboard',
        subtitle: 'View knowledge velocity, provenance spectrum, and engine telemetry',
        icon: <Activity size={18} strokeWidth={1.5} />,
        action: () => {
          onNavigate('/dashboard');
          onClose();
        },
      },
      {
        id: 'cmd-library-list',
        label: 'Open Library (List view)',
        subtitle: 'Search and filter your saved tasks and AI skills',
        icon: <Library size={18} strokeWidth={1.5} />,
        action: () => {
          onNavigate('/library');
          onClose();
        },
      },
      {
        id: 'cmd-library-atlas',
        label: 'Open Afterframe Atlas (Spatial graph)',
        subtitle: 'Explore connections between sources, artifacts, and topics',
        icon: <Compass size={18} strokeWidth={1.5} />,
        action: () => {
          onNavigate('/library?view=atlas');
          onClose();
        },
      },
      {
        id: 'cmd-settings',
        label: 'Open Settings & Data Control',
        subtitle: 'Theme, motion, language, export data, or delete account',
        icon: <Settings size={18} strokeWidth={1.5} />,
        action: () => {
          onNavigate('/settings');
          onClose();
        },
      },
      {
        id: 'cmd-theme',
        label: `Switch theme (current: ${currentTheme})`,
        subtitle: 'Toggle between Dark projection room and Light theme',
        icon:
          currentTheme === 'light' ? (
            <Moon size={18} strokeWidth={1.5} />
          ) : (
            <Sun size={18} strokeWidth={1.5} />
          ),
        action: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: 'cmd-motion',
        label: reducedMotion ? 'Enable standard motion' : 'Enable reduced motion',
        subtitle: 'Control viewfinder and transition animations',
        icon: <Sparkles size={18} strokeWidth={1.5} />,
        action: () => {
          onToggleReducedMotion();
          onClose();
        },
      },
    ];

    const artItems: CommandOption[] = artifacts.map((a) => ({
      id: `art-${a.id}`,
      label: a.title,
      subtitle: a.artifact_type === 'ai_skill' ? 'Saved AI skill' : 'Saved task',
      icon:
        a.artifact_type === 'ai_skill' ? (
          <Sparkles size={18} strokeWidth={1.5} />
        ) : (
          <CheckSquare size={18} strokeWidth={1.5} />
        ),
      action: () => {
        onNavigate(`/artifacts/${a.id}`);
        onClose();
      },
    }));

    const all = [...base, ...artItems];
    const q = query.trim().toLowerCase();
    if (!q) return all;

    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );
  }, [
    artifacts,
    currentTheme,
    onClose,
    onNavigate,
    onToggleReducedMotion,
    onToggleTheme,
    query,
    reducedMotion,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (options.length ? (prev + 1) % options.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        options.length ? (prev - 1 + options.length) % options.length : 0
      );
    } else if (e.key === 'Enter' && options[activeIndex]) {
      e.preventDefault();
      options[activeIndex].action();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 18, 22, 0.72)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px 16px 24px',
        zIndex: 50,
      }}
    >
      <div
        className="af-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: '580px',
          padding: 'var(--space-4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            borderBottom: '1px solid var(--line)',
            paddingBottom: 'var(--space-3)',
          }}
        >
          <Search size={20} strokeWidth={1.5} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="af-cmdk-listbox"
            aria-activedescendant={options[activeIndex]?.id}
            placeholder="Jump to screen, search saved artifacts, or run an action…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="af-input"
            style={{ border: 'none', background: 'transparent' }}
          />
          <button type="button" className="af-btn" onClick={onClose}>
            Esc
          </button>
        </div>

        <ul
          id="af-cmdk-listbox"
          role="listbox"
          aria-label="Commands and artifacts"
          style={{
            listStyle: 'none',
            margin: 'var(--space-3) 0 0',
            padding: 0,
            maxHeight: '340px',
            overflowY: 'auto',
          }}
        >
          {options.length === 0 ? (
            <li
              style={{
                padding: 'var(--space-4)',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              No matching commands or saved artifacts.
            </li>
          ) : (
            options.map((opt, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <li
                  key={opt.id}
                  id={opt.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={opt.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-control)',
                    backgroundColor: isSelected
                      ? 'var(--surface-2)'
                      : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ color: 'var(--accent-label)', display: 'flex' }}>
                    {opt.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {opt.label}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {opt.subtitle}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};

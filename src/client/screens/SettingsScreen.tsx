import React, { useState } from 'react';
import {
  Mail,
  Download,
  Trash2,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import type { UserSettings } from '../../shared/contracts.js';

export interface SettingsScreenProps {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    isGuest: boolean;
    settings: UserSettings;
  };
  retentionPolicy: {
    temporaryMedia: string;
    unconfirmedCandidates: string;
    confirmedArtifacts: string;
  };
  onSignIn: (
    email: string,
    displayName?: string
  ) => Promise<{ ok: boolean; message?: string }>;
  onUpdateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  onExportData: () => void;
  onDeleteAccount: () => Promise<void>;
}

/**
 * Screen G & Screen H — Passwordless Sign-in & Settings / Data Control (Section 6.8.G & 6.8.H, FR-064).
 * - Passwordless sign-in (email magic link / account binding) with guest-trial upgrade.
 * - Theme (system/dark/light), reduce motion, content language (auto/en/hi), timezone.
 * - Plain-language evidence retention statement (FR-056).
 * - Export all structured data (FR-058) and delete account & data (FR-064).
 */
export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  user,
  retentionPolicy,
  onSignIn,
  onUpdateSettings,
  onExportData,
  onDeleteAccount,
}) => {
  const [email, setEmail] = useState(user.email ?? '');
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthStatus(null);
    const res = await onSignIn(email, displayName);
    if (!res.ok) {
      setAuthError(res.message ?? 'Could not sign in.');
    } else {
      setAuthStatus('Signed in. Your library is now bound to your account.');
    }
  };

  return (
    <div
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      <header>
        <h1
          className="af-display"
          style={{
            fontSize: 'var(--text-xl)',
            marginBottom: 'var(--space-1)',
          }}
        >
          Account, settings & data control
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Manage passwordless sign-in, appearance, accessibility preferences,
          and your data retention controls.
        </p>
      </header>

      {/* Screen G: Passwordless Sign-In (FR-064, Section 6.8.G) */}
      <section className="af-panel" aria-labelledby="af-signin-heading">
        <h2
          id="af-signin-heading"
          style={{
            fontSize: 'var(--text-lg)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {user.isGuest
            ? 'Passwordless sign-in (currently in guest trial)'
            : `Signed in as ${user.email}`}
        </h2>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {user.isGuest
            ? 'Enter your email to keep your extracted tasks and AI skills across devices without a password.'
            : 'Your session is authenticated. You can switch accounts or update your display name below.'}
        </p>

        <form
          onSubmit={handleSignInSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
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
                htmlFor="af-auth-email"
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  marginBottom: '4px',
                }}
              >
                Email address
              </label>
              <input
                id="af-auth-email"
                type="email"
                required
                className="af-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="af-auth-name"
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  marginBottom: '4px',
                }}
              >
                Display name (optional)
              </label>
              <input
                id="af-auth-name"
                type="text"
                className="af-input"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>

          {authError && (
            <div
              role="alert"
              style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}
            >
              {authError}
            </div>
          )}

          {authStatus && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--evidence-transcript)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <CheckCircle2 size={16} strokeWidth={1.5} />
              <span>{authStatus}</span>
            </div>
          )}

          <div>
            {/* Single Primary Action on Settings Form */}
            <button type="submit" className="af-btn af-btn-primary">
              <Mail size={16} strokeWidth={1.5} />
              <span>
                {user.isGuest
                  ? 'Sign in with passwordless link'
                  : 'Update account identity'}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* Screen H: Preferences (Theme, Reduced Motion, Language, Timezone) */}
      <section className="af-panel" aria-labelledby="af-prefs-heading">
        <h2
          id="af-prefs-heading"
          style={{
            fontSize: 'var(--text-lg)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Interface & extraction preferences
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <label
              htmlFor="af-pref-theme"
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                marginBottom: '4px',
              }}
            >
              Color theme
            </label>
            <select
              id="af-pref-theme"
              className="af-select"
              value={user.settings.theme}
              onChange={(e) =>
                onUpdateSettings({
                  theme: e.target.value as 'system' | 'dark' | 'light',
                })
              }
            >
              <option value="dark">Dark (Projection room — default)</option>
              <option value="light">Light (Daylight paper)</option>
              <option value="system">Follow system preference</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="af-pref-lang"
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                marginBottom: '4px',
              }}
            >
              Language of generated content
            </label>
            <select
              id="af-pref-lang"
              className="af-select"
              value={user.settings.content_language}
              onChange={(e) =>
                onUpdateSettings({
                  content_language: e.target.value as 'auto' | 'en' | 'hi',
                })
              }
            >
              <option value="auto">Match source language (Auto)</option>
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="af-pref-tz"
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                marginBottom: '4px',
              }}
            >
              Timezone
            </label>
            <select
              id="af-pref-tz"
              className="af-select"
              value={user.settings.timezone}
              onChange={(e) => onUpdateSettings({ timezone: e.target.value })}
            >
              <option value="UTC">UTC</option>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="America/New_York">America/New_York (ET)</option>
              <option value="America/Los_Angeles">
                America/Los_Angeles (PT)
              </option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingTop: '20px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={user.settings.reduced_motion}
                onChange={(e) =>
                  onUpdateSettings({ reduced_motion: e.target.checked })
                }
                style={{
                  width: '20px',
                  height: '20px',
                  accentColor: 'var(--accent)',
                }}
              />
              <span>Reduce motion (disable viewfinder & 3D animations)</span>
            </label>
          </div>
        </div>
      </section>

      {/* Plain-language Evidence Retention Policy (FR-056, Section 6.8.H) */}
      <section className="af-panel" aria-labelledby="af-retention-heading">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <Shield size={20} strokeWidth={1.5} color="var(--accent-label)" />
          <h2 id="af-retention-heading" style={{ fontSize: 'var(--text-lg)' }}>
            Evidence retention & privacy policy
          </h2>
        </div>

        <ul
          style={{
            margin: '0 0 var(--space-4)',
            paddingLeft: '20px',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <li>
            <strong>Temporary media:</strong> {retentionPolicy.temporaryMedia}
          </li>
          <li>
            <strong>Unconfirmed drafts:</strong>{' '}
            {retentionPolicy.unconfirmedCandidates}
          </li>
          <li>
            <strong>Saved artifacts & evidence:</strong>{' '}
            {retentionPolicy.confirmedArtifacts}
          </li>
        </ul>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--line)',
          }}
        >
          <button
            type="button"
            className="af-btn"
            onClick={onExportData}
          >
            <Download size={16} strokeWidth={1.5} />
            <span>Export all my data (JSON)</span>
          </button>

          {!confirmDeleteOpen ? (
            <button
              type="button"
              className="af-btn af-btn-danger"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 size={16} strokeWidth={1.5} />
              <span>Delete my account and data</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <button
                type="button"
                className="af-btn af-btn-danger"
                onClick={onDeleteAccount}
              >
                Confirm permanent account deletion
              </button>
              <button
                type="button"
                className="af-btn"
                onClick={() => setConfirmDeleteOpen(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

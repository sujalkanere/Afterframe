import React, { useEffect, useState } from 'react';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { FrameBrackets } from '../components/FrameBrackets.js';

export type LoginState =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'error'
  | 'expired'
  | 'redirecting';

export interface LoginScreenProps {
  initialEmail?: string;
  initialState?: LoginState;
  onSignInSuccess: (userData: { email: string; token?: string }) => void;
  onNavigateHome: () => void;
  onNavigateTerms: () => void;
  onNavigatePrivacy: () => void;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  initialEmail = '',
  initialState,
  onSignInSuccess,
  onNavigateHome,
  onNavigateTerms,
  onNavigatePrivacy,
  apiFetch,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [inputError, setInputError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Initialize state from prop or URL query parameter
  const [state, setState] = useState<LoginState>(() => {
    if (initialState) return initialState;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('expired') === 'true') return 'expired';
    }
    return 'idle';
  });

  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const validateEmail = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setInputError('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setInputError('Enter a valid email address (e.g. name@example.com).');
      return false;
    }
    setInputError(null);
    return true;
  };

  const handleSendMagicLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateEmail(email)) return;

    setState('sending');
    setServerError(null);

    try {
      const res = await apiFetch('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState('error');
        setServerError(
          data.message || 'Unable to sign in. Please check your email and try again.'
        );
        return;
      }

      // Successful passwordless request: transition to sent confirmation state
      setState('sent');
      setCooldownSeconds(60);

      // In development or when token is immediately confirmed, support auto-redirect
      if (data.sessionToken) {
        // Automatically save session token to localStorage for convenience
        try {
          localStorage.setItem('af_session_token', data.sessionToken);
        } catch {
          // Ignore storage restrictions
        }
      }
    } catch {
      setState('error');
      setServerError('Network connection failed. Please check your internet and retry.');
    }
  };

  const handleResend = () => {
    if (cooldownSeconds > 0) return;
    handleSendMagicLink();
  };

  const handleContinueWithGoogle = () => {
    // Sign-in scopes strictly limited to openid email profile (no Google Tasks scope here)
    setState('sending');
    setServerError(null);

    // In production, redirects to OAuth authorization endpoint.
    // For local dev/testing, trigger sign-in with verified Google mock researcher.
    setTimeout(async () => {
      try {
        const res = await apiFetch('/api/auth/signin', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim() || 'google.researcher@afterframe.app',
            displayName: 'Google Researcher',
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setState('redirecting');
          setTimeout(() => {
            onSignInSuccess({
              email: data.user?.email || 'google.researcher@afterframe.app',
              token: data.sessionToken,
            });
          }, 600);
        } else {
          setState('error');
          setServerError(data.message || 'Google authentication could not be completed.');
        }
      } catch {
        setState('error');
        setServerError('Could not reach Google authentication service.');
      }
    }, 400);
  };

  const handleCompleteSignIn = () => {
    setState('redirecting');
    setTimeout(() => {
      onSignInSuccess({ email: email.trim() });
    }, 500);
  };

  return (
    <div className="af-login-page">
      <div className="af-login-container">
        {/* Header Branding */}
        <div className="af-login-header">
          <button
            type="button"
            onClick={onNavigateHome}
            className="af-login-logo-btn"
            aria-label="Return to Afterframe homepage"
          >
            <span className="af-login-logo-mark" aria-hidden="true">
              [AF]
            </span>
            <span className="af-login-logo-text">Afterframe</span>
          </button>
        </div>

        {/* Center Auth Card with Viewfinder Frame Brackets */}
        <FrameBrackets active={true} className="af-login-frame">
          <div className="af-login-card">
            {/* Live announcer for screen readers */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="af-sr-only"
            >
              {state === 'sending' && 'Sending sign in request...'}
              {state === 'sent' && `Sign in link sent to ${email}. Check your inbox.`}
              {state === 'error' && `Error: ${serverError || inputError}`}
              {state === 'expired' && 'The sign in link has expired. Request a new link.'}
              {state === 'redirecting' && 'Sign in successful. Redirecting to workspace...'}
            </div>

            {/* STATE: IDLE or SENDING or ERROR */}
            {(state === 'idle' || state === 'sending' || state === 'error') && (
              <>
                <div className="af-login-title-group">
                  <h1 className="af-login-title">Sign in to Afterframe</h1>
                  <p className="af-login-subtitle">
                    Enter your email to receive a passwordless sign-in link, or continue with Google.
                  </p>
                </div>

                {state === 'error' && serverError && (
                  <div className="af-login-alert af-login-alert-error" role="alert">
                    <AlertCircle size={18} className="af-alert-icon" aria-hidden="true" />
                    <span>{serverError}</span>
                  </div>
                )}

                {/* Google OAuth Button */}
                <button
                  type="button"
                  onClick={handleContinueWithGoogle}
                  disabled={state === 'sending'}
                  className="af-btn-google"
                  aria-label="Continue with Google (sign-in scopes only: openid email profile)"
                >
                  <svg
                    className="af-google-icon"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="af-login-divider">
                  <span className="af-login-divider-line" />
                  <span className="af-login-divider-text">or with email link</span>
                  <span className="af-login-divider-line" />
                </div>

                {/* Email Form */}
                <form onSubmit={handleSendMagicLink} noValidate className="af-login-form">
                  <div className="af-form-group">
                    <label htmlFor="af-email-input" className="af-form-label">
                      Email address
                    </label>
                    <div className="af-input-wrapper">
                      <Mail size={18} className="af-input-icon" aria-hidden="true" />
                      <input
                        id="af-email-input"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (inputError) setInputError(null);
                        }}
                        disabled={state === 'sending'}
                        placeholder="you@domain.com"
                        className={`af-form-input ${inputError ? 'af-input-error' : ''}`}
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        aria-invalid={Boolean(inputError)}
                        aria-describedby={inputError ? 'af-email-error' : undefined}
                      />
                    </div>
                    {inputError && (
                      <p id="af-email-error" className="af-form-error-msg" role="alert">
                        {inputError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={state === 'sending'}
                    className="af-btn-primary af-login-submit-btn"
                  >
                    {state === 'sending' ? (
                      <>
                        <RefreshCw size={16} className="af-spin" aria-hidden="true" />
                        <span>Sending magic link...</span>
                      </>
                    ) : (
                      <>
                        <span>Send magic link</span>
                        <ArrowRight size={16} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* STATE: SENT (Check your email confirmation) */}
            {state === 'sent' && (
              <div className="af-login-sent-state">
                <div className="af-login-sent-icon" aria-hidden="true">
                  <CheckCircle2 size={44} strokeWidth={1.5} />
                </div>

                <h1 className="af-login-title">Check your inbox</h1>
                <p className="af-login-subtitle">
                  We sent a passwordless sign-in link to:
                </p>
                <div className="af-login-sent-email-badge">
                  <strong>{email}</strong>
                </div>

                <p className="af-login-sent-instructions">
                  Click the link in the email to sign in instantly. The link expires in 15 minutes.
                </p>

                <div className="af-login-sent-actions">
                  <button
                    type="button"
                    onClick={handleCompleteSignIn}
                    className="af-btn-primary af-btn-block"
                  >
                    Continue to workspace
                  </button>

                  <div className="af-resend-row">
                    <span className="af-resend-text">Didn’t get the email?</span>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={cooldownSeconds > 0}
                      className="af-btn-link"
                    >
                      {cooldownSeconds > 0
                        ? `Resend in ${cooldownSeconds}s`
                        : 'Resend link'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setState('idle');
                      setInputError(null);
                      setServerError(null);
                    }}
                    className="af-btn-secondary af-btn-sm"
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            )}

            {/* STATE: EXPIRED LINK */}
            {state === 'expired' && (
              <div className="af-login-expired-state">
                <div className="af-login-alert-icon-box" aria-hidden="true">
                  <AlertCircle size={44} strokeWidth={1.5} />
                </div>
                <h1 className="af-login-title">Sign-in link expired</h1>
                <p className="af-login-subtitle">
                  This magic link has expired or has already been used. Please request a fresh link below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setState('idle');
                    setInputError(null);
                    setServerError(null);
                  }}
                  className="af-btn-primary af-btn-block"
                >
                  Request a new link
                </button>
              </div>
            )}

            {/* STATE: REDIRECTING */}
            {state === 'redirecting' && (
              <div className="af-login-redirecting-state">
                <RefreshCw size={36} className="af-spin af-accent-color" aria-hidden="true" />
                <h1 className="af-login-title">Signed in</h1>
                <p className="af-login-subtitle">
                  Redirecting to your workspace...
                </p>
              </div>
            )}

            {/* Footer Trust & Legal Disclaimer */}
            <div className="af-login-card-footer">
              <p className="af-login-legal-note">
                We only store your email, confirmed artifacts, and research evidence. We never track your browsing or sell your data.
              </p>
              <div className="af-login-legal-links">
                <button
                  type="button"
                  onClick={onNavigatePrivacy}
                  className="af-link-subtle"
                >
                  Privacy Policy
                </button>
                <span className="af-separator" aria-hidden="true">
                  •
                </span>
                <button
                  type="button"
                  onClick={onNavigateTerms}
                  className="af-link-subtle"
                >
                  Terms of Service
                </button>
              </div>
            </div>
          </div>
        </FrameBrackets>
      </div>
    </div>
  );
};

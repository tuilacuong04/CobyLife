import React, { useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { assetUrl } from '../utils/assets';
import {
  resendSignupConfirmation,
  signInWithEmail,
  signUpWithEmail,
  verifySignupOtp,
} from '../utils/auth';
import { getRememberMePreference } from '../utils/supabaseClient';
import { animateErrorShake } from '../utils/motion';
import { MagneticButton, SlidingSegmented } from './Motion';
import {
  IconCheck,
  IconLock,
  IconMail,
  IconMoon,
  IconRefresh,
  IconSun,
  IconSylvaMark,
} from './Icons';

type LoginMode = 'signin' | 'signup';

export const LoginPage: React.FC = () => {
  const { state, toggleTheme, pushToast } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<LoginMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otpToken, setOtpToken] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { theme } = state.settings;

  const handleModeChange = (next: LoginMode) => {
    setMode(next);
    setError('');
    setInfoMsg('');
  };

  const triggerShake = (msg: string) => {
    setError(msg);
    animateErrorShake(cardRef.current);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setInfoMsg('');
    try {
      const res = await signInWithEmail(email, password, rememberMe);
      if (!res.ok) {
        triggerShake(res.error || 'Incorrect email or password.');
        return;
      }
      pushToast(`Signed in as ${res.user?.displayName || res.user?.email || email.trim()}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleanName = displayName.trim();
    const cleanEmail = email.trim();
    if (!cleanName) {
      triggerShake('Enter your display name.');
      return;
    }
    if (!cleanEmail) {
      triggerShake('Enter your email address.');
      return;
    }
    if (password.length < 6) {
      triggerShake('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    setError('');
    setInfoMsg('');
    try {
      const res = await signUpWithEmail({
        displayName: cleanName,
        email: cleanEmail,
        password,
        rememberMe,
      });
      if (!res.ok) {
        triggerShake(res.error || 'Could not create account.');
        return;
      }
      if (res.needsConfirmation) {
        setPendingEmail(res.email || cleanEmail);
        setOtpToken('');
        setInfoMsg('Check your email for the 6-digit verification code or confirmation link.');
        pushToast('Confirmation email sent — enter your 6-digit code to finish');
        return;
      }
      pushToast(`Welcome to Coby LIFE, ${res.user?.displayName || cleanName}`);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !pendingEmail) return;
    if (!otpToken.trim()) {
      triggerShake('Enter the 6-digit verification code from your email.');
      return;
    }

    setBusy(true);
    setError('');
    setInfoMsg('');
    try {
      const res = await verifySignupOtp(pendingEmail, otpToken);
      if (!res.ok) {
        triggerShake(res.error || 'Invalid or expired verification code.');
        return;
      }
      pushToast(`Email verified — welcome, ${res.user?.displayName || pendingEmail}`);
    } finally {
      setBusy(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (busy || !pendingEmail) return;
    setBusy(true);
    setError('');
    setInfoMsg('');
    try {
      const res = await resendSignupConfirmation(pendingEmail);
      if (!res.ok) {
        triggerShake(res.error || 'Could not resend confirmation email.');
        return;
      }
      setInfoMsg(`Sent a fresh confirmation email to ${pendingEmail}.`);
      pushToast('Confirmation email resent');
    } finally {
      setBusy(false);
    }
  };

  const isVerifyState = Boolean(pendingEmail);

  const titleText = isVerifyState
    ? 'Verify your email'
    : mode === 'signin'
      ? 'Welcome back'
      : 'Create your account';

  const subtitleText = isVerifyState
    ? `Enter the 6-digit code sent to ${pendingEmail} to activate cloud sync.`
    : mode === 'signin'
      ? 'Sign in with your Coby LIFE Cloud account to sync tasks and finances across devices.'
      : 'Create a free cloud account to securely sync your workspace across phone and desktop.';

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <img src={assetUrl('/images/backdrop.jpg')} alt="" className="backdrop__img" />
        <div className="backdrop__wash" />
      </div>

      <div
        className="signin-wrap"
        style={{
          height: '100dvh',
          overflowY: 'auto',
          paddingTop: 'max(64px, env(safe-area-inset-top))',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          type="button"
          className="btn btn--glass btn--sm"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          style={{
            position: 'fixed',
            top: 'max(16px, env(safe-area-inset-top))',
            right: 'max(16px, env(safe-area-inset-right))',
            zIndex: 10,
          }}
        >
          {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        <div ref={cardRef} className="signin" style={{ maxWidth: 440 }}>
          <div className="brand">
            <span className="brand__mark">
              <IconSylvaMark size={18} />
            </span>
            <span className="brand__name">
              Coby<span className="brand__tag">LIFE</span>
            </span>
          </div>

          <h1 className="signin__title">{titleText}</h1>
          <p className="signin__sub">{subtitleText}</p>

          {!isVerifyState && (
            <div style={{ marginBottom: 18 }}>
              <SlidingSegmented<LoginMode>
                value={mode}
                onChange={handleModeChange}
                ariaLabel="Authentication mode"
                className="seg--full"
                items={[
                  { id: 'signin', label: 'Sign In' },
                  { id: 'signup', label: 'Create Account' },
                ]}
              />
            </div>
          )}

          {isVerifyState ? (
            <form className="form-stack" onSubmit={handleVerifyOtp} noValidate>
              <label className="field">
                <span className="field__label">6-Digit Verification Code</span>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={8}
                  value={otpToken}
                  onChange={(e) => {
                    setOtpToken(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="123456"
                />
              </label>

              {infoMsg && (
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>
                  {infoMsg}
                </div>
              )}
              {error && <span className="field__error">{error}</span>}

              <MagneticButton
                type="submit"
                className="btn btn--primary"
                style={{ width: '100%' }}
                disabled={busy}
              >
                <IconCheck size={15} />
                <span>{busy ? 'Verifying...' : 'Verify email & enter'}</span>
              </MagneticButton>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ flex: 1 }}
                  disabled={busy}
                  onClick={() => void handleResendConfirmation()}
                >
                  <IconRefresh size={14} />
                  <span>Resend confirmation email</span>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busy}
                  onClick={() => {
                    setPendingEmail(null);
                    setOtpToken('');
                    setError('');
                    setInfoMsg('');
                    setMode('signin');
                  }}
                >
                  <IconMail size={14} />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          ) : mode === 'signin' ? (
            <form className="form-stack" onSubmit={handleSignIn} noValidate>
              <label className="field">
                <span className="field__label">Email</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="you@example.com"
                />
              </label>

              <label className="field">
                <span className="field__label">Password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your password"
                />
              </label>

              <button
                type="button"
                role="switch"
                aria-checked={rememberMe}
                className="signin__row"
                style={{ width: '100%', padding: '2px 0' }}
                onClick={() => setRememberMe((v) => !v)}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                  Remember me on this device
                </span>
                <span className={`switch ${rememberMe ? 'is-on' : ''}`} aria-hidden="true">
                  <span className="switch__knob" />
                </span>
              </button>

              {error && <span className="field__error">{error}</span>}

              <MagneticButton
                type="submit"
                className="btn btn--primary"
                style={{ width: '100%' }}
                disabled={busy}
              >
                <IconLock size={15} />
                <span>{busy ? 'Signing in...' : 'Sign in'}</span>
              </MagneticButton>
            </form>
          ) : (
            <form className="form-stack" onSubmit={handleSignUp} noValidate>
              <label className="field">
                <span className="field__label">Display Name</span>
                <input
                  className="input"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. Cuong"
                />
              </label>

              <label className="field">
                <span className="field__label">Email</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="you@example.com"
                />
              </label>

              <label className="field">
                <span className="field__label">Password (min 6 chars)</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="At least 6 characters"
                />
              </label>

              <button
                type="button"
                role="switch"
                aria-checked={rememberMe}
                className="signin__row"
                style={{ width: '100%', padding: '2px 0' }}
                onClick={() => setRememberMe((v) => !v)}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                  Remember me on this device
                </span>
                <span className={`switch ${rememberMe ? 'is-on' : ''}`} aria-hidden="true">
                  <span className="switch__knob" />
                </span>
              </button>

              {error && <span className="field__error">{error}</span>}

              <MagneticButton
                type="submit"
                className="btn btn--primary"
                style={{ width: '100%' }}
                disabled={busy}
              >
                <IconCheck size={15} />
                <span>{busy ? 'Creating account...' : 'Create account'}</span>
              </MagneticButton>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

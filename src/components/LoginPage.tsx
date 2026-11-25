import React, { useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { assetUrl } from '../utils/assets';
import {
  getAuthAccount,
  hasRegisteredAccount,
  markSessionAuthenticated,
  signIn,
  signUp,
} from '../utils/auth';
import { decodeCloudConfigCode, isCloudConfigValid } from '../utils/cloudDb';
import { animateErrorShake } from '../utils/motion';
import { MagneticButton, SlidingSegmented } from './Motion';
import {
  IconCheck,
  IconCloud,
  IconLock,
  IconMoon,
  IconSun,
  IconSylvaMark,
} from './Icons';

type LoginMode = 'signin' | 'signup' | 'pair';

export const LoginPage: React.FC = () => {
  const { state, toggleTheme, updateProfile, saveCloudConfig, pullCloudNow, pushToast } = useApp();
  const existingAccount = getAuthAccount();
  const cardRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<LoginMode>(() =>
    hasRegisteredAccount() ? 'signin' : 'signup'
  );
  const [displayName, setDisplayName] = useState(() => state.settings.profile.name || '');
  const [identifier, setIdentifier] = useState(() => existingAccount?.identifier || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [pairingCode, setPairingCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { theme } = state.settings;

  const handleModeChange = (next: LoginMode) => {
    setMode(next);
    setError('');
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
    try {
      const res = await signIn(identifier, password, rememberMe);
      if (!res.ok) {
        triggerShake(res.error || 'Incorrect email/username or password.');
        return;
      }
      pushToast(`Signed in as ${res.account?.displayName || identifier.trim()}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleanName = displayName.trim();
    const cleanId = identifier.trim();
    if (!cleanName) {
      triggerShake('Enter your display name.');
      return;
    }
    if (!cleanId) {
      triggerShake('Enter an email or username.');
      return;
    }
    if (password.length < 4) {
      triggerShake('Password must be at least 4 characters.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await signUp({
        displayName: cleanName,
        identifier: cleanId,
        password,
        rememberMe,
      });
      if (!res.ok) {
        triggerShake(res.error || 'Could not create account.');
        return;
      }
      updateProfile({ name: cleanName });
    } finally {
      setBusy(false);
    }
  };

  const handleCloudPair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const decoded = decodeCloudConfigCode(pairingCode);
    if (!decoded || !isCloudConfigValid(decoded)) {
      triggerShake('Invalid pairing code. Paste a valid code starting with COBYDB:');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await saveCloudConfig(decoded);
      if (!res.ok) {
        triggerShake(res.message || 'Could not connect to Cloud DB.');
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      await pullCloudNow();
      markSessionAuthenticated(true, 'cloud-paired', 'Synced Device');
      pushToast('Device paired & synced with Cloud DB');
    } catch (err) {
      triggerShake(err instanceof Error ? err.message : 'Cloud pairing failed.');
    } finally {
      setBusy(false);
    }
  };

  const titleText =
    mode === 'signin'
      ? existingAccount?.displayName
        ? `Welcome back, ${existingAccount.displayName}`
        : 'Welcome back'
      : mode === 'signup'
        ? 'Create your workspace'
        : 'Pair with Cloud DB';

  const subtitleText =
    mode === 'signin'
      ? 'Sign in to open your personal Tasks & Finance workspace.'
      : mode === 'signup'
        ? 'Register a local account on this device to get started.'
        : 'Paste a COBYDB: pairing code from your primary device to sync & enter.';

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

          <div style={{ marginBottom: 18 }}>
            <SlidingSegmented<LoginMode>
              value={mode}
              onChange={handleModeChange}
              ariaLabel="Authentication mode"
              className="seg--full"
              items={[
                { id: 'signin', label: 'Sign In' },
                { id: 'signup', label: 'Create Account' },
                { id: 'pair', label: 'Cloud Pair' },
              ]}
            />
          </div>

          {mode === 'signin' && (
            <form className="form-stack" onSubmit={handleSignIn} noValidate>
              <label className="field">
                <span className="field__label">Email or Username</span>
                <input
                  className="input"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="you@example.com or username"
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
          )}

          {mode === 'signup' && (
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
                <span className="field__label">Email or Username</span>
                <input
                  className="input"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="you@example.com or username"
                />
              </label>

              <label className="field">
                <span className="field__label">Password (min 4 chars)</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="At least 4 characters"
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
                <span>{busy ? 'Creating workspace...' : 'Create workspace'}</span>
              </MagneticButton>
            </form>
          )}

          {mode === 'pair' && (
            <form className="form-stack" onSubmit={handleCloudPair} noValidate>
              <label className="field">
                <span className="field__label">Device Pairing Code</span>
                <textarea
                  className="textarea"
                  rows={3}
                  autoFocus
                  value={pairingCode}
                  onChange={(e) => {
                    setPairingCode(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Paste COBYDB:... setup code from Settings → Cloud DB"
                />
                <span className="field__hint">
                  Connects Supabase or Private Gist sync and pulls your encrypted snapshot directly.
                </span>
              </label>

              {error && <span className="field__error">{error}</span>}

              <MagneticButton
                type="submit"
                className="btn btn--primary"
                style={{ width: '100%' }}
                disabled={busy}
              >
                <IconCloud size={15} />
                <span>{busy ? 'Pairing & syncing...' : 'Pair & open workspace'}</span>
              </MagneticButton>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

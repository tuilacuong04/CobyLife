import React, { useRef, useState } from 'react';
import { useCrm } from '../store/CrmContext';
import { assetUrl } from '../utils/assets';
import { animateErrorShake } from '../utils/motion';
import { MagneticButton } from './Motion';
import { IconCheck, IconEye, IconEyeOff, IconSylvaMark } from './Icons';

export const AuthViews: React.FC = () => {
  const { state, signIn, pushToast } = useCrm();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'signin' | 'reset'>('signin');
  const [email, setEmail] = useState(state.settings.profile.email);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your work email.');
      animateErrorShake(cardRef.current);
      return;
    }
    if (!password.trim()) {
      setError('Enter your password.');
      animateErrorShake(cardRef.current);
      return;
    }
    setError('');
    signIn();
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your work email.');
      animateErrorShake(cardRef.current);
      return;
    }
    setError('');
    setResetSent(true);
    pushToast(`Reset link sent to ${email.trim()}`);
  };

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <img src={assetUrl('/images/backdrop.jpg')} alt="" className="backdrop__img" />
        <div className="backdrop__wash" />
      </div>

      <div className="signin-wrap">
        <div ref={cardRef} className="signin">
          <div className="brand">
            <span className="brand__mark">
              <IconSylvaMark size={18} />
            </span>
            <span className="brand__name">
              Sylva<span className="brand__tag">CRM</span>
            </span>
          </div>

          {mode === 'signin' ? (
            <>
              <h1 className="signin__title">Welcome back</h1>
              <p className="signin__sub">Sign in to your sales workspace.</p>

              <form className="form-stack" onSubmit={handleSignIn} noValidate>
                <label className="field">
                  <span className="field__label">Work email</span>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>

                <div className="field">
                  <div className="signin__row">
                    <label className="field__label" htmlFor="signin-pw">
                      Password
                    </label>
                    <button
                      type="button"
                      className="signin__link"
                      onClick={() => {
                        setError('');
                        setResetSent(false);
                        setMode('reset');
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="signin__pw-wrap">
                    <input
                      id="signin-pw"
                      className="input"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Enter password"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      className="signin__eye"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                  </div>
                  <span className="field__hint">
                    Demo password: <strong>evergreen</strong>
                  </span>
                  {error && <span className="field__error">{error}</span>}
                </div>

                <label className="signin__check">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={keepSignedIn}
                    className={`check-btn ${keepSignedIn ? 'is-done' : ''}`}
                    onClick={() => setKeepSignedIn((v) => !v)}
                  >
                    <IconCheck size={13} />
                  </button>
                  <span>Keep me signed in</span>
                </label>

                <MagneticButton type="submit" className="btn btn--primary" style={{ width: '100%' }}>
                  Sign in
                </MagneticButton>
              </form>
            </>
          ) : (
            <>
              <h1 className="signin__title">Reset your password</h1>
              <p className="signin__sub">
                We&apos;ll send a reset link to your work email address.
              </p>

              <form className="form-stack" onSubmit={handleReset} noValidate>
                <label className="field">
                  <span className="field__label">Work email</span>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {error && <span className="field__error">{error}</span>}
                </label>

                {resetSent && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--well)',
                      fontSize: 13,
                      color: 'var(--good)',
                      fontWeight: 600,
                    }}
                  >
                    Check your inbox — a demo reset link has been dispatched.
                  </div>
                )}

                <button type="submit" className="btn btn--primary" style={{ width: '100%' }}>
                  Send reset link
                </button>

                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ width: '100%' }}
                  onClick={() => {
                    setError('');
                    setMode('signin');
                  }}
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
};

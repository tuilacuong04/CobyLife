import React, { useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { assetUrl } from '../utils/assets';
import { animateErrorShake } from '../utils/motion';
import { MagneticButton } from './Motion';
import { IconLock, IconSylvaMark } from './Icons';

export const PinLockView: React.FC = () => {
  const { state, unlockApp } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Enter your PIN to unlock.');
      animateErrorShake(cardRef.current);
      return;
    }
    const ok = unlockApp(pin);
    if (!ok) {
      setError('Incorrect PIN.');
      animateErrorShake(cardRef.current);
      return;
    }
    setError('');
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
              Coby<span className="brand__tag">LIFE</span>
            </span>
          </div>

          <h1 className="signin__title">Welcome back, {state.settings.profile.name}</h1>
          <p className="signin__sub">Your personal workspace is locked with a PIN.</p>

          <form className="form-stack" onSubmit={handleUnlock} noValidate>
            <label className="field">
              <span className="field__label">Personal PIN</span>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter PIN"
              />
              {error && <span className="field__error">{error}</span>}
            </label>

            <MagneticButton type="submit" className="btn btn--primary" style={{ width: '100%' }}>
              <IconLock size={15} />
              Unlock workspace
            </MagneticButton>
          </form>
        </div>
      </div>
    </>
  );
};

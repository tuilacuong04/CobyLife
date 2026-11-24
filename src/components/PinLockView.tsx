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
      setError('Nhập mã PIN để mở khóa.');
      animateErrorShake(cardRef.current);
      return;
    }
    const ok = unlockApp(pin);
    if (!ok) {
      setError('Mã PIN chưa đúng.');
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
              Sylva<span className="brand__tag">LIFE</span>
            </span>
          </div>

          <h1 className="signin__title">Xin chào, {state.settings.profile.name}</h1>
          <p className="signin__sub">Không gian cá nhân đang được khóa bằng mã PIN.</p>

          <form className="form-stack" onSubmit={handleUnlock} noValidate>
            <label className="field">
              <span className="field__label">Mã PIN cá nhân</span>
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
                placeholder="Nhập mã PIN"
              />
              {error && <span className="field__error">{error}</span>}
            </label>

            <MagneticButton type="submit" className="btn btn--primary" style={{ width: '100%' }}>
              <IconLock size={15} />
              Mở khóa không gian
            </MagneticButton>
          </form>
        </div>
      </div>
    </>
  );
};

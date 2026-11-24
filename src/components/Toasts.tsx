import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store/AppContext';
import { ToastItem } from '../types';
import { dur, gsap, isReducedMotion } from '../utils/motion';
import { IconCheck } from './Icons';

const ToastRow: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({
  item,
  onDismiss,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || isReducedMotion()) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 26, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: dur(0.5), ease: 'expo.out', clearProps: 'transform' }
    );
    return () => {
      tween.kill();
    };
  }, []);

  const handleClose = (after?: () => void) => {
    const el = ref.current;
    after?.();
    if (!el || isReducedMotion()) {
      onDismiss(item.id);
      return;
    }
    gsap.to(el, {
      opacity: 0,
      y: -8,
      scale: 0.97,
      duration: dur(0.24),
      ease: 'power2.in',
      onComplete: () => onDismiss(item.id),
    });
  };

  return (
    <div ref={ref} className="toast">
      <span className="toast__icon">
        <IconCheck size={15} />
      </span>
      <span>{item.message}</span>
      {item.undo && (
        <button
          type="button"
          className="toast__undo"
          onClick={() => handleClose(() => item.undo?.())}
        >
          Undo
        </button>
      )}
    </div>
  );
};

export const Toasts: React.FC = () => {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastRow key={t.id} item={t} onDismiss={dismissToast} />
      ))}
    </div>,
    document.body
  );
};

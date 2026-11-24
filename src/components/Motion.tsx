import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  animateClipPill,
  animateCountUp,
  animateHeadline,
  animateIconBounce,
  dur,
  gsap,
  isFinePointer,
  isMobileViewport,
  isReducedMotion,
} from '../utils/motion';

/**
 * Split-character page headline (.word / .ch) + animated .phead__mark-bar via GSAP.
 */
interface AnimatedTitleProps {
  text: string;
  mark?: 'lime' | 'sky' | 'amber' | 'teal';
  animKey?: string;
}

export const AnimatedTitle: React.FC<AnimatedTitleProps> = ({
  text,
  mark = 'lime',
  animKey = text,
}) => {
  const wrapRef = useRef<HTMLHeadingElement>(null);
  const words = text.split(' ');

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      animateHeadline(wrapRef.current);
    }, wrapRef);
    return () => ctx.revert();
  }, [animKey, text]);

  return (
    <h1 className="phead__title" ref={wrapRef} aria-label={text}>
      <span className="phead__title-wrap">
        {words.map((word, wi) => (
          <React.Fragment key={`${wi}-${word}`}>
            <span className="word" aria-hidden="true">
              {Array.from(word).map((ch, ci) => (
                <span key={`${wi}-${ci}`} className="ch">
                  {ch}
                </span>
              ))}
            </span>
            {wi < words.length - 1 && ' '}
          </React.Fragment>
        ))}
        <span
          className={`phead__mark-bar ${mark !== 'lime' ? `phead__mark-bar--${mark}` : ''}`}
          aria-hidden="true"
        />
      </span>
    </h1>
  );
};

/**
 * Directional page / sub-tab swap wrapper (.swap) matching Sylva's Vl component.
 */
interface SwapViewProps {
  swapKey: string;
  direction?: number; // +1 forward, -1 backward
  isPageSwap?: boolean;
  children: React.ReactNode;
}

export const SwapView: React.FC<SwapViewProps> = ({
  swapKey,
  direction = 1,
  isPageSwap = false,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const dirRef = useRef(direction);
  dirRef.current = direction;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || isReducedMotion()) return;
    const mobile = isMobileViewport();
    const dir = dirRef.current >= 0 ? 1 : -1;
    const tween = mobile
      ? gsap.fromTo(
          el,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: 'power3.out',
            overwrite: true,
            clearProps: 'transform,opacity',
          }
        )
      : gsap.fromTo(
          el,
          { opacity: 0, x: dir * 26, y: 0 },
          {
            opacity: 1,
            x: 0,
            y: 0,
            duration: 0.7,
            ease: 'expo.out',
            overwrite: true,
            clearProps: 'transform,opacity',
          }
        );
    return () => {
      tween.kill();
    };
  }, [swapKey]);

  return (
    <div ref={ref} className="swap" data-page-swap={isPageSwap ? 'true' : undefined}>
      {children}
    </div>
  );
};

/**
 * Asymmetric clip-path edge-stretching Tabs (.tabs + .tabs__pill).
 */
export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

interface SlidingTabsProps<T extends string> {
  items: TabOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
}

export function SlidingTabs<T extends string>({
  items,
  activeId,
  onChange,
}: SlidingTabsProps<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mountedRef = useRef(false);

  const sync = (animate: boolean) => {
    animateClipPill(pillRef.current, btnRefs.current[activeId], wrapRef.current, animate, 999);
  };

  useLayoutEffect(() => {
    sync(mountedRef.current);
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, items.map((i) => `${i.id}:${i.count ?? ''}`).join('|')]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => sync(false));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return (
    <div className="tabs" role="tablist" ref={wrapRef}>
      <span className="tabs__pill" ref={pillRef} aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.id}
          ref={(el) => {
            btnRefs.current[item.id] = el;
          }}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          className={`tab-btn ${activeId === item.id ? 'is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {item.count !== undefined && <span className="tab-btn__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Asymmetric clip-path edge-stretching Segmented Control (.seg + .seg__thumb + click icon bounce).
 */
export interface SegOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

interface SlidingSegProps<T extends string> {
  items: SegOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}

export function SlidingSeg<T extends string>({
  items,
  activeId,
  onChange,
  ariaLabel,
}: SlidingSegProps<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mountedRef = useRef(false);

  const sync = (animate: boolean) => {
    animateClipPill(thumbRef.current, btnRefs.current[activeId], wrapRef.current, animate, 999);
  };

  useLayoutEffect(() => {
    sync(mountedRef.current);
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, items.length]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => sync(false));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return (
    <div className="seg" role="group" aria-label={ariaLabel} ref={wrapRef}>
      <span className="seg__thumb" ref={thumbRef} aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.id}
          ref={(el) => {
            btnRefs.current[item.id] = el;
          }}
          type="button"
          aria-pressed={activeId === item.id}
          className={`seg__btn ${activeId === item.id ? 'is-active' : ''}`}
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            onChange(item.id);
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * GSAP quickTo Magnetic Button (.magnetic, 0.5s power3.out, 0.2x / 0.28y, fine pointer only).
 */
interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  className = '',
  onPointerMove,
  onPointerLeave,
  children,
  ...rest
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const qxRef = useRef<gsap.QuickToFunc | null>(null);
  const qyRef = useRef<gsap.QuickToFunc | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || isReducedMotion() || !isFinePointer()) return;
    qxRef.current = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    qyRef.current = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    return () => {
      qxRef.current = null;
      qyRef.current = null;
      gsap.set(el, { clearProps: 'transform' });
    };
  }, []);

  const handleMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerMove?.(e);
    const el = ref.current;
    if (!el || !qxRef.current || !qyRef.current) return;
    const r = el.getBoundingClientRect();
    qxRef.current((e.clientX - (r.left + r.width / 2)) * 0.2);
    qyRef.current((e.clientY - (r.top + r.height / 2)) * 0.28);
  };

  const handleLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerLeave?.(e);
    qxRef.current?.(0);
    qyRef.current?.(0);
  };

  return (
    <button
      ref={ref}
      className={`magnetic ${className}`}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      {...rest}
    >
      {children}
    </button>
  );
};

/**
 * Direct-DOM GSAP count-up figure (1.2s power3.out, 0 React re-renders).
 */
interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  duration?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format,
  duration = 1.2,
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    animateCountUp(spanRef.current, value, (n) => formatRef.current(n), duration);
  }, [value, duration]);

  return <span ref={spanRef}>{format(value)}</span>;
};

/**
 * GSAP SVG Circular Quota Ring (1.2s power3.out, delay 0.35 + idx * 0.08).
 */
interface QuotaRingProps {
  pct: number;
  index?: number;
}

export const QuotaRing: React.FC<QuotaRingProps> = ({ pct, index = 0 }) => {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const circleRef = useRef<SVGCircleElement>(null);
  const clamped = Math.min(100, Math.max(0, pct));

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    const targetOffset = circumference * (1 - clamped / 100);
    if (isReducedMotion()) {
      el.style.strokeDashoffset = `${targetOffset}`;
      return;
    }
    const tween = gsap.fromTo(
      el,
      { strokeDashoffset: circumference },
      {
        strokeDashoffset: targetOffset,
        duration: dur(1.2),
        ease: 'power3.out',
        delay: dur(0.35 + index * 0.08),
      }
    );
    return () => {
      tween.kill();
    };
  }, [clamped, circumference, index]);

  return (
    <div className="ring-wrap" aria-label={`${pct}% of quota`}>
      <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="42" cy="42" r={radius} fill="none" stroke="var(--ring-tile)" strokeWidth="8" />
        <circle
          ref={circleRef}
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      <span className="ring-wrap__pct">
        <AnimatedNumber value={pct} format={(n) => `${Math.round(n)}%`} duration={1.2} />
      </span>
    </div>
  );
};

/**
 * Portaled Popover container (position: fixed at document.body, z-index: 160)
 * matching original Sylva's .pop architecture with viewport clamping, flip,
 * anchor-based transformOrigin, and GSAP enter (0.5s expo.out) / exit (0.15s power2.in).
 */
interface AnimatedPopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: 'left' | 'right';
  offset?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const AnimatedPopover: React.FC<AnimatedPopoverProps> = ({
  open,
  anchorRef,
  align = 'right',
  offset = 10,
  className = '',
  style,
  children,
}) => {
  const [rendered, setRendered] = useState(open);
  const ref = useRef<HTMLDivElement>(null);
  const placedAboveRef = useRef(false);

  if (open && !rendered) {
    setRendered(true);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!rendered || !el) return;

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor || !el) return;
      const ar = anchor.getBoundingClientRect();
      const popW = el.offsetWidth;
      const popH = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 10;

      const rawLeft = align === 'left' ? ar.left : ar.right - popW;
      const left = Math.max(margin, Math.min(vw - popW - margin, rawLeft));

      let top = ar.bottom + offset;
      let above = false;
      if (top + popH > vh - margin && ar.top - offset - popH >= margin) {
        top = ar.top - offset - popH;
        above = true;
      }
      const maxH = above
        ? Math.max(160, ar.top - offset - margin)
        : Math.max(160, vh - top - margin);

      const anchorCenterX = ar.left + ar.width / 2;
      const originX = Math.max(16, Math.min(popW - 16, anchorCenterX - left));

      placedAboveRef.current = above;
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.style.maxHeight = `${Math.round(maxH)}px`;
      el.style.transformOrigin = `${Math.round(originX)}px ${above ? '100%' : '0%'}`;
    };

    if (open) {
      place();
      gsap.fromTo(
        el,
        { opacity: 0, y: placedAboveRef.current ? 8 : -8, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: dur(0.5),
          ease: 'expo.out',
          overwrite: true,
        }
      );

      window.addEventListener('resize', place);
      return () => {
        window.removeEventListener('resize', place);
      };
    } else {
      gsap.to(el, {
        opacity: 0,
        y: placedAboveRef.current ? 8 : -8,
        scale: 0.97,
        duration: dur(0.15),
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => setRendered(false),
      });
    }
  }, [open, rendered, anchorRef, align, offset]);

  if (!rendered || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      data-sylva-popover="true"
      className={`popover ${className}`}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
};

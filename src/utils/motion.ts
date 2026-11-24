import React, { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);
gsap.ticker.lagSmoothing(34, 16);

export { gsap, Flip };

export function isReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches === true;
}

export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(min-width: 821px)').matches === true;
}

export function isFinePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true
  );
}

export function dur(seconds: number): number {
  return isReducedMotion() ? 0 : seconds;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Exact 240 Hz sub-stepped underdamped spring used by Sylva's sidebar/dock/flyers.
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  readonly stiffness: number;
  readonly damping: number;

  constructor(initial = 0, stiffness = 24, damping = 7.6) {
    this.value = initial;
    this.target = initial;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  step(deltaSec: number): boolean {
    let dt = Math.min(Math.max(deltaSec, 0), 0.064);
    while (dt > 1e-6) {
      const h = Math.min(1 / 240, dt);
      const acc = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += acc * h;
      this.value += this.velocity * h;
      dt -= h;
    }
    if (Math.abs(this.value - this.target) < 5e-4 && Math.abs(this.velocity) < 0.005) {
      this.value = this.target;
      this.velocity = 0;
      return true; // settled
    }
    return false;
  }

  snap(val: number) {
    this.value = val;
    this.target = val;
    this.velocity = 0;
  }
}

/**
 * Page headline characters (.ch) + underline/highlight swipe (.phead__mark).
 */
export function animateHeadline(container: HTMLElement | null) {
  if (!container || isReducedMotion()) return;
  const chars = container.querySelectorAll<HTMLElement>('.ch');
  const mark = container.querySelector<HTMLElement>('.phead__mark-bar');

  if (chars.length > 0) {
    gsap.fromTo(
      chars,
      { yPercent: 115, rotation: 6 },
      {
        yPercent: 0,
        rotation: 0,
        duration: dur(0.85),
        ease: 'power4.out',
        stagger: dur(0.022),
        clearProps: 'transform',
      }
    );
  }
  if (mark) {
    gsap.fromTo(
      mark,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: dur(0.7),
        ease: 'power3.inOut',
        delay: dur(0.32),
      }
    );
  }
}

/**
 * KPI tiles with alternating subtle tilt + back.out(1.15) overshoot.
 */
export function animateKpis(els: Element[] | NodeListOf<Element>, delay = 0.15) {
  if (!els.length || isReducedMotion()) return;
  const mobile = isMobileViewport();
  gsap.fromTo(
    els,
    {
      opacity: 0,
      y: mobile ? 12 : 30,
      rotation: (i: number) => (mobile ? 0 : i % 2 ? 1.6 : -1.6),
      scale: 0.97,
    },
    {
      opacity: 1,
      y: 0,
      rotation: 0,
      scale: 1,
      duration: mobile ? 0.6 : 0.85,
      ease: 'back.out(1.15)',
      stagger: mobile ? 0.035 : 0.06,
      delay: dur(delay),
      clearProps: 'transform,opacity',
    }
  );
}

/**
 * Bento cards, Kanban columns, company cards, team cards.
 */
export function animateCards(
  els: Element[] | NodeListOf<Element>,
  opts: { y?: number; stagger?: number; delay?: number } = {}
) {
  if (!els.length || isReducedMotion()) return;
  const mobile = isMobileViewport();
  const y = opts.y ?? 18;
  const stagger = opts.stagger ?? 0.05;
  const delay = opts.delay ?? 0;

  gsap.fromTo(
    els,
    {
      opacity: 0,
      y: mobile ? Math.min(y, 12) : y,
      scale: 0.988,
    },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: mobile ? 0.55 : 0.75,
      ease: 'expo.out',
      stagger: mobile ? Math.min(stagger, 0.035) : stagger,
      delay: dur(delay),
      clearProps: 'transform,opacity',
    }
  );
}

/**
 * List rows, table rows, deal cards, quote rows, week events.
 */
export function animateRows(
  els: Element[] | NodeListOf<Element>,
  opts: { stagger?: number; delay?: number } = {}
) {
  if (!els.length || isReducedMotion()) return;
  const stagger = Math.min(opts.stagger ?? 0.025, 0.03);
  const delay = opts.delay ?? 0.2;

  gsap.fromTo(
    els,
    { opacity: 0 },
    {
      opacity: 1,
      duration: dur(0.45),
      ease: 'power2.out',
      stagger: dur(stagger),
      delay: dur(delay),
      clearProps: 'opacity',
    }
  );
}

/**
 * Direct-DOM GSAP count-up using WeakMap to remember previous numeric value.
 */
const countMap = new WeakMap<Element, { v: number }>();

export function animateCountUp(
  el: HTMLElement | null,
  target: number,
  format: (n: number) => string,
  duration = 1.2
) {
  if (!el) return;
  let state = countMap.get(el);
  if (!state) {
    state = { v: 0 };
    countMap.set(el, state);
    if (!isReducedMotion()) {
      el.textContent = format(0);
    }
  }
  if (isReducedMotion()) {
    state.v = target;
    el.textContent = format(target);
    return;
  }
  gsap.killTweensOf(state);
  gsap.to(state, {
    v: target,
    duration,
    ease: 'power3.out',
    onUpdate: () => {
      el.textContent = format(state!.v);
    },
    onComplete: () => {
      state!.v = target;
      el.textContent = format(target);
    },
  });
}

/**
 * Column sum flash + back.out(2.4) pop.
 */
export function animateFlashPop(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove('is-flash');
  void el.offsetWidth;
  el.classList.add('is-flash');
  if (isReducedMotion()) return;
  gsap.fromTo(
    el,
    { y: -4, scale: 1.08 },
    { y: 0, scale: 1, duration: 0.55, ease: 'back.out(2.4)', overwrite: 'auto', clearProps: 'transform' }
  );
}

/**
 * Click icon bounce on segmented buttons and deal stage stepper.
 */
export function animateIconBounce(el: HTMLElement | null) {
  if (!el || isReducedMotion()) return;
  const target = el.querySelector('svg') || el;
  gsap.fromTo(
    target,
    { scale: 0.7 },
    { scale: 1, duration: 0.55, ease: 'back.out(3)', overwrite: true, clearProps: 'transform' }
  );
}

/**
 * Celebratory floating delta (+kr ...) anchored above a trigger rect or center.
 */
export function spawnFloatUp(text: string, anchorRect?: DOMRect | null) {
  if (typeof document === 'undefined' || isReducedMotion()) return;
  const el = document.createElement('span');
  el.className = 'float-up';
  el.textContent = text;
  const x = anchorRect ? anchorRect.left + anchorRect.width / 2 : window.innerWidth * 0.5;
  const y = anchorRect ? anchorRect.top : window.innerHeight * 0.42;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);

  gsap.fromTo(
    el,
    { opacity: 0, y: 6, xPercent: -50, scale: 0.9 },
    {
      keyframes: [
        { opacity: 1, y: -12, scale: 1, duration: 0.35, ease: 'back.out(2)' },
        { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in', delay: 0.6 },
      ],
      onComplete: () => el.remove(),
    }
  );
}

/**
 * Asymmetric edge-stretching clip-path pill (leading edge 0.36s power3.out, trailing 0.55s power3.inOut).
 */
interface ClipBox {
  t: number;
  r: number;
  b: number;
  l: number;
}
const clipStateMap = new WeakMap<HTMLElement, ClipBox>();

export function animateClipPill(
  pill: HTMLElement | null,
  activeEl: HTMLElement | null,
  container: HTMLElement | null,
  animate: boolean,
  radius = 999
) {
  if (!pill || !activeEl || !container) return;
  const cr = container.getBoundingClientRect();
  const ar = activeEl.getBoundingClientRect();
  if (cr.width === 0 || ar.width === 0) return;

  const next: ClipBox = {
    t: Math.max(0, ar.top - cr.top),
    r: Math.max(0, cr.right - ar.right),
    b: Math.max(0, cr.bottom - ar.bottom),
    l: Math.max(0, ar.left - cr.left),
  };

  const applyClip = (box: ClipBox) => {
    pill.style.clipPath = `inset(${box.t.toFixed(1)}px ${box.r.toFixed(1)}px ${box.b.toFixed(
      1
    )}px ${box.l.toFixed(1)}px round ${radius}px)`;
  };

  const prev = clipStateMap.get(pill);
  if (!animate || !prev || isReducedMotion()) {
    const snap = { ...next };
    clipStateMap.set(pill, snap);
    gsap.killTweensOf(prev || snap);
    pill.style.opacity = '1';
    applyClip(snap);
    return;
  }

  gsap.killTweensOf(prev);
  pill.style.opacity = '1';

  const movingRight = next.l > prev.l;
  const leadDur = 0.36;
  const trailDur = 0.55;
  const crossDur = 0.45;

  const onUpdate = () => applyClip(prev);

  // Horizontal leading edge stretches ahead, trailing edge catches up
  gsap.to(prev, {
    r: next.r,
    duration: movingRight ? leadDur : trailDur,
    ease: movingRight ? 'power3.out' : 'power3.inOut',
    onUpdate,
  });
  gsap.to(prev, {
    l: next.l,
    duration: movingRight ? trailDur : leadDur,
    ease: movingRight ? 'power3.inOut' : 'power3.out',
    onUpdate,
  });
  gsap.to(prev, {
    t: next.t,
    b: next.b,
    duration: crossDur,
    ease: 'power3.inOut',
    onUpdate,
  });
}

/**
 * Quote ACCEPTED stamp slam.
 */
export function animateStampSlam(el: HTMLElement | null) {
  if (!el || isReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 1.8, opacity: 0, rotation: -18 },
    { scale: 1, opacity: 1, rotation: -8, duration: 0.55, ease: 'back.out(2.2)' }
  );
}

/**
 * Sign-in error horizontal shake.
 */
export function animateErrorShake(el: HTMLElement | null) {
  if (!el || isReducedMotion()) return;
  gsap.fromTo(
    el,
    { x: 0 },
    { keyframes: { x: [0, -8, 7, -5, 3, 0] }, duration: 0.42, ease: 'power2.out', clearProps: 'transform' }
  );
}

export function useStaggerEntrance(
  containerRef: React.RefObject<HTMLElement | null>,
  selector: string,
  deps: React.DependencyList = []
) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nodes = el.querySelectorAll(selector);
    if (!nodes.length) return;
    if (selector.includes('kpi')) {
      animateKpis(nodes, 0.08);
    } else {
      animateCards(nodes, { y: 14, stagger: 0.04, delay: 0.04 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useScrollReveal(
  containerRef: React.RefObject<HTMLElement | null>,
  selector: string,
  deps: React.DependencyList = []
) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nodes = el.querySelectorAll(selector);
    if (!nodes.length) return;
    animateCards(nodes, { y: 18, stagger: 0.05, delay: 0.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

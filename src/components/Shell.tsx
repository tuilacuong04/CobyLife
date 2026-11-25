import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { APP_MODULES } from '../modules/registry';
import { useApp } from '../store/AppContext';
import { ModuleId, PageId } from '../types';
import { assetUrl } from '../utils/assets';
import { localIsoDate } from '../utils/format';
import {
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  gsap,
  isDesktopShell,
  isReducedMotion,
  lerp,
  Spring,
} from '../utils/motion';
import { RepAvatar } from './Avatar';
import { AnimatedPopover, MagneticButton } from './Motion';
import {
  IconChevronRight,
  IconDatabase,
  IconDownload,
  IconLock,
  IconMenu,
  IconModuleGlyph,
  IconModules,
  IconMoon,
  IconOverview,
  IconPlus,
  IconRepeat,
  IconSearch,
  IconSettings,
  IconSidebarToggle,
  IconSun,
  IconSylvaMark,
  IconTasks,
  IconWallet,
} from './Icons';

const PAGE_LABELS: Record<PageId, string> = {
  overview: 'Overview',
  tasks: 'Tasks',
  finance: 'Finance',
  modules: 'Modules',
  settings: 'Settings',
};

const MODULE_IDS: ModuleId[] = ['tasks', 'finance'];
const NAV_IDS: PageId[] = ['overview', 'tasks', 'finance', 'modules'];

const MOD_COUNT = MODULE_IDS.length; // 2
const NAV_COUNT = NAV_IDS.length; // 4
const SIDEBAR_STORAGE_KEY = 'coby_life_sidebar_v1';
const STAGGER_STEP = 0.036;
const TOTAL_SIDE_ITEMS = 12; // 0..11
const TOTAL_FLYERS = 8; // 0..1 module tiles, 2..5 nav items, 6 settings, 7 theme

// Flyer 0..7 -> Sidebar item index mapping
const FLYER_TO_SIDE_IDX = [
  2, 3, // 2 core modules (tasks, finance)
  5, 6, 7, 8, // 4 nav items (overview, tasks, finance, modules)
  9, 10, // settings, theme
];

interface SlotPos {
  x: number;
  y: number;
  w: number;
}

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    route,
    drawer,
    modal,
    cloudStatus,
    navigate,
    openModal,
    toggleTheme,
    lockApp,
    exportUnifiedBackup,
    pushToast,
  } = useApp();

  const [openPopover, setOpenPopover] = useState<'modules' | 'new' | 'account' | null>(null);
  const [dockTip, setDockTip] = useState<{ label: string; x: number; y: number } | null>(null);
  const [isDesk, setIsDesk] = useState(() => isDesktopShell());
  const [isOpen, setIsOpen] = useState(() => {
    if (!isDesktopShell()) return false;
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const shellRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const sideScrollRef = useRef<HTMLDivElement>(null);
  const sideBgRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLButtonElement>(null);
  const newAnchorRef = useRef<HTMLDivElement>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const crumbRef = useRef<HTMLDivElement>(null);
  const topRightRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const sideItemRefs = useRef<(HTMLElement | null)[]>([]);
  const sideSlotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dockSlotRefs = useRef<(HTMLSpanElement | null)[]>([]); // 0..1 stack, 2..7 dock
  const flyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flyRingRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const springRef = useRef(new Spring(isOpen ? 1 : 0, 24, 7.6));
  const isOpenRef = useRef(isOpen);
  const isDeskRef = useRef(isDesk);
  const slotsRef = useRef<{ side: (SlotPos | null)[]; collapsed: (SlotPos | null)[] }>({
    side: [],
    collapsed: [],
  });
  const stackShiftRef = useRef(86);
  const reducedAnimRef = useRef<{ active: boolean; from: number; to: number; t0: number }>({
    active: false,
    from: 0,
    to: 0,
    t0: 0,
  });

  isOpenRef.current = isOpen;
  isDeskRef.current = isDesk;

  const measureSlots = useCallback(() => {
    const sideScrollEl = sideScrollRef.current;
    const mainEl = mainRef.current;
    const stackEl = stackRef.current;
    const desk = isDeskRef.current;
    const o = springRef.current.value;

    const sideTx = !desk ? (o - 1) * 340 : 0;
    const sideScrollTop = sideScrollEl ? sideScrollEl.scrollTop : 0;
    const mainRectLeft = mainEl ? mainEl.getBoundingClientRect().left : desk ? 96 : 0;

    const sideSlots: (SlotPos | null)[] = [];
    const collapsedSlots: (SlotPos | null)[] = [];

    for (let i = 0; i < TOTAL_FLYERS; i++) {
      const sEl = sideSlotRefs.current[i];
      if (sEl) {
        const r = sEl.getBoundingClientRect();
        const parentItem = sideItemRefs.current[FLYER_TO_SIDE_IDX[i]];
        const itemProg = clamp01(
          (o - STAGGER_STEP * FLYER_TO_SIDE_IDX[i]) / (1 - STAGGER_STEP * (TOTAL_SIDE_ITEMS - 1))
        );
        const itemTx =
          !isReducedMotion() && parentItem
            ? (1 - easeOutCubic(itemProg)) * (desk ? -24 : -14)
            : 0;
        sideSlots[i] = {
          x: r.left - sideTx - itemTx + r.width / 2,
          y: r.top + sideScrollTop + r.height / 2,
          w: r.width,
        };
      } else {
        sideSlots[i] = null;
      }

      const dEl = dockSlotRefs.current[i];
      if (dEl) {
        const r = dEl.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const relX =
            i < MOD_COUNT ? r.left - mainRectLeft + r.width / 2 : r.left + r.width / 2;
          collapsedSlots[i] = {
            x: relX,
            y: r.top + r.height / 2,
            w: r.width,
          };
        } else {
          collapsedSlots[i] = null;
        }
      } else {
        collapsedSlots[i] = null;
      }
    }

    slotsRef.current = { side: sideSlots, collapsed: collapsedSlots };
    if (stackEl) {
      stackShiftRef.current = stackEl.offsetWidth + 12;
    }
  }, []);

  const applyProgress = useCallback((o: number) => {
    const desk = isDeskRef.current;
    const reduced = isReducedMotion();
    const clamped = clamp01(o);
    const span = 1 - STAGGER_STEP * (TOTAL_SIDE_ITEMS - 1);

    const mainEl = mainRef.current;
    const sideEl = sideRef.current;
    const sideBg = sideBgRef.current;
    const scrimEl = scrimRef.current;
    const dockEl = dockRef.current;
    const stackEl = stackRef.current;
    const crumbEl = crumbRef.current;
    const topRightEl = topRightRef.current;

    let mainLeftLive = 0;
    let w = 0;
    if (mainEl) {
      if (desk) {
        mainLeftLive = lerp(96, 304, o);
        w = mainLeftLive - mainEl.offsetLeft;
        const tx = Math.abs(w) < 0.01 ? '' : `translate3d(${w.toFixed(2)}px, 0, 0)`;
        mainEl.style.transform = tx;

        const invTx = Math.abs(w) < 0.01 ? '' : `translate3d(${(-w).toFixed(2)}px, 0, 0)`;
        if (topRightEl) topRightEl.style.transform = invTx;
        const pheadActs = mainEl.querySelector<HTMLElement>('.phead__actions');
        if (pheadActs) pheadActs.style.transform = invTx;
      } else {
        mainEl.style.transform = '';
        mainLeftLive = mainEl.getBoundingClientRect().left;
        if (topRightEl) topRightEl.style.transform = '';
        const pheadActs = mainEl.querySelector<HTMLElement>('.phead__actions');
        if (pheadActs) pheadActs.style.transform = '';
      }
    }

    if (sideEl && sideBg) {
      if (desk) {
        sideEl.style.transform = '';
        sideBg.style.opacity = String(clamp01(o * 1.6));
        sideBg.style.transform = reduced
          ? ''
          : `translate3d(${((1 - clamped) * -18).toFixed(2)}px, 0, 0)`;
      } else {
        sideBg.style.opacity = '1';
        sideBg.style.transform = '';
        sideEl.style.transform = `translate3d(${((o - 1) * 340).toFixed(2)}px, 0, 0)`;
      }
    }
    if (scrimEl) {
      scrimEl.style.opacity = desk ? '0' : String(clamped);
    }

    for (let idx = 0; idx < TOTAL_SIDE_ITEMS; idx++) {
      const itemEl = sideItemRefs.current[idx];
      if (!itemEl) continue;
      const s = clamp01((o - STAGGER_STEP * idx) / span);
      itemEl.style.opacity = String(s);
      itemEl.style.transform = reduced
        ? ''
        : `translate3d(${((1 - easeOutCubic(s)) * (desk ? -24 : -14)).toFixed(2)}px, 0, 0)`;
    }

    if (dockEl) {
      dockEl.style.opacity = desk ? String(clamp01(1 - o * 2.2)) : '0';
    }
    const stackFade = clamp01(1 - o * 2.2);
    if (stackEl) {
      stackEl.style.opacity = String(stackFade);
      stackEl.style.pointerEvents = stackFade < 0.08 ? 'none' : '';
    }
    if (crumbEl) {
      if (desk) {
        const shift = -stackShiftRef.current * easeInOutCubic(clamped);
        crumbEl.style.transform =
          Math.abs(shift) < 0.05 ? '' : `translate3d(${shift.toFixed(2)}px, 0, 0)`;
      } else {
        crumbEl.style.transform = '';
      }
    }

    const sideScrollTop = sideScrollRef.current ? sideScrollRef.current.scrollTop : 0;
    const { side: sideSlots, collapsed: colSlots } = slotsRef.current;

    for (let i = 0; i < TOTAL_FLYERS; i++) {
      const fEl = flyRefs.current[i];
      if (!fEl) continue;

      const sPos = sideSlots[i];
      const cPos = colSlots[i];

      if (!desk) {
        if (i < MOD_COUNT && cPos) {
          fEl.style.opacity = String(stackFade);
          fEl.style.transform = `translate3d(${(mainLeftLive + cPos.x - 20).toFixed(2)}px, ${(cPos.y - 20).toFixed(2)}px, 0) scale(${(cPos.w / 40).toFixed(3)})`;
          const ring = flyRingRefs.current[i];
          if (ring) ring.style.opacity = String(stackFade);
        } else {
          fEl.style.opacity = '0';
        }
        continue;
      }

      if (!sPos || !cPos) {
        fEl.style.opacity = '0';
        continue;
      }

      const cx = i < MOD_COUNT ? mainLeftLive + cPos.x : cPos.x;
      const cy = cPos.y;
      const sx = sPos.x;
      const sy = sPos.y - sideScrollTop;

      const t = i < MOD_COUNT ? easeInOutCubic(clamped) : clamp01(o);
      const x = lerp(cx, sx, t) - 20;
      const y = lerp(cy, sy, t) - 20;

      fEl.style.opacity = '1';
      if (i < MOD_COUNT) {
        const scale = lerp(cPos.w, sPos.w, t) / 40;
        fEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
        const ring = flyRingRefs.current[i];
        if (ring) ring.style.opacity = String(clamp01(1 - o * 2.2));
      } else {
        fEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }
    }
  }, []);

  const tickRef = useRef<(() => void) | null>(null);

  const startAnimation = useCallback(
    (target: number) => {
      if (tickRef.current) {
        gsap.ticker.remove(tickRef.current);
        tickRef.current = null;
      }

      const spring = springRef.current;
      if (isReducedMotion()) {
        reducedAnimRef.current = {
          active: true,
          from: spring.value,
          to: target,
          t0: performance.now(),
        };
        const fn = () => {
          const st = reducedAnimRef.current;
          const p = clamp01((performance.now() - st.t0) / 140);
          spring.value = lerp(st.from, st.to, p);
          spring.velocity = 0;
          applyProgress(spring.value);
          if (p >= 1) {
            st.active = false;
            spring.snap(st.to);
            applyProgress(st.to);
            if (tickRef.current) {
              gsap.ticker.remove(tickRef.current);
              tickRef.current = null;
            }
          }
        };
        tickRef.current = fn;
        gsap.ticker.add(fn);
        return;
      }

      spring.target = target;
      let lastT = performance.now();
      const fn = () => {
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
        lastT = now;
        const settled = spring.step(dt);
        applyProgress(spring.value);
        if (settled) {
          spring.snap(target);
          applyProgress(target);
          if (tickRef.current) {
            gsap.ticker.remove(tickRef.current);
            tickRef.current = null;
          }
        }
      };
      tickRef.current = fn;
      gsap.ticker.add(fn);
    },
    [applyProgress]
  );

  const setSidebarOpen = useCallback((next: boolean) => {
    if (isOpenRef.current === next) return;
    isOpenRef.current = next;
    setOpenPopover(null);
    setDockTip(null);
    setIsOpen(next);
    if (isDeskRef.current) {
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore
      }
    }
  }, []);

  useEffect(() => {
    if (modal || drawer) {
      setOpenPopover(null);
      setDockTip(null);
    }
  }, [modal, drawer]);

  useEffect(() => {
    setOpenPopover(null);
    setDockTip(null);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [route.page]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpenPopover(null);
        openModal(modal?.kind === 'search' ? null : { kind: 'search' });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen(!isOpenRef.current);
        return;
      }
      if (e.key === 'Escape') {
        if (openPopover) {
          setOpenPopover(null);
        } else if (!isDeskRef.current && isOpenRef.current) {
          setSidebarOpen(false);
        }
        return;
      }
      if (inInput || modal || drawer) return;
      if (e.key === '?') {
        e.preventDefault();
        openModal({ kind: 'shortcuts' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal, drawer, openPopover, openModal, setSidebarOpen]);

  useLayoutEffect(() => {
    measureSlots();
    startAnimation(isOpen ? 1 : 0);
  }, [isOpen, measureSlots, startAnimation]);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 821px)');
    const onMq = () => {
      const desk = mq.matches;
      isDeskRef.current = desk;
      setIsDesk(desk);
      if (desk) {
        let saved = false;
        try {
          saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
        } catch {
          saved = false;
        }
        isOpenRef.current = saved;
        setIsOpen(saved);
        springRef.current.snap(saved ? 1 : 0);
      } else {
        isOpenRef.current = false;
        setIsOpen(false);
        springRef.current.snap(0);
      }
      requestAnimationFrame(() => {
        measureSlots();
        applyProgress(springRef.current.value);
      });
    };
    mq.addEventListener('change', onMq);

    const onResize = () => {
      measureSlots();
      applyProgress(springRef.current.value);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(document.documentElement);
    if (mainRef.current) ro.observe(mainRef.current);

    document.fonts?.ready.then(() => {
      measureSlots();
      applyProgress(springRef.current.value);
    });

    const sideScrollEl = sideScrollRef.current;
    const onSideScroll = () => applyProgress(springRef.current.value);
    sideScrollEl?.addEventListener('scroll', onSideScroll, { passive: true });

    return () => {
      mq.removeEventListener('change', onMq);
      ro.disconnect();
      sideScrollEl?.removeEventListener('scroll', onSideScroll);
      if (tickRef.current) {
        gsap.ticker.remove(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [measureSlots, applyProgress]);

  useLayoutEffect(() => {
    measureSlots();
    applyProgress(springRef.current.value);
  }, [route.page, measureSlots, applyProgress]);

  const handleNav = (pg: PageId, sub?: string) => {
    navigate(pg, sub);
    if (!isDeskRef.current && isOpenRef.current) {
      setSidebarOpen(false);
    }
  };

  const today = localIsoDate();
  const pendingTasksToday = state.tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate <= today
  ).length;
  const openTasksCount = state.tasks.filter((t) => t.status !== 'done').length;
  const txThisMonth = state.finance.transactions.filter((t) =>
    t.date.startsWith(today.slice(0, 7))
  ).length;
  const pendingGmailCount = state.finance.inbox.filter((it) => it.status === 'pending').length;

  const navMeta: { id: PageId; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks', badge: pendingTasksToday || openTasksCount || undefined },
    { id: 'finance', label: 'Finance', badge: pendingGmailCount || txThisMonth || undefined },
    { id: 'modules', label: 'Modules', badge: state.futureModules.length || undefined },
  ];

  const activeModuleIdx = MODULE_IDS.indexOf(route.page as ModuleId);
  const activeNavIdx = NAV_IDS.indexOf(route.page);
  const { theme, profile, pinEnabled } = state.settings;

  const renderGlyphIcon = (idx: number) => {
    switch (idx) {
      case 2:
        return <IconOverview />;
      case 3:
        return <IconTasks />;
      case 4:
        return <IconWallet />;
      case 5:
        return <IconModules />;
      case 6:
        return <IconSettings />;
      case 7:
        return theme === 'dark' ? <IconSun /> : <IconMoon />;
      default:
        return null;
    }
  };

  const handleQuickExport = () => {
    const json = exportUnifiedBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coby-life-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpenPopover(null);
    pushToast('Exported full backup (Tasks + Finance)');
  };

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <img src={assetUrl('/images/backdrop.jpg')} alt="" className="backdrop__img" />
        <div className="backdrop__wash" />
      </div>

      {/* Permanent Flyers Overlay — exact Sylva 240Hz spring morph */}
      <div className="flyers" aria-hidden="true">
        {APP_MODULES.map((mod, i) => {
          const isCurrent = activeModuleIdx === i;
          return (
            <div
              key={`fly-mod-${mod.id}`}
              ref={(el) => {
                flyRefs.current[i] = el;
              }}
              className={`fly fly--space tile--${mod.tone}`}
              style={{ zIndex: isCurrent ? 3 : 2 - i }}
            >
              <span
                ref={(el) => {
                  flyRingRefs.current[i] = el;
                }}
                className="fly__ring"
              />
              <IconModuleGlyph moduleId={mod.id} size={17} />
            </div>
          );
        })}
        {Array.from({ length: NAV_COUNT + 2 }, (_, j) => {
          const idx = MOD_COUNT + j;
          const isActive =
            (j < NAV_COUNT && activeNavIdx === j) || (j === NAV_COUNT && route.page === 'settings');
          return (
            <div
              key={`fly-glyph-${idx}`}
              ref={(el) => {
                flyRefs.current[idx] = el;
              }}
              className={`fly fly--glyph ${isActive ? 'is-active' : ''}`}
            >
              {renderGlyphIcon(idx)}
            </div>
          );
        })}
      </div>

      <div
        ref={shellRef}
        className={`shell ${isDesk ? 'is-desk' : ''} ${isOpen ? 'is-open' : ''}`}
      >
        <div
          ref={scrimRef}
          className={`scrim ${!isDesk && isOpen ? 'is-active' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* Collapsed Floating Dock */}
        <aside ref={dockRef} className="dock" aria-label="Quick navigation">
          <button
            type="button"
            className="dock__btn"
            aria-label="Expand sidebar"
            onClick={() => setSidebarOpen(true)}
            onMouseEnter={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setDockTip({ label: 'Expand sidebar', x: r.right + 12, y: r.top + r.height / 2 });
            }}
            onMouseLeave={() => setDockTip(null)}
          >
            <IconSidebarToggle size={19} />
          </button>

          <div className="dock__sep" />

          {navMeta.map((item, j) => {
            const fIdx = MOD_COUNT + j;
            const active = route.page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`dock__btn ${active ? 'is-active' : ''}`}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => handleNav(item.id)}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setDockTip({ label: item.label, x: r.right + 12, y: r.top + r.height / 2 });
                }}
                onMouseLeave={() => setDockTip(null)}
              >
                <span
                  ref={(el) => {
                    dockSlotRefs.current[fIdx] = el;
                  }}
                  className="dock__slot"
                />
                {active && <span className="dock__dot" />}
                {item.badge && item.badge > 0 && !active && <span className="dock__badge-dot" />}
              </button>
            );
          })}

          <div className="dock__sep" />

          <button
            type="button"
            className={`dock__btn ${route.page === 'settings' ? 'is-active' : ''}`}
            aria-label="Settings"
            onClick={() => handleNav('settings')}
            onMouseEnter={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setDockTip({ label: 'Settings', x: r.right + 12, y: r.top + r.height / 2 });
            }}
            onMouseLeave={() => setDockTip(null)}
          >
            <span
              ref={(el) => {
                dockSlotRefs.current[MOD_COUNT + NAV_COUNT] = el;
              }}
              className="dock__slot"
            />
            {route.page === 'settings' && <span className="dock__dot" />}
          </button>

          <button
            type="button"
            className="dock__btn"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
            onMouseEnter={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setDockTip({
                label: theme === 'dark' ? 'Light mode' : 'Dark mode',
                x: r.right + 12,
                y: r.top + r.height / 2,
              });
            }}
            onMouseLeave={() => setDockTip(null)}
          >
            <span
              ref={(el) => {
                dockSlotRefs.current[MOD_COUNT + NAV_COUNT + 1] = el;
              }}
              className="dock__slot"
            />
          </button>
        </aside>

        {/* Expanded Sidebar */}
        <aside ref={sideRef} className="side" aria-label="Main navigation">
          <div ref={sideBgRef} className="side__bg" aria-hidden="true" />
          <div ref={sideScrollRef} className="side__content">
            <div
              ref={(el) => {
                sideItemRefs.current[0] = el;
              }}
              className="side__top"
            >
              <button
                type="button"
                className="brand"
                onClick={() => handleNav('overview')}
                style={{ cursor: 'pointer' }}
              >
                <span className="brand__mark">
                  <IconSylvaMark size={18} />
                </span>
                <span className="brand__name">
                  Coby<span className="brand__tag">LIFE</span>
                </span>
              </button>
              <button
                type="button"
                className="side__toggle"
                aria-label="Collapse sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                <IconSidebarToggle size={17} />
              </button>
            </div>

            <div
              ref={(el) => {
                sideItemRefs.current[1] = el;
              }}
              className="side__label"
            >
              Modules
            </div>

            {APP_MODULES.map((mod, i) => {
              const active = route.page === mod.pageId;
              const disabled = !state.settings.enabledModules[mod.id];
              return (
                <button
                  key={mod.id}
                  ref={(el) => {
                    sideItemRefs.current[2 + i] = el;
                  }}
                  type="button"
                  className={`space-row ${active ? 'is-active' : ''}`}
                  style={{ opacity: disabled ? 0.52 : undefined }}
                  onClick={() => handleNav(mod.pageId)}
                >
                  <span
                    ref={(el) => {
                      sideSlotRefs.current[i] = el;
                    }}
                    className={`space-row__slot tile--${mod.tone}`}
                  >
                    {!isDesk && <IconModuleGlyph moduleId={mod.id} size={17} />}
                  </span>
                  <span className="space-row__text">
                    <span className="space-row__name">{mod.shortName}</span>
                    <span className="space-row__meta">{mod.tagline}</span>
                  </span>
                </button>
              );
            })}

            <div
              ref={(el) => {
                sideItemRefs.current[2 + MOD_COUNT] = el;
              }}
              className="side__label"
              style={{ marginTop: 12 }}
            >
              Menu
            </div>

            {navMeta.map((item, j) => {
              const fIdx = MOD_COUNT + j;
              const active = route.page === item.id;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    sideItemRefs.current[3 + MOD_COUNT + j] = el;
                  }}
                  type="button"
                  className={`nav-row ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => handleNav(item.id)}
                >
                  <span
                    ref={(el) => {
                      sideSlotRefs.current[fIdx] = el;
                    }}
                    className="nav-row__slot"
                  >
                    {!isDesk && renderGlyphIcon(fIdx)}
                  </span>
                  <span className="nav-row__label">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="nav-row__badge">{item.badge}</span>
                  )}
                </button>
              );
            })}

            <div className="side__foot">
              <button
                ref={(el) => {
                  sideItemRefs.current[3 + MOD_COUNT + NAV_COUNT] = el;
                }}
                type="button"
                className={`nav-row ${route.page === 'settings' ? 'is-active' : ''}`}
                onClick={() => handleNav('settings')}
              >
                <span
                  ref={(el) => {
                    sideSlotRefs.current[MOD_COUNT + NAV_COUNT] = el;
                  }}
                  className="nav-row__slot"
                >
                  {!isDesk && <IconSettings />}
                </span>
                <span className="nav-row__label">Settings</span>
              </button>

              <button
                ref={(el) => {
                  sideItemRefs.current[4 + MOD_COUNT + NAV_COUNT] = el;
                }}
                type="button"
                className="nav-row"
                onClick={toggleTheme}
              >
                <span
                  ref={(el) => {
                    sideSlotRefs.current[MOD_COUNT + NAV_COUNT + 1] = el;
                  }}
                  className="nav-row__slot"
                >
                  {!isDesk && (theme === 'dark' ? <IconSun /> : <IconMoon />)}
                </span>
                <span className="nav-row__label">
                  {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                </span>
              </button>

              <div
                ref={(el) => {
                  sideItemRefs.current[5 + MOD_COUNT + NAV_COUNT] = el;
                }}
                className="side__profile"
                onClick={() => handleNav('settings', 'profile')}
                role="button"
                tabIndex={0}
              >
                <RepAvatar src={profile.avatar} name={profile.name} size={36} />
                <div className="side__profile-text">
                  <div className="side__profile-name">{profile.name}</div>
                  <div className="side__profile-role">Personal OS</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Scroll & Topbar */}
        <div ref={mainRef} className="main">
          <div ref={topRef} className="top">
            <div className="top__left">
              <button
                type="button"
                className="burger"
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
              >
                <IconMenu size={20} />
              </button>

              <button
                ref={stackRef}
                type="button"
                className="stack"
                aria-label="Switch module"
                onClick={() => setOpenPopover(openPopover === 'modules' ? null : 'modules')}
              >
                {APP_MODULES.map((mod, i) => (
                  <span
                    key={mod.id}
                    ref={(el) => {
                      dockSlotRefs.current[i] = el;
                    }}
                    className={`stack__slot ${activeModuleIdx === i ? 'is-front' : ''}`}
                  />
                ))}
              </button>

              <AnimatedPopover
                open={openPopover === 'modules'}
                anchorRef={stackRef}
                align="left"
                className="popover--space"
                onClose={() => setOpenPopover(null)}
              >
                <div className="popover__head">
                  <span>Switch module</span>
                  <button
                    type="button"
                    className="popover__action"
                    onClick={() => {
                      setOpenPopover(null);
                      handleNav('modules');
                    }}
                  >
                    Manage
                  </button>
                </div>
                {APP_MODULES.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    className={`pop-item ${route.page === mod.pageId ? 'is-active' : ''}`}
                    onClick={() => {
                      setOpenPopover(null);
                      handleNav(mod.pageId);
                    }}
                  >
                    <span className={`pop-item__tile tile--${mod.tone}`}>
                      <IconModuleGlyph moduleId={mod.id} size={15} />
                    </span>
                    <span className="pop-item__text">
                      <span className="pop-item__title">{mod.name}</span>
                      <span className="pop-item__sub">{mod.tagline}</span>
                    </span>
                  </button>
                ))}
              </AnimatedPopover>

              <div ref={crumbRef} className="crumb">
                <button
                  type="button"
                  className="crumb__space"
                  onClick={() => handleNav('overview')}
                >
                  {profile.name}
                </button>
                <span className="crumb__sep">/</span>
                <span className="crumb__page">{PAGE_LABELS[route.page]}</span>
              </div>
            </div>

            <div ref={topRightRef} className="top__right">
              <button
                type="button"
                className="search-btn"
                onClick={() => openModal({ kind: 'search' })}
              >
                <IconSearch size={15} />
                <span className="search-btn__text">Search...</span>
                <kbd className="kbd">⌘K</kbd>
              </button>

              <div ref={newAnchorRef} style={{ position: 'relative' }}>
                <MagneticButton
                  type="button"
                  className="btn btn--primary top__new-btn"
                  onClick={() => setOpenPopover(openPopover === 'new' ? null : 'new')}
                >
                  <IconPlus size={15} />
                  <span className="top__new-label">New</span>
                </MagneticButton>
              </div>

              <AnimatedPopover
                open={openPopover === 'new'}
                anchorRef={newAnchorRef}
                align="right"
                className="popover--new"
                onClose={() => setOpenPopover(null)}
              >
                <button
                  type="button"
                  className="pop-item"
                  onClick={() => {
                    setOpenPopover(null);
                    openModal({ kind: 'new-task' });
                  }}
                >
                  <span className="pop-item__tile tile--sky">
                    <IconTasks size={15} />
                  </span>
                  <span className="pop-item__text">
                    <span className="pop-item__title">New task</span>
                    <span className="pop-item__sub">Add a personal to-do &amp; due date</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="pop-item"
                  onClick={() => {
                    setOpenPopover(null);
                    openModal({ kind: 'new-tx', defaultType: 'expense' });
                  }}
                >
                  <span className="pop-item__tile tile--coral">
                    <IconWallet size={15} />
                  </span>
                  <span className="pop-item__text">
                    <span className="pop-item__title">Log expense</span>
                    <span className="pop-item__sub">Quick input (e.g. 50k, 1.2m)</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="pop-item"
                  onClick={() => {
                    setOpenPopover(null);
                    openModal({ kind: 'new-tx', defaultType: 'income' });
                  }}
                >
                  <span className="pop-item__tile tile--lime">
                    <IconPlus size={15} />
                  </span>
                  <span className="pop-item__text">
                    <span className="pop-item__title">Log income</span>
                    <span className="pop-item__sub">Add funds to a wallet</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="pop-item"
                  onClick={() => {
                    setOpenPopover(null);
                    openModal({ kind: 'new-tx', defaultType: 'transfer' });
                  }}
                >
                  <span className="pop-item__tile tile--sand">
                    <IconRepeat size={15} />
                  </span>
                  <span className="pop-item__text">
                    <span className="pop-item__title">Transfer funds</span>
                    <span className="pop-item__sub">Move money between wallets</span>
                  </span>
                </button>
              </AnimatedPopover>

              {pinEnabled && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Lock workspace"
                  title="Lock with PIN"
                  onClick={lockApp}
                >
                  <IconLock size={17} />
                </button>
              )}

              <button
                ref={avatarBtnRef}
                type="button"
                className="avatar-btn"
                aria-label="Personal account"
                onClick={() => setOpenPopover(openPopover === 'account' ? null : 'account')}
              >
                <RepAvatar src={profile.avatar} name={profile.name} size={40} />
              </button>

              <AnimatedPopover
                open={openPopover === 'account'}
                anchorRef={avatarBtnRef}
                align="right"
                className="popover--account"
                onClose={() => setOpenPopover(null)}
              >
                <div className="acct-card">
                  <RepAvatar src={profile.avatar} name={profile.name} size={40} />
                  <div className="acct-card__info">
                    <div className="acct-card__name">{profile.name}</div>
                    <div className="acct-card__sub">{profile.tagline}</div>
                  </div>
                  <button
                    type="button"
                    className={`db-badge db-badge--${cloudStatus.state}`}
                    title="Manage Cloud Database"
                    onClick={() => {
                      setOpenPopover(null);
                      handleNav('settings', 'database');
                    }}
                  >
                    <span className="db-badge__dot" />
                    <span>
                      {cloudStatus.state === 'synced'
                        ? 'Synced'
                        : cloudStatus.state === 'syncing'
                          ? 'Syncing'
                          : cloudStatus.state === 'error'
                            ? 'DB Error'
                            : 'Local DB'}
                    </span>
                  </button>
                </div>

                <div className="pop-group">
                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      setOpenPopover(null);
                      handleNav('settings', 'database');
                    }}
                  >
                    <span
                      className={`pop-item__icon ${
                        cloudStatus.state === 'synced' ? 'pop-item__icon--accent' : ''
                      }`}
                    >
                      <IconDatabase size={16} />
                    </span>
                    <span className="pop-item__text">
                      <span className="pop-item__title">Cloud Database</span>
                      <span className="pop-item__sub">
                        {cloudStatus.provider === 'supabase'
                          ? 'Supabase Postgres · auto-sync'
                          : cloudStatus.provider === 'gist'
                            ? 'GitHub Private Gist · auto-sync'
                            : 'Connect Supabase or Gist sync'}
                      </span>
                    </span>
                    <IconChevronRight size={14} className="pop-item__chev" />
                  </button>

                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      setOpenPopover(null);
                      handleNav('settings', 'profile');
                    }}
                  >
                    <span className="pop-item__icon">
                      <IconSettings size={16} />
                    </span>
                    <span className="pop-item__text">
                      <span className="pop-item__title">Settings</span>
                      <span className="pop-item__sub">Profile, currency &amp; PIN lock</span>
                    </span>
                    <IconChevronRight size={14} className="pop-item__chev" />
                  </button>

                  <button type="button" className="pop-item" onClick={handleQuickExport}>
                    <span className="pop-item__icon">
                      <IconDownload size={16} />
                    </span>
                    <span className="pop-item__text">
                      <span className="pop-item__title">Export JSON backup</span>
                      <span className="pop-item__sub">Tasks, Finance &amp; Settings</span>
                    </span>
                  </button>
                </div>

                <div className="pop-divider" />

                <div className="pop-group">
                  <button
                    type="button"
                    className="pop-item"
                    role="switch"
                    aria-checked={theme === 'dark'}
                    onClick={toggleTheme}
                  >
                    <span className="pop-item__icon">
                      {theme === 'dark' ? <IconMoon size={16} /> : <IconSun size={16} />}
                    </span>
                    <span className="pop-item__text">
                      <span className="pop-item__title">Dark theme</span>
                      <span className="pop-item__sub">Smoked Glass / Milk Glass</span>
                    </span>
                    <span
                      className={`switch ${theme === 'dark' ? 'is-on' : ''}`}
                      aria-hidden="true"
                    >
                      <span className="switch__knob" />
                    </span>
                  </button>

                  {pinEnabled && (
                    <button
                      type="button"
                      className="pop-item pop-item--danger"
                      onClick={() => {
                        setOpenPopover(null);
                        lockApp();
                      }}
                    >
                      <span className="pop-item__icon pop-item__icon--danger">
                        <IconLock size={16} />
                      </span>
                      <span className="pop-item__text">
                        <span className="pop-item__title">Lock workspace</span>
                        <span className="pop-item__sub">Require PIN to reopen</span>
                      </span>
                    </button>
                  )}
                </div>
              </AnimatedPopover>
            </div>
          </div>

          <div ref={scrollRef} className="scroll">
            <div className="page-inner">{children}</div>
          </div>
        </div>
      </div>

      {dockTip &&
        isDesk &&
        !isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="dock-tip" style={{ left: dockTip.x, top: dockTip.y }}>
            {dockTip.label}
          </div>,
          document.body
        )}
    </>
  );
};

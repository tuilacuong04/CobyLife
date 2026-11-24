import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCrm } from '../store/CrmContext';
import { PageId, SpaceId } from '../types';
import { OPEN_STAGES, TODAY_ISO } from '../utils/format';
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
  IconActivities,
  IconBell,
  IconChevronDown,
  IconContacts,
  IconHelp,
  IconMenu,
  IconMoon,
  IconOverview,
  IconPipeline,
  IconPlus,
  IconQuotes,
  IconReports,
  IconSearch,
  IconSettings,
  IconSidebarToggle,
  IconSpaceGlyph,
  IconSun,
  IconSylvaMark,
  IconTeam,
} from './Icons';

const PAGE_LABELS: Record<PageId, string> = {
  overview: 'Overview',
  pipeline: 'Pipeline',
  contacts: 'Contacts',
  activities: 'Activities',
  quotes: 'Quotes',
  team: 'Team',
  reports: 'Reports',
  settings: 'Settings',
  help: 'Help',
};

const SPACE_IDS: SpaceId[] = ['nordlys', 'fjellgronn', 'glod'];
const NAV_IDS: PageId[] = [
  'overview',
  'pipeline',
  'contacts',
  'activities',
  'quotes',
  'team',
  'reports',
];

const SIDEBAR_STORAGE_KEY = 'sylva_sidebar_open_v1';
const STAGGER_STEP = 0.032; // exact Sylva vu = 0.032
const TOTAL_SIDE_ITEMS = 17; // 0..16

// Flyer 0..12 -> Sidebar item index mapping
const FLYER_TO_SIDE_IDX = [
  2, 3, 4, // 3 spaces
  6, 7, 8, 9, 10, 11, 12, // 7 nav items
  13, 14, 15, // settings, help, theme
];

interface SlotPos {
  x: number;
  y: number;
  w: number;
}

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    space,
    route,
    drawer,
    modal,
    navigate,
    openDrawer,
    openModal,
    switchSpace,
    toggleTheme,
    markAllNotificationsRead,
    markNotificationRead,
    signOut,
  } = useCrm();

  const [openPopover, setOpenPopover] = useState<'space' | 'new' | 'notif' | 'account' | null>(null);
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

  // Refs for direct 240Hz spring DOM animation (ZERO React re-renders during open/close!)
  const shellRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const sideBgRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLButtonElement>(null);
  const newAnchorRef = useRef<HTMLDivElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const crumbRef = useRef<HTMLDivElement>(null);
  const topRightRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const sideItemRefs = useRef<(HTMLElement | null)[]>([]);
  const sideSlotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dockSlotRefs = useRef<(HTMLSpanElement | null)[]>([]); // 0..2 = stack slots, 3..12 = dock slots
  const flyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flyRingRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const springRef = useRef(new Spring(isOpen ? 1 : 0, 24, 7.6));
  const isOpenRef = useRef(isOpen);
  const isDeskRef = useRef(isDesk);
  const slotsRef = useRef<{ side: (SlotPos | null)[]; collapsed: (SlotPos | null)[] }>({
    side: [],
    collapsed: [],
  });
  const stackShiftRef = useRef(108);
  const reducedAnimRef = useRef<{ active: boolean; from: number; to: number; t0: number }>({
    active: false,
    from: 0,
    to: 0,
    t0: 0,
  });

  isOpenRef.current = isOpen;
  isDeskRef.current = isDesk;

  // Measure slot coordinates cleanly (accounting for current transforms & sidebar scroll)
  const measureSlots = useCallback(() => {
    const sideEl = sideRef.current;
    const mainEl = mainRef.current;
    const stackEl = stackRef.current;
    const desk = isDeskRef.current;
    const o = springRef.current.value;

    const sideTx = !desk ? (o - 1) * 316 : 0;
    const sideScrollTop = sideEl ? sideEl.scrollTop : 0;
    const mainRectLeft = mainEl ? mainEl.getBoundingClientRect().left : 96;

    const sideSlots: (SlotPos | null)[] = [];
    const collapsedSlots: (SlotPos | null)[] = [];

    for (let i = 0; i < 13; i++) {
      const sEl = sideSlotRefs.current[i];
      if (sEl) {
        const r = sEl.getBoundingClientRect();
        // Side item i has a horizontal translate applied during transition; remove it via offsetLeft or snap
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
          // For 0..2 (.stack__slot inside .main), store x relative to .main left so it tracks .main seamlessly
          const relX = i < 3 ? r.left - mainRectLeft + r.width / 2 : r.left + r.width / 2;
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

  // Apply progress `o` to EVERY animated shell element in one tight imperative pass
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

    // 1. Main horizontal counter-translation & right-pinned actions (desktop only)
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
        // Also counter-pin page header actions so "+ New deal" stays locked to right edge!
        const pheadActs = mainEl.querySelector<HTMLElement>('.phead__actions');
        if (pheadActs) pheadActs.style.transform = invTx;
      } else {
        mainEl.style.transform = '';
        if (topRightEl) topRightEl.style.transform = '';
        const pheadActs = mainEl.querySelector<HTMLElement>('.phead__actions');
        if (pheadActs) pheadActs.style.transform = '';
      }
    }

    // 2. Sidebar background & mobile drawer slide + scrim
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
        sideEl.style.transform = `translate3d(${((o - 1) * 316).toFixed(2)}px, 0, 0)`;
      }
    }
    if (scrimEl) {
      scrimEl.style.opacity = desk ? '0' : String(clamped);
    }

    // 3. Staggered sidebar items (0..16)
    for (let idx = 0; idx < TOTAL_SIDE_ITEMS; idx++) {
      const itemEl = sideItemRefs.current[idx];
      if (!itemEl) continue;
      const s = clamp01((o - STAGGER_STEP * idx) / span);
      itemEl.style.opacity = String(s);
      itemEl.style.transform = reduced
        ? ''
        : `translate3d(${((1 - easeOutCubic(s)) * (desk ? -24 : -14)).toFixed(2)}px, 0, 0)`;
    }

    // 4. Dock, top-bar 3-space stack, and breadcrumb slide
    if (dockEl) {
      dockEl.style.opacity = desk ? String(clamp01((0.55 - o) / 0.55)) : '0';
    }
    if (stackEl) {
      stackEl.style.opacity = desk ? String(clamp01((0.5 - o) / 0.5)) : '1';
    }
    if (crumbEl) {
      crumbEl.style.transform = desk
        ? `translate3d(${(-stackShiftRef.current * easeInOutCubic(clamped)).toFixed(2)}px, 0, 0)`
        : '';
    }

    // 5. Permanent Flyers (3 space tiles + 10 nav glyphs)
    const { side: sideSlots, collapsed: colSlots } = slotsRef.current;
    const scrollTop = sideEl ? sideEl.scrollTop : 0;
    const overshoot = o > 1 ? o - 1 : 0;
    const sideTxPhone = !desk ? (o - 1) * 316 : 0;

    for (let i = 0; i < 13; i++) {
      const flyEl = flyRefs.current[i];
      if (!flyEl) continue;
      const sSlot = sideSlots[i];
      const cSlot = colSlots[i];
      const mappedIdx = FLYER_TO_SIDE_IDX[i];
      const s = clamp01((o - STAGGER_STEP * mappedIdx) / span);
      const ringEl = flyRingRefs.current[i];

      if (!sSlot) {
        flyEl.style.opacity = '0';
        continue;
      }

      const rx = sSlot.x + sideTxPhone;
      const ry = sSlot.y - scrollTop;

      if (cSlot && (desk || i < 3)) {
        const px = i < 3 ? (desk ? mainLeftLive + cSlot.x : cSlot.x) : cSlot.x;
        const py = cSlot.y;
        const hScale = Math.min(cSlot.w, 40) / 40;

        if (reduced) {
          const atOpen = o >= 0.5;
          const x = atOpen ? rx : px;
          const y = atOpen ? ry : py;
          const sc = atOpen ? 1 : hScale;
          flyEl.style.opacity = String(Math.abs(2 * clamped - 1));
          flyEl.style.transform = `translate3d(${(x - 20).toFixed(2)}px, ${(y - 20).toFixed(
            2
          )}px, 0) scale(${sc.toFixed(4)})`;
          if (ringEl) ringEl.style.opacity = atOpen ? '0' : '1';
        } else {
          const ex = easeOutCubic(s);
          const ey = easeInOutCubic(s);
          const x = lerp(px, rx, ex) + overshoot * (rx - px);
          const y = lerp(py, ry, ey);
          const sc = lerp(hScale, 1, ex);
          flyEl.style.opacity = '1';
          flyEl.style.transform = `translate3d(${(x - 20).toFixed(2)}px, ${(y - 20).toFixed(
            2
          )}px, 0) scale(${sc.toFixed(4)})`;
          if (ringEl) ringEl.style.opacity = String(1 - clamp01(s * 2.2));
        }
      } else {
        // Phone mode for nav glyphs (no collapsed dock): scale + fade inside sliding drawer
        const sc = 0.6 + 0.4 * easeOutCubic(s);
        flyEl.style.opacity = String(s);
        flyEl.style.transform = `translate3d(${(rx - 20).toFixed(2)}px, ${(ry - 20).toFixed(
          2
        )}px, 0) scale(${sc.toFixed(4)})`;
        if (ringEl) ringEl.style.opacity = '0';
      }
    }
  }, []);

  // Ticker callback driving the 240 Hz Spring
  const tickRef = useRef<((time: number, deltaMs: number) => void) | null>(null);

  const startSpringTo = useCallback(
    (nextOpen: boolean) => {
      const target = nextOpen ? 1 : 0;
      const spring = springRef.current;
      spring.target = target;

      if (mainRef.current) {
        mainRef.current.style.willChange = 'transform';
      }

      if (isReducedMotion()) {
        reducedAnimRef.current = {
          active: true,
          from: spring.value,
          to: target,
          t0: performance.now(),
        };
      } else {
        reducedAnimRef.current.active = false;
      }

      if (tickRef.current) {
        gsap.ticker.remove(tickRef.current);
      }

      const onTick = (_time: number, deltaMs: number) => {
        let settled = false;
        if (reducedAnimRef.current.active) {
          const { from, to, t0 } = reducedAnimRef.current;
          const p = clamp01((performance.now() - t0) / 180);
          spring.value = lerp(from, to, p);
          if (p >= 1) {
            spring.snap(to);
            reducedAnimRef.current.active = false;
            settled = true;
          }
        } else {
          settled = spring.step(deltaMs / 1000);
        }

        applyProgress(spring.value);

        if (settled) {
          gsap.ticker.remove(onTick);
          tickRef.current = null;
          if (mainRef.current) mainRef.current.style.willChange = '';
        }
      };

      tickRef.current = onTick;
      gsap.ticker.add(onTick);
    },
    [applyProgress]
  );

  const showDockTip = useCallback((label: string, el: HTMLElement) => {
    if (isOpenRef.current || !isDeskRef.current) return;
    const r = el.getBoundingClientRect();
    setDockTip({ label, x: Math.round(r.right + 14), y: Math.round(r.top + r.height / 2) });
  }, []);

  const hideDockTip = useCallback(() => {
    setDockTip(null);
  }, []);

  // Toggle sidebar (persists tiny flag only — NEVER touches CrmContext!)
  const setSidebarOpen = useCallback(
    (next: boolean) => {
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
    },
    []
  );

  // Close popovers whenever a modal or drawer opens, or on route/space change
  useEffect(() => {
    if (modal || drawer) {
      setOpenPopover(null);
      setDockTip(null);
    }
  }, [modal, drawer]);

  useEffect(() => {
    setOpenPopover(null);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [route.page, space.id]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!isOpenRef.current);
  }, [setSidebarOpen]);

  // Immediately counter-translate & launch 240Hz spring synchronously in useLayoutEffect BEFORE paint!
  const didMountRef = useRef(false);
  useLayoutEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      springRef.current.snap(isOpen ? 1 : 0);
      measureSlots();
      applyProgress(springRef.current.value);
      return;
    }
    measureSlots();
    applyProgress(springRef.current.value);
    startSpringTo(isOpen);
  }, [isOpen, measureSlots, applyProgress, startSpringTo]);

  // Listen to ⌘B shortcut, Escape on mobile drawer, and route change on mobile
  useEffect(() => {
    const onToggleEvt = () => toggleSidebar();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPopover(null);
        if (!isDeskRef.current && isOpenRef.current) setSidebarOpen(false);
      }
    };
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('[data-sylva-popover="true"]') ||
        target.closest('[data-pop-trigger]')
      ) {
        return;
      }
      setOpenPopover(null);
    };
    window.addEventListener('sylva:toggle-sidebar', onToggleEvt);
    document.addEventListener('keydown', onEsc);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      window.removeEventListener('sylva:toggle-sidebar', onToggleEvt);
      document.removeEventListener('keydown', onEsc);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [toggleSidebar, setSidebarOpen]);

  // Keep desktop vs phone media query synced + ResizeObserver + fonts.ready + sidebar scroll sync
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 821px)');
    const onMq = () => {
      const desk = mq.matches;
      isDeskRef.current = desk;
      setIsDesk(desk);
      if (!desk && isOpenRef.current) {
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

    const sideEl = sideRef.current;
    const onSideScroll = () => applyProgress(springRef.current.value);
    sideEl?.addEventListener('scroll', onSideScroll, { passive: true });

    return () => {
      mq.removeEventListener('change', onMq);
      ro.disconnect();
      sideEl?.removeEventListener('scroll', onSideScroll);
      if (tickRef.current) {
        gsap.ticker.remove(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [measureSlots, applyProgress]);

  // Re-sync flyers whenever route/space changes (e.g. badges or page header mount)
  useLayoutEffect(() => {
    measureSlots();
    applyProgress(springRef.current.value);
  }, [route.page, space.id, measureSlots, applyProgress]);

  // Close mobile drawer when navigating
  const handleNav = (pg: PageId, sub?: string) => {
    navigate(pg, sub);
    if (!isDeskRef.current && isOpenRef.current) {
      setSidebarOpen(false);
    }
  };

  const openDealsCount = space.deals.filter((d) => OPEN_STAGES.includes(d.stage)).length;
  const dueTodayCount = space.activities.filter((a) => !a.done && a.date === TODAY_ISO).length;
  const awaitingQuotesCount = space.quotes.filter((q) => q.status === 'sent').length;
  const unreadNotifs = space.notifications.filter((n) => !n.read).length;

  const navMeta: { id: PageId; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'pipeline', label: 'Pipeline', badge: openDealsCount },
    { id: 'contacts', label: 'Contacts' },
    { id: 'activities', label: 'Activities', badge: dueTodayCount },
    { id: 'quotes', label: 'Quotes', badge: awaitingQuotesCount },
    { id: 'team', label: 'Team' },
    { id: 'reports', label: 'Reports' },
  ];

  const activeSpaceIdx = SPACE_IDS.indexOf(space.id);
  const activeNavIdx = NAV_IDS.indexOf(route.page);
  const { theme, profile } = state.settings;

  const renderGlyphIcon = (idx: number) => {
    switch (idx) {
      case 3:
        return <IconOverview />;
      case 4:
        return <IconPipeline />;
      case 5:
        return <IconContacts />;
      case 6:
        return <IconActivities />;
      case 7:
        return <IconQuotes />;
      case 8:
        return <IconTeam />;
      case 9:
        return <IconReports />;
      case 10:
        return <IconSettings />;
      case 11:
        return <IconHelp />;
      case 12:
        return theme === 'dark' ? <IconSun /> : <IconMoon />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <img src="/images/backdrop.jpg" alt="" className="backdrop__img" />
        <div className="backdrop__wash" />
      </div>

      {/* Permanent Flyers Overlay — exact Sylva architecture! Never unmounts, zero flicker */}
      <div className="flyers" aria-hidden="true">
        {SPACE_IDS.map((sid, i) => {
          const sp = state.spaces[sid];
          return (
            <div
              key={`fly-sp-${sid}`}
              ref={(el) => {
                flyRefs.current[i] = el;
              }}
              className={`fly fly--space space-tile--${sp.tone}`}
              style={{ zIndex: 30 - i }}
            >
              <IconSpaceGlyph icon={sp.icon} size={18} />
              <span
                className="fly__ring"
                ref={(el) => {
                  flyRingRefs.current[i] = el;
                }}
              />
            </div>
          );
        })}

        {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((idx) => (
          <div
            key={`fly-gl-${idx}`}
            ref={(el) => {
              flyRefs.current[idx] = el;
            }}
            className="fly fly--glyph"
          >
            {renderGlyphIcon(idx)}
          </div>
        ))}
      </div>

      <div
        ref={shellRef}
        className={`shell ${isDesk ? 'is-desk' : 'is-phone'} ${isOpen ? 'is-open' : ''}`}
      >
        {/* Collapsed Floating Dock — empty 40x40 .dock__slot spacers */}
        <aside ref={dockRef} className="dock" aria-label="Primary dock" onMouseLeave={hideDockTip}>
          <button
            type="button"
            className="dock__btn"
            onClick={toggleSidebar}
            onMouseEnter={(e) => showDockTip('Sidebar ⌘B', e.currentTarget)}
            onFocus={(e) => showDockTip('Sidebar ⌘B', e.currentTarget)}
            onBlur={hideDockTip}
            aria-label="Expand sidebar"
          >
            <IconSidebarToggle />
          </button>

          <div className="dock__sep" />

          {navMeta.map((item, i) => {
            const active = route.page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`dock__btn ${active ? 'is-active' : ''}`}
                onClick={() => handleNav(item.id)}
                onMouseEnter={(e) => showDockTip(item.label, e.currentTarget)}
                onFocus={(e) => showDockTip(item.label, e.currentTarget)}
                onBlur={hideDockTip}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className="dock__slot"
                  ref={(el) => {
                    dockSlotRefs.current[3 + i] = el;
                  }}
                />
                {item.badge !== undefined && item.badge > 0 && <span className="dock__badge-dot" />}
                {active && <span className="dock__active-dot" />}
              </button>
            );
          })}

          <div className="dock__sep" />

          <button
            type="button"
            className={`dock__btn ${route.page === 'settings' ? 'is-active' : ''}`}
            onClick={() => handleNav('settings')}
            onMouseEnter={(e) => showDockTip('Settings', e.currentTarget)}
            onFocus={(e) => showDockTip('Settings', e.currentTarget)}
            onBlur={hideDockTip}
            aria-label="Settings"
          >
            <span
              className="dock__slot"
              ref={(el) => {
                dockSlotRefs.current[10] = el;
              }}
            />
            {route.page === 'settings' && <span className="dock__active-dot" />}
          </button>

          <button
            type="button"
            className={`dock__btn ${route.page === 'help' ? 'is-active' : ''}`}
            onClick={() => handleNav('help')}
            onMouseEnter={(e) => showDockTip('Help', e.currentTarget)}
            onFocus={(e) => showDockTip('Help', e.currentTarget)}
            onBlur={hideDockTip}
            aria-label="Help"
          >
            <span
              className="dock__slot"
              ref={(el) => {
                dockSlotRefs.current[11] = el;
              }}
            />
            {route.page === 'help' && <span className="dock__active-dot" />}
          </button>

          <button
            type="button"
            className="dock__btn"
            onClick={toggleTheme}
            onMouseEnter={(e) =>
              showDockTip(theme === 'dark' ? 'Light mode' : 'Dark mode', e.currentTarget)
            }
            onFocus={(e) =>
              showDockTip(theme === 'dark' ? 'Light mode' : 'Dark mode', e.currentTarget)
            }
            onBlur={hideDockTip}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span
              className="dock__slot"
              ref={(el) => {
                dockSlotRefs.current[12] = el;
              }}
            />
          </button>
        </aside>

        {/* Mobile drawer scrim */}
        <div
          ref={scrimRef}
          className={`side-scrim ${!isDesk && isOpen ? 'is-active' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Expanded Glass Sidebar — empty 40x40 .slot spacers; animated by 240Hz spring */}
        <aside ref={sideRef} className="side" aria-label="Workspace sidebar">
          <div ref={sideBgRef} className="side__bg" aria-hidden="true" />

          <div
            className="side__head"
            ref={(el) => {
              sideItemRefs.current[0] = el;
            }}
          >
            <button type="button" className="brand" onClick={() => handleNav('overview')}>
              <span className="brand__mark">
                <IconSylvaMark size={18} />
              </span>
              <span className="brand__name">
                Sylva<span className="brand__tag">CRM</span>
              </span>
            </button>
            <button
              type="button"
              className="icon-circle"
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              title="Fold sidebar (⌘B)"
            >
              <IconSidebarToggle size={16} />
            </button>
          </div>

          <div
            className="side__section-label"
            ref={(el) => {
              sideItemRefs.current[1] = el;
            }}
          >
            Spaces
          </div>

          <div className="side__group">
            <span
              className="side__pill"
              aria-hidden="true"
              style={
                {
                  '--h': '52px',
                  '--sel': Math.max(0, activeSpaceIdx),
                } as React.CSSProperties
              }
            />
            <div className="side__spaces">
              {SPACE_IDS.map((sid, i) => {
                const sp = state.spaces[sid];
                const active = sp.id === space.id;
                return (
                  <button
                    key={sp.id}
                    ref={(el) => {
                      sideItemRefs.current[2 + i] = el;
                    }}
                    type="button"
                    className={`space-btn ${active ? 'is-active' : ''}`}
                    onClick={() => {
                      switchSpace(sp.id);
                      if (!isDeskRef.current) setSidebarOpen(false);
                    }}
                  >
                    <span
                      className="slot"
                      ref={(el) => {
                        sideSlotRefs.current[i] = el;
                      }}
                    />
                    <div>
                      <div className="space-btn__name">{sp.name}</div>
                      <div className="space-btn__sub">
                        {sp.tagline} · {sp.city}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="side__section-label"
            ref={(el) => {
              sideItemRefs.current[5] = el;
            }}
          >
            Menu
          </div>

          <div className="side__group" style={{ flex: 1 }}>
            <span
              className={`side__pill ${activeNavIdx < 0 ? 'is-off' : ''}`}
              aria-hidden="true"
              style={
                {
                  '--h': '42px',
                  '--sel': Math.max(0, activeNavIdx),
                } as React.CSSProperties
              }
            />
            <nav className="side__nav">
              {navMeta.map((item, i) => {
                const active = route.page === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      sideItemRefs.current[6 + i] = el;
                    }}
                    type="button"
                    className={`nav-item ${active ? 'is-active' : ''}`}
                    onClick={() => handleNav(item.id)}
                  >
                    <span
                      className="slot"
                      ref={(el) => {
                        sideSlotRefs.current[3 + i] = el;
                      }}
                    />
                    <span>{item.label}</span>
                    {active && <span className="nav-item__dot" />}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="nav-item__badge">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="side__footer">
            <button
              ref={(el) => {
                sideItemRefs.current[13] = el;
              }}
              type="button"
              className={`nav-item ${route.page === 'settings' ? 'is-active' : ''}`}
              onClick={() => handleNav('settings')}
            >
              <span
                className="slot"
                ref={(el) => {
                  sideSlotRefs.current[10] = el;
                }}
              />
              <span>Settings</span>
            </button>

            <button
              ref={(el) => {
                sideItemRefs.current[14] = el;
              }}
              type="button"
              className={`nav-item ${route.page === 'help' ? 'is-active' : ''}`}
              onClick={() => handleNav('help')}
            >
              <span
                className="slot"
                ref={(el) => {
                  sideSlotRefs.current[11] = el;
                }}
              />
              <span>Help</span>
            </button>

            <button
              ref={(el) => {
                sideItemRefs.current[15] = el;
              }}
              type="button"
              className="side__theme-row"
              onClick={toggleTheme}
            >
              <span
                className="slot"
                ref={(el) => {
                  sideSlotRefs.current[12] = el;
                }}
              />
              <span>Dark mode</span>
              <span className={`switch ${theme === 'dark' ? 'is-on' : ''}`} aria-hidden>
                <span className="switch__knob" />
              </span>
            </button>

            <button
              ref={(el) => {
                sideItemRefs.current[16] = el;
              }}
              type="button"
              className="side__account"
              onClick={() => handleNav('settings', 'profile')}
            >
              <RepAvatar src={profile.avatar} name={profile.name} size={38} />
              <div className="side__account-info">
                <div className="side__account-name">{profile.name}</div>
                <div className="side__account-role">{profile.role}</div>
              </div>
              <IconChevronDown size={15} />
            </button>
          </div>
        </aside>

        {/* Main Fixed Content Shell */}
        <div ref={mainRef} className="main">
          <header className="top" ref={topRef}>
            <div className="top__left">
              <button
                type="button"
                className="mobile-menu-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <IconMenu />
              </button>

              {/* Top-bar 3-space stack pill — holds 3 empty 28x28 .stack__slot spacers */}
              <div className="stack-wrap">
                <button
                  ref={stackRef}
                  data-pop-trigger="space"
                  type="button"
                  className="stack"
                  onClick={() => setOpenPopover((p) => (p === 'space' ? null : 'space'))}
                  aria-label="Switch space"
                  aria-expanded={openPopover === 'space'}
                  title="Switch workspace"
                >
                  {SPACE_IDS.map((sid, i) => (
                    <span
                      key={sid}
                      className="stack__slot"
                      ref={(el) => {
                        dockSlotRefs.current[i] = el;
                      }}
                    />
                  ))}
                </button>

                <AnimatedPopover
                  open={openPopover === 'space'}
                  anchorRef={stackRef}
                  align="left"
                  style={{ width: 252 }}
                >
                  <div className="side__section-label" style={{ paddingTop: 6 }}>
                    Switch space
                  </div>
                  {SPACE_IDS.map((sid) => {
                    const sp = state.spaces[sid];
                    return (
                      <button
                        key={sid}
                        type="button"
                        className={`space-btn ${sid === space.id ? 'is-active' : ''}`}
                        onClick={() => {
                          switchSpace(sid);
                          setOpenPopover(null);
                        }}
                      >
                        <span className={`space-tile space-tile--${sp.tone}`}>
                          <IconSpaceGlyph icon={sp.icon} size={16} />
                        </span>
                        <div>
                          <div className="space-btn__name">{sp.name}</div>
                          <div className="space-btn__sub">
                            {sp.tagline} · {sp.city}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </AnimatedPopover>
              </div>

              <div ref={crumbRef} className="crumb">
                <span className="crumb__space">{space.name}</span>
                <span className="crumb__sep">/</span>
                <span className="crumb__page">{PAGE_LABELS[route.page]}</span>
              </div>
            </div>

            <div ref={topRightRef} className="top__right">
              <button
                type="button"
                className="top__search"
                onClick={() => openModal({ kind: 'search' })}
              >
                <IconSearch size={16} />
                <span className="top__search-text">Search deals, people...</span>
                <span className="kbd">⌘K</span>
              </button>

              <button
                type="button"
                className="top__find-btn"
                onClick={() => openModal({ kind: 'search' })}
                aria-label="Search"
              >
                <IconSearch size={17} />
              </button>

              {/* + New Menu */}
              <div ref={newAnchorRef} className="pop-anchor">
                <MagneticButton
                  data-pop-trigger="new"
                  type="button"
                  className="btn btn--primary top__new-btn"
                  aria-expanded={openPopover === 'new'}
                  onClick={() => setOpenPopover((p) => (p === 'new' ? null : 'new'))}
                >
                  <IconPlus size={16} />
                  <span className="top__new-label">New</span>
                </MagneticButton>

                <AnimatedPopover
                  open={openPopover === 'new'}
                  anchorRef={newAnchorRef}
                  align="right"
                >
                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      setOpenPopover(null);
                      openModal({ kind: 'new-deal' });
                    }}
                  >
                    <IconPipeline size={16} />
                    <span>Deal</span>
                    <span className="kbd pop-item__right">D</span>
                  </button>
                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      setOpenPopover(null);
                      openModal({ kind: 'new-contact' });
                    }}
                  >
                    <IconContacts size={16} />
                    <span>Contact</span>
                    <span className="kbd pop-item__right">C</span>
                  </button>
                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      setOpenPopover(null);
                      openModal({ kind: 'new-activity' });
                    }}
                  >
                    <IconActivities size={16} />
                    <span>Activity</span>
                    <span className="kbd pop-item__right">A</span>
                  </button>
                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      setOpenPopover(null);
                      openModal({ kind: 'new-quote' });
                    }}
                  >
                    <IconQuotes size={16} />
                    <span>Quote</span>
                    <span className="kbd pop-item__right">Q</span>
                  </button>
                </AnimatedPopover>
              </div>

              {/* Notifications Bell */}
              <div className="pop-anchor">
                <button
                  ref={bellBtnRef}
                  data-pop-trigger="notif"
                  type="button"
                  className="bell-btn"
                  aria-expanded={openPopover === 'notif'}
                  onClick={() => setOpenPopover((p) => (p === 'notif' ? null : 'notif'))}
                  aria-label="Notifications"
                >
                  <IconBell />
                  {unreadNotifs > 0 && <span className="bell-btn__count">{unreadNotifs}</span>}
                </button>

                <AnimatedPopover
                  open={openPopover === 'notif'}
                  anchorRef={bellBtnRef}
                  align="right"
                  className="popover--wide"
                >
                  <div className="pop-head">
                    <span className="pop-head__title">Notifications</span>
                    {unreadNotifs > 0 && (
                      <button
                        type="button"
                        className="pop-head__action"
                        onClick={markAllNotificationsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {space.notifications.length === 0 ? (
                    <div style={{ padding: '14px 8px', color: 'var(--faint)', fontSize: 13 }}>
                      All caught up.
                    </div>
                  ) : (
                    space.notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="notif-item"
                        onClick={() => {
                          markNotificationRead(n.id);
                          setOpenPopover(null);
                          if (n.route) {
                            const [, pg, sub] = n.route.split('/');
                            handleNav((pg as PageId) || 'overview', sub);
                          }
                          if (n.drawer) openDrawer(n.drawer);
                        }}
                      >
                        <span className={`notif-item__dot ${n.read ? 'is-read' : ''}`} />
                        <div>
                          <div className="notif-item__title">{n.title}</div>
                          <div className="notif-item__meta">
                            {n.meta} · {n.time}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </AnimatedPopover>
              </div>

              {/* Account Menu */}
              <div className="pop-anchor">
                <button
                  ref={avatarBtnRef}
                  data-pop-trigger="account"
                  type="button"
                  className="avatar-btn"
                  aria-expanded={openPopover === 'account'}
                  onClick={() => setOpenPopover((p) => (p === 'account' ? null : 'account'))}
                  aria-label="Account menu"
                >
                  <RepAvatar src={profile.avatar} name={profile.name} size={42} />
                </button>

                <AnimatedPopover
                  open={openPopover === 'account'}
                  anchorRef={avatarBtnRef}
                  align="right"
                >
                  <div style={{ padding: '8px 11px 6px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)' }}>{profile.email}</div>
                  </div>
                  <div className="pop-divider" />
                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      setOpenPopover(null);
                      handleNav('settings', 'profile');
                    }}
                  >
                    <span>Profile</span>
                  </button>
                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      toggleTheme();
                      setOpenPopover(null);
                    }}
                  >
                    <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                  </button>
                  <button
                    type="button"
                    className="pop-item"
                    onClick={() => {
                      setOpenPopover(null);
                      openModal({ kind: 'shortcuts' });
                    }}
                  >
                    <span>Keyboard shortcuts</span>
                    <span className="kbd pop-item__right">?</span>
                  </button>
                  <div className="pop-divider" />
                  <button
                    type="button"
                    className="pop-item"
                    style={{ color: 'var(--bad)' }}
                    onClick={() => {
                      setOpenPopover(null);
                      signOut();
                    }}
                  >
                    <span>Sign out</span>
                  </button>
                </AnimatedPopover>
              </div>
            </div>
          </header>

          <div ref={scrollRef} className="scroll">
            <div className="page">{children}</div>
          </div>
        </div>
      </div>

      {dockTip &&
        isDesk &&
        !isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="dock__tip-float"
            role="tooltip"
            style={{ left: dockTip.x, top: dockTip.y }}
          >
            {dockTip.label}
          </div>,
          document.body
        )}
    </>
  );
};

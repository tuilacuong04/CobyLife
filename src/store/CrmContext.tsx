import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AppSettings,
  Company,
  Contact,
  Deal,
  DealStage,
  DrawerState,
  ModalState,
  NotificationPrefs,
  PageId,
  PersistedState,
  Quote,
  QuoteLine,
  QuoteStatus,
  SpaceData,
  SpaceId,
  ThemeMode,
  ToastItem,
  UserProfile,
  WeekStart,
} from '../types';
import { createInitialState } from '../data/seedData';
import { loadState, saveState } from '../utils/storage';
import { addDays, formatKrCompact, quoteSubtotal, STAGE_META, TODAY_ISO } from '../utils/format';
import { dur, gsap, isMobileViewport, spawnFloatUp } from '../utils/motion';

export interface RouteState {
  page: PageId;
  sub: string;
  query: Record<string, string>;
}

const DEFAULT_SUB: Record<PageId, string> = {
  overview: '',
  pipeline: 'board',
  contacts: 'people',
  activities: 'agenda',
  quotes: 'all',
  team: '',
  reports: '',
  settings: 'profile',
  help: '',
};

const VALID_PAGES = new Set<PageId>([
  'overview',
  'pipeline',
  'contacts',
  'activities',
  'quotes',
  'team',
  'reports',
  'settings',
  'help',
]);

const APP_BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

export function parseLocation(): RouteState {
  let rawPath = window.location.pathname || '/';
  if (APP_BASE && (rawPath === APP_BASE || rawPath.startsWith(`${APP_BASE}/`))) {
    rawPath = rawPath.slice(APP_BASE.length) || '/';
  }
  const path = rawPath.replace(/^\/+|\/+$/g, '');
  const segments = path.split('/').filter(Boolean);
  const rawPage = (segments[0] || 'overview') as PageId;
  const isValid = VALID_PAGES.has(rawPage);
  const page: PageId = isValid ? rawPage : 'overview';
  const sub = (isValid ? segments[1] : '') || DEFAULT_SUB[page];
  const params = new URLSearchParams(window.location.search);
  const query: Record<string, string> = {};
  params.forEach((v, k) => {
    query[k] = v;
  });
  return { page, sub, query };
}

export function buildUrl(page: PageId, sub?: string, query?: Record<string, string>): string {
  const resolvedSub = sub !== undefined ? sub : DEFAULT_SUB[page];
  const routePath = resolvedSub ? `/${page}/${resolvedSub}` : `/${page}`;
  const base = `${APP_BASE}${routePath}`;
  if (!query) return base;
  const sp = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== '' && v !== undefined) sp.set(k, v);
  });
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

interface CrmContextValue {
  state: PersistedState;
  space: SpaceData;
  route: RouteState;
  navDir: number;
  drawer: DrawerState;
  modal: ModalState;
  toasts: ToastItem[];
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  navigate: (page: PageId, sub?: string, query?: Record<string, string>) => void;
  openDrawer: (d: DrawerState) => void;
  closeDrawer: () => void;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  pushToast: (message: string, undo?: () => void) => void;
  dismissToast: (id: string) => void;
  // Space & settings
  switchSpace: (id: SpaceId) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setWeekStartsOn: (w: WeekStart) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  updateNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;
  updateMonthlyTarget: (target: number) => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  resetDemoData: () => void;
  signOut: () => void;
  signIn: () => void;
  // Deals
  createDeal: (input: Omit<Deal, 'id'>) => Deal;
  updateDeal: (id: string, patch: Partial<Deal>, toastMsg?: string, undoable?: boolean) => void;
  moveDealStage: (id: string, nextStage: DealStage) => void;
  deleteDeal: (id: string) => void;
  // Contacts & Companies
  createContact: (input: {
    name: string;
    role: string;
    companyName: string;
    email: string;
    phone: string;
  }) => Contact;
  // Activities
  createActivity: (input: Omit<Activity, 'id' | 'done'>) => Activity;
  toggleActivityDone: (id: string) => void;
  // Quotes
  createQuote: (dealId: string, lines: Omit<QuoteLine, 'id'>[]) => Quote;
  updateQuoteStatus: (id: string, status: QuoteStatus, anchorRect?: DOMRect | null) => void;
}

const CrmContext = createContext<CrmContextValue | null>(null);

let idSeq = 1000;
function uid(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`;
}

const PAGE_ORDER: Record<PageId, number> = {
  overview: 0,
  pipeline: 1,
  contacts: 2,
  activities: 3,
  quotes: 4,
  team: 5,
  reports: 6,
  settings: 7,
  help: 8,
};

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [route, setRoute] = useState<RouteState>(() => parseLocation());
  const [navDir, setNavDir] = useState(1);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const routeRef = useRef(route);
  routeRef.current = route;
  const exitTweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  useEffect(() => {
    const onPop = () => setRoute(parseLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, undo?: () => void) => {
      const id = uid('toast');
      setToasts((prev) => [...prev.slice(-2), { id, message, undo }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, undo ? 5500 : 3200);
    },
    [dismissToast]
  );

  const navigate = useCallback((page: PageId, sub?: string, query?: Record<string, string>) => {
    const prev = routeRef.current;
    const url = buildUrl(page, sub, query);
    const dir = PAGE_ORDER[page] >= PAGE_ORDER[prev.page] ? 1 : -1;

    const swapEl = document.querySelector<HTMLElement>('.scroll [data-page-swap="true"]');
    const hadExitTween = exitTweenRef.current !== null;
    if (exitTweenRef.current) {
      exitTweenRef.current.kill();
      exitTweenRef.current = null;
    }

    const doCommit = () => {
      exitTweenRef.current = null;
      window.history.pushState({}, '', url);
      setNavDir(dir);
      setRoute(parseLocation());
      setMobileMenuOpen(false);
    };

    if (prev.page !== page && swapEl && dur(0.18) > 0) {
      const mobile = isMobileViewport();
      exitTweenRef.current = gsap.to(swapEl, {
        opacity: 0,
        x: mobile ? 0 : -dir * 12,
        duration: mobile ? 0.14 : 0.18,
        ease: 'power2.in',
        overwrite: true,
        onComplete: doCommit,
      });
    } else {
      if (hadExitTween && swapEl) {
        gsap.set(swapEl, { clearProps: 'transform,opacity' });
      }
      doCommit();
    }
  }, []);

  const openDrawer = useCallback((d: DrawerState) => setDrawer(d), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const openModal = useCallback((m: ModalState) => setModal(m), []);
  const closeModal = useCallback(() => setModal(null), []);

  const updateActiveSpace = useCallback((updater: (space: SpaceData) => SpaceData) => {
    setState((prev) => {
      const current = prev.spaces[prev.activeSpaceId];
      return {
        ...prev,
        spaces: {
          ...prev.spaces,
          [prev.activeSpaceId]: updater(current),
        },
      };
    });
  }, []);

  const switchSpace = useCallback(
    (id: SpaceId) => {
      if (stateRef.current.activeSpaceId === id) return;
      if (exitTweenRef.current) {
        exitTweenRef.current.kill();
        exitTweenRef.current = null;
      }
      const doSwitch = () => {
        exitTweenRef.current = null;
        setState((prev) => ({ ...prev, activeSpaceId: id }));
        setDrawer(null);
        setMobileMenuOpen(false);
        const nextName = stateRef.current.spaces[id].name;
        pushToast(`Switched to ${nextName}`);
      };
      const swapEl = document.querySelector<HTMLElement>('.scroll [data-page-swap="true"]');
      if (swapEl && dur(0.18) > 0) {
        const mobile = isMobileViewport();
        exitTweenRef.current = gsap.to(swapEl, {
          opacity: 0,
          y: mobile ? 0 : -8,
          duration: mobile ? 0.14 : 0.18,
          ease: 'power2.in',
          overwrite: true,
          onComplete: doSwitch,
        });
      } else {
        doSwitch();
      }
    },
    [pushToast]
  );

  const setTheme = useCallback((theme: ThemeMode) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, theme } }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
      },
    }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, sidebarOpen: !prev.settings.sidebarOpen },
    }));
  }, []);

  const setWeekStartsOn = useCallback((weekStartsOn: WeekStart) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, weekStartsOn },
    }));
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          profile: { ...prev.settings.profile, ...patch },
        },
      }));
      pushToast('Profile saved');
    },
    [pushToast]
  );

  const updateNotificationPrefs = useCallback((patch: Partial<NotificationPrefs>) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        notifications: { ...prev.settings.notifications, ...patch },
      },
    }));
  }, []);

  const updateMonthlyTarget = useCallback(
    (target: number) => {
      const safe = Math.max(10000, Math.round(target));
      updateActiveSpace((s) => ({ ...s, monthlyTarget: safe }));
      pushToast('Monthly target updated');
    },
    [updateActiveSpace, pushToast]
  );

  const markAllNotificationsRead = useCallback(() => {
    updateActiveSpace((s) => ({
      ...s,
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, [updateActiveSpace]);

  const markNotificationRead = useCallback(
    (id: string) => {
      updateActiveSpace((s) => ({
        ...s,
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },
    [updateActiveSpace]
  );

  const resetDemoData = useCallback(() => {
    const fresh = createInitialState();
    setState((prev) => ({
      ...fresh,
      settings: {
        ...fresh.settings,
        theme: prev.settings.theme,
        sidebarOpen: prev.settings.sidebarOpen,
      },
    }));
    setDrawer(null);
    pushToast('Demo workspaces restored');
  }, [pushToast]);

  const signOut = useCallback(() => {
    setState((prev) => ({ ...prev, signedIn: false }));
    setDrawer(null);
    setModal(null);
    pushToast('Signed out');
  }, [pushToast]);

  const signIn = useCallback(() => {
    setState((prev) => ({ ...prev, signedIn: true }));
    pushToast(`Welcome back, ${stateRef.current.settings.profile.name.split(' ')[0]}`);
  }, [pushToast]);

  const createDeal = useCallback(
    (input: Omit<Deal, 'id'>): Deal => {
      const deal: Deal = { ...input, id: uid('deal') };
      updateActiveSpace((s) => ({
        ...s,
        deals: [deal, ...s.deals],
      }));
      pushToast(`Created "${deal.title}"`);
      return deal;
    },
    [updateActiveSpace, pushToast]
  );

  const updateDeal = useCallback(
    (id: string, patch: Partial<Deal>, toastMsg?: string, undoable = false) => {
      const prevSnapshot = stateRef.current.spaces[stateRef.current.activeSpaceId].deals;
      const spaceId = stateRef.current.activeSpaceId;
      updateActiveSpace((s) => ({
        ...s,
        deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }));
      if (toastMsg) {
        pushToast(
          toastMsg,
          undoable
            ? () => {
                setState((curr) => ({
                  ...curr,
                  spaces: {
                    ...curr.spaces,
                    [spaceId]: {
                      ...curr.spaces[spaceId],
                      deals: prevSnapshot,
                    },
                  },
                }));
              }
            : undefined
        );
      }
    },
    [updateActiveSpace, pushToast]
  );

  const moveDealStage = useCallback(
    (id: string, nextStage: DealStage) => {
      const spaceId = stateRef.current.activeSpaceId;
      const currentSpace = stateRef.current.spaces[spaceId];
      const target = currentSpace.deals.find((d) => d.id === id);
      if (!target || target.stage === nextStage) return;
      const prevDeals = currentSpace.deals;
      const patch: Partial<Deal> = {
        stage: nextStage,
        ...(nextStage === 'won' ? { closeDate: TODAY_ISO } : {}),
      };
      updateActiveSpace((s) => ({
        ...s,
        deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }));
      if (nextStage === 'won') {
        spawnFloatUp(`+${formatKrCompact(target.value)}`);
      }
      pushToast(`"${target.title}" → ${STAGE_META[nextStage].label}`, () => {
        setState((curr) => ({
          ...curr,
          spaces: {
            ...curr.spaces,
            [spaceId]: { ...curr.spaces[spaceId], deals: prevDeals },
          },
        }));
      });
    },
    [updateActiveSpace, pushToast]
  );

  const deleteDeal = useCallback(
    (id: string) => {
      const spaceId = stateRef.current.activeSpaceId;
      const currentSpace = stateRef.current.spaces[spaceId];
      const target = currentSpace.deals.find((d) => d.id === id);
      if (!target) return;
      const prevDeals = currentSpace.deals;
      updateActiveSpace((s) => ({
        ...s,
        deals: s.deals.filter((d) => d.id !== id),
      }));
      setDrawer(null);
      pushToast(`Deleted "${target.title}"`, () => {
        setState((curr) => ({
          ...curr,
          spaces: {
            ...curr.spaces,
            [spaceId]: { ...curr.spaces[spaceId], deals: prevDeals },
          },
        }));
      });
    },
    [updateActiveSpace, pushToast]
  );

  const createContact = useCallback(
    (input: {
      name: string;
      role: string;
      companyName: string;
      email: string;
      phone: string;
    }): Contact => {
      const currentSpace = stateRef.current.spaces[stateRef.current.activeSpaceId];
      const existingCompany = currentSpace.companies.find(
        (c) => c.name.toLowerCase() === input.companyName.trim().toLowerCase()
      );
      let newCompany: Company | null = null;
      let companyId = existingCompany?.id;
      if (!companyId) {
        newCompany = {
          id: uid('comp'),
          name: input.companyName.trim() || 'Independent',
          industry: 'Commercial',
          city: currentSpace.city,
          staff: 45,
        };
        companyId = newCompany.id;
      }
      const tones: Contact['tone'][] = ['lime', 'sky', 'coral', 'sand'];
      const contact: Contact = {
        id: uid('con'),
        name: input.name.trim(),
        role: input.role.trim() || 'Contact',
        companyId,
        email: input.email.trim() || `${input.name.toLowerCase().replace(/\s+/g, '.')}@example.no`,
        phone: input.phone.trim() || '+47 900 00 000',
        status: 'Prospect',
        ownerId: currentSpace.reps[0]?.id || 'rep-ananya',
        lastTouch: TODAY_ISO,
        tone: tones[currentSpace.contacts.length % tones.length],
      };
      updateActiveSpace((s) => ({
        ...s,
        companies: newCompany ? [newCompany, ...s.companies] : s.companies,
        contacts: [contact, ...s.contacts],
      }));
      pushToast(`Added ${contact.name}`);
      return contact;
    },
    [updateActiveSpace, pushToast]
  );

  const createActivity = useCallback(
    (input: Omit<Activity, 'id' | 'done'>): Activity => {
      const activity: Activity = { ...input, id: uid('act'), done: false };
      updateActiveSpace((s) => ({
        ...s,
        activities: [activity, ...s.activities],
      }));
      pushToast(`Planned "${activity.title}"`);
      return activity;
    },
    [updateActiveSpace, pushToast]
  );

  const toggleActivityDone = useCallback(
    (id: string) => {
      const spaceId = stateRef.current.activeSpaceId;
      const currentSpace = stateRef.current.spaces[spaceId];
      const act = currentSpace.activities.find((a) => a.id === id);
      if (!act) return;
      const prevActivities = currentSpace.activities;
      const nextDone = !act.done;
      updateActiveSpace((s) => ({
        ...s,
        activities: s.activities.map((a) => (a.id === id ? { ...a, done: nextDone } : a)),
      }));
      pushToast(nextDone ? `Completed "${act.title}"` : `Reopened "${act.title}"`, () => {
        setState((curr) => ({
          ...curr,
          spaces: {
            ...curr.spaces,
            [spaceId]: { ...curr.spaces[spaceId], activities: prevActivities },
          },
        }));
      });
    },
    [updateActiveSpace, pushToast]
  );

  const createQuote = useCallback(
    (dealId: string, lines: Omit<QuoteLine, 'id'>[]): Quote => {
      const currentSpace = stateRef.current.spaces[stateRef.current.activeSpaceId];
      const deal = currentSpace.deals.find((d) => d.id === dealId) || currentSpace.deals[0];
      const prefix =
        currentSpace.id === 'nordlys'
          ? 'NO'
          : currentSpace.id === 'fjellgronn'
            ? 'FG'
            : 'GH';
      const nextNum = 175 + currentSpace.quotes.length * 3;
      const quote: Quote = {
        id: uid('qt'),
        number: `${prefix}-2026-${nextNum}`,
        dealId: deal.id,
        companyId: deal.companyId,
        issuedDate: TODAY_ISO,
        validUntil: addDays(TODAY_ISO, 30),
        status: 'draft',
        lines: lines.map((l, idx) => ({ ...l, id: uid(`ql${idx}`) })),
      };
      updateActiveSpace((s) => ({
        ...s,
        quotes: [quote, ...s.quotes],
      }));
      pushToast(`Saved draft ${quote.number}`);
      return quote;
    },
    [updateActiveSpace, pushToast]
  );

  const updateQuoteStatus = useCallback(
    (id: string, status: QuoteStatus, anchorRect?: DOMRect | null) => {
      const spaceId = stateRef.current.activeSpaceId;
      const currentSpace = stateRef.current.spaces[spaceId];
      const target = currentSpace.quotes.find((q) => q.id === id);
      if (!target) return;
      const prevQuotes = currentSpace.quotes;
      const prevDeals = currentSpace.deals;
      const subTotal = quoteSubtotal(target.lines);

      updateActiveSpace((s) => ({
        ...s,
        quotes: s.quotes.map((q) => (q.id === id ? { ...q, status } : q)),
        deals:
          status === 'accepted'
            ? s.deals.map((d) =>
                d.id === target.dealId
                  ? { ...d, stage: 'won', closeDate: TODAY_ISO, value: subTotal || d.value }
                  : d
              )
            : s.deals,
      }));

      const label =
        status === 'sent'
          ? `Sent ${target.number}`
          : status === 'accepted'
            ? `${target.number} accepted — deal marked Won`
            : `${target.number} marked declined`;

      if (status === 'accepted') {
        spawnFloatUp(`+${formatKrCompact(subTotal)}`, anchorRect);
      }

      pushToast(label, () => {
        setState((curr) => ({
          ...curr,
          spaces: {
            ...curr.spaces,
            [spaceId]: {
              ...curr.spaces[spaceId],
              quotes: prevQuotes,
              deals: prevDeals,
            },
          },
        }));
      });
    },
    [updateActiveSpace, pushToast]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    let gPending = false;
    let gTimer: number | null = null;

    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!stateRef.current.signedIn) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setModal((m) => (m?.kind === 'search' ? null : { kind: 'search' }));
        return;
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sylva:toggle-sidebar'));
        return;
      }
      if (e.key === 'Escape') {
        if (modal) {
          setModal(null);
          return;
        }
        if (drawer) {
          setDrawer(null);
          return;
        }
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
        return;
      }

      if (isEditable(e.target) || modal) return;

      if (gPending) {
        gPending = false;
        if (gTimer) window.clearTimeout(gTimer);
        const map: Record<string, PageId> = {
          o: 'overview',
          p: 'pipeline',
          c: 'contacts',
          a: 'activities',
          q: 'quotes',
          t: 'team',
          r: 'reports',
          s: 'settings',
          h: 'help',
        };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          navigate(dest);
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        setModal({ kind: 'search' });
      } else if (e.key === '?') {
        e.preventDefault();
        setModal({ kind: 'shortcuts' });
      } else if (e.key.toLowerCase() === 'g' && !mod && !e.altKey) {
        gPending = true;
        gTimer = window.setTimeout(() => {
          gPending = false;
        }, 1200);
      } else if (e.key.toLowerCase() === 'n' && !mod && !e.altKey) {
        e.preventDefault();
        setModal({ kind: 'new-deal' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (gTimer) window.clearTimeout(gTimer);
    };
  }, [drawer, modal, mobileMenuOpen, navigate, toggleSidebar]);

  const space = state.spaces[state.activeSpaceId];

  const value = useMemo<CrmContextValue>(
    () => ({
      state,
      space,
      route,
      navDir,
      drawer,
      modal,
      toasts,
      mobileMenuOpen,
      setMobileMenuOpen,
      navigate,
      openDrawer,
      closeDrawer,
      openModal,
      closeModal,
      pushToast,
      dismissToast,
      switchSpace,
      setTheme,
      toggleTheme,
      toggleSidebar,
      setWeekStartsOn,
      updateProfile,
      updateNotificationPrefs,
      updateMonthlyTarget,
      markAllNotificationsRead,
      markNotificationRead,
      resetDemoData,
      signOut,
      signIn,
      createDeal,
      updateDeal,
      moveDealStage,
      deleteDeal,
      createContact,
      createActivity,
      toggleActivityDone,
      createQuote,
      updateQuoteStatus,
    }),
    [
      state,
      space,
      route,
      navDir,
      drawer,
      modal,
      toasts,
      mobileMenuOpen,
      navigate,
      openDrawer,
      closeDrawer,
      openModal,
      closeModal,
      pushToast,
      dismissToast,
      switchSpace,
      setTheme,
      toggleTheme,
      toggleSidebar,
      setWeekStartsOn,
      updateProfile,
      updateNotificationPrefs,
      updateMonthlyTarget,
      markAllNotificationsRead,
      markNotificationRead,
      resetDemoData,
      signOut,
      signIn,
      createDeal,
      updateDeal,
      moveDealStage,
      deleteDeal,
      createContact,
      createActivity,
      toggleActivityDone,
      createQuote,
      updateQuoteStatus,
    ]
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
};

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used inside CrmProvider');
  return ctx;
}

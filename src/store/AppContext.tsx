import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DrawerState,
  FinanceTransaction,
  FinanceWallet,
  FutureModuleIdea,
  ModalState,
  ModuleId,
  PageId,
  PersistedAppState,
  TaskItem,
  TaskStatus,
  ThemeMode,
  ToastItem,
  UserProfile,
} from '../types';
import { createEmptyPersonalState, createStarterState } from '../data/seedData';
import {
  getLocalUpdatedAt,
  hasStoredAppState,
  loadAppState,
  normalizePersistedState,
  saveAppState,
  setLocalUpdatedAt,
} from '../utils/storage';
import {
  CloudDbConfig,
  CloudSyncStatus,
  DEFAULT_CLOUD_CONFIG,
  isCloudConfigValid,
  loadCloudConfig,
  loadLocalIdbSnapshot,
  pullFromCloudDb,
  pushToCloudDb,
  saveCloudConfigToStorage,
  saveLocalIdbSnapshot,
  UnifiedVaultPayload,
} from '../utils/cloudDb';
import { addDaysIso, localIsoDate } from '../utils/format';
import { dur, gsap, isMobileViewport, spawnFloatUp } from '../utils/motion';

export interface RouteState {
  page: PageId;
  sub: string;
  query: Record<string, string>;
}

const DEFAULT_SUB: Record<PageId, string> = {
  overview: '',
  tasks: 'agenda',
  finance: 'overview',
  modules: '',
  settings: 'profile',
};

const VALID_PAGES = new Set<PageId>([
  'overview',
  'tasks',
  'finance',
  'modules',
  'settings',
]);

const PAGE_ORDER: Record<PageId, number> = {
  overview: 0,
  tasks: 1,
  finance: 2,
  modules: 3,
  settings: 4,
};

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

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

interface AppContextValue {
  state: PersistedAppState;
  route: RouteState;
  navDir: number;
  locked: boolean;
  drawer: DrawerState;
  modal: ModalState;
  toasts: ToastItem[];
  navigate: (page: PageId, sub?: string, query?: Record<string, string>) => void;
  openDrawer: (d: DrawerState) => void;
  closeDrawer: () => void;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  pushToast: (message: string, undo?: () => void) => void;
  dismissToast: (id: string) => void;

  // Theme & Security
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  unlockApp: (pin: string) => boolean;
  lockApp: () => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updateSettings: (patch: Partial<PersistedAppState['settings']>) => void;
  toggleModuleEnabled: (id: ModuleId) => void;

  // Tasks CRUD
  createTask: (input: Omit<TaskItem, 'id' | 'createdAt' | 'subtasks'> & { subtasks?: TaskItem['subtasks'] }) => TaskItem;
  updateTask: (id: string, patch: Partial<TaskItem>) => void;
  setTaskStatus: (id: string, status: TaskStatus, anchorEl?: HTMLElement | null) => void;
  toggleTaskDone: (id: string, anchorEl?: HTMLElement | null) => void;
  toggleTaskPinned: (id: string) => void;
  deleteTask: (id: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;

  // Finance CRUD
  walletBalances: Record<string, number>;
  createTransaction: (input: Omit<FinanceTransaction, 'id'>) => FinanceTransaction;
  updateTransaction: (id: string, patch: Partial<FinanceTransaction>) => void;
  deleteTransaction: (id: string) => void;
  createWallet: (input: Omit<FinanceWallet, 'id'>) => FinanceWallet;
  updateWallet: (id: string, patch: Partial<FinanceWallet>) => void;
  deleteWallet: (id: string) => void;
  setCategoryBudget: (categoryId: string, monthlyLimit: number) => void;

  // Future Module Ideas
  addFutureIdea: (input: Omit<FutureModuleIdea, 'id'>) => void;
  deleteFutureIdea: (id: string) => void;

  // Unified Backup & Reset
  exportUnifiedBackup: () => string;
  importUnifiedBackup: (rawJson: string) => { ok: boolean; error?: string };
  clearToEmpty: () => void;
  resetStarterData: () => void;

  // Local IndexedDB & Cloud DB Sync (Supabase PostgreSQL / GitHub Gist)
  cloudConfig: CloudDbConfig;
  cloudStatus: CloudSyncStatus;
  saveCloudConfig: (next: CloudDbConfig) => Promise<{ ok: boolean; message: string }>;
  disconnectCloudDb: () => void;
  syncCloudNow: () => Promise<void>;
  pushCloudNow: () => Promise<void>;
  pullCloudNow: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedAppState>(() => loadAppState());
  const [route, setRoute] = useState<RouteState>(() => parseLocation());
  const [navDir, setNavDir] = useState(1);
  const [locked, setLocked] = useState<boolean>(() => loadAppState().settings.pinEnabled);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [cloudConfig, setCloudConfig] = useState<CloudDbConfig>(() => loadCloudConfig());
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>(() => {
    const cfg = loadCloudConfig();
    return {
      state: isCloudConfigValid(cfg) ? 'syncing' : 'local',
      provider: isCloudConfigValid(cfg) ? cfg.provider : 'none',
      lastSyncedAt: null,
      localDbReady: false,
    };
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const routeRef = useRef(route);
  routeRef.current = route;
  const cloudConfigRef = useRef(cloudConfig);
  cloudConfigRef.current = cloudConfig;
  const exitTweenRef = useRef<gsap.core.Tween | null>(null);
  const hydratedRef = useRef(false);
  const skipNextPushRef = useRef(false);
  const pushTimerRef = useRef<number | null>(null);
  const lastFocusPullRef = useRef(0);

  const buildVaultPayload = useCallback((updatedAt?: string): UnifiedVaultPayload => {
    return {
      format: 'coby-life-backup-v1',
      updatedAt: updatedAt || new Date().toISOString(),
      personalOs: stateRef.current,
    };
  }, []);

  const applyVaultPayload = useCallback((payload: UnifiedVaultPayload) => {
    skipNextPushRef.current = true;
    if (payload.personalOs && typeof payload.personalOs === 'object') {
      const normalized = normalizePersistedState(payload.personalOs);
      saveAppState(normalized);
      setState(normalized);
    }
    if (payload.updatedAt) {
      setLocalUpdatedAt(payload.updatedAt);
    }
    void saveLocalIdbSnapshot(payload);
  }, []);

  const scheduleCloudPush = useCallback(() => {
    const cfg = cloudConfigRef.current;
    if (!cfg.autoSync || !isCloudConfigValid(cfg)) return;
    if (pushTimerRef.current) {
      window.clearTimeout(pushTimerRef.current);
    }
    pushTimerRef.current = window.setTimeout(async () => {
      pushTimerRef.current = null;
      const liveCfg = cloudConfigRef.current;
      if (!isCloudConfigValid(liveCfg)) return;
      const nowIso = getLocalUpdatedAt() || new Date().toISOString();
      const payload = buildVaultPayload(nowIso);
      setCloudStatus((prev) => ({ ...prev, state: 'syncing', error: undefined }));
      try {
        const res = await pushToCloudDb(liveCfg, payload);
        if (res.createdGistId && liveCfg.provider === 'gist' && !liveCfg.gistId) {
          const updatedCfg = { ...liveCfg, gistId: res.createdGistId };
          saveCloudConfigToStorage(updatedCfg);
          setCloudConfig(updatedCfg);
        }
        setCloudStatus((prev) => ({
          ...prev,
          state: 'synced',
          provider: liveCfg.provider,
          lastSyncedAt: new Date().toISOString(),
          error: undefined,
        }));
      } catch (err) {
        setCloudStatus((prev) => ({
          ...prev,
          state: 'error',
          error: err instanceof Error ? err.message : 'Cloud DB push failed',
        }));
      }
    }, 1400);
  }, [buildVaultPayload]);

  // Persist locally to localStorage + IndexedDB, then debounce Cloud DB sync
  useEffect(() => {
    saveAppState(state);
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    const nowIso = new Date().toISOString();
    setLocalUpdatedAt(nowIso);
    void saveLocalIdbSnapshot(buildVaultPayload(nowIso));
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    scheduleCloudPush();
  }, [state, buildVaultPayload, scheduleCloudPush]);

  // Initial IndexedDB recovery & Cloud DB sync on mount
  useEffect(() => {
    let active = true;
    (async () => {
      if (!hasStoredAppState()) {
        const idbSnap = await loadLocalIdbSnapshot();
        if (active && idbSnap?.personalOs) {
          applyVaultPayload(idbSnap);
        }
      }
      const ok = await saveLocalIdbSnapshot(buildVaultPayload(getLocalUpdatedAt() || new Date().toISOString()));
      if (!active) return;
      setCloudStatus((prev) => ({ ...prev, localDbReady: ok }));

      const cfg = cloudConfigRef.current;
      if (!isCloudConfigValid(cfg) || !cfg.autoSync) {
        setCloudStatus((prev) => ({ ...prev, state: 'local', provider: 'none' }));
        return;
      }

      setCloudStatus((prev) => ({ ...prev, state: 'syncing', provider: cfg.provider, error: undefined }));
      try {
        const remote = await pullFromCloudDb(cfg);
        if (!active) return;
        const localTs = getLocalUpdatedAt();
        if (remote?.payload && (!localTs || remote.updatedAt > localTs)) {
          applyVaultPayload(remote.payload);
        } else if (!remote) {
          const nowIso = localTs || new Date().toISOString();
          setLocalUpdatedAt(nowIso);
          const res = await pushToCloudDb(cfg, buildVaultPayload(nowIso));
          if (res.createdGistId && cfg.provider === 'gist' && !cfg.gistId) {
            const nextCfg = { ...cfg, gistId: res.createdGistId };
            saveCloudConfigToStorage(nextCfg);
            setCloudConfig(nextCfg);
          }
        }
        setCloudStatus((prev) => ({
          ...prev,
          state: 'synced',
          provider: cfg.provider,
          lastSyncedAt: new Date().toISOString(),
          error: undefined,
        }));
      } catch (err) {
        if (!active) return;
        setCloudStatus((prev) => ({
          ...prev,
          state: 'error',
          provider: cfg.provider,
          error: err instanceof Error ? err.message : 'Cloud DB sync failed',
        }));
      }
    })();

    return () => {
      active = false;
      if (pushTimerRef.current) {
        window.clearTimeout(pushTimerRef.current);
      }
    };
  }, [applyVaultPayload, buildVaultPayload]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  // Auto-pull newer Cloud DB changes on window focus
  useEffect(() => {
    const onFocus = () => {
      const cfg = cloudConfigRef.current;
      const now = Date.now();
      if (cfg.autoSync && isCloudConfigValid(cfg) && now - lastFocusPullRef.current > 15000) {
        lastFocusPullRef.current = now;
        void pullFromCloudDb(cfg)
          .then((remote) => {
            const localTs = getLocalUpdatedAt();
            if (remote?.payload && remote.updatedAt && (!localTs || remote.updatedAt > localTs)) {
              applyVaultPayload(remote.payload);
            }
            setCloudStatus((prev) => ({
              ...prev,
              state: 'synced',
              lastSyncedAt: new Date().toISOString(),
              error: undefined,
            }));
          })
          .catch(() => {
            // Silent on background focus refresh
          });
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [applyVaultPayload]);

  useEffect(() => {
    const onPop = () => {
      setRoute(parseLocation());
    };
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
      window.setTimeout(() => dismissToast(id), undo ? 5500 : 3200);
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
      try {
        window.history.pushState({}, '', url);
      } catch {
        // Ignore in sandboxed contexts
      }
      setNavDir(dir);
      setRoute(parseLocation());
    };

    if (prev.page !== page && swapEl && dur(0.16) > 0) {
      const mobile = isMobileViewport();
      exitTweenRef.current = gsap.to(swapEl, {
        opacity: 0,
        x: mobile ? 0 : -dir * 12,
        duration: mobile ? 0.13 : 0.16,
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

  // Theme & Security
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

  const unlockApp = useCallback((pin: string) => {
    if (pin.trim() === stateRef.current.settings.pinCode) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  const lockApp = useCallback(() => {
    setDrawer(null);
    setModal(null);
    setLocked(true);
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, profile: { ...prev.settings.profile, ...patch } },
      }));
      pushToast('Profile updated');
    },
    [pushToast]
  );

  const updateSettings = useCallback((patch: Partial<PersistedAppState['settings']>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const toggleModuleEnabled = useCallback(
    (id: ModuleId) => {
      setState((prev) => {
        const nextVal = !prev.settings.enabledModules[id];
        return {
          ...prev,
          settings: {
            ...prev.settings,
            enabledModules: { ...prev.settings.enabledModules, [id]: nextVal },
          },
        };
      });
      pushToast('Module visibility updated');
    },
    [pushToast]
  );

  // Tasks CRUD
  const createTask = useCallback(
    (input: Omit<TaskItem, 'id' | 'createdAt' | 'subtasks'> & { subtasks?: TaskItem['subtasks'] }) => {
      const task: TaskItem = {
        ...input,
        id: uid('task'),
        subtasks: input.subtasks || [],
        createdAt: localIsoDate(),
        completedAt: input.status === 'done' ? localIsoDate() : undefined,
      };
      setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
      pushToast(`Added "${task.title}"`);
      return task;
    },
    [pushToast]
  );

  const updateTask = useCallback((id: string, patch: Partial<TaskItem>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const setTaskStatus = useCallback(
    (id: string, status: TaskStatus, anchorEl?: HTMLElement | null) => {
      const existing = stateRef.current.tasks.find((t) => t.id === id);
      if (!existing || existing.status === status) return;
      const prevStatus = existing.status;
      const prevCompleted = existing.completedAt;
      const today = localIsoDate();

      if (status === 'done' && anchorEl) {
        spawnFloatUp('Done!', anchorEl.getBoundingClientRect());
      }

      setState((prev) => {
        const updated = prev.tasks.map((t) =>
          t.id === id
            ? { ...t, status, completedAt: status === 'done' ? today : undefined }
            : t
        );

        // If completing a recurring task, automatically schedule next occurrence
        if (status === 'done' && existing.recurrence !== 'none' && existing.dueDate) {
          const delta =
            existing.recurrence === 'daily' ? 1 : existing.recurrence === 'weekly' ? 7 : 30;
          const nextDate = addDaysIso(existing.dueDate, delta);
          const alreadyExists = updated.some(
            (t) => t.title === existing.title && t.dueDate === nextDate && t.status !== 'done'
          );
          if (!alreadyExists) {
            const nextTask: TaskItem = {
              ...existing,
              id: uid('task'),
              status: 'todo',
              dueDate: nextDate,
              completedAt: undefined,
              createdAt: today,
              subtasks: existing.subtasks.map((s) => ({ ...s, id: uid('st'), done: false })),
            };
            return { ...prev, tasks: [nextTask, ...updated] };
          }
        }
        return { ...prev, tasks: updated };
      });

      pushToast(
        status === 'done'
          ? `Completed "${existing.title}"`
          : `Moved "${existing.title}" to ${status === 'doing' ? 'In Progress' : 'To Do'}`,
        () => {
          setState((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === id ? { ...t, status: prevStatus, completedAt: prevCompleted } : t
            ),
          }));
        }
      );
    },
    [pushToast]
  );

  const toggleTaskDone = useCallback(
    (id: string, anchorEl?: HTMLElement | null) => {
      const existing = stateRef.current.tasks.find((t) => t.id === id);
      if (!existing) return;
      setTaskStatus(id, existing.status === 'done' ? 'todo' : 'done', anchorEl);
    },
    [setTaskStatus]
  );

  const toggleTaskPinned = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
    }));
  }, []);

  const deleteTask = useCallback(
    (id: string) => {
      const existing = stateRef.current.tasks.find((t) => t.id === id);
      if (!existing) return;
      setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
      setDrawer((d) => (d?.kind === 'task' && d.id === id ? null : d));
      pushToast(`Deleted "${existing.title}"`, () => {
        setState((prev) => ({ ...prev, tasks: [existing, ...prev.tasks] }));
      });
    },
    [pushToast]
  );

  const addSubtask = useCallback((taskId: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...t.subtasks, { id: uid('st'), title: clean, done: false }] }
          : t
      ),
    }));
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
            }
          : t
      ),
    }));
  }, []);

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
          : t
      ),
    }));
  }, []);

  // Finance CRUD & Computed Balances
  const walletBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of state.finance.wallets) {
      map[w.id] = w.initialBalance;
    }
    for (const tx of state.finance.transactions) {
      if (tx.type === 'income') {
        map[tx.walletId] = (map[tx.walletId] ?? 0) + tx.amount;
      } else if (tx.type === 'expense') {
        map[tx.walletId] = (map[tx.walletId] ?? 0) - tx.amount;
      } else if (tx.type === 'transfer') {
        map[tx.walletId] = (map[tx.walletId] ?? 0) - tx.amount;
        if (tx.toWalletId) {
          map[tx.toWalletId] = (map[tx.toWalletId] ?? 0) + tx.amount;
        }
      }
    }
    return map;
  }, [state.finance.wallets, state.finance.transactions]);

  const createTransaction = useCallback(
    (input: Omit<FinanceTransaction, 'id'>) => {
      const tx: FinanceTransaction = { ...input, id: uid('tx') };
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          transactions: [tx, ...prev.finance.transactions],
        },
      }));
      const label =
        tx.type === 'expense' ? 'Expense' : tx.type === 'income' ? 'Income' : 'Transfer';
      pushToast(`${label} recorded`);
      return tx;
    },
    [pushToast]
  );

  const updateTransaction = useCallback((id: string, patch: Partial<FinanceTransaction>) => {
    setState((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        transactions: prev.finance.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...patch } : tx
        ),
      },
    }));
  }, []);

  const deleteTransaction = useCallback(
    (id: string) => {
      const existing = stateRef.current.finance.transactions.find((t) => t.id === id);
      if (!existing) return;
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          transactions: prev.finance.transactions.filter((t) => t.id !== id),
        },
      }));
      setDrawer((d) => (d?.kind === 'transaction' && d.id === id ? null : d));
      pushToast('Transaction deleted', () => {
        setState((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            transactions: [existing, ...prev.finance.transactions],
          },
        }));
      });
    },
    [pushToast]
  );

  const createWallet = useCallback(
    (input: Omit<FinanceWallet, 'id'>) => {
      const wallet: FinanceWallet = { ...input, id: uid('w') };
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          wallets: [...prev.finance.wallets, wallet],
        },
      }));
      pushToast(`Added wallet "${wallet.name}"`);
      return wallet;
    },
    [pushToast]
  );

  const updateWallet = useCallback((id: string, patch: Partial<FinanceWallet>) => {
    setState((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        wallets: prev.finance.wallets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      },
    }));
  }, []);

  const deleteWallet = useCallback(
    (id: string) => {
      const existing = stateRef.current.finance.wallets.find((w) => w.id === id);
      if (!existing) return;
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          wallets: prev.finance.wallets.filter((w) => w.id !== id),
        },
      }));
      pushToast(`Deleted wallet "${existing.name}"`, () => {
        setState((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            wallets: [...prev.finance.wallets, existing],
          },
        }));
      });
    },
    [pushToast]
  );

  const setCategoryBudget = useCallback(
    (categoryId: string, monthlyLimit: number) => {
      setState((prev) => {
        const exists = prev.finance.budgets.some((b) => b.categoryId === categoryId);
        const budgets =
          monthlyLimit <= 0
            ? prev.finance.budgets.filter((b) => b.categoryId !== categoryId)
            : exists
              ? prev.finance.budgets.map((b) =>
                  b.categoryId === categoryId ? { ...b, monthlyLimit } : b
                )
              : [...prev.finance.budgets, { categoryId, monthlyLimit }];
        return { ...prev, finance: { ...prev.finance, budgets } };
      });
      pushToast('Budget updated');
    },
    [pushToast]
  );

  // Future Module Ideas
  const addFutureIdea = useCallback(
    (input: Omit<FutureModuleIdea, 'id'>) => {
      const idea: FutureModuleIdea = { ...input, id: uid('idea') };
      setState((prev) => ({ ...prev, futureModules: [idea, ...prev.futureModules] }));
      pushToast(`Saved idea "${idea.name}"`);
    },
    [pushToast]
  );

  const deleteFutureIdea = useCallback(
    (id: string) => {
      const existing = stateRef.current.futureModules.find((i) => i.id === id);
      if (!existing) return;
      setState((prev) => ({
        ...prev,
        futureModules: prev.futureModules.filter((i) => i.id !== id),
      }));
      pushToast('Idea removed', () => {
        setState((prev) => ({ ...prev, futureModules: [existing, ...prev.futureModules] }));
      });
    },
    [pushToast]
  );

  // Backup & Restore (Tasks + Finance + Settings)
  const exportUnifiedBackup = useCallback(() => {
    const payload = {
      format: 'coby-life-backup-v1',
      exportedAt: new Date().toISOString(),
      personalOs: stateRef.current,
    };
    return JSON.stringify(payload, null, 2);
  }, []);

  const importUnifiedBackup = useCallback(
    (rawJson: string): { ok: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(rawJson);
        if (!parsed || typeof parsed !== 'object') {
          return { ok: false, error: 'Invalid JSON file.' };
        }
        if (parsed.personalOs && typeof parsed.personalOs === 'object') {
          setState(normalizePersistedState(parsed.personalOs));
        } else if (Array.isArray(parsed.tasks) && parsed.finance) {
          setState(normalizePersistedState(parsed));
        } else {
          return { ok: false, error: 'Unrecognized backup format.' };
        }
        pushToast('Backup restored');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Could not parse backup file.',
        };
      }
    },
    [pushToast]
  );

  const clearToEmpty = useCallback(() => {
    setState(createEmptyPersonalState());
    setDrawer(null);
    pushToast('Cleared sample Tasks & Finance data — ready for a fresh start');
  }, [pushToast]);

  const resetStarterData = useCallback(() => {
    setState(createStarterState());
    setDrawer(null);
    pushToast('Sample data restored');
  }, [pushToast]);

  const saveCloudConfig = useCallback(
    async (next: CloudDbConfig): Promise<{ ok: boolean; message: string }> => {
      if (!isCloudConfigValid(next)) {
        return { ok: false, message: 'Fill in all required database connection fields.' };
      }
      setCloudStatus((prev) => ({
        ...prev,
        state: 'syncing',
        provider: next.provider,
        error: undefined,
      }));
      try {
        const remote = await pullFromCloudDb(next);
        let finalCfg = { ...next };
        const localTs = getLocalUpdatedAt();
        let summary = 'Connected & synced with Cloud DB';

        if (remote?.payload && (!localTs || remote.updatedAt > localTs)) {
          applyVaultPayload(remote.payload);
          summary = 'Connected — pulled latest data from Cloud DB';
        } else {
          const nowIso = new Date().toISOString();
          setLocalUpdatedAt(nowIso);
          const pushed = await pushToCloudDb(next, buildVaultPayload(nowIso));
          if (pushed.createdGistId && next.provider === 'gist' && !next.gistId) {
            finalCfg = { ...next, gistId: pushed.createdGistId };
          }
          summary = remote
            ? 'Connected — pushed local updates to Cloud DB'
            : 'Connected — initialized your personal Cloud DB';
        }

        saveCloudConfigToStorage(finalCfg);
        setCloudConfig(finalCfg);
        setCloudStatus((prev) => ({
          ...prev,
          state: 'synced',
          provider: finalCfg.provider,
          lastSyncedAt: new Date().toISOString(),
          error: undefined,
        }));
        pushToast(summary);
        return { ok: true, message: summary };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not connect to Cloud DB';
        setCloudStatus((prev) => ({
          ...prev,
          state: 'error',
          provider: next.provider,
          error: msg,
        }));
        return { ok: false, message: msg };
      }
    },
    [applyVaultPayload, buildVaultPayload, pushToast]
  );

  const disconnectCloudDb = useCallback(() => {
    const reset = { ...DEFAULT_CLOUD_CONFIG };
    saveCloudConfigToStorage(reset);
    setCloudConfig(reset);
    setCloudStatus((prev) => ({
      ...prev,
      state: 'local',
      provider: 'none',
      error: undefined,
    }));
    pushToast('Disconnected Cloud DB — data remains stored locally');
  }, [pushToast]);

  const syncCloudNow = useCallback(async () => {
    const cfg = cloudConfigRef.current;
    if (!isCloudConfigValid(cfg)) {
      pushToast('Connect Supabase or GitHub Gist in Settings → Cloud DB first');
      return;
    }
    setCloudStatus((prev) => ({ ...prev, state: 'syncing', error: undefined }));
    try {
      const remote = await pullFromCloudDb(cfg);
      const localTs = getLocalUpdatedAt();
      if (remote?.payload && remote.updatedAt && (!localTs || remote.updatedAt > localTs)) {
        applyVaultPayload(remote.payload);
        pushToast('Pulled newer data from Cloud DB');
      } else {
        const nowIso = new Date().toISOString();
        setLocalUpdatedAt(nowIso);
        const res = await pushToCloudDb(cfg, buildVaultPayload(nowIso));
        if (res.createdGistId && cfg.provider === 'gist' && !cfg.gistId) {
          const nextCfg = { ...cfg, gistId: res.createdGistId };
          saveCloudConfigToStorage(nextCfg);
          setCloudConfig(nextCfg);
        }
        pushToast('Synced latest snapshot to Cloud DB');
      }
      setCloudStatus((prev) => ({
        ...prev,
        state: 'synced',
        provider: cfg.provider,
        lastSyncedAt: new Date().toISOString(),
        error: undefined,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cloud DB sync failed';
      setCloudStatus((prev) => ({ ...prev, state: 'error', error: msg }));
      pushToast(msg);
    }
  }, [applyVaultPayload, buildVaultPayload, pushToast]);

  const pushCloudNow = useCallback(async () => {
    const cfg = cloudConfigRef.current;
    if (!isCloudConfigValid(cfg)) return;
    setCloudStatus((prev) => ({ ...prev, state: 'syncing', error: undefined }));
    try {
      const nowIso = new Date().toISOString();
      setLocalUpdatedAt(nowIso);
      const res = await pushToCloudDb(cfg, buildVaultPayload(nowIso));
      if (res.createdGistId && cfg.provider === 'gist' && !cfg.gistId) {
        const nextCfg = { ...cfg, gistId: res.createdGistId };
        saveCloudConfigToStorage(nextCfg);
        setCloudConfig(nextCfg);
      }
      setCloudStatus((prev) => ({
        ...prev,
        state: 'synced',
        provider: cfg.provider,
        lastSyncedAt: new Date().toISOString(),
        error: undefined,
      }));
      pushToast('Uploaded local data → Cloud DB');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed';
      setCloudStatus((prev) => ({ ...prev, state: 'error', error: msg }));
      pushToast(msg);
    }
  }, [buildVaultPayload, pushToast]);

  const pullCloudNow = useCallback(async () => {
    const cfg = cloudConfigRef.current;
    if (!isCloudConfigValid(cfg)) return;
    setCloudStatus((prev) => ({ ...prev, state: 'syncing', error: undefined }));
    try {
      const remote = await pullFromCloudDb(cfg);
      if (!remote?.payload) {
        setCloudStatus((prev) => ({
          ...prev,
          state: 'synced',
          lastSyncedAt: new Date().toISOString(),
        }));
        pushToast('Cloud DB is empty — push local data first');
        return;
      }
      applyVaultPayload(remote.payload);
      setCloudStatus((prev) => ({
        ...prev,
        state: 'synced',
        provider: cfg.provider,
        lastSyncedAt: new Date().toISOString(),
        error: undefined,
      }));
      pushToast('Restored snapshot from Cloud DB');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull failed';
      setCloudStatus((prev) => ({ ...prev, state: 'error', error: msg }));
      pushToast(msg);
    }
  }, [applyVaultPayload, pushToast]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      route,
      navDir,
      locked,
      drawer,
      modal,
      toasts,
      navigate,
      openDrawer,
      closeDrawer,
      openModal,
      closeModal,
      pushToast,
      dismissToast,
      setTheme,
      toggleTheme,
      unlockApp,
      lockApp,
      updateProfile,
      updateSettings,
      toggleModuleEnabled,
      createTask,
      updateTask,
      setTaskStatus,
      toggleTaskDone,
      toggleTaskPinned,
      deleteTask,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      walletBalances,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createWallet,
      updateWallet,
      deleteWallet,
      setCategoryBudget,
      addFutureIdea,
      deleteFutureIdea,
      exportUnifiedBackup,
      importUnifiedBackup,
      clearToEmpty,
      resetStarterData,
      cloudConfig,
      cloudStatus,
      saveCloudConfig,
      disconnectCloudDb,
      syncCloudNow,
      pushCloudNow,
      pullCloudNow,
    }),
    [
      state,
      route,
      navDir,
      locked,
      drawer,
      modal,
      toasts,
      navigate,
      openDrawer,
      closeDrawer,
      openModal,
      closeModal,
      pushToast,
      dismissToast,
      setTheme,
      toggleTheme,
      unlockApp,
      lockApp,
      updateProfile,
      updateSettings,
      toggleModuleEnabled,
      createTask,
      updateTask,
      setTaskStatus,
      toggleTaskDone,
      toggleTaskPinned,
      deleteTask,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      walletBalances,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createWallet,
      updateWallet,
      deleteWallet,
      setCategoryBudget,
      addFutureIdea,
      deleteFutureIdea,
      exportUnifiedBackup,
      importUnifiedBackup,
      clearToEmpty,
      resetStarterData,
      cloudConfig,
      cloudStatus,
      saveCloudConfig,
      disconnectCloudDb,
      syncCloudNow,
      pushCloudNow,
      pullCloudNow,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

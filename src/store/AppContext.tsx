import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DrawerState,
  FinanceTransaction,
  FinanceWallet,
  FutureModuleIdea,
  ModalState,
  ModuleId,
  OpenGymSnapshot,
  PageId,
  PersistedAppState,
  TaskItem,
  TaskStatus,
  ThemeMode,
  ToastItem,
  UserProfile,
} from '../types';
import { createEmptyPersonalState, createStarterState } from '../data/seedData';
import { loadAppState, saveAppState } from '../utils/storage';
import {
  getOpenGymRawJson,
  OPENGYM_STATE_KEY,
  readOpenGymSnapshot,
  restoreOpenGymRawJson,
} from '../utils/opengymBridge';
import { addDaysIso, localIsoDate } from '../utils/format';
import { dur, gsap, isMobileViewport, spawnFloatUp } from '../utils/motion';

export interface RouteState {
  page: PageId;
  sub: string;
  query: Record<string, string>;
}

const DEFAULT_SUB: Record<PageId, string> = {
  overview: '',
  gym: 'home',
  tasks: 'agenda',
  finance: 'overview',
  modules: '',
  settings: 'profile',
};

const VALID_PAGES = new Set<PageId>([
  'overview',
  'gym',
  'tasks',
  'finance',
  'modules',
  'settings',
]);

const PAGE_ORDER: Record<PageId, number> = {
  overview: 0,
  gym: 1,
  tasks: 2,
  finance: 3,
  modules: 4,
  settings: 5,
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
  gym: OpenGymSnapshot;
  route: RouteState;
  navDir: number;
  locked: boolean;
  drawer: DrawerState;
  modal: ModalState;
  toasts: ToastItem[];
  gymMounted: boolean;
  gymHashTarget: string;
  registerGymFrame: (frame: HTMLIFrameElement | null) => void;
  navigate: (page: PageId, sub?: string, query?: Record<string, string>) => void;
  openGymView: (hashPath: string) => void;
  refreshGymSnapshot: () => void;
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
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedAppState>(() => loadAppState());
  const [gym, setGym] = useState<OpenGymSnapshot>(() => readOpenGymSnapshot());
  const [route, setRoute] = useState<RouteState>(() => parseLocation());
  const [navDir, setNavDir] = useState(1);
  const [locked, setLocked] = useState<boolean>(() => loadAppState().settings.pinEnabled);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [gymMounted, setGymMounted] = useState<boolean>(() => parseLocation().page === 'gym');
  const [gymHashTarget, setGymHashTarget] = useState<string>('#/home');

  const stateRef = useRef(state);
  stateRef.current = state;
  const routeRef = useRef(route);
  routeRef.current = route;
  const gymFrameRef = useRef<HTMLIFrameElement | null>(null);
  const exitTweenRef = useRef<gsap.core.Tween | null>(null);

  const registerGymFrame = useCallback((frame: HTMLIFrameElement | null) => {
    gymFrameRef.current = frame;
    if (frame?.contentWindow) {
      try {
        frame.contentWindow.postMessage(
          { type: 'hub:set-theme', theme: stateRef.current.settings.theme },
          window.location.origin
        );
      } catch {
        // Frame may still be loading
      }
    }
  }, []);

  const refreshGymSnapshot = useCallback(() => {
    setGym(readOpenGymSnapshot());
  }, []);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    const theme = state.settings.theme;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      gymFrameRef.current?.contentWindow?.postMessage(
        { type: 'hub:set-theme', theme },
        window.location.origin
      );
    } catch {
      // Ignore if iframe not yet ready
    }
  }, [state.settings.theme]);

  // Listen to openGym live updates (postMessage + storage + focus)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'opengym:state-updated') {
        setGym(readOpenGymSnapshot());
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === OPENGYM_STATE_KEY) {
        setGym(readOpenGymSnapshot());
      }
    };
    const onFocus = () => setGym(readOpenGymSnapshot());

    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    const onPop = () => {
      const next = parseLocation();
      if (next.page === 'gym') setGymMounted(true);
      setRoute(next);
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

    if (page === 'gym') {
      setGymMounted(true);
    }

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
      if (page === 'overview') {
        setGym(readOpenGymSnapshot());
      }
    };

    if (prev.page !== page && prev.page !== 'gym' && page !== 'gym' && swapEl && dur(0.16) > 0) {
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

  const openGymView = useCallback(
    (hashPath: string) => {
      const normalized = hashPath.startsWith('#') ? hashPath : `#${hashPath.startsWith('/') ? hashPath : `/${hashPath}`}`;
      setGymHashTarget(normalized);
      setGymMounted(true);
      navigate('gym', normalized.replace(/^#\/?/, '') || 'home');
      try {
        gymFrameRef.current?.contentWindow?.postMessage(
          { type: 'hub:navigate', path: normalized },
          window.location.origin
        );
      } catch {
        // Initial mount will pick up gymHashTarget via src
      }
    },
    [navigate]
  );

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
      pushToast('Đã cập nhật hồ sơ cá nhân');
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
      pushToast('Đã cập nhật trạng thái module');
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
      pushToast(`Đã thêm task "${task.title}"`);
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
        spawnFloatUp('Xong!', anchorEl.getBoundingClientRect());
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
          ? `Hoàn thành "${existing.title}"`
          : `Chuyển "${existing.title}" sang ${status === 'doing' ? 'Đang làm' : 'Cần làm'}`,
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
      pushToast(`Đã xóa "${existing.title}"`, () => {
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
        tx.type === 'expense' ? 'chi tiêu' : tx.type === 'income' ? 'thu nhập' : 'chuyển ví';
      pushToast(`Đã ghi nhận ${label}`);
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
      pushToast('Đã xóa giao dịch', () => {
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
      pushToast(`Đã thêm ví "${wallet.name}"`);
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
      pushToast(`Đã xóa ví "${existing.name}"`, () => {
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
      pushToast('Đã cập nhật hạn mức ngân sách');
    },
    [pushToast]
  );

  // Future Module Ideas
  const addFutureIdea = useCallback(
    (input: Omit<FutureModuleIdea, 'id'>) => {
      const idea: FutureModuleIdea = { ...input, id: uid('idea') };
      setState((prev) => ({ ...prev, futureModules: [idea, ...prev.futureModules] }));
      pushToast(`Đã lưu ý tưởng module "${idea.name}"`);
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
      pushToast('Đã xóa ý tưởng module', () => {
        setState((prev) => ({ ...prev, futureModules: [existing, ...prev.futureModules] }));
      });
    },
    [pushToast]
  );

  // Unified Backup & Restore (Personal OS + openGym!)
  const exportUnifiedBackup = useCallback(() => {
    const payload = {
      format: 'sylva-personal-os-backup-v1',
      exportedAt: new Date().toISOString(),
      personalOs: stateRef.current,
      openGym: getOpenGymRawJson(),
    };
    return JSON.stringify(payload, null, 2);
  }, []);

  const importUnifiedBackup = useCallback(
    (rawJson: string): { ok: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(rawJson);
        if (!parsed || typeof parsed !== 'object') {
          return { ok: false, error: 'File JSON không hợp lệ.' };
        }
        if (parsed.personalOs && typeof parsed.personalOs === 'object') {
          const fallback = createStarterState();
          const merged: PersistedAppState = {
            ...fallback,
            ...parsed.personalOs,
            settings: {
              ...fallback.settings,
              ...(parsed.personalOs.settings || {}),
            },
          };
          setState(merged);
        } else if (Array.isArray(parsed.tasks) && parsed.finance) {
          setState(parsed as PersistedAppState);
        }
        if (parsed.openGym) {
          restoreOpenGymRawJson(parsed.openGym);
          setGym(readOpenGymSnapshot());
          try {
            gymFrameRef.current?.contentWindow?.postMessage(
              { type: 'hub:reload-state' },
              window.location.origin
            );
          } catch {
            // Ignore
          }
        }
        pushToast('Đã khôi phục toàn bộ dữ liệu thành công');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Không thể đọc file sao lưu.',
        };
      }
    },
    [pushToast]
  );

  const clearToEmpty = useCallback(() => {
    setState(createEmptyPersonalState());
    setDrawer(null);
    pushToast('Đã dọn sạch dữ liệu mẫu Tasks & Chi tiêu để bạn bắt đầu mới');
  }, [pushToast]);

  const resetStarterData = useCallback(() => {
    setState(createStarterState());
    setDrawer(null);
    pushToast('Đã khôi phục dữ liệu mẫu');
  }, [pushToast]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      gym,
      route,
      navDir,
      locked,
      drawer,
      modal,
      toasts,
      gymMounted,
      gymHashTarget,
      registerGymFrame,
      navigate,
      openGymView,
      refreshGymSnapshot,
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
    }),
    [
      state,
      gym,
      route,
      navDir,
      locked,
      drawer,
      modal,
      toasts,
      gymMounted,
      gymHashTarget,
      registerGymFrame,
      navigate,
      openGymView,
      refreshGymSnapshot,
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
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

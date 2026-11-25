import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DrawerState,
  FinanceAutoRule,
  FinanceCategory,
  FinanceRecurringBill,
  FinanceTransaction,
  FinanceWallet,
  FutureModuleIdea,
  GmailInboxItem,
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
import {
  AuthUser,
  getInitialSessionUser,
  signOutCloud,
  subscribeAuthChanges,
} from '../utils/auth';
import { createDemoSampleState, createEmptyPersonalState, createStarterState } from '../data/seedData';
import {
  clearAppState,
  getLocalUpdatedAt,
  hasStoredAppState,
  loadAppState,
  normalizePersistedState,
  saveAppState,
  setLocalUpdatedAt,
} from '../utils/storage';
import {
  ackSupabaseInboxItems,
  clearLocalIdbSnapshot,
  CloudDbConfig,
  CloudSyncStatus,
  DEFAULT_CLOUD_CONFIG,
  isCloudConfigValid,
  loadCloudConfig,
  loadLocalIdbSnapshot,
  pullAuthenticatedUserVault,
  pullFromCloudDb,
  pullSupabaseInboxItems,
  pushAuthenticatedUserVault,
  pushToCloudDb,
  saveCloudConfigToStorage,
  saveLocalIdbSnapshot,
  triggerGasWebAppSync,
  UnifiedVaultPayload,
} from '../utils/cloudDb';
import { buildSmartInboxItems, currentCycleKey } from '../utils/financeEngine';
import {
  createSampleGmailDemoPayloads,
  parseVietnameseGmailAlert,
  RawGmailPayloadItem,
} from '../utils/vnGmailParser';
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

function parseIsoMs(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export interface ReconcileOptions {
  walletId: string;
  targetBalance: number;
  mode: 'silent' | 'expense' | 'income' | 'transfer';
  categoryId?: string;
  toWalletId?: string;
  note?: string;
}

export interface ApproveInboxOptions {
  splitMyShare?: number;
  splitCounterparty?: string;
  saveRule?: boolean;
}

interface AppContextValue {
  authUser: AuthUser | null;
  authReady: boolean;
  signOutWorkspace: () => Promise<void>;
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

  // Finance Core CRUD
  walletBalances: Record<string, number>;
  createTransaction: (input: Omit<FinanceTransaction, 'id'>) => FinanceTransaction;
  updateTransaction: (id: string, patch: Partial<FinanceTransaction>) => void;
  deleteTransaction: (id: string) => void;
  createWallet: (input: Omit<FinanceWallet, 'id'>) => FinanceWallet;
  updateWallet: (id: string, patch: Partial<FinanceWallet>) => void;
  deleteWallet: (id: string) => void;
  reconcileWalletBalance: (opts: ReconcileOptions) => void;
  setCategoryBudget: (categoryId: string, monthlyLimit: number) => void;

  // Finance Categories, Rules, Bills, Payday Cycle & Split Reimbursements
  createCategory: (input: Omit<FinanceCategory, 'id'>) => FinanceCategory;
  updateCategory: (id: string, patch: Partial<FinanceCategory>) => void;
  deleteCategory: (id: string) => void;
  saveAutoRule: (rule: Omit<FinanceAutoRule, 'id'> & { id?: string }) => FinanceAutoRule;
  deleteAutoRule: (id: string) => void;
  saveRecurringBill: (bill: Omit<FinanceRecurringBill, 'id'> & { id?: string }) => FinanceRecurringBill;
  deleteRecurringBill: (id: string) => void;
  markBillPaid: (billId: string, cycleKey?: string) => void;
  setPaydayDay: (day: number) => void;
  setUsdVndRate: (rate: number) => void;
  settleSplitTransaction: (txId: string, receivedAmount?: number, walletId?: string) => void;

  // Gmail Sync & Finance Review Inbox
  gmailSyncing: boolean;
  lastGmailSyncAt: string | null;
  syncGmailInbox: (opts?: { triggerGas?: boolean; silent?: boolean }) => Promise<void>;
  importRawGmailText: (rawText: string) => boolean;
  loadSampleGmailDemo: () => void;
  updateInboxItem: (id: string, patch: Partial<GmailInboxItem>) => void;
  approveInboxItem: (id: string, opts?: ApproveInboxOptions) => void;
  approveAllMatchedInbox: () => void;
  ignoreInboxItem: (id: string) => void;
  updateCloudConfigPatch: (patch: Partial<CloudDbConfig>) => void;

  // Future Module Ideas
  addFutureIdea: (input: Omit<FutureModuleIdea, 'id'>) => void;
  deleteFutureIdea: (id: string) => void;

  // Unified Backup & Reset
  exportUnifiedBackup: () => string;
  importUnifiedBackup: (rawJson: string) => { ok: boolean; error?: string };
  clearTasksData: () => void;
  clearFinanceData: () => void;
  clearAllWorkspaceData: (opts?: { factoryReset?: boolean }) => Promise<void>;
  loadDemoSampleData: () => void;
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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [state, setState] = useState<PersistedAppState>(() => createEmptyPersonalState());
  const [route, setRoute] = useState<RouteState>(() => parseLocation());
  const [navDir, setNavDir] = useState(1);
  const [locked, setLocked] = useState<boolean>(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [cloudConfig, setCloudConfig] = useState<CloudDbConfig>(() => loadCloudConfig());
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [lastGmailSyncAt, setLastGmailSyncAt] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>({
    state: 'local',
    provider: 'none',
    lastSyncedAt: null,
    localDbReady: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;
  const routeRef = useRef(route);
  routeRef.current = route;
  const cloudConfigRef = useRef(cloudConfig);
  cloudConfigRef.current = cloudConfig;
  const exitTweenRef = useRef<gsap.core.Tween | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const vaultHydratedForUserRef = useRef<string | null>(null);
  const skipPersistForStateRef = useRef<PersistedAppState | null>(null);
  const pushTimerRef = useRef<number | null>(null);
  const lastFocusPullRef = useRef(0);

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

  const buildVaultPayload = useCallback((updatedAt?: string): UnifiedVaultPayload => {
    return {
      format: 'coby-life-backup-v1',
      updatedAt: updatedAt || new Date().toISOString(),
      personalOs: stateRef.current,
    };
  }, []);

  const applyVaultPayload = useCallback((payload: UnifiedVaultPayload, userId?: string) => {
    const targetUserId = userId ?? activeUserIdRef.current ?? undefined;
    if (payload.personalOs && typeof payload.personalOs === 'object') {
      const normalized = normalizePersistedState(payload.personalOs);
      saveAppState(normalized, targetUserId);
      skipPersistForStateRef.current = normalized;
      stateRef.current = normalized;
      setState(normalized);
    }
    if (payload.updatedAt) {
      setLocalUpdatedAt(payload.updatedAt, targetUserId);
    }
    void saveLocalIdbSnapshot(payload, targetUserId);
  }, []);

  const ingestRawGmailPayloads = useCallback((rawItems: RawGmailPayloadItem[]): number => {
    if (!rawItems || rawItems.length === 0) return 0;
    const usdRate = stateRef.current.finance.usdVndRate || 25500;
    const parsedAlerts = rawItems
      .map((item) => parseVietnameseGmailAlert(item, usdRate))
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (parsedAlerts.length === 0) return 0;

    let addedCount = 0;
    setState((prev) => {
      const built = buildSmartInboxItems(parsedAlerts, prev.finance, uid);
      addedCount = built.length;
      if (built.length === 0) return prev;
      return {
        ...prev,
        finance: {
          ...prev.finance,
          inbox: [...built, ...prev.finance.inbox],
        },
      };
    });
    return addedCount;
  }, []);

  const syncGmailInbox = useCallback(
    async (opts?: { triggerGas?: boolean; silent?: boolean }) => {
      const cfg = cloudConfigRef.current;
      const hasSupabase = cfg.provider === 'supabase' && isCloudConfigValid(cfg);
      const hasGasUrl = Boolean(cfg.gmailGasExecUrl?.trim() && cfg.gmailTriggerSecret?.trim());

      if (!hasSupabase && !hasGasUrl) {
        if (!opts?.silent) {
          setModal({ kind: 'gmail-setup' });
        }
        return;
      }

      setGmailSyncing(true);
      try {
        let added = 0;

        if (opts?.triggerGas && hasGasUrl) {
          const gasRes = await triggerGasWebAppSync(cfg);
          if (!gasRes.ok && !opts?.silent) {
            pushToast(gasRes.error || 'Apps Script trigger failed');
          } else if (gasRes.directItems && gasRes.directItems.length > 0) {
            added += ingestRawGmailPayloads(gasRes.directItems);
          }
        }

        if (hasSupabase) {
          const inboxRes = await pullSupabaseInboxItems(cfg);
          if (inboxRes.ok && inboxRes.items.length > 0) {
            added += ingestRawGmailPayloads(inboxRes.items);
          } else if (inboxRes.needsSqlUpgrade && !opts?.silent && opts?.triggerGas) {
            pushToast('Run the updated Supabase SQL in Gmail Sync Setup to enable coby_finance_inbox');
          }
        }

        setLastGmailSyncAt(new Date().toISOString());
        if (!opts?.silent) {
          if (added > 0) {
            pushToast(`Synced ${added} new Gmail transaction${added > 1 ? 's' : ''} to Inbox`);
          } else {
            pushToast('Gmail Inbox is up to date');
          }
        }
      } finally {
        setGmailSyncing(false);
      }
    },
    [ingestRawGmailPayloads, pushToast]
  );

  const scheduleCloudPush = useCallback(
    (userId: string) => {
      if (vaultHydratedForUserRef.current !== userId) return;
      if (pushTimerRef.current) {
        window.clearTimeout(pushTimerRef.current);
      }
      pushTimerRef.current = window.setTimeout(async () => {
        pushTimerRef.current = null;
        if (activeUserIdRef.current !== userId || vaultHydratedForUserRef.current !== userId) {
          return;
        }
        const nowIso = getLocalUpdatedAt(userId) || new Date().toISOString();
        const payload = buildVaultPayload(nowIso);
        setCloudStatus((prev) => ({
          ...prev,
          state: 'syncing',
          provider: 'supabase',
          error: undefined,
        }));
        try {
          await pushAuthenticatedUserVault(userId, payload);
          if (activeUserIdRef.current !== userId) return;
          setCloudStatus((prev) => ({
            ...prev,
            state: 'synced',
            provider: 'supabase',
            lastSyncedAt: new Date().toISOString(),
            error: undefined,
          }));
        } catch (err) {
          if (activeUserIdRef.current !== userId) return;
          setCloudStatus((prev) => ({
            ...prev,
            state: 'error',
            provider: 'supabase',
            error: err instanceof Error ? err.message : 'Cloud sync failed',
          }));
        }
      }, 800);
    },
    [buildVaultPayload]
  );

  // Initialize Supabase Auth session and subscribe to auth state changes
  useEffect(() => {
    let active = true;
    void getInitialSessionUser()
      .then((user) => {
        if (!active) return;
        setAuthUser(user);
        setAuthReady(true);
      })
      .catch(() => {
        if (!active) return;
        setAuthUser(null);
        setAuthReady(true);
      });

    const unsubscribe = subscribeAuthChanges((user) => {
      if (!active) return;
      setAuthUser((prev) => {
        if (
          prev?.id === user?.id &&
          prev?.email === user?.email &&
          prev?.displayName === user?.displayName
        ) {
          return prev;
        }
        return user;
      });
      setAuthReady(true);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Persist user-scoped state locally + IDB, then schedule 800ms debounced Cloud push once hydrated
  useEffect(() => {
    if (skipPersistForStateRef.current === state) {
      skipPersistForStateRef.current = null;
      return;
    }
    const userId = activeUserIdRef.current;
    if (!userId) return;

    saveAppState(state, userId);
    const nowIso = new Date().toISOString();
    setLocalUpdatedAt(nowIso, userId);
    void saveLocalIdbSnapshot(buildVaultPayload(nowIso), userId);

    if (vaultHydratedForUserRef.current === userId) {
      scheduleCloudPush(userId);
    }
  }, [state, buildVaultPayload, scheduleCloudPush]);

  const authUserId = authUser?.id || null;

  // Hydrate & isolate per-user workspace whenever authenticated user changes
  useEffect(() => {
    if (!authReady) return;
    let active = true;

    if (pushTimerRef.current) {
      window.clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }

    const userId = authUserId;
    activeUserIdRef.current = userId;
    vaultHydratedForUserRef.current = null;

    if (!userId) {
      const empty = createEmptyPersonalState();
      skipPersistForStateRef.current = empty;
      stateRef.current = empty;
      setState(empty);
      setLocked(false);
      setDrawer(null);
      setModal(null);
      setLastGmailSyncAt(null);
      setCloudStatus({
        state: 'local',
        provider: 'none',
        lastSyncedAt: null,
        localDbReady: false,
      });
      return () => {
        active = false;
      };
    }

    const displayName = authUserRef.current?.displayName || 'User';
    const hasLocal = hasStoredAppState(userId);
    const loaded = loadAppState(userId);
    if (!hasLocal && displayName) {
      loaded.settings.profile.name = displayName;
    }
    skipPersistForStateRef.current = loaded;
    stateRef.current = loaded;
    setState(loaded);
    setLocked(loaded.settings.pinEnabled);
    setCloudStatus({
      state: 'syncing',
      provider: 'supabase',
      lastSyncedAt: null,
      localDbReady: true,
    });

    (async () => {
      try {
        if (!hasLocal) {
          const idbSnap = await loadLocalIdbSnapshot(userId);
          if (!active || activeUserIdRef.current !== userId) return;
          if (idbSnap?.personalOs) {
            applyVaultPayload(idbSnap, userId);
          }
        }

        const remote = await pullAuthenticatedUserVault(userId);
        if (!active || activeUserIdRef.current !== userId) return;

        const localTs = getLocalUpdatedAt(userId);
        const remoteMs = parseIsoMs(remote?.updatedAt);
        const localMs = parseIsoMs(localTs);

        if (remote?.payload && (!localTs || localMs === 0 || remoteMs >= localMs)) {
          applyVaultPayload(remote.payload, userId);
          if (!hasLocal && remote.payload.personalOs) {
            const normalized = normalizePersistedState(remote.payload.personalOs);
            setLocked(normalized.settings.pinEnabled);
          }
        } else if (remote?.payload && localMs > remoteMs) {
          const payload: UnifiedVaultPayload = {
            format: 'coby-life-backup-v1',
            updatedAt: localTs || new Date().toISOString(),
            personalOs: stateRef.current,
          };
          await saveLocalIdbSnapshot(payload, userId);
          await pushAuthenticatedUserVault(userId, payload);
        } else {
          const seedState = hasLocal
            ? stateRef.current
            : (() => {
                const empty = createEmptyPersonalState();
                empty.settings.profile.name = displayName;
                return empty;
              })();
          const nowIso = localTs || new Date().toISOString();
          if (!hasLocal) {
            skipPersistForStateRef.current = seedState;
            stateRef.current = seedState;
            saveAppState(seedState, userId);
            setState(seedState);
          }
          setLocalUpdatedAt(nowIso, userId);
          const seedPayload: UnifiedVaultPayload = {
            format: 'coby-life-backup-v1',
            updatedAt: nowIso,
            personalOs: seedState,
          };
          await saveLocalIdbSnapshot(seedPayload, userId);
          await pushAuthenticatedUserVault(userId, seedPayload);
        }

        if (!active || activeUserIdRef.current !== userId) return;
        vaultHydratedForUserRef.current = userId;

        const cfg = cloudConfigRef.current;
        if (cfg.provider === 'supabase' && isCloudConfigValid(cfg)) {
          const inboxRes = await pullSupabaseInboxItems(cfg);
          if (
            active &&
            activeUserIdRef.current === userId &&
            inboxRes.ok &&
            inboxRes.items.length > 0
          ) {
            ingestRawGmailPayloads(inboxRes.items);
          }
        }

        if (!active || activeUserIdRef.current !== userId) return;
        setCloudStatus({
          state: 'synced',
          provider: 'supabase',
          lastSyncedAt: new Date().toISOString(),
          localDbReady: true,
          error: undefined,
        });
      } catch (err) {
        if (!active || activeUserIdRef.current !== userId) return;
        setCloudStatus({
          state: 'error',
          provider: 'supabase',
          lastSyncedAt: null,
          localDbReady: true,
          error: err instanceof Error ? err.message : 'Cloud sync failed',
        });
      }
    })();

    return () => {
      active = false;
      if (pushTimerRef.current) {
        window.clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, [authReady, authUserId, applyVaultPayload, ingestRawGmailPayloads]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  // Auto-pull newer user vault & pending Gmail Inbox items on window focus (>10s throttle)
  useEffect(() => {
    const onFocus = () => {
      const userId = activeUserIdRef.current;
      if (!userId || pushTimerRef.current !== null) return;
      const now = Date.now();
      if (now - lastFocusPullRef.current <= 10000) return;
      lastFocusPullRef.current = now;

      void pullAuthenticatedUserVault(userId)
        .then(async (remote) => {
          if (activeUserIdRef.current !== userId || pushTimerRef.current !== null) return;
          const localTs = getLocalUpdatedAt(userId);
          const remoteMs = parseIsoMs(remote?.updatedAt);
          const localMs = parseIsoMs(localTs);
          if (remote?.payload && remote.updatedAt && (!localTs || localMs === 0 || remoteMs > localMs)) {
            applyVaultPayload(remote.payload, userId);
          }
          vaultHydratedForUserRef.current = userId;

          const cfg = cloudConfigRef.current;
          if (cfg.provider === 'supabase' && isCloudConfigValid(cfg)) {
            const inboxRes = await pullSupabaseInboxItems(cfg);
            if (activeUserIdRef.current === userId && inboxRes.ok && inboxRes.items.length > 0) {
              ingestRawGmailPayloads(inboxRes.items);
            }
          }
          setCloudStatus((prev) => ({
            ...prev,
            state: 'synced',
            provider: 'supabase',
            lastSyncedAt: new Date().toISOString(),
            error: undefined,
          }));
        })
        .catch(() => {
          // Silent on background focus refresh
        });
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [applyVaultPayload, ingestRawGmailPayloads]);

  useEffect(() => {
    const onPop = () => {
      setRoute(parseLocation());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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

  /* ========================== Finance CRUD & Computed Balances ========================== */

  // Fixed phantom-key bug: only accumulate transactions for existing wallet IDs
  const walletBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of state.finance.wallets) {
      map[w.id] = w.initialBalance;
    }
    for (const tx of state.finance.transactions) {
      if (tx.type === 'income') {
        if (tx.walletId in map) map[tx.walletId] += tx.amount;
      } else if (tx.type === 'expense') {
        if (tx.walletId in map) map[tx.walletId] -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.walletId in map) map[tx.walletId] -= tx.amount;
        if (tx.toWalletId && tx.toWalletId in map) {
          map[tx.toWalletId] += tx.amount;
        }
      }
    }
    return map;
  }, [state.finance.wallets, state.finance.transactions]);

  const createTransaction = useCallback(
    (input: Omit<FinanceTransaction, 'id'>) => {
      const tx: FinanceTransaction = {
        ...input,
        id: uid('tx'),
        timestamp: input.timestamp || new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          transactions: [tx, ...prev.finance.transactions],
        },
      }));
      const label =
        tx.isAdjustment
          ? 'Balance reconciled'
          : tx.type === 'expense'
            ? 'Expense recorded'
            : tx.type === 'income'
              ? 'Income recorded'
              : 'Transfer recorded';
      pushToast(label, () => {
        setState((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            transactions: prev.finance.transactions.filter((t) => t.id !== tx.id),
          },
        }));
      });
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

  const updateWallet = useCallback(
    (id: string, patch: Partial<FinanceWallet>) => {
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          wallets: prev.finance.wallets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        },
      }));
      pushToast('Wallet updated');
    },
    [pushToast]
  );

  const deleteWallet = useCallback(
    (id: string) => {
      const existing = stateRef.current.finance.wallets.find((w) => w.id === id);
      if (!existing || stateRef.current.finance.wallets.length <= 1) return;
      const relatedTxs = stateRef.current.finance.transactions.filter(
        (t) => t.walletId === id || t.toWalletId === id
      );
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          wallets: prev.finance.wallets.filter((w) => w.id !== id),
          transactions: prev.finance.transactions.filter(
            (t) => t.walletId !== id && t.toWalletId !== id
          ),
        },
      }));
      pushToast(`Deleted wallet "${existing.name}"`, () => {
        setState((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            wallets: [...prev.finance.wallets, existing],
            transactions: [...relatedTxs, ...prev.finance.transactions],
          },
        }));
      });
    },
    [pushToast]
  );

  const reconcileWalletBalance = useCallback(
    (opts: ReconcileOptions) => {
      const currentBal = walletBalances[opts.walletId] ?? 0;
      const diff = Math.round(opts.targetBalance - currentBal);
      const nowIso = new Date().toISOString();

      if (Math.abs(diff) < 1) {
        setState((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            wallets: prev.finance.wallets.map((w) =>
              w.id === opts.walletId
                ? { ...w, lastReportedBalance: opts.targetBalance, lastReportedAt: nowIso }
                : w
            ),
          },
        }));
        pushToast('Wallet balance confirmed in sync');
        return;
      }

      const absDiff = Math.abs(diff);
      const defaultExpCat =
        opts.categoryId ||
        stateRef.current.finance.categories.find((c) => c.kind === 'expense')?.id ||
        'cat-other-exp';
      const defaultIncCat =
        opts.categoryId ||
        stateRef.current.finance.categories.find((c) => c.kind === 'income')?.id ||
        'cat-bonus';

      let tx: FinanceTransaction;
      if (opts.mode === 'transfer' && opts.toWalletId && diff < 0) {
        tx = {
          id: uid('tx'),
          type: 'transfer',
          amount: absDiff,
          categoryId: defaultExpCat,
          walletId: opts.walletId,
          toWalletId: opts.toWalletId,
          date: localIsoDate(),
          timestamp: nowIso,
          note: opts.note?.trim() || 'Wallet transfer / ATM cash withdrawal',
          source: 'reconcile',
        };
      } else if (opts.mode === 'silent') {
        tx = {
          id: uid('tx'),
          type: diff > 0 ? 'income' : 'expense',
          amount: absDiff,
          categoryId: diff > 0 ? defaultIncCat : defaultExpCat,
          walletId: opts.walletId,
          date: localIsoDate(),
          timestamp: nowIso,
          note: opts.note?.trim() || 'Balance reconciliation adjustment',
          source: 'reconcile',
          isAdjustment: true,
        };
      } else {
        const isOut = diff < 0;
        tx = {
          id: uid('tx'),
          type: isOut ? 'expense' : 'income',
          amount: absDiff,
          categoryId: isOut ? defaultExpCat : defaultIncCat,
          walletId: opts.walletId,
          date: localIsoDate(),
          timestamp: nowIso,
          note: opts.note?.trim() || (isOut ? 'Unlogged pocket / QR expenses' : 'Unlogged balance credit'),
          source: 'reconcile',
        };
      }

      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          transactions: [tx, ...prev.finance.transactions],
          wallets: prev.finance.wallets.map((w) =>
            w.id === opts.walletId
              ? { ...w, lastReportedBalance: opts.targetBalance, lastReportedAt: nowIso }
              : w
          ),
        },
      }));
      pushToast('Wallet balance reconciled');
    },
    [walletBalances, pushToast]
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

  /* ========================== Categories, Rules, Bills & Split CRUD ========================== */

  const createCategory = useCallback(
    (input: Omit<FinanceCategory, 'id'>) => {
      const cat: FinanceCategory = { ...input, id: uid('cat') };
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          categories: [...prev.finance.categories, cat],
        },
      }));
      pushToast(`Added category "${cat.name}"`);
      return cat;
    },
    [pushToast]
  );

  const updateCategory = useCallback((id: string, patch: Partial<FinanceCategory>) => {
    setState((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        categories: prev.finance.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    }));
  }, []);

  const deleteCategory = useCallback(
    (id: string) => {
      const target = stateRef.current.finance.categories.find((c) => c.id === id);
      if (!target) return;
      const sameKind = stateRef.current.finance.categories.filter(
        (c) => c.kind === target.kind && c.id !== id
      );
      if (sameKind.length === 0) {
        pushToast('Keep at least one category of each type');
        return;
      }
      const fallbackCatId = sameKind[0].id;
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          categories: prev.finance.categories.filter((c) => c.id !== id),
          budgets: prev.finance.budgets.filter((b) => b.categoryId !== id),
          transactions: prev.finance.transactions.map((tx) =>
            tx.categoryId === id ? { ...tx, categoryId: fallbackCatId } : tx
          ),
        },
      }));
      pushToast(`Removed category "${target.name}"`);
    },
    [pushToast]
  );

  const saveAutoRule = useCallback(
    (input: Omit<FinanceAutoRule, 'id'> & { id?: string }) => {
      const rule: FinanceAutoRule = {
        ...input,
        id: input.id || uid('rule'),
      };
      setState((prev) => {
        const exists = prev.finance.rules.some((r) => r.id === rule.id);
        const nextRules = exists
          ? prev.finance.rules.map((r) => (r.id === rule.id ? rule : r))
          : [rule, ...prev.finance.rules];

        // Retro-apply new/updated rule onto matching pending Inbox items!
        const pat = rule.pattern.trim().toUpperCase();
        const nextInbox = prev.finance.inbox.map((item) => {
          if (item.status !== 'pending' || !pat) return item;
          const hay = `${item.cleanMerchant} ${item.cleanMemo} ${item.sender}`.toUpperCase();
          if (!hay.includes(pat)) return item;
          if (rule.direction && rule.direction !== item.direction) return item;
          return {
            ...item,
            matchedRuleId: rule.id,
            suggestedCategoryId: rule.categoryId || item.suggestedCategoryId,
            suggestedWalletId: rule.walletId || item.suggestedWalletId,
            cleanMerchant: rule.renameMerchantTo || item.cleanMerchant,
            suggestedType: rule.txType || item.suggestedType,
            suggestedToWalletId:
              rule.txType === 'transfer' ? rule.toWalletId || item.suggestedToWalletId : item.suggestedToWalletId,
          };
        });

        return {
          ...prev,
          finance: {
            ...prev.finance,
            rules: nextRules,
            inbox: nextInbox,
          },
        };
      });
      pushToast(`Saved auto-rule for "${rule.pattern}"`);
      return rule;
    },
    [pushToast]
  );

  const deleteAutoRule = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          rules: prev.finance.rules.filter((r) => r.id !== id),
        },
      }));
      pushToast('Rule deleted');
    },
    [pushToast]
  );

  const saveRecurringBill = useCallback(
    (input: Omit<FinanceRecurringBill, 'id'> & { id?: string }) => {
      const bill: FinanceRecurringBill = {
        ...input,
        id: input.id || uid('bill'),
      };
      setState((prev) => {
        const exists = prev.finance.recurringBills.some((b) => b.id === bill.id);
        return {
          ...prev,
          finance: {
            ...prev.finance,
            recurringBills: exists
              ? prev.finance.recurringBills.map((b) => (b.id === bill.id ? bill : b))
              : [...prev.finance.recurringBills, bill],
          },
        };
      });
      pushToast(`Saved recurring bill "${bill.name}"`);
      return bill;
    },
    [pushToast]
  );

  const deleteRecurringBill = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          recurringBills: prev.finance.recurringBills.filter((b) => b.id !== id),
        },
      }));
      pushToast('Recurring bill removed');
    },
    [pushToast]
  );

  const markBillPaid = useCallback(
    (billId: string, cycleKey?: string) => {
      const bill = stateRef.current.finance.recurringBills.find((b) => b.id === billId);
      if (!bill) return;
      const targetCycle = cycleKey || currentCycleKey(new Date(), stateRef.current.finance.paydayDay || 1);
      const usdRate = stateRef.current.finance.usdVndRate || 25500;
      const amtVnd = bill.currency === 'USD' ? Math.round(bill.amount * usdRate) : bill.amount;

      const tx: FinanceTransaction = {
        id: uid('tx'),
        type: 'expense',
        amount: amtVnd,
        categoryId: bill.categoryId,
        walletId: bill.walletId,
        date: localIsoDate(),
        timestamp: new Date().toISOString(),
        note: bill.name,
        linkedBillId: bill.id,
        originalAmount: bill.currency === 'USD' ? bill.amount : undefined,
        originalCurrency: bill.currency === 'USD' ? 'USD' : undefined,
      };

      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          transactions: [tx, ...prev.finance.transactions],
          recurringBills: prev.finance.recurringBills.map((b) =>
            b.id === billId ? { ...b, lastPaidCycleKey: targetCycle } : b
          ),
        },
      }));
      pushToast(`Logged & marked "${bill.name}" paid`);
    },
    [pushToast]
  );

  const setPaydayDay = useCallback(
    (day: number) => {
      const clamped = Math.min(28, Math.max(1, Math.round(day || 1)));
      setState((prev) => ({
        ...prev,
        finance: { ...prev.finance, paydayDay: clamped },
      }));
      pushToast(
        clamped === 1
          ? 'Billing cycle set to Calendar Month (1st)'
          : `Billing cycle anchored to day ${clamped} of each month`
      );
    },
    [pushToast]
  );

  const setUsdVndRate = useCallback((rate: number) => {
    if (!Number.isFinite(rate) || rate <= 0) return;
    setState((prev) => ({
      ...prev,
      finance: { ...prev.finance, usdVndRate: Math.round(rate) },
    }));
  }, []);

  const settleSplitTransaction = useCallback(
    (txId: string, receivedAmount?: number, targetWalletId?: string) => {
      const parent = stateRef.current.finance.transactions.find((t) => t.id === txId);
      if (!parent || !parent.split) return;
      const remaining = Math.max(0, parent.split.reimbursable - parent.split.repaidAmount);
      const repayAmt = receivedAmount && receivedAmount > 0 ? receivedAmount : remaining;
      if (repayAmt <= 0) return;

      const nextRepaid = Math.min(parent.split.reimbursable, parent.split.repaidAmount + repayAmt);
      const isSettled = nextRepaid >= parent.split.reimbursable;
      const incCat =
        stateRef.current.finance.categories.find((c) => c.kind === 'income')?.id || 'cat-bonus';

      const repaymentTx: FinanceTransaction = {
        id: uid('tx'),
        type: 'income',
        amount: repayAmt,
        categoryId: incCat,
        walletId: targetWalletId || parent.walletId,
        date: localIsoDate(),
        timestamp: new Date().toISOString(),
        note: `Split repayment: ${parent.note || 'Shared bill'}`,
        repaymentForTxId: parent.id,
      };

      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          transactions: [
            repaymentTx,
            ...prev.finance.transactions.map((t) =>
              t.id === parent.id && t.split
                ? {
                    ...t,
                    split: {
                      ...t.split,
                      repaidAmount: nextRepaid,
                      status: isSettled ? ('settled' as const) : ('open' as const),
                      repaymentTxIds: [...(t.split.repaymentTxIds || []), repaymentTx.id],
                    },
                  }
                : t
            ),
          ],
        },
      }));
      pushToast(isSettled ? 'Split bill fully settled!' : 'Recorded partial split repayment');
    },
    [pushToast]
  );

  /* ========================== Gmail Inbox Actions ========================== */

  const importRawGmailText = useCallback(
    (rawText: string): boolean => {
      const clean = rawText.trim();
      if (!clean) return false;
      const usdRate = stateRef.current.finance.usdVndRate || 25500;
      const parsed = parseVietnameseGmailAlert(clean, usdRate);
      if (!parsed) {
        pushToast('No valid amount found in pasted text (skipping OTP/non-financial message)');
        return false;
      }
      setState((prev) => {
        const built = buildSmartInboxItems([parsed], prev.finance, uid);
        if (built.length === 0) return prev;
        return {
          ...prev,
          finance: {
            ...prev.finance,
            inbox: [...built, ...prev.finance.inbox],
          },
        };
      });
      pushToast(`Parsed "${parsed.cleanMerchant}" into Inbox`);
      return true;
    },
    [pushToast]
  );

  const loadSampleGmailDemo = useCallback(() => {
    const samples = createSampleGmailDemoPayloads();
    const added = ingestRawGmailPayloads(samples);
    if (added > 0) {
      pushToast(`Loaded ${added} sample Vietnamese Gmail alerts into Inbox`);
    } else {
      pushToast('Sample Gmail alerts are already in your Inbox or Ledger');
    }
  }, [ingestRawGmailPayloads, pushToast]);

  const updateInboxItem = useCallback((id: string, patch: Partial<GmailInboxItem>) => {
    setState((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        inbox: prev.finance.inbox.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      },
    }));
  }, []);

  const approveInboxItem = useCallback(
    (id: string, opts?: ApproveInboxOptions) => {
      const item = stateRef.current.finance.inbox.find((it) => it.id === id);
      if (!item) return;

      const cycleKey = currentCycleKey(new Date(), stateRef.current.finance.paydayDay || 1);
      const txDate = item.receivedAt.slice(0, 10) || localIsoDate();

      // Case 1: Merchant receipt enriching an existing card/bank transaction (zero double-counting!)
      if (item.enrichedLedgerTxId) {
        setState((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            inbox: prev.finance.inbox.filter((it) => it.id !== id),
            transactions: prev.finance.transactions.map((tx) =>
              tx.id === item.enrichedLedgerTxId
                ? {
                    ...tx,
                    categoryId: item.suggestedCategoryId || tx.categoryId,
                    merchant: item.cleanMerchant,
                    note: `${item.cleanMerchant} · ${item.cleanMemo}`.slice(0, 140),
                    pairedGmailMessageId: item.messageId,
                  }
                : tx
            ),
          },
        }));
        void ackSupabaseInboxItems(cloudConfigRef.current, [item.messageId], 'imported');
        pushToast(`Enriched existing transaction with "${item.cleanMerchant}" receipt`);
        return;
      }

      // Build optional Split / Reimbursable metadata
      const splitMeta =
        item.suggestedType === 'expense' &&
        opts?.splitMyShare !== undefined &&
        opts.splitMyShare >= 0 &&
        opts.splitMyShare < item.amount
          ? {
              myShare: Math.round(opts.splitMyShare),
              reimbursable: Math.round(item.amount - opts.splitMyShare),
              repaidAmount: 0,
              counterparty: opts.splitCounterparty?.trim() || undefined,
              status: 'open' as const,
            }
          : undefined;

      const newTx: FinanceTransaction = {
        id: uid('tx'),
        type: item.suggestedType,
        amount: item.amount,
        categoryId: item.suggestedCategoryId,
        walletId: item.suggestedWalletId,
        toWalletId: item.suggestedType === 'transfer' ? item.suggestedToWalletId : undefined,
        date: txDate,
        timestamp: item.receivedAt,
        note:
          item.cleanMerchant && item.cleanMerchant !== 'Transaction'
            ? `${item.cleanMerchant}${item.cleanMemo && item.cleanMemo !== item.cleanMerchant ? ` · ${item.cleanMemo}` : ''}`.slice(0, 140)
            : item.cleanMemo,
        merchant: item.cleanMerchant,
        source: 'gmail',
        gmailMessageId: item.messageId,
        linkedBillId: item.matchedBillId,
        repaymentForTxId: item.direction === 'in' ? item.matchedSplitTxId : undefined,
        split: splitMeta,
        originalAmount: item.originalAmount,
        originalCurrency: item.originalCurrency,
      };

      setState((prev) => {
        let nextTxs = [newTx, ...prev.finance.transactions];
        // If settling an open split, update parent's repaidAmount
        if (newTx.repaymentForTxId) {
          nextTxs = nextTxs.map((t) => {
            if (t.id !== newTx.repaymentForTxId || !t.split) return t;
            const nextRepaid = Math.min(t.split.reimbursable, t.split.repaidAmount + newTx.amount);
            return {
              ...t,
              split: {
                ...t.split,
                repaidAmount: nextRepaid,
                status: nextRepaid >= t.split.reimbursable ? 'settled' : 'open',
                repaymentTxIds: [...(t.split.repaymentTxIds || []), newTx.id],
              },
            };
          });
        }

        const nextWallets = prev.finance.wallets.map((w) => {
          if (
            w.id === item.suggestedWalletId &&
            typeof item.reportedBalanceAfter === 'number' &&
            (!w.lastReportedAt || item.receivedAt >= w.lastReportedAt)
          ) {
            return {
              ...w,
              lastReportedBalance: item.reportedBalanceAfter,
              lastReportedAt: item.receivedAt,
            };
          }
          return w;
        });

        const nextBills = item.matchedBillId
          ? prev.finance.recurringBills.map((b) =>
              b.id === item.matchedBillId ? { ...b, lastPaidCycleKey: cycleKey } : b
            )
          : prev.finance.recurringBills;

        let nextRules = prev.finance.rules;
        if (opts?.saveRule && item.cleanMerchant && item.cleanMerchant !== 'Transaction') {
          const rule: FinanceAutoRule = {
            id: uid('rule'),
            pattern: item.cleanMerchant.toUpperCase(),
            direction: item.direction,
            categoryId: item.suggestedCategoryId,
            walletId: item.suggestedWalletId,
            renameMerchantTo: item.cleanMerchant,
            txType: item.suggestedType,
            toWalletId: item.suggestedToWalletId,
          };
          nextRules = [rule, ...prev.finance.rules];
        }

        return {
          ...prev,
          finance: {
            ...prev.finance,
            inbox: prev.finance.inbox.filter((it) => it.id !== id),
            transactions: nextTxs,
            wallets: nextWallets,
            recurringBills: nextBills,
            rules: nextRules,
          },
        };
      });

      void ackSupabaseInboxItems(cloudConfigRef.current, [item.messageId], 'imported');
      pushToast(`Approved "${item.cleanMerchant}"`, () => {
        setState((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            inbox: [item, ...prev.finance.inbox],
            transactions: prev.finance.transactions.filter((t) => t.id !== newTx.id),
          },
        }));
      });
    },
    [pushToast]
  );

  const approveAllMatchedInbox = useCallback(() => {
    const pending = stateRef.current.finance.inbox.filter((it) => it.status === 'pending');
    if (pending.length === 0) return;

    const cycleKey = currentCycleKey(new Date(), stateRef.current.finance.paydayDay || 1);
    const createdTxs: FinanceTransaction[] = [];
    const ackIds: string[] = [];

    for (const item of pending) {
      ackIds.push(item.messageId);
      if (item.enrichedLedgerTxId) continue;
      createdTxs.push({
        id: uid('tx'),
        type: item.suggestedType,
        amount: item.amount,
        categoryId: item.suggestedCategoryId,
        walletId: item.suggestedWalletId,
        toWalletId: item.suggestedType === 'transfer' ? item.suggestedToWalletId : undefined,
        date: item.receivedAt.slice(0, 10) || localIsoDate(),
        timestamp: item.receivedAt,
        note: `${item.cleanMerchant}${item.cleanMemo && item.cleanMemo !== item.cleanMerchant ? ` · ${item.cleanMemo}` : ''}`.slice(
          0,
          140
        ),
        merchant: item.cleanMerchant,
        source: 'gmail',
        gmailMessageId: item.messageId,
        linkedBillId: item.matchedBillId,
        originalAmount: item.originalAmount,
        originalCurrency: item.originalCurrency,
      });
    }

    const matchedBillIds = new Set(pending.map((i) => i.matchedBillId).filter(Boolean));
    setState((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        inbox: [],
        transactions: [...createdTxs, ...prev.finance.transactions],
        recurringBills: prev.finance.recurringBills.map((b) =>
          matchedBillIds.has(b.id) ? { ...b, lastPaidCycleKey: cycleKey } : b
        ),
      },
    }));

    void ackSupabaseInboxItems(cloudConfigRef.current, ackIds, 'imported');
    pushToast(`Approved ${pending.length} Gmail transactions`);
  }, [pushToast]);

  const ignoreInboxItem = useCallback(
    (id: string) => {
      const existing = stateRef.current.finance.inbox.find((it) => it.id === id);
      if (!existing) return;
      setState((prev) => ({
        ...prev,
        finance: {
          ...prev.finance,
          inbox: prev.finance.inbox.filter((it) => it.id !== id),
        },
      }));
      void ackSupabaseInboxItems(cloudConfigRef.current, [existing.messageId], 'ignored');
      pushToast('Ignored Gmail alert', () => {
        setState((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            inbox: [existing, ...prev.finance.inbox],
          },
        }));
      });
    },
    [pushToast]
  );

  const updateCloudConfigPatch = useCallback((patch: Partial<CloudDbConfig>) => {
    setCloudConfig((prev) => {
      const next = { ...prev, ...patch };
      saveCloudConfigToStorage(next);
      return next;
    });
  }, []);

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

  const clearTasksData = useCallback(() => {
    const prevTasks = stateRef.current.tasks;
    setState((prev) => ({ ...prev, tasks: [] }));
    setDrawer((d) => (d?.kind === 'task' ? null : d));
    if (prevTasks.length === 0) {
      pushToast('Tasks are already empty');
      return;
    }
    pushToast(
      `Cleared ${prevTasks.length} task${prevTasks.length === 1 ? '' : 's'}`,
      () => {
        setState((prev) => {
          const existingIds = new Set(prev.tasks.map((t) => t.id));
          const restored = prevTasks.filter((t) => !existingIds.has(t.id));
          return { ...prev, tasks: [...prev.tasks, ...restored] };
        });
      }
    );
  }, [pushToast]);

  const clearFinanceData = useCallback(() => {
    const prevFinance = stateRef.current.finance;
    setState((prev) => ({
      ...prev,
      finance: {
        ...prev.finance,
        transactions: [],
        budgets: [],
        inbox: [],
        recurringBills: [],
        wallets: prev.finance.wallets.map((w) => ({
          ...w,
          initialBalance: 0,
          lastReportedBalance: undefined,
          lastReportedAt: undefined,
        })),
      },
    }));
    setDrawer((d) => (d?.kind === 'transaction' ? null : d));
    pushToast('Cleared Finance transactions, budgets, bills & Inbox', () => {
      setState((prev) => ({ ...prev, finance: prevFinance }));
    });
  }, [pushToast]);

  const loadDemoSampleData = useCallback(() => {
    setState(createDemoSampleState());
    setDrawer(null);
    pushToast('Demo sample data loaded');
  }, [pushToast]);

  const clearToEmpty = useCallback(() => {
    const empty = createEmptyPersonalState();
    if (authUserRef.current?.displayName) {
      empty.settings.profile.name = authUserRef.current.displayName;
    }
    setState(empty);
    setDrawer(null);
    pushToast('Cleared sample Tasks & Finance data — ready for a fresh start');
  }, [pushToast]);

  const resetStarterData = useCallback(() => {
    const starter = createStarterState();
    if (authUserRef.current?.displayName) {
      starter.settings.profile.name = authUserRef.current.displayName;
    }
    setState(starter);
    setDrawer(null);
    pushToast('Sample data restored');
  }, [pushToast]);

  const saveCloudConfig = useCallback(
    async (next: CloudDbConfig): Promise<{ ok: boolean; message: string }> => {
      if (!isCloudConfigValid(next)) {
        return { ok: false, message: 'Fill in all required database connection fields.' };
      }
      const userId = activeUserIdRef.current || authUserRef.current?.id;
      setCloudStatus((prev) => ({
        ...prev,
        state: 'syncing',
        provider: next.provider,
        error: undefined,
      }));
      try {
        const remote = await pullFromCloudDb(next);
        let finalCfg = { ...next };
        const localTs = getLocalUpdatedAt(userId);
        let summary = 'Connected & synced with Cloud DB';

        if (remote?.payload && (!localTs || parseIsoMs(remote.updatedAt) > parseIsoMs(localTs))) {
          applyVaultPayload(remote.payload, userId);
          summary = 'Connected — pulled latest data from Cloud DB';
        } else {
          const nowIso = new Date().toISOString();
          setLocalUpdatedAt(nowIso, userId);
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
          provider: userId ? 'supabase' : finalCfg.provider,
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
          provider: userId ? 'supabase' : next.provider,
          error: msg,
        }));
        return { ok: false, message: msg };
      }
    },
    [applyVaultPayload, buildVaultPayload, pushToast]
  );

  const resetCloudState = useCallback(
    (opts?: { silent?: boolean; persistEmptyConfig?: boolean }) => {
      const reset = { ...DEFAULT_CLOUD_CONFIG };
      if (opts?.persistEmptyConfig !== false) {
        saveCloudConfigToStorage(reset);
      }
      setCloudConfig(reset);
      if (!activeUserIdRef.current) {
        setCloudStatus((prev) => ({
          ...prev,
          state: 'local',
          provider: 'none',
          lastSyncedAt: opts?.silent ? null : prev.lastSyncedAt,
          error: undefined,
        }));
      }
      if (!opts?.silent) {
        pushToast('Disconnected custom Cloud DB config');
      }
    },
    [pushToast]
  );

  const disconnectCloudDb = useCallback(() => {
    resetCloudState({ silent: false, persistEmptyConfig: true });
  }, [resetCloudState]);

  const performSignOut = useCallback(
    async (opts?: { skipFlush?: boolean; silentToast?: boolean }) => {
      if (pushTimerRef.current) {
        window.clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      const userId = activeUserIdRef.current || authUserRef.current?.id || null;
      if (!opts?.skipFlush && userId && vaultHydratedForUserRef.current === userId) {
        const nowIso = getLocalUpdatedAt(userId) || new Date().toISOString();
        try {
          await pushAuthenticatedUserVault(userId, buildVaultPayload(nowIso));
        } catch {
          // Do not block sign-out if network is unavailable
        }
      }

      vaultHydratedForUserRef.current = null;
      activeUserIdRef.current = null;

      await signOutCloud();

      const empty = createEmptyPersonalState();
      skipPersistForStateRef.current = empty;
      stateRef.current = empty;
      setState(empty);
      setLocked(false);
      setDrawer(null);
      setModal(null);
      setLastGmailSyncAt(null);
      setAuthUser(null);
      setCloudStatus({
        state: 'local',
        provider: 'none',
        lastSyncedAt: null,
        localDbReady: false,
      });

      if (!opts?.silentToast) {
        pushToast('Signed out of workspace');
      }
    },
    [buildVaultPayload, pushToast]
  );

  const signOutWorkspace = useCallback(async () => {
    await performSignOut();
  }, [performSignOut]);

  const clearAllWorkspaceData = useCallback(
    async (opts?: { factoryReset?: boolean }) => {
      if (pushTimerRef.current) {
        window.clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      const userId = activeUserIdRef.current || authUserRef.current?.id || undefined;
      const isFactory = Boolean(opts?.factoryReset);

      if (isFactory) {
        vaultHydratedForUserRef.current = null;
        clearAppState(userId);
        await clearLocalIdbSnapshot(userId);
        resetCloudState({ silent: true, persistEmptyConfig: false });

        const keysToRemove = [
          'coby_cloud_db_config_v1',
          'coby_life_os_v1',
          'sylva_personal_os_v2',
          'coby_life_updated_at_v1',
          'coby_life_auth_account_v1',
          'coby_life_auth_session_v1',
          'coby_life_remember_me_v1',
          'coby_life_sb_auth_v1',
        ];
        for (const key of keysToRemove) {
          try {
            window.localStorage.removeItem(key);
          } catch {
            // Ignore
          }
          try {
            window.sessionStorage.removeItem(key);
          } catch {
            // Ignore
          }
        }
        await performSignOut({ skipFlush: true, silentToast: true });
        pushToast('Factory reset complete — all local data cleared');
        return;
      }

      const empty = createEmptyPersonalState();
      if (authUserRef.current?.displayName) {
        empty.settings.profile.name = authUserRef.current.displayName;
      }
      const nowIso = new Date().toISOString();
      skipPersistForStateRef.current = empty;
      stateRef.current = empty;
      saveAppState(empty, userId);
      setLocalUpdatedAt(nowIso, userId);
      setState(empty);
      setDrawer(null);

      await clearLocalIdbSnapshot(userId);

      if (userId) {
        const emptyPayload: UnifiedVaultPayload = {
          format: 'coby-life-backup-v1',
          updatedAt: nowIso,
          personalOs: empty,
        };
        setCloudStatus((prev) => ({
          ...prev,
          state: 'syncing',
          provider: 'supabase',
          error: undefined,
        }));
        try {
          await pushAuthenticatedUserVault(userId, emptyPayload);
          vaultHydratedForUserRef.current = userId;
          setCloudStatus((prev) => ({
            ...prev,
            state: 'synced',
            provider: 'supabase',
            lastSyncedAt: new Date().toISOString(),
            error: undefined,
          }));
        } catch (err) {
          setCloudStatus((prev) => ({
            ...prev,
            state: 'error',
            provider: 'supabase',
            error: err instanceof Error ? err.message : 'Cloud sync failed',
          }));
        }
      }

      pushToast('Cleared all workspace data — ready for a fresh start');
    },
    [performSignOut, pushToast, resetCloudState]
  );

  const syncCloudNow = useCallback(async () => {
    const userId = activeUserIdRef.current || authUserRef.current?.id;
    const cfg = cloudConfigRef.current;

    if (userId) {
      setCloudStatus((prev) => ({
        ...prev,
        state: 'syncing',
        provider: 'supabase',
        error: undefined,
      }));
      try {
        const remote = await pullAuthenticatedUserVault(userId);
        const localTs = getLocalUpdatedAt(userId);
        const remoteMs = parseIsoMs(remote?.updatedAt);
        const localMs = parseIsoMs(localTs);

        if (remote?.payload && remote.updatedAt && (!localTs || localMs === 0 || remoteMs > localMs)) {
          applyVaultPayload(remote.payload, userId);
          pushToast('Pulled newer data from Cloud');
        } else if (!remote?.payload || localMs > remoteMs) {
          const nowIso = new Date().toISOString();
          setLocalUpdatedAt(nowIso, userId);
          const payload = buildVaultPayload(nowIso);
          await saveLocalIdbSnapshot(payload, userId);
          await pushAuthenticatedUserVault(userId, payload);
          pushToast('Synced latest snapshot to Cloud');
        } else {
          pushToast('Cloud workspace is up to date');
        }

        vaultHydratedForUserRef.current = userId;
        if (cfg.provider === 'supabase' && isCloudConfigValid(cfg)) {
          const inboxRes = await pullSupabaseInboxItems(cfg);
          if (inboxRes.ok && inboxRes.items.length > 0) {
            ingestRawGmailPayloads(inboxRes.items);
          }
        }
        setCloudStatus({
          state: 'synced',
          provider: 'supabase',
          lastSyncedAt: new Date().toISOString(),
          localDbReady: true,
          error: undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Cloud sync failed';
        setCloudStatus((prev) => ({
          ...prev,
          state: 'error',
          provider: 'supabase',
          error: msg,
        }));
        pushToast(msg);
      }
      return;
    }

    if (!isCloudConfigValid(cfg)) {
      pushToast('Sign in or configure Cloud DB first');
      return;
    }
    setCloudStatus((prev) => ({ ...prev, state: 'syncing', error: undefined }));
    try {
      const remote = await pullFromCloudDb(cfg);
      const localTs = getLocalUpdatedAt();
      if (remote?.payload && remote.updatedAt && (!localTs || parseIsoMs(remote.updatedAt) > parseIsoMs(localTs))) {
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
  }, [applyVaultPayload, buildVaultPayload, ingestRawGmailPayloads, pushToast]);

  const pushCloudNow = useCallback(async () => {
    const userId = activeUserIdRef.current || authUserRef.current?.id;
    if (userId) {
      setCloudStatus((prev) => ({
        ...prev,
        state: 'syncing',
        provider: 'supabase',
        error: undefined,
      }));
      try {
        const nowIso = new Date().toISOString();
        setLocalUpdatedAt(nowIso, userId);
        const payload = buildVaultPayload(nowIso);
        await saveLocalIdbSnapshot(payload, userId);
        await pushAuthenticatedUserVault(userId, payload);
        vaultHydratedForUserRef.current = userId;
        setCloudStatus({
          state: 'synced',
          provider: 'supabase',
          lastSyncedAt: new Date().toISOString(),
          localDbReady: true,
          error: undefined,
        });
        pushToast('Uploaded local data → Cloud');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Push failed';
        setCloudStatus((prev) => ({
          ...prev,
          state: 'error',
          provider: 'supabase',
          error: msg,
        }));
        pushToast(msg);
      }
      return;
    }

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
    const userId = activeUserIdRef.current || authUserRef.current?.id;
    if (userId) {
      setCloudStatus((prev) => ({
        ...prev,
        state: 'syncing',
        provider: 'supabase',
        error: undefined,
      }));
      try {
        const remote = await pullAuthenticatedUserVault(userId);
        if (!remote?.payload) {
          vaultHydratedForUserRef.current = userId;
          setCloudStatus({
            state: 'synced',
            provider: 'supabase',
            lastSyncedAt: new Date().toISOString(),
            localDbReady: true,
            error: undefined,
          });
          pushToast('Cloud workspace is empty — push local data first');
          return;
        }
        applyVaultPayload(remote.payload, userId);
        vaultHydratedForUserRef.current = userId;
        setCloudStatus({
          state: 'synced',
          provider: 'supabase',
          lastSyncedAt: new Date().toISOString(),
          localDbReady: true,
          error: undefined,
        });
        pushToast('Restored snapshot from Cloud');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Pull failed';
        setCloudStatus((prev) => ({
          ...prev,
          state: 'error',
          provider: 'supabase',
          error: msg,
        }));
        pushToast(msg);
      }
      return;
    }

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
      authUser,
      authReady,
      signOutWorkspace,
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
      reconcileWalletBalance,
      setCategoryBudget,
      createCategory,
      updateCategory,
      deleteCategory,
      saveAutoRule,
      deleteAutoRule,
      saveRecurringBill,
      deleteRecurringBill,
      markBillPaid,
      setPaydayDay,
      setUsdVndRate,
      settleSplitTransaction,
      gmailSyncing,
      lastGmailSyncAt,
      syncGmailInbox,
      importRawGmailText,
      loadSampleGmailDemo,
      updateInboxItem,
      approveInboxItem,
      approveAllMatchedInbox,
      ignoreInboxItem,
      updateCloudConfigPatch,
      addFutureIdea,
      deleteFutureIdea,
      exportUnifiedBackup,
      importUnifiedBackup,
      clearTasksData,
      clearFinanceData,
      clearAllWorkspaceData,
      loadDemoSampleData,
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
      authUser,
      authReady,
      signOutWorkspace,
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
      reconcileWalletBalance,
      setCategoryBudget,
      createCategory,
      updateCategory,
      deleteCategory,
      saveAutoRule,
      deleteAutoRule,
      saveRecurringBill,
      deleteRecurringBill,
      markBillPaid,
      setPaydayDay,
      setUsdVndRate,
      settleSplitTransaction,
      gmailSyncing,
      lastGmailSyncAt,
      syncGmailInbox,
      importRawGmailText,
      loadSampleGmailDemo,
      updateInboxItem,
      approveInboxItem,
      approveAllMatchedInbox,
      ignoreInboxItem,
      updateCloudConfigPatch,
      addFutureIdea,
      deleteFutureIdea,
      exportUnifiedBackup,
      importUnifiedBackup,
      clearTasksData,
      clearFinanceData,
      clearAllWorkspaceData,
      loadDemoSampleData,
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

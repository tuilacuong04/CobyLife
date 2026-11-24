export type ThemeMode = 'dark' | 'light';
export type WeekStart = 'monday' | 'sunday';
export type CurrencyCode = 'VND' | 'USD';
export type AccentTone = 'lime' | 'sky' | 'coral' | 'sand';
export type AvatarTone = AccentTone;

export type PageId =
  | 'overview'
  | 'gym'
  | 'tasks'
  | 'finance'
  | 'modules'
  | 'settings';

export type ModuleId = 'gym' | 'tasks' | 'finance';

/* ---------- OpenGym Live Snapshot (read from localStorage['gym_state_v1']) ---------- */
export interface OpenGymRoutineSummary {
  id: string;
  name: string;
  exerciseCount: number;
}

export interface OpenGymSnapshot {
  available: boolean;
  workoutsCount: number;
  workoutsThisWeek: number;
  weekTarget: number;
  streakWeeks: number;
  totalVolumeThisWeek: number;
  totalSetsThisWeek: number;
  unit: 'kg' | 'lb';
  lastWorkout: {
    name: string;
    date: string;
    vol: number;
    durationMin: number;
    sets: number;
  } | null;
  todayRoutine: OpenGymRoutineSummary | null;
  activeWorkout: {
    name: string;
    startedAt: number;
  } | null;
  latestBodyweight: {
    weight: number;
    date: string;
    target: number | null;
  } | null;
  routines: OpenGymRoutineSummary[];
}

/* ---------- Module 2: Personal Tasks ---------- */
export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskCategory = 'personal' | 'work' | 'health' | 'study' | 'finance';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string; // YYYY-MM-DD or ''
  dueTime?: string; // HH:MM
  recurrence: TaskRecurrence;
  pinned?: boolean;
  subtasks: SubTask[];
  createdAt: string; // YYYY-MM-DD
  completedAt?: string; // YYYY-MM-DD
}

/* ---------- Module 3: Personal Finance ---------- */
export type TxType = 'expense' | 'income' | 'transfer';
export type WalletKind = 'cash' | 'bank' | 'ewallet' | 'card' | 'savings';

export interface FinanceWallet {
  id: string;
  name: string;
  kind: WalletKind;
  initialBalance: number;
  tone: AccentTone;
  note?: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  kind: 'expense' | 'income';
  tone: AccentTone;
  badge: string;
}

export interface FinanceTransaction {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  walletId: string;
  toWalletId?: string;
  date: string; // YYYY-MM-DD
  note: string;
}

export interface FinanceBudget {
  categoryId: string;
  monthlyLimit: number;
}

export interface FinanceState {
  wallets: FinanceWallet[];
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
}

/* ---------- Module 4+: Extensible Future Modules ---------- */
export interface FutureModuleIdea {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  tone: AccentTone;
}

/* ---------- User Profile & App Settings ---------- */
export interface UserProfile {
  name: string;
  tagline: string;
  avatar: string;
}

export interface AppSettings {
  theme: ThemeMode;
  currency: CurrencyCode;
  weekStartsOn: WeekStart;
  pinEnabled: boolean;
  pinCode: string;
  profile: UserProfile;
  enabledModules: Record<ModuleId, boolean>;
}

export interface PersistedAppState {
  version: number;
  tasks: TaskItem[];
  finance: FinanceState;
  futureModules: FutureModuleIdea[];
  settings: AppSettings;
}

export type DrawerState =
  | { kind: 'task'; id: string }
  | { kind: 'transaction'; id: string }
  | null;

export type ModalState =
  | { kind: 'search' }
  | { kind: 'shortcuts' }
  | { kind: 'new-task'; defaultStatus?: TaskStatus; defaultCategory?: TaskCategory; defaultDate?: string }
  | { kind: 'new-tx'; defaultType?: TxType; defaultWalletId?: string; defaultCategoryId?: string }
  | { kind: 'new-wallet' }
  | { kind: 'new-idea' }
  | null;

export interface ToastItem {
  id: string;
  message: string;
  undo?: () => void;
}

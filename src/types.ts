export type ThemeMode = 'dark' | 'light';
export type WeekStart = 'monday' | 'sunday';
export type CurrencyCode = 'VND' | 'USD';
export type AccentTone = 'lime' | 'sky' | 'coral' | 'sand';
export type AvatarTone = AccentTone;

export type PageId =
  | 'overview'
  | 'tasks'
  | 'finance'
  | 'modules'
  | 'settings';

export type ModuleId = 'tasks' | 'finance';

/* ---------- Module 1: Personal Tasks ---------- */
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

/* ---------- Module 2: Personal Finance (Mobile-Web + Gmail Sync) ---------- */
export type TxType = 'expense' | 'income' | 'transfer';
export type WalletKind = 'cash' | 'bank' | 'ewallet' | 'card' | 'savings';
export type TxSource = 'manual' | 'quick-log' | 'gmail' | 'reconcile';

export interface TxSplitInfo {
  myShare: number;          // Personal portion counted in Budgets & Net Expense
  reimbursable: number;     // Fronted portion ("ứng hộ") excluded from personal budget
  repaidAmount: number;     // Sum of linked incoming repayments
  counterparty?: string;    // e.g. "Minh, Lan"
  status: 'open' | 'settled';
  repaymentTxIds?: string[];
}

export interface FinanceWallet {
  id: string;
  name: string;
  kind: WalletKind;
  initialBalance: number;
  tone: AccentTone;
  note?: string;
  bankCode?: string;             // e.g. "TIMO", "ACB", "VCB", "TPB", "VIB", "MOMO"
  accountHint?: string;          // Last 4 digits of account/card (e.g. "9012") for Gmail matching
  lastReportedBalance?: number;  // Latest ending balance parsed from Gmail alert
  lastReportedAt?: string;       // ISO timestamp watermark of latest reported balance
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
  amount: number;                // Full wallet cash delta
  categoryId: string;
  walletId: string;
  toWalletId?: string;
  date: string;                  // YYYY-MM-DD
  timestamp?: string;            // ISO 8601 datetime for intraday ordering
  note: string;
  merchant?: string;
  source?: TxSource;
  gmailMessageId?: string;
  pairedGmailMessageId?: string; // Populated when 2 transfer emails merge into 1 transfer TX
  isAdjustment?: boolean;        // Silent wallet balance sync (excluded from income/expense stats)
  repaymentForTxId?: string;     // Incoming transfer settling an open split (excluded from income)
  linkedBillId?: string;
  split?: TxSplitInfo;
  originalAmount?: number;       // e.g. 20 (for $20 USD SaaS billed in VND)
  originalCurrency?: CurrencyCode;
}

export interface FinanceBudget {
  categoryId: string;
  monthlyLimit: number;
}

export type GmailEventRole = 'ledger' | 'transfer_hint' | 'merchant_receipt';

export interface GmailInboxItem {
  id: string;
  messageId: string;
  gmailId?: string;
  receivedAt: string;            // ISO 8601 timestamp
  sender: string;
  subject: string;
  bankBadge: string;             // e.g. "Timo *9012", "ACB *4821", "Grab", "VCB"
  eventRole: GmailEventRole;
  direction: 'in' | 'out';
  amount: number;                // Normalized in primary/wallet currency (VND integer or USD)
  currency: CurrencyCode;
  originalAmount?: number;
  originalCurrency?: CurrencyCode;
  reportedBalanceAfter?: number; // Parsed "Số dư cuối / Available balance" (null for credit cards)
  isCreditCard?: boolean;
  accountLast4?: string;
  paymentMethodHint?: string;    // e.g. "Visa 8821", "MoMo", "Cash" on merchant receipts
  rawSnippet: string;
  cleanMerchant: string;
  cleanMemo: string;
  suggestedType: TxType;
  suggestedWalletId: string;
  suggestedToWalletId?: string;
  suggestedCategoryId: string;
  matchedRuleId?: string;
  matchedBillId?: string;
  matchedSplitTxId?: string;     // Matches an open split/reimbursement waiting for repayment
  pairedInboxItemId?: string;    // Self-transfer twin in Inbox
  enrichedLedgerTxId?: string;   // Existing ledger TX that this merchant receipt enriches
  status: 'pending' | 'approved' | 'ignored';
}

export interface FinanceAutoRule {
  id: string;
  pattern: string;               // Case-insensitive substring matched against merchant/memo/sender
  direction?: 'in' | 'out';
  walletId?: string;
  categoryId: string;
  renameMerchantTo?: string;
  txType?: TxType;
  toWalletId?: string;
  autoApprove?: boolean;
}

export interface FinanceRecurringBill {
  id: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  cadence: 'monthly' | 'yearly';
  dueDay: number;                // 1..28
  categoryId: string;
  walletId: string;
  merchantPattern?: string;
  lastPaidCycleKey?: string;     // Cycle key (e.g. "2026-11") when marked paid
  active: boolean;
}

export interface QuickPreset {
  id: string;
  label: string;
  amount: number;
  categoryId: string;
  walletId?: string;
}

export interface FinanceState {
  wallets: FinanceWallet[];
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  inbox: GmailInboxItem[];
  rules: FinanceAutoRule[];
  recurringBills: FinanceRecurringBill[];
  quickPresets: QuickPreset[];
  paydayDay: number;             // 1..28 (salary cycle anchor day)
  usdVndRate: number;            // Reference FX rate for USD subscriptions/items (e.g. 25500)
}

/* ---------- Module 3+: Extensible Future Modules ---------- */
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
  | { kind: 'new-tx'; defaultType?: TxType; defaultWalletId?: string; defaultCategoryId?: string; defaultDate?: string }
  | { kind: 'new-wallet'; editWalletId?: string }
  | { kind: 'quick-log'; defaultWalletId?: string }
  | { kind: 'reconcile-wallet'; walletId: string; targetBalance?: number; inboxItemId?: string }
  | { kind: 'gmail-setup' }
  | { kind: 'manage-categories' }
  | { kind: 'manage-rules' }
  | { kind: 'new-bill'; editBillId?: string }
  | { kind: 'new-idea' }
  | null;

export interface ToastItem {
  id: string;
  message: string;
  undo?: () => void;
}

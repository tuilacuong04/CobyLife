import {
  AppSettings,
  FinanceCategory,
  FinanceWallet,
  FutureModuleIdea,
  PersistedAppState,
} from '../types';
import {
  DEFAULT_AUTO_RULES,
  DEFAULT_QUICK_PRESETS,
  DEFAULT_RECURRING_BILLS,
} from '../utils/financeEngine';
import { addDaysIso, currentMonthKey, localIsoDate, shiftMonthKey } from '../utils/format';

export const DEFAULT_FINANCE_CATEGORIES: FinanceCategory[] = [
  { id: 'cat-food', name: 'Food & Dining', kind: 'expense', tone: 'coral', badge: 'FD' },
  { id: 'cat-health', name: 'Health & Care', kind: 'expense', tone: 'lime', badge: 'HC' },
  { id: 'cat-move', name: 'Transport', kind: 'expense', tone: 'sky', badge: 'TR' },
  { id: 'cat-home', name: 'Housing & Bills', kind: 'expense', tone: 'sand', badge: 'HB' },
  { id: 'cat-shop', name: 'Shopping', kind: 'expense', tone: 'coral', badge: 'SH' },
  { id: 'cat-play', name: 'Leisure & Coffee', kind: 'expense', tone: 'sky', badge: 'LC' },
  { id: 'cat-study', name: 'Learning & Books', kind: 'expense', tone: 'lime', badge: 'LB' },
  { id: 'cat-other-exp', name: 'Other', kind: 'expense', tone: 'sand', badge: 'OT' },
  { id: 'cat-salary', name: 'Salary', kind: 'income', tone: 'lime', badge: 'SL' },
  { id: 'cat-freelance', name: 'Freelance', kind: 'income', tone: 'sky', badge: 'FL' },
  { id: 'cat-bonus', name: 'Bonus / Invest', kind: 'income', tone: 'sand', badge: 'IN' },
];

export const DEFAULT_WALLETS: FinanceWallet[] = [
  {
    id: 'w-bank',
    name: 'Main Bank',
    kind: 'bank',
    initialBalance: 18500000,
    tone: 'sky',
    accountHint: '9012',
    note: 'Primary checking & salary account',
  },
  {
    id: 'w-ewallet',
    name: 'E-Wallet (MoMo)',
    kind: 'ewallet',
    initialBalance: 16800000,
    tone: 'coral',
    note: 'Daily coffee, meals & quick QR payments',
  },
  {
    id: 'w-cash',
    name: 'Cash',
    kind: 'cash',
    initialBalance: 3900000,
    tone: 'sand',
    note: 'Everyday pocket cash',
  },
  {
    id: 'w-save',
    name: 'Savings Vault',
    kind: 'savings',
    initialBalance: 35000000,
    tone: 'lime',
    note: 'Emergency reserve & long-term goals',
  },
];

export const DEFAULT_FUTURE_IDEAS: FutureModuleIdea[] = [
  {
    id: 'idea-habits',
    name: 'Daily Habits',
    description: 'Track streaks for hydration, sleep schedule, stretching, and daily reading.',
    category: 'Lifestyle',
    priority: 'high',
    tone: 'lime',
  },
  {
    id: 'idea-notes',
    name: 'Second Brain Notes',
    description: 'Fast Markdown scratchpad for personal ideas, bookmarks, and study summaries.',
    category: 'Knowledge',
    priority: 'high',
    tone: 'sky',
  },
  {
    id: 'idea-subscriptions',
    name: 'Recurring Bills & Subscriptions',
    description: 'Calendar reminders and annual cost breakdown for internet, cloud, and media.',
    category: 'Finance',
    priority: 'medium',
    tone: 'sand',
  },
  {
    id: 'idea-reading',
    name: 'Books & Courses',
    description: 'Track reading progress, chapter takeaways, and personal learning milestones.',
    category: 'Growth',
    priority: 'low',
    tone: 'coral',
  },
];

function monthDay(monthKey: string, day: number): string {
  const safeDay = Math.min(Math.max(1, day), 28);
  return `${monthKey}-${String(safeDay).padStart(2, '0')}`;
}

function createDefaultSettings(): AppSettings {
  return {
    theme: 'dark',
    currency: 'VND',
    weekStartsOn: 'monday',
    pinEnabled: false,
    pinCode: '1234',
    profile: {
      name: 'Cuong',
      tagline: 'Coby LIFE · Personal OS',
      avatar: '/images/rep-luca.svg',
    },
    enabledModules: {
      tasks: true,
      finance: true,
    },
  };
}

export function createDemoSampleState(): PersistedAppState {
  const today = localIsoDate();
  const curM = currentMonthKey();
  const prev1 = shiftMonthKey(curM, -1);
  const prev2 = shiftMonthKey(curM, -2);
  const prev3 = shiftMonthKey(curM, -3);

  return {
    version: 3,
    tasks: [
      {
        id: 't-1',
        title: 'Review personal project milestones & clear inbox',
        notes: 'Finish top priority items and reply to pending messages before noon.',
        status: 'doing',
        priority: 'high',
        category: 'work',
        dueDate: today,
        dueTime: '10:30',
        recurrence: 'daily',
        pinned: true,
        subtasks: [
          { id: 'st-1', title: 'Triage unread emails & messages', done: true },
          { id: 'st-2', title: 'Ship priority deliverable for today', done: false },
          { id: 'st-3', title: 'Plan tomorrow’s top 3 tasks', done: false },
        ],
        createdAt: addDaysIso(today, -2),
      },
      {
        id: 't-2',
        title: 'Weekly expense check & food budget review',
        notes: 'Reconcile MoMo and bank balances and catch any unlogged meals.',
        status: 'todo',
        priority: 'medium',
        category: 'finance',
        dueDate: today,
        dueTime: '21:00',
        recurrence: 'weekly',
        pinned: false,
        subtasks: [
          { id: 'st-4', title: 'Log missing lunches & coffee receipts', done: false },
          { id: 'st-5', title: 'Check monthly budget progress', done: false },
        ],
        createdAt: addDaysIso(today, -1),
      },
      {
        id: 't-3',
        title: 'Morning walk & 15-min posture stretch',
        notes: 'Step outside for morning sunlight, hydration, and neck/shoulder mobility.',
        status: 'todo',
        priority: 'medium',
        category: 'health',
        dueDate: today,
        dueTime: '07:30',
        recurrence: 'daily',
        pinned: true,
        subtasks: [],
        createdAt: addDaysIso(today, -3),
      },
      {
        id: 't-4',
        title: 'Restock coffee beans, fruit & household supplies',
        notes: 'Pick up weekly groceries and kitchen essentials.',
        status: 'todo',
        priority: 'medium',
        category: 'personal',
        dueDate: addDaysIso(today, 2),
        recurrence: 'weekly',
        pinned: false,
        subtasks: [],
        createdAt: addDaysIso(today, -1),
      },
      {
        id: 't-5',
        title: 'Read 20 pages & capture 3 key notes',
        notes: 'Keep evening reading habit consistent.',
        status: 'todo',
        priority: 'low',
        category: 'study',
        dueDate: addDaysIso(today, 1),
        dueTime: '22:00',
        recurrence: 'daily',
        pinned: false,
        subtasks: [],
        createdAt: addDaysIso(today, -4),
      },
      {
        id: 't-6',
        title: 'Pay utilities & internet bills',
        notes: 'Paid via main bank transfer.',
        status: 'done',
        priority: 'high',
        category: 'finance',
        dueDate: addDaysIso(today, -2),
        recurrence: 'monthly',
        pinned: false,
        subtasks: [],
        createdAt: addDaysIso(today, -7),
        completedAt: addDaysIso(today, -2),
      },
      {
        id: 't-7',
        title: 'Back up personal documents & monthly archive',
        notes: 'Synced important PDFs and receipts.',
        status: 'done',
        priority: 'medium',
        category: 'personal',
        dueDate: addDaysIso(today, -1),
        recurrence: 'monthly',
        pinned: false,
        subtasks: [],
        createdAt: addDaysIso(today, -5),
        completedAt: addDaysIso(today, -1),
      },
    ],
    finance: {
      wallets: DEFAULT_WALLETS,
      categories: DEFAULT_FINANCE_CATEGORIES,
      budgets: [
        { categoryId: 'cat-food', monthlyLimit: 4500000 },
        { categoryId: 'cat-home', monthlyLimit: 4000000 },
        { categoryId: 'cat-shop', monthlyLimit: 2000000 },
        { categoryId: 'cat-play', monthlyLimit: 1500000 },
        { categoryId: 'cat-move', monthlyLimit: 1200000 },
        { categoryId: 'cat-health', monthlyLimit: 1200000 },
      ],
      transactions: [
        { id: 'tx-1', type: 'income', amount: 24000000, categoryId: 'cat-salary', walletId: 'w-bank', date: monthDay(curM, 1), note: 'Monthly salary' },
        { id: 'tx-2', type: 'expense', amount: 3800000, categoryId: 'cat-home', walletId: 'w-bank', date: monthDay(curM, 2), note: 'Rent & utilities' },
        { id: 'tx-3', type: 'expense', amount: 650000, categoryId: 'cat-health', walletId: 'w-bank', date: monthDay(curM, 3), note: 'Vitamins & pharmacy supplies' },
        { id: 'tx-4', type: 'transfer', amount: 5000000, categoryId: 'cat-other-exp', walletId: 'w-bank', toWalletId: 'w-save', date: monthDay(curM, 4), note: 'Monthly savings transfer' },
        { id: 'tx-5', type: 'expense', amount: 650000, categoryId: 'cat-food', walletId: 'w-ewallet', date: addDaysIso(today, -4), note: 'Weekly groceries & fresh produce' },
        { id: 'tx-6', type: 'expense', amount: 185000, categoryId: 'cat-move', walletId: 'w-cash', date: addDaysIso(today, -3), note: 'Fuel & parking' },
        { id: 'tx-7', type: 'expense', amount: 95000, categoryId: 'cat-play', walletId: 'w-ewallet', date: addDaysIso(today, -2), note: 'Weekend coffee & coworking' },
        { id: 'tx-8', type: 'expense', amount: 140000, categoryId: 'cat-food', walletId: 'w-ewallet', date: addDaysIso(today, -1), note: 'Lunch & iced tea' },
        { id: 'tx-9', type: 'income', amount: 3500000, categoryId: 'cat-freelance', walletId: 'w-bank', date: addDaysIso(today, -2), note: 'Freelance project payout' },
        { id: 'tx-10', type: 'expense', amount: 55000, categoryId: 'cat-food', walletId: 'w-cash', date: today, note: 'Breakfast & black coffee' },
        { id: 'tx-p1-1', type: 'income', amount: 24000000, categoryId: 'cat-salary', walletId: 'w-bank', date: monthDay(prev1, 1), note: 'Monthly salary' },
        { id: 'tx-p1-2', type: 'expense', amount: 3900000, categoryId: 'cat-home', walletId: 'w-bank', date: monthDay(prev1, 3), note: 'Rent & bills' },
        { id: 'tx-p1-3', type: 'expense', amount: 4100000, categoryId: 'cat-food', walletId: 'w-ewallet', date: monthDay(prev1, 14), note: 'Monthly dining & groceries' },
        { id: 'tx-p1-4', type: 'expense', amount: 850000, categoryId: 'cat-health', walletId: 'w-bank', date: monthDay(prev1, 10), note: 'Dental checkup & care' },
        { id: 'tx-p1-5', type: 'expense', amount: 1450000, categoryId: 'cat-shop', walletId: 'w-bank', date: monthDay(prev1, 19), note: 'Everyday apparel & desk gear' },
        { id: 'tx-p1-6', type: 'expense', amount: 980000, categoryId: 'cat-move', walletId: 'w-cash', date: monthDay(prev1, 22), note: 'Commute & fuel' },
        { id: 'tx-p2-1', type: 'income', amount: 25500000, categoryId: 'cat-salary', walletId: 'w-bank', date: monthDay(prev2, 1), note: 'Salary + bonus' },
        { id: 'tx-p2-2', type: 'expense', amount: 3850000, categoryId: 'cat-home', walletId: 'w-bank', date: monthDay(prev2, 4), note: 'Rent & internet' },
        { id: 'tx-p2-3', type: 'expense', amount: 3750000, categoryId: 'cat-food', walletId: 'w-ewallet', date: monthDay(prev2, 15), note: 'Daily meals & groceries' },
        { id: 'tx-p2-4', type: 'expense', amount: 720000, categoryId: 'cat-health', walletId: 'w-bank', date: monthDay(prev2, 11), note: 'Health supplies & vitamins' },
        { id: 'tx-p2-5', type: 'expense', amount: 1320000, categoryId: 'cat-play', walletId: 'w-ewallet', date: monthDay(prev2, 21), note: 'Dinner with friends' },
        { id: 'tx-p3-1', type: 'income', amount: 23500000, categoryId: 'cat-salary', walletId: 'w-bank', date: monthDay(prev3, 1), note: 'Monthly salary' },
        { id: 'tx-p3-2', type: 'expense', amount: 3700000, categoryId: 'cat-home', walletId: 'w-bank', date: monthDay(prev3, 5), note: 'Rent & utilities' },
        { id: 'tx-p3-3', type: 'expense', amount: 4300000, categoryId: 'cat-food', walletId: 'w-ewallet', date: monthDay(prev3, 16), note: 'Food & groceries' },
        { id: 'tx-p3-4', type: 'expense', amount: 1100000, categoryId: 'cat-study', walletId: 'w-bank', date: monthDay(prev3, 18), note: 'Books & online course' },
        { id: 'tx-p3-5', type: 'expense', amount: 1200000, categoryId: 'cat-move', walletId: 'w-cash', date: monthDay(prev3, 24), note: 'Fuel & transport' },
      ],
      inbox: [],
      rules: DEFAULT_AUTO_RULES,
      recurringBills: DEFAULT_RECURRING_BILLS,
      quickPresets: DEFAULT_QUICK_PRESETS,
      paydayDay: 1,
      usdVndRate: 25500,
    },
    futureModules: DEFAULT_FUTURE_IDEAS,
    settings: createDefaultSettings(),
  };
}

export function createEmptyPersonalState(): PersistedAppState {
  return {
    version: 3,
    tasks: [],
    finance: {
      wallets: [
        { id: 'w-bank', name: 'Main Bank', kind: 'bank', initialBalance: 0, tone: 'sky' },
        { id: 'w-cash', name: 'Cash', kind: 'cash', initialBalance: 0, tone: 'sand' },
      ],
      categories: DEFAULT_FINANCE_CATEGORIES,
      transactions: [],
      budgets: [],
      inbox: [],
      rules: DEFAULT_AUTO_RULES,
      recurringBills: [],
      quickPresets: DEFAULT_QUICK_PRESETS,
      paydayDay: 1,
      usdVndRate: 25500,
    },
    futureModules: [],
    settings: createDefaultSettings(),
  };
}

export function createStarterState(): PersistedAppState {
  return createEmptyPersonalState();
}

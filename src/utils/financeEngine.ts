import {
  FinanceAutoRule,
  FinanceRecurringBill,
  FinanceState,
  FinanceTransaction,
  FinanceWallet,
  GmailInboxItem,
  QuickPreset,
  TxType,
} from '../types';
import { addDaysIso, formatMonthShort, localIsoDate } from './format';
import { ParsedGmailAlert } from './vnGmailParser';

export const DEFAULT_AUTO_RULES: FinanceAutoRule[] = [
  {
    id: 'rule-coffee',
    pattern: 'HIGHLANDS',
    direction: 'out',
    categoryId: 'cat-play',
    renameMerchantTo: 'Highlands Coffee',
  },
  {
    id: 'rule-phuclong',
    pattern: 'PHUC LONG',
    direction: 'out',
    categoryId: 'cat-play',
    renameMerchantTo: 'Phuc Long',
  },
  {
    id: 'rule-grabfood',
    pattern: 'GRABFOOD',
    direction: 'out',
    categoryId: 'cat-food',
    renameMerchantTo: 'GrabFood',
  },
  {
    id: 'rule-grab',
    pattern: 'GRAB',
    direction: 'out',
    categoryId: 'cat-move',
    renameMerchantTo: 'Grab',
  },
  {
    id: 'rule-xanhsm',
    pattern: 'XANH SM',
    direction: 'out',
    categoryId: 'cat-move',
    renameMerchantTo: 'Xanh SM',
  },
  {
    id: 'rule-saas',
    pattern: 'CURSOR',
    direction: 'out',
    categoryId: 'cat-study',
    renameMerchantTo: 'Cursor AI',
  },
  {
    id: 'rule-openai',
    pattern: 'OPENAI',
    direction: 'out',
    categoryId: 'cat-study',
    renameMerchantTo: 'OpenAI ChatGPT',
  },
  {
    id: 'rule-evn',
    pattern: 'EVN',
    direction: 'out',
    categoryId: 'cat-home',
    renameMerchantTo: 'EVN Electricity',
  },
  {
    id: 'rule-salary',
    pattern: 'SALARY',
    direction: 'in',
    categoryId: 'cat-salary',
    renameMerchantTo: 'Monthly Salary',
  },
];

export const DEFAULT_QUICK_PRESETS: QuickPreset[] = [
  { id: 'qp-park', label: 'Parking', amount: 5000, categoryId: 'cat-move' },
  { id: 'qp-tea', label: 'Iced Tea / Water', amount: 15000, categoryId: 'cat-play' },
  { id: 'qp-bfast', label: 'Breakfast', amount: 35000, categoryId: 'cat-food' },
  { id: 'qp-coffee', label: 'Coffee', amount: 45000, categoryId: 'cat-play' },
  { id: 'qp-lunch', label: 'Lunch', amount: 55000, categoryId: 'cat-food' },
  { id: 'qp-fuel', label: 'Fuel', amount: 70000, categoryId: 'cat-move' },
];

export const DEFAULT_RECURRING_BILLS: FinanceRecurringBill[] = [
  {
    id: 'bill-rent',
    name: 'Apartment Rent',
    amount: 3800000,
    currency: 'VND',
    cadence: 'monthly',
    dueDay: 5,
    categoryId: 'cat-home',
    walletId: 'w-bank',
    merchantPattern: 'RENT',
    active: true,
  },
  {
    id: 'bill-internet',
    name: 'Fiber Internet & Mobile',
    amount: 260000,
    currency: 'VND',
    cadence: 'monthly',
    dueDay: 12,
    categoryId: 'cat-home',
    walletId: 'w-bank',
    merchantPattern: 'FPT',
    active: true,
  },
  {
    id: 'bill-cursor',
    name: 'Cursor / AI Pro ($20)',
    amount: 20,
    currency: 'USD',
    cadence: 'monthly',
    dueDay: 18,
    categoryId: 'cat-study',
    walletId: 'w-bank',
    merchantPattern: 'CURSOR',
    active: true,
  },
  {
    id: 'bill-icloud',
    name: 'Apple iCloud+',
    amount: 69000,
    currency: 'VND',
    cadence: 'monthly',
    dueDay: 24,
    categoryId: 'cat-home',
    walletId: 'w-ewallet',
    merchantPattern: 'APPLE',
    active: true,
  },
];

export interface BankGmailGuideItem {
  name: string;
  tier: 'Tier 1 · Full 2-Way' | 'Tier 2 · Outgoing & Cards' | 'Tier 3 · E-Receipt Only';
  tone: 'lime' | 'sky' | 'sand';
  coverage: string;
  howToEnable: string;
}

export const VN_BANK_GMAIL_GUIDE: BankGmailGuideItem[] = [
  {
    name: 'Timo by BVBank',
    tier: 'Tier 1 · Full 2-Way',
    tone: 'lime',
    coverage: '100% free incoming (+) & outgoing (-) Spend Account + Visa + ending balance.',
    howToEnable: 'Web my.timo.vn or App → Settings → Notifications → Toggle Email ON.',
  },
  {
    name: 'ACB',
    tier: 'Tier 1 · Full 2-Way',
    tone: 'lime',
    coverage: 'Both incoming (+) & outgoing (-) CASA balance alerts + Credit/Debit Cards.',
    howToEnable: 'ACB ONE → More → Settings → Notification Settings → Balance Email Alert.',
  },
  {
    name: 'Sacombank & HSBC VN',
    tier: 'Tier 1 · Full 2-Way',
    tone: 'lime',
    coverage: 'Full CASA & Card transaction email alerts.',
    howToEnable: 'Sacombank Pay (Alert → tick Email) / HSBC Online Notification Preferences.',
  },
  {
    name: 'VCB, TPBank, VIB, VPBank, Cake, BIDV, UOB',
    tier: 'Tier 2 · Outgoing & Cards',
    tone: 'sky',
    coverage: '100% Credit/Intl Card charges + Outgoing online transfer HTML receipts.',
    howToEnable: 'Verify email in Profile & enable Transfer Receipts / Card Email Alerts.',
  },
  {
    name: 'Grab, Xanh SM, Be, MoMo, Apple, Shopee',
    tier: 'Tier 1 · Full 2-Way',
    tone: 'lime',
    coverage: 'Instant e-receipts in Gmail (auto-merged with bank alerts so zero double-count).',
    howToEnable: 'Verify Gmail address in Grab / Be / MoMo / Apple ID profile.',
  },
  {
    name: 'Techcombank & MB Bank (Retail)',
    tier: 'Tier 3 · E-Receipt Only',
    tone: 'sand',
    coverage: 'Only monthly statements on Gmail; pair with Grab/MoMo receipts + +Quick Log.',
    howToEnable: 'Use Quick Log (000 keypad) or route card/daily spend via Tier 1/2.',
  },
];

/* ======================= Payday Cycle Math ======================= */

export interface CycleRange {
  cycleKey: string; // YYYY-MM (named by start month when paydayDay > 1, or calendar month when 1)
  startIso: string; // YYYY-MM-DD inclusive
  endIso: string;   // YYYY-MM-DD inclusive
  label: string;    // e.g. "Nov 2026" or "Oct 25 – Nov 24"
  shortLabel: string;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  isCurrent: boolean;
}

function clampPayday(day?: number): number {
  if (!day || !Number.isFinite(day)) return 1;
  return Math.min(28, Math.max(1, Math.round(day)));
}

function daysBetweenInclusive(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const s = Date.UTC(sy, (sm || 1) - 1, sd || 1);
  const e = Date.UTC(ey, (em || 1) - 1, ed || 1);
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

export function currentCycleKey(now = new Date(), paydayDay = 1): string {
  const p = clampPayday(paydayDay);
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (p === 1) {
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  // If today is before paydayDay (e.g. Nov 10 when payday is 25), cycle started in Oct!
  if (d < p) {
    const prev = new Date(y, m - 2, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getCycleRange(cycleKey: string, paydayDay = 1, todayIso = localIsoDate()): CycleRange {
  const p = clampPayday(paydayDay);
  const [y, m] = cycleKey.split('-').map(Number);
  const year = y || new Date().getFullYear();
  const monthIdx = (m || 1) - 1;

  let startIso: string;
  let endIso: string;
  let label: string;
  let shortLabel: string;

  if (p === 1) {
    const startDt = new Date(year, monthIdx, 1);
    const endDt = new Date(year, monthIdx + 1, 0);
    startIso = localIsoDate(startDt);
    endIso = localIsoDate(endDt);
    shortLabel = formatMonthShort(cycleKey);
    label = `${shortLabel} ${year}`;
  } else {
    const startDt = new Date(year, monthIdx, p);
    const nextStartDt = new Date(year, monthIdx + 1, p);
    const endDt = new Date(nextStartDt.getFullYear(), nextStartDt.getMonth(), nextStartDt.getDate() - 1);
    startIso = localIsoDate(startDt);
    endIso = localIsoDate(endDt);
    const sKey = `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}`;
    const eKey = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, '0')}`;
    shortLabel = `${formatMonthShort(sKey)} ${p}`;
    label = `${formatMonthShort(sKey)} ${p} – ${formatMonthShort(eKey)} ${endDt.getDate()}`;
  }

  const daysTotal = daysBetweenInclusive(startIso, endIso);
  const isCurrent = todayIso >= startIso && todayIso <= endIso;
  let daysElapsed = daysTotal;
  let daysRemaining = 0;

  if (isCurrent) {
    daysElapsed = daysBetweenInclusive(startIso, todayIso);
    daysRemaining = Math.max(1, daysTotal - daysElapsed + 1);
  } else if (todayIso < startIso) {
    daysElapsed = 0;
    daysRemaining = daysTotal;
  }

  return {
    cycleKey,
    startIso,
    endIso,
    label,
    shortLabel,
    daysTotal,
    daysElapsed,
    daysRemaining,
    isCurrent,
  };
}

export function isTxInCycle(tx: FinanceTransaction, range: CycleRange): boolean {
  return tx.date >= range.startIso && tx.date <= range.endIso;
}

/* ======================= Net Personal Expense & Income Helpers ======================= */

/**
 * Returns the personal budget-impacting expense amount:
 * - Excludes transfers, income, and silent balance reconciliation adjustments.
 * - Uses `tx.split.myShare` when splitting a group bill ("ứng hộ") so personal budgets stay pure!
 */
export function getEffectiveExpense(tx: FinanceTransaction): number {
  if (tx.type !== 'expense' || tx.isAdjustment) return 0;
  if (tx.split) return Math.max(0, tx.split.myShare);
  return tx.amount;
}

/**
 * Returns true personal income (excludes friend split repayments & silent adjustments).
 */
export function getEffectiveIncome(tx: FinanceTransaction): number {
  if (tx.type !== 'income' || tx.isAdjustment || tx.repaymentForTxId) return 0;
  return tx.amount;
}

export interface SafeToSpendMetrics {
  totalBudget: number;
  budgetedSpent: number;
  totalPersonalExpense: number;
  unpaidBillsTotal: number;
  remainingPool: number;
  safeToday: number;
  paceStatus: 'on-pace' | 'watch' | 'over-pace' | 'unbudgeted';
  idealPct: number;
  actualPct: number;
  openReimbursementsTotal: number;
  openReimbursementsCount: number;
}

export function computeSafeToSpend(
  finance: FinanceState,
  range: CycleRange
): SafeToSpendMetrics {
  const budgetMap = new Map(finance.budgets.map((b) => [b.categoryId, b.monthlyLimit]));
  const totalBudget = finance.budgets.reduce((s, b) => s + b.monthlyLimit, 0);

  let budgetedSpent = 0;
  let totalPersonalExpense = 0;

  for (const tx of finance.transactions) {
    if (!isTxInCycle(tx, range)) continue;
    const exp = getEffectiveExpense(tx);
    if (exp <= 0) continue;
    totalPersonalExpense += exp;
    if (budgetMap.has(tx.categoryId)) {
      budgetedSpent += exp;
    }
  }

  // Sum active recurring bills not yet paid in this cycle
  const usdRate = finance.usdVndRate || 25500;
  let unpaidBillsTotal = 0;
  for (const bill of finance.recurringBills || []) {
    if (!bill.active) continue;
    if (bill.lastPaidCycleKey === range.cycleKey) continue;
    const amtVnd = bill.currency === 'USD' ? Math.round(bill.amount * usdRate) : bill.amount;
    const monthlyEq = bill.cadence === 'yearly' ? Math.round(amtVnd / 12) : amtVnd;
    unpaidBillsTotal += monthlyEq;
  }

  // Open reimbursements ("đang ứng hộ") across all time
  let openReimbursementsTotal = 0;
  let openReimbursementsCount = 0;
  for (const tx of finance.transactions) {
    if (tx.split && tx.split.status === 'open') {
      const owed = Math.max(0, tx.split.reimbursable - tx.split.repaidAmount);
      if (owed > 0) {
        openReimbursementsTotal += owed;
        openReimbursementsCount++;
      }
    }
  }

  if (totalBudget <= 0) {
    return {
      totalBudget: 0,
      budgetedSpent,
      totalPersonalExpense,
      unpaidBillsTotal,
      remainingPool: 0,
      safeToday: 0,
      paceStatus: 'unbudgeted',
      idealPct: 0,
      actualPct: 0,
      openReimbursementsTotal,
      openReimbursementsCount,
    };
  }

  // Compare budgeted spending against total budgeted limit (fixes unbudgeted category inflation bug!)
  const remainingPool = Math.max(0, totalBudget - budgetedSpent);
  const divisorDays = range.isCurrent ? Math.max(1, range.daysRemaining) : Math.max(1, range.daysTotal);
  const safeToday = Math.floor(remainingPool / divisorDays);

  const idealPct = Math.round((range.daysElapsed / Math.max(1, range.daysTotal)) * 100);
  const actualPct = Math.round((budgetedSpent / totalBudget) * 100);

  let paceStatus: SafeToSpendMetrics['paceStatus'] = 'on-pace';
  if (actualPct > 100 || actualPct - idealPct > 14) {
    paceStatus = 'over-pace';
  } else if (actualPct - idealPct > 4) {
    paceStatus = 'watch';
  }

  return {
    totalBudget,
    budgetedSpent,
    totalPersonalExpense,
    unpaidBillsTotal,
    remainingPool,
    safeToday,
    paceStatus,
    idealPct,
    actualPct,
    openReimbursementsTotal,
    openReimbursementsCount,
  };
}

/* ======================= Wallet Drift Detection ======================= */

export interface WalletDriftInfo {
  walletId: string;
  computedBalance: number;
  reportedBalance: number;
  reportedAt: string;
  drift: number; // reportedBalance - expectedBalance (negative = unlogged expense!)
  sourceInboxId?: string;
}

export function detectAllWalletDrifts(
  wallets: FinanceWallet[],
  walletBalances: Record<string, number>,
  pendingInbox: GmailInboxItem[]
): Record<string, WalletDriftInfo> {
  const result: Record<string, WalletDriftInfo> = {};

  for (const w of wallets) {
    if (w.kind === 'card') continue;
    const computed = walletBalances[w.id] ?? w.initialBalance;

    // Check newest pending inbox item for this wallet that carries reportedBalanceAfter
    const walletInbox = pendingInbox
      .filter((item) => item.status === 'pending' && item.suggestedWalletId === w.id)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

    const latestWithBal = [...walletInbox]
      .reverse()
      .find((item) => typeof item.reportedBalanceAfter === 'number');

    if (latestWithBal && typeof latestWithBal.reportedBalanceAfter === 'number') {
      // Account for pending inbox deltas up through latestWithBal
      let pendingDelta = 0;
      for (const item of walletInbox) {
        if (item.receivedAt > latestWithBal.receivedAt) break;
        pendingDelta += item.direction === 'in' ? item.amount : -item.amount;
      }
      const expectedAfterPending = computed + pendingDelta;
      const drift = Math.round(latestWithBal.reportedBalanceAfter - expectedAfterPending);
      if (Math.abs(drift) >= 1000) {
        result[w.id] = {
          walletId: w.id,
          computedBalance: expectedAfterPending,
          reportedBalance: latestWithBal.reportedBalanceAfter,
          reportedAt: latestWithBal.receivedAt,
          drift,
          sourceInboxId: latestWithBal.id,
        };
        continue;
      }
    }

    if (typeof w.lastReportedBalance === 'number') {
      const drift = Math.round(w.lastReportedBalance - computed);
      if (Math.abs(drift) >= 1000) {
        result[w.id] = {
          walletId: w.id,
          computedBalance: computed,
          reportedBalance: w.lastReportedBalance,
          reportedAt: w.lastReportedAt || '',
          drift,
        };
      }
    }
  }

  return result;
}

/* ======================= Inbox Matching, Rules & Deduplication ======================= */

function inferDefaultWallet(alert: ParsedGmailAlert, wallets: FinanceWallet[]): FinanceWallet | undefined {
  // 1. Match by last-4 accountHint
  if (alert.accountLast4) {
    const byHint = wallets.find(
      (w) => w.accountHint && w.accountHint.trim().slice(-4) === alert.accountLast4
    );
    if (byHint) return byHint;
  }

  // 2. Match by explicit Cash payment hint on merchant receipts
  if (alert.paymentMethodHint && /\b(cash|tiền\s*mặt|cod)\b/i.test(alert.paymentMethodHint)) {
    return wallets.find((w) => w.kind === 'cash') || wallets[0];
  }

  // 3. Match by MoMo / E-Wallet hint
  if (
    alert.bankCode === 'MOMO' ||
    alert.bankCode === 'ZALOPAY' ||
    alert.bankCode === 'SHOPEEPAY' ||
    (alert.paymentMethodHint && /\b(momo|zalopay|shopeepay)\b/i.test(alert.paymentMethodHint))
  ) {
    return (
      wallets.find((w) => w.kind === 'ewallet' || /momo|zalo|wallet/i.test(w.name)) || wallets[0]
    );
  }

  // 4. Match by bankCode or credit card
  if (alert.bankCode) {
    const byBank = wallets.find(
      (w) =>
        (w.bankCode && w.bankCode.toUpperCase() === alert.bankCode) ||
        w.name.toUpperCase().includes(alert.bankCode)
    );
    if (byBank) return byBank;
  }

  if (alert.isCreditCard) {
    return wallets.find((w) => w.kind === 'card') || wallets.find((w) => w.kind === 'bank') || wallets[0];
  }

  return wallets.find((w) => w.kind === 'bank') || wallets[0];
}

function inferHeuristicCategory(alert: ParsedGmailAlert, finance: FinanceState): string {
  const hay = `${alert.cleanMerchant} ${alert.cleanMemo} ${alert.subject}`.toUpperCase();
  const findCat = (id: string, kind: 'expense' | 'income') =>
    finance.categories.find((c) => c.id === id)?.id ||
    finance.categories.find((c) => c.kind === kind)?.id ||
    '';

  if (alert.direction === 'in') {
    if (/LUONG|SALARY|PAYROLL/.test(hay)) return findCat('cat-salary', 'income');
    if (/FREELANCE|UPWORK|PAYOUT|CLIENT/.test(hay)) return findCat('cat-freelance', 'income');
    return findCat('cat-bonus', 'income');
  }

  if (/HIGHLANDS|PHUC LONG|KATINAT|STARBUCKS|CAFE|COFFEE|TRA SUA|CINEMA|CGV|SPOTIFY|NETFLIX/.test(hay)) {
    return findCat('cat-play', 'expense');
  }
  if (/GRABFOOD|SHOPEEFOOD|COM TAM|PHO|BUN|LAU|NUONG|AN TRUA|AN TOI|WINMART|BACH HOA XANH|GROCER/.test(hay)) {
    return findCat('cat-food', 'expense');
  }
  if (/GRAB|XANH SM|\bBE\b|TAXI|FUEL|XANG|PARKING|GUI XE/.test(hay)) {
    return findCat('cat-move', 'expense');
  }
  if (/RENT|TIEN NHA|EVN|DIEN|NUOC|INTERNET|FPT|VIETTEL|VNPT|ICLOUD/.test(hay)) {
    return findCat('cat-home', 'expense');
  }
  if (/CURSOR|OPENAI|CHATGPT|CLAUDE|UDEMY|COURSERA|BOOK/.test(hay)) {
    return findCat('cat-study', 'expense');
  }
  if (/SHOPEE|LAZADA|UNIQLO|ZARA|TIKI/.test(hay)) {
    return findCat('cat-shop', 'expense');
  }
  if (/PHARMACY|THUOC|CLINIC|HOSPITAL|DENTAL|VITAMIN|WHEY|GYM|PROTEIN/.test(hay)) {
    return findCat('cat-health', 'expense');
  }

  return findCat('cat-other-exp', 'expense');
}

/**
 * Converts parsed Gmail alerts into smart GmailInboxItems, applying:
 * 1. Message-ID deduplication against existing Ledger & Inbox
 * 2. User Auto-Rules (merchant rename + category + optional auto-transfer)
 * 3. Self-Transfer detection (`NAP TIEN VI MOMO` or two-sided opposite alerts within ±20m)
 * 4. Merchant Receipt enrichment matching (prevents double-counting Grab/Apple on digital cards)
 * 5. Recurring Bill matching & Open Split Reimbursement matching
 */
export function buildSmartInboxItems(
  alerts: ParsedGmailAlert[],
  finance: FinanceState,
  uidFn: (prefix: string) => string
): GmailInboxItem[] {
  const existingMsgIds = new Set<string>();
  for (const tx of finance.transactions) {
    if (tx.gmailMessageId) existingMsgIds.add(tx.gmailMessageId);
    if (tx.pairedGmailMessageId) existingMsgIds.add(tx.pairedGmailMessageId);
  }
  for (const item of finance.inbox) {
    existingMsgIds.add(item.messageId);
  }

  const cycleKey = currentCycleKey(new Date(), finance.paydayDay || 1);
  const items: GmailInboxItem[] = [];

  for (const alert of alerts) {
    if (existingMsgIds.has(alert.messageId)) continue;
    existingMsgIds.add(alert.messageId);

    const matchedWallet = inferDefaultWallet(alert, finance.wallets);
    let suggestedWalletId = matchedWallet?.id || finance.wallets[0]?.id || '';
    let suggestedToWalletId: string | undefined;
    let suggestedType: TxType = alert.direction === 'in' ? 'income' : 'expense';
    let suggestedCategoryId = inferHeuristicCategory(alert, finance);
    let cleanMerchant = alert.cleanMerchant;
    let matchedRuleId: string | undefined;

    // Pass-through wallet top-up heuristic (e.g. Bank -> MoMo)
    if (alert.eventRole === 'transfer_hint') {
      const ewallet = finance.wallets.find(
        (w) => w.id !== suggestedWalletId && (w.kind === 'ewallet' || /momo|zalo/i.test(w.name))
      );
      const cashWallet = finance.wallets.find((w) => w.id !== suggestedWalletId && w.kind === 'cash');
      const target = /atm/i.test(alert.cleanMemo) ? cashWallet : ewallet;
      if (target) {
        suggestedType = 'transfer';
        suggestedToWalletId = target.id;
      }
    }

    // Apply user Auto-Rules in order
    const searchHay = `${alert.cleanMerchant} ${alert.cleanMemo} ${alert.rawSnippet} ${alert.sender}`.toUpperCase();
    for (const rule of finance.rules || []) {
      const pat = rule.pattern.trim().toUpperCase();
      if (!pat || !searchHay.includes(pat)) continue;
      if (rule.direction && rule.direction !== alert.direction) continue;
      matchedRuleId = rule.id;
      if (rule.categoryId) suggestedCategoryId = rule.categoryId;
      if (rule.walletId && finance.wallets.some((w) => w.id === rule.walletId)) {
        suggestedWalletId = rule.walletId;
      }
      if (rule.renameMerchantTo) cleanMerchant = rule.renameMerchantTo;
      if (rule.txType) {
        suggestedType = rule.txType;
        if (rule.txType === 'transfer' && rule.toWalletId) {
          suggestedToWalletId = rule.toWalletId;
        }
      }
      break;
    }

    // Match Recurring Bill
    let matchedBillId: string | undefined;
    if (alert.direction === 'out') {
      const bill = (finance.recurringBills || []).find((b) => {
        if (!b.active || b.lastPaidCycleKey === cycleKey) return false;
        if (b.merchantPattern && searchHay.includes(b.merchantPattern.toUpperCase())) return true;
        const expectedVnd =
          b.currency === 'USD' ? Math.round(b.amount * (finance.usdVndRate || 25500)) : b.amount;
        return Math.abs(expectedVnd - alert.amount) <= 5000 && searchHay.includes(b.name.toUpperCase());
      });
      if (bill) {
        matchedBillId = bill.id;
        suggestedCategoryId = bill.categoryId;
      }
    }

    // Match Open Split / Reimbursement when money comes IN
    let matchedSplitTxId: string | undefined;
    if (alert.direction === 'in') {
      const openSplit = finance.transactions.find((tx) => {
        if (!tx.split || tx.split.status !== 'open') return false;
        const remaining = tx.split.reimbursable - tx.split.repaidAmount;
        return remaining > 0 && alert.amount <= remaining + 5000;
      });
      if (openSplit) {
        matchedSplitTxId = openSplit.id;
      }
    }

    // Merchant Receipt Deduplication & Enrichment Check:
    // If Grab/Be/Apple receipt paid digitally matches an existing Ledger TX within ±24h, link it!
    let enrichedLedgerTxId: string | undefined;
    if (
      alert.eventRole === 'merchant_receipt' &&
      !(alert.paymentMethodHint && /\b(cash|tiền\s*mặt|cod)\b/i.test(alert.paymentMethodHint))
    ) {
      const alertDay = alert.receivedAt.slice(0, 10);
      const prevDay = addDaysIso(alertDay, -1);
      const nextDay = addDaysIso(alertDay, 1);
      const matchingTx = finance.transactions.find(
        (tx) =>
          tx.type === 'expense' &&
          Math.abs(tx.amount - alert.amount) <= 2000 &&
          tx.date >= prevDay &&
          tx.date <= nextDay
      );
      if (matchingTx) {
        enrichedLedgerTxId = matchingTx.id;
      }
    }

    items.push({
      id: uidFn('inb'),
      messageId: alert.messageId,
      gmailId: alert.gmailId,
      receivedAt: alert.receivedAt,
      sender: alert.sender,
      subject: alert.subject,
      bankBadge: alert.bankBadge,
      eventRole: alert.eventRole,
      direction: alert.direction,
      amount: alert.amount,
      currency: alert.currency,
      originalAmount: alert.originalAmount,
      originalCurrency: alert.originalCurrency,
      reportedBalanceAfter: alert.reportedBalanceAfter,
      isCreditCard: alert.isCreditCard,
      accountLast4: alert.accountLast4,
      paymentMethodHint: alert.paymentMethodHint,
      rawSnippet: alert.rawSnippet,
      cleanMerchant,
      cleanMemo: alert.cleanMemo,
      suggestedType,
      suggestedWalletId,
      suggestedToWalletId,
      suggestedCategoryId,
      matchedRuleId,
      matchedBillId,
      matchedSplitTxId,
      enrichedLedgerTxId,
      status: 'pending',
    });
  }

  // Pair two-sided self-transfers inside the batch (e.g. -500k Bank + +500k MoMo within 20 mins)
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (a.pairedInboxItemId || a.direction !== 'out') continue;
    const tA = Date.parse(a.receivedAt) || 0;

    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const b = items[j];
      if (b.pairedInboxItemId || b.direction !== 'in') continue;
      if (a.amount !== b.amount || a.suggestedWalletId === b.suggestedWalletId) continue;
      const tB = Date.parse(b.receivedAt) || 0;
      if (Math.abs(tA - tB) <= 20 * 60_000) {
        a.suggestedType = 'transfer';
        a.suggestedToWalletId = b.suggestedWalletId;
        a.pairedInboxItemId = b.id;
        b.pairedInboxItemId = a.id;
        b.status = 'ignored'; // Auto-collapsed into item `a`!
        break;
      }
    }
  }

  return items.filter((it) => it.status === 'pending');
}

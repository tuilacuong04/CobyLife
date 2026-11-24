import { AccentTone, CurrencyCode, TaskCategory, TaskPriority, TaskStatus, WalletKind } from '../types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function localIsoDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(baseIso: string, delta: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + delta);
  return localIsoDate(dt);
}

export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS_SHORT[(m || 1) - 1]} ${y}`;
}

export function formatMonthShort(monthKey: string): string {
  const [, m] = monthKey.split('-').map(Number);
  return MONTHS_SHORT[(m || 1) - 1] || monthKey;
}

export function formatShortDate(iso: string): string {
  if (!iso) return 'No date';
  const [, m, d] = iso.split('-').map(Number);
  if (!m || !d) return iso;
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

export function formatFullDate(date = new Date()): string {
  return `${DAYS_SHORT[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function relativeDueLabel(
  iso: string,
  today = localIsoDate()
): { text: string; overdue: boolean; isToday: boolean } {
  if (!iso) return { text: 'No due date', overdue: false, isToday: false };
  if (iso === today) return { text: 'Today', overdue: false, isToday: true };
  if (iso === addDaysIso(today, 1)) return { text: 'Tomorrow', overdue: false, isToday: false };
  if (iso === addDaysIso(today, -1)) return { text: 'Yesterday', overdue: true, isToday: false };
  if (iso < today) return { text: `Overdue (${formatShortDate(iso)})`, overdue: true, isToday: false };
  return { text: formatShortDate(iso), overdue: false, isToday: false };
}

export function formatMoney(amount: number, currency: CurrencyCode = 'VND'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (currency === 'USD') {
    const formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `${sign}$${formatted}`;
  }
  return `${sign}${Math.round(abs).toLocaleString('en-US')} ₫`;
}

export function formatMoneyCompact(amount: number, currency: CurrencyCode = 'VND'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (currency === 'USD') {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs)}`;
  }
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B ₫`;
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${v >= 10 ? v.toFixed(1) : v.toFixed(2)}M ₫`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k ₫`;
  return `${sign}${Math.round(abs)} ₫`;
}

/**
 * Parses shorthand currency input:
 * "50k" -> 50000, "1.5m" / "1.5tr" -> 1500000, "250,000" -> 250000
 */
export function parseSmartAmount(raw: string): number {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/[₫$]/g, '');
  if (!cleaned) return 0;

  const mMatch = cleaned.match(/^([\d.,]+)(tr|trieu|triệu|m)$/);
  if (mMatch) {
    const num = Number(mMatch[1].replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 1_000_000) : 0;
  }

  const kMatch = cleaned.match(/^([\d.,]+)(k|ng|nghìn|nghin)$/);
  if (kMatch) {
    const num = Number(kMatch[1].replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 1_000) : 0;
  }

  if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
    const digits = cleaned.replace(/[.,]/g, '');
    return Number(digits) || 0;
  }

  const normalized = cleaned.replace(',', '.');
  const val = Number(normalized);
  return Number.isFinite(val) ? Math.round(val) : 0;
}

export function formatVolume(vol: number, unit: 'kg' | 'lb' = 'kg'): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}t ${unit}`;
  return `${Math.round(vol).toLocaleString('en-US')} ${unit}`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ME';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function greetingEn(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export const TASK_STATUS_META: Record<TaskStatus, { label: string; dot: string; tone: AccentTone }> = {
  todo: { label: 'To Do', dot: 'stage-dot--sand', tone: 'sand' },
  doing: { label: 'In Progress', dot: 'stage-dot--sky', tone: 'sky' },
  done: { label: 'Done', dot: 'stage-dot--lime', tone: 'lime' },
};

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; short: string; pill: string }> = {
  high: { label: 'High priority', short: 'High', pill: 'pill--coral' },
  medium: { label: 'Medium', short: 'Med', pill: 'pill--sand' },
  low: { label: 'Low', short: 'Low', pill: 'pill--muted' },
};

export const TASK_CATEGORY_META: Record<TaskCategory, { label: string; tone: AccentTone; pill: string }> = {
  personal: { label: 'Personal', tone: 'sky', pill: 'pill--sky' },
  work: { label: 'Work', tone: 'sand', pill: 'pill--sand' },
  health: { label: 'Gym & Health', tone: 'lime', pill: 'pill--lime' },
  study: { label: 'Learning', tone: 'sky', pill: 'pill--sky' },
  finance: { label: 'Finance', tone: 'coral', pill: 'pill--coral' },
};

export const WALLET_KIND_LABEL: Record<WalletKind, string> = {
  cash: 'Cash',
  bank: 'Bank',
  ewallet: 'E-Wallet',
  card: 'Credit Card',
  savings: 'Savings',
};

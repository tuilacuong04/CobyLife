import { AccentTone, CurrencyCode, TaskCategory, TaskPriority, TaskStatus, WalletKind } from '../types';

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

export function formatMonthLabelVi(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `Tháng ${m}/${y}`;
}

export function formatMonthShortVi(monthKey: string): string {
  const [, m] = monthKey.split('-').map(Number);
  return `T${m}`;
}

export function formatShortDateVi(iso: string): string {
  if (!iso) return 'Không hạn';
  const [, m, d] = iso.split('-').map(Number);
  if (!m || !d) return iso;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export function formatFullDateVi(date = new Date()): string {
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return `${days[date.getDay()]}, ${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
}

export function relativeDueLabel(iso: string, today = localIsoDate()): { text: string; overdue: boolean; isToday: boolean } {
  if (!iso) return { text: 'Không hạn', overdue: false, isToday: false };
  if (iso === today) return { text: 'Hôm nay', overdue: false, isToday: true };
  if (iso === addDaysIso(today, 1)) return { text: 'Ngày mai', overdue: false, isToday: false };
  if (iso === addDaysIso(today, -1)) return { text: 'Hôm qua', overdue: true, isToday: false };
  if (iso < today) return { text: `Quá hạn (${formatShortDateVi(iso)})`, overdue: true, isToday: false };
  return { text: formatShortDateVi(iso), overdue: false, isToday: false };
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
  return `${sign}${Math.round(abs).toLocaleString('vi-VN')} ₫`;
}

export function formatMoneyCompact(amount: number, currency: CurrencyCode = 'VND'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (currency === 'USD') {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs)}`;
  }
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)} tỷ`;
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${v >= 10 ? v.toFixed(1) : v.toFixed(2)} tr`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)} ₫`;
}

/**
 * Parses Vietnamese / shorthand currency input:
 * "50k" -> 50000, "1.5tr" / "1,5m" -> 1500000, "250.000" -> 250000
 */
export function parseSmartAmount(raw: string): number {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/[₫$]/g, '');
  if (!cleaned) return 0;

  const trMatch = cleaned.match(/^([\d.,]+)(tr|trieu|triệu|m)$/);
  if (trMatch) {
    const num = Number(trMatch[1].replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 1_000_000) : 0;
  }

  const kMatch = cleaned.match(/^([\d.,]+)(k|ng|nghìn|nghin)$/);
  if (kMatch) {
    const num = Number(kMatch[1].replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 1_000) : 0;
  }

  // Handle thousand separators like 250.000 or 250,000
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
  return `${Math.round(vol).toLocaleString('vi-VN')} ${unit}`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ME';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function greetingVi(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export const TASK_STATUS_META: Record<TaskStatus, { label: string; dot: string; tone: AccentTone }> = {
  todo: { label: 'Cần làm', dot: 'stage-dot--sand', tone: 'sand' },
  doing: { label: 'Đang làm', dot: 'stage-dot--sky', tone: 'sky' },
  done: { label: 'Hoàn thành', dot: 'stage-dot--lime', tone: 'lime' },
};

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; pill: string }> = {
  high: { label: 'Ưu tiên cao', pill: 'pill--coral' },
  medium: { label: 'Trung bình', pill: 'pill--sand' },
  low: { label: 'Thấp', pill: 'pill--muted' },
};

export const TASK_CATEGORY_META: Record<TaskCategory, { label: string; tone: AccentTone; pill: string }> = {
  personal: { label: 'Cá nhân', tone: 'sky', pill: 'pill--sky' },
  work: { label: 'Công việc', tone: 'sand', pill: 'pill--sand' },
  health: { label: 'Gym & Sức khỏe', tone: 'lime', pill: 'pill--lime' },
  study: { label: 'Học tập', tone: 'sky', pill: 'pill--sky' },
  finance: { label: 'Tài chính', tone: 'coral', pill: 'pill--coral' },
};

export const WALLET_KIND_LABEL: Record<WalletKind, string> = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  ewallet: 'Ví điện tử',
  card: 'Thẻ tín dụng',
  savings: 'Tiết kiệm',
};

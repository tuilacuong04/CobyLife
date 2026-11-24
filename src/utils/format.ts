import { Deal, DealStage, Quote, QuoteLine } from '../types';

export const TODAY_ISO = '2026-11-17'; // Tue 17 Nov 2026

export const STAGE_ORDER: DealStage[] = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

export const OPEN_STAGES: DealStage[] = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
];

export const STAGE_META: Record<
  DealStage,
  { label: string; prob: number; tone: 'plain' | 'sand' | 'sky' | 'lime' | 'coral' }
> = {
  lead: { label: 'Lead', prob: 0.1, tone: 'plain' },
  qualified: { label: 'Qualified', prob: 0.25, tone: 'sand' },
  proposal: { label: 'Proposal', prob: 0.5, tone: 'sky' },
  negotiation: { label: 'Negotiation', prob: 0.75, tone: 'sky' },
  won: { label: 'Won', prob: 1, tone: 'lime' },
  lost: { label: 'Lost', prob: 0, tone: 'coral' },
};

export function stageProbability(stage: DealStage): number {
  return STAGE_META[stage].prob;
}

export function dealWeightedValue(deal: Deal): number {
  return Math.round(deal.value * stageProbability(deal.stage));
}

export function formatKrCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const formatted = m >= 10 ? m.toFixed(1) : m.toFixed(2);
    return `${sign}kr ${formatted.replace(/\.00$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}kr ${Math.round(abs / 1_000)}K`;
  }
  return `${sign}kr ${Math.round(abs)}`;
}

export function formatKrExact(value: number): string {
  return `kr ${Math.round(value).toLocaleString('en-US')}`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function quoteSubtotal(lines: QuoteLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

export function quoteVat(lines: QuoteLine[]): number {
  return Math.round(quoteSubtotal(lines) * 0.25);
}

export function quoteTotalWithVat(lines: QuoteLine[]): number {
  return quoteSubtotal(lines) + quoteVat(lines);
}

export function quoteListAmount(q: Quote): number {
  return quoteSubtotal(q.lines);
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function diffDays(isoA: string, isoB: string): number {
  const a = parseIsoDate(isoA).getTime();
  const b = parseIsoDate(isoB).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function formatShortDate(iso: string): string {
  const d = parseIsoDate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatShortDateLower(iso: string): string {
  const d = parseIsoDate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()}`;
}

export function formatWeekdayShort(iso: string): string {
  const d = parseIsoDate(iso);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatRelativeTouch(iso: string): string {
  const delta = diffDays(TODAY_ISO, iso);
  if (delta <= 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta < 30) return `${delta} days ago`;
  return formatShortDate(iso);
}

export function formatRelativeActivityDay(iso: string): string {
  const delta = diffDays(iso, TODAY_ISO);
  if (delta === 0) return 'Today';
  if (delta === -1) return 'Yesterday';
  if (delta === 1) return 'Tomorrow';
  if (delta < -1) return `${Math.abs(delta)} days ago`;
  if (delta <= 7) return `In ${delta} days`;
  return formatShortDate(iso);
}

export function formatCloseCountdown(iso: string): string {
  const delta = diffDays(iso, TODAY_ISO);
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  return `In ${delta} days`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function isCurrentMonth(iso: string): boolean {
  return iso.startsWith(TODAY_ISO.slice(0, 7));
}

export function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (val: string | number) => {
    const str = String(val);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}

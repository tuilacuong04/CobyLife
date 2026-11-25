import { PersistedAppState } from '../types';
import { createStarterState } from '../data/seedData';
import {
  DEFAULT_AUTO_RULES,
  DEFAULT_QUICK_PRESETS,
} from './financeEngine';

export const APP_STORAGE_KEY = 'coby_life_os_v1';
const LEGACY_STORAGE_KEY = 'sylva_personal_os_v2';
export const LOCAL_UPDATED_AT_KEY = 'coby_life_updated_at_v1';

export function hasStoredAppState(): boolean {
  try {
    return Boolean(
      window.localStorage.getItem(APP_STORAGE_KEY) ||
        window.localStorage.getItem(LEGACY_STORAGE_KEY)
    );
  } catch {
    return false;
  }
}

export function getLocalUpdatedAt(): string {
  try {
    return window.localStorage.getItem(LOCAL_UPDATED_AT_KEY) || '';
  } catch {
    return '';
  }
}

export function setLocalUpdatedAt(iso: string): void {
  try {
    window.localStorage.setItem(LOCAL_UPDATED_AT_KEY, iso);
  } catch {
    // Ignore
  }
}

export function normalizePersistedState(raw: unknown): PersistedAppState {
  const fallback = createStarterState();
  if (!raw || typeof raw !== 'object') return fallback;
  const parsed = raw as Partial<PersistedAppState>;
  const rawFin = parsed.finance;

  const hasValidCoreFinance =
    rawFin &&
    Array.isArray(rawFin.wallets) &&
    Array.isArray(rawFin.categories) &&
    Array.isArray(rawFin.transactions) &&
    Array.isArray(rawFin.budgets);

  const normalizedFinance = hasValidCoreFinance
    ? {
        wallets: rawFin.wallets,
        categories: rawFin.categories,
        transactions: rawFin.transactions,
        budgets: rawFin.budgets,
        inbox: Array.isArray(rawFin.inbox) ? rawFin.inbox : [],
        rules: Array.isArray(rawFin.rules) ? rawFin.rules : DEFAULT_AUTO_RULES,
        recurringBills: Array.isArray(rawFin.recurringBills)
          ? rawFin.recurringBills
          : [],
        quickPresets: Array.isArray(rawFin.quickPresets)
          ? rawFin.quickPresets
          : DEFAULT_QUICK_PRESETS,
        paydayDay:
          typeof rawFin.paydayDay === 'number' && rawFin.paydayDay >= 1 && rawFin.paydayDay <= 28
            ? Math.round(rawFin.paydayDay)
            : 1,
        usdVndRate:
          typeof rawFin.usdVndRate === 'number' && rawFin.usdVndRate > 1000
            ? rawFin.usdVndRate
            : 25500,
      }
    : fallback.finance;

  return {
    version: 3,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : fallback.tasks,
    finance: normalizedFinance,
    futureModules: Array.isArray(parsed.futureModules)
      ? parsed.futureModules
      : [],
    settings: {
      ...fallback.settings,
      ...(parsed.settings || {}),
      profile: {
        ...fallback.settings.profile,
        ...(parsed.settings?.profile || {}),
      },
      enabledModules: {
        ...fallback.settings.enabledModules,
        ...(parsed.settings?.enabledModules || {}),
      },
    },
  };
}

export function loadAppState(): PersistedAppState {
  try {
    let raw = window.localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        window.localStorage.setItem(APP_STORAGE_KEY, legacy);
      }
    }
    if (!raw) return createStarterState();
    return normalizePersistedState(JSON.parse(raw));
  } catch {
    return createStarterState();
  }
}

export function saveAppState(state: PersistedAppState): void {
  try {
    window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export function clearAppState(): void {
  try {
    window.localStorage.removeItem(APP_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

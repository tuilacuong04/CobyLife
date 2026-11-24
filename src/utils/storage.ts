import { PersistedAppState } from '../types';
import { createStarterState } from '../data/seedData';

export const APP_STORAGE_KEY = 'sylva_personal_os_v1';

export function loadAppState(): PersistedAppState {
  try {
    const raw = window.localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return createStarterState();
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    const fallback = createStarterState();
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      version: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : fallback.tasks,
      finance:
        parsed.finance &&
        Array.isArray(parsed.finance.wallets) &&
        Array.isArray(parsed.finance.categories) &&
        Array.isArray(parsed.finance.transactions) &&
        Array.isArray(parsed.finance.budgets)
          ? parsed.finance
          : fallback.finance,
      futureModules: Array.isArray(parsed.futureModules)
        ? parsed.futureModules
        : fallback.futureModules,
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
  } catch {
    // Ignore
  }
}

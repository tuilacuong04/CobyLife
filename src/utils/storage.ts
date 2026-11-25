import { PersistedAppState } from '../types';
import { createStarterState } from '../data/seedData';

export const APP_STORAGE_KEY = 'coby_life_os_v1';
const LEGACY_STORAGE_KEY = 'sylva_personal_os_v2';
export const LOCAL_UPDATED_AT_KEY = 'coby_life_updated_at_v1';
const LEGACY_GYM_KEYS = ['gym_state_v1', 'gym_demo_seeded_v1', 'gym_lang_en_v1'];

export function purgeLegacyGymStorage(): void {
  try {
    for (const key of LEGACY_GYM_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

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
  const hasValidFinance =
    parsed.finance &&
    Array.isArray(parsed.finance.wallets) &&
    Array.isArray(parsed.finance.categories) &&
    Array.isArray(parsed.finance.transactions) &&
    Array.isArray(parsed.finance.budgets);

  const migratedFinance = hasValidFinance
    ? {
        ...parsed.finance!,
        categories: parsed.finance!.categories.map((cat) =>
          cat.id === 'cat-gym' && cat.name === 'Gym & Nutrition'
            ? { ...cat, name: 'Health & Care', badge: 'HC' }
            : cat
        ),
      }
    : fallback.finance;

  return {
    version: 2,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : fallback.tasks,
    finance: migratedFinance,
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
        tasks: parsed.settings?.enabledModules?.tasks ?? fallback.settings.enabledModules.tasks,
        finance:
          parsed.settings?.enabledModules?.finance ?? fallback.settings.enabledModules.finance,
      },
    },
  };
}

export function loadAppState(): PersistedAppState {
  purgeLegacyGymStorage();
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
    purgeLegacyGymStorage();
  } catch {
    // Ignore
  }
}

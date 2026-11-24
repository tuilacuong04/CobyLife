import { PersistedState } from '../types';
import { createInitialState } from '../data/seedData';

const STORAGE_KEY = 'sylva_crm_state_v1';

export function loadState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || !parsed.spaces || !parsed.activeSpaceId || !parsed.settings) {
      return createInitialState();
    }
    return parsed;
  } catch {
    return createInitialState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

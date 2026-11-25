import { createClient, type SupportedStorage } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://nroyuxqhgiazzcasroyj.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_AL_EUzlGjhU3wGzWgwlwWA_FY9XzLW8';

export const REMEMBER_ME_STORAGE_KEY = 'coby_life_remember_me_v1';
export const SUPABASE_AUTH_STORAGE_KEY = 'coby_life_sb_auth_v1';

export function getRememberMePreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setRememberMePreference(remember: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, remember ? '1' : '0');
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

const customStorage: SupportedStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const remember = getRememberMePreference();
      return remember ? window.localStorage.getItem(key) : window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    const remember = getRememberMePreference();
    try {
      if (remember) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  },
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

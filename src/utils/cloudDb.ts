import { PersistedAppState } from '../types';

export type CloudProvider = 'none' | 'supabase' | 'gist';

export interface CloudDbConfig {
  provider: CloudProvider;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseVaultId: string;
  supabaseSecret: string;
  gistToken: string;
  gistId: string;
  autoSync: boolean;
}

export interface CloudSyncStatus {
  state: 'local' | 'syncing' | 'synced' | 'error';
  provider: CloudProvider;
  lastSyncedAt: string | null;
  error?: string;
  localDbReady: boolean;
}

export interface UnifiedVaultPayload {
  format: 'coby-life-backup-v1';
  updatedAt: string;
  personalOs: PersistedAppState;
}

export const CLOUD_CONFIG_KEY = 'coby_cloud_db_config_v1';
const IDB_NAME = 'coby_life_idb';
const IDB_STORE = 'vault';
const IDB_KEY = 'primary';

export const DEFAULT_CLOUD_CONFIG: CloudDbConfig = {
  provider: 'none',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseVaultId: 'coby-main',
  supabaseSecret: '',
  gistToken: '',
  gistId: '',
  autoSync: true,
};

export const SUPABASE_SETUP_SQL = `-- Run once in Supabase SQL Editor (Project -> SQL Editor -> New query)
create extension if not exists pgcrypto;

create table if not exists public.coby_vault (
  vault_id text primary key,
  secret_hash text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.coby_vault enable row level security;

create or replace function public.coby_vault_pull(p_vault_id text, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.coby_vault;
begin
  select * into v_row from public.coby_vault where vault_id = p_vault_id;
  if not found then
    return null;
  end if;
  if v_row.secret_hash <> encode(digest(p_secret, 'sha256'), 'hex') then
    raise exception 'Invalid vault secret';
  end if;
  return jsonb_build_object('payload', v_row.payload, 'updated_at', v_row.updated_at);
end;
$$;

create or replace function public.coby_vault_push(
  p_vault_id text,
  p_secret text,
  p_payload jsonb,
  p_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text := encode(digest(p_secret, 'sha256'), 'hex');
  v_existing public.coby_vault;
begin
  select * into v_existing from public.coby_vault where vault_id = p_vault_id;
  if found and v_existing.secret_hash <> v_hash then
    raise exception 'Invalid vault secret';
  end if;
  insert into public.coby_vault (vault_id, secret_hash, payload, updated_at)
  values (p_vault_id, v_hash, p_payload, p_updated_at)
  on conflict (vault_id) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'updated_at', p_updated_at);
end;
$$;

grant execute on function public.coby_vault_pull(text, text) to anon, authenticated;
grant execute on function public.coby_vault_push(text, text, jsonb, timestamptz) to anon, authenticated;`;

export function loadCloudConfig(): CloudDbConfig {
  try {
    const raw = window.localStorage.getItem(CLOUD_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CLOUD_CONFIG };
    const parsed = JSON.parse(raw) as Partial<CloudDbConfig>;
    return { ...DEFAULT_CLOUD_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CLOUD_CONFIG };
  }
}

export function saveCloudConfigToStorage(cfg: CloudDbConfig): void {
  try {
    window.localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore quota errors
  }
}

export function isCloudConfigValid(cfg: CloudDbConfig): boolean {
  if (cfg.provider === 'supabase') {
    return Boolean(
      cfg.supabaseUrl.trim() &&
        cfg.supabaseAnonKey.trim() &&
        cfg.supabaseVaultId.trim() &&
        cfg.supabaseSecret.trim().length >= 4
    );
  }
  if (cfg.provider === 'gist') {
    return Boolean(cfg.gistToken.trim());
  }
  return false;
}

export function encodeCloudConfigCode(cfg: CloudDbConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return `COBYDB:${btoa(binary)}`;
}

export function decodeCloudConfigCode(code: string): CloudDbConfig | null {
  try {
    const clean = code.trim();
    if (!clean.startsWith('COBYDB:')) return null;
    const binary = atob(clean.slice('COBYDB:'.length));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<CloudDbConfig>;
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...DEFAULT_CLOUD_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

/* ========================== Durable Local IndexedDB ========================== */

function openLocalIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveLocalIdbSnapshot(payload: UnifiedVaultPayload): Promise<boolean> {
  const db = await openLocalIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(payload, IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function loadLocalIdbSnapshot(): Promise<UnifiedVaultPayload | null> {
  const db = await openLocalIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as UnifiedVaultPayload) || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/* ========================== Cloud DB Drivers ========================== */

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function pullFromCloudDb(
  cfg: CloudDbConfig
): Promise<{ payload: UnifiedVaultPayload; updatedAt: string } | null> {
  if (cfg.provider === 'supabase') {
    const base = normalizeSupabaseUrl(cfg.supabaseUrl);
    const res = await fetch(`${base}/rest/v1/rpc/coby_vault_pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseAnonKey.trim(),
        Authorization: `Bearer ${cfg.supabaseAnonKey.trim()}`,
      },
      body: JSON.stringify({
        p_vault_id: cfg.supabaseVaultId.trim() || 'coby-main',
        p_secret: cfg.supabaseSecret.trim(),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(extractErrorMessage(text, `Supabase error (${res.status})`));
    }
    const data = await res.json();
    if (!data || !data.payload) return null;
    return {
      payload: data.payload as UnifiedVaultPayload,
      updatedAt: String(data.updated_at || data.payload.updatedAt || ''),
    };
  }

  if (cfg.provider === 'gist') {
    if (!cfg.gistId.trim()) return null;
    const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(cfg.gistId.trim())}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.gistToken.trim()}`,
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(extractErrorMessage(text, `GitHub Gist error (${res.status})`));
    }
    const gist = await res.json();
    const file = gist?.files?.['coby-life-db.json'];
    if (!file?.content) return null;
    const payload = JSON.parse(file.content) as UnifiedVaultPayload;
    return {
      payload,
      updatedAt: String(payload.updatedAt || gist.updated_at || ''),
    };
  }

  return null;
}

export async function pushToCloudDb(
  cfg: CloudDbConfig,
  payload: UnifiedVaultPayload
): Promise<{ updatedAt: string; createdGistId?: string }> {
  if (cfg.provider === 'supabase') {
    const base = normalizeSupabaseUrl(cfg.supabaseUrl);
    const res = await fetch(`${base}/rest/v1/rpc/coby_vault_push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseAnonKey.trim(),
        Authorization: `Bearer ${cfg.supabaseAnonKey.trim()}`,
      },
      body: JSON.stringify({
        p_vault_id: cfg.supabaseVaultId.trim() || 'coby-main',
        p_secret: cfg.supabaseSecret.trim(),
        p_payload: payload,
        p_updated_at: payload.updatedAt,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(extractErrorMessage(text, `Supabase error (${res.status})`));
    }
    return { updatedAt: payload.updatedAt };
  }

  if (cfg.provider === 'gist') {
    const content = JSON.stringify(payload);
    const existingId = cfg.gistId.trim();
    const endpoint = existingId
      ? `https://api.github.com/gists/${encodeURIComponent(existingId)}`
      : 'https://api.github.com/gists';
    const res = await fetch(endpoint, {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.gistToken.trim()}`,
      },
      body: JSON.stringify({
        description: 'Coby LIFE — Personal OS Database (Tasks + Finance)',
        public: false,
        files: {
          'coby-life-db.json': { content },
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(extractErrorMessage(text, `GitHub Gist error (${res.status})`));
    }
    const data = await res.json();
    return {
      updatedAt: payload.updatedAt,
      createdGistId: !existingId && data?.id ? String(data.id) : undefined,
    };
  }

  return { updatedAt: payload.updatedAt };
}

function extractErrorMessage(raw: string, fallback: string): string {
  try {
    const j = JSON.parse(raw);
    if (j?.message) return String(j.message);
    if (j?.error_description) return String(j.error_description);
    if (j?.error) return String(j.error);
  } catch {
    // Plain text
  }
  return raw.trim().slice(0, 140) || fallback;
}

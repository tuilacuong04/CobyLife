import { PersistedAppState } from '../types';
import { supabase } from './supabaseClient';
import { RawGmailPayloadItem } from './vnGmailParser';

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
  // Gmail Sync (Google Apps Script -> Supabase Inbox or Direct Fallback)
  gmailIngestKey?: string;
  gmailTriggerSecret?: string;
  gmailGasExecUrl?: string;
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

export function generateRandomSecret(prefix: string): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(20);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  let out = `${prefix}_`;
  arr.forEach((b) => {
    out += chars[b % chars.length];
  });
  return out;
}

export const DEFAULT_CLOUD_CONFIG: CloudDbConfig = {
  provider: 'none',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseVaultId: 'coby-main',
  supabaseSecret: '',
  gistToken: '',
  gistId: '',
  autoSync: true,
  gmailIngestKey: '',
  gmailTriggerSecret: '',
  gmailGasExecUrl: '',
};

export const SUPABASE_SETUP_SQL = `-- Run once in Supabase SQL Editor (Project -> SQL Editor -> New query)
create extension if not exists pgcrypto;

create table if not exists public.coby_vault (
  vault_id text primary key,
  secret_hash text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  ingest_key_hash text
);

alter table public.coby_vault add column if not exists ingest_key_hash text;
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

-- Append-Only Gmail Finance Inbox (Write-Only Ingest Key + Zero Race Condition)
create table if not exists public.coby_finance_inbox (
  id bigserial primary key,
  vault_id text not null references public.coby_vault(vault_id) on delete cascade,
  message_id text not null,
  gmail_id text,
  sender text not null,
  subject text not null,
  received_at timestamptz not null,
  snippet text not null,
  parsed jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'imported', 'ignored')),
  created_at timestamptz not null default now(),
  imported_at timestamptz,
  unique (vault_id, message_id)
);

create index if not exists idx_coby_finance_inbox_pending
  on public.coby_finance_inbox (vault_id, status, received_at asc);

alter table public.coby_finance_inbox enable row level security;

create or replace function public.coby_vault_set_ingest_key(
  p_vault_id text,
  p_secret text,
  p_ingest_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.coby_vault;
begin
  select * into v_row from public.coby_vault where vault_id = p_vault_id;
  if not found or v_row.secret_hash <> encode(digest(p_secret, 'sha256'), 'hex') then
    raise exception 'Invalid vault secret';
  end if;
  update public.coby_vault
     set ingest_key_hash = case
       when p_ingest_key is null or btrim(p_ingest_key) = '' then null
       else encode(digest(btrim(p_ingest_key), 'sha256'), 'hex')
     end
   where vault_id = p_vault_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.coby_inbox_push(
  p_vault_id text,
  p_ingest_key text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_vault public.coby_vault;
  v_key_hash text := encode(digest(coalesce(btrim(p_ingest_key), ''), 'sha256'), 'hex');
  v_item jsonb;
  v_inserted int := 0;
  v_row_count int;
begin
  if p_ingest_key is null or length(btrim(p_ingest_key)) < 10 then
    raise exception 'Invalid ingest key';
  end if;
  select * into v_vault from public.coby_vault where vault_id = p_vault_id;
  if not found or v_vault.ingest_key_hash is null or v_vault.ingest_key_hash <> v_key_hash then
    raise exception 'Unauthorized ingest key';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'p_items must be an array of at most 50 items';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.coby_finance_inbox (
      vault_id, message_id, gmail_id, sender, subject, received_at, snippet, parsed
    )
    values (
      p_vault_id,
      left(btrim(coalesce(v_item->>'message_id', '')), 255),
      left(btrim(coalesce(v_item->>'gmail_id', '')), 64),
      left(btrim(coalesce(v_item->>'sender', '')), 180),
      left(btrim(coalesce(v_item->>'subject', '')), 200),
      coalesce((v_item->>'received_at')::timestamptz, now()),
      left(coalesce(v_item->>'snippet', ''), 1000),
      coalesce(v_item->'parsed', '{}'::jsonb)
    )
    on conflict (vault_id, message_id) do nothing;

    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + v_row_count;
  end loop;

  delete from public.coby_finance_inbox
   where vault_id = p_vault_id
     and status in ('imported', 'ignored')
     and created_at < now() - interval '60 days';

  return jsonb_build_object('ok', true, 'inserted', v_inserted);
end;
$$;

create or replace function public.coby_inbox_pull(
  p_vault_id text,
  p_secret text,
  p_limit int default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_vault public.coby_vault;
  v_rows jsonb;
begin
  select * into v_vault from public.coby_vault where vault_id = p_vault_id;
  if not found or v_vault.secret_hash <> encode(digest(p_secret, 'sha256'), 'hex') then
    raise exception 'Invalid vault secret';
  end if;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_rows
    from (
      select message_id, gmail_id, sender, subject, received_at, snippet, parsed
        from public.coby_finance_inbox
       where vault_id = p_vault_id and status = 'pending'
       order by received_at asc
       limit greatest(1, least(coalesce(p_limit, 100), 250))
    ) t;
  return jsonb_build_object('ok', true, 'items', v_rows);
end;
$$;

create or replace function public.coby_inbox_ack(
  p_vault_id text,
  p_secret text,
  p_message_ids text[],
  p_status text default 'imported'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_vault public.coby_vault;
  v_updated int;
begin
  if p_status not in ('imported', 'ignored') then
    raise exception 'Invalid status';
  end if;
  select * into v_vault from public.coby_vault where vault_id = p_vault_id;
  if not found or v_vault.secret_hash <> encode(digest(p_secret, 'sha256'), 'hex') then
    raise exception 'Invalid vault secret';
  end if;
  update public.coby_finance_inbox
     set status = p_status, imported_at = now()
   where vault_id = p_vault_id
     and message_id = any(p_message_ids)
     and status = 'pending';
  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', true, 'updated', v_updated);
end;
$$;

grant execute on function public.coby_vault_pull(text, text) to anon, authenticated;
grant execute on function public.coby_vault_push(text, text, jsonb, timestamptz) to anon, authenticated;
grant execute on function public.coby_vault_set_ingest_key(text, text, text) to anon, authenticated;
grant execute on function public.coby_inbox_push(text, text, jsonb) to anon, authenticated;
grant execute on function public.coby_inbox_pull(text, text, int) to anon, authenticated;
grant execute on function public.coby_inbox_ack(text, text, text[], text) to anon, authenticated;`;

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

function getIdbKey(userId?: string): string {
  return userId ? `vault:${userId}` : IDB_KEY;
}

export async function saveLocalIdbSnapshot(
  payload: UnifiedVaultPayload,
  userId?: string
): Promise<boolean> {
  const db = await openLocalIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(payload, getIdbKey(userId));
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

export async function loadLocalIdbSnapshot(userId?: string): Promise<UnifiedVaultPayload | null> {
  const db = await openLocalIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(getIdbKey(userId));
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

export async function clearLocalIdbSnapshot(userId?: string): Promise<boolean> {
  const db = await openLocalIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.close();
        resolve(true);
        return;
      }
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(getIdbKey(userId));
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

/* ========================== Authenticated Supabase RLS Vault ========================== */

export async function pullAuthenticatedUserVault(
  userId: string
): Promise<{ payload: UnifiedVaultPayload; updatedAt: string } | null> {
  const { data, error } = await supabase
    .from('coby_user_vaults')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Could not pull cloud vault');
  }
  if (!data || !data.payload) return null;
  const payload = data.payload as UnifiedVaultPayload;
  return {
    payload,
    updatedAt: String(data.updated_at || payload.updatedAt || ''),
  };
}

export async function pushAuthenticatedUserVault(
  userId: string,
  payload: UnifiedVaultPayload
): Promise<void> {
  const { error } = await supabase
    .from('coby_user_vaults')
    .upsert(
      {
        user_id: userId,
        payload,
        updated_at: payload.updatedAt,
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    throw new Error(error.message || 'Could not push cloud vault');
  }
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

/* ========================== Gmail Sync RPC & GAS Drivers ========================== */

export function normalizeGasExecUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/macros\/u\/\d+\/s\//, '/macros/s/')
    .replace(/\/dev(\?.*)?$/, '/exec');
}

export async function registerSupabaseIngestKey(
  cfg: CloudDbConfig,
  ingestKey: string
): Promise<{ ok: boolean; error?: string }> {
  if (cfg.provider !== 'supabase' || !isCloudConfigValid(cfg)) {
    return { ok: false, error: 'Connect Supabase Cloud DB first' };
  }
  const base = normalizeSupabaseUrl(cfg.supabaseUrl);
  const res = await fetch(`${base}/rest/v1/rpc/coby_vault_set_ingest_key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.supabaseAnonKey.trim(),
      Authorization: `Bearer ${cfg.supabaseAnonKey.trim()}`,
    },
    body: JSON.stringify({
      p_vault_id: cfg.supabaseVaultId.trim() || 'coby-main',
      p_secret: cfg.supabaseSecret.trim(),
      p_ingest_key: ingestKey.trim(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error: extractErrorMessage(
        text,
        'Run the updated Supabase SQL in Step 1 first to enable coby_finance_inbox'
      ),
    };
  }
  return { ok: true };
}

export async function pullSupabaseInboxItems(
  cfg: CloudDbConfig
): Promise<{ ok: boolean; items: RawGmailPayloadItem[]; needsSqlUpgrade?: boolean; error?: string }> {
  if (cfg.provider !== 'supabase' || !isCloudConfigValid(cfg)) {
    return { ok: true, items: [] };
  }
  const base = normalizeSupabaseUrl(cfg.supabaseUrl);
  try {
    const res = await fetch(`${base}/rest/v1/rpc/coby_inbox_pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseAnonKey.trim(),
        Authorization: `Bearer ${cfg.supabaseAnonKey.trim()}`,
      },
      body: JSON.stringify({
        p_vault_id: cfg.supabaseVaultId.trim() || 'coby-main',
        p_secret: cfg.supabaseSecret.trim(),
        p_limit: 100,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404 || /coby_inbox_pull|does not exist/i.test(text)) {
        return { ok: false, items: [], needsSqlUpgrade: true };
      }
      return { ok: false, items: [], error: extractErrorMessage(text, 'Inbox pull failed') };
    }
    const data = await res.json();
    const items = Array.isArray(data?.items) ? (data.items as RawGmailPayloadItem[]) : [];
    return { ok: true, items };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function ackSupabaseInboxItems(
  cfg: CloudDbConfig,
  messageIds: string[],
  status: 'imported' | 'ignored'
): Promise<void> {
  if (messageIds.length === 0) return;

  // If using standalone GAS direct-pull without Supabase, ack directly on GAS
  if (cfg.provider !== 'supabase' && cfg.gmailGasExecUrl?.trim() && cfg.gmailTriggerSecret?.trim()) {
    try {
      await fetch(normalizeGasExecUrl(cfg.gmailGasExecUrl), {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'ack_direct',
          triggerSecret: cfg.gmailTriggerSecret.trim(),
          gmailIds: messageIds,
        }),
      });
    } catch {
      // Non-fatal
    }
    return;
  }

  if (cfg.provider !== 'supabase' || !isCloudConfigValid(cfg)) return;
  const base = normalizeSupabaseUrl(cfg.supabaseUrl);
  try {
    await fetch(`${base}/rest/v1/rpc/coby_inbox_ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseAnonKey.trim(),
        Authorization: `Bearer ${cfg.supabaseAnonKey.trim()}`,
      },
      body: JSON.stringify({
        p_vault_id: cfg.supabaseVaultId.trim() || 'coby-main',
        p_secret: cfg.supabaseSecret.trim(),
        p_message_ids: messageIds,
        p_status: status,
      }),
    });
  } catch {
    // Will retry naturally on next sync if still pending
  }
}

/**
 * Triggers Google Apps Script Web App (`doPost`) from Mobile Safari / Chrome
 * using a CORS-safelisted Simple Request (`text/plain;charset=utf-8` + `credentials: 'omit'`).
 */
export async function triggerGasWebAppSync(cfg: CloudDbConfig): Promise<{
  ok: boolean;
  scannedCount?: number;
  pushedCount?: number;
  directItems?: RawGmailPayloadItem[];
  error?: string;
}> {
  const execUrl = normalizeGasExecUrl(cfg.gmailGasExecUrl || '');
  const triggerSecret = (cfg.gmailTriggerSecret || '').trim();
  if (!execUrl || !triggerSecret) {
    return { ok: false, error: 'Optional Apps Script Web App URL not configured' };
  }

  const useDirectMode = cfg.provider !== 'supabase' || !isCloudConfigValid(cfg);
  try {
    const res = await fetch(execUrl, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: useDirectMode ? 'pull_direct' : 'sync_now',
        triggerSecret,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Apps Script HTTP ${res.status}` };
    }
    const data = await res.json();
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || 'Apps Script sync error') };
    }
    return {
      ok: true,
      scannedCount: Number(data.scannedCount || 0),
      pushedCount: Number(data.pushedCount || 0),
      directItems: Array.isArray(data.items) ? (data.items as RawGmailPayloadItem[]) : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Could not reach Apps Script Web App (check deployment access = Anyone)',
    };
  }
}

/**
 * Generates a ready-to-paste Google Apps Script (`Code.gs`) pre-filled with the user's
 * write-only Ingest Key, Trigger Secret, and Supabase project settings.
 */
export function generateGoogleAppsScriptCode(cfg: CloudDbConfig): string {
  const supaUrl = cfg.provider === 'supabase' ? normalizeSupabaseUrl(cfg.supabaseUrl) : '';
  const supaAnon = cfg.provider === 'supabase' ? cfg.supabaseAnonKey.trim() : '';
  const vaultId = (cfg.supabaseVaultId || 'coby-main').trim();
  const ingestKey = (cfg.gmailIngestKey || 'coby_ing_GENERATE_IN_SETTINGS').trim();
  const triggerSecret = (cfg.gmailTriggerSecret || 'coby_trg_GENERATE_IN_SETTINGS').trim();

  return `/**
 * Coby LIFE — Automated 24/7 Gmail Finance Sync (Mobile Web + Desktop)
 *
 * SETUP (2 minutes, one time only):
 * 1. Open https://script.google.com -> New Project -> paste this entire file into Code.gs
 * 2. Select "installCobySync" in the top toolbar dropdown and click "Run" (approve permission once)
 * 3. (Optional — enables instant "Sync Gmail" button on Mobile Safari/Chrome):
 *    Click Deploy -> New deployment -> Select type: Web app
 *      - Execute as: "Me"
 *      - Who has access: "Anyone"
 *    Copy the Web app "/exec" URL into Coby LIFE -> Gmail Sync Setup.
 */

const CONFIG = {
  SUPABASE_URL: ${JSON.stringify(supaUrl)},
  SUPABASE_ANON_KEY: ${JSON.stringify(supaAnon)},
  VAULT_ID: ${JSON.stringify(vaultId)},
  INGEST_KEY: ${JSON.stringify(ingestKey)},
  TRIGGER_SECRET: ${JSON.stringify(triggerSecret)}
};

const SYNC_LABEL = 'CobyLIFE/Synced';
const ALLOWED_DOMAINS = [
  'timo.vn', 'acb.com.vn', 'sacombank.com.vn', 'sacombank.com',
  'hsbc.com.vn', 'notification.hsbc.com.vn', 'notification.hsbc.com.hk',
  'vietcombank.com.vn', 'info.vietcombank.com.vn',
  'tpb.com.vn', 'vib.com.vn', 'card.vib.com.vn',
  'vpbank.com.vn', 'vpb.com.vn', 'care.vpb.com.vn', 'cake.vn',
  'bidv.com.vn', 'uobgroup.com', 'uob.com.vn', 'shinhan.com', 'shinhan.com.vn',
  'techcombank.com.vn', 'mbbank.com.vn',
  'momo.vn', 'zalopay.vn', 'shopeepay.vn', 'vnpay.vn',
  'grab.com', 'xanhsm.com', 'gsm-einvoice.hilo.com.vn', 'be.com.vn',
  'shopee.vn', 'mail.shopee.vn', 'lazada.vn',
  'email.apple.com', 'google.com', 'tm.openai.com', 'stripe.com', 'netflix.com', 'spotify.com'
];

function installCobySync() {
  getOrCreateLabel_(SYNC_LABEL);
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'cronSyncBankEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cronSyncBankEmails').timeBased().everyMinutes(5).create();
  const res = syncBankEmails_({ waitMs: 15000 });
  Logger.log('Coby LIFE Gmail Sync installed! Initial scan: ' + JSON.stringify(res));
}

function cronSyncBankEmails() {
  syncBankEmails_({ waitMs: 5000 });
}

function doGet() {
  return jsonOut_({ ok: true, service: 'coby-life-gmail-sync' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!CONFIG.TRIGGER_SECRET || String(body.triggerSecret || '') !== CONFIG.TRIGGER_SECRET) {
      return jsonOut_({ ok: false, error: 'Invalid trigger secret' });
    }
    const action = String(body.action || 'sync_now');
    if (action === 'pull_direct' && !CONFIG.SUPABASE_URL) {
      return jsonOut_(syncBankEmails_({ waitMs: 20000, direct: true }));
    }
    if (action === 'ack_direct' && Array.isArray(body.gmailIds)) {
      const props = PropertiesService.getScriptProperties();
      const seen = JSON.parse(props.getProperty('SEEN_IDS') || '[]');
      const merged = Array.from(new Set(seen.concat(body.gmailIds.map(String)))).slice(-350);
      props.setProperty('SEEN_IDS', JSON.stringify(merged));
      return jsonOut_({ ok: true });
    }
    return jsonOut_(syncBankEmails_({ waitMs: 20000 }));
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function syncBankEmails_(opts) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock((opts && opts.waitMs) || 10000)) {
    return { ok: true, locked: true, scannedCount: 0, pushedCount: 0 };
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const nowSec = Math.floor(Date.now() / 1000);
    const savedSec = parseInt(props.getProperty('LAST_EPOCH_SEC') || '0', 10);
    // 2h overlap + per-message ID ring buffer prevents Gmail same-subject thread skipping!
    const afterSec = savedSec > 0 ? Math.max(0, savedSec - 7200) : (nowSec - 7 * 86400);
    const seenList = JSON.parse(props.getProperty('SEEN_IDS') || '[]');
    const seenSet = new Set(seenList);

    const query = 'from:(' + ALLOWED_DOMAINS.join(' OR ') + ') -subject:(OTP OR "mã xác thực" OR "verification code" OR "khuyến mãi") after:' + afterSec;
    const threads = GmailApp.search(query, 0, 25);
    if (!threads.length) return { ok: true, scannedCount: 0, pushedCount: 0, items: [] };

    const threadMsgs = GmailApp.getMessagesForThreads(threads);
    const batch = [];
    const newIds = [];
    const touchedThreads = [];
    let maxSec = savedSec;

    for (let i = 0; i < threads.length; i++) {
      let matchedInThread = false;
      for (let j = 0; j < threadMsgs[i].length; j++) {
        if (batch.length >= 40) break;
        const m = threadMsgs[i][j];
        const gid = m.getId();
        if (seenSet.has(gid)) continue;
        const mSec = Math.floor(m.getDate().getTime() / 1000);
        if (mSec < afterSec) continue;

        const fromRaw = m.getFrom() || '';
        const emailMatch = fromRaw.match(/<([^>]+)>/) || fromRaw.match(/([^\\s<>]+@[^\\s<>]+)/);
        const sender = emailMatch ? emailMatch[1].toLowerCase() : fromRaw.toLowerCase();
        const subject = String(m.getSubject() || '').trim();
        const snippet = linearizeHtml_(m.getBody(), m.getPlainBody());

        // Skip non-transaction emails without monetary digits
        if (!/\\b\\d{1,3}([.,]\\d{3})+|\\$\\s*\\d+|\\d+\\s*USD\\b/i.test(subject + '\\n' + snippet)) {
          newIds.push(gid);
          continue;
        }

        const msgId = String(m.getHeader('Message-ID') || '').trim() || ('gmail:' + gid);
        batch.push({
          message_id: msgId.slice(0, 250),
          gmail_id: gid,
          sender: sender.slice(0, 180),
          subject: subject.slice(0, 190),
          received_at: m.getDate().toISOString(),
          snippet: snippet.replace(/\\b(\\d{5,15})(\\d{4})\\b/g, '****$2').slice(0, 850)
        });
        newIds.push(gid);
        matchedInThread = true;
        if (mSec > maxSec) maxSec = mSec;
      }
      if (matchedInThread) touchedThreads.push(threads[i]);
    }

    if (opts && opts.direct) {
      return { ok: true, scannedCount: batch.length, pushedCount: batch.length, items: batch };
    }

    let inserted = 0;
    if (batch.length > 0 && CONFIG.SUPABASE_URL) {
      const res = UrlFetchApp.fetch(CONFIG.SUPABASE_URL.replace(/\\/+$/, '') + '/rest/v1/rpc/coby_inbox_push', {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
        },
        payload: JSON.stringify({
          p_vault_id: CONFIG.VAULT_ID,
          p_ingest_key: CONFIG.INGEST_KEY,
          p_items: batch
        })
      });
      if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
        throw new Error('Supabase HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 160));
      }
      inserted = Number(JSON.parse(res.getContentText() || '{}').inserted || 0);
    }

    if (touchedThreads.length > 0) getOrCreateLabel_(SYNC_LABEL).addToThreads(touchedThreads);
    if (newIds.length > 0) {
      props.setProperties({
        SEEN_IDS: JSON.stringify(seenList.concat(newIds).slice(-350)),
        LAST_EPOCH_SEC: String(Math.max(maxSec, savedSec))
      }, false);
    }
    return { ok: true, scannedCount: batch.length, pushedCount: inserted };
  } finally {
    lock.releaseLock();
  }
}

function linearizeHtml_(html, plain) {
  const src = (html && typeof html === 'string') ? html : (plain || '');
  return src
    .replace(/<!--[\\s\\S]*?-->/g, '')
    .replace(/<(head|style|script|noscript|svg|title)\\b[^>]*>[\\s\\S]*?<\\/\\1>/gi, '')
    .replace(/<(br|hr)\\b[^>]*\\/?>/gi, '\\n')
    .replace(/<\\/t[dh]>\\s*(?=<t[dh]\\b)/gi, ' | ')
    .replace(/<\\/t[dh]>/gi, ' ')
    .replace(/<\\/(tr|p|div|li|table|section|h[1-6])>/gi, '\\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8363;/g, '₫')
    .replace(/https?:\\/\\/\\S+/gi, '')
    .normalize('NFC')
    .split('\\n')
    .map(function(l) { return l.replace(/[ \\t]+/g, ' ').trim(); })
    .filter(Boolean)
    .join('\\n');
}

function getOrCreateLabel_(name) {
  let prefix = '';
  let lbl = null;
  name.split('/').forEach(function(part, idx) {
    prefix = idx === 0 ? part : prefix + '/' + part;
    lbl = GmailApp.getUserLabelByName(prefix) || GmailApp.createLabel(prefix);
  });
  return lbl;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;
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

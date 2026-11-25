import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode } from '../../types';
import {
  CloudDbConfig,
  CloudProvider,
  decodeCloudConfigCode,
  encodeCloudConfigCode,
  isCloudConfigValid,
  SUPABASE_SETUP_SQL,
} from '../../utils/cloudDb';
import { localIsoDate } from '../../utils/format';
import { RepAvatar } from '../Avatar';
import { SlidingSegmented, SwapView } from '../Motion';
import {
  IconAlert,
  IconCheck,
  IconCloud,
  IconCopy,
  IconDatabase,
  IconDownload,
  IconExternal,
  IconLock,
  IconRefresh,
  IconSparkles,
  IconTrash,
  IconUpload,
} from '../Icons';

const AVATAR_OPTIONS = [
  '/images/rep-luca.svg',
  '/images/rep-ananya.svg',
  '/images/rep-kwame.svg',
  '/images/rep-rajiv.svg',
  '/images/rep-abigail.svg',
];

export const SettingsPage: React.FC = () => {
  const {
    authUser,
    signOutWorkspace,
    state,
    route,
    cloudConfig,
    cloudStatus,
    navigate,
    openModal,
    setTheme,
    updateProfile,
    updateSettings,
    lockApp,
    exportUnifiedBackup,
    importUnifiedBackup,
    clearTasksData,
    clearFinanceData,
    clearAllWorkspaceData,
    loadDemoSampleData,
    saveCloudConfig,
    disconnectCloudDb,
    syncCloudNow,
    pushCloudNow,
    pullCloudNow,
    pushToast,
  } = useApp();

  const activeTab =
    route.sub === 'database' ||
    route.sub === 'appearance' ||
    route.sub === 'security' ||
    route.sub === 'data'
      ? route.sub
      : 'profile';

  const [name, setName] = useState(state.settings.profile.name);
  const [tagline, setTagline] = useState(state.settings.profile.tagline);
  const [avatar, setAvatar] = useState(state.settings.profile.avatar);
  const [pinDraft, setPinDraft] = useState(state.settings.pinCode);
  const [confirmAction, setConfirmAction] = useState<null | 'tasks' | 'finance' | 'all' | 'factory'>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud DB form state
  const [dbProvider, setDbProvider] = useState<Exclude<CloudProvider, 'none'>>(
    cloudConfig.provider === 'gist' ? 'gist' : 'supabase'
  );
  const [dbDraft, setDbDraft] = useState<CloudDbConfig>(() => ({
    ...cloudConfig,
    provider: cloudConfig.provider === 'none' ? 'supabase' : cloudConfig.provider,
  }));
  const [dbBusy, setDbBusy] = useState(false);
  const [dbMessage, setDbMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [pairingInput, setPairingInput] = useState('');

  useEffect(() => {
    setDbDraft((prev) => ({
      ...prev,
      ...cloudConfig,
      provider: cloudConfig.provider === 'none' ? dbProvider : cloudConfig.provider,
    }));
    if (cloudConfig.provider !== 'none') {
      setDbProvider(cloudConfig.provider);
    }
  }, [cloudConfig]);

  useEffect(() => {
    setConfirmAction(null);
  }, [activeTab]);

  useEffect(() => {
    setName(state.settings.profile.name);
    setTagline(state.settings.profile.tagline);
    setAvatar(state.settings.profile.avatar);
  }, [
    state.settings.profile.name,
    state.settings.profile.tagline,
    state.settings.profile.avatar,
  ]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfile({ name: name.trim(), tagline: tagline.trim(), avatar });
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinDraft.trim();
    if (clean.length < 4) {
      pushToast('PIN should be at least 4 characters.');
      return;
    }
    updateSettings({ pinCode: clean, pinEnabled: true });
    pushToast('PIN lock enabled');
  };

  const handleExport = () => {
    const json = exportUnifiedBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coby-life-backup-${localIsoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Exported backup (Tasks + Finance)');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importUnifiedBackup(String(reader.result || ''));
      if (!res.ok) {
        pushToast(res.error || 'Could not import backup file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConnectDb = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbBusy(true);
    setDbMessage(null);
    const payload: CloudDbConfig = { ...dbDraft, provider: dbProvider };
    const res = await saveCloudConfig(payload);
    setDbBusy(false);
    setDbMessage({ ok: res.ok, text: res.message });
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setSqlCopied(true);
      pushToast('Copied Supabase SQL schema to clipboard');
      window.setTimeout(() => setSqlCopied(false), 2400);
    } catch {
      setShowSql(true);
      pushToast('Select and copy the SQL block below');
    }
  };

  const handleCopyDeviceCode = async () => {
    if (!isCloudConfigValid(cloudConfig)) {
      pushToast('Connect your Cloud DB first before copying a device code');
      return;
    }
    try {
      await navigator.clipboard.writeText(encodeCloudConfigCode(cloudConfig));
      pushToast('Copied setup code — paste on your phone in Settings → Cloud DB');
    } catch {
      pushToast('Could not copy to clipboard');
    }
  };

  const handleApplyDeviceCode = async () => {
    const decoded = decodeCloudConfigCode(pairingInput);
    if (!decoded || !isCloudConfigValid(decoded)) {
      pushToast('Invalid setup code (should start with COBYDB:)');
      return;
    }
    setDbBusy(true);
    setDbMessage(null);
    const res = await saveCloudConfig(decoded);
    setDbBusy(false);
    setDbMessage({ ok: res.ok, text: res.message });
    if (res.ok) {
      setPairingInput('');
    }
  };

  const isCloudConnected = isCloudConfigValid(cloudConfig);
  const formattedSyncTime = cloudStatus.lastSyncedAt
    ? new Date(cloudStatus.lastSyncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">Settings</h1>
          <p className="phead__sub">
            Coby LIFE stores data locally in IndexedDB and syncs automatically when Cloud DB is
            connected
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <SlidingSegmented
          value={activeTab}
          onChange={(next) => navigate('settings', next)}
          items={[
            { id: 'profile', label: 'Profile' },
            { id: 'database', label: 'Cloud DB' },
            { id: 'appearance', label: 'Appearance' },
            { id: 'security', label: 'PIN Lock' },
            { id: 'data', label: 'Data & Backup' },
          ]}
        />
      </div>

      <SwapView swapKey={activeTab} direction={1}>
        {activeTab === 'profile' && (
          <div className="card" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <RepAvatar src={avatar} name={name} size={56} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{tagline}</div>
              </div>
            </div>

            <form className="form-stack" onSubmit={handleSaveProfile}>
              <label className="field">
                <span className="field__label">Display name</span>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Subtitle</span>
                <input
                  className="input"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </label>

              <div className="field">
                <span className="field__label">Avatar</span>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAvatar(opt)}
                      style={{
                        padding: 3,
                        borderRadius: '50%',
                        border:
                          avatar === opt ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                    >
                      <RepAvatar src={opt} name="Avatar" size={40} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <button type="submit" className="btn btn--primary">
                  Save profile
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="stack-list" style={{ maxWidth: 720, gap: 16 }}>
            {/* Active Coby LIFE Cloud Account Status Card */}
            <div
              className="card form-stack"
              style={{
                borderColor:
                  cloudStatus.state === 'synced'
                    ? 'color-mix(in srgb, var(--accent) 40%, var(--line))'
                    : undefined,
              }}
            >
              <div className="db-status-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    className={`pop-item__icon ${
                      cloudStatus.state === 'synced' ? 'pop-item__icon--accent' : ''
                    }`}
                    style={{ width: 40, height: 40 }}
                  >
                    <IconCloud size={18} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      Coby LIFE Cloud Account
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                      {cloudStatus.state === 'synced'
                        ? `${authUser?.email || 'Cloud account'} · Auto-syncing Tasks + Finance${
                            formattedSyncTime ? ` · Last synced ${formattedSyncTime}` : ''
                          }`
                        : cloudStatus.state === 'syncing'
                          ? `${authUser?.email || 'Cloud account'} · Syncing snapshot with Cloud...`
                          : cloudStatus.state === 'error'
                            ? `${authUser?.email || 'Cloud account'} · ${cloudStatus.error || 'Connection error'}`
                            : `${authUser?.email || 'Signed in'} · Local IndexedDB ${
                                cloudStatus.localDbReady ? 'active' : 'initializing'
                              }`}
                    </div>
                  </div>
                </div>

                <span className={`db-badge db-badge--${cloudStatus.state}`}>
                  <span className="db-badge__dot" />
                  <span>
                    {cloudStatus.state === 'synced'
                      ? 'Synced'
                      : cloudStatus.state === 'syncing'
                        ? 'Syncing'
                        : cloudStatus.state === 'error'
                          ? 'Error'
                          : 'Local DB'}
                  </span>
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => void syncCloudNow()}
                >
                  <IconRefresh size={14} />
                  Sync now
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void pushCloudNow()}
                >
                  <IconUpload size={14} />
                  Push local → Cloud
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void pullCloudNow()}
                >
                  <IconDownload size={14} />
                  Pull Cloud → local
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => void signOutWorkspace()}
                >
                  <IconExternal size={14} />
                  Sign out
                </button>
              </div>
            </div>

            {/* Automated Gmail Transaction Reader */}
            <div className="card form-stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <h3 className="card__title" style={{ fontSize: 15 }}>
                    Gmail Auto-Sync (Bank &amp; Receipt Reader)
                  </h3>
                  <p className="card__sub">
                    Automatically capture Vietnamese bank &amp; e-receipt emails 24/7 via your own
                    Google Apps Script into a write-only Supabase Inbox — zero OAuth popups on Mobile Web.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => openModal({ kind: 'gmail-setup' })}
                >
                  Configure Gmail Sync
                </button>
              </div>
            </div>

            {/* Optional Custom External DB / GitHub Gist */}
            <details className="card form-stack">
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--text)',
                }}
              >
                Advanced: Custom Self-Hosted DB or GitHub Gist ({isCloudConnected ? 'Configured' : 'Optional'})
              </summary>

              <div className="stack-list" style={{ gap: 16, marginTop: 12 }}>
                <p className="card__sub" style={{ margin: 0 }}>
                  Your Coby LIFE Cloud Account already syncs automatically via Supabase RLS. You can
                  optionally configure an additional custom database or Private Gist below.
                </p>

                <div className="seg">
                  <button
                    type="button"
                    className={`seg__btn ${dbProvider === 'supabase' ? 'is-active' : ''}`}
                    onClick={() => setDbProvider('supabase')}
                  >
                    Supabase (Postgres)
                  </button>
                  <button
                    type="button"
                    className={`seg__btn ${dbProvider === 'gist' ? 'is-active' : ''}`}
                    onClick={() => setDbProvider('gist')}
                  >
                    GitHub Gist
                  </button>
                </div>

                {dbProvider === 'supabase' ? (
                  <form className="form-stack" onSubmit={handleConnectDb}>
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: 'var(--well)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            Step 1 — Create custom vault table (one-time SQL)
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Free tier on supabase.com (500 MB Postgres). Run once in SQL Editor.
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={handleCopySql}
                          >
                            {sqlCopied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            {sqlCopied ? 'Copied SQL' : 'Copy SQL'}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setShowSql((v) => !v)}
                          >
                            {showSql ? 'Hide' : 'View SQL'}
                          </button>
                        </div>
                      </div>
                      {showSql && <pre className="sql-box">{SUPABASE_SETUP_SQL}</pre>}
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span className="field__label">Supabase Project URL</span>
                        <input
                          className="input"
                          placeholder="https://xxxxx.supabase.co"
                          value={dbDraft.supabaseUrl}
                          onChange={(e) =>
                            setDbDraft((d) => ({ ...d, supabaseUrl: e.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">Vault ID</span>
                        <input
                          className="input"
                          placeholder="coby-main"
                          value={dbDraft.supabaseVaultId}
                          onChange={(e) =>
                            setDbDraft((d) => ({ ...d, supabaseVaultId: e.target.value }))
                          }
                        />
                      </label>
                    </div>

                    <label className="field">
                      <span className="field__label">Supabase Anon Key</span>
                      <input
                        className="input"
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={dbDraft.supabaseAnonKey}
                        onChange={(e) =>
                          setDbDraft((d) => ({ ...d, supabaseAnonKey: e.target.value }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span className="field__label">Personal Vault Secret (min 4 chars)</span>
                      <input
                        className="input"
                        type="password"
                        placeholder="Private passphrase protecting your Postgres row (SHA-256 hashed)"
                        value={dbDraft.supabaseSecret}
                        onChange={(e) =>
                          setDbDraft((d) => ({ ...d, supabaseSecret: e.target.value }))
                        }
                      />
                    </label>

                    {dbMessage && (
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: dbMessage.ok ? 'var(--good)' : 'var(--bad)',
                        }}
                      >
                        {dbMessage.text}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="submit" className="btn btn--primary btn--sm" disabled={dbBusy}>
                        <IconDatabase size={14} />
                        {dbBusy ? 'Connecting...' : 'Save Custom Supabase'}
                      </button>
                      {isCloudConnected && (
                        <>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={handleCopyDeviceCode}
                          >
                            <IconCopy size={14} />
                            Copy COBYDB code
                          </button>
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={disconnectCloudDb}
                          >
                            Disconnect Custom DB
                          </button>
                        </>
                      )}
                    </div>
                  </form>
                ) : (
                  <form className="form-stack" onSubmit={handleConnectDb}>
                    <p className="field__hint" style={{ margin: 0 }}>
                      Uses a <strong>Secret (Private) Gist</strong> on your own GitHub account.
                    </p>
                    <label className="field">
                      <span className="field__label">GitHub Personal Access Token (gist scope)</span>
                      <input
                        className="input"
                        type="password"
                        placeholder="ghp_... or github_pat_..."
                        value={dbDraft.gistToken}
                        onChange={(e) => setDbDraft((d) => ({ ...d, gistToken: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Existing Gist ID (optional)</span>
                      <input
                        className="input"
                        placeholder="Leave empty on first device to auto-create a private Gist"
                        value={dbDraft.gistId}
                        onChange={(e) => setDbDraft((d) => ({ ...d, gistId: e.target.value }))}
                      />
                    </label>

                    {dbMessage && (
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: dbMessage.ok ? 'var(--good)' : 'var(--bad)',
                        }}
                      >
                        {dbMessage.text}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="submit" className="btn btn--primary btn--sm" disabled={dbBusy}>
                        <IconDatabase size={14} />
                        {dbBusy ? 'Connecting...' : 'Save Custom Gist'}
                      </button>
                      {isCloudConnected && (
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={disconnectCloudDb}
                        >
                          Disconnect Custom DB
                        </button>
                      )}
                    </div>
                  </form>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 200 }}
                    placeholder="Paste COBYDB:... custom setup code"
                    value={pairingInput}
                    onChange={(e) => setPairingInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={dbBusy || !pairingInput.trim()}
                    onClick={() => void handleApplyDeviceCode()}
                  >
                    Apply code
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="card form-stack" style={{ maxWidth: 640 }}>
            <div>
              <h2 className="card__title">Theme</h2>
              <p className="card__sub" style={{ marginBottom: 12 }}>
                Switch between Dark (Smoked Glass) and Light (Milk Glass) across Coby LIFE.
              </p>
              <div className="seg">
                <button
                  type="button"
                  className={`seg__btn ${state.settings.theme === 'dark' ? 'is-active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  Dark (Smoked Glass)
                </button>
                <button
                  type="button"
                  className={`seg__btn ${state.settings.theme === 'light' ? 'is-active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  Light (Milk Glass)
                </button>
              </div>
            </div>

            <div style={{ paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <h2 className="card__title">Display currency</h2>
              <p className="card__sub" style={{ marginBottom: 12 }}>
                Used across Finance and Overview cards.
              </p>
              <div className="seg">
                {(['VND', 'USD'] as CurrencyCode[]).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    className={`seg__btn ${state.settings.currency === cur ? 'is-active' : ''}`}
                    onClick={() => {
                      updateSettings({ currency: cur });
                      pushToast(`Currency set to ${cur}`);
                    }}
                  >
                    {cur === 'VND' ? 'Vietnamese Dong (₫)' : 'US Dollar ($)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="card form-stack" style={{ maxWidth: 640 }}>
            <div>
              <h2 className="card__title">Personal PIN lock</h2>
              <p className="card__sub">
                Optionally require a PIN on page load to keep your personal workspace private on
                shared devices.
              </p>
            </div>

            <form className="form-stack" onSubmit={handleSavePin}>
              <label className="field">
                <span className="field__label">PIN (at least 4 characters)</span>
                <input
                  type="password"
                  className="input"
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value)}
                  placeholder="e.g. 1234"
                />
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn--primary">
                  <IconLock size={15} />
                  {state.settings.pinEnabled ? 'Update PIN' : 'Enable PIN lock'}
                </button>
                {state.settings.pinEnabled && (
                  <>
                    <button type="button" className="btn btn--ghost" onClick={lockApp}>
                      Lock now
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => {
                        updateSettings({ pinEnabled: false });
                        pushToast('PIN lock disabled');
                      }}
                    >
                      Disable PIN
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        )}

        {activeTab === 'data' && (() => {
          const clearRows: Array<{
            id: 'tasks' | 'finance' | 'all' | 'factory';
            title: string;
            badge?: string;
            description: string;
            actionLabel: string;
            confirmLabel: string;
            busyLabel?: string;
            icon: React.ReactNode;
            isFactory?: boolean;
            onConfirm: () => void | Promise<void>;
          }> = [
            {
              id: 'tasks',
              title: 'Clear Tasks',
              badge: `${state.tasks.length} tasks`,
              description:
                'Remove all tasks and subtasks while keeping Finance, Wallets & Settings.',
              actionLabel: 'Clear Tasks',
              confirmLabel: 'Confirm Clear',
              icon: <IconTrash size={14} />,
              onConfirm: () => clearTasksData(),
            },
            {
              id: 'finance',
              title: 'Clear Finance & Inbox',
              badge: `${state.finance.transactions.length} tx · ${state.finance.inbox.length} inbox`,
              description:
                'Clear transactions, budgets, recurring bills & Gmail Inbox, and reset all wallets to 0.',
              actionLabel: 'Clear Finance',
              confirmLabel: 'Confirm Clear',
              icon: <IconTrash size={14} />,
              onConfirm: () => clearFinanceData(),
            },
            {
              id: 'all',
              title: 'Clear All Workspace Data',
              description:
                'Wipe Tasks, Finance & Future Modules, reset wallets to 0, clear local IndexedDB snapshot, and sync wipe to Cloud.',
              actionLabel: 'Clear Workspace',
              confirmLabel: 'Confirm Wipe',
              busyLabel: 'Clearing...',
              icon: <IconRefresh size={14} />,
              onConfirm: () => clearAllWorkspaceData(),
            },
            {
              id: 'factory',
              title: 'Factory Reset Device',
              description:
                'Wipe local browser cache, credentials, and sign out of this device.',
              actionLabel: 'Factory Reset',
              confirmLabel: 'Confirm Reset',
              busyLabel: 'Resetting...',
              icon: <IconAlert size={14} />,
              isFactory: true,
              onConfirm: () => clearAllWorkspaceData({ factoryReset: true }),
            },
          ];

          return (
            <div className="stack-list" style={{ maxWidth: 680, gap: 16 }}>
              <div className="card form-stack">
                <div>
                  <h2 className="card__title">All-in-One Backup &amp; Restore</h2>
                  <p className="card__sub">
                    Export a single JSON snapshot containing{' '}
                    <strong>Tasks ({state.tasks.length})</strong>,{' '}
                    <strong>Finance ({state.finance.transactions.length} transactions)</strong>, and{' '}
                    <strong>Settings</strong>.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn--primary" onClick={handleExport}>
                    <IconDownload size={15} />
                    Export full backup (.json)
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <IconUpload size={15} />
                    Import backup
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={handleImportFile}
                  />
                </div>
              </div>

              <div className="card form-stack">
                <div>
                  <h2 className="card__title">Clear Data &amp; Reset</h2>
                  <p className="card__sub">
                    Choose exactly what to wipe. Tasks and Finance clears support instant Undo;
                    full workspace resets clear local snapshots cleanly.
                  </p>
                </div>

                <div className="stack-list" style={{ gap: 10 }}>
                  {clearRows.map((row) => {
                    const isConfirming = confirmAction === row.id;
                    return (
                      <div
                        key={row.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: row.isFactory
                            ? 'color-mix(in srgb, var(--coral) 10%, var(--well))'
                            : 'var(--well)',
                          border: row.isFactory
                            ? '1px solid color-mix(in srgb, var(--coral) 32%, var(--line))'
                            : '1px solid var(--line)',
                        }}
                      >
                        <div style={{ minWidth: 200, flex: '1 1 260px' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontWeight: 700,
                                fontSize: 13.5,
                                color: row.isFactory ? 'var(--bad)' : 'var(--text)',
                              }}
                            >
                              {row.isFactory && <IconAlert size={14} />}
                              <span>{row.title}</span>
                            </span>
                            {row.badge && <span className="pill pill--muted">{row.badge}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                            {row.description}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {isConfirming ? (
                            <>
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                disabled={resetBusy}
                                onClick={async () => {
                                  setResetBusy(true);
                                  try {
                                    await row.onConfirm();
                                  } finally {
                                    setResetBusy(false);
                                    setConfirmAction(null);
                                  }
                                }}
                              >
                                {resetBusy && row.busyLabel ? row.busyLabel : row.confirmLabel}
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                disabled={resetBusy}
                                onClick={() => setConfirmAction(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              disabled={resetBusy}
                              onClick={() => setConfirmAction(row.id)}
                            >
                              {row.icon}
                              {row.actionLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    paddingTop: 12,
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Want realistic sample tasks, budgets &amp; wallets to explore?
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={resetBusy}
                    onClick={() => {
                      setConfirmAction(null);
                      loadDemoSampleData();
                    }}
                  >
                    <IconSparkles size={14} />
                    Load demo sample data
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </SwapView>
    </>
  );
};

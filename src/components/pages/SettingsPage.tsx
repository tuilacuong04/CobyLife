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
  IconCheck,
  IconCopy,
  IconDatabase,
  IconDownload,
  IconLock,
  IconRefresh,
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
    state,
    route,
    cloudConfig,
    cloudStatus,
    navigate,
    setTheme,
    updateProfile,
    updateSettings,
    lockApp,
    exportUnifiedBackup,
    importUnifiedBackup,
    clearToEmpty,
    resetStarterData,
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
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
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
            {/* Live DB Status Card */}
            <div className="card form-stack">
              <div className="db-status-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    className={`pop-item__icon ${
                      cloudStatus.state === 'synced' ? 'pop-item__icon--accent' : ''
                    }`}
                    style={{ width: 40, height: 40 }}
                  >
                    <IconDatabase size={18} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {isCloudConnected
                        ? cloudConfig.provider === 'supabase'
                          ? 'Supabase PostgreSQL'
                          : 'GitHub Private Gist DB'
                        : 'Local IndexedDB only'}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                      {cloudStatus.state === 'synced'
                        ? `Auto-syncing Tasks + Finance${formattedSyncTime ? ` · Last synced ${formattedSyncTime}` : ''}`
                        : cloudStatus.state === 'syncing'
                          ? 'Syncing snapshot with Cloud DB...'
                          : cloudStatus.state === 'error'
                            ? cloudStatus.error || 'Connection error'
                            : `Local IndexedDB ${cloudStatus.localDbReady ? 'active' : 'initializing'} — connect a Cloud DB below to sync phone & laptop`}
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

              {isCloudConnected && (
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
                    Push local → DB
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => void pullCloudNow()}
                  >
                    <IconDownload size={14} />
                    Pull DB → local
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={handleCopyDeviceCode}
                  >
                    <IconCopy size={14} />
                    Copy device code
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={disconnectCloudDb}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {/* Cloud Provider Configuration */}
            <div className="card form-stack">
              <div>
                <h2 className="card__title">Personal Cloud Database</h2>
                <p className="card__sub">
                  Store your entire personal workspace (<strong>Tasks</strong>,{' '}
                  <strong>Finance</strong> &amp; <strong>Settings</strong>) in your own private
                  database. Credentials stay only on your devices.
                </p>
              </div>

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
                          Step 1 — Create secure vault table (one-time SQL)
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
                    <span className="field__hint">
                      Only devices with this exact passphrase can pull or overwrite your database.
                    </span>
                  </label>

                  <label className="signin__check">
                    <input
                      type="checkbox"
                      checked={dbDraft.autoSync}
                      onChange={(e) =>
                        setDbDraft((d) => ({ ...d, autoSync: e.target.checked }))
                      }
                    />
                    <span>Auto-sync automatically after changes &amp; on app open</span>
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

                  <div>
                    <button type="submit" className="btn btn--primary" disabled={dbBusy}>
                      <IconDatabase size={15} />
                      {dbBusy ? 'Connecting...' : 'Connect & Sync Supabase DB'}
                    </button>
                  </div>
                </form>
              ) : (
                <form className="form-stack" onSubmit={handleConnectDb}>
                  <p className="field__hint" style={{ margin: 0 }}>
                    Uses a <strong>Secret (Private) Gist</strong> on your own GitHub account as a
                    zero-cost JSON database. Create a GitHub token with only the <code>gist</code>{' '}
                    permission.
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
                  <label className="signin__check">
                    <input
                      type="checkbox"
                      checked={dbDraft.autoSync}
                      onChange={(e) =>
                        setDbDraft((d) => ({ ...d, autoSync: e.target.checked }))
                      }
                    />
                    <span>Auto-sync automatically after changes &amp; on app open</span>
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

                  <div>
                    <button type="submit" className="btn btn--primary" disabled={dbBusy}>
                      <IconDatabase size={15} />
                      {dbBusy ? 'Connecting...' : 'Connect & Sync Private Gist'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Quick Phone / Laptop Device Pairing */}
            <div className="card form-stack">
              <div>
                <h3 className="card__title" style={{ fontSize: 15 }}>
                  Link another device (Phone ↔ Laptop)
                </h3>
                <p className="card__sub">
                  Already connected on one device? Tap <strong>Copy device code</strong> above, then
                  paste it here on your second device to connect in 1 tap.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 200 }}
                  placeholder="Paste COBYDB:... setup code"
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

        {activeTab === 'data' && (
          <div className="card form-stack" style={{ maxWidth: 680 }}>
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

            <div style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <h3 className="card__title" style={{ fontSize: 15 }}>
                Clear sample Tasks &amp; Finance data
              </h3>
              <p className="card__sub" style={{ marginBottom: 12 }}>
                Wipes starter tasks and sample transactions so you can start logging your own real
                data cleanly.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!confirmClear ? (
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => setConfirmClear(true)}
                  >
                    Start fresh (Clear sample data)
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => {
                        clearToEmpty();
                        setConfirmClear(false);
                      }}
                    >
                      Confirm clear
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setConfirmClear(false)}
                    >
                      Cancel
                    </button>
                  </>
                )}

                {!confirmReset ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setConfirmReset(true)}
                  >
                    Restore sample data
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      resetStarterData();
                      setConfirmReset(false);
                    }}
                  >
                    Confirm restore
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </SwapView>
    </>
  );
};

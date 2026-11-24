import React, { useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode } from '../../types';
import { localIsoDate } from '../../utils/format';
import { RepAvatar } from '../Avatar';
import { SlidingSegmented, SwapView } from '../Motion';
import { IconDownload, IconLock, IconUpload } from '../Icons';

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
    gym,
    route,
    navigate,
    setTheme,
    updateProfile,
    updateSettings,
    lockApp,
    exportUnifiedBackup,
    importUnifiedBackup,
    clearToEmpty,
    resetStarterData,
    pushToast,
  } = useApp();

  const activeTab =
    route.sub === 'appearance' || route.sub === 'security' || route.sub === 'data'
      ? route.sub
      : 'profile';

  const [name, setName] = useState(state.settings.profile.name);
  const [tagline, setTagline] = useState(state.settings.profile.tagline);
  const [avatar, setAvatar] = useState(state.settings.profile.avatar);
  const [pinDraft, setPinDraft] = useState(state.settings.pinCode);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    a.download = `sylva-personal-os-backup-${localIsoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Exported unified backup (openGym + Tasks + Finance)');
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

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">Settings</h1>
          <p className="phead__sub">
            All personal data stays locally in your browser — nothing leaves your device
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <SlidingSegmented
          value={activeTab}
          onChange={(next) => navigate('settings', next)}
          items={[
            { id: 'profile', label: 'Profile' },
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

        {activeTab === 'appearance' && (
          <div className="card form-stack" style={{ maxWidth: 640 }}>
            <div>
              <h2 className="card__title">Theme</h2>
              <p className="card__sub" style={{ marginBottom: 12 }}>
                Syncs Dark / Light mode across the hub and embedded openGym.
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
              <h2 className="card__title">All-in-One Backup & Restore</h2>
              <p className="card__sub">
                Export a single JSON snapshot containing{' '}
                <strong>openGym ({gym.workoutsCount} workouts)</strong>,{' '}
                <strong>Tasks ({state.tasks.length})</strong>, and{' '}
                <strong>Finance ({state.finance.transactions.length} transactions)</strong>.
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
                Clear sample Tasks & Finance data
              </h3>
              <p className="card__sub" style={{ marginBottom: 12 }}>
                Wipes starter tasks and sample transactions so you can start logging your own real
                data cleanly (keeps openGym untouched).
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

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCrm } from '../../store/CrmContext';
import { SpaceId, ThemeMode, WeekStart } from '../../types';
import { formatKrCompact, isCurrentMonth, triggerDownload } from '../../utils/format';
import { animateCards, gsap, isReducedMotion } from '../../utils/motion';
import { RepAvatar } from '../Avatar';
import { AnimatedTitle, SlidingSeg, SlidingTabs, SwapView } from '../Motion';
import { IconDownload, IconMoon, IconSpaceGlyph, IconSun } from '../Icons';

type SettingsTab = 'profile' | 'workspace' | 'notifications' | 'appearance' | 'data';

const SPACE_IDS: SpaceId[] = ['nordlys', 'fjellgronn', 'glod'];
const TAB_ORDER: Record<SettingsTab, number> = {
  profile: 0,
  workspace: 1,
  notifications: 2,
  appearance: 3,
  data: 4,
};

export const SettingsPage: React.FC = () => {
  const {
    state,
    space,
    route,
    navigate,
    switchSpace,
    setTheme,
    setWeekStartsOn,
    updateProfile,
    updateNotificationPrefs,
    updateMonthlyTarget,
    resetDemoData,
    pushToast,
  } = useCrm();

  const validTabs: SettingsTab[] = ['profile', 'workspace', 'notifications', 'appearance', 'data'];
  const activeTab: SettingsTab = validTabs.includes(route.sub as SettingsTab)
    ? (route.sub as SettingsTab)
    : 'profile';

  const [tabDir, setTabDir] = useState(1);
  const [name, setName] = useState(state.settings.profile.name);
  const [role, setRole] = useState(state.settings.profile.role);
  const [email, setEmail] = useState(state.settings.profile.email);
  const [target, setTarget] = useState(String(space.monthlyTarget));
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTarget(String(space.monthlyTarget));
  }, [space.id, space.monthlyTarget]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      animateCards(el.querySelectorAll('.card'));
    }, el);
    return () => ctx.revert();
  }, [activeTab, space.id]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: name.trim() || state.settings.profile.name,
      role: role.trim() || state.settings.profile.role,
      email: email.trim() || state.settings.profile.email,
    });
  };

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(target);
    if (!Number.isNaN(num) && num > 0) updateMonthlyTarget(num);
  };

  const handleExportJson = () => {
    triggerDownload(
      `sylva-workspace-${space.id}.json`,
      JSON.stringify(state, null, 2),
      'application/json;charset=utf-8'
    );
    pushToast('Data exported');
  };

  return (
    <div>
      <div className="phead">
        <div>
          <AnimatedTitle text="Settings" mark="teal" animKey={`${space.id}-st`} />
          <p className="phead__sub">Your profile, this workspace and how Sylva behaves.</p>
        </div>
      </div>

      <SlidingTabs
        activeId={activeTab}
        onChange={(id) => {
          setTabDir(TAB_ORDER[id] >= TAB_ORDER[activeTab] ? 1 : -1);
          navigate('settings', id);
        }}
        items={[
          { id: 'profile', label: 'Profile' },
          { id: 'workspace', label: 'Workspace' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'appearance', label: 'Appearance' },
          { id: 'data', label: 'Data' },
        ]}
      />

      <div ref={contentRef}>
        <SwapView swapKey={activeTab} direction={tabDir}>
          {activeTab === 'profile' && (
            <div className="card settings-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <RepAvatar
                  src={state.settings.profile.avatar}
                  name={state.settings.profile.name}
                  size={52}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {state.settings.profile.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--faint)' }}>
                    {state.settings.profile.role}
                  </div>
                </div>
              </div>

              <form className="form-stack" onSubmit={handleSaveProfile}>
                <div className="form-grid">
                  <label className="field">
                    <span className="field__label">Name</span>
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Role</span>
                    <input
                      className="input"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">Email</span>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <span className="field__hint">You sign in with this address.</span>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button type="submit" className="btn btn--primary">
                    Save profile
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gut)' }}>
              <div className="card settings-card">
                <h2 className="card__title">Spaces</h2>
                <p className="card__sub" style={{ marginBottom: 16 }}>
                  Each space is its own pipeline, team and contacts. Switch from the sidebar or
                  here.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {SPACE_IDS.map((sid) => {
                    const sp = state.spaces[sid];
                    const isCurr = sp.id === space.id;
                    const wonMonth = sp.deals
                      .filter((d) => d.stage === 'won' && isCurrentMonth(d.closeDate))
                      .reduce((s, d) => s + d.value, 0);

                    return (
                      <div
                        key={sid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 16,
                          background: 'var(--well)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className={`space-tile space-tile--${sp.tone}`}>
                            <IconSpaceGlyph icon={sp.icon} size={17} />
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{sp.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--faint)' }}>
                              {sp.tagline} · {sp.city} · {sp.reps.length} people ·{' '}
                              {formatKrCompact(wonMonth)} won this month
                            </div>
                          </div>
                        </div>

                        {isCurr ? (
                          <span className="pill pill--lime">Current</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => switchSpace(sid)}
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card settings-card">
                <h2 className="card__title">Monthly target</h2>
                <form onSubmit={handleSaveTarget} style={{ marginTop: 12 }}>
                  <label className="field__label" htmlFor="ws-target">
                    Kroner per month
                  </label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    <input
                      id="ws-target"
                      className="input"
                      type="number"
                      min="10000"
                      step="10000"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    />
                    <button type="submit" className="btn btn--primary">
                      Save
                    </button>
                  </div>
                  <p className="field__hint" style={{ marginTop: 8 }}>
                    Shown on Overview and Team.
                  </p>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card settings-card">
              <h2 className="card__title" style={{ marginBottom: 8 }}>
                Notifications
              </h2>

              {(
                [
                  [
                    'dealsWon',
                    'Deals won',
                    'Celebrate when any rep closes a deal in your active space.',
                  ],
                  [
                    'quoteReplies',
                    'Quote replies',
                    'Notify when a client accepts or declines a sent quote.',
                  ],
                  [
                    'dueActivities',
                    'Due activities',
                    'Daily morning summary of overdue and today tasks.',
                  ],
                  [
                    'weeklyDigest',
                    'Weekly digest',
                    'Pipeline movement and weighted forecast every Monday.',
                  ],
                ] as const
              ).map(([key, title, desc]) => {
                const on = state.settings.notifications[key];
                return (
                  <div key={key} className="setting-row">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>{desc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      className={`switch ${on ? 'is-on' : ''}`}
                      onClick={() => updateNotificationPrefs({ [key]: !on })}
                    >
                      <span className="switch__knob" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="card settings-card">
              <h2 className="card__title" style={{ marginBottom: 8 }}>
                Appearance
              </h2>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Theme</div>
                  <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>
                    Smoked glass or milk glass over the forest.
                  </div>
                </div>

                <SlidingSeg<ThemeMode>
                  ariaLabel="Theme"
                  activeId={state.settings.theme}
                  onChange={setTheme}
                  items={[
                    { id: 'dark', label: 'Dark', icon: <IconMoon size={14} /> },
                    { id: 'light', label: 'Light', icon: <IconSun size={14} /> },
                  ]}
                />
              </div>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Week starts on</div>
                  <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>
                    Used by the week view in Activities.
                  </div>
                </div>

                <SlidingSeg<WeekStart>
                  ariaLabel="Week starts on"
                  activeId={state.settings.weekStartsOn}
                  onChange={setWeekStartsOn}
                  items={[
                    { id: 'monday', label: 'Monday' },
                    { id: 'sunday', label: 'Sunday' },
                  ]}
                />
              </div>

              <p className="field__hint" style={{ marginTop: 14 }}>
                Motion follows your system&apos;s Reduce Motion setting. ⌘B folds the sidebar into
                the dock.
              </p>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="card settings-card">
              <h2 className="card__title" style={{ marginBottom: 8 }}>
                Data
              </h2>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Export workspace JSON</div>
                  <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>
                    Downloads all three spaces, deals, contacts, quotes and preferences.
                  </div>
                </div>
                <button type="button" className="btn btn--glass btn--sm" onClick={handleExportJson}>
                  <IconDownload size={14} />
                  Export
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Reset sample data</div>
                  <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>
                    Puts the sample workspaces back as they were. Your theme stays.
                  </div>
                </div>
                <button type="button" className="btn btn--danger btn--sm" onClick={resetDemoData}>
                  Reset
                </button>
              </div>
            </div>
          )}
        </SwapView>
      </div>
    </div>
  );
};

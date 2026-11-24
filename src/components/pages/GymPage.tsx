import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { assetUrl } from '../../utils/assets';
import { IconExternal, IconFlame } from '../Icons';

const GYM_QUICK_VIEWS = [
  { id: 'home', label: 'Home', hash: '#/home' },
  { id: 'plan', label: 'Plan', hash: '#/plan' },
  { id: 'workout', label: 'Workout', hash: '#/workout' },
  { id: 'library', label: 'Exercises', hash: '#/library' },
  { id: 'muscles', label: 'Muscles', hash: '#/muscles' },
  { id: 'stats', label: 'Stats', hash: '#/stats' },
  { id: 'measurements', label: 'Body', hash: '#/measurements' },
  { id: 'history', label: 'History', hash: '#/history' },
  { id: 'tools', label: 'Tools', hash: '#/tools' },
  { id: 'settings', label: 'Gym Settings', hash: '#/settings' },
];

export const GymWorkspace: React.FC<{ active: boolean }> = ({ active }) => {
  const { state, gym, gymHashTarget, registerGymFrame, openGymView, refreshGymSnapshot } = useApp();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loaded, setLoaded] = useState(false);

  const initialSrcRef = useRef<string>('');
  if (!initialSrcRef.current) {
    initialSrcRef.current = `${assetUrl('/opengym/index.html')}${gymHashTarget || '#/home'}`;
  }

  useEffect(() => {
    const clean = gymHashTarget.replace(/^#\/?/, '').split('/')[0] || 'home';
    setActiveTab(clean);
  }, [gymHashTarget]);

  useEffect(() => {
    registerGymFrame(iframeRef.current);
    return () => registerGymFrame(null);
  }, [registerGymFrame]);

  useEffect(() => {
    if (active) {
      refreshGymSnapshot();
    }
  }, [active, refreshGymSnapshot]);

  const handleLoad = () => {
    setLoaded(true);
    registerGymFrame(iframeRef.current);
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'hub:set-theme', theme: state.settings.theme },
        window.location.origin
      );
    } catch {
      // Ignore
    }
    window.setTimeout(refreshGymSnapshot, 400);
  };

  return (
    <div
      className="gym-workspace"
      style={{ display: active ? 'flex' : 'none' }}
      aria-hidden={!active}
    >
      <div className="gym-toolbar">
        <div className="gym-toolbar__tabs" role="tablist" aria-label="openGym quick navigation">
          {GYM_QUICK_VIEWS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`gym-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                openGymView(tab.hash);
              }}
            >
              {tab.label}
              {tab.id === 'workout' && gym.activeWorkout && <span className="gym-live-dot" />}
            </button>
          ))}
        </div>

        <div className="gym-toolbar__right">
          {gym.available && (
            <span className="pill pill--muted" style={{ fontSize: 11.5 }}>
              <IconFlame size={13} />
              {gym.workoutsThisWeek}/{gym.weekTarget} this week
            </span>
          )}
          <a
            href={assetUrl('/opengym/index.html')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost"
            style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
            title="Open openGym full-screen in a new tab"
          >
            <IconExternal size={14} />
            Full screen
          </a>
        </div>
      </div>

      <div className="gym-frame-shell">
        {!loaded && (
          <div className="gym-loading">
            <div className="gym-loading__dot" />
            <span>Loading openGym (5,600+ exercises)...</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={initialSrcRef.current}
          title="openGym — Workout Tracker"
          className="gym-iframe"
          onLoad={handleLoad}
          allow="fullscreen; wake-lock; vibrate"
        />
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { assetUrl } from '../../utils/assets';
import { IconExternal, IconFlame } from '../Icons';

const GYM_QUICK_VIEWS = [
  { id: 'home', label: 'Trang chủ', hash: '#/home' },
  { id: 'plan', label: 'Lịch tập', hash: '#/plan' },
  { id: 'workout', label: 'Đang tập', hash: '#/workout' },
  { id: 'library', label: '5.6K Bài tập', hash: '#/library' },
  { id: 'muscles', label: 'Bản đồ cơ', hash: '#/muscles' },
  { id: 'stats', label: 'Thống kê', hash: '#/stats' },
  { id: 'measurements', label: 'Số đo', hash: '#/measurements' },
  { id: 'history', label: 'Lịch sử', hash: '#/history' },
  { id: 'tools', label: 'Công cụ', hash: '#/tools' },
  { id: 'settings', label: 'Cài đặt Gym', hash: '#/settings' },
];

export const GymWorkspace: React.FC<{ active: boolean }> = ({ active }) => {
  const { state, gym, gymHashTarget, registerGymFrame, openGymView, refreshGymSnapshot } = useApp();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loaded, setLoaded] = useState(false);

  // Build iframe URL once from initial hash target so switching hub tabs NEVER reloads openGym
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
        <div className="gym-toolbar__tabs" role="tablist" aria-label="Điều hướng nhanh openGym">
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
              {gym.workoutsThisWeek}/{gym.weekTarget} tuần này
            </span>
          )}
          <a
            href={assetUrl('/opengym/index.html')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost"
            style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
            title="Mở openGym trong tab riêng toàn màn hình"
          >
            <IconExternal size={14} />
            Toàn màn hình
          </a>
        </div>
      </div>

      <div className="gym-frame-shell">
        {!loaded && (
          <div className="gym-loading">
            <div className="gym-loading__dot" />
            <span>Đang khởi chạy openGym (5.600+ bài tập)...</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={initialSrcRef.current}
          title="openGym — Theo dõi tập luyện"
          className="gym-iframe"
          onLoad={handleLoad}
          allow="fullscreen; wake-lock; vibrate"
        />
      </div>
    </div>
  );
};

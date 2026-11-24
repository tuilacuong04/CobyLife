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
      pushToast('Mã PIN nên có ít nhất 4 ký tự.');
      return;
    }
    updateSettings({ pinCode: clean, pinEnabled: true });
    pushToast('Đã bật khóa PIN cá nhân');
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
    pushToast('Đã xuất file sao lưu toàn bộ (openGym + Tasks + Chi tiêu)');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importUnifiedBackup(String(reader.result || ''));
      if (!res.ok) {
        pushToast(res.error || 'Không thể nhập file sao lưu');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">Cài đặt cá nhân</h1>
          <p className="phead__sub">
            Toàn bộ dữ liệu lưu riêng trên trình duyệt của bạn — không gửi lên máy chủ ngoài
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <SlidingSegmented
          value={activeTab}
          onChange={(next) => navigate('settings', next)}
          items={[
            { id: 'profile', label: 'Hồ sơ' },
            { id: 'appearance', label: 'Giao diện & Tiền tệ' },
            { id: 'security', label: 'Khóa riêng tư (PIN)' },
            { id: 'data', label: 'Sao lưu & Dữ liệu' },
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
                <span className="field__label">Tên hiển thị</span>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Khẩu hiệu / mô tả ngắn</span>
                <input
                  className="input"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </label>

              <div className="field">
                <span className="field__label">Chọn ảnh đại diện</span>
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
                  Lưu hồ sơ
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="card form-stack" style={{ maxWidth: 640 }}>
            <div>
              <h2 className="card__title">Giao diện Smoked Glass / Milk Glass</h2>
              <p className="card__sub" style={{ marginBottom: 12 }}>
                Tự động đồng bộ Dark / Light cho cả không gian chính và module openGym.
              </p>
              <div className="seg">
                <button
                  type="button"
                  className={`seg__btn ${state.settings.theme === 'dark' ? 'is-active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  Tối (Smoked Glass)
                </button>
                <button
                  type="button"
                  className={`seg__btn ${state.settings.theme === 'light' ? 'is-active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  Sáng (Milk Glass)
                </button>
              </div>
            </div>

            <div style={{ paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <h2 className="card__title">Đơn vị tiền tệ hiển thị</h2>
              <p className="card__sub" style={{ marginBottom: 12 }}>
                Áp dụng cho module Quản lí chi tiêu và Tổng quan.
              </p>
              <div className="seg">
                {(['VND', 'USD'] as CurrencyCode[]).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    className={`seg__btn ${state.settings.currency === cur ? 'is-active' : ''}`}
                    onClick={() => {
                      updateSettings({ currency: cur });
                      pushToast(`Đã đổi tiền tệ sang ${cur}`);
                    }}
                  >
                    {cur === 'VND' ? 'Việt Nam Đồng (₫)' : 'US Dollar ($)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="card form-stack" style={{ maxWidth: 640 }}>
            <div>
              <h2 className="card__title">Khóa màn hình cá nhân bằng PIN</h2>
              <p className="card__sub">
                Tùy chọn yêu cầu nhập mã PIN mỗi lần mở trang để bảo vệ dữ liệu cá nhân trên thiết bị
                dùng chung.
              </p>
            </div>

            <form className="form-stack" onSubmit={handleSavePin}>
              <label className="field">
                <span className="field__label">Mã PIN (tối thiểu 4 số/ký tự)</span>
                <input
                  type="password"
                  className="input"
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value)}
                  placeholder="VD: 1234"
                />
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn--primary">
                  <IconLock size={15} />
                  {state.settings.pinEnabled ? 'Cập nhật mã PIN' : 'Bật khóa PIN'}
                </button>
                {state.settings.pinEnabled && (
                  <>
                    <button type="button" className="btn btn--ghost" onClick={lockApp}>
                      Khóa ngay
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => {
                        updateSettings({ pinEnabled: false });
                        pushToast('Đã tắt khóa PIN');
                      }}
                    >
                      Tắt khóa PIN
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
              <h2 className="card__title">Sao lưu & Khôi phục hợp nhất (All-in-One)</h2>
              <p className="card__sub">
                Xuất 1 file JSON duy nhất chứa đồng thời toàn bộ dữ liệu{' '}
                <strong>openGym ({gym.workoutsCount} buổi tập)</strong>,{' '}
                <strong>Task ({state.tasks.length})</strong> và{' '}
                <strong>Chi tiêu ({state.finance.transactions.length} giao dịch)</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--primary" onClick={handleExport}>
                <IconDownload size={15} />
                Xuất sao lưu toàn bộ (.json)
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconUpload size={15} />
                Nhập từ file sao lưu
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
                Dọn dữ liệu mẫu Tasks & Chi tiêu
              </h3>
              <p className="card__sub" style={{ marginBottom: 12 }}>
                Dùng nút này khi bạn muốn xóa sạch task & giao dịch mẫu để bắt đầu nhập dữ liệu thật
                của riêng mình (không xóa dữ liệu openGym).
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!confirmClear ? (
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => setConfirmClear(true)}
                  >
                    Bắt đầu trắng (Xóa dữ liệu mẫu)
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
                      Xác nhận xóa sạch
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setConfirmClear(false)}
                    >
                      Hủy
                    </button>
                  </>
                )}

                {!confirmReset ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setConfirmReset(true)}
                  >
                    Khôi phục dữ liệu mẫu
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
                    Xác nhận khôi phục mẫu
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

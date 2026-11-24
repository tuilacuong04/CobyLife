import React, { useRef } from 'react';
import { APP_MODULES } from '../../modules/registry';
import { useApp } from '../../store/AppContext';
import { useStaggerEntrance } from '../../utils/motion';
import { MagneticButton } from '../Motion';
import {
  IconChevronRight,
  IconModuleGlyph,
  IconPlus,
  IconTrash,
} from '../Icons';

export const ModulesPage: React.FC = () => {
  const {
    state,
    gym,
    navigate,
    openModal,
    toggleModuleEnabled,
    deleteFutureIdea,
  } = useApp();

  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(gridRef, '.mod-card', []);

  const getModuleStat = (id: 'gym' | 'tasks' | 'finance') => {
    if (id === 'gym') {
      return gym.available
        ? `${gym.workoutsCount} buổi tập · ${gym.routines.length} lịch`
        : '5.632 bài tập sẵn sàng';
    }
    if (id === 'tasks') {
      const open = state.tasks.filter((t) => t.status !== 'done').length;
      return `${open} task đang mở · ${state.tasks.length} tổng`;
    }
    return `${state.finance.transactions.length} giao dịch · ${state.finance.wallets.length} ví`;
  };

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">Hệ thống Module & Mở rộng</h1>
          <p className="phead__sub">
            Không gian cá nhân thiết kế theo dạng module rời — sẵn sàng gắn thêm tính năng #4, #5...
          </p>
        </div>
        <div className="phead__actions">
          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openModal({ kind: 'new-idea' })}
          >
            <IconPlus size={15} />
            Thêm ý tưởng #4+
          </MagneticButton>
        </div>
      </div>

      <div ref={gridRef} className="stack-list" style={{ gap: 20 }}>
        {/* Active Core Modules */}
        <div>
          <div className="section-eyebrow">Modules đang hoạt động (3)</div>
          <div className="module-grid">
            {APP_MODULES.map((mod) => {
              const enabled = state.settings.enabledModules[mod.id];
              return (
                <div
                  key={mod.id}
                  className={`card mod-card tone-tile--${mod.tone}`}
                  style={{ opacity: enabled ? 1 : 0.6 }}
                >
                  <div className="card__head">
                    <span className={`pop-item__tile tile--${mod.tone}`} style={{ width: 42, height: 42 }}>
                      <IconModuleGlyph moduleId={mod.id} size={20} />
                    </span>
                    <button
                      type="button"
                      className={`pill ${enabled ? 'pill--lime' : 'pill--muted'}`}
                      onClick={() => toggleModuleEnabled(mod.id)}
                      title="Bật / tắt trạng thái nổi bật của module"
                    >
                      {enabled ? 'Đang bật' : 'Tạm ẩn'}
                    </button>
                  </div>

                  <h2 className="card__title" style={{ fontSize: 18 }}>
                    {mod.name}
                  </h2>
                  <p className="card__sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
                    {mod.description}
                  </p>

                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 14,
                      borderTop: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>
                      {getModuleStat(mod.id)}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
                      onClick={() => navigate(mod.pageId)}
                    >
                      Mở <IconChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Future Module Roadmap (#4, #5, ...) */}
        <div className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">
                Lộ trình mở rộng — Module #4+ ({state.futureModules.length})
              </h2>
              <p className="card__sub">
                Lưu lại mọi ý tưởng cá nhân bạn muốn tích hợp thêm sau này. Khi nào sẵn sàng chỉ cần
                đăng ký vào <code>src/modules/registry.ts</code>.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => openModal({ kind: 'new-idea' })}
            >
              <IconPlus size={14} />
              Lưu ý tưởng mới
            </button>
          </div>

          {state.futureModules.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 12px' }}>
              Chưa có ý tưởng nào. Bấm &ldquo;Lưu ý tưởng mới&rdquo; để ghi lại tính năng bạn muốn thêm sau này.
            </div>
          ) : (
            <div className="module-grid">
              {state.futureModules.map((idea) => (
                <div key={idea.id} className="budget-card mod-card">
                  <div className="budget-card__head">
                    <span className={`pill pill--${idea.tone}`}>{idea.category}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 28, height: 28 }}
                      aria-label={`Xóa ý tưởng ${idea.name}`}
                      onClick={() => deleteFutureIdea(idea.id)}
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                  <h3 className="card__title" style={{ marginTop: 10 }}>
                    {idea.name}
                  </h3>
                  <p className="card__sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
                    {idea.description}
                  </p>
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>
                    Ưu tiên:{' '}
                    {idea.priority === 'high'
                      ? 'Làm sớm'
                      : idea.priority === 'medium'
                        ? 'Trung bình'
                        : 'Để sau'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

import React, { useRef } from 'react';
import { APP_MODULES } from '../../modules/registry';
import { useApp } from '../../store/AppContext';
import { ModuleId } from '../../types';
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
    navigate,
    openModal,
    toggleModuleEnabled,
    deleteFutureIdea,
  } = useApp();

  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(gridRef, '.mod-card', []);

  const getModuleStat = (id: ModuleId) => {
    if (id === 'tasks') {
      const open = state.tasks.filter((t) => t.status !== 'done').length;
      return `${open} open · ${state.tasks.length} total`;
    }
    return `${state.finance.transactions.length} transactions · ${state.finance.wallets.length} wallets`;
  };

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">Modules &amp; Extensions</h1>
          <p className="phead__sub">
            Modular Personal OS — built so you can plug in #3, #4, and beyond cleanly
          </p>
        </div>
        <div className="phead__actions">
          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openModal({ kind: 'new-idea' })}
          >
            <IconPlus size={15} />
            Add idea
          </MagneticButton>
        </div>
      </div>

      <div ref={gridRef} className="stack-list" style={{ gap: 20 }}>
        <div>
          <div className="section-eyebrow">Active modules ({APP_MODULES.length})</div>
          <div className="module-grid module-grid--two">
            {APP_MODULES.map((mod) => {
              const enabled = state.settings.enabledModules[mod.id];
              return (
                <div
                  key={mod.id}
                  className={`card mod-card tone-tile--${mod.tone}`}
                  style={{ opacity: enabled ? 1 : 0.6 }}
                >
                  <div className="card__head">
                    <span
                      className={`pop-item__tile tile--${mod.tone}`}
                      style={{ width: 42, height: 42 }}
                    >
                      <IconModuleGlyph moduleId={mod.id} size={20} />
                    </span>
                    <button
                      type="button"
                      className={`pill ${enabled ? 'pill--lime' : 'pill--muted'}`}
                      onClick={() => toggleModuleEnabled(mod.id)}
                      title="Toggle module highlight"
                    >
                      {enabled ? 'Active' : 'Muted'}
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
                      Open <IconChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">
                Extension Roadmap — Module #3+ ({state.futureModules.length})
              </h2>
              <p className="card__sub">
                Capture personal tools you want to add next. Register new modules in{' '}
                <code>src/modules/registry.ts</code>.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => openModal({ kind: 'new-idea' })}
            >
              <IconPlus size={14} />
              New idea
            </button>
          </div>

          {state.futureModules.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 12px' }}>
              No roadmap ideas yet. Click &ldquo;New idea&rdquo; to jot down what you want to build next.
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
                      aria-label={`Remove ${idea.name}`}
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
                    Priority:{' '}
                    {idea.priority === 'high'
                      ? 'Next up'
                      : idea.priority === 'medium'
                        ? 'Medium'
                        : 'Later'}
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

import React, { useEffect, useState } from 'react';
import { useApp } from '../store/AppContext';
import { TaskCategory, TaskPriority, TaskRecurrence, TaskStatus, TxType } from '../types';
import {
  formatMoney,
  parseSmartAmount,
  TASK_CATEGORY_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from '../utils/format';
import { AnimatedDrawer, SlidingSegmented } from './Motion';
import { IconCheck, IconClose, IconPin, IconPlus, IconTrash } from './Icons';

export const Drawers: React.FC = () => {
  const {
    state,
    drawer,
    closeDrawer,
    updateTask,
    setTaskStatus,
    toggleTaskPinned,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    updateTransaction,
    deleteTransaction,
    settleSplitTransaction,
    pushToast,
  } = useApp();

  const [newSubtask, setNewSubtask] = useState('');
  const [txAmountInput, setTxAmountInput] = useState('');

  const task = drawer?.kind === 'task' ? state.tasks.find((t) => t.id === drawer.id) : null;
  const tx =
    drawer?.kind === 'transaction'
      ? state.finance.transactions.find((t) => t.id === drawer.id)
      : null;

  useEffect(() => {
    setNewSubtask('');
    if (tx) {
      setTxAmountInput(String(tx.amount));
    }
  }, [drawer, tx?.id]);

  if (!drawer) return null;

  if (drawer.kind === 'task' && task) {
    const doneSub = task.subtasks.filter((s) => s.done).length;
    return (
      <AnimatedDrawer open onClose={closeDrawer} label={task.title}>
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className={`pill ${TASK_CATEGORY_META[task.category].pill}`}>
                {TASK_CATEGORY_META[task.category].label}
              </span>
              <span className={`pill ${TASK_PRIORITY_META[task.priority].pill}`}>
                {TASK_PRIORITY_META[task.priority].label}
              </span>
            </div>
            <input
              className="input"
              style={{ fontSize: 17, fontWeight: 700, padding: '8px 12px' }}
              value={task.title}
              onChange={(e) => updateTask(task.id, { title: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Pin task"
            title={task.pinned ? 'Unpin' : 'Pin to top'}
            style={{ color: task.pinned ? 'var(--accent)' : undefined }}
            onClick={() => toggleTaskPinned(task.id)}
          >
            <IconPin size={16} />
          </button>
          <button type="button" className="icon-btn" aria-label="Close" onClick={closeDrawer}>
            <IconClose size={17} />
          </button>
        </div>

        <div className="drawer__body">
          <div className="drawer-section">
            <div className="drawer-section__title">Status</div>
            <SlidingSegmented<TaskStatus>
              className="seg--full"
              ariaLabel="Task status"
              value={task.status}
              onChange={(st) => setTaskStatus(task.id, st)}
              items={(['todo', 'doing', 'done'] as TaskStatus[]).map((st) => ({
                id: st,
                label: TASK_STATUS_META[st].label,
                icon: <span className={`stage-dot ${TASK_STATUS_META[st].dot}`} />,
              }))}
            />
          </div>

          <div className="drawer-section">
            <div className="drawer-section__title">Details</div>
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Due date</span>
                <input
                  type="date"
                  className="input"
                  value={task.dueDate}
                  onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Time</span>
                <input
                  type="time"
                  className="input"
                  value={task.dueTime || ''}
                  onChange={(e) => updateTask(task.id, { dueTime: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Category</span>
                <select
                  className="select"
                  value={task.category}
                  onChange={(e) => updateTask(task.id, { category: e.target.value as TaskCategory })}
                >
                  {(Object.keys(TASK_CATEGORY_META) as TaskCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {TASK_CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Priority</span>
                <select
                  className="select"
                  value={task.priority}
                  onChange={(e) => updateTask(task.id, { priority: e.target.value as TaskPriority })}
                >
                  <option value="high">High priority</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="field__label">Repeat</span>
                <select
                  className="select"
                  value={task.recurrence}
                  onChange={(e) =>
                    updateTask(task.id, { recurrence: e.target.value as TaskRecurrence })
                  }
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section__title">
              Subtasks ({doneSub}/{task.subtasks.length})
            </div>
            <div className="stack-list">
              {task.subtasks.map((st) => (
                <div key={st.id} className="act-row" style={{ padding: '8px 10px' }}>
                  <button
                    type="button"
                    className={`check-btn ${st.done ? 'is-done' : ''}`}
                    onClick={() => toggleSubtask(task.id, st.id)}
                    aria-label="Toggle subtask"
                  >
                    <IconCheck size={12} />
                  </button>
                  <span
                    className={`act-row__title ${st.done ? 'is-done' : ''}`}
                    style={{ flex: 1, fontSize: 13.5 }}
                  >
                    {st.title}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 28, height: 28 }}
                    aria-label="Delete subtask"
                    onClick={() => deleteSubtask(task.id, st.id)}
                  >
                    <IconClose size={13} />
                  </button>
                </div>
              ))}
              <form
                style={{ display: 'flex', gap: 8, marginTop: 4 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubtask.trim()) return;
                  addSubtask(task.id, newSubtask);
                  setNewSubtask('');
                }}
              >
                <input
                  className="input"
                  placeholder="Add a subtask..."
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                />
                <button type="submit" className="btn btn--ghost">
                  <IconPlus size={15} />
                  Add
                </button>
              </form>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section__title">Notes</div>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Add notes or links..."
              value={task.notes}
              onChange={(e) => updateTask(task.id, { notes: e.target.value })}
            />
          </div>
        </div>

        <div className="drawer__foot">
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => deleteTask(task.id)}
          >
            <IconTrash size={15} />
            Delete task
          </button>
          <button type="button" className="btn btn--primary" onClick={closeDrawer}>
            Done
          </button>
        </div>
      </AnimatedDrawer>
    );
  }

  if (drawer.kind === 'transaction' && tx) {
    const { currency } = state.settings;
    const filteredCategories = state.finance.categories.filter((c) =>
      tx.type === 'income' ? c.kind === 'income' : c.kind === 'expense'
    );

    const handleSaveAmount = () => {
      const parsed = parseSmartAmount(txAmountInput);
      if (parsed > 0 && parsed !== tx.amount) {
        updateTransaction(tx.id, { amount: parsed });
        setTxAmountInput(String(parsed));
        pushToast('Amount updated');
      }
    };

    const splitOwed =
      tx.split && tx.split.status === 'open'
        ? Math.max(0, tx.split.reimbursable - tx.split.repaidAmount)
        : 0;

    return (
      <AnimatedDrawer open onClose={closeDrawer} label="Transaction details">
        <div className="drawer__head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span className="drawer__sub">Edit transaction</span>
              {tx.source === 'gmail' && <span className="pill pill--sky">Gmail Synced</span>}
              {tx.isAdjustment && <span className="pill pill--muted">Reconciliation</span>}
            </div>
            <h2 className="drawer__title">
              {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : '⇄ '}
              {formatMoney(tx.amount, currency)}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={closeDrawer}>
            <IconClose size={17} />
          </button>
        </div>

        <div className="drawer__body">
          {tx.split && (
            <div
              className="drawer-section"
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--well)',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    Split Bill · My share: {formatMoney(tx.split.myShare, currency)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {tx.split.status === 'settled'
                      ? `Settled (${formatMoney(tx.split.reimbursable, currency)} repaid)`
                      : `Owed back: ${formatMoney(splitOwed, currency)}${tx.split.counterparty ? ` · ${tx.split.counterparty}` : ''}`}
                  </div>
                </div>
                {tx.split.status === 'open' && splitOwed > 0 && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => settleSplitTransaction(tx.id)}
                  >
                    Mark Repaid
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="drawer-section">
            <div className="drawer-section__title">Type</div>
            <SlidingSegmented<TxType>
              className="seg--full"
              ariaLabel="Transaction type"
              value={tx.type}
              onChange={(nextType) => {
                const nextCat =
                  nextType === 'income'
                    ? state.finance.categories.find((c) => c.kind === 'income')?.id || tx.categoryId
                    : state.finance.categories.find((c) => c.kind === 'expense')?.id || tx.categoryId;
                updateTransaction(tx.id, {
                  type: nextType,
                  categoryId: nextCat,
                  toWalletId:
                    nextType === 'transfer'
                      ? state.finance.wallets.find((w) => w.id !== tx.walletId)?.id
                      : undefined,
                });
              }}
              items={[
                { id: 'expense', label: 'Expense' },
                { id: 'income', label: 'Income' },
                { id: 'transfer', label: 'Transfer' },
              ]}
            />
          </div>

          <div className="drawer-section">
            <div className="form-stack">
              <label className="field">
                <span className="field__label">Amount (supports 50k, 1,500k, 45k+15k)</span>
                <input
                  className="input"
                  value={txAmountInput}
                  onChange={(e) => setTxAmountInput(e.target.value)}
                  onBlur={handleSaveAmount}
                />
              </label>

              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Date</span>
                  <input
                    type="date"
                    className="input"
                    value={tx.date}
                    onChange={(e) => updateTransaction(tx.id, { date: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span className="field__label">
                    {tx.type === 'transfer' ? 'From wallet' : 'Wallet'}
                  </span>
                  <select
                    className="select"
                    value={tx.walletId}
                    onChange={(e) => updateTransaction(tx.id, { walletId: e.target.value })}
                  >
                    {state.finance.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {tx.type === 'transfer' ? (
                <label className="field">
                  <span className="field__label">To wallet</span>
                  <select
                    className="select"
                    value={tx.toWalletId || ''}
                    onChange={(e) => updateTransaction(tx.id, { toWalletId: e.target.value })}
                  >
                    {state.finance.wallets
                      .filter((w) => w.id !== tx.walletId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label className="field">
                  <span className="field__label">Category</span>
                  <select
                    className="select"
                    value={tx.categoryId}
                    onChange={(e) => updateTransaction(tx.id, { categoryId: e.target.value })}
                  >
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="field">
                <span className="field__label">Note</span>
                <input
                  className="input"
                  value={tx.note}
                  placeholder="Description..."
                  onChange={(e) => updateTransaction(tx.id, { note: e.target.value })}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="drawer__foot">
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => deleteTransaction(tx.id)}
          >
            <IconTrash size={15} />
            Delete
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              handleSaveAmount();
              closeDrawer();
            }}
          >
            Save &amp; Close
          </button>
        </div>
      </AnimatedDrawer>
    );
  }

  return null;
};

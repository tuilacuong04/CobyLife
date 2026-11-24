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
import { AnimatedDrawer } from './Motion';
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
            aria-label="Ghim task"
            title={task.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
            style={{ color: task.pinned ? 'var(--accent)' : undefined }}
            onClick={() => toggleTaskPinned(task.id)}
          >
            <IconPin size={16} />
          </button>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={closeDrawer}>
            <IconClose size={17} />
          </button>
        </div>

        <div className="drawer__body">
          <div className="drawer-section">
            <div className="drawer-section__title">Trạng thái</div>
            <div className="seg" style={{ width: '100%', justifyContent: 'space-between' }}>
              {(['todo', 'doing', 'done'] as TaskStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`seg__btn ${task.status === st ? 'is-active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setTaskStatus(task.id, st)}
                >
                  <span className={`stage-dot ${TASK_STATUS_META[st].dot}`} />
                  {TASK_STATUS_META[st].label}
                </button>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section__title">Thông tin chi tiết</div>
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Hạn chót</span>
                <input
                  type="date"
                  className="input"
                  value={task.dueDate}
                  onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Giờ</span>
                <input
                  type="time"
                  className="input"
                  value={task.dueTime || ''}
                  onChange={(e) => updateTask(task.id, { dueTime: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Danh mục</span>
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
                <span className="field__label">Độ ưu tiên</span>
                <select
                  className="select"
                  value={task.priority}
                  onChange={(e) => updateTask(task.id, { priority: e.target.value as TaskPriority })}
                >
                  <option value="high">Ưu tiên cao</option>
                  <option value="medium">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="field__label">Lặp lại định kỳ</span>
                <select
                  className="select"
                  value={task.recurrence}
                  onChange={(e) =>
                    updateTask(task.id, { recurrence: e.target.value as TaskRecurrence })
                  }
                >
                  <option value="none">Không lặp lại</option>
                  <option value="daily">Hàng ngày</option>
                  <option value="weekly">Hàng tuần</option>
                  <option value="monthly">Hàng tháng</option>
                </select>
              </label>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section__title">
              Checklist con ({doneSub}/{task.subtasks.length})
            </div>
            <div className="stack-list">
              {task.subtasks.map((st) => (
                <div key={st.id} className="act-row" style={{ padding: '8px 10px' }}>
                  <button
                    type="button"
                    className={`check-btn ${st.done ? 'is-done' : ''}`}
                    onClick={() => toggleSubtask(task.id, st.id)}
                    aria-label="Đánh dấu hoàn thành mục con"
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
                    aria-label="Xóa mục con"
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
                  placeholder="Thêm bước nhỏ..."
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                />
                <button type="submit" className="btn btn--ghost">
                  <IconPlus size={15} />
                  Thêm
                </button>
              </form>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section__title">Ghi chú</div>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Ghi chú chi tiết cho task..."
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
            Xóa task
          </button>
          <button type="button" className="btn btn--primary" onClick={closeDrawer}>
            Xong
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
        pushToast('Đã cập nhật số tiền giao dịch');
      }
    };

    return (
      <AnimatedDrawer open onClose={closeDrawer} label="Chi tiết giao dịch">
        <div className="drawer__head">
          <div>
            <div className="drawer__sub">Chỉnh sửa giao dịch</div>
            <h2 className="drawer__title">
              {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
              {formatMoney(tx.amount, currency)}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={closeDrawer}>
            <IconClose size={17} />
          </button>
        </div>

        <div className="drawer__body">
          <div className="drawer-section">
            <div className="drawer-section__title">Loại giao dịch</div>
            <div className="seg" style={{ width: '100%' }}>
              {(
                [
                  { id: 'expense', label: 'Chi tiêu' },
                  { id: 'income', label: 'Thu nhập' },
                  { id: 'transfer', label: 'Chuyển ví' },
                ] as { id: TxType; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`seg__btn ${tx.type === item.id ? 'is-active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    const nextCat =
                      item.id === 'income'
                        ? state.finance.categories.find((c) => c.kind === 'income')?.id || tx.categoryId
                        : state.finance.categories.find((c) => c.kind === 'expense')?.id || tx.categoryId;
                    updateTransaction(tx.id, {
                      type: item.id,
                      categoryId: nextCat,
                      toWalletId:
                        item.id === 'transfer'
                          ? state.finance.wallets.find((w) => w.id !== tx.walletId)?.id
                          : undefined,
                    });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="form-stack">
              <label className="field">
                <span className="field__label">Số tiền (hỗ trợ 50k, 1.5tr)</span>
                <input
                  className="input"
                  value={txAmountInput}
                  onChange={(e) => setTxAmountInput(e.target.value)}
                  onBlur={handleSaveAmount}
                />
              </label>

              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Ngày</span>
                  <input
                    type="date"
                    className="input"
                    value={tx.date}
                    onChange={(e) => updateTransaction(tx.id, { date: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span className="field__label">
                    {tx.type === 'transfer' ? 'Từ ví' : 'Ví / Tài khoản'}
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
                  <span className="field__label">Đến ví</span>
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
                  <span className="field__label">Danh mục</span>
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
                <span className="field__label">Ghi chú</span>
                <input
                  className="input"
                  value={tx.note}
                  placeholder="Mô tả khoản chi / thu..."
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
            Xóa giao dịch
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              handleSaveAmount();
              closeDrawer();
            }}
          >
            Lưu & Đóng
          </button>
        </div>
      </AnimatedDrawer>
    );
  }

  return null;
};

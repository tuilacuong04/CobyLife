import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  AccentTone,
  TaskCategory,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  TxType,
  WalletKind,
} from '../types';
import {
  formatMoney,
  formatShortDate,
  localIsoDate,
  parseSmartAmount,
  TASK_CATEGORY_META,
  WALLET_KIND_LABEL,
} from '../utils/format';
import { animateErrorShake } from '../utils/motion';
import { AnimatedModal } from './Motion';
import {
  IconClose,
  IconPlus,
  IconSearch,
  IconTasks,
  IconWallet,
} from './Icons';

const SearchModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, navigate, openDrawer, openModal } = useApp();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const term = q.trim().toLowerCase();

  const matchingTasks = useMemo(() => {
    const list = state.tasks.filter(
      (t) =>
        !term ||
        t.title.toLowerCase().includes(term) ||
        t.notes.toLowerCase().includes(term) ||
        TASK_CATEGORY_META[t.category].label.toLowerCase().includes(term)
    );
    return list.slice(0, 5);
  }, [state.tasks, term]);

  const matchingTx = useMemo(() => {
    const catMap = new Map(state.finance.categories.map((c) => [c.id, c.name]));
    const list = state.finance.transactions.filter((tx) => {
      if (!term) return true;
      const cat = catMap.get(tx.categoryId) || '';
      return tx.note.toLowerCase().includes(term) || cat.toLowerCase().includes(term);
    });
    return list.slice(0, 5);
  }, [state.finance.transactions, state.finance.categories, term]);

  return (
    <AnimatedModal open onClose={onClose} size="lg" label="Quick search">
      <div className="cmd-head">
        <IconSearch size={17} />
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Search tasks, transactions, or quick actions..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <div className="cmd-body">
        {!term && (
          <div className="cmd-group">
            <div className="cmd-group__label">Quick actions</div>
            <button
              type="button"
              className="cmd-row"
              onClick={() => openModal({ kind: 'new-task' })}
            >
              <span className="cmd-row__title">
                <IconPlus size={14} style={{ marginRight: 6 }} />
                New personal task
              </span>
              <span className="cmd-row__meta">Tasks</span>
            </button>
            <button
              type="button"
              className="cmd-row"
              onClick={() => openModal({ kind: 'new-tx', defaultType: 'expense' })}
            >
              <span className="cmd-row__title">
                <IconWallet size={14} style={{ marginRight: 6 }} />
                Log an expense
              </span>
              <span className="cmd-row__meta">Finance</span>
            </button>
          </div>
        )}

        {matchingTasks.length > 0 && (
          <div className="cmd-group">
            <div className="cmd-group__label">Tasks</div>
            {matchingTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className="cmd-row"
                onClick={() => {
                  onClose();
                  navigate('tasks');
                  openDrawer({ kind: 'task', id: t.id });
                }}
              >
                <span className="cmd-row__title">
                  <IconTasks size={14} style={{ marginRight: 6 }} />
                  {t.title}
                </span>
                <span className="cmd-row__meta">{formatShortDate(t.dueDate)}</span>
              </button>
            ))}
          </div>
        )}

        {matchingTx.length > 0 && (
          <div className="cmd-group">
            <div className="cmd-group__label">Transactions</div>
            {matchingTx.map((tx) => (
              <button
                key={tx.id}
                type="button"
                className="cmd-row"
                onClick={() => {
                  onClose();
                  navigate('finance', 'transactions');
                  openDrawer({ kind: 'transaction', id: tx.id });
                }}
              >
                <span className="cmd-row__title">{tx.note || 'Transaction'}</span>
                <span className="cmd-row__meta">
                  {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                  {formatMoney(tx.amount, state.settings.currency)}
                </span>
              </button>
            ))}
          </div>
        )}

        {term && matchingTasks.length === 0 && matchingTx.length === 0 && (
          <div className="empty-state" style={{ padding: '28px 12px' }}>
            No matches for &ldquo;{q}&rdquo;.
          </div>
        )}
      </div>
    </AnimatedModal>
  );
};

const NewTaskModal: React.FC<{
  defaultStatus?: TaskStatus;
  defaultCategory?: TaskCategory;
  defaultDate?: string;
  onClose: () => void;
}> = ({ defaultStatus = 'todo', defaultCategory = 'personal', defaultDate, onClose }) => {
  const { createTask } = useApp();
  const boxRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>(defaultCategory);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [dueDate, setDueDate] = useState(defaultDate ?? localIsoDate());
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Enter a task title.');
      animateErrorShake(boxRef.current);
      return;
    }
    createTask({
      title: title.trim(),
      notes: notes.trim(),
      status,
      priority,
      category,
      dueDate,
      dueTime: dueTime || undefined,
      recurrence,
      pinned: priority === 'high',
    });
    onClose();
  };

  return (
    <AnimatedModal open onClose={onClose} label="New task">
      <div className="modal__head">
        <h2 className="modal__title">New task</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>
      <form ref={boxRef} className="modal__body form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="input"
            autoFocus
            placeholder="e.g., Pay internet bill, Read 20 pages..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
          />
          {error && <span className="field__error">{error}</span>}
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Category</span>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
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
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="high">High priority</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Due date</span>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Time (optional)</span>
            <input
              type="time"
              className="input"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <select
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              <option value="todo">To Do</option>
              <option value="doing">In Progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Repeat</span>
            <select
              className="select"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)}
            >
              <option value="none">No repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Notes</span>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Extra context or links..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Create task
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
};

const NewTransactionModal: React.FC<{
  defaultType?: TxType;
  defaultWalletId?: string;
  defaultCategoryId?: string;
  onClose: () => void;
}> = ({ defaultType = 'expense', defaultWalletId, defaultCategoryId, onClose }) => {
  const { state, createTransaction } = useApp();
  const boxRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<TxType>(defaultType);
  const [amountRaw, setAmountRaw] = useState('');
  const [walletId, setWalletId] = useState(
    defaultWalletId || state.finance.wallets[0]?.id || ''
  );
  const [toWalletId, setToWalletId] = useState(
    state.finance.wallets.find((w) => w.id !== (defaultWalletId || state.finance.wallets[0]?.id))
      ?.id || ''
  );
  const [categoryId, setCategoryId] = useState(() => {
    if (defaultCategoryId) return defaultCategoryId;
    const match = state.finance.categories.find((c) =>
      defaultType === 'income' ? c.kind === 'income' : c.kind === 'expense'
    );
    return match?.id || state.finance.categories[0]?.id || '';
  });
  const [date, setDate] = useState(localIsoDate());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const parsedAmount = parseSmartAmount(amountRaw);
  const filteredCats = state.finance.categories.filter((c) =>
    type === 'income' ? c.kind === 'income' : c.kind === 'expense'
  );

  const handleTypeChange = (next: TxType) => {
    setType(next);
    const match = state.finance.categories.find((c) =>
      next === 'income' ? c.kind === 'income' : c.kind === 'expense'
    );
    if (match) setCategoryId(match.id);
    if (next === 'transfer') {
      const other = state.finance.wallets.find((w) => w.id !== walletId);
      if (other) setToWalletId(other.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setError('Enter a valid amount (e.g., 50k, 1.5m, 250000).');
      animateErrorShake(boxRef.current);
      return;
    }
    if (!walletId) {
      setError('Select a wallet.');
      return;
    }
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) {
      setError('Destination wallet must be different.');
      animateErrorShake(boxRef.current);
      return;
    }
    createTransaction({
      type,
      amount: parsedAmount,
      categoryId,
      walletId,
      toWalletId: type === 'transfer' ? toWalletId : undefined,
      date,
      note: note.trim() || (type === 'transfer' ? 'Wallet transfer' : ''),
    });
    onClose();
  };

  return (
    <AnimatedModal open onClose={onClose} label="New transaction">
      <div className="modal__head">
        <h2 className="modal__title">Log transaction</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>
      <form ref={boxRef} className="modal__body form-stack" onSubmit={handleSubmit}>
        <div className="seg" style={{ width: '100%' }}>
          {(
            [
              { id: 'expense', label: 'Expense' },
              { id: 'income', label: 'Income' },
              { id: 'transfer', label: 'Transfer' },
            ] as { id: TxType; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`seg__btn ${type === item.id ? 'is-active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => handleTypeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field__label">
            Amount{' '}
            {parsedAmount > 0 && (
              <strong style={{ color: 'var(--accent-ink)', marginLeft: 6 }}>
                = {formatMoney(parsedAmount, state.settings.currency)}
              </strong>
            )}
          </span>
          <input
            className="input"
            autoFocus
            placeholder="Quick format: 50k, 1.5m, 250000..."
            value={amountRaw}
            onChange={(e) => {
              setAmountRaw(e.target.value);
              if (error) setError('');
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {['35k', '50k', '100k', '250k', '500k', '1m'].map((preset) => (
              <button
                key={preset}
                type="button"
                className="chip"
                style={{ height: 26, fontSize: 12 }}
                onClick={() => {
                  setAmountRaw(preset);
                  if (error) setError('');
                }}
              >
                {preset}
              </button>
            ))}
          </div>
          {error && <span className="field__error">{error}</span>}
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">{type === 'transfer' ? 'From wallet' : 'Wallet'}</span>
            <select
              className="select"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              {state.finance.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>

          {type === 'transfer' ? (
            <label className="field">
              <span className="field__label">To wallet</span>
              <select
                className="select"
                value={toWalletId}
                onChange={(e) => setToWalletId(e.target.value)}
              >
                {state.finance.wallets
                  .filter((w) => w.id !== walletId)
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
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span className="field__label">Date</span>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Note</span>
            <input
              className="input"
              placeholder="e.g., Lunch, Coffee, Fuel..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
};

const NewWalletModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { createWallet } = useApp();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WalletKind>('bank');
  const [balanceRaw, setBalanceRaw] = useState('');
  const [tone, setTone] = useState<AccentTone>('sky');
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createWallet({
      name: name.trim(),
      kind,
      initialBalance: parseSmartAmount(balanceRaw),
      tone,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <AnimatedModal open onClose={onClose} label="Add wallet">
      <div className="modal__head">
        <h2 className="modal__title">New wallet</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>
      <form className="modal__body form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Wallet name</span>
          <input
            className="input"
            autoFocus
            placeholder="e.g., Checking, MoMo, Travel Fund..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Type</span>
            <select
              className="select"
              value={kind}
              onChange={(e) => setKind(e.target.value as WalletKind)}
            >
              {(Object.keys(WALLET_KIND_LABEL) as WalletKind[]).map((k) => (
                <option key={k} value={k}>
                  {WALLET_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Starting balance (e.g. 5m)</span>
            <input
              className="input"
              placeholder="0"
              value={balanceRaw}
              onChange={(e) => setBalanceRaw(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Card accent</span>
          <div className="seg">
            {(['sky', 'lime', 'coral', 'sand'] as AccentTone[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`seg__btn ${tone === t ? 'is-active' : ''}`}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          <span className="field__label">Note</span>
          <input
            className="input"
            placeholder="Optional description..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Add wallet
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
};

const NewIdeaModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addFutureIdea } = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Personal');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [tone, setTone] = useState<AccentTone>('lime');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addFutureIdea({
      name: name.trim(),
      category: category.trim() || 'Personal',
      priority,
      tone,
      description: description.trim() || 'Planned personal extension module.',
    });
    onClose();
  };

  return (
    <AnimatedModal open onClose={onClose} label="Add module idea">
      <div className="modal__head">
        <h2 className="modal__title">Save future module idea</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>
      <form className="modal__body form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Module name</span>
          <input
            className="input"
            autoFocus
            placeholder="e.g., Sleep Tracker, Journal, Reading List..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Category</span>
            <input
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Priority</span>
            <select
              className="select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
            >
              <option value="high">Next up</option>
              <option value="medium">Medium</option>
              <option value="low">Later</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field__label">Accent</span>
          <div className="seg">
            {(['lime', 'sky', 'coral', 'sand'] as AccentTone[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`seg__btn ${tone === t ? 'is-active' : ''}`}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="textarea"
            rows={3}
            placeholder="What should this module help you track?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save to roadmap
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
};

const ShortcutsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <AnimatedModal open onClose={onClose} label="Keyboard shortcuts">
    <div className="modal__head">
      <h2 className="modal__title">Keyboard shortcuts</h2>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
        <IconClose size={16} />
      </button>
    </div>
    <div className="modal__body stack-list">
      {[
        ['⌘K / Ctrl+K', 'Open global search & quick actions'],
        ['⌘\\ / Ctrl+\\', 'Toggle sidebar'],
        ['?', 'Show keyboard shortcuts'],
        ['Esc', 'Close active modal or drawer'],
      ].map(([k, desc]) => (
        <div
          key={k}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: 12,
            background: 'var(--well)',
          }}
        >
          <span style={{ fontSize: 13.5 }}>{desc}</span>
          <kbd className="kbd">{k}</kbd>
        </div>
      ))}
    </div>
  </AnimatedModal>
);

export const Modals: React.FC = () => {
  const { modal, closeModal } = useApp();
  if (!modal) return null;

  if (modal.kind === 'search') return <SearchModal onClose={closeModal} />;
  if (modal.kind === 'shortcuts') return <ShortcutsModal onClose={closeModal} />;
  if (modal.kind === 'new-task') {
    return (
      <NewTaskModal
        defaultStatus={modal.defaultStatus}
        defaultCategory={modal.defaultCategory}
        defaultDate={modal.defaultDate}
        onClose={closeModal}
      />
    );
  }
  if (modal.kind === 'new-tx') {
    return (
      <NewTransactionModal
        defaultType={modal.defaultType}
        defaultWalletId={modal.defaultWalletId}
        defaultCategoryId={modal.defaultCategoryId}
        onClose={closeModal}
      />
    );
  }
  if (modal.kind === 'new-wallet') return <NewWalletModal onClose={closeModal} />;
  if (modal.kind === 'new-idea') return <NewIdeaModal onClose={closeModal} />;
  return null;
};

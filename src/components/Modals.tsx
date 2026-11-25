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
import { AnimatedModal, SlidingSegmented } from './Motion';
import {
  GmailSetupModal,
  ManageCategoriesModal,
  ManageRulesModal,
  QuickLogModal,
  ReconcileWalletModal,
  RecurringBillModal,
} from './finance/FinanceModals';
import {
  IconClose,
  IconPlus,
  IconSearch,
  IconSplit,
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
      <form ref={boxRef} className="modal__form" onSubmit={handleSubmit}>
        <div className="modal__body form-stack">
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
        </div>

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
  defaultDate?: string;
  onClose: () => void;
}> = ({ defaultType = 'expense', defaultWalletId, defaultCategoryId, defaultDate, onClose }) => {
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
  const [date, setDate] = useState(defaultDate || localIsoDate());
  const [note, setNote] = useState('');
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [myShareRaw, setMyShareRaw] = useState('');
  const [counterparty, setCounterparty] = useState('');
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
      setSplitEnabled(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setError('Enter a valid amount (e.g., 50k, 1,500k, 45k+15k).');
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

    const parsedShare = splitEnabled ? parseSmartAmount(myShareRaw) : parsedAmount;
    const split =
      type === 'expense' && splitEnabled && parsedShare >= 0 && parsedShare < parsedAmount
        ? {
            myShare: parsedShare,
            reimbursable: parsedAmount - parsedShare,
            repaidAmount: 0,
            counterparty: counterparty.trim() || undefined,
            status: 'open' as const,
          }
        : undefined;

    createTransaction({
      type,
      amount: parsedAmount,
      categoryId,
      walletId,
      toWalletId: type === 'transfer' ? toWalletId : undefined,
      date,
      note: note.trim() || (type === 'transfer' ? 'Wallet transfer' : ''),
      source: 'manual',
      split,
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
      <form ref={boxRef} className="modal__form" onSubmit={handleSubmit}>
        <div className="modal__body form-stack">
          <SlidingSegmented<TxType>
            className="seg--full"
            ariaLabel="Transaction type"
            value={type}
            onChange={handleTypeChange}
            items={[
              { id: 'expense', label: 'Expense' },
              { id: 'income', label: 'Income' },
              { id: 'transfer', label: 'Transfer' },
            ]}
          />

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
              inputMode="text"
              placeholder="Quick format: 50k, 1,500k, 1.5m, 45k+15k..."
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

          {type === 'expense' && (
            <div>
              <button
                type="button"
                className={`btn btn--sm ${splitEnabled ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => {
                  setSplitEnabled((v) => !v);
                  if (!myShareRaw && parsedAmount > 0) {
                    setMyShareRaw(String(Math.round(parsedAmount / 2)));
                  }
                }}
              >
                <IconSplit size={14} />
                {splitEnabled ? 'Splitting Bill (Reimbursable)' : 'Split / Fronted for Friends'}
              </button>

              {splitEnabled && (
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <label className="field">
                    <span className="field__label">My share (counts in Budget)</span>
                    <input
                      className="input"
                      placeholder="e.g. 300k"
                      value={myShareRaw}
                      onChange={(e) => setMyShareRaw(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Friends / Group (optional)</span>
                    <input
                      className="input"
                      placeholder="e.g. Minh, Lan"
                      value={counterparty}
                      onChange={(e) => setCounterparty(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
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

const NewWalletModal: React.FC<{ editWalletId?: string; onClose: () => void }> = ({
  editWalletId,
  onClose,
}) => {
  const { state, createWallet, updateWallet } = useApp();
  const existing = editWalletId
    ? state.finance.wallets.find((w) => w.id === editWalletId)
    : undefined;

  const [name, setName] = useState(existing?.name || '');
  const [kind, setKind] = useState<WalletKind>(existing?.kind || 'bank');
  const [balanceRaw, setBalanceRaw] = useState(
    existing ? String(existing.initialBalance) : ''
  );
  const [tone, setTone] = useState<AccentTone>(existing?.tone || 'sky');
  const [accountHint, setAccountHint] = useState(existing?.accountHint || '');
  const [bankCode, setBankCode] = useState(existing?.bankCode || '');
  const [note, setNote] = useState(existing?.note || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      kind,
      initialBalance: parseSmartAmount(balanceRaw),
      tone,
      accountHint: accountHint.trim() || undefined,
      bankCode: bankCode.trim().toUpperCase() || undefined,
      note: note.trim() || undefined,
    };
    if (existing) {
      updateWallet(existing.id, payload);
    } else {
      createWallet(payload);
    }
    onClose();
  };

  return (
    <AnimatedModal open onClose={onClose} label={existing ? 'Edit wallet' : 'Add wallet'}>
      <div className="modal__head">
        <h2 className="modal__title">{existing ? 'Edit wallet' : 'New wallet'}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>
      <form className="modal__form" onSubmit={handleSubmit}>
        <div className="modal__body form-stack">
          <label className="field">
            <span className="field__label">Wallet name</span>
            <input
              className="input"
              placeholder="e.g., Timo Bank, ACB Checking, MoMo..."
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
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Account / Card last 4 digits (Gmail match)</span>
              <input
                className="input"
                maxLength={8}
                placeholder="e.g. 9012"
                value={accountHint}
                onChange={(e) => setAccountHint(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Bank tag (optional)</span>
              <input
                className="input"
                placeholder="e.g. TIMO, ACB, VCB, VIB, MOMO"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
              />
            </label>
          </div>
          <div className="field">
            <span className="field__label">Card accent</span>
            <SlidingSegmented<AccentTone>
              className="seg--full"
              ariaLabel="Card accent"
              value={tone}
              onChange={setTone}
              items={[
                { id: 'sky', label: 'Sky', icon: <span className="stage-dot stage-dot--sky" /> },
                { id: 'lime', label: 'Lime', icon: <span className="stage-dot stage-dot--lime" /> },
                { id: 'coral', label: 'Coral', icon: <span className="stage-dot stage-dot--coral" /> },
                { id: 'sand', label: 'Sand', icon: <span className="stage-dot stage-dot--sand" /> },
              ]}
            />
          </div>
          <label className="field">
            <span className="field__label">Note</span>
            <input
              className="input"
              placeholder="Optional description..."
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
            {existing ? 'Save changes' : 'Add wallet'}
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
      <form className="modal__form" onSubmit={handleSubmit}>
        <div className="modal__body form-stack">
          <label className="field">
            <span className="field__label">Module name</span>
            <input
              className="input"
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
          <div className="field">
            <span className="field__label">Accent</span>
            <SlidingSegmented<AccentTone>
              className="seg--full"
              ariaLabel="Module accent"
              value={tone}
              onChange={setTone}
              items={[
                { id: 'lime', label: 'Lime', icon: <span className="stage-dot stage-dot--lime" /> },
                { id: 'sky', label: 'Sky', icon: <span className="stage-dot stage-dot--sky" /> },
                { id: 'coral', label: 'Coral', icon: <span className="stage-dot stage-dot--coral" /> },
                { id: 'sand', label: 'Sand', icon: <span className="stage-dot stage-dot--sand" /> },
              ]}
            />
          </div>
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
        </div>
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
        defaultDate={modal.defaultDate}
        onClose={closeModal}
      />
    );
  }
  if (modal.kind === 'new-wallet') {
    return <NewWalletModal editWalletId={modal.editWalletId} onClose={closeModal} />;
  }
  if (modal.kind === 'quick-log') {
    return <QuickLogModal defaultWalletId={modal.defaultWalletId} onClose={closeModal} />;
  }
  if (modal.kind === 'reconcile-wallet') {
    return (
      <ReconcileWalletModal
        walletId={modal.walletId}
        targetBalance={modal.targetBalance}
        onClose={closeModal}
      />
    );
  }
  if (modal.kind === 'gmail-setup') {
    return <GmailSetupModal onClose={closeModal} />;
  }
  if (modal.kind === 'manage-categories') {
    return <ManageCategoriesModal onClose={closeModal} />;
  }
  if (modal.kind === 'manage-rules') {
    return <ManageRulesModal onClose={closeModal} />;
  }
  if (modal.kind === 'new-bill') {
    return <RecurringBillModal editBillId={modal.editBillId} onClose={closeModal} />;
  }
  if (modal.kind === 'new-idea') return <NewIdeaModal onClose={closeModal} />;
  return null;
};

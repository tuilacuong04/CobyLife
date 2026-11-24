import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { TxType } from '../../types';
import {
  currentMonthKey,
  formatMoney,
  formatMoneyCompact,
  formatMonthLabel,
  formatMonthShort,
  formatShortDate,
  localIsoDate,
  parseSmartAmount,
  shiftMonthKey,
  WALLET_KIND_LABEL,
} from '../../utils/format';
import { useStaggerEntrance } from '../../utils/motion';
import { MagneticButton, SlidingSegmented } from '../Motion';
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconPlus,
  IconRepeat,
  IconSearch,
  IconTrash,
  IconWallet,
} from '../Icons';

export const FinancePage: React.FC = () => {
  const {
    state,
    route,
    walletBalances,
    navigate,
    openModal,
    openDrawer,
    createTransaction,
    setCategoryBudget,
    deleteWallet,
    pushToast,
  } = useApp();

  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [filterType, setFilterType] = useState<TxType | 'all'>('all');
  const [filterWallet, setFilterWallet] = useState<string>('all');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [hoverMonthIdx, setHoverMonthIdx] = useState<number | null>(null);

  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [quickCat, setQuickCat] = useState(
    () => state.finance.categories.find((c) => c.kind === 'expense')?.id || ''
  );
  const [quickWallet, setQuickWallet] = useState(() => state.finance.wallets[0]?.id || '');

  const [editingBudgetCat, setEditingBudgetCat] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState('');

  const contentRef = useRef<HTMLDivElement>(null);
  const tab =
    route.sub === 'transactions' || route.sub === 'budgets' || route.sub === 'wallets'
      ? route.sub
      : 'overview';

  useStaggerEntrance(contentRef, '.fin-anim', [tab, monthKey]);

  const { currency } = state.settings;
  const catMap = useMemo(
    () => new Map(state.finance.categories.map((c) => [c.id, c])),
    [state.finance.categories]
  );
  const walletMap = useMemo(
    () => new Map(state.finance.wallets.map((w) => [w.id, w])),
    [state.finance.wallets]
  );

  const monthTransactions = useMemo(
    () =>
      state.finance.transactions
        .filter((tx) => tx.date.startsWith(monthKey))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.finance.transactions, monthKey]
  );

  const monthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCat: Record<string, number> = {};
    for (const tx of monthTransactions) {
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') {
        expense += tx.amount;
        byCat[tx.categoryId] = (byCat[tx.categoryId] || 0) + tx.amount;
      }
    }
    const net = income - expense;
    const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;
    const totalBalance = Object.values(walletBalances).reduce((s, v) => s + v, 0);

    const breakdown = Object.entries(byCat)
      .map(([catId, amount]) => ({
        category: catMap.get(catId),
        categoryId: catId,
        amount,
        pct: expense > 0 ? Math.round((amount / expense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { income, expense, net, savingsRate, totalBalance, byCat, breakdown };
  }, [monthTransactions, walletBalances, catMap]);

  const sixMonthSeries = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => shiftMonthKey(monthKey, i - 5));
    return months.map((mk) => {
      let inc = 0;
      let exp = 0;
      for (const tx of state.finance.transactions) {
        if (!tx.date.startsWith(mk)) continue;
        if (tx.type === 'income') inc += tx.amount;
        else if (tx.type === 'expense') exp += tx.amount;
      }
      return {
        monthKey: mk,
        label: formatMonthShort(mk),
        fullLabel: formatMonthLabel(mk),
        income: inc,
        expense: exp,
      };
    });
  }, [state.finance.transactions, monthKey]);

  const maxChartVal = useMemo(
    () => Math.max(1_000_000, ...sixMonthSeries.flatMap((m) => [m.income, m.expense])),
    [sixMonthSeries]
  );

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthTransactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterWallet !== 'all' && tx.walletId !== filterWallet && tx.toWalletId !== filterWallet) {
        return false;
      }
      if (filterCat !== 'all' && tx.categoryId !== filterCat) return false;
      if (q) {
        const catName = catMap.get(tx.categoryId)?.name.toLowerCase() || '';
        const wName = walletMap.get(tx.walletId)?.name.toLowerCase() || '';
        if (
          !tx.note.toLowerCase().includes(q) &&
          !catName.includes(q) &&
          !wName.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [monthTransactions, filterType, filterWallet, filterCat, search, catMap, walletMap]);

  const handleQuickAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseSmartAmount(quickAmount);
    if (amount <= 0) {
      pushToast('Enter a valid amount (e.g., 45k, 1.2m)');
      return;
    }
    const targetWallet = quickWallet || state.finance.wallets[0]?.id;
    const targetCat =
      quickCat || state.finance.categories.find((c) => c.kind === 'expense')?.id || '';
    if (!targetWallet) return;
    createTransaction({
      type: 'expense',
      amount,
      categoryId: targetCat,
      walletId: targetWallet,
      date: localIsoDate(),
      note: quickNote.trim() || catMap.get(targetCat)?.name || 'Expense',
    });
    setQuickAmount('');
    setQuickNote('');
  };

  const handleExportCsv = () => {
    const header = ['Date', 'Type', 'Amount', 'Category', 'Wallet', 'ToWallet', 'Note'];
    const rows = filteredTx.map((tx) => [
      tx.date,
      tx.type,
      String(tx.amount),
      `"${(catMap.get(tx.categoryId)?.name || '').replace(/"/g, '""')}"`,
      `"${(walletMap.get(tx.walletId)?.name || '').replace(/"/g, '""')}"`,
      `"${(tx.toWalletId ? walletMap.get(tx.toWalletId)?.name || '' : '').replace(/"/g, '""')}"`,
      `"${tx.note.replace(/"/g, '""')}"`,
    ]);
    const csv = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(`Exported ${filteredTx.length} transactions to CSV`);
  };

  const expenseCategories = state.finance.categories.filter((c) => c.kind === 'expense');

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">Finance</h1>
          <p className="phead__sub">
            {formatMonthLabel(monthKey)} · Total balance:{' '}
            <strong>{formatMoney(monthStats.totalBalance, currency)}</strong>
          </p>
        </div>
        <div className="phead__actions">
          <div className="month-stepper">
            <button
              type="button"
              className="icon-btn"
              style={{ width: 32, height: 32 }}
              aria-label="Previous month"
              onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
            >
              <IconChevronLeft size={15} />
            </button>
            <span className="month-stepper__label">{formatMonthLabel(monthKey)}</span>
            <button
              type="button"
              className="icon-btn"
              style={{ width: 32, height: 32 }}
              aria-label="Next month"
              onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
            >
              <IconChevronRight size={15} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => openModal({ kind: 'new-tx', defaultType: 'income' })}
          >
            <IconArrowDownLeft size={15} />
            Income
          </button>

          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openModal({ kind: 'new-tx', defaultType: 'expense' })}
          >
            <IconPlus size={15} />
            Expense
          </MagneticButton>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SlidingSegmented
          value={tab}
          onChange={(next) => navigate('finance', next)}
          items={[
            { id: 'overview', label: 'Overview' },
            { id: 'transactions', label: `Ledger (${monthTransactions.length})` },
            { id: 'budgets', label: 'Budgets' },
            { id: 'wallets', label: `Wallets (${state.finance.wallets.length})` },
          ]}
        />
      </div>

      {/* Quick 1-Line Expense Entry */}
      <form className="card quick-add-bar" onSubmit={handleQuickAddExpense}>
        <input
          className="input"
          style={{ width: 145 }}
          placeholder="Amount (50k, 1.2m)"
          value={quickAmount}
          onChange={(e) => setQuickAmount(e.target.value)}
        />
        <input
          className="input"
          style={{ flex: 1, minWidth: 160 }}
          placeholder="Quick expense note (e.g., Lunch, Coffee, Whey)..."
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
        />
        <select
          className="select"
          style={{ width: 160 }}
          value={quickCat}
          onChange={(e) => setQuickCat(e.target.value)}
          aria-label="Expense category"
        >
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 145 }}
          value={quickWallet}
          onChange={(e) => setQuickWallet(e.target.value)}
          aria-label="Wallet"
        >
          {state.finance.wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--primary">
          <IconPlus size={15} />
          Quick log
        </button>
      </form>

      <div ref={contentRef}>
        {tab === 'overview' && (
          <>
            <div className="kpi-grid">
              <div className="card kpi-card tone-tile--sky fin-anim">
                <div className="kpi-card__label">Total balance</div>
                <div className="kpi-card__value">
                  {formatMoneyCompact(monthStats.totalBalance, currency)}
                </div>
                <div className="kpi-card__meta">
                  <span>{formatMoney(monthStats.totalBalance, currency)}</span>
                </div>
              </div>

              <div className="card kpi-card tone-tile--coral fin-anim">
                <div className="kpi-card__label">Spent ({formatMonthShort(monthKey)})</div>
                <div className="kpi-card__value">
                  {formatMoneyCompact(monthStats.expense, currency)}
                </div>
                <div className="kpi-card__meta">
                  <span>{formatMoney(monthStats.expense, currency)}</span>
                </div>
              </div>

              <div className="card kpi-card tone-tile--lime fin-anim">
                <div className="kpi-card__label">Income ({formatMonthShort(monthKey)})</div>
                <div className="kpi-card__value">
                  {formatMoneyCompact(monthStats.income, currency)}
                </div>
                <div className="kpi-card__meta">
                  <span>{formatMoney(monthStats.income, currency)}</span>
                </div>
              </div>

              <div className="card kpi-card fin-anim">
                <div className="kpi-card__label">Net cashflow</div>
                <div
                  className="kpi-card__value"
                  style={{ color: monthStats.net >= 0 ? 'var(--good)' : 'var(--bad)' }}
                >
                  {monthStats.net >= 0 ? '+' : ''}
                  {formatMoneyCompact(monthStats.net, currency)}
                </div>
                <div className="kpi-card__meta">
                  <span>
                    {monthStats.income > 0
                      ? `${monthStats.savingsRate}% savings rate`
                      : 'No income logged yet'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bento">
              {/* 6-Month Cashflow Chart */}
              <div className="card col-7 fin-anim">
                <div className="card__head">
                  <div>
                    <h2 className="card__title">6-Month Cashflow</h2>
                    <p className="card__sub">
                      {hoverMonthIdx !== null
                        ? `${sixMonthSeries[hoverMonthIdx].fullLabel}: In ${formatMoney(sixMonthSeries[hoverMonthIdx].income, currency)} · Out ${formatMoney(sixMonthSeries[hoverMonthIdx].expense, currency)}`
                        : 'Hover or click any month to inspect'}
                    </p>
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item">
                      <span className="legend-swatch" style={{ background: 'var(--accent)' }} />
                      Income
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch" style={{ background: 'var(--coral)' }} />
                      Expense
                    </span>
                  </div>
                </div>

                <div className="dual-chart">
                  {sixMonthSeries.map((pt, idx) => {
                    const incH = Math.max(4, Math.round((pt.income / maxChartVal) * 100));
                    const expH = Math.max(4, Math.round((pt.expense / maxChartVal) * 100));
                    const active = pt.monthKey === monthKey;
                    return (
                      <div
                        key={pt.monthKey}
                        className={`dual-chart__col ${active ? 'is-current' : ''}`}
                        onMouseEnter={() => setHoverMonthIdx(idx)}
                        onMouseLeave={() => setHoverMonthIdx(null)}
                        onClick={() => setMonthKey(pt.monthKey)}
                      >
                        <div className="dual-chart__bars">
                          <div
                            className="dual-chart__bar dual-chart__bar--in"
                            style={{ height: `${pt.income > 0 ? incH : 2}%` }}
                            title={`Income: ${formatMoney(pt.income, currency)}`}
                          />
                          <div
                            className="dual-chart__bar dual-chart__bar--out"
                            style={{ height: `${pt.expense > 0 ? expH : 2}%` }}
                            title={`Expense: ${formatMoney(pt.expense, currency)}`}
                          />
                        </div>
                        <div className="dual-chart__label">{pt.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="card col-5 fin-anim">
                <div className="card__head">
                  <div>
                    <h2 className="card__title">Spending breakdown</h2>
                    <p className="card__sub">By category in {formatMonthLabel(monthKey)}</p>
                  </div>
                  <button
                    type="button"
                    className="card__link"
                    onClick={() => navigate('finance', 'budgets')}
                  >
                    Budgets <IconChevronRight size={14} />
                  </button>
                </div>

                {monthStats.breakdown.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 12px' }}>
                    No expenses logged this month.
                  </div>
                ) : (
                  <div className="stack-list">
                    {monthStats.breakdown.map((item) => (
                      <div key={item.categoryId} className="budget-mini">
                        <div className="budget-mini__top">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span
                              className={`stage-dot stage-dot--${item.category?.tone || 'sand'}`}
                            />
                            {item.category?.name || item.categoryId}
                          </span>
                          <span style={{ fontWeight: 700 }}>
                            {formatMoney(item.amount, currency)}{' '}
                            <span style={{ color: 'var(--faint)', fontWeight: 500 }}>
                              ({item.pct}%)
                            </span>
                          </span>
                        </div>
                        <div className="meter" style={{ height: 6, margin: '6px 0 0' }}>
                          <div
                            className="meter__fill"
                            style={{
                              transform: `scaleX(${Math.max(0.03, item.pct / 100)})`,
                              background:
                                item.category?.tone === 'lime'
                                  ? 'var(--accent)'
                                  : item.category?.tone === 'sky'
                                    ? 'var(--sky)'
                                    : item.category?.tone === 'coral'
                                      ? 'var(--coral)'
                                      : 'var(--sand)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'transactions' && (
          <div className="card fin-anim">
            <div className="card__head" style={{ flexWrap: 'wrap' }}>
              <div>
                <h2 className="card__title">Transactions ({filteredTx.length})</h2>
                <p className="card__sub">Click any row to edit or delete</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="select"
                  style={{ height: 34, width: 115, padding: '0 10px', fontSize: 12.5 }}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as TxType | 'all')}
                >
                  <option value="all">All types</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
                <select
                  className="select"
                  style={{ height: 34, width: 140, padding: '0 10px', fontSize: 12.5 }}
                  value={filterWallet}
                  onChange={(e) => setFilterWallet(e.target.value)}
                >
                  <option value="all">All wallets</option>
                  {state.finance.wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  style={{ height: 34, width: 145, padding: '0 10px', fontSize: 12.5 }}
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {state.finance.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="inline-search">
                  <IconSearch size={14} />
                  <input
                    placeholder="Search notes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ height: 34, padding: '0 12px', fontSize: 12.5 }}
                  onClick={handleExportCsv}
                >
                  <IconDownload size={14} />
                  CSV
                </button>
              </div>
            </div>

            {filteredTx.length === 0 ? (
              <div className="empty-state" style={{ padding: '36px 12px' }}>
                No transactions in {formatMonthLabel(monthKey)} match your filters.
              </div>
            ) : (
              <div className="stack-list">
                {filteredTx.map((tx) => {
                  const cat = catMap.get(tx.categoryId);
                  const wFrom = walletMap.get(tx.walletId);
                  const wTo = tx.toWalletId ? walletMap.get(tx.toWalletId) : null;
                  return (
                    <div
                      key={tx.id}
                      className="tx-mini-row"
                      onClick={() => openDrawer({ kind: 'transaction', id: tx.id })}
                    >
                      <span
                        className={`tx-icon ${
                          tx.type === 'income'
                            ? 'tx-icon--in'
                            : tx.type === 'expense'
                              ? 'tx-icon--out'
                              : 'tx-icon--move'
                        }`}
                      >
                        {tx.type === 'income' ? (
                          <IconArrowDownLeft size={15} />
                        ) : tx.type === 'transfer' ? (
                          <IconRepeat size={14} />
                        ) : (
                          <IconArrowUpRight size={15} />
                        )}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tx-mini-row__title">
                          {tx.note || cat?.name || 'Transaction'}
                        </div>
                        <div className="tx-mini-row__sub">
                          {tx.type === 'transfer'
                            ? `${wFrom?.name || ''} → ${wTo?.name || ''}`
                            : `${cat?.name || ''} · ${wFrom?.name || ''}`}{' '}
                          · {formatShortDate(tx.date)}
                        </div>
                      </div>
                      <div
                        className={`tx-mini-row__amt ${
                          tx.type === 'income'
                            ? 'is-in'
                            : tx.type === 'expense'
                              ? 'is-out'
                              : ''
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatMoney(tx.amount, currency)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'budgets' && (
          <div className="card fin-anim">
            <div className="card__head">
              <div>
                <h2 className="card__title">Monthly Budgets ({formatMonthLabel(monthKey)})</h2>
                <p className="card__sub">
                  Set spending caps per category — highlights at 80% and 100%
                </p>
              </div>
            </div>

            <div className="budget-grid">
              {expenseCategories.map((cat) => {
                const budgetObj = state.finance.budgets.find((b) => b.categoryId === cat.id);
                const limit = budgetObj?.monthlyLimit || 0;
                const spent = monthStats.byCat[cat.id] || 0;
                const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                const isEditing = editingBudgetCat === cat.id;

                return (
                  <div key={cat.id} className="budget-card">
                    <div className="budget-card__head">
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                      >
                        <span className={`stage-dot stage-dot--${cat.tone}`} />
                        {cat.name}
                      </span>
                      {limit > 0 && (
                        <span
                          className={`pill ${
                            pct >= 100 ? 'pill--coral' : pct >= 80 ? 'pill--sand' : 'pill--lime'
                          }`}
                        >
                          {pct}%
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 4px' }}>
                      {formatMoney(spent, currency)}
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--muted)' }}>
                        {' '}
                        / {limit > 0 ? formatMoney(limit, currency) : 'No limit'}
                      </span>
                    </div>

                    <div className="meter" style={{ height: 7, margin: '8px 0 12px' }}>
                      <div
                        className="meter__fill"
                        style={{
                          transform: `scaleX(${limit > 0 ? Math.min(1, spent / limit) : 0})`,
                          background:
                            pct >= 100
                              ? 'var(--bad)'
                              : pct >= 80
                                ? 'var(--sand)'
                                : 'var(--accent)',
                        }}
                      />
                    </div>

                    {isEditing ? (
                      <form
                        style={{ display: 'flex', gap: 6 }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          setCategoryBudget(cat.id, parseSmartAmount(budgetDraft));
                          setEditingBudgetCat(null);
                        }}
                      >
                        <input
                          className="input"
                          autoFocus
                          style={{ height: 34, fontSize: 13 }}
                          placeholder="e.g., 3m, 500k (0 to remove)"
                          value={budgetDraft}
                          onChange={(e) => setBudgetDraft(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="btn btn--primary"
                          style={{ height: 34, padding: '0 12px' }}
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
                        onClick={() => {
                          setEditingBudgetCat(cat.id);
                          setBudgetDraft(limit > 0 ? String(limit) : '');
                        }}
                      >
                        {limit > 0 ? 'Edit limit' : '+ Set budget'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'wallets' && (
          <div className="stack-list" style={{ gap: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                Combined balance across {state.finance.wallets.length} wallets:{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {formatMoney(monthStats.totalBalance, currency)}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => openModal({ kind: 'new-tx', defaultType: 'transfer' })}
                >
                  <IconRepeat size={15} />
                  Transfer
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => openModal({ kind: 'new-wallet' })}
                >
                  <IconPlus size={15} />
                  Add wallet
                </button>
              </div>
            </div>

            <div className="wallet-grid">
              {state.finance.wallets.map((w) => {
                const bal = walletBalances[w.id] ?? w.initialBalance;
                const txCount = state.finance.transactions.filter(
                  (t) => t.walletId === w.id || t.toWalletId === w.id
                ).length;
                return (
                  <div
                    key={w.id}
                    className={`card fin-anim ${
                      w.tone === 'sky' || w.tone === 'lime' || w.tone === 'coral'
                        ? `tone-tile--${w.tone}`
                        : ''
                    }`}
                  >
                    <div className="card__head">
                      <div>
                        <div className="pill pill--muted" style={{ marginBottom: 8 }}>
                          <IconWallet size={12} />
                          {WALLET_KIND_LABEL[w.kind]}
                        </div>
                        <h3 className="card__title">{w.name}</h3>
                      </div>
                      {state.finance.wallets.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ width: 30, height: 30 }}
                          aria-label={`Delete ${w.name}`}
                          onClick={() => deleteWallet(w.id)}
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        margin: '6px 0',
                      }}
                    >
                      {formatMoney(bal, currency)}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
                      {w.note || `${txCount} transactions logged`}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
                        onClick={() =>
                          openModal({ kind: 'new-tx', defaultType: 'expense', defaultWalletId: w.id })
                        }
                      >
                        - Expense
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
                        onClick={() =>
                          openModal({ kind: 'new-tx', defaultType: 'income', defaultWalletId: w.id })
                        }
                      >
                        + Income
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

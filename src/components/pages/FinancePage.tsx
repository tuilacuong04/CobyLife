import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { TxType } from '../../types';
import {
  computeSafeToSpend,
  createDefaultFinancePeriod,
  currentCycleKey,
  detectAllWalletDrifts,
  FinancePeriodSelection,
  getCycleRange,
  getEffectiveExpense,
  getEffectiveIncome,
  isDefaultCurrentPeriod,
  isTxInCycle,
  resolveFinancePeriod,
  shiftFinancePeriod,
} from '../../utils/financeEngine';
import {
  formatMoney,
  formatMoneyCompact,
  formatMonthShort,
  formatShortDate,
  localIsoDate,
  parseSmartAmount,
  shiftMonthKey,
  WALLET_KIND_LABEL,
} from '../../utils/format';
import { useStaggerEntrance } from '../../utils/motion';
import { FinanceCalendarPopover } from '../finance/FinanceCalendarPopover';
import { GmailInboxView } from '../finance/GmailInboxView';
import { MagneticButton, SlidingSegmented } from '../Motion';
import {
  IconAlert,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconMail,
  IconPlus,
  IconRefresh,
  IconRepeat,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTrash,
  IconWallet,
} from '../Icons';

type FinanceTabId = 'overview' | 'inbox' | 'transactions' | 'budgets' | 'wallets';

export const FinancePage: React.FC = () => {
  const {
    state,
    route,
    cloudConfig,
    gmailSyncing,
    walletBalances,
    navigate,
    openModal,
    openDrawer,
    createTransaction,
    setCategoryBudget,
    deleteWallet,
    markBillPaid,
    deleteRecurringBill,
    setPaydayDay,
    syncGmailInbox,
    pushToast,
  } = useApp();

  const paydayDay = state.finance.paydayDay || 1;
  const [period, setPeriod] = useState<FinancePeriodSelection>(() =>
    createDefaultFinancePeriod(new Date(), paydayDay)
  );
  const [calOpen, setCalOpen] = useState(false);
  const calTriggerRef = useRef<HTMLButtonElement>(null);

  const [searchAllTime, setSearchAllTime] = useState(false);
  const [filterType, setFilterType] = useState<TxType | 'all' | 'split'>('all');
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

  // Keep quickWallet / quickCat valid if a wallet or category is deleted
  useEffect(() => {
    if (!state.finance.wallets.some((w) => w.id === quickWallet)) {
      setQuickWallet(state.finance.wallets[0]?.id || '');
    }
    if (!state.finance.categories.some((c) => c.id === quickCat && c.kind === 'expense')) {
      setQuickCat(state.finance.categories.find((c) => c.kind === 'expense')?.id || '');
    }
  }, [state.finance.wallets, state.finance.categories, quickWallet, quickCat]);

  useEffect(() => {
    setHoverMonthIdx(null);
  }, [period]);

  const handleSelectPeriod = (next: FinancePeriodSelection) => {
    setPeriod(next);
    setSearchAllTime(false);
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const tab: FinanceTabId =
    route.sub === 'inbox' ||
    route.sub === 'transactions' ||
    route.sub === 'budgets' ||
    route.sub === 'wallets'
      ? route.sub
      : 'overview';

  const { currency } = state.settings;
  const usdRate = state.finance.usdVndRate || 25500;
  const cycleRange = useMemo(
    () => resolveFinancePeriod(period, paydayDay, state.finance.transactions),
    [period, paydayDay, state.finance.transactions]
  );

  const periodAnimKey = `${period.kind}:${cycleRange.startIso}:${cycleRange.endIso}`;
  useStaggerEntrance(contentRef, '.fin-anim', [tab, periodAnimKey]);

  const isDefaultPeriod = isDefaultCurrentPeriod(period, paydayDay);
  const budgetMultiplier = cycleRange.budgetMultiplier ?? 1;
  const isScaledBudget = Math.abs(budgetMultiplier - 1) > 0.001;
  const activeBillCycleKey = cycleRange.isCurrent
    ? currentCycleKey(new Date(), paydayDay)
    : cycleRange.cycleKey;

  const periodBadge = useMemo(() => {
    if (period.kind === '3m') return '3M';
    if (period.kind === '6m') return '6M';
    if (period.kind === 'year') return '1Y';
    if (period.kind === 'all') return 'ALL';
    if (period.kind === 'custom') {
      if (Number.isInteger(budgetMultiplier) && budgetMultiplier > 1) {
        return `${budgetMultiplier}M`;
      }
      return `${cycleRange.daysTotal}D`;
    }
    return null;
  }, [period.kind, budgetMultiplier, cycleRange.daysTotal]);

  const pendingInbox = useMemo(
    () => state.finance.inbox.filter((it) => it.status === 'pending'),
    [state.finance.inbox]
  );

  const walletDrifts = useMemo(
    () => detectAllWalletDrifts(state.finance.wallets, walletBalances, pendingInbox),
    [state.finance.wallets, walletBalances, pendingInbox]
  );
  const driftList = Object.values(walletDrifts);

  const catMap = useMemo(
    () => new Map(state.finance.categories.map((c) => [c.id, c])),
    [state.finance.categories]
  );
  const walletMap = useMemo(
    () => new Map(state.finance.wallets.map((w) => [w.id, w])),
    [state.finance.wallets]
  );

  const cycleTransactions = useMemo(
    () =>
      state.finance.transactions
        .filter((tx) => isTxInCycle(tx, cycleRange))
        .sort((a, b) => (b.timestamp || b.date).localeCompare(a.timestamp || a.date)),
    [state.finance.transactions, cycleRange]
  );

  const safeMetrics = useMemo(
    () => computeSafeToSpend(state.finance, cycleRange),
    [state.finance, cycleRange]
  );

  const monthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCat: Record<string, number> = {};
    for (const tx of cycleTransactions) {
      const inc = getEffectiveIncome(tx);
      const exp = getEffectiveExpense(tx);
      if (inc > 0) income += inc;
      if (exp > 0) {
        expense += exp;
        byCat[tx.categoryId] = (byCat[tx.categoryId] || 0) + exp;
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
  }, [cycleTransactions, walletBalances, catMap]);

  const chartSeries = useMemo(() => {
    const coveredCount = cycleRange.coveredCycleKeys?.length || 1;
    const showTwelve =
      period.kind === 'year' ||
      period.kind === 'all' ||
      period.kind === '6m' ||
      coveredCount > 6;

    const keys =
      period.kind === 'year'
        ? Array.from(
            { length: 12 },
            (_, i) => `${period.year}-${String(i + 1).padStart(2, '0')}`
          )
        : Array.from({ length: showTwelve ? 12 : 6 }, (_, i) =>
            shiftMonthKey(cycleRange.cycleKey, i - (showTwelve ? 11 : 5))
          );

    return keys.map((ck) => {
      const r = getCycleRange(ck, paydayDay);
      let inc = 0;
      let exp = 0;
      for (const tx of state.finance.transactions) {
        if (!isTxInCycle(tx, r)) continue;
        inc += getEffectiveIncome(tx);
        exp += getEffectiveExpense(tx);
      }
      return {
        cycleKey: ck,
        label: showTwelve ? formatMonthShort(ck) : r.shortLabel,
        fullLabel: r.label,
        income: inc,
        expense: exp,
      };
    });
  }, [
    state.finance.transactions,
    period.kind,
    period.year,
    cycleRange.cycleKey,
    cycleRange.coveredCycleKeys,
    paydayDay,
  ]);

  const coveredChartKeys = useMemo(
    () => new Set(cycleRange.coveredCycleKeys || [cycleRange.cycleKey]),
    [cycleRange.coveredCycleKeys, cycleRange.cycleKey]
  );

  const maxChartVal = useMemo(() => {
    const floor = currency === 'USD' ? 100 : 1_000_000;
    return Math.max(floor, ...chartSeries.flatMap((m) => [m.income, m.expense]));
  }, [chartSeries, currency]);

  const effectiveAllTime = searchAllTime || period.kind === 'all';

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    const baseList = effectiveAllTime
      ? [...state.finance.transactions].sort((a, b) =>
          (b.timestamp || b.date).localeCompare(a.timestamp || a.date)
        )
      : cycleTransactions;

    return baseList.filter((tx) => {
      if (filterType === 'split') {
        if (!tx.split) return false;
      } else if (filterType !== 'all' && tx.type !== filterType) {
        return false;
      }
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
          !wName.includes(q) &&
          !String(tx.amount).includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    effectiveAllTime,
    state.finance.transactions,
    cycleTransactions,
    filterType,
    filterWallet,
    filterCat,
    search,
    catMap,
    walletMap,
  ]);

  const handleQuickAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseSmartAmount(quickAmount);
    if (amount <= 0) {
      pushToast('Enter a valid amount (e.g., 45k, 1,500k, 45k+15k)');
      return;
    }
    const targetWallet = quickWallet || state.finance.wallets[0]?.id;
    const targetCat =
      quickCat || state.finance.categories.find((c) => c.kind === 'expense')?.id || '';
    if (!targetWallet) return;
    const today = localIsoDate();
    const txDate = cycleRange.isCurrent
      ? today
      : today < cycleRange.startIso
        ? cycleRange.startIso
        : cycleRange.endIso;

    createTransaction({
      type: 'expense',
      amount,
      categoryId: targetCat,
      walletId: targetWallet,
      date: txDate,
      note: quickNote.trim() || catMap.get(targetCat)?.name || 'Expense',
      source: 'manual',
    });
    setQuickAmount('');
    setQuickNote('');
  };

  const handleExportCsv = () => {
    const header = ['Date', 'Type', 'Amount', 'PersonalShare', 'Category', 'Wallet', 'ToWallet', 'Source', 'Note'];
    const rows = filteredTx.map((tx) => [
      tx.date,
      tx.type,
      String(tx.amount),
      String(tx.split ? tx.split.myShare : tx.amount),
      `"${(catMap.get(tx.categoryId)?.name || '').replace(/"/g, '""')}"`,
      `"${(walletMap.get(tx.walletId)?.name || '').replace(/"/g, '""')}"`,
      `"${(tx.toWalletId ? walletMap.get(tx.toWalletId)?.name || '' : '').replace(/"/g, '""')}"`,
      tx.source || 'manual',
      `"${tx.note.replace(/"/g, '""')}"`,
    ]);
    const csv = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileSlug = effectiveAllTime
      ? 'all-time'
      : period.kind === 'cycle'
        ? period.cycleKey
        : period.kind === '3m'
          ? `3m-${period.cycleKey}`
          : period.kind === '6m'
            ? `6m-${period.cycleKey}`
            : period.kind === 'year'
              ? `year-${period.year}`
              : cycleRange.startIso === cycleRange.endIso
                ? cycleRange.startIso
                : `${cycleRange.startIso}-to-${cycleRange.endIso}`;
    a.download = `finance-${fileSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(`Exported ${filteredTx.length} transactions to CSV`);
  };

  const expenseCategories = state.finance.categories.filter((c) => c.kind === 'expense');
  const isGmailConfigured = Boolean(
    cloudConfig.gmailIngestKey?.trim() || cloudConfig.gmailGasExecUrl?.trim()
  );
  const hoveredChartPoint = hoverMonthIdx !== null ? chartSeries[hoverMonthIdx] : undefined;

  return (
    <>
      {/* Compact Mobile-Web-First Header Bar */}
      <div className="fin-topbar">
        <div className="fin-topbar__left">
          <div className="month-stepper">
            <button
              type="button"
              className="icon-btn month-stepper__arrow"
              aria-label="Previous period"
              disabled={period.kind === 'all'}
              onClick={() => setPeriod((p) => shiftFinancePeriod(p, -1, paydayDay))}
            >
              <IconChevronLeft size={15} />
            </button>

            <button
              ref={calTriggerRef}
              type="button"
              className={`month-stepper__trigger ${calOpen ? 'is-open' : ''}`}
              aria-haspopup="dialog"
              aria-expanded={calOpen}
              onClick={() => setCalOpen((v) => !v)}
              title="Open calendar & period range picker"
            >
              <IconCalendar size={14} className="month-stepper__cal-icon" />
              <span className="month-stepper__label">{cycleRange.label}</span>
              {periodBadge && <span className="month-stepper__badge">{periodBadge}</span>}
              <span className={`month-stepper__chev ${calOpen ? 'is-open' : ''}`} aria-hidden="true">
                <IconChevronRight size={12} />
              </span>
            </button>

            <button
              type="button"
              className="icon-btn month-stepper__arrow"
              aria-label="Next period"
              disabled={period.kind === 'all'}
              onClick={() => setPeriod((p) => shiftFinancePeriod(p, 1, paydayDay))}
            >
              <IconChevronRight size={15} />
            </button>
          </div>

          <FinanceCalendarPopover
            open={calOpen}
            anchorRef={calTriggerRef}
            onClose={() => setCalOpen(false)}
            selection={period}
            activeRange={cycleRange}
            paydayDay={paydayDay}
            transactions={state.finance.transactions}
            currency={currency}
            onSelectPeriod={handleSelectPeriod}
          />

          {!isDefaultPeriod && (
            <button
              type="button"
              className="fin-reset-pill fin-desk-only"
              onClick={() => handleSelectPeriod(createDefaultFinancePeriod(new Date(), paydayDay))}
              title="Reset to current cycle"
            >
              Today
            </button>
          )}

          <span className="fin-desk-only" style={{ fontSize: 13, color: 'var(--muted)' }}>
            Total balance: <strong style={{ color: 'var(--text)' }}>{formatMoney(monthStats.totalBalance, currency)}</strong>
          </span>
        </div>

        <div className="fin-topbar__right">
          <button
            type="button"
            className={`sync-pill ${gmailSyncing ? 'is-syncing' : ''}`}
            onClick={() => {
              if (isGmailConfigured) {
                void syncGmailInbox({ triggerGas: true });
                if (tab !== 'inbox') navigate('finance', 'inbox');
              } else {
                openModal({ kind: 'gmail-setup' });
              }
            }}
            title={isGmailConfigured ? 'Sync new bank & receipt emails from Gmail' : 'Set up 24/7 Gmail Sync'}
          >
            {isGmailConfigured && <span className="sync-pill__dot" />}
            <IconRefresh size={14} />
            <span>{gmailSyncing ? 'Syncing...' : isGmailConfigured ? 'Sync Gmail' : 'Connect Gmail'}</span>
          </button>

          <button
            type="button"
            className="btn btn--ghost fin-desk-only"
            onClick={() => openModal({ kind: 'new-tx', defaultType: 'income' })}
          >
            <IconArrowDownLeft size={15} />
            Income
          </button>

          <MagneticButton
            type="button"
            className="btn btn--primary fin-desk-only"
            onClick={() => openModal({ kind: 'new-tx', defaultType: 'expense' })}
          >
            <IconPlus size={15} />
            Expense
          </MagneticButton>
        </div>
      </div>

      {/* Zero-Truncation 5-Tab Segmented Bar (315px <= 347px on 375px phones) */}
      <div style={{ marginBottom: 14 }}>
        <SlidingSegmented
          className="seg--fin"
          value={tab}
          onChange={(next) => navigate('finance', next)}
          items={[
            { id: 'overview', label: 'Overview' },
            { id: 'inbox', label: 'Inbox', badge: pendingInbox.length, badgeTone: 'coral' },
            { id: 'transactions', label: 'Ledger' },
            { id: 'budgets', label: 'Budgets' },
            { id: 'wallets', label: 'Wallets' },
          ]}
        />
      </div>

      {/* Desktop-Only 1-Line Quick Expense Entry (Replaced by Thumb FAB on Mobile Web) */}
      {(tab === 'overview' || tab === 'transactions') && (
        <form className="card quick-add-bar fin-desk-only" onSubmit={handleQuickAddExpense}>
          <input
            className="input"
            style={{ width: 155 }}
            placeholder="Amount (50k, 45k+15k)"
            value={quickAmount}
            onChange={(e) => setQuickAmount(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Quick expense note (e.g., Lunch, Coffee, Parking)..."
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
      )}

      <div ref={contentRef}>
        {tab === 'overview' && (
          <>
            {/* Safe-to-Spend Today & Gmail Status Hero */}
            <div className="card pace-hero fin-anim">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {safeMetrics.paceStatus === 'unbudgeted'
                      ? period.kind === 'cycle'
                        ? 'Cycle Personal Spend'
                        : 'Period Personal Spend'
                      : cycleRange.isCurrent
                        ? 'Safe to Spend Today'
                        : 'Daily Spend Average'}
                  </span>
                  {safeMetrics.paceStatus !== 'unbudgeted' && (
                    <span
                      className={`pill ${
                        safeMetrics.paceStatus === 'over-pace'
                          ? 'pill--coral'
                          : safeMetrics.paceStatus === 'watch'
                            ? 'pill--sand'
                            : 'pill--lime'
                      }`}
                    >
                      {safeMetrics.paceStatus === 'over-pace'
                        ? 'Over pace'
                        : safeMetrics.paceStatus === 'watch'
                          ? 'Watch pace'
                          : 'On pace'}
                    </span>
                  )}
                  {isScaledBudget && safeMetrics.totalBudget > 0 && (
                    <span className="pill pill--sky">
                      {Number.isInteger(budgetMultiplier)
                        ? `${budgetMultiplier}× monthly cap`
                        : `${cycleRange.daysTotal}d pro-rated`}
                    </span>
                  )}
                  {paydayDay > 1 && (
                    <span className="pill pill--muted">Payday: {paydayDay}th</span>
                  )}
                </div>

                <div className="pace-hero__num">
                  {safeMetrics.paceStatus === 'unbudgeted'
                    ? formatMoney(monthStats.expense, currency)
                    : cycleRange.isCurrent
                      ? `${formatMoney(safeMetrics.safeToday, currency)} / day`
                      : `${formatMoney(
                          Math.round(monthStats.expense / Math.max(1, cycleRange.daysTotal)),
                          currency
                        )} / day`}
                </div>

                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                  {safeMetrics.paceStatus === 'unbudgeted' ? (
                    <span>Set category budgets to unlock daily safe-to-spend pacing</span>
                  ) : cycleRange.isCurrent ? (
                    <span>
                      <strong>{formatMoney(safeMetrics.remainingPool, currency)}</strong> budget left ·{' '}
                      {cycleRange.daysRemaining} day{cycleRange.daysRemaining === 1 ? '' : 's'} remaining
                    </span>
                  ) : (
                    <span>
                      <strong>{formatMoney(safeMetrics.remainingPool, currency)}</strong> left of{' '}
                      {formatMoney(safeMetrics.totalBudget, currency)} · {cycleRange.label}
                    </span>
                  )}
                </div>

                {safeMetrics.totalBudget > 0 && (
                  <>
                    <div className="pace-track" title={`Spent ${safeMetrics.actualPct}% vs Ideal pace ${safeMetrics.idealPct}%`}>
                      <div
                        className="pace-track__fill"
                        style={{
                          width: `${Math.min(100, Math.max(2, safeMetrics.actualPct))}%`,
                          background:
                            safeMetrics.paceStatus === 'over-pace'
                              ? 'var(--coral)'
                              : safeMetrics.paceStatus === 'watch'
                                ? 'var(--sand)'
                                : 'var(--accent)',
                        }}
                      />
                      <span
                        className="pace-track__marker"
                        style={{ left: `${Math.min(100, Math.max(0, safeMetrics.idealPct))}%` }}
                        title={`Ideal linear pace (${safeMetrics.idealPct}%)`}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--faint)' }}>
                      <span>Used {safeMetrics.actualPct}% of budget</span>
                      <span>
                        {period.kind === 'cycle' ? 'Cycle' : 'Period'} elapsed {safeMetrics.idealPct}%
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actionable Smart Alerts Stack */}
              <div className="stack-list" style={{ gap: 8 }}>
                <button
                  type="button"
                  onClick={() => navigate('finance', 'inbox')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 13,
                    background: 'var(--well)',
                    border: '1px solid var(--line)',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <IconMail size={15} style={{ color: pendingInbox.length > 0 ? 'var(--coral)' : 'var(--accent)' }} />
                    {pendingInbox.length > 0
                      ? `${pendingInbox.length} Gmail transaction${pendingInbox.length > 1 ? 's' : ''} to review`
                      : 'Gmail Inbox Zero'}
                  </span>
                  <IconChevronRight size={14} />
                </button>

                {driftList.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      openModal({
                        kind: 'reconcile-wallet',
                        walletId: driftList[0].walletId,
                        targetBalance: driftList[0].reportedBalance,
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 13,
                      background: 'color-mix(in srgb, var(--coral) 12%, var(--well))',
                      border: '1px solid color-mix(in srgb, var(--coral) 36%, var(--line))',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600 }}>
                      <IconAlert size={14} style={{ color: 'var(--coral)' }} />
                      Balance gap detected ({formatMoney(driftList[0].drift, currency)})
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--coral)' }}>Reconcile</span>
                  </button>
                )}

                {safeMetrics.openReimbursementsTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType('split');
                      navigate('finance', 'transactions');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 13,
                      background: 'var(--well)',
                      border: '1px solid var(--line)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600 }}>
                      Fronted / Split owed back ({safeMetrics.openReimbursementsCount})
                    </span>
                    <strong style={{ fontSize: 12.5, color: 'var(--sky)' }}>
                      +{formatMoney(safeMetrics.openReimbursementsTotal, currency)}
                    </strong>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openModal({ kind: 'quick-log' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 13,
                    background: 'var(--well)',
                    border: '1px solid var(--line)',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <IconPlus size={14} style={{ color: 'var(--accent)' }} />
                    Quick Log Cash / Instant QR (000 keypad)
                  </span>
                  <IconChevronRight size={14} />
                </button>
              </div>
            </div>

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
                <div className="kpi-card__label">Personal spent</div>
                <div className="kpi-card__value">
                  {formatMoneyCompact(monthStats.expense, currency)}
                </div>
                <div className="kpi-card__meta">
                  <span>{formatMoney(monthStats.expense, currency)}</span>
                </div>
              </div>

              <div className="card kpi-card tone-tile--lime fin-anim">
                <div className="kpi-card__label">Personal income</div>
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
              {/* Multi-Cycle Cashflow Chart (6 or 12 cycles) */}
              <div className="card col-7 fin-anim">
                <div className="card__head">
                  <div>
                    <h2 className="card__title">
                      {period.kind === 'year'
                        ? `${period.year} Cashflow`
                        : chartSeries.length === 12
                          ? '12-Cycle Cashflow'
                          : '6-Cycle Cashflow'}
                    </h2>
                    <p className="card__sub">
                      {hoveredChartPoint
                        ? `${hoveredChartPoint.fullLabel}: In ${formatMoney(hoveredChartPoint.income, currency)} · Out ${formatMoney(hoveredChartPoint.expense, currency)}`
                        : 'Tap any bar to jump directly to that cycle'}
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

                <div className={`dual-chart ${chartSeries.length === 12 ? 'dual-chart--12' : ''}`}>
                  {chartSeries.map((pt, idx) => {
                    const incH = Math.max(4, Math.round((pt.income / maxChartVal) * 100));
                    const expH = Math.max(4, Math.round((pt.expense / maxChartVal) * 100));
                    const inSelectedRange = coveredChartKeys.has(pt.cycleKey);
                    const isPrimaryAnchor = pt.cycleKey === cycleRange.cycleKey && period.kind === 'cycle';
                    return (
                      <div
                        key={pt.cycleKey}
                        className={[
                          'dual-chart__col',
                          isPrimaryAnchor ? 'is-current' : '',
                          inSelectedRange ? 'is-in-range' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onMouseEnter={() => setHoverMonthIdx(idx)}
                        onMouseLeave={() => setHoverMonthIdx(null)}
                        onClick={() =>
                          handleSelectPeriod({
                            kind: 'cycle',
                            cycleKey: pt.cycleKey,
                            year: Number(pt.cycleKey.slice(0, 4)),
                          })
                        }
                      >
                        <div className="dual-chart__bars">
                          <div
                            className="dual-chart__bar dual-chart__bar--in"
                            style={{ height: `${pt.income > 0 ? incH : 2}%` }}
                            title={`${pt.fullLabel} · Income: ${formatMoney(pt.income, currency)}`}
                          />
                          <div
                            className="dual-chart__bar dual-chart__bar--out"
                            style={{ height: `${pt.expense > 0 ? expH : 2}%` }}
                            title={`${pt.fullLabel} · Expense: ${formatMoney(pt.expense, currency)}`}
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
                    <p className="card__sub">Personal share in {cycleRange.label}</p>
                  </div>
                  <button
                    type="button"
                    className="card__link"
                    onClick={() => openModal({ kind: 'manage-categories' })}
                  >
                    Categories <IconChevronRight size={14} />
                  </button>
                </div>

                {monthStats.breakdown.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 12px' }}>
                    No personal expenses logged in this period.
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

        {tab === 'inbox' && (
          <div className="fin-anim">
            <GmailInboxView walletDrifts={walletDrifts} />
          </div>
        )}

        {tab === 'transactions' && (
          <div className="card fin-anim">
            <div className="card__head" style={{ flexWrap: 'wrap' }}>
              <div>
                <h2 className="card__title">Ledger ({filteredTx.length})</h2>
                <p className="card__sub">
                  {effectiveAllTime ? 'All recorded history' : cycleRange.label} · Tap any row to edit, settle splits, or delete
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="select"
                  style={{ height: 34, width: 122, padding: '0 10px', fontSize: 12.5 }}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as TxType | 'all' | 'split')}
                >
                  <option value="all">All types</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                  <option value="split">Split / Fronted</option>
                </select>
                <select
                  className="select"
                  style={{ height: 34, width: 136, padding: '0 10px', fontSize: 12.5 }}
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
                  style={{ height: 34, width: 142, padding: '0 10px', fontSize: 12.5 }}
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
                    placeholder="Search notes, merchant..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className={`btn btn--sm ${effectiveAllTime ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => {
                    if (period.kind === 'all') {
                      handleSelectPeriod(createDefaultFinancePeriod(new Date(), paydayDay));
                    } else {
                      setSearchAllTime((v) => !v);
                    }
                  }}
                  title="Toggle searching across all cycles vs selected period"
                >
                  {effectiveAllTime
                    ? 'All cycles'
                    : period.kind === 'cycle'
                      ? 'This cycle'
                      : 'Selected range'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleExportCsv}
                >
                  <IconDownload size={14} />
                  CSV
                </button>
              </div>
            </div>

            {filteredTx.length === 0 ? (
              <div className="empty-state" style={{ padding: '36px 12px' }}>
                No transactions match your filters.
              </div>
            ) : (
              <div className="stack-list">
                {filteredTx.map((tx) => {
                  const cat = catMap.get(tx.categoryId);
                  const wFrom = walletMap.get(tx.walletId);
                  const wTo = tx.toWalletId ? walletMap.get(tx.toWalletId) : null;
                  const owed =
                    tx.split && tx.split.status === 'open'
                      ? Math.max(0, tx.split.reimbursable - tx.split.repaidAmount)
                      : 0;

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
                        <div
                          className="tx-mini-row__title"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                        >
                          <span>{tx.note || cat?.name || 'Transaction'}</span>
                          {tx.source === 'gmail' && (
                            <span className="pill pill--muted" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                              Gmail
                            </span>
                          )}
                          {owed > 0 && (
                            <span className="pill pill--sky" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                              +{formatMoneyCompact(owed, currency)} owed
                            </span>
                          )}
                          {tx.repaymentForTxId && (
                            <span className="pill pill--lime" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                              Split repaid
                            </span>
                          )}
                        </div>
                        <div className="tx-mini-row__sub">
                          {tx.type === 'transfer'
                            ? `${wFrom?.name || ''} → ${wTo?.name || ''}`
                            : `${cat?.name || ''} · ${wFrom?.name || ''}`}{' '}
                          · {formatShortDate(tx.date)}
                          {tx.split && ` · My share: ${formatMoney(tx.split.myShare, currency)}`}
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
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '⇄ '}
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
          <div className="stack-list" style={{ gap: 16 }}>
            {/* Payday Cycle & Category Controls */}
            <div className="card fin-anim">
              <div className="card__head" style={{ flexWrap: 'wrap' }}>
                <div>
                  <h2 className="card__title">
                    {period.kind === 'cycle'
                      ? `Cycle Budgets (${cycleRange.label})`
                      : `Period Budgets (${cycleRange.label})`}
                  </h2>
                  <p className="card__sub">
                    {isScaledBudget
                      ? `Scaled to ${
                          Number.isInteger(budgetMultiplier)
                            ? `${budgetMultiplier}× monthly limits`
                            : `${cycleRange.daysTotal}-day pro-rated limits`
                        } — editing updates base monthly cap`
                      : 'Personal share caps per category — highlights at 80% and 100%'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)' }}>
                    <span>Payday cycle start:</span>
                    <select
                      className="select"
                      style={{ height: 34, width: 92, padding: '0 8px', fontSize: 12.5 }}
                      value={paydayDay}
                      onChange={(e) => {
                        const nextDay = Number(e.target.value) || 1;
                        setPaydayDay(nextDay);
                        const nextCk = currentCycleKey(new Date(), nextDay);
                        setPeriod((prev) => ({
                          ...prev,
                          cycleKey: nextCk,
                          year: prev.kind === 'year' ? prev.year : Number(nextCk.slice(0, 4)),
                        }));
                      }}
                    >
                      {[1, 5, 10, 15, 20, 25, 28].map((d) => (
                        <option key={d} value={d}>
                          Day {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => openModal({ kind: 'manage-categories' })}
                  >
                    <IconSettings size={14} />
                    Categories
                  </button>
                </div>
              </div>

              <div className="budget-grid">
                {expenseCategories.map((cat) => {
                  const budgetObj = state.finance.budgets.find((b) => b.categoryId === cat.id);
                  const baseLimit = budgetObj?.monthlyLimit || 0;
                  const limit = baseLimit > 0 ? Math.round(baseLimit * budgetMultiplier) : 0;
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

                      {isScaledBudget && baseLimit > 0 && (
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}>
                          {Number.isInteger(budgetMultiplier)
                            ? `${budgetMultiplier}× monthly limit (${formatMoney(baseLimit, currency)}/mo)`
                            : `${cycleRange.daysTotal}d pro-rated (${formatMoney(baseLimit, currency)}/mo base)`}
                        </div>
                      )}

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
                            style={{ height: 34, fontSize: 13 }}
                            placeholder="Monthly cap (e.g., 3m, 500k)"
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
                            setBudgetDraft(baseLimit > 0 ? String(baseLimit) : '');
                          }}
                        >
                          {baseLimit > 0
                            ? isScaledBudget
                              ? 'Edit monthly cap'
                              : 'Edit limit'
                            : '+ Set budget'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recurring Subscriptions & Monthly Bills (Auto-matched with Gmail) */}
            <div className="card fin-anim">
              <div className="card__head">
                <div>
                  <h2 className="card__title">Recurring Bills &amp; Subscriptions</h2>
                  <p className="card__sub">
                    Automatically marked paid when matching Gmail receipts arrive
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => openModal({ kind: 'new-bill' })}
                >
                  <IconPlus size={14} />
                  Add bill
                </button>
              </div>

              {(state.finance.recurringBills || []).length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 12px' }}>
                  No recurring bills added yet (e.g., Rent, Internet, Cursor, Spotify, iCloud+).
                </div>
              ) : (
                <div className="stack-list">
                  {state.finance.recurringBills.map((bill) => {
                    const isPaid = bill.lastPaidCycleKey === activeBillCycleKey;
                    const vndEq =
                      bill.currency === 'USD' ? Math.round(bill.amount * usdRate) : bill.amount;

                    return (
                      <div
                        key={bill.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          flexWrap: 'wrap',
                          padding: '11px 14px',
                          borderRadius: 14,
                          background: 'var(--well)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 14 }}>{bill.name}</strong>
                            <span className={`pill ${isPaid ? 'pill--lime' : 'pill--sand'}`}>
                              {isPaid ? 'Paid this cycle' : `Due day ${bill.dueDay}`}
                            </span>
                            {bill.merchantPattern && (
                              <span className="pill pill--muted" title="Gmail match keyword">
                                <IconSparkles size={11} />
                                {bill.merchantPattern}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {bill.currency === 'USD'
                              ? `$${bill.amount} USD (~${formatMoney(vndEq, 'VND')})`
                              : formatMoney(bill.amount, currency)}{' '}
                            · {bill.cadence} · {walletMap.get(bill.walletId)?.name || 'Wallet'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {!isPaid && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => markBillPaid(bill.id, activeBillCycleKey)}
                            >
                              <IconCheck size={13} />
                              Mark Paid
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 30, height: 30 }}
                            onClick={() => openModal({ kind: 'new-bill', editBillId: bill.id })}
                            aria-label={`Edit ${bill.name}`}
                          >
                            <IconCalendar size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 30, height: 30 }}
                            onClick={() => deleteRecurringBill(bill.id)}
                            aria-label={`Delete ${bill.name}`}
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  className="btn btn--ghost btn--sm"
                  onClick={() => openModal({ kind: 'new-tx', defaultType: 'transfer' })}
                >
                  <IconRepeat size={14} />
                  Transfer
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => openModal({ kind: 'new-wallet' })}
                >
                  <IconPlus size={14} />
                  Add wallet
                </button>
              </div>
            </div>

            <div className="wallet-grid">
              {state.finance.wallets.map((w) => {
                const bal = walletBalances[w.id] ?? w.initialBalance;
                const drift = walletDrifts[w.id];
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
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          <span className="pill pill--muted">
                            <IconWallet size={12} />
                            {WALLET_KIND_LABEL[w.kind]}
                          </span>
                          {w.accountHint && (
                            <span className="pill pill--sky">*{w.accountHint}</span>
                          )}
                        </div>
                        <h3 className="card__title">{w.name}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ width: 30, height: 30 }}
                          aria-label={`Edit ${w.name}`}
                          onClick={() => openModal({ kind: 'new-wallet', editWalletId: w.id })}
                        >
                          <IconEdit size={14} />
                        </button>
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
                    </div>

                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        margin: '4px 0 6px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatMoney(bal, currency)}
                    </div>

                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
                      {w.note || `${txCount} recorded transactions`}
                    </div>

                    {drift && (
                      <div className="drift-alert" style={{ marginBottom: 12 }}>
                        <span>
                          Gmail bal: <strong>{formatMoney(drift.reportedBalance, currency)}</strong> (
                          {drift.drift > 0 ? '+' : ''}
                          {formatMoney(drift.drift, currency)})
                        </span>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() =>
                            openModal({
                              kind: 'reconcile-wallet',
                              walletId: w.id,
                              targetBalance: drift.reportedBalance,
                            })
                          }
                        >
                          Fix
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() =>
                          openModal({ kind: 'new-tx', defaultType: 'expense', defaultWalletId: w.id })
                        }
                      >
                        - Expense
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() =>
                          openModal({ kind: 'reconcile-wallet', walletId: w.id })
                        }
                      >
                        {w.kind === 'cash' ? 'Count Cash' : 'Reconcile'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mobile-Web Thumb-Zone Sticky Quick Log Button (z-index: 85 < scrim 95) */}
      <button
        type="button"
        className="fin-fab"
        onClick={() => openModal({ kind: 'quick-log' })}
      >
        <IconPlus size={16} />
        Quick Log
      </button>
    </>
  );
};

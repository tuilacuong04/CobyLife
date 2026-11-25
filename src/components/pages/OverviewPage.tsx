import React, { useMemo, useRef } from 'react';
import { APP_MODULES } from '../../modules/registry';
import { useApp } from '../../store/AppContext';
import {
  currentMonthKey,
  formatFullDate,
  formatMoney,
  formatMoneyCompact,
  formatShortDate,
  greetingEn,
  localIsoDate,
  relativeDueLabel,
  TASK_CATEGORY_META,
  TASK_PRIORITY_META,
  WALLET_KIND_LABEL,
} from '../../utils/format';
import { useScrollReveal, useStaggerEntrance } from '../../utils/motion';
import { MagneticButton } from '../Motion';
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCheck,
  IconChevronRight,
  IconModuleGlyph,
  IconPlus,
  IconWallet,
} from '../Icons';

export const OverviewPage: React.FC = () => {
  const {
    state,
    walletBalances,
    navigate,
    openModal,
    openDrawer,
    toggleTaskDone,
  } = useApp();

  const kpiRef = useRef<HTMLDivElement>(null);
  const bentoRef = useRef<HTMLDivElement>(null);

  useStaggerEntrance(kpiRef, '.kpi-card', []);
  useScrollReveal(bentoRef, '.bento-card', []);

  const today = localIsoDate();
  const thisMonth = currentMonthKey();
  const { currency, profile } = state.settings;

  const tasksToday = useMemo(
    () =>
      state.tasks
        .filter((t) => t.dueDate && t.dueDate <= today)
        .sort((a, b) => {
          if (a.status === 'done' && b.status !== 'done') return 1;
          if (a.status !== 'done' && b.status === 'done') return -1;
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
        }),
    [state.tasks, today]
  );
  const openTasksToday = tasksToday.filter((t) => t.status !== 'done');
  const overdueCount = openTasksToday.filter((t) => t.dueDate && t.dueDate < today).length;
  const doneTasksToday = tasksToday.filter((t) => t.status === 'done').length;
  const tasksTodayPct =
    tasksToday.length > 0 ? Math.round((doneTasksToday / tasksToday.length) * 100) : 100;
  const openTasksTotal = state.tasks.filter((t) => t.status !== 'done').length;

  const financeMetrics = useMemo(() => {
    let monthExpense = 0;
    let monthIncome = 0;
    let monthTxCount = 0;
    const spentByCat: Record<string, number> = {};
    for (const tx of state.finance.transactions) {
      if (!tx.date.startsWith(thisMonth)) continue;
      monthTxCount++;
      if (tx.type === 'expense') {
        monthExpense += tx.amount;
        spentByCat[tx.categoryId] = (spentByCat[tx.categoryId] || 0) + tx.amount;
      } else if (tx.type === 'income') {
        monthIncome += tx.amount;
      }
    }
    const netMonth = monthIncome - monthExpense;
    const savingsRate =
      monthIncome > 0 ? Math.max(-99, Math.round((netMonth / monthIncome) * 100)) : 0;
    const totalBalance = Object.values(walletBalances).reduce((sum, v) => sum + v, 0);
    const totalBudget = state.finance.budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
    const budgetPct = totalBudget > 0 ? Math.round((monthExpense / totalBudget) * 100) : 0;
    const recent = [...state.finance.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    const catMap = new Map(state.finance.categories.map((c) => [c.id, c]));
    const topBudgets = state.finance.budgets
      .map((b) => {
        const spent = spentByCat[b.categoryId] || 0;
        const pct = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0;
        return {
          ...b,
          spent,
          pct,
          category: catMap.get(b.categoryId),
        };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);

    return {
      monthExpense,
      monthIncome,
      monthTxCount,
      netMonth,
      savingsRate,
      totalBalance,
      totalBudget,
      budgetPct,
      recent,
      topBudgets,
      catMap,
    };
  }, [state.finance, walletBalances, thisMonth]);

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">
            {greetingEn()}, {profile.name}
          </h1>
          <p className="phead__sub">
            {formatFullDate()} · {openTasksToday.length} tasks due today · Balance{' '}
            {formatMoneyCompact(financeMetrics.totalBalance, currency)}
          </p>
        </div>
        <div className="phead__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => openModal({ kind: 'new-tx', defaultType: 'expense' })}
          >
            <IconWallet size={15} />
            Log expense
          </button>
          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openModal({ kind: 'new-task' })}
          >
            <IconPlus size={15} />
            New task
          </MagneticButton>
        </div>
      </div>

      {/* 4 Unified Live KPI Cards */}
      <div ref={kpiRef} className="kpi-grid">
        <div
          className="card kpi-card tone-tile--sky"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('tasks', 'agenda')}
        >
          <div className="kpi-card__label">Tasks today</div>
          <div className="kpi-card__value">
            {doneTasksToday}/{tasksToday.length}
          </div>
          <div className="meter">
            <div
              className="meter__fill"
              style={{ transform: `scaleX(${Math.max(0.06, tasksTodayPct / 100)})` }}
            />
          </div>
          <div className="kpi-card__meta">
            {overdueCount > 0 ? (
              <span className="kpi-card__delta is-neg">{overdueCount} overdue</span>
            ) : (
              <span className="kpi-card__delta">On track</span>
            )}
            <span>· {openTasksTotal} open total</span>
          </div>
        </div>

        <div
          className="card kpi-card tone-tile--coral"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('finance', 'overview')}
        >
          <div className="kpi-card__label">Spent this month</div>
          <div className="kpi-card__value">
            {formatMoneyCompact(financeMetrics.monthExpense, currency)}
          </div>
          <div className="meter">
            <div
              className="meter__fill"
              style={{
                transform: `scaleX(${Math.min(1, Math.max(0.04, financeMetrics.budgetPct / 100))})`,
                background: financeMetrics.budgetPct > 100 ? 'var(--bad)' : 'var(--text)',
              }}
            />
          </div>
          <div className="kpi-card__meta">
            <span>
              {financeMetrics.totalBudget > 0
                ? `${financeMetrics.budgetPct}% of monthly budget`
                : 'No budget set'}
            </span>
          </div>
        </div>

        <div
          className="card kpi-card tone-tile--lime"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('finance', 'wallets')}
        >
          <div className="kpi-card__label">Total balance</div>
          <div className="kpi-card__value">
            {formatMoneyCompact(financeMetrics.totalBalance, currency)}
          </div>
          <div className="kpi-card__meta">
            <span className="kpi-card__delta">
              +{formatMoneyCompact(financeMetrics.monthIncome, currency)} income
            </span>
            <span>· {state.finance.wallets.length} wallets</span>
          </div>
        </div>

        <div
          className="card kpi-card"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('finance', 'transactions')}
        >
          <div className="kpi-card__label">Monthly net</div>
          <div className="kpi-card__value">
            {financeMetrics.netMonth >= 0 ? '+' : ''}
            {formatMoneyCompact(financeMetrics.netMonth, currency)}
          </div>
          <div className="kpi-card__meta">
            <span className={`kpi-card__delta ${financeMetrics.netMonth < 0 ? 'is-neg' : ''}`}>
              {financeMetrics.monthIncome > 0
                ? `${financeMetrics.savingsRate}% saved`
                : financeMetrics.netMonth >= 0
                  ? 'Balanced'
                  : 'Net outflow'}
            </span>
            <span>· {financeMetrics.monthTxCount} tx this month</span>
          </div>
        </div>
      </div>

      {/* Main Personal OS Bento Grid */}
      <div ref={bentoRef} className="bento">
        {/* Top Left: Today's Tasks */}
        <div className="card bento-card col-6">
          <div className="card__head">
            <div>
              <h2 className="card__title">Today&apos;s tasks</h2>
              <p className="card__sub">
                {openTasksToday.length > 0
                  ? `${openTasksToday.length} remaining for today`
                  : 'All caught up for today'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="chip"
                style={{ height: 28 }}
                onClick={() => openModal({ kind: 'new-task' })}
              >
                <IconPlus size={13} /> Add
              </button>
              <button
                type="button"
                className="card__link"
                onClick={() => navigate('tasks', 'agenda')}
              >
                All <IconChevronRight size={14} />
              </button>
            </div>
          </div>

          {tasksToday.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              No tasks due today.
            </div>
          ) : (
            <div className="stack-list">
              {tasksToday.slice(0, 5).map((task) => {
                const due = relativeDueLabel(task.dueDate, today);
                const done = task.status === 'done';
                return (
                  <div key={task.id} className="act-row">
                    <button
                      type="button"
                      className={`check-btn ${done ? 'is-done' : ''}`}
                      onClick={(e) => toggleTaskDone(task.id, e.currentTarget)}
                      aria-label={`Complete ${task.title}`}
                    >
                      <IconCheck size={12} />
                    </button>
                    <div
                      className="act-row__body"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openDrawer({ kind: 'task', id: task.id })}
                    >
                      <div className={`act-row__title ${done ? 'is-done' : ''}`}>
                        {task.title}
                      </div>
                      <div className="act-row__meta">
                        <span>{TASK_CATEGORY_META[task.category].label}</span>
                        {task.dueTime && <span>· {task.dueTime}</span>}
                        {due.overdue && !done && (
                          <span style={{ color: 'var(--bad)', fontWeight: 700 }}>
                            · {due.text}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`pill ${TASK_PRIORITY_META[task.priority].pill}`}>
                      {TASK_PRIORITY_META[task.priority].short}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Right: Cashflow & Budgets */}
        <div className="card bento-card col-6">
          <div className="card__head">
            <div>
              <h2 className="card__title">Cashflow &amp; Budgets</h2>
              <p className="card__sub">
                In {formatMoney(financeMetrics.monthIncome, currency)} · Out{' '}
                {formatMoney(financeMetrics.monthExpense, currency)}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="chip"
                style={{ height: 28 }}
                onClick={() => openModal({ kind: 'new-tx', defaultType: 'expense' })}
              >
                <IconPlus size={13} /> Log
              </button>
              <button
                type="button"
                className="card__link"
                onClick={() => navigate('finance', 'overview')}
              >
                Details <IconChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="overview-fin-split">
            <div className="stack-list">
              {financeMetrics.recent.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 10px' }}>
                  No transactions yet.
                </div>
              ) : (
                financeMetrics.recent.map((tx) => {
                  const cat = financeMetrics.catMap.get(tx.categoryId);
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
                          <IconArrowDownLeft size={14} />
                        ) : (
                          <IconArrowUpRight size={14} />
                        )}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tx-mini-row__title">
                          {tx.note || cat?.name || 'Transaction'}
                        </div>
                        <div className="tx-mini-row__sub">
                          {tx.type === 'transfer' ? 'Transfer' : cat?.name} ·{' '}
                          {formatShortDate(tx.date)}
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
                        {formatMoneyCompact(tx.amount, currency)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="stack-list">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Top budgets
              </div>
              {financeMetrics.topBudgets.map((b) => (
                <div key={b.categoryId} className="budget-mini">
                  <div className="budget-mini__top">
                    <span>{b.category?.name || b.categoryId}</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          b.pct >= 100
                            ? 'var(--bad)'
                            : b.pct >= 80
                              ? 'var(--sand)'
                              : 'var(--text)',
                      }}
                    >
                      {b.pct}%
                    </span>
                  </div>
                  <div className="meter" style={{ margin: '6px 0 4px', height: 6 }}>
                    <div
                      className="meter__fill"
                      style={{
                        transform: `scaleX(${Math.min(1, b.pct / 100)})`,
                        background:
                          b.pct >= 100
                            ? 'var(--bad)'
                            : b.pct >= 80
                              ? 'var(--sand)'
                              : 'var(--accent)',
                      }}
                    />
                  </div>
                  <div className="budget-mini__sub">
                    {formatMoneyCompact(b.spent, currency)} /{' '}
                    {formatMoneyCompact(b.monthlyLimit, currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Left: Wallets & Accounts */}
        <div className="card bento-card col-7">
          <div className="card__head">
            <div>
              <h2 className="card__title">Wallets &amp; Balances</h2>
              <p className="card__sub">
                {state.finance.wallets.length} active accounts · Total{' '}
                {formatMoney(financeMetrics.totalBalance, currency)}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="chip"
                style={{ height: 28 }}
                onClick={() => openModal({ kind: 'new-wallet' })}
              >
                <IconPlus size={13} /> Wallet
              </button>
              <button
                type="button"
                className="card__link"
                onClick={() => navigate('finance', 'wallets')}
              >
                Manage <IconChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="overview-wallet-grid">
            {state.finance.wallets.map((wallet) => {
              const bal = walletBalances[wallet.id] ?? wallet.initialBalance;
              return (
                <button
                  key={wallet.id}
                  type="button"
                  className="module-quick-row"
                  onClick={() => navigate('finance', 'wallets')}
                >
                  <span className={`pop-item__tile tile--${wallet.tone}`}>
                    <IconWallet size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                      {wallet.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {wallet.note || WALLET_KIND_LABEL[wallet.kind]}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
                    {formatMoneyCompact(bal, currency)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Right: Extensible Module Hub */}
        <div className="card bento-card col-5">
          <div className="card__head">
            <div>
              <h2 className="card__title">Personal Modules</h2>
              <p className="card__sub">Pluggable architecture ready for module #3, #4...</p>
            </div>
            <button
              type="button"
              className="card__link"
              onClick={() => navigate('modules')}
            >
              Manage <IconChevronRight size={14} />
            </button>
          </div>

          <div className="stack-list">
            {APP_MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                className="module-quick-row"
                onClick={() => navigate(mod.pageId)}
              >
                <span className={`pop-item__tile tile--${mod.tone}`}>
                  <IconModuleGlyph moduleId={mod.id} size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                    {mod.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{mod.tagline}</div>
                </div>
                <span className="pill pill--lime">Active</span>
              </button>
            ))}

            <button
              type="button"
              className="module-quick-row module-quick-row--dashed"
              onClick={() => navigate('modules')}
            >
              <span
                className="pop-item__tile"
                style={{ background: 'var(--well-2)', color: 'var(--text)' }}
              >
                <IconPlus size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  Module #3+ (Extensible)
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {state.futureModules.length} ideas in personal roadmap
                </div>
              </div>
              <IconChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

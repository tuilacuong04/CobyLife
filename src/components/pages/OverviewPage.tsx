import React, { useMemo, useRef } from 'react';
import { APP_MODULES } from '../../modules/registry';
import { useApp } from '../../store/AppContext';
import {
  currentMonthKey,
  formatFullDateVi,
  formatMoney,
  formatMoneyCompact,
  formatShortDateVi,
  formatVolume,
  greetingVi,
  localIsoDate,
  relativeDueLabel,
  TASK_CATEGORY_META,
  TASK_PRIORITY_META,
} from '../../utils/format';
import { useScrollReveal, useStaggerEntrance } from '../../utils/motion';
import { MagneticButton } from '../Motion';
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCheck,
  IconChevronRight,
  IconDumbbell,
  IconFlame,
  IconModuleGlyph,
  IconPlus,
  IconTasks,
  IconWallet,
} from '../Icons';

export const OverviewPage: React.FC = () => {
  const {
    state,
    gym,
    walletBalances,
    navigate,
    openGymView,
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

  // Tasks KPIs
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

  // Finance KPIs
  const financeMetrics = useMemo(() => {
    let monthExpense = 0;
    let monthIncome = 0;
    const spentByCat: Record<string, number> = {};
    for (const tx of state.finance.transactions) {
      if (!tx.date.startsWith(thisMonth)) continue;
      if (tx.type === 'expense') {
        monthExpense += tx.amount;
        spentByCat[tx.categoryId] = (spentByCat[tx.categoryId] || 0) + tx.amount;
      } else if (tx.type === 'income') {
        monthIncome += tx.amount;
      }
    }
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
      totalBalance,
      totalBudget,
      budgetPct,
      recent,
      topBudgets,
      catMap,
    };
  }, [state.finance, walletBalances, thisMonth]);

  const gymWeekPct = Math.min(
    100,
    Math.round((gym.workoutsThisWeek / Math.max(gym.weekTarget, 1)) * 100)
  );

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">
            {greetingVi()}, {profile.name}
          </h1>
          <p className="phead__sub">
            {formatFullDateVi()} · {openTasksToday.length} task cần xử lý ·{' '}
            {gym.activeWorkout
              ? `Đang tập: ${gym.activeWorkout.name}`
              : gym.todayRoutine
                ? `Lịch Gym: ${gym.todayRoutine.name}`
                : 'Sẵn sàng cho ngày mới'}
          </p>
        </div>
        <div className="phead__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => openModal({ kind: 'new-tx', defaultType: 'expense' })}
          >
            <IconWallet size={15} />
            Ghi chi tiêu
          </button>
          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openGymView('#/home')}
          >
            <IconDumbbell size={15} />
            {gym.activeWorkout ? 'Tiếp tục buổi tập' : 'Vào tập Gym'}
          </MagneticButton>
        </div>
      </div>

      {/* 4 Unified Live KPI Cards */}
      <div ref={kpiRef} className="kpi-grid">
        <div
          className="card kpi-card tone-tile--lime"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => openGymView('#/home')}
        >
          <div className="kpi-card__label">Gym tuần này (openGym)</div>
          <div className="kpi-card__value">
            {gym.available ? `${gym.workoutsThisWeek}/${gym.weekTarget} buổi` : 'Sẵn sàng'}
          </div>
          <div className="meter">
            <div
              className="meter__fill"
              style={{ transform: `scaleX(${Math.max(0.06, gymWeekPct / 100)})` }}
            />
          </div>
          <div className="kpi-card__meta">
            {gym.available ? (
              <>
                <span className="kpi-card__delta">
                  <IconFlame size={13} style={{ verticalAlign: '-2px', marginRight: 3 }} />
                  {gym.streakWeeks} tuần liên tiếp
                </span>
                <span>· {formatVolume(gym.totalVolumeThisWeek, gym.unit)}</span>
              </>
            ) : (
              <span>Nhấn để khởi chạy openGym lần đầu</span>
            )}
          </div>
        </div>

        <div
          className="card kpi-card tone-tile--sky"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('tasks', 'agenda')}
        >
          <div className="kpi-card__label">Task hôm nay</div>
          <div className="kpi-card__value">
            {doneTasksToday}/{tasksToday.length}
          </div>
          <div className="kpi-card__meta">
            {overdueCount > 0 ? (
              <span className="kpi-card__delta is-neg">{overdueCount} quá hạn</span>
            ) : (
              <span className="kpi-card__delta">Đúng tiến độ</span>
            )}
            <span>· {state.tasks.filter((t) => t.status !== 'done').length} đang mở</span>
          </div>
        </div>

        <div
          className="card kpi-card tone-tile--coral"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('finance', 'overview')}
        >
          <div className="kpi-card__label">Chi tiêu tháng này</div>
          <div className="kpi-card__value">
            {formatMoneyCompact(financeMetrics.monthExpense, currency)}
          </div>
          <div className="meter">
            <div
              className="meter__fill"
              style={{
                transform: `scaleX(${Math.min(1, financeMetrics.budgetPct / 100)})`,
                background: financeMetrics.budgetPct > 100 ? 'var(--bad)' : 'var(--text)',
              }}
            />
          </div>
          <div className="kpi-card__meta">
            <span>
              {financeMetrics.totalBudget > 0
                ? `${financeMetrics.budgetPct}% ngân sách tháng`
                : 'Chưa đặt hạn mức'}
            </span>
          </div>
        </div>

        <div
          className="card kpi-card"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('finance', 'wallets')}
        >
          <div className="kpi-card__label">Tổng số dư các ví</div>
          <div className="kpi-card__value">
            {formatMoneyCompact(financeMetrics.totalBalance, currency)}
          </div>
          <div className="kpi-card__meta">
            <span className="kpi-card__delta">
              +{formatMoneyCompact(financeMetrics.monthIncome, currency)} thu tháng này
            </span>
            <span>· {state.finance.wallets.length} ví</span>
          </div>
        </div>
      </div>

      {/* Main Personal OS Bento Grid */}
      <div ref={bentoRef} className="bento">
        {/* Left: openGym Live Command Card */}
        <div className="card bento-card col-6">
          <div className="card__head">
            <div>
              <h2 className="card__title">Gym · openGym Tracker</h2>
              <p className="card__sub">
                Tích hợp đầy đủ 5.600+ bài tập, lịch tập, bản đồ cơ & tiến trình tăng tạ
              </p>
            </div>
            <button
              type="button"
              className="card__link"
              onClick={() => openGymView('#/home')}
            >
              Mở openGym <IconChevronRight size={14} />
            </button>
          </div>

          <div className="gym-summary-grid">
            <div className="gym-stat-box">
              <div className="gym-stat-box__label">Lịch tập tiếp theo</div>
              <div className="gym-stat-box__val">
                {gym.todayRoutine ? gym.todayRoutine.name : 'Push / Pull / Legs'}
              </div>
              <div className="gym-stat-box__sub">
                {gym.todayRoutine
                  ? `${gym.todayRoutine.exerciseCount} bài tập đã lên lịch`
                  : 'Mở openGym để tạo hoặc chọn lịch'}
              </div>
            </div>

            <div className="gym-stat-box">
              <div className="gym-stat-box__label">Cân nặng gần nhất</div>
              <div className="gym-stat-box__val">
                {gym.latestBodyweight
                  ? `${gym.latestBodyweight.weight} ${gym.unit}`
                  : 'Chưa ghi nhận'}
              </div>
              <div className="gym-stat-box__sub">
                {gym.latestBodyweight?.target
                  ? `Mục tiêu: ${gym.latestBodyweight.target} ${gym.unit}`
                  : gym.lastWorkout
                    ? `Buổi gần nhất: ${gym.lastWorkout.name} (${formatShortDateVi(gym.lastWorkout.date)})`
                    : 'Đồng bộ trực tiếp với openGym'}
              </div>
            </div>
          </div>

          <div className="gym-shortcuts">
            {[
              { label: 'Bắt đầu tập', path: '#/home' },
              { label: 'Lịch tập (Plan)', path: '#/plan' },
              { label: 'Bản đồ cơ bắp', path: '#/muscles' },
              { label: 'Thống kê & 1RM', path: '#/stats' },
              { label: 'Thư viện 5.6K bài', path: '#/library' },
              { label: 'Số đo cơ thể', path: '#/measurements' },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                className="chip"
                onClick={() => openGymView(item.path)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Today's Tasks */}
        <div className="card bento-card col-6">
          <div className="card__head">
            <div>
              <h2 className="card__title">Task hôm nay & quá hạn</h2>
              <p className="card__sub">
                {openTasksToday.length > 0
                  ? `Còn ${openTasksToday.length} việc cần hoàn thành`
                  : 'Bạn đã hoàn thành hết việc hôm nay'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="chip"
                style={{ height: 28 }}
                onClick={() => openModal({ kind: 'new-task' })}
              >
                <IconPlus size={13} /> Thêm
              </button>
              <button
                type="button"
                className="card__link"
                onClick={() => navigate('tasks', 'agenda')}
              >
                Tất cả <IconChevronRight size={14} />
              </button>
            </div>
          </div>

          {tasksToday.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              Không có task nào đến hạn hôm nay.
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
                      aria-label={`Hoàn thành ${task.title}`}
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
                      {task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'TB' : 'Thấp'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Left: Recent Expenses & Budgets */}
        <div className="card bento-card col-7">
          <div className="card__head">
            <div>
              <h2 className="card__title">Giao dịch & Ngân sách tháng</h2>
              <p className="card__sub">
                Thu {formatMoney(financeMetrics.monthIncome, currency)} · Chi{' '}
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
                <IconPlus size={13} /> Ghi chi
              </button>
              <button
                type="button"
                className="card__link"
                onClick={() => navigate('finance', 'overview')}
              >
                Chi tiết <IconChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="overview-fin-split">
            <div className="stack-list">
              {financeMetrics.recent.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 10px' }}>
                  Chưa có giao dịch nào.
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
                          {tx.note || cat?.name || 'Giao dịch'}
                        </div>
                        <div className="tx-mini-row__sub">
                          {tx.type === 'transfer' ? 'Chuyển ví' : cat?.name} ·{' '}
                          {formatShortDateVi(tx.date)}
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
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Hạn mức nổi bật
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
                    {formatMoneyCompact(b.spent, currency)} / {formatMoneyCompact(b.monthlyLimit, currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Right: Extensible Module Hub */}
        <div className="card bento-card col-5">
          <div className="card__head">
            <div>
              <h2 className="card__title">Hệ sinh thái cá nhân</h2>
              <p className="card__sub">Kiến trúc module dễ mở rộng thêm tính năng #4, #5...</p>
            </div>
            <button
              type="button"
              className="card__link"
              onClick={() => navigate('modules')}
            >
              Quản lý <IconChevronRight size={14} />
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
                <span className="pill pill--lime">Đang bật</span>
              </button>
            ))}

            <button
              type="button"
              className="module-quick-row module-quick-row--dashed"
              onClick={() => navigate('modules')}
            >
              <span className="pop-item__tile" style={{ background: 'var(--well-2)', color: 'var(--text)' }}>
                <IconPlus size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  Module #4+ (Mở rộng sau)
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {state.futureModules.length} ý tưởng đang chờ phát triển
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

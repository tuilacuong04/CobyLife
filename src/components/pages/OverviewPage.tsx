import React, { useLayoutEffect, useRef } from 'react';
import { useCrm } from '../../store/CrmContext';
import { DealStage } from '../../types';
import {
  dealWeightedValue,
  diffDays,
  formatCloseCountdown,
  formatKrCompact,
  formatShortDateLower,
  formatWeekdayShort,
  isCurrentMonth,
  OPEN_STAGES,
  STAGE_META,
  TODAY_ISO,
} from '../../utils/format';
import { animateCards, animateKpis, dur, gsap, isReducedMotion } from '../../utils/motion';
import { RepAvatar } from '../Avatar';
import { AnimatedNumber, AnimatedTitle, MagneticButton } from '../Motion';
import {
  IconActivityKind,
  IconCheck,
  IconChevronRight,
  IconPlus,
  IconReports,
  IconTarget,
} from '../Icons';

const FUNNEL_STAGES: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'won'];

export const OverviewPage: React.FC = () => {
  const { state, space, navigate, openDrawer, openModal, toggleActivityDone } = useCrm();
  const rootRef = useRef<HTMLDivElement>(null);

  const firstName = state.settings.profile.name.trim().split(/\s+/)[0] || 'there';
  const companyMap = new Map(space.companies.map((c) => [c.id, c.name]));

  const openDeals = space.deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const wonThisMonthDeals = space.deals.filter(
    (d) => d.stage === 'won' && isCurrentMonth(d.closeDate)
  );
  const allClosedDeals = space.deals.filter((d) => d.stage === 'won' || d.stage === 'lost');
  const wonDealsCount = allClosedDeals.filter((d) => d.stage === 'won').length;

  const wonThisMonth = wonThisMonthDeals.reduce((s, d) => s + d.value, 0);
  const openPipeline = openDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = openDeals.reduce((s, d) => s + dealWeightedValue(d), 0);
  const winRate =
    allClosedDeals.length > 0 ? Math.round((wonDealsCount / allClosedDeals.length) * 100) : 0;

  const targetPct =
    space.monthlyTarget > 0 ? Math.round((wonThisMonth / space.monthlyTarget) * 100) : 0;
  const lastMonthWon = space.history[space.history.length - 1]?.won || 1;
  const momDelta = Math.round(((wonThisMonth - lastMonthWon) / lastMonthWon) * 100);

  const overdueCount = space.activities.filter((a) => !a.done && a.date < TODAY_ISO).length;
  const todayOpen = space.activities
    .filter((a) => !a.done && a.date === TODAY_ISO)
    .sort((a, b) => a.time.localeCompare(b.time));

  const revenueBars = [
    ...space.history.map((h) => ({ label: h.label, value: h.won, isCurrent: false })),
    { label: 'Nov', value: wonThisMonth, isCurrent: true },
  ];
  const maxBar = Math.max(space.monthlyTarget * 1.15, ...revenueBars.map((b) => b.value), 1);
  const targetLineBottomPct = Math.min(96, (space.monthlyTarget / maxBar) * 100);

  const funnelRows = FUNNEL_STAGES.map((st) => {
    const deals = space.deals.filter((d) =>
      st === 'won' ? d.stage === 'won' && isCurrentMonth(d.closeDate) : d.stage === st
    );
    const total = deals.reduce((s, d) => s + d.value, 0);
    return { stage: st, count: deals.length, total };
  });
  const maxFunnel = Math.max(...funnelRows.map((r) => r.total), 1);

  const nextBest =
    [...openDeals]
      .filter((d) => d.stage === 'negotiation')
      .sort((a, b) => b.value - a.value)[0] ||
    [...openDeals].sort((a, b) => b.value - a.value)[0];

  const leaderboard = space.reps
    .map((rep) => {
      const won = wonThisMonthDeals
        .filter((d) => d.ownerId === rep.id)
        .reduce((s, d) => s + d.value, 0);
      const pct = rep.quota > 0 ? Math.round((won / rep.quota) * 100) : 0;
      return { rep, won, pct };
    })
    .sort((a, b) => b.won - a.won);

  const closingSoon = [...openDeals]
    .filter((d) => diffDays(d.closeDate, TODAY_ISO) <= 45)
    .sort((a, b) => a.closeDate.localeCompare(b.closeDate))
    .slice(0, 6);

  const funnelColor = (st: DealStage) => {
    if (st === 'won') return 'var(--accent)';
    if (st === 'proposal' || st === 'negotiation') return 'var(--sky)';
    if (st === 'qualified') return 'var(--sand)';
    return 'var(--faint)';
  };

  // Exact Sylva GSAP entrance choreography
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      animateKpis(root.querySelectorAll('.kpi-card'), 0.15);
      animateCards(root.querySelectorAll('.bento > .card'), { delay: 0.3, stagger: 0.05 });

      const revFills = root.querySelectorAll('.rev__fill');
      if (revFills.length) {
        gsap.from(revFills, {
          scaleY: 0,
          duration: dur(0.9),
          ease: 'expo.out',
          delay: dur(0.55),
          stagger: dur(0.035),
        });
      }

      const funnelFills = root.querySelectorAll('.funnel__fill');
      if (funnelFills.length) {
        gsap.from(funnelFills, {
          scaleX: 0,
          duration: dur(0.9),
          ease: 'expo.out',
          delay: dur(0.6),
          stagger: dur(0.06),
        });
      }
    }, root);
    return () => ctx.revert();
  }, [space.id]);

  return (
    <div ref={rootRef}>
      <div className="phead">
        <div>
          <AnimatedTitle text={`Good morning, ${firstName}`} mark="lime" animKey={`${space.id}-ov`} />
          <p className="phead__sub">
            {space.name} · {formatWeekdayShort(TODAY_ISO)} · {overdueCount} overdue,{' '}
            {todayOpen.length} activities today
          </p>
        </div>

        <div className="phead__actions">
          <button type="button" className="btn btn--glass" onClick={() => navigate('reports')}>
            <IconReports size={16} />
            <span>Reports</span>
          </button>
          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openModal({ kind: 'new-deal' })}
          >
            <IconPlus size={16} />
            <span>New deal</span>
          </MagneticButton>
        </div>
      </div>

      {/* 4 Tinted KPI Cards */}
      <section className="kpi-grid" aria-label="Key metrics">
        <div className="card kpi-card tone-tile--sky">
          <div className="kpi-card__label">Won this month</div>
          <div className="kpi-card__value">
            <AnimatedNumber value={wonThisMonth} format={formatKrCompact} />
          </div>
          <div
            className="meter"
            role="meter"
            aria-valuenow={targetPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="meter__fill"
              style={{ transform: `scaleX(${Math.min(1, targetPct / 100)})` }}
            />
          </div>
          <div className="kpi-card__meta">
            <span>
              {targetPct}% of {formatKrCompact(space.monthlyTarget)} target ·
            </span>
            <span className={`kpi-card__delta ${momDelta < 0 ? 'is-neg' : ''}`}>
              {momDelta >= 0 ? `↗ +${momDelta}%` : `↘ ${momDelta}%`} vs last month
            </span>
          </div>
        </div>

        <div className="card kpi-card tone-tile--lime">
          <div className="kpi-card__label">Open pipeline</div>
          <div className="kpi-card__value">
            <AnimatedNumber value={openPipeline} format={formatKrCompact} />
          </div>
          <div className="kpi-card__meta">{openDeals.length} open deals</div>
        </div>

        <div className="card kpi-card tone-tile--coral">
          <div className="kpi-card__label">Weighted forecast</div>
          <div className="kpi-card__value">
            <AnimatedNumber value={weightedForecast} format={formatKrCompact} />
          </div>
          <div className="kpi-card__meta">by stage probability</div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-card__label">Win rate</div>
          <div className="kpi-card__value">
            <AnimatedNumber value={winRate} format={(n) => `${Math.round(n)}%`} />
          </div>
          <div className="kpi-card__meta">
            {wonDealsCount} of {allClosedDeals.length} closed deals won
          </div>
        </div>
      </section>

      {/* Main Bento Grid */}
      <div className="bento">
        <section className="card col-8">
          <div className="card__head">
            <div>
              <h2 className="card__title">Revenue won</h2>
              <p className="card__sub">Last 12 months against the monthly target</p>
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-swatch" />
                Won
              </span>
              <span className="legend-item">
                <span className="legend-dash" />
                Target {formatKrCompact(space.monthlyTarget)}
              </span>
            </div>
          </div>

          <div className="bar-chart">
            <div className="bar-chart__plot">
              <div
                className="bar-chart__target"
                style={{ bottom: `calc(${targetLineBottomPct}% + 22px)` }}
                title={`Monthly target: ${formatKrCompact(space.monthlyTarget)}`}
              />
              {revenueBars.map((bar) => {
                const ratio = Math.max(0.04, bar.value / maxBar);
                return (
                  <div
                    key={bar.label}
                    className="bar-col"
                    title={`${bar.label}: ${formatKrCompact(bar.value)}`}
                  >
                    <div className="bar-col__track">
                      <div
                        className={`bar-col__fill rev__fill ${bar.isCurrent ? 'is-accent' : ''}`}
                        style={{ transform: `scaleY(${ratio.toFixed(4)})` }}
                      />
                    </div>
                    <span className={`bar-col__label ${bar.isCurrent ? 'is-accent' : ''}`}>
                      {bar.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card col-4">
          <div className="card__head">
            <div>
              <h2 className="card__title">Pipeline by stage</h2>
              <p className="card__sub">Value in each stage</p>
            </div>
            <button
              type="button"
              className="card__link"
              onClick={() => navigate('pipeline', 'board')}
            >
              Board <IconChevronRight size={14} />
            </button>
          </div>

          <div className="funnel-list">
            {funnelRows.map((row) => {
              const ratio = row.total > 0 ? Math.max(0.08, row.total / maxFunnel) : 0;
              return (
                <button
                  key={row.stage}
                  type="button"
                  className="funnel-row"
                  onClick={() => navigate('pipeline', 'list', { stage: row.stage })}
                >
                  <div>
                    <div className="funnel-row__name">{STAGE_META[row.stage].label}</div>
                    <div className="funnel-row__count">
                      {row.count} {row.count === 1 ? 'deal' : 'deals'}
                    </div>
                  </div>
                  <div className="funnel-row__track">
                    <div
                      className="funnel-row__fill funnel__fill"
                      style={{
                        transform: `scaleX(${ratio.toFixed(4)})`,
                        background: funnelColor(row.stage),
                      }}
                    />
                  </div>
                  <div className="funnel-row__val">{formatKrCompact(row.total)}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="card col-3 tone-tile--lime"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div className="nbm-eyebrow">
              <IconTarget size={14} />
              Next best move
            </div>
            {nextBest ? (
              <>
                <h2 className="nbm-title">{nextBest.title}</h2>
                <div className="nbm-meta">
                  {companyMap.get(nextBest.companyId)} · in{' '}
                  {STAGE_META[nextBest.stage].label.toLowerCase()} · closes{' '}
                  {formatShortDateLower(nextBest.closeDate)}
                </div>
                <div className="nbm-val">
                  <AnimatedNumber value={nextBest.value} format={formatKrCompact} />
                </div>
              </>
            ) : (
              <p className="card__sub" style={{ marginTop: 12 }}>
                All open deals are closed!
              </p>
            )}
          </div>
          {nextBest && (
            <button
              type="button"
              className="card__link"
              style={{ color: 'var(--text)' }}
              onClick={() => openDrawer({ kind: 'deal', id: nextBest.id })}
            >
              Open deal <IconChevronRight size={14} />
            </button>
          )}
        </section>

        <section className="card col-4">
          <div className="card__head">
            <div>
              <h2 className="card__title">Today</h2>
              <p className="card__sub">{todayOpen.length} to do</p>
            </div>
            <button
              type="button"
              className="card__link"
              onClick={() => navigate('activities', 'agenda')}
            >
              Agenda <IconChevronRight size={14} />
            </button>
          </div>

          {todayOpen.length === 0 ? (
            <div style={{ padding: '18px 0', color: 'var(--faint)', fontSize: 13.5 }}>
              All of today&apos;s activities are done.
            </div>
          ) : (
            <div className="act-list">
              {todayOpen.map((act) => {
                const deal = space.deals.find((d) => d.id === act.dealId);
                const comp = deal ? companyMap.get(deal.companyId) : undefined;
                return (
                  <div key={act.id} className="act-row">
                    <button
                      type="button"
                      className="check-btn"
                      onClick={() => toggleActivityDone(act.id)}
                      aria-label={`Complete ${act.title}`}
                    >
                      <IconCheck size={13} />
                    </button>
                    <div className="act-row__body">
                      <div
                        className="act-row__title"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span style={{ color: 'var(--muted)', display: 'inline-grid' }}>
                          <IconActivityKind type={act.type} size={13} />
                        </span>
                        <span>{act.title}</span>
                      </div>
                      <div className="act-row__sub">
                        {act.time}
                        {comp ? ` · ${comp}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card col-5">
          <div className="card__head">
            <div>
              <h2 className="card__title">Leaderboard</h2>
              <p className="card__sub">Won this month</p>
            </div>
            <button type="button" className="card__link" onClick={() => navigate('team')}>
              Team <IconChevronRight size={14} />
            </button>
          </div>

          <div className="leader-list">
            {leaderboard.map((row, idx) => (
              <button
                key={row.rep.id}
                type="button"
                className="leader-row"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => navigate('pipeline', 'board', { owner: row.rep.id })}
              >
                <span className={`leader-rank ${idx === 0 ? 'is-top' : ''}`}>{idx + 1}</span>
                <RepAvatar src={row.rep.avatar} name={row.rep.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{row.rep.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>{row.pct}% of quota</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{formatKrCompact(row.won)}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="card col-12">
          <div className="card__head">
            <div>
              <h2 className="card__title">Closing soon</h2>
              <p className="card__sub">Open deals expected to close in the coming weeks</p>
            </div>
            <button
              type="button"
              className="card__link"
              onClick={() => navigate('pipeline', 'forecast')}
            >
              Forecast <IconChevronRight size={14} />
            </button>
          </div>

          {closingSoon.length === 0 ? (
            <div style={{ color: 'var(--faint)', fontSize: 13.5 }}>No upcoming closes.</div>
          ) : (
            <div className="closing-grid">
              {closingSoon.map((deal) => (
                <button
                  key={deal.id}
                  type="button"
                  className="closing-item"
                  onClick={() => openDrawer({ kind: 'deal', id: deal.id })}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{deal.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {companyMap.get(deal.companyId)} · {STAGE_META[deal.stage].label}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {formatKrCompact(deal.value)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--accent-ink)', fontWeight: 600 }}>
                      {formatCloseCountdown(deal.closeDate)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

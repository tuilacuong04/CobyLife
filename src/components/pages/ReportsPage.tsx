import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useCrm } from '../../store/CrmContext';
import { DealSource, DealStage } from '../../types';
import {
  formatKrCompact,
  isCurrentMonth,
  STAGE_META,
  STAGE_ORDER,
  toCsv,
  triggerDownload,
} from '../../utils/format';
import { animateCards, dur, gsap, isReducedMotion } from '../../utils/motion';
import { AnimatedNumber, AnimatedTitle, SlidingSeg } from '../Motion';
import { IconDownload } from '../Icons';

type Measure = 'revenue' | 'deals' | 'winrate' | 'avg';
type GroupBy = 'month' | 'owner' | 'source' | 'stage';

const MEASURES: { id: Measure; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'deals', label: 'Deals won' },
  { id: 'winrate', label: 'Win rate' },
  { id: 'avg', label: 'Average deal' },
];

const GROUPS: { id: GroupBy; label: string; colLabel: string }[] = [
  { id: 'month', label: 'By month', colLabel: 'month' },
  { id: 'owner', label: 'By owner', colLabel: 'owner' },
  { id: 'source', label: 'By source', colLabel: 'source' },
  { id: 'stage', label: 'By stage', colLabel: 'stage' },
];

const SOURCES: DealSource[] = ['Website', 'Referral', 'Trade show', 'Cold call', 'Partner'];

export const ReportsPage: React.FC = () => {
  const { space, route, navigate, pushToast } = useCrm();
  const rootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const prevScaleRef = useRef<Map<string, number>>(new Map());

  const measure: Measure =
    route.query.m === 'deals' || route.query.m === 'winrate' || route.query.m === 'avg'
      ? route.query.m
      : 'revenue';
  const group: GroupBy =
    route.query.g === 'owner' || route.query.g === 'source' || route.query.g === 'stage'
      ? route.query.g
      : 'month';

  const setReportQuery = (nextM: Measure, nextG: GroupBy) => {
    navigate('reports', '', { m: nextM, g: nextG });
  };

  const formatMetric = (val: number): string => {
    if (measure === 'revenue' || measure === 'avg') return formatKrCompact(val);
    if (measure === 'winrate') return `${Math.round(val)}%`;
    return String(Math.round(val));
  };

  const rows = useMemo(() => {
    const wonNovDeals = space.deals.filter((d) => d.stage === 'won' && isCurrentMonth(d.closeDate));
    const closedNovDeals = space.deals.filter(
      (d) => (d.stage === 'won' || d.stage === 'lost') && isCurrentMonth(d.closeDate)
    );

    if (group === 'month') {
      const novWon = wonNovDeals.reduce((s, d) => s + d.value, 0);
      const novCount = wonNovDeals.length;
      const novClosed = Math.max(novCount, closedNovDeals.length);
      const pts = [
        ...space.history,
        { key: '2026-11', label: 'Nov', won: novWon, dealsCount: novCount, closedCount: novClosed },
      ];
      return pts.map((p) => {
        let value = p.won;
        if (measure === 'deals') value = p.dealsCount;
        else if (measure === 'winrate')
          value = p.closedCount > 0 ? Math.round((p.dealsCount / p.closedCount) * 100) : 0;
        else if (measure === 'avg')
          value = p.dealsCount > 0 ? Math.round(p.won / p.dealsCount) : 0;
        return { label: p.label, value };
      });
    }

    if (group === 'owner') {
      return space.reps.map((rep) => {
        const repDeals = space.deals.filter((d) => d.ownerId === rep.id);
        const won = repDeals.filter((d) => d.stage === 'won');
        const closed = repDeals.filter((d) => d.stage === 'won' || d.stage === 'lost');
        const rev = won.reduce((s, d) => s + d.value, 0);
        let value = rev;
        if (measure === 'deals') value = won.length;
        else if (measure === 'winrate')
          value = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0;
        else if (measure === 'avg') value = won.length > 0 ? Math.round(rev / won.length) : 0;
        return { label: rep.name, value };
      });
    }

    if (group === 'source') {
      return SOURCES.map((src) => {
        const srcDeals = space.deals.filter((d) => d.source === src);
        const won = srcDeals.filter((d) => d.stage === 'won');
        const closed = srcDeals.filter((d) => d.stage === 'won' || d.stage === 'lost');
        const rev = srcDeals.reduce((s, d) => s + d.value, 0);
        let value = rev;
        if (measure === 'deals') value = won.length;
        else if (measure === 'winrate')
          value = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0;
        else if (measure === 'avg')
          value = srcDeals.length > 0 ? Math.round(rev / srcDeals.length) : 0;
        return { label: src, value };
      });
    }

    return STAGE_ORDER.map((st: DealStage) => {
      const stDeals = space.deals.filter((d) => d.stage === st);
      const rev = stDeals.reduce((s, d) => s + d.value, 0);
      let value = rev;
      if (measure === 'deals') value = stDeals.length;
      else if (measure === 'winrate') value = Math.round(STAGE_META[st].prob * 100);
      else if (measure === 'avg')
        value = stDeals.length > 0 ? Math.round(rev / stDeals.length) : 0;
      return { label: STAGE_META[st].label, value };
    });
  }, [space, measure, group]);

  const totalSum = rows.reduce((s, r) => s + r.value, 0);
  const headlineTotal =
    measure === 'winrate' || measure === 'avg'
      ? rows.length > 0
        ? Math.round(totalSum / rows.length)
        : 0
      : totalSum;
  const highest = rows.reduce(
    (best, r) => (r.value > best.value ? r : best),
    rows[0] || { label: '—', value: 0 }
  );
  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  const measureMeta = MEASURES.find((m) => m.id === measure)!;
  const groupMeta = GROUPS.find((g) => g.id === group)!;

  // Card entrance on mount / space change
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      animateCards(el.querySelectorAll('.card'));
    }, el);
    return () => ctx.revert();
  }, [space.id]);

  // Exact Sylva .rbar__fill tween from previous height -> next height (0.8s expo.out)
  useLayoutEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const bars = el.querySelectorAll<HTMLElement>('.rbar__fill');
    const nextMap = new Map<string, number>();

    bars.forEach((bar) => {
      const key = bar.dataset.key || '';
      const target = Number(bar.dataset.val || '0');
      const prev = prevScaleRef.current.get(key) ?? 0;
      nextMap.set(key, target);

      if (isReducedMotion()) {
        gsap.set(bar, { scaleY: target });
      } else {
        gsap.fromTo(
          bar,
          { scaleY: prev },
          { scaleY: target, duration: dur(0.8), ease: 'expo.out', overwrite: true }
        );
      }
    });

    prevScaleRef.current = nextMap;
  }, [rows, maxVal, space.id]);

  const handleExportCsv = () => {
    const csv = toCsv(
      [groupMeta.colLabel, measureMeta.label, 'Share (%)'],
      rows.map((r) => [
        r.label,
        r.value,
        totalSum > 0 ? Math.round((r.value / totalSum) * 100) : 0,
      ])
    );
    triggerDownload(
      `sylva-${space.id}-${measure}-by-${group}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    pushToast('Exported CSV report');
  };

  return (
    <div ref={rootRef}>
      <div className="phead">
        <div>
          <AnimatedTitle text="Reports" mark="amber" animKey={`${space.id}-rp`} />
          <p className="phead__sub">
            Pick a measure and a grouping. The address keeps your choice, so you can share it.
          </p>
        </div>

        <div className="phead__actions">
          <button type="button" className="btn btn--glass" onClick={handleExportCsv}>
            <IconDownload size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 'var(--gut)' }}>
        <div className="card__head" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2 className="card__title">
              {measureMeta.label} {groupMeta.label.toLowerCase()}
            </h2>
            <p className="card__sub">{group === 'month' ? 'Last 12 months' : space.name}</p>
          </div>

          <div className="report-controls">
            <SlidingSeg
              ariaLabel="Measure"
              activeId={measure}
              onChange={(m) => setReportQuery(m, group)}
              items={MEASURES}
            />

            <SlidingSeg
              ariaLabel="Group by"
              activeId={group}
              onChange={(g) => setReportQuery(measure, g)}
              items={GROUPS.map((g) => ({ id: g.id, label: g.label }))}
            />
          </div>
        </div>

        <div className="report-summary">
          <div>
            <div className="fact__label">
              {measure === 'winrate' || measure === 'avg' ? 'Average' : 'Total'}
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>
              <AnimatedNumber value={headlineTotal} format={formatMetric} />
            </div>
          </div>
          <div>
            <div className="fact__label">Highest</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{highest.label}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatMetric(highest.value)}</div>
          </div>
        </div>

        <div ref={chartRef} className="bar-chart" style={{ height: 260 }}>
          <div
            className="bar-chart__plot"
            style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
          >
            {rows.map((r) => {
              const isHigh = r.label === highest.label && r.value > 0;
              const ratio = Math.max(0.04, r.value / maxVal);
              return (
                <div key={r.label} className="bar-col">
                  <span className={`bar-col__top ${isHigh ? 'is-accent' : ''}`}>
                    {formatMetric(r.value)}
                  </span>
                  <div className="bar-col__track">
                    <div
                      data-key={`${group}-${r.label}`}
                      data-val={ratio.toFixed(4)}
                      className={`bar-col__fill rbar__fill ${isHigh ? 'is-accent' : ''}`}
                    />
                  </div>
                  <span className={`bar-col__label ${isHigh ? 'is-accent' : ''}`}>{r.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card table-card">
        <div style={{ padding: '18px 20px 8px' }}>
          <h2 className="card__title">The numbers</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{groupMeta.colLabel}</th>
              <th className="is-right">{measureMeta.label}</th>
              <th className="is-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const share = totalSum > 0 ? Math.round((r.value / totalSum) * 100) : 0;
              return (
                <tr key={r.label} style={{ cursor: 'default' }}>
                  <td data-label={groupMeta.colLabel} style={{ fontWeight: 600 }}>
                    {r.label}
                  </td>
                  <td
                    data-label={measureMeta.label}
                    className="is-right"
                    style={{ fontWeight: 700 }}
                  >
                    {formatMetric(r.value)}
                  </td>
                  <td data-label="Share" className="is-right" style={{ color: 'var(--muted)' }}>
                    {share}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
};

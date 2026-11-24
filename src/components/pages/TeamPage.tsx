import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCrm } from '../../store/CrmContext';
import {
  diffDays,
  formatKrCompact,
  isCurrentMonth,
  OPEN_STAGES,
  TODAY_ISO,
} from '../../utils/format';
import { animateCards, gsap, isReducedMotion } from '../../utils/motion';
import { RepAvatar } from '../Avatar';
import { AnimatedNumber, AnimatedTitle, QuotaRing } from '../Motion';
import { IconChevronRight, IconTarget, IconTrophy } from '../Icons';

export const TeamPage: React.FC = () => {
  const { space, navigate, updateMonthlyTarget } = useCrm();
  const [targetInput, setTargetInput] = useState(String(space.monthlyTarget));
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTargetInput(String(space.monthlyTarget));
  }, [space.id, space.monthlyTarget]);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      animateCards(el.querySelectorAll('.card'), { stagger: 0.05 });
    }, el);
    return () => ctx.revert();
  }, [space.id]);

  const wonThisMonthDeals = space.deals.filter(
    (d) => d.stage === 'won' && isCurrentMonth(d.closeDate)
  );
  const wonTotal = wonThisMonthDeals.reduce((s, d) => s + d.value, 0);
  const reachedPct =
    space.monthlyTarget > 0 ? Math.round((wonTotal / space.monthlyTarget) * 100) : 0;

  const repCards = space.reps
    .map((rep) => {
      const won = wonThisMonthDeals
        .filter((d) => d.ownerId === rep.id)
        .reduce((s, d) => s + d.value, 0);
      const openDeals = space.deals.filter(
        (d) => d.ownerId === rep.id && OPEN_STAGES.includes(d.stage)
      );
      const openVal = openDeals.reduce((s, d) => s + d.value, 0);
      const recentActs = space.activities.filter(
        (a) => a.ownerId === rep.id && Math.abs(diffDays(a.date, TODAY_ISO)) <= 3
      ).length;
      const pct = rep.quota > 0 ? Math.round((won / rep.quota) * 100) : 0;
      return { rep, won, openVal, openCount: openDeals.length, recentActs, pct };
    })
    .sort((a, b) => b.won - a.won);

  const handleTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(targetInput);
    if (!Number.isNaN(num) && num > 0) {
      updateMonthlyTarget(num);
    }
  };

  return (
    <div>
      <div className="phead">
        <div>
          <AnimatedTitle text="Team" mark="sky" animKey={`${space.id}-tm`} />
          <p className="phead__sub">
            {space.reps.length} people · {formatKrCompact(wonTotal)} won of{' '}
            {formatKrCompact(space.monthlyTarget)} this month
          </p>
        </div>
      </div>

      <div ref={gridRef} className="team-grid">
        <div
          className="card tone-tile--lime"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div className="nbm-eyebrow">
              <IconTarget size={14} />
              Team target
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '10px 0 8px' }}>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>
                <AnimatedNumber value={reachedPct} format={(n) => `${Math.round(n)}%`} />
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>reached</span>
            </div>
            <div className="meter">
              <div
                className="meter__fill"
                style={{ transform: `scaleX(${Math.min(1, reachedPct / 100)})` }}
              />
            </div>
          </div>

          <form onSubmit={handleTargetSubmit} style={{ marginTop: 14 }}>
            <label className="field__label" htmlFor="team-target-input">
              Monthly target (kr)
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                id="team-target-input"
                className="input"
                type="number"
                min="10000"
                step="10000"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
              />
              <button type="submit" className="btn btn--primary" style={{ padding: '0 16px' }}>
                Save
              </button>
            </div>
          </form>
        </div>

        {repCards.map((item, idx) => (
          <div key={item.rep.id} className="card">
            <div className="rep-card__head">
              <span className={`rank-badge ${idx === 0 ? 'rank-badge--1' : ''}`}>
                {idx === 0 ? <IconTrophy size={13} /> : idx + 1}
              </span>
              <RepAvatar src={item.rep.avatar} name={item.rep.name} size={42} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.rep.name}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)' }}>{item.rep.role}</div>
              </div>
            </div>

            <div className="rep-card__body">
              <QuotaRing pct={item.pct} index={idx} />

              <div className="rep-stats">
                <div>
                  <div className="rep-stat__label">Won this month</div>
                  <div className="rep-stat__val">{formatKrCompact(item.won)}</div>
                </div>
                <div>
                  <div className="rep-stat__label">Quota</div>
                  <div className="rep-stat__val">{formatKrCompact(item.rep.quota)}</div>
                </div>
                <div>
                  <div className="rep-stat__label">Open pipeline</div>
                  <div className="rep-stat__val">
                    {formatKrCompact(item.openVal)}{' '}
                    <span style={{ fontWeight: 500, fontSize: 11.5, color: 'var(--faint)' }}>
                      · {item.openCount} deals
                    </span>
                  </div>
                </div>
                <div>
                  <div className="rep-stat__label">Activities ±3 days</div>
                  <div className="rep-stat__val">{item.recentActs}</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="card__link"
              style={{ color: 'var(--text)' }}
              onClick={() => navigate('pipeline', 'board', { owner: item.rep.id })}
            >
              Their deals <IconChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

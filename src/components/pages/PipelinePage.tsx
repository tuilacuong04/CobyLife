import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCrm } from '../../store/CrmContext';
import { Deal, DealStage } from '../../types';
import {
  dealWeightedValue,
  formatKrCompact,
  formatShortDate,
  isCurrentMonth,
  OPEN_STAGES,
  STAGE_META,
  STAGE_ORDER,
} from '../../utils/format';
import {
  animateCards,
  animateFlashPop,
  animateRows,
  dur,
  Flip,
  gsap,
  isReducedMotion,
} from '../../utils/motion';
import { RepAvatar } from '../Avatar';
import {
  AnimatedNumber,
  AnimatedTitle,
  MagneticButton,
  SlidingSeg,
  SlidingTabs,
  SwapView,
} from '../Motion';
import { IconCalendar, IconPlus, IconSearch } from '../Icons';

type SortKey = 'title' | 'company' | 'owner' | 'stage' | 'value' | 'closeDate';
type ForecastMode = 'commit' | 'likely' | 'best';
type PipelineTab = 'board' | 'list' | 'forecast';

const TAB_ORDER: Record<PipelineTab, number> = { board: 0, list: 1, forecast: 2 };

const FORECAST_MONTHS = [
  { key: '2026-11', label: 'Nov' },
  { key: '2026-12', label: 'Dec' },
  { key: '2027-01', label: 'Jan' },
  { key: '2027-02', label: 'Feb' },
];

interface ActiveDrag {
  deal: Deal;
  width: number;
  initX: number;
  initY: number;
}

export const PipelinePage: React.FC = () => {
  const { space, route, navigate, openDrawer, openModal, moveDealStage } = useCrm();
  const activeTab: PipelineTab =
    route.sub === 'list' || route.sub === 'forecast' ? route.sub : 'board';

  const [tabDir, setTabDir] = useState(1);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>(route.query.owner || 'all');
  const [stageFilter, setStageFilter] = useState<string>(route.query.stage || 'all');
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [overStage, setOverStage] = useState<DealStage | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [forecastMode, setForecastMode] = useState<ForecastMode>('likely');

  const boardRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sumRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const ghostRef = useRef<HTMLDivElement>(null);

  // Pending GSAP Flip state for deal stage moves
  const pendingFlipRef = useRef<{
    state: Flip.FlipState;
    movedId: string;
    stages: DealStage[];
  } | null>(null);

  useEffect(() => {
    if (route.query.owner) setOwnerFilter(route.query.owner);
    if (route.query.stage) setStageFilter(route.query.stage);
  }, [route.query.owner, route.query.stage]);

  // Entrance animations per tab
  useLayoutEffect(() => {
    const el = tabContentRef.current;
    if (!el || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      if (activeTab === 'board') {
        animateCards(el.querySelectorAll('.kcol'), { stagger: 0.045, y: 16 });
        animateRows(el.querySelectorAll('.dcard'), { stagger: 0.025, delay: 0.25 });
      } else if (activeTab === 'list') {
        animateCards(el.querySelectorAll('.card'));
        animateRows(el.querySelectorAll('tbody tr'), { stagger: 0.02, delay: 0.2 });
      } else {
        animateCards(el.querySelectorAll('.card'));
        const layers = el.querySelectorAll('.fc__layer');
        if (layers.length) {
          gsap.from(layers, {
            scaleY: 0,
            duration: dur(0.9),
            ease: 'expo.out',
            delay: dur(0.35),
            stagger: dur(0.05),
          });
        }
      }
    }, el);
    return () => ctx.revert();
  }, [activeTab, space.id]);

  // Run GSAP Flip + Elastic squash-and-stretch + column sum flash after stage move!
  useLayoutEffect(() => {
    const pending = pendingFlipRef.current;
    if (!pending || !boardRef.current) return;
    pendingFlipRef.current = null;

    const cards = boardRef.current.querySelectorAll('.dcard');
    if (!isReducedMotion()) {
      Flip.from(pending.state, {
        duration: dur(0.5),
        ease: 'power3.inOut',
        targets: cards,
        absolute: false,
        prune: true,
      });

      const dropped = boardRef.current.querySelector<HTMLElement>(
        `[data-deal-id="${pending.movedId}"]`
      );
      if (dropped) {
        gsap.fromTo(
          dropped,
          { scaleY: 0.9, scaleX: 1.04 },
          {
            scaleY: 1,
            scaleX: 1,
            duration: dur(0.6),
            ease: 'elastic.out(1, 0.45)',
            clearProps: 'transform',
          }
        );
      }
    }

    pending.stages.forEach((st) => animateFlashPop(sumRefs.current[st]));
  }, [space.deals]);

  const moveWithFlip = (deal: Deal, nextStage: DealStage) => {
    if (deal.stage === nextStage) return;
    if (boardRef.current && !isReducedMotion()) {
      const cards = boardRef.current.querySelectorAll('.dcard');
      pendingFlipRef.current = {
        state: Flip.getState(cards),
        movedId: deal.id,
        stages: [deal.stage, nextStage],
      };
    }
    moveDealStage(deal.id, nextStage);
  };

  // Exact Sylva pointer drag: mouse > 6px, touch 320ms long-press + vibrate, -2deg ghost tilt
  const startCardDrag = (e: React.PointerEvent<HTMLButtonElement>, deal: Deal) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isTouch = e.pointerType !== 'mouse';
    const session = {
      deal,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      active: false,
      lastOver: null as DealStage | null,
      curX: e.clientX,
      curY: e.clientY,
      raf: 0,
      holdTimer: 0 as number,
    };

    const findColAt = (clientX: number, clientY: number): DealStage | null => {
      for (const st of STAGE_ORDER) {
        const el = colRefs.current[st];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          return st;
        }
      }
      return null;
    };

    const activate = () => {
      if (session.active) return;
      session.active = true;
      if (isTouch) navigator.vibrate?.(8);
      setActiveDrag({
        deal: session.deal,
        width: session.width,
        initX: session.curX - session.offsetX,
        initY: session.curY - session.offsetY,
      });
    };

    if (isTouch) {
      session.holdTimer = window.setTimeout(activate, 320);
    }

    const paintGhost = () => {
      session.raf = 0;
      const g = ghostRef.current;
      if (g) {
        const gx = session.curX - session.offsetX;
        const gy = session.curY - session.offsetY;
        g.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0) rotate(-2deg)`;
      }
    };

    const onMove = (ev: PointerEvent) => {
      session.curX = ev.clientX;
      session.curY = ev.clientY;
      const dist = Math.hypot(ev.clientX - session.startX, ev.clientY - session.startY);
      if (!session.active) {
        if (isTouch) {
          if (dist > 6) {
            window.clearTimeout(session.holdTimer);
            cleanup();
          }
          return;
        }
        if (dist <= 6) return;
        activate();
      }
      if (!session.raf) {
        session.raf = requestAnimationFrame(paintGhost);
      }
      const col = findColAt(ev.clientX, ev.clientY);
      if (col !== session.lastOver) {
        session.lastOver = col;
        setOverStage(col);
      }
    };

    const cleanup = () => {
      if (session.holdTimer) window.clearTimeout(session.holdTimer);
      if (session.raf) cancelAnimationFrame(session.raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setActiveDrag(null);
      setOverStage(null);
    };

    const onUp = (ev: PointerEvent) => {
      if (session.active) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 60);
        const dest = findColAt(ev.clientX, ev.clientY);
        if (dest && dest !== session.deal.stage) {
          moveWithFlip(session.deal, dest);
        }
      }
      cleanup();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const companyMap = useMemo(
    () => new Map(space.companies.map((c) => [c.id, c.name])),
    [space.companies]
  );
  const repMap = useMemo(() => new Map(space.reps.map((r) => [r.id, r])), [space.reps]);

  const openDeals = space.deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const openSum = openDeals.reduce((s, d) => s + d.value, 0);
  const weightedSum = openDeals.reduce((s, d) => s + dealWeightedValue(d), 0);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return space.deals.filter((d) => {
      if (ownerFilter !== 'all' && d.ownerId !== ownerFilter) return false;
      if (activeTab === 'list' && stageFilter !== 'all' && d.stage !== stageFilter) return false;
      if (q) {
        const comp = (companyMap.get(d.companyId) || '').toLowerCase();
        if (!d.title.toLowerCase().includes(q) && !comp.includes(q)) return false;
      }
      return true;
    });
  }, [space.deals, ownerFilter, stageFilter, activeTab, search, companyMap]);

  const sortedListDeals = useMemo(() => {
    const copy = [...filteredDeals];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortKey === 'company')
        cmp = (companyMap.get(a.companyId) || '').localeCompare(companyMap.get(b.companyId) || '');
      else if (sortKey === 'owner')
        cmp = (repMap.get(a.ownerId)?.name || '').localeCompare(repMap.get(b.ownerId)?.name || '');
      else if (sortKey === 'stage')
        cmp = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      else if (sortKey === 'value') cmp = a.value - b.value;
      else cmp = a.closeDate.localeCompare(b.closeDate);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredDeals, sortKey, sortDir, companyMap, repMap]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'value' ? 'desc' : 'asc');
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent, deal: Deal) => {
    const idx = STAGE_ORDER.indexOf(deal.stage);
    if (e.key === 'ArrowRight' && idx < STAGE_ORDER.length - 1) {
      e.preventDefault();
      moveWithFlip(deal, STAGE_ORDER[idx + 1]);
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      moveWithFlip(deal, STAGE_ORDER[idx - 1]);
    }
  };

  const forecastData = useMemo(() => {
    const wonNov = space.deals
      .filter((d) => d.stage === 'won' && isCurrentMonth(d.closeDate))
      .reduce((s, d) => s + d.value, 0);

    return FORECAST_MONTHS.map((m) => {
      const dealsInMonth = openDeals
        .filter((d) => d.closeDate.startsWith(m.key))
        .sort((a, b) => b.value - a.value);
      const baseWon = m.key === '2026-11' ? wonNov : 0;
      const commit =
        baseWon +
        dealsInMonth
          .filter((d) => d.stage === 'negotiation')
          .reduce((s, d) => s + d.value, 0);
      const likely = baseWon + dealsInMonth.reduce((s, d) => s + dealWeightedValue(d), 0);
      const best = baseWon + dealsInMonth.reduce((s, d) => s + d.value, 0);
      return { ...m, deals: dealsInMonth, commit, likely, best };
    });
  }, [space.deals, openDeals]);

  const forecastTotal = forecastData.reduce((s, m) => s + m[forecastMode], 0);
  const forecastMax = Math.max(...forecastData.map((m) => m.best), 1);

  return (
    <div>
      <div className="phead">
        <div>
          <AnimatedTitle text="Pipeline" mark="sky" animKey={`${space.id}-pl`} />
          <p className="phead__sub">
            {openDeals.length} open deals · {formatKrCompact(openSum)} · weighted{' '}
            {formatKrCompact(weightedSum)}
          </p>
        </div>

        <div className="phead__actions">
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

      <SlidingTabs
        items={[
          { id: 'board', label: 'Board' },
          { id: 'list', label: 'All deals' },
          { id: 'forecast', label: 'Forecast' },
        ]}
        activeId={activeTab}
        onChange={(id) => {
          setTabDir(TAB_ORDER[id] >= TAB_ORDER[activeTab] ? 1 : -1);
          navigate('pipeline', id);
        }}
      />

      {activeTab !== 'forecast' && (
        <div className="filter-bar">
          <div className="search-box">
            <span className="search-box__icon">
              <IconSearch size={15} />
            </span>
            <input
              className="search-box__input"
              placeholder="Filter deals or companies"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="owner-pills" role="group" aria-label="Filter by owner">
            <button
              type="button"
              className={`owner-pill ${ownerFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setOwnerFilter('all')}
            >
              Everyone
            </button>
            {space.reps.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`owner-avatar-pill ${ownerFilter === r.id ? 'is-active' : ''}`}
                onClick={() => setOwnerFilter((prev) => (prev === r.id ? 'all' : r.id))}
                title={r.name}
                aria-label={`Filter by ${r.name}`}
              >
                <RepAvatar src={r.avatar} name={r.name} size={28} />
              </button>
            ))}
          </div>

          {activeTab === 'list' && (
            <SlidingSeg
              ariaLabel="Filter by stage"
              activeId={stageFilter}
              onChange={setStageFilter}
              items={[
                { id: 'all', label: 'All' },
                ...STAGE_ORDER.map((st) => ({ id: st, label: STAGE_META[st].label })),
              ]}
            />
          )}
        </div>
      )}

      <div ref={tabContentRef}>
        <SwapView swapKey={activeTab} direction={tabDir}>
          {/* BOARD TAB */}
          {activeTab === 'board' && (
            <div>
              <p className="board-hint">
                Drag a card to another stage, or focus it and press ← →.
              </p>

              <div ref={boardRef} className={`board ${activeDrag ? 'is-dragging' : ''}`}>
                {STAGE_ORDER.map((st) => {
                  const colDeals = filteredDeals.filter((d) => d.stage === st);
                  const colSum = colDeals.reduce((s, d) => s + d.value, 0);
                  const meta = STAGE_META[st];
                  return (
                    <div
                      key={st}
                      ref={(el) => {
                        colRefs.current[st] = el;
                      }}
                      data-stage-col={st}
                      className={`kcol ${st === 'won' ? 'kcol--won' : ''} ${
                        st === 'lost' ? 'kcol--lost' : ''
                      } ${overStage === st ? 'is-over' : ''}`}
                    >
                      <div className="kcol__head">
                        <span className="kcol__title">
                          <span className={`stage-dot stage-dot--${meta.tone}`} />
                          <span>{meta.label}</span>
                          <span className="kcol__count">{colDeals.length}</span>
                        </span>
                        <span
                          ref={(el) => {
                            sumRefs.current[st] = el;
                          }}
                          className="kcol__sum"
                        >
                          {formatKrCompact(colSum)}
                        </span>
                      </div>

                      <div className="kcol__cards">
                        {colDeals.map((deal) => {
                          const owner = repMap.get(deal.ownerId);
                          const isLifted = activeDrag?.deal.id === deal.id;
                          return (
                            <button
                              key={deal.id}
                              type="button"
                              data-deal-id={deal.id}
                              data-flip-id={deal.id}
                              className={`dcard ${isLifted ? 'is-lifted' : ''}`}
                              onPointerDown={(e) => startCardDrag(e, deal)}
                              onKeyDown={(e) => handleCardKeyDown(e, deal)}
                              onClick={() => {
                                if (suppressClickRef.current) return;
                                openDrawer({ kind: 'deal', id: deal.id });
                              }}
                            >
                              <div className="dcard__top">
                                <span className="dcard__title">{deal.title}</span>
                                <span className="dcard__val">{formatKrCompact(deal.value)}</span>
                              </div>
                              <div className="dcard__comp">{companyMap.get(deal.companyId)}</div>
                              <div className="dcard__foot">
                                {owner ? (
                                  <RepAvatar src={owner.avatar} name={owner.name} size={26} />
                                ) : (
                                  <span />
                                )}
                                <span className="dcard__date">
                                  <IconCalendar size={12} />
                                  {formatShortDate(deal.closeDate)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeDrag &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    ref={ghostRef}
                    className="dcard dcard--ghost"
                    style={{
                      width: activeDrag.width,
                      transform: `translate3d(${activeDrag.initX.toFixed(1)}px, ${activeDrag.initY.toFixed(
                        1
                      )}px, 0) rotate(-2deg)`,
                    }}
                    aria-hidden="true"
                  >
                    <div className="dcard__top">
                      <span className="dcard__title">{activeDrag.deal.title}</span>
                      <span className="dcard__val">{formatKrCompact(activeDrag.deal.value)}</span>
                    </div>
                    <div className="dcard__comp">{companyMap.get(activeDrag.deal.companyId)}</div>
                    <div className="dcard__foot">
                      {repMap.get(activeDrag.deal.ownerId) ? (
                        <RepAvatar
                          src={repMap.get(activeDrag.deal.ownerId)!.avatar}
                          name={repMap.get(activeDrag.deal.ownerId)!.name}
                          size={26}
                        />
                      ) : (
                        <span />
                      )}
                      <span className="dcard__date">
                        <IconCalendar size={12} />
                        {formatShortDate(activeDrag.deal.closeDate)}
                      </span>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          )}

          {/* ALL DEALS TABLE TAB */}
          {activeTab === 'list' && (
            <div className="card table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    {(
                      [
                        ['title', 'Deal'],
                        ['company', 'Company'],
                        ['owner', 'Owner'],
                        ['stage', 'Stage'],
                        ['value', 'Value'],
                        ['closeDate', 'Close'],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        className={key === 'value' || key === 'closeDate' ? 'is-right' : ''}
                      >
                        <button type="button" className="sort-btn" onClick={() => toggleSort(key)}>
                          <span>{label}</span>
                          {sortKey === key && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedListDeals.map((deal) => {
                    const owner = repMap.get(deal.ownerId);
                    const meta = STAGE_META[deal.stage];
                    const tone =
                      meta.tone === 'lime'
                        ? 'pill--lime'
                        : meta.tone === 'sky'
                          ? 'pill--sky'
                          : meta.tone === 'sand'
                            ? 'pill--sand'
                            : meta.tone === 'coral'
                              ? 'pill--coral'
                              : 'pill--muted';
                    return (
                      <tr key={deal.id} onClick={() => openDrawer({ kind: 'deal', id: deal.id })}>
                        <td data-label="Deal" style={{ fontWeight: 700 }}>
                          {deal.title}
                        </td>
                        <td data-label="Company" style={{ color: 'var(--muted)' }}>
                          {companyMap.get(deal.companyId)}
                        </td>
                        <td data-label="Owner">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {owner && <RepAvatar src={owner.avatar} name={owner.name} size={24} />}
                            <span>{owner?.name}</span>
                          </span>
                        </td>
                        <td data-label="Stage">
                          <span className={`pill ${tone}`}>{meta.label}</span>
                        </td>
                        <td data-label="Value" className="is-right" style={{ fontWeight: 700 }}>
                          {formatKrCompact(deal.value)}
                        </td>
                        <td data-label="Close" className="is-right" style={{ color: 'var(--muted)' }}>
                          {formatShortDate(deal.closeDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* FORECAST TAB */}
          {activeTab === 'forecast' && (
            <div>
              <div className="card">
                <div className="card__head">
                  <div>
                    <h2 className="card__title">Next four months</h2>
                    <p className="card__sub">
                      Commit = in negotiation · Likely = weighted by stage · Best = everything open
                    </p>
                  </div>

                  <SlidingSeg
                    ariaLabel="Forecast scenario"
                    activeId={forecastMode}
                    onChange={setForecastMode}
                    items={[
                      { id: 'commit', label: 'Commit' },
                      { id: 'likely', label: 'Likely' },
                      { id: 'best', label: 'Best case' },
                    ]}
                  />
                </div>

                <div className="forecast-hero">
                  <span className="forecast-hero__val">
                    <AnimatedNumber value={forecastTotal} format={formatKrCompact} />
                  </span>
                  <span className="forecast-hero__label">
                    {forecastMode === 'best' ? 'best case' : forecastMode} across four months
                  </span>
                </div>

                <div className="forecast-bars">
                  {forecastData.map((m) => {
                    const bestR = Math.max(0.06, (m.best / forecastMax) * 0.9);
                    const likelyR = Math.max(0.06, (m.likely / forecastMax) * 0.9);
                    const commitR = Math.max(0.06, (m.commit / forecastMax) * 0.9);
                    return (
                      <div key={m.key}>
                        <div className="fbar__well">
                          {m.best > 0 && (
                            <div
                              className="fbar__layer fc__layer fbar__layer--best"
                              style={{
                                transform: `scaleY(${bestR.toFixed(4)})`,
                                opacity: forecastMode === 'best' ? 1 : 0.72,
                              }}
                            />
                          )}
                          {m.likely > 0 && (
                            <div
                              className="fbar__layer fc__layer fbar__layer--likely"
                              style={{
                                transform: `scaleY(${likelyR.toFixed(4)})`,
                                opacity: forecastMode === 'likely' ? 1 : 0.78,
                              }}
                            />
                          )}
                          {m.commit > 0 && (
                            <div
                              className="fbar__layer fc__layer fbar__layer--commit"
                              style={{
                                transform: `scaleY(${commitR.toFixed(4)})`,
                                opacity: forecastMode === 'commit' ? 1 : 0.88,
                              }}
                            />
                          )}
                        </div>
                        <div className="fbar__month">{m.label}</div>
                        <div className="fbar__val">{formatKrCompact(m[forecastMode])}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="chart-legend" style={{ marginTop: 16 }}>
                  <span className="legend-item">
                    <span className="legend-swatch" style={{ background: 'var(--accent)' }} />
                    Commit
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch" style={{ background: 'var(--sky)' }} />
                    Likely
                  </span>
                  <span className="legend-item">
                    <span
                      className="legend-swatch"
                      style={{ background: 'color-mix(in srgb, var(--sky) 36%, var(--well-2))' }}
                    />
                    Best case
                  </span>
                </div>
              </div>

              <div className="forecast-months">
                {forecastData.map((m) => (
                  <div key={m.key} className="card">
                    <div className="card__head">
                      <h3 className="card__title">{m.label}</h3>
                      <span style={{ fontSize: 12.5, color: 'var(--faint)', fontWeight: 600 }}>
                        {m.deals.length} {m.deals.length === 1 ? 'deal' : 'deals'}
                      </span>
                    </div>

                    {m.deals.length === 0 ? (
                      <div style={{ fontSize: 13.5, color: 'var(--faint)' }}>
                        Nothing expected to close.
                      </div>
                    ) : (
                      <div className="act-list">
                        {m.deals.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className="act-row"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              justifyContent: 'space-between',
                            }}
                            onClick={() => openDrawer({ kind: 'deal', id: d.id })}
                          >
                            <div>
                              <div className="act-row__title">{d.title}</div>
                              <div className="act-row__sub">
                                {companyMap.get(d.companyId)} ·{' '}
                                {Math.round(STAGE_META[d.stage].prob * 100)}%
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>
                                {formatKrCompact(d.value)}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                                {formatShortDate(d.closeDate)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SwapView>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { CurrencyCode, FinanceTransaction } from '../../types';
import {
  createDefaultFinancePeriod,
  CycleRange,
  dateToCycleKey,
  FinancePeriodSelection,
  getCycleRange,
  getEffectiveExpense,
  getEffectiveIncome,
  isDefaultCurrentPeriod,
  listCycleKeysBetween,
} from '../../utils/financeEngine';
import {
  formatMoney,
  formatShortDate,
  localIsoDate,
} from '../../utils/format';
import {
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
} from '../Icons';
import { AnimatedPopover, SlidingSegmented } from '../Motion';

const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type CalendarViewMode = 'calendar' | 'months';

interface DayActivity {
  income: number;
  expense: number;
  count: number;
}

export interface FinanceCalendarPopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  selection: FinancePeriodSelection;
  activeRange: CycleRange;
  paydayDay: number;
  transactions: FinanceTransaction[];
  currency: CurrencyCode;
  onSelectPeriod: (next: FinancePeriodSelection) => void;
}

export const FinanceCalendarPopover: React.FC<FinanceCalendarPopoverProps> = ({
  open,
  anchorRef,
  onClose,
  selection,
  activeRange,
  paydayDay,
  transactions,
  currency,
  onSelectPeriod,
}) => {
  const todayIso = localIsoDate();
  const nowYear = Number(todayIso.slice(0, 4)) || new Date().getFullYear();
  const curCycleKey = useMemo(
    () => dateToCycleKey(todayIso, paydayDay),
    [todayIso, paydayDay]
  );

  const [viewMode, setViewMode] = useState<CalendarViewMode>('calendar');
  const [viewYear, setViewYear] = useState<number>(nowYear);
  const [viewMonth, setViewMonth] = useState<number>(
    Number(todayIso.slice(5, 7)) || 1
  );

  // Interactive 2-click day range draft state
  const [draftStartIso, setDraftStartIso] = useState<string | null>(null);
  const [hoverIso, setHoverIso] = useState<string | null>(null);

  // Interactive 2-click multi-month span state (touch-friendly + Shift+Click)
  const [spanMode, setSpanMode] = useState(false);
  const [draftMonthKey, setDraftMonthKey] = useState<string | null>(null);

  // Sync calendar viewport whenever popover opens
  useEffect(() => {
    if (!open) return;
    setDraftStartIso(null);
    setHoverIso(null);
    setDraftMonthKey(null);

    const refIso = activeRange.isCurrent ? todayIso : activeRange.endIso || todayIso;
    const [ry, rm] = refIso.split('-').map(Number);
    setViewYear(selection.kind === 'year' ? selection.year : ry || nowYear);
    setViewMonth(rm || 1);
    if (selection.kind === 'year') {
      setViewMode('months');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard Escape support: clear active draft first, otherwise close popover
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draftStartIso) {
          setDraftStartIso(null);
          setHoverIso(null);
        } else if (draftMonthKey) {
          setDraftMonthKey(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, draftStartIso, draftMonthKey, onClose]);

  // Daily transaction activity map (YYYY-MM-DD -> income/expense/count)
  const dailyActivity = useMemo(() => {
    const map = new Map<string, DayActivity>();
    for (const tx of transactions) {
      if (!tx.date) continue;
      const cur = map.get(tx.date) || { income: 0, expense: 0, count: 0 };
      cur.income += getEffectiveIncome(tx);
      cur.expense += getEffectiveExpense(tx);
      cur.count += 1;
      map.set(tx.date, cur);
    }
    return map;
  }, [transactions]);

  // Cycle-level transaction activity map (YYYY-MM -> income/expense/count)
  const cycleActivity = useMemo(() => {
    const map = new Map<string, DayActivity>();
    for (const tx of transactions) {
      if (!tx.date) continue;
      const ck = dateToCycleKey(tx.date, paydayDay);
      const cur = map.get(ck) || { income: 0, expense: 0, count: 0 };
      cur.income += getEffectiveIncome(tx);
      cur.expense += getEffectiveExpense(tx);
      cur.count += 1;
      map.set(ck, cur);
    }
    return map;
  }, [transactions, paydayDay]);

  // 42-day Monday-first calendar cells for (viewYear, viewMonth)
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth - 1, 1);
    const monOffset = (firstOfMonth.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, idx) => {
      const dt = new Date(viewYear, viewMonth - 1, 1 - monOffset + idx);
      const iso = localIsoDate(dt);
      return {
        iso,
        day: dt.getDate(),
        inMonth: dt.getMonth() === viewMonth - 1,
        isToday: iso === todayIso,
        activity: dailyActivity.get(iso),
      };
    });
  }, [viewYear, viewMonth, todayIso, dailyActivity]);

  // Active or live-previewed day highlight window
  const previewWindow = useMemo(() => {
    if (draftStartIso) {
      const targetEnd = hoverIso || draftStartIso;
      return draftStartIso <= targetEnd
        ? { startIso: draftStartIso, endIso: targetEnd, isDraft: true }
        : { startIso: targetEnd, endIso: draftStartIso, isDraft: true };
    }
    return {
      startIso: activeRange.startIso,
      endIso: activeRange.endIso,
      isDraft: false,
    };
  }, [draftStartIso, hoverIso, activeRange.startIso, activeRange.endIso]);

  // Covered cycle keys for Months 4x3 grid highlight
  const coveredCycles = useMemo(() => {
    if (draftMonthKey) {
      return new Set([draftMonthKey]);
    }
    return new Set(activeRange.coveredCycleKeys || [activeRange.cycleKey]);
  }, [draftMonthKey, activeRange.coveredCycleKeys, activeRange.cycleKey]);

  const edgeCycles = useMemo(() => {
    if (draftMonthKey) {
      return { first: draftMonthKey, last: draftMonthKey };
    }
    const list = activeRange.coveredCycleKeys || [activeRange.cycleKey];
    return {
      first: list[0] || activeRange.cycleKey,
      last: list[list.length - 1] || activeRange.cycleKey,
    };
  }, [draftMonthKey, activeRange.coveredCycleKeys, activeRange.cycleKey]);

  const shiftViewMonth = (delta: -1 | 1) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth() + 1);
  };

  const applyPreset = (preset: 'cycle' | '3m' | '6m' | 'year' | 'all') => {
    setDraftStartIso(null);
    setHoverIso(null);
    setDraftMonthKey(null);

    const anchorCk =
      selection.kind === 'all' || selection.kind === 'year'
        ? curCycleKey
        : selection.cycleKey || curCycleKey;

    if (preset === 'cycle') {
      onSelectPeriod({
        kind: 'cycle',
        cycleKey: anchorCk,
        year: Number(anchorCk.slice(0, 4)) || nowYear,
      });
      return;
    }
    if (preset === '3m' || preset === '6m') {
      onSelectPeriod({
        kind: preset,
        cycleKey: anchorCk,
        year: Number(anchorCk.slice(0, 4)) || nowYear,
      });
      return;
    }
    if (preset === 'year') {
      onSelectPeriod({
        kind: 'year',
        year: viewYear || nowYear,
        cycleKey: curCycleKey,
      });
      return;
    }
    onSelectPeriod({
      kind: 'all',
      cycleKey: curCycleKey,
      year: nowYear,
    });
  };

  const handleResetToCurrent = () => {
    setDraftStartIso(null);
    setHoverIso(null);
    setDraftMonthKey(null);
    setSpanMode(false);
    const def = createDefaultFinancePeriod(new Date(), paydayDay);
    onSelectPeriod(def);
    const [ty, tm] = todayIso.split('-').map(Number);
    setViewYear(ty || nowYear);
    setViewMonth(tm || 1);
  };

  const handleDayClick = (iso: string) => {
    if (!draftStartIso) {
      setDraftStartIso(iso);
      setHoverIso(iso);
      return;
    }
    const [startIso, endIso] =
      iso < draftStartIso ? [iso, draftStartIso] : [draftStartIso, iso];
    const endCk = dateToCycleKey(endIso, paydayDay);
    onSelectPeriod({
      kind: 'custom',
      startIso,
      endIso,
      cycleKey: endCk,
      year: Number(endCk.slice(0, 4)) || nowYear,
    });
    setDraftStartIso(null);
    setHoverIso(null);
  };

  const handleDateInputChange = (bound: 'start' | 'end', val: string) => {
    if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return;
    setDraftStartIso(null);
    setHoverIso(null);

    let nextStart = bound === 'start' ? val : activeRange.startIso;
    let nextEnd = bound === 'end' ? val : activeRange.endIso;
    if (bound === 'start' && nextStart > nextEnd) {
      nextEnd = nextStart;
    } else if (bound === 'end' && nextEnd < nextStart) {
      nextStart = nextEnd;
    }

    const endCk = dateToCycleKey(nextEnd, paydayDay);
    onSelectPeriod({
      kind: 'custom',
      startIso: nextStart,
      endIso: nextEnd,
      cycleKey: endCk,
      year: Number(endCk.slice(0, 4)) || nowYear,
    });

    const [vy, vm] = val.split('-').map(Number);
    if (vy && vm) {
      setViewYear(vy);
      setViewMonth(vm);
    }
  };

  const handleMonthTileClick = (
    targetCk: string,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    setDraftStartIso(null);
    setHoverIso(null);

    // Shift-click on desktop spans immediately from active anchor cycle -> targetCk
    if (e.shiftKey && !spanMode) {
      const anchor = selection.cycleKey || curCycleKey;
      const [sKey, eKey] = anchor <= targetCk ? [anchor, targetCk] : [targetCk, anchor];
      if (sKey === eKey) {
        onSelectPeriod({
          kind: 'cycle',
          cycleKey: sKey,
          year: Number(sKey.slice(0, 4)) || viewYear,
        });
      } else {
        const sRange = getCycleRange(sKey, paydayDay, todayIso);
        const eRange = getCycleRange(eKey, paydayDay, todayIso);
        onSelectPeriod({
          kind: 'custom',
          startIso: sRange.startIso,
          endIso: eRange.endIso,
          cycleKey: eKey,
          year: Number(eKey.slice(0, 4)) || viewYear,
        });
      }
      return;
    }

    // Touch-friendly 2-tap Multi-Month Span mode
    if (spanMode) {
      if (!draftMonthKey) {
        setDraftMonthKey(targetCk);
        return;
      }
      const [sKey, eKey] =
        targetCk < draftMonthKey
          ? [targetCk, draftMonthKey]
          : [draftMonthKey, targetCk];
      setDraftMonthKey(null);
      if (sKey === eKey) {
        onSelectPeriod({
          kind: 'cycle',
          cycleKey: sKey,
          year: Number(sKey.slice(0, 4)) || viewYear,
        });
      } else {
        const sRange = getCycleRange(sKey, paydayDay, todayIso);
        const eRange = getCycleRange(eKey, paydayDay, todayIso);
        onSelectPeriod({
          kind: 'custom',
          startIso: sRange.startIso,
          endIso: eRange.endIso,
          cycleKey: eKey,
          year: Number(eKey.slice(0, 4)) || viewYear,
        });
      }
      return;
    }

    // Standard single tap: jump straight to that cycle
    onSelectPeriod({
      kind: 'cycle',
      cycleKey: targetCk,
      year: Number(targetCk.slice(0, 4)) || viewYear,
    });
  };

  const isDefaultCurrent = isDefaultCurrentPeriod(selection, paydayDay);

  return (
    <AnimatedPopover
      open={open}
      anchorRef={anchorRef}
      align="left"
      offset={8}
      className="popover--fin-cal"
      onClose={onClose}
    >
      <div className="fin-cal" role="dialog" aria-label="Select finance date range">
        {/* Quick Period Presets Strip */}
        <div className="fin-cal__presets" role="group" aria-label="Quick period presets">
          {(
            [
              { id: 'cycle', label: '1 Month' },
              { id: '3m', label: '3 Months' },
              { id: '6m', label: '6 Months' },
              { id: 'year', label: 'This Year' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map((preset) => {
            const active = selection.kind === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`fin-cal__preset ${active ? 'is-active' : ''}`}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Mode Switcher: Calendar | Months */}
        <div className="fin-cal__mode-bar">
          <SlidingSegmented
            className="seg--full seg--cal"
            value={viewMode}
            onChange={(m) => {
              setDraftStartIso(null);
              setHoverIso(null);
              setDraftMonthKey(null);
              setViewMode(m);
            }}
            ariaLabel="Calendar display mode"
            items={[
              { id: 'calendar', label: 'Calendar' },
              { id: 'months', label: 'Months' },
            ]}
          />
        </div>

        {viewMode === 'calendar' ? (
          <div className="fin-cal__body">
            {/* Month Navigation Header */}
            <div className="fin-cal__nav">
              <button
                type="button"
                className="icon-btn fin-cal__nav-btn"
                aria-label="Previous calendar month"
                onClick={() => shiftViewMonth(-1)}
              >
                <IconChevronLeft size={15} />
              </button>

              <button
                type="button"
                className="fin-cal__nav-title"
                onClick={() => setViewMode('months')}
                title="Switch to 12-month grid"
              >
                <span>
                  {MONTHS_FULL[viewMonth - 1]} {viewYear}
                </span>
                <span className="fin-cal__nav-chev">
                  <IconChevronRight size={12} />
                </span>
              </button>

              <button
                type="button"
                className="icon-btn fin-cal__nav-btn"
                aria-label="Next calendar month"
                onClick={() => shiftViewMonth(1)}
              >
                <IconChevronRight size={15} />
              </button>
            </div>

            {/* Weekday Header Row */}
            <div className="fin-cal__dow" aria-hidden="true">
              {WEEKDAYS_MON.map((d) => (
                <span key={d} className="fin-cal__dow-cell">
                  {d}
                </span>
              ))}
            </div>

            {/* 7-Column Interactive Day Grid */}
            <div className="fin-cal__grid" role="grid" aria-label={`${MONTHS_FULL[viewMonth - 1]} ${viewYear}`}>
              {calendarDays.map((cell) => {
                const inRange =
                  cell.iso >= previewWindow.startIso &&
                  cell.iso <= previewWindow.endIso;
                const isStart = cell.iso === previewWindow.startIso;
                const isEnd = cell.iso === previewWindow.endIso;
                const isSingle = isStart && isEnd;

                const tipParts = [
                  `${formatShortDate(cell.iso)}, ${cell.iso.slice(0, 4)}`,
                ];
                if (cell.activity) {
                  if (cell.activity.income > 0) {
                    tipParts.push(`+${formatMoney(cell.activity.income, currency)}`);
                  }
                  if (cell.activity.expense > 0) {
                    tipParts.push(`-${formatMoney(cell.activity.expense, currency)}`);
                  }
                  if (cell.activity.income === 0 && cell.activity.expense === 0 && cell.activity.count > 0) {
                    tipParts.push(`${cell.activity.count} transfer${cell.activity.count > 1 ? 's' : ''}`);
                  }
                }

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    className={[
                      'fin-cal__day',
                      !cell.inMonth ? 'is-outside' : '',
                      cell.isToday ? 'is-today' : '',
                      inRange ? 'is-in-range' : '',
                      isStart ? 'is-range-start' : '',
                      isEnd ? 'is-range-end' : '',
                      isSingle ? 'is-single' : '',
                      previewWindow.isDraft && inRange ? 'is-draft' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={tipParts.join(' · ')}
                    onMouseEnter={() => {
                      if (draftStartIso) setHoverIso(cell.iso);
                    }}
                    onMouseLeave={() => {
                      if (draftStartIso) setHoverIso(null);
                    }}
                    onClick={() => handleDayClick(cell.iso)}
                  >
                    <span className="fin-cal__day-num">{cell.day}</span>
                    <span className="fin-cal__dots" aria-hidden="true">
                      {cell.activity && cell.activity.income > 0 && (
                        <span className="fin-cal__dot fin-cal__dot--in" />
                      )}
                      {cell.activity && cell.activity.expense > 0 && (
                        <span className="fin-cal__dot fin-cal__dot--out" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Draft Range Status Banner */}
            {draftStartIso && (
              <div className="fin-cal__hint">
                <span>
                  Selecting end date from <strong>{formatShortDate(draftStartIso)}</strong> (tap again for 1 day)
                </span>
                <button
                  type="button"
                  className="fin-cal__hint-cancel"
                  onClick={() => {
                    setDraftStartIso(null);
                    setHoverIso(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Compact From & To Date Inputs */}
            <div className="fin-cal__inputs">
              <label className="fin-cal__field">
                <span className="fin-cal__field-lbl">From</span>
                <input
                  type="date"
                  className="fin-cal__date-input"
                  value={draftStartIso || activeRange.startIso}
                  onChange={(e) => handleDateInputChange('start', e.target.value)}
                />
              </label>
              <label className="fin-cal__field">
                <span className="fin-cal__field-lbl">To</span>
                <input
                  type="date"
                  className="fin-cal__date-input"
                  value={draftStartIso || activeRange.endIso}
                  onChange={(e) => handleDateInputChange('end', e.target.value)}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="fin-cal__body">
            {/* Year Navigation + Full Year Quick Action */}
            <div className="fin-cal__nav">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="icon-btn fin-cal__nav-btn"
                  aria-label="Previous year"
                  onClick={() => setViewYear((y) => y - 1)}
                >
                  <IconChevronLeft size={15} />
                </button>
                <span className="fin-cal__year-label">{viewYear}</span>
                <button
                  type="button"
                  className="icon-btn fin-cal__nav-btn"
                  aria-label="Next year"
                  onClick={() => setViewYear((y) => y + 1)}
                >
                  <IconChevronRight size={15} />
                </button>
              </div>

              <button
                type="button"
                className={`fin-cal__year-btn ${
                  selection.kind === 'year' && selection.year === viewYear ? 'is-active' : ''
                }`}
                onClick={() => {
                  setDraftMonthKey(null);
                  onSelectPeriod({
                    kind: 'year',
                    year: viewYear,
                    cycleKey: `${viewYear}-${curCycleKey.slice(5, 7)}`,
                  });
                }}
              >
                <IconCalendar size={12} />
                Full Year {viewYear}
              </button>
            </div>

            {/* Multi-Month Span Helper Bar */}
            <div className="fin-cal__span-bar">
              <span className="fin-cal__span-text">
                {draftMonthKey
                  ? `Start: ${MONTHS_SHORT[Number(draftMonthKey.slice(5, 7)) - 1]} ${draftMonthKey.slice(0, 4)} — tap end month`
                  : spanMode
                    ? 'Tap start month, then end month'
                    : 'Tap month to jump · Shift-click for span'}
              </span>
              <button
                type="button"
                className={`fin-cal__span-toggle ${spanMode ? 'is-active' : ''}`}
                onClick={() => {
                  setSpanMode((v) => !v);
                  setDraftMonthKey(null);
                }}
              >
                {spanMode ? 'Span ON' : 'Pick Span'}
              </button>
            </div>

            {/* 4 x 3 Months Grid */}
            <div className="fin-cal__months-grid">
              {MONTHS_SHORT.map((mLabel, mIdx) => {
                const mm = String(mIdx + 1).padStart(2, '0');
                const ck = `${viewYear}-${mm}`;
                const mRange = getCycleRange(ck, paydayDay, todayIso);
                const act = cycleActivity.get(ck);
                const isCovered = coveredCycles.has(ck);
                const isEdge = ck === edgeCycles.first || ck === edgeCycles.last;
                const isNow = ck === curCycleKey;

                const tipParts = [mRange.label];
                if (act) {
                  if (act.income > 0) tipParts.push(`+${formatMoney(act.income, currency)}`);
                  if (act.expense > 0) tipParts.push(`-${formatMoney(act.expense, currency)}`);
                } else {
                  tipParts.push('No transactions');
                }

                // Preview covered span when draftMonthKey is active
                const isDraftAnchor = draftMonthKey === ck;

                return (
                  <button
                    key={ck}
                    type="button"
                    className={[
                      'fin-cal__month-tile',
                      isCovered ? 'is-covered' : '',
                      isEdge ? 'is-edge' : '',
                      isNow ? 'is-now' : '',
                      isDraftAnchor ? 'is-draft-anchor' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={tipParts.join(' · ')}
                    onClick={(e) => handleMonthTileClick(ck, e)}
                  >
                    <span className="fin-cal__month-name">{mLabel}</span>
                    {paydayDay > 1 && (
                      <span className="fin-cal__month-sub">{mRange.shortLabel}</span>
                    )}
                    <span className="fin-cal__dots" aria-hidden="true">
                      {act && act.income > 0 && (
                        <span className="fin-cal__dot fin-cal__dot--in" />
                      )}
                      {act && act.expense > 0 && (
                        <span className="fin-cal__dot fin-cal__dot--out" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Multi-Month Summary */}
            {selection.kind === 'custom' && activeRange.coveredCycleKeys && activeRange.coveredCycleKeys.length > 1 && (
              <div className="fin-cal__span-summary">
                Selected: <strong>{activeRange.label}</strong> ({ listCycleKeysBetween(edgeCycles.first, edgeCycles.last).length } cycles)
              </div>
            )}
          </div>
        )}

        {/* Footer: Range Info + Today/Reset + Done */}
        <div className="fin-cal__foot">
          <span className="fin-cal__foot-meta">
            {activeRange.daysTotal} day{activeRange.daysTotal === 1 ? '' : 's'}
            {paydayDay > 1 ? ` · Payday ${paydayDay}th` : ''}
          </span>

          <div className="fin-cal__foot-actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm fin-cal__foot-btn"
              onClick={handleResetToCurrent}
              title="Jump back to current cycle"
            >
              <IconRefresh size={12} />
              {isDefaultCurrent ? 'Today' : 'Reset'}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm fin-cal__foot-btn"
              onClick={onClose}
            >
              <IconCheck size={13} />
              Done
            </button>
          </div>
        </div>
      </div>
    </AnimatedPopover>
  );
};

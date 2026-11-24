import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCrm } from '../../store/CrmContext';
import { Activity, ActivityType } from '../../types';
import {
  addDays,
  formatShortDate,
  parseIsoDate,
  TODAY_ISO,
  toIsoDate,
} from '../../utils/format';
import { animateCards, animateRows, dur, gsap, isReducedMotion } from '../../utils/motion';
import { RepAvatar } from '../Avatar';
import { AnimatedTitle, MagneticButton, SlidingSeg, SlidingTabs, SwapView } from '../Motion';
import {
  IconActivityKind,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from '../Icons';

const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TAB_ORDER = { agenda: 0, week: 1, tasks: 2 } as const;

export const ActivitiesPage: React.FC = () => {
  const { state, space, route, navigate, openDrawer, openModal, toggleActivityDone } = useCrm();
  const activeTab = (route.sub === 'week' || route.sub === 'tasks' ? route.sub : 'agenda') as
    | 'agenda'
    | 'week'
    | 'tasks';

  const [tabDir, setTabDir] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityType>('all');
  const [showMode, setShowMode] = useState<'todo' | 'all'>('todo');
  const [weekOffset, setWeekOffset] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || isReducedMotion()) return;
    const ctx = gsap.context(() => {
      animateCards(el.querySelectorAll('.card'));
      if (activeTab === 'agenda') {
        animateRows(el.querySelectorAll('.act-row'), { stagger: 0.025, delay: 0.2 });
      } else if (activeTab === 'week') {
        animateRows(el.querySelectorAll('.week-event'), { stagger: 0.015, delay: 0.25 });
      } else {
        animateRows(el.querySelectorAll('.act-row'), { stagger: 0.03, delay: 0.2 });
        const meterFill = el.querySelector('.meter__fill');
        if (meterFill) {
          gsap.from(meterFill, { scaleX: 0, duration: dur(0.9), ease: 'expo.out', delay: dur(0.3) });
        }
      }
    }, el);
    return () => ctx.revert();
  }, [activeTab, space.id]);

  const companyMap = useMemo(
    () => new Map(space.companies.map((c) => [c.id, c.name])),
    [space.companies]
  );
  const dealMap = useMemo(() => new Map(space.deals.map((d) => [d.id, d])), [space.deals]);
  const repMap = useMemo(() => new Map(space.reps.map((r) => [r.id, r])), [space.reps]);

  const openCount = space.activities.filter((a) => !a.done).length;
  const todayCount = space.activities.filter((a) => !a.done && a.date === TODAY_ISO).length;
  const overdueCount = space.activities.filter((a) => !a.done && a.date < TODAY_ISO).length;

  const agendaFiltered = useMemo(() => {
    return space.activities
      .filter((a) => {
        if (showMode === 'todo' && a.done) return false;
        if (typeFilter !== 'all' && a.type !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [space.activities, showMode, typeFilter]);

  const tomorrowIso = addDays(TODAY_ISO, 1);
  const groups = [
    {
      key: 'overdue',
      label: 'Overdue',
      overdue: true,
      items: agendaFiltered.filter((a) => a.date < TODAY_ISO),
    },
    {
      key: 'today',
      label: 'Today',
      overdue: false,
      items: agendaFiltered.filter((a) => a.date === TODAY_ISO),
    },
    {
      key: 'tomorrow',
      label: 'Tomorrow',
      overdue: false,
      items: agendaFiltered.filter((a) => a.date === tomorrowIso),
    },
    {
      key: 'later',
      label: 'Later',
      overdue: false,
      items: agendaFiltered.filter((a) => a.date > tomorrowIso),
    },
  ];

  const weekDays = useMemo(() => {
    const anchor = parseIsoDate(TODAY_ISO);
    const dow = anchor.getDay();
    const startOffset =
      state.settings.weekStartsOn === 'monday' ? (dow === 0 ? -6 : 1 - dow) : -dow;
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() + startOffset + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = toIsoDate(d);
      return {
        iso,
        dow: DOW_NAMES[d.getDay()],
        num: d.getDate(),
        isToday: iso === TODAY_ISO,
      };
    });
  }, [state.settings.weekStartsOn, weekOffset]);

  const allTasks = useMemo(
    () =>
      space.activities
        .filter((a) => a.type === 'task')
        .sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date)),
    [space.activities]
  );
  const tasksDone = allTasks.filter((t) => t.done).length;
  const tasksPct = allTasks.length > 0 ? Math.round((tasksDone / allTasks.length) * 100) : 0;
  const tasksOverdue = allTasks.filter((t) => !t.done && t.date < TODAY_ISO).length;

  const renderActivityRow = (act: Activity) => {
    const deal = act.dealId ? dealMap.get(act.dealId) : undefined;
    const compName = deal ? companyMap.get(deal.companyId) : undefined;
    const owner = repMap.get(act.ownerId);
    return (
      <div key={act.id} className={`act-row ${act.done ? 'is-done' : ''}`}>
        <button
          type="button"
          className={`check-btn ${act.done ? 'is-done' : ''}`}
          onClick={() => toggleActivityDone(act.id)}
          aria-label={act.done ? 'Mark incomplete' : 'Mark complete'}
        >
          <IconCheck size={13} />
        </button>
        <span className={`kind-chip kind-chip--${act.type}`}>
          <IconActivityKind type={act.type} size={14} />
        </span>
        <div className="act-row__body">
          <div className="act-row__title">{act.title}</div>
          <div className="act-row__sub">
            {act.time} · {act.type}
            {compName ? ` · ${compName}` : ''}
          </div>
        </div>
        {deal && (
          <button
            type="button"
            className="deal-pill"
            onClick={() => openDrawer({ kind: 'deal', id: deal.id })}
          >
            {deal.title}
          </button>
        )}
        {owner && <RepAvatar src={owner.avatar} name={owner.name} size={28} />}
      </div>
    );
  };

  return (
    <div>
      <div className="phead">
        <div>
          <AnimatedTitle text="Activities" mark="teal" animKey={`${space.id}-act`} />
          <p className="phead__sub">
            {todayCount} today · {overdueCount} overdue · {openCount} open
          </p>
        </div>

        <div className="phead__actions">
          <MagneticButton
            type="button"
            className="btn btn--primary"
            onClick={() => openModal({ kind: 'new-activity' })}
          >
            <IconPlus size={16} />
            <span>Plan activity</span>
          </MagneticButton>
        </div>
      </div>

      <SlidingTabs
        activeId={activeTab}
        onChange={(id) => {
          setTabDir(TAB_ORDER[id] >= TAB_ORDER[activeTab] ? 1 : -1);
          navigate('activities', id);
        }}
        items={[
          { id: 'agenda', label: 'Agenda' },
          { id: 'week', label: 'Week' },
          { id: 'tasks', label: 'Tasks' },
        ]}
      />

      <div ref={contentRef}>
        <SwapView swapKey={activeTab} direction={tabDir}>
          {activeTab === 'agenda' && (
            <div>
              <div className="filter-bar">
                <SlidingSeg
                  ariaLabel="Activity type"
                  activeId={typeFilter}
                  onChange={setTypeFilter}
                  items={[
                    { id: 'all', label: 'All' },
                    { id: 'call', label: 'Calls', icon: <IconActivityKind type="call" size={13} /> },
                    {
                      id: 'meeting',
                      label: 'Meetings',
                      icon: <IconActivityKind type="meeting" size={13} />,
                    },
                    {
                      id: 'email',
                      label: 'Emails',
                      icon: <IconActivityKind type="email" size={13} />,
                    },
                    { id: 'task', label: 'Tasks', icon: <IconActivityKind type="task" size={13} /> },
                  ]}
                />

                <SlidingSeg
                  ariaLabel="Show filter"
                  activeId={showMode}
                  onChange={setShowMode}
                  items={[
                    { id: 'todo', label: 'To do' },
                    { id: 'all', label: 'Everything' },
                  ]}
                />
              </div>

              {groups.map(
                (g) =>
                  g.items.length > 0 && (
                    <section
                      key={g.key}
                      className={`card agenda-group ${g.overdue ? 'agenda-group--overdue' : ''}`}
                    >
                      <div className="card__head" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <h2 className="card__title">{g.label}</h2>
                          <span className="kcol__count">{g.items.length}</span>
                        </div>
                      </div>
                      <div className="act-list">{g.items.map(renderActivityRow)}</div>
                    </section>
                  )
              )}
            </div>
          )}

          {activeTab === 'week' && (
            <div>
              <div className="week-bar">
                <button
                  type="button"
                  className="icon-circle"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  aria-label="Previous week"
                >
                  <IconChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  className="btn btn--glass btn--sm"
                  onClick={() => setWeekOffset(0)}
                >
                  This week
                </button>
                <button
                  type="button"
                  className="icon-circle"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  aria-label="Next week"
                >
                  <IconChevronRight size={15} />
                </button>
                <span className="week-range">
                  {formatShortDate(weekDays[0].iso)} – {formatShortDate(weekDays[6].iso)}
                </span>
              </div>

              <div className="card week-card">
                <div className="week-grid">
                  <div className="week-head">
                    <div />
                    {weekDays.map((day) => (
                      <div
                        key={day.iso}
                        className={`week-day-head ${day.isToday ? 'is-today' : ''}`}
                      >
                        <div className="week-day-head__dow">{day.dow}</div>
                        <div className="week-day-head__num">{day.num}</div>
                      </div>
                    ))}
                  </div>

                  <div className="week-body">
                    <div className="week-hours">
                      {HOURS.map((h) => (
                        <div key={h} className="week-hour-label">
                          {h}
                        </div>
                      ))}
                    </div>

                    {weekDays.map((day) => {
                      const dayActs = space.activities.filter((a) => a.date === day.iso);
                      return (
                        <div key={day.iso} className={`week-col ${day.isToday ? 'is-today' : ''}`}>
                          {dayActs.map((act) => {
                            const hour = Math.max(
                              8,
                              Math.min(17, parseInt(act.time.split(':')[0], 10) || 9)
                            );
                            const top = (hour - 8) * 58 + 3;
                            const height = Math.max(48, (act.durationHours || 1) * 58 - 6);
                            return (
                              <button
                                key={act.id}
                                type="button"
                                className={`week-event week-event--${act.type} ${
                                  act.done ? 'is-done' : ''
                                }`}
                                style={{ top, height }}
                                onClick={() => toggleActivityDone(act.id)}
                                title={`${act.title} (${act.time}) — click to toggle complete`}
                              >
                                <div className="week-event__title">
                                  <IconActivityKind type={act.type} size={12} />
                                  <span
                                    style={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {act.title}
                                  </span>
                                </div>
                                <div className="week-event__time">{act.time}</div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="tasks-split">
              <div className="card">
                <div className="kpi-card__label">Tasks done</div>
                <div style={{ fontSize: 30, fontWeight: 700, margin: '8px 0 10px' }}>
                  {tasksDone}{' '}
                  <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--muted)' }}>
                    of {allTasks.length}
                  </span>
                </div>
                <div className="meter">
                  <div
                    className="meter__fill"
                    style={{ transform: `scaleX(${tasksPct / 100})` }}
                  />
                </div>
                <div className="kpi-card__meta">
                  {tasksPct}% complete · {tasksOverdue} overdue
                </div>
              </div>

              <div className="card">
                <div className="card__head">
                  <h2 className="card__title">Checklist</h2>
                  <button
                    type="button"
                    className="card__link"
                    style={{ color: 'var(--text)' }}
                    onClick={() => openModal({ kind: 'new-activity', defaultType: 'task' })}
                  >
                    <IconPlus size={14} />
                    Task
                  </button>
                </div>

                <div className="act-list">
                  {allTasks.length === 0 ? (
                    <div style={{ color: 'var(--faint)', fontSize: 13.5 }}>No tasks yet.</div>
                  ) : (
                    allTasks.map(renderActivityRow)
                  )}
                </div>
              </div>
            </div>
          )}
        </SwapView>
      </div>
    </div>
  );
};

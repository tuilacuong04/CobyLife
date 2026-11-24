import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { TaskCategory, TaskItem, TaskPriority, TaskStatus } from '../../types';
import {
  localIsoDate,
  relativeDueLabel,
  TASK_CATEGORY_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from '../../utils/format';
import { useStaggerEntrance } from '../../utils/motion';
import { MagneticButton, SlidingSegmented } from '../Motion';
import {
  IconCheck,
  IconPin,
  IconPlus,
  IconRepeat,
  IconSearch,
} from '../Icons';

const STATUS_COLS: TaskStatus[] = ['todo', 'doing', 'done'];

export const TasksPage: React.FC = () => {
  const {
    state,
    route,
    navigate,
    openModal,
    openDrawer,
    createTask,
    setTaskStatus,
    toggleTaskDone,
    toggleTaskPinned,
  } = useApp();

  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<TaskCategory>('personal');
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('medium');
  const [filterCat, setFilterCat] = useState<TaskCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<TaskStatus | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const viewMode = route.sub === 'board' || route.sub === 'list' ? route.sub : 'agenda';
  useStaggerEntrance(listRef, '.task-anim', [viewMode, filterCat, filterPriority]);

  const today = localIsoDate();

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.tasks
      .filter((t) => {
        if (filterCat !== 'all' && t.category !== filterCat) return false;
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
        if (q && !t.title.toLowerCase().includes(q) && !t.notes.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const pOrder = { high: 0, medium: 1, low: 2 };
        if (pOrder[a.priority] !== pOrder[b.priority]) {
          return pOrder[a.priority] - pOrder[b.priority];
        }
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      });
  }, [state.tasks, filterCat, filterPriority, search]);

  const totalCount = state.tasks.length;
  const doneCount = state.tasks.filter((t) => t.status === 'done').length;
  const doingCount = state.tasks.filter((t) => t.status === 'doing').length;
  const overdueCount = state.tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate < today
  ).length;

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickTitle.trim();
    if (!clean) return;
    createTask({
      title: clean,
      notes: '',
      status: 'todo',
      priority: quickPriority,
      category: quickCategory,
      dueDate: today,
      recurrence: 'none',
      pinned: false,
    });
    setQuickTitle('');
  };

  const agendaGroups = useMemo(() => {
    const overdue: TaskItem[] = [];
    const dueToday: TaskItem[] = [];
    const upcoming: TaskItem[] = [];
    const completed: TaskItem[] = [];

    for (const t of filteredTasks) {
      if (t.status === 'done') {
        completed.push(t);
      } else if (t.dueDate && t.dueDate < today) {
        overdue.push(t);
      } else if (!t.dueDate || t.dueDate === today) {
        dueToday.push(t);
      } else {
        upcoming.push(t);
      }
    }
    return { overdue, dueToday, upcoming, completed };
  }, [filteredTasks, today]);

  const renderTaskRow = (task: TaskItem) => {
    const due = relativeDueLabel(task.dueDate, today);
    const done = task.status === 'done';
    const subDone = task.subtasks.filter((s) => s.done).length;
    return (
      <div key={task.id} className="act-row task-anim">
        <button
          type="button"
          className={`check-btn ${done ? 'is-done' : ''}`}
          onClick={(e) => toggleTaskDone(task.id, e.currentTarget)}
          aria-label={`Toggle ${task.title}`}
        >
          <IconCheck size={12} />
        </button>

        <div
          className="act-row__body"
          style={{ cursor: 'pointer' }}
          onClick={() => openDrawer({ kind: 'task', id: task.id })}
        >
          <div className={`act-row__title ${done ? 'is-done' : ''}`}>
            {task.pinned && (
              <IconPin
                size={13}
                style={{ color: 'var(--accent)', marginRight: 6, verticalAlign: '-2px' }}
              />
            )}
            {task.title}
          </div>
          <div className="act-row__meta">
            <span className={`stage-dot ${TASK_STATUS_META[task.status].dot}`} />
            <span>{TASK_STATUS_META[task.status].label}</span>
            <span>· {TASK_CATEGORY_META[task.category].label}</span>
            <span
              style={{
                color: due.overdue && !done ? 'var(--bad)' : undefined,
                fontWeight: due.overdue && !done ? 700 : undefined,
              }}
            >
              · {due.text}
              {task.dueTime ? ` ${task.dueTime}` : ''}
            </span>
            {task.subtasks.length > 0 && (
              <span>
                · {subDone}/{task.subtasks.length} steps
              </span>
            )}
            {task.recurrence !== 'none' && (
              <span>
                · <IconRepeat size={11} style={{ verticalAlign: '-1px' }} />{' '}
                {task.recurrence === 'daily'
                  ? 'Daily'
                  : task.recurrence === 'weekly'
                    ? 'Weekly'
                    : 'Monthly'}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="icon-btn"
          style={{ width: 30, height: 30, color: task.pinned ? 'var(--accent)' : 'var(--faint)' }}
          aria-label="Pin task"
          onClick={() => toggleTaskPinned(task.id)}
        >
          <IconPin size={14} />
        </button>

        <span className={`pill ${TASK_PRIORITY_META[task.priority].pill}`}>
          {TASK_PRIORITY_META[task.priority].short}
        </span>
      </div>
    );
  };

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="phead__title">Tasks</h1>
          <p className="phead__sub">
            {doneCount}/{totalCount} completed · {doingCount} in progress
            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </p>
        </div>
        <div className="phead__actions">
          <SlidingSegmented
            value={viewMode}
            onChange={(next) => navigate('tasks', next)}
            items={[
              { id: 'agenda', label: 'Agenda' },
              { id: 'board', label: 'Board' },
              { id: 'list', label: 'All' },
            ]}
          />
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

      {/* 1-Line Quick Add Bar */}
      <form className="card quick-add-bar" onSubmit={handleQuickAdd}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Quick add a task for today (press Enter)..."
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
        />
        <select
          className="select"
          style={{ width: 150 }}
          value={quickCategory}
          onChange={(e) => setQuickCategory(e.target.value as TaskCategory)}
          aria-label="Category"
        >
          {(Object.keys(TASK_CATEGORY_META) as TaskCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {TASK_CATEGORY_META[cat].label}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 130 }}
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
          aria-label="Priority"
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button type="submit" className="btn btn--primary">
          <IconPlus size={15} />
          Add
        </button>
      </form>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${filterCat === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilterCat('all')}
          >
            All ({state.tasks.length})
          </button>
          {(Object.keys(TASK_CATEGORY_META) as TaskCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip ${filterCat === cat ? 'is-active' : ''}`}
              onClick={() => setFilterCat(cat)}
            >
              {TASK_CATEGORY_META[cat].label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          <select
            className="select"
            style={{ height: 34, width: 135, padding: '0 10px', fontSize: 12.5 }}
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
            aria-label="Filter priority"
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div className="inline-search">
            <IconSearch size={14} />
            <input
              placeholder="Filter tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Views */}
      <div ref={listRef}>
        {viewMode === 'agenda' && (
          <div className="stack-list" style={{ gap: 16 }}>
            {agendaGroups.overdue.length > 0 && (
              <div className="card">
                <div className="card__head">
                  <div>
                    <h2 className="card__title" style={{ color: 'var(--bad)' }}>
                      Overdue ({agendaGroups.overdue.length})
                    </h2>
                    <p className="card__sub">Prioritize or reschedule these items</p>
                  </div>
                </div>
                <div className="stack-list">{agendaGroups.overdue.map(renderTaskRow)}</div>
              </div>
            )}

            <div className="card">
              <div className="card__head">
                <div>
                  <h2 className="card__title">Today ({agendaGroups.dueToday.length})</h2>
                  <p className="card__sub">Your focus items for today</p>
                </div>
                <button
                  type="button"
                  className="chip"
                  onClick={() => openModal({ kind: 'new-task', defaultDate: today })}
                >
                  <IconPlus size={13} /> Add for today
                </button>
              </div>
              {agendaGroups.dueToday.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 12px' }}>
                  No tasks remaining for today.
                </div>
              ) : (
                <div className="stack-list">{agendaGroups.dueToday.map(renderTaskRow)}</div>
              )}
            </div>

            <div className="card">
              <div className="card__head">
                <div>
                  <h2 className="card__title">Upcoming ({agendaGroups.upcoming.length})</h2>
                  <p className="card__sub">Planned for later this week</p>
                </div>
              </div>
              {agendaGroups.upcoming.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 12px' }}>
                  No upcoming tasks scheduled.
                </div>
              ) : (
                <div className="stack-list">{agendaGroups.upcoming.map(renderTaskRow)}</div>
              )}
            </div>

            {agendaGroups.completed.length > 0 && (
              <div className="card">
                <div className="card__head">
                  <div>
                    <h2 className="card__title">Completed ({agendaGroups.completed.length})</h2>
                  </div>
                </div>
                <div className="stack-list">{agendaGroups.completed.map(renderTaskRow)}</div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'board' && (
          <div className="task-kanban">
            {STATUS_COLS.map((st) => {
              const colTasks = filteredTasks.filter((t) => t.status === st);
              return (
                <div
                  key={st}
                  className={`card kanban-col ${dropCol === st ? 'is-drop-target' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropCol(st);
                  }}
                  onDragLeave={() => setDropCol((prev) => (prev === st ? null : prev))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropCol(null);
                    if (dragTaskId) {
                      setTaskStatus(dragTaskId, st);
                      setDragTaskId(null);
                    }
                  }}
                >
                  <div className="kanban-col__head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`stage-dot ${TASK_STATUS_META[st].dot}`} />
                      <span style={{ fontWeight: 700, fontSize: 14.5 }}>
                        {TASK_STATUS_META[st].label}
                      </span>
                      <span className="pill pill--muted" style={{ height: 22, padding: '0 8px' }}>
                        {colTasks.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 28, height: 28 }}
                      aria-label={`Add task to ${TASK_STATUS_META[st].label}`}
                      onClick={() => openModal({ kind: 'new-task', defaultStatus: st })}
                    >
                      <IconPlus size={14} />
                    </button>
                  </div>

                  <div className="kanban-col__list">
                    {colTasks.length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px 10px', fontSize: 12.5 }}>
                        Drop tasks here
                      </div>
                    ) : (
                      colTasks.map((task) => {
                        const due = relativeDueLabel(task.dueDate, today);
                        const subDone = task.subtasks.filter((s) => s.done).length;
                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => setDragTaskId(task.id)}
                            onDragEnd={() => {
                              setDragTaskId(null);
                              setDropCol(null);
                            }}
                            className="deal-card task-anim"
                            onClick={() => openDrawer({ kind: 'task', id: task.id })}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <span
                                className={`pill ${TASK_CATEGORY_META[task.category].pill}`}
                                style={{ height: 22, fontSize: 11 }}
                              >
                                {TASK_CATEGORY_META[task.category].label}
                              </span>
                              <span
                                className={`pill ${TASK_PRIORITY_META[task.priority].pill}`}
                                style={{ height: 22, fontSize: 11 }}
                              >
                                {TASK_PRIORITY_META[task.priority].short}
                              </span>
                            </div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 14,
                                lineHeight: 1.35,
                                textDecoration: task.status === 'done' ? 'line-through' : undefined,
                                opacity: task.status === 'done' ? 0.65 : 1,
                              }}
                            >
                              {task.title}
                            </div>
                            {task.notes && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: 'var(--muted)',
                                  marginTop: 6,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {task.notes}
                              </div>
                            )}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: 10,
                                fontSize: 12,
                                color:
                                  due.overdue && task.status !== 'done'
                                    ? 'var(--bad)'
                                    : 'var(--faint)',
                              }}
                            >
                              <span>
                                {due.text}
                                {task.dueTime ? ` · ${task.dueTime}` : ''}
                              </span>
                              {task.subtasks.length > 0 && (
                                <span>
                                  {subDone}/{task.subtasks.length} steps
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'list' && (
          <div className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">All tasks ({filteredTasks.length})</h2>
                <p className="card__sub">Click any task to edit notes and subtasks</p>
              </div>
            </div>
            {filteredTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 12px' }}>
                No tasks match the current filter.
              </div>
            ) : (
              <div className="stack-list">{filteredTasks.map(renderTaskRow)}</div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

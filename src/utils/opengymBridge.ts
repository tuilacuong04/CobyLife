import { OpenGymRoutineSummary, OpenGymSnapshot } from '../types';
import { localIsoDate } from './format';

export const OPENGYM_STATE_KEY = 'gym_state_v1';
export const OPENGYM_SEEDED_KEY = 'gym_demo_seeded_v1';

interface RawGymSet {
  w?: number;
  r?: number;
  done?: boolean;
  warmup?: boolean;
}

interface RawGymEntry {
  id?: string;
  sets?: RawGymSet[];
}

interface RawGymWorkout {
  id?: string;
  d?: string;
  start?: number;
  end?: number;
  name?: string;
  vol?: number;
  entries?: RawGymEntry[];
}

interface RawGymRoutine {
  id?: string;
  name?: string;
  ex?: unknown[];
  exercises?: unknown[];
  exs?: unknown[];
}

interface RawGymState {
  unit?: 'kg' | 'lb';
  weekStart?: number;
  targetW?: number | null;
  routines?: RawGymRoutine[];
  week?: Record<string, string>;
  dayPlan?: Record<string, string>;
  workouts?: RawGymWorkout[];
  bodyweight?: { d?: string; w?: number }[];
  active?: { name?: string; start?: number; startedAt?: number } | null;
  theme?: 'dark' | 'light' | 'system';
}

function getStartOfWeekIso(today: Date, weekStart = 1): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return localIsoDate(d);
}

function computeWeeklyStreak(workouts: RawGymWorkout[], weekStart: number): number {
  if (!workouts.length) return 0;
  const weekBuckets = new Set<string>();
  for (const w of workouts) {
    if (!w.d) continue;
    const [y, m, day] = w.d.split('-').map(Number);
    if (!y || !m || !day) continue;
    const dt = new Date(y, m - 1, day);
    weekBuckets.add(getStartOfWeekIso(dt, weekStart));
  }
  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let streak = 0;
  // Allow current week to be in-progress without breaking previous weeks' streak
  const thisWeek = getStartOfWeekIso(cursor, weekStart);
  if (weekBuckets.has(thisWeek)) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  } else {
    cursor.setDate(cursor.getDate() - 7);
  }
  for (let i = 0; i < 104; i++) {
    const key = getStartOfWeekIso(cursor, weekStart);
    if (weekBuckets.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

export function readOpenGymSnapshot(): OpenGymSnapshot {
  const empty: OpenGymSnapshot = {
    available: false,
    workoutsCount: 0,
    workoutsThisWeek: 0,
    weekTarget: 3,
    streakWeeks: 0,
    totalVolumeThisWeek: 0,
    totalSetsThisWeek: 0,
    unit: 'kg',
    lastWorkout: null,
    todayRoutine: null,
    activeWorkout: null,
    latestBodyweight: null,
    routines: [],
  };

  try {
    const rawStr = window.localStorage.getItem(OPENGYM_STATE_KEY);
    if (!rawStr) return empty;
    const parsed = JSON.parse(rawStr) as RawGymState;
    if (!parsed || typeof parsed !== 'object') return empty;

    const unit = parsed.unit === 'lb' ? 'lb' : 'kg';
    const weekStart = typeof parsed.weekStart === 'number' ? parsed.weekStart : 1;
    const workouts = Array.isArray(parsed.workouts) ? parsed.workouts : [];
    const routinesRaw = Array.isArray(parsed.routines) ? parsed.routines : [];
    const routines: OpenGymRoutineSummary[] = routinesRaw
      .filter((r): r is RawGymRoutine & { id: string; name: string } => Boolean(r?.id && r?.name))
      .map((r) => ({
        id: r.id,
        name: r.name,
        exerciseCount: Array.isArray(r.ex)
          ? r.ex.length
          : Array.isArray(r.exercises)
            ? r.exercises.length
            : Array.isArray(r.exs)
              ? r.exs.length
              : 0,
      }));

    const today = new Date();
    const todayIso = localIsoDate(today);
    const weekStartIso = getStartOfWeekIso(today, weekStart);

    const weekWorkouts = workouts.filter((w) => w.d && w.d >= weekStartIso && w.d <= todayIso);
    let totalVolumeThisWeek = 0;
    let totalSetsThisWeek = 0;
    for (const w of weekWorkouts) {
      if (typeof w.vol === 'number' && Number.isFinite(w.vol)) {
        totalVolumeThisWeek += w.vol;
      }
      if (Array.isArray(w.entries)) {
        for (const e of w.entries) {
          if (Array.isArray(e.sets)) {
            totalSetsThisWeek += e.sets.filter((s) => !s.warmup).length;
          }
        }
      }
    }

    const sortedWorkouts = [...workouts].sort((a, b) => {
      const da = a.d || '';
      const db = b.d || '';
      if (da !== db) return db.localeCompare(da);
      return (b.end || b.start || 0) - (a.end || a.start || 0);
    });

    const latest = sortedWorkouts[0];
    const lastWorkout = latest
      ? {
          name: latest.name || 'Buổi tập',
          date: latest.d || todayIso,
          vol: typeof latest.vol === 'number' ? latest.vol : 0,
          durationMin:
            latest.start && latest.end && latest.end > latest.start
              ? Math.max(1, Math.round((latest.end - latest.start) / 60000))
              : 45,
          sets: Array.isArray(latest.entries)
            ? latest.entries.reduce((sum, e) => sum + (Array.isArray(e.sets) ? e.sets.length : 0), 0)
            : 0,
        }
      : null;

    const weekMap = parsed.week && typeof parsed.week === 'object' ? parsed.week : {};
    const dayPlan = parsed.dayPlan && typeof parsed.dayPlan === 'object' ? parsed.dayPlan : {};
    const plannedDays = Object.values(weekMap).filter(Boolean).length;
    const weekTarget = Math.max(plannedDays || 3, 1);

    const todayRoutineId = dayPlan[todayIso] || weekMap[String(today.getDay())];
    const todayRoutine =
      routines.find((r) => r.id === todayRoutineId) || routines[0] || null;

    const bwList = Array.isArray(parsed.bodyweight) ? parsed.bodyweight : [];
    const sortedBw = [...bwList]
      .filter((b) => typeof b?.w === 'number')
      .sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    const latestBw = sortedBw[0];

    const activeWorkout = parsed.active
      ? {
          name: parsed.active.name || 'Đang tập luyện',
          startedAt: parsed.active.start || parsed.active.startedAt || Date.now(),
        }
      : null;

    return {
      available: true,
      workoutsCount: workouts.length,
      workoutsThisWeek: weekWorkouts.length,
      weekTarget,
      streakWeeks: computeWeeklyStreak(workouts, weekStart),
      totalVolumeThisWeek,
      totalSetsThisWeek,
      unit,
      lastWorkout,
      todayRoutine,
      activeWorkout,
      latestBodyweight: latestBw
        ? {
            weight: latestBw.w as number,
            date: latestBw.d || todayIso,
            target: typeof parsed.targetW === 'number' ? parsed.targetW : null,
          }
        : null,
      routines,
    };
  } catch {
    return empty;
  }
}

export function getOpenGymRawJson(): unknown | null {
  try {
    const raw = window.localStorage.getItem(OPENGYM_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function restoreOpenGymRawJson(data: unknown): boolean {
  try {
    if (!data || typeof data !== 'object') return false;
    window.localStorage.setItem(OPENGYM_STATE_KEY, JSON.stringify(data));
    window.localStorage.setItem(OPENGYM_SEEDED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

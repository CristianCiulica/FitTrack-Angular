import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';
import { isWorkoutSession } from './workout-kind';
import { localDateKey } from './weight-progress';

export interface ActivityDay {
  key: string;
  number: number;
  label: string;
  sessions: string[];
  state: 'active' | 'inactive' | 'future';
  today: boolean;
}

/** Date-only workout records already represent a local calendar day. */
function activityDate(value: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isFinite(parsed.getTime()) && localDateKey(parsed) === value ? value : null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? localDateKey(parsed) : null;
}

export function activityYear(
  workouts: Workout[],
  runs: RunningSession[],
  year: number,
  today = new Date(),
) {
  const todayKey = localDateKey(today);
  const sessions = new Map<string, string[]>();
  const add = (date: string, name: string) => {
    const key = activityDate(date);
    if (!key || key > todayKey) return;
    sessions.set(key, [...(sessions.get(key) ?? []), name]);
  };
  workouts.filter(isWorkoutSession).forEach((workout) => add(workout.date, workout.name));
  runs.forEach((run) => add(run.startedAt, run.mode === 'walking' ? 'Walk' : 'Run'));

  let activeDays = 0,
    totalSessions = 0,
    longestStreak = 0,
    streak = 0;
  const months = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(year, index, 1);
    const count = new Date(year, index + 1, 0).getDate();
    const days: ActivityDay[] = Array.from({ length: count }, (_, offset) => {
      const date = new Date(year, index, offset + 1);
      const key = localDateKey(date);
      const entries = sessions.get(key) ?? [];
      if (entries.length) {
        activeDays++;
        totalSessions += entries.length;
        longestStreak = Math.max(longestStreak, ++streak);
      } else streak = 0;
      return {
        key,
        number: offset + 1,
        sessions: entries,
        today: key === todayKey,
        label: date.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        state: key > todayKey ? 'future' : entries.length ? 'active' : 'inactive',
      };
    });
    return {
      index,
      name: start.toLocaleDateString('en-GB', { month: 'long' }),
      offset: (start.getDay() + 6) % 7,
      days,
      activeDays: days.filter((day) => day.state === 'active').length,
      current: year === today.getFullYear() && index === today.getMonth(),
    };
  });
  return { months, activeDays, totalSessions, longestStreak };
}

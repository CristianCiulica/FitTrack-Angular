import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';
import { activityDateKey, activityYear } from './activity-calendar';
import { isWorkoutSession } from './workout-kind';
import { localDateKey } from './weight-progress';

export function trainingProgress(
  workouts: Workout[],
  runs: RunningSession[],
  period: Date,
  today = new Date(),
) {
  const year = period.getFullYear(),
    monthIndex = period.getMonth();
  const month = activityYear(workouts, runs, year, today).months[monthIndex];
  const prefix = localDateKey(new Date(year, monthIndex, 1)).slice(0, 7);
  const todayKey = localDateKey(today);
  const completed = workouts.filter(isWorkoutSession).filter((workout) => {
    const key = activityDateKey(workout.date);
    return key && key <= todayKey;
  });
  const finishedRuns = runs.filter((run) => {
    const key = activityDateKey(run.startedAt);
    return key && key <= todayKey;
  });
  const strength = completed.filter((workout) =>
    activityDateKey(workout.date)?.startsWith(prefix),
  ).length;
  const running = finishedRuns.filter(
    (run) => run.mode === 'running' && activityDateKey(run.startedAt)?.startsWith(prefix),
  ).length;
  const walking = finishedRuns.filter(
    (run) => run.mode === 'walking' && activityDateKey(run.startedAt)?.startsWith(prefix),
  ).length;
  const elapsedDays = month.days.filter((day) => day.state !== 'future').length;
  let bestStreak = 0,
    streak = 0;
  month.days.forEach((day) => {
    streak = day.state === 'active' ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  });
  const weeks = Array.from(
    { length: Math.ceil((month.offset + month.days.length) / 7) },
    (_, index) => {
      const days = month.days.filter(
        (day) => Math.floor((month.offset + day.number - 1) / 7) === index,
      );
      return {
        label: `${days[0].number}–${days[days.length - 1].number}`,
        count: days.reduce((sum, day) => sum + day.sessions.length, 0),
        upcoming: days.every((day) => day.state === 'future'),
      };
    },
  );
  const allDates = [
    ...new Set([
      ...completed.map((workout) => activityDateKey(workout.date)!),
      ...finishedRuns.map((run) => activityDateKey(run.startedAt)!),
    ]),
  ].sort();
  let allTimeBest = 0,
    currentStreak = 0,
    previous = -Infinity;
  for (const key of allDates) {
    const time = Date.parse(`${key}T12:00:00Z`);
    currentStreak = time - previous === 86_400_000 ? currentStreak + 1 : 1;
    allTimeBest = Math.max(allTimeBest, currentStreak);
    previous = time;
  }
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weeklyWorkouts = completed.filter(
    (workout) => activityDateKey(workout.date)! >= localDateKey(weekStart),
  ).length;
  const total = strength + running + walking;
  return {
    activeDays: month.activeDays,
    totalSessions: total,
    bestStreak,
    elapsedDays,
    consistency: elapsedDays ? Math.round((month.activeDays / elapsedDays) * 100) : 0,
    weeks,
    peakWeek: Math.max(1, ...weeks.map((week) => week.count)),
    weeklyWorkouts,
    mix: [
      { label: 'Strength', count: strength, color: '#5375f5' },
      { label: 'Running', count: running, color: '#26b985' },
      { label: 'Walking', count: walking, color: '#e6ad57' },
    ].map((item) => ({ ...item, percent: total ? (item.count / total) * 100 : 0 })),
    milestones: [
      {
        label: 'The first step',
        detail: 'Log your first session',
        earned: allDates.length > 0,
        mark: '01',
      },
      {
        label: 'Finding your rhythm',
        detail: '10 sessions completed',
        earned: completed.length + finishedRuns.length >= 10,
        mark: '10',
      },
      {
        label: 'A habit in motion',
        detail: '25 active days',
        earned: allDates.length >= 25,
        mark: '25',
      },
      {
        label: 'Seven in a row',
        detail: 'A 7-day training streak',
        earned: allTimeBest >= 7,
        mark: '07',
      },
    ],
  };
}

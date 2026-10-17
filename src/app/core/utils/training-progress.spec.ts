import { trainingProgress } from './training-progress';
import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';
const session = (date: string, kind: Workout['kind'] = 'session'): Workout => ({
  date,
  kind,
  userId: 'test',
  name: 'Push',
  exercises: [],
});
const today = new Date(2026, 9, 17, 12);
const period = new Date(2026, 9, 1);
describe('Progress insights', () => {
  it('uses elapsed local days, combines movement and excludes plans and future records', () => {
    const workouts = [
      session('2026-10-15'),
      session('2026-10-15'),
      session('2026-10-16'),
      session('2026-10-17', 'routine'),
      session('2026-10-18'),
      session('invalid'),
    ];
    const runs = [
      { mode: 'running', startedAt: new Date(2026, 9, 16, 23, 45).toISOString() },
      { mode: 'walking', startedAt: new Date(2026, 9, 17, 0, 15).toISOString() },
    ] as RunningSession[];
    const result = trainingProgress(workouts, runs, period, today);
    expect(result.activeDays).toBe(3);
    expect(result.totalSessions).toBe(5);
    expect(result.elapsedDays).toBe(17);
    expect(result.consistency).toBe(18);
    expect(result.bestStreak).toBe(3);
    expect(result.mix.map((item) => item.count)).toEqual([3, 1, 1]);
    expect(result.weeks.reduce((sum, week) => sum + week.count, 0)).toBe(5);
    expect(result.weeklyWorkouts).toBe(3);
  });
  it('uses all-time achievements while keeping selected-month charts separate', () => {
    const workouts = Array.from({ length: 25 }, (_, index) =>
      session(`2026-09-${String(index + 1).padStart(2, '0')}`),
    );
    const result = trainingProgress(workouts, [], period, today);
    expect(result.totalSessions).toBe(0);
    expect(result.milestones.every((item) => item.earned)).toBe(true);
    expect(result.weeks.filter((week) => week.upcoming).length).toBeGreaterThan(0);
    expect(trainingProgress([], [], period, today).milestones.every((item) => !item.earned)).toBe(
      true,
    );
  });
  it('groups Monday-first partial weeks without duplicating month boundaries', () => {
    const result = trainingProgress(
      [session('2026-09-30'), session('2026-10-01'), session('2026-10-04'), session('2026-10-05')],
      [],
      period,
      today,
    );
    expect(result.weeks[0]).toMatchObject({ label: '1–4', count: 2 });
    expect(result.weeks[1].count).toBe(1);
  });
});

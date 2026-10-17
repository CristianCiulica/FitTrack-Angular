import { activityYear } from './activity-calendar';
import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';
import { localDateKey } from './weight-progress';

const workout = (date: string, kind: Workout['kind'] = 'session', name = 'Pull'): Workout => ({
  date,
  kind,
  name,
  userId: 'test',
  exercises: [],
});
const run = (startedAt: string, mode: RunningSession['mode'] = 'running') =>
  ({ startedAt, mode }) as RunningSession;

describe('Training calendar', () => {
  const today = new Date(2026, 9, 17, 12);
  it('counts days once, combines sessions and ignores plans and future activity', () => {
    const result = activityYear(
      [
        workout('2026-10-15'),
        workout('2026-10-15', 'session', 'Push'),
        workout('2026-10-16', 'routine'),
        { ...workout('2026-10-16'), isPredefined: true },
        workout('2026-10-18'),
        workout('bad-date'),
        workout('2026-02-30'),
      ],
      [
        run(new Date(2026, 9, 15, 23, 45).toISOString()),
        run(new Date(2026, 9, 17, 0, 15).toISOString(), 'walking'),
      ],
      2026,
      today,
    );
    expect(result.activeDays).toBe(2);
    expect(result.totalSessions).toBe(4);
    expect(result.months[9].days[14].sessions).toEqual(['Pull', 'Push', 'Run']);
    expect(result.months[9].days[15].state).toBe('inactive');
    expect(result.months[9].days[16]).toMatchObject({
      state: 'active',
      today: true,
      sessions: ['Walk'],
    });
    expect(result.months[9].days[17]).toMatchObject({ state: 'future', sessions: [] });
  });
  it('lays out Monday-first months, leap years and streaks across month boundaries', () => {
    const result = activityYear(
      ['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-03'].map((date) => workout(date)),
      [],
      2024,
      today,
    );
    expect(result.months[0].offset).toBe(0);
    expect(result.months[1].days).toHaveLength(29);
    expect(result.months.flatMap((month) => month.days)).toHaveLength(366);
    expect(result.longestStreak).toBe(3);
    expect(result.activeDays).toBe(4);
    expect(result.months[1].activeDays).toBe(2);
  });
  it('keeps historical years separate and creates a fully neutral future', () => {
    const result = activityYear([workout('2025-12-31'), workout('2026-01-01')], [], 2025, today);
    expect(result.activeDays).toBe(1);
    expect(result.totalSessions).toBe(1);
    expect(result.months[11].days[30].key).toBe('2025-12-31');
    expect(
      activityYear([], [], 2027, today)
        .months.flatMap((month) => month.days)
        .every((day) => day.state === 'future'),
    ).toBe(true);
  });
  it('interprets run timestamps as local days, including a run around midnight', () => {
    const nearMidnight = new Date(2026, 9, 16, 0, 15);
    const result = activityYear([], [run(nearMidnight.toISOString())], 2026, today);
    const active = result.months
      .flatMap((month) => month.days)
      .filter((day) => day.state === 'active');
    expect(active.map((day) => day.key)).toEqual([localDateKey(nearMidnight)]);
  });
});

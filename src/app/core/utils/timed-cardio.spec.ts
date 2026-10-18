import {
  timedSessionNotes,
  timedSession,
  estimateTreadmillCalories,
  isTimedCardioOnly,
} from './timed-cardio';
import { workoutActivityCalories, workoutActivityMinutes } from './workout-calories';
import { isStrengthWorkoutSession } from './workout-kind';
import { readProgramSession } from './program-records';
import { trainingProgress } from './training-progress';
const program = {
  enrollmentId: 'pg_test',
  programId: 'build-30',
  dayIndex: 2,
  sessionId: 'cardio-a',
};
const log = { exerciseIndex: 0, seconds: 1200, targetSeconds: 1200, weightKg: 75 };
describe('Treadmill within a workout', () => {
  it('stores real elapsed seconds without fake sets, reps, distance or a GPS route', () => {
    const notes = timedSessionNotes({ version: 1, program, completed: true, treadmill: [log] });
    const workout = {
      userId: 'u',
      name: 'Walk',
      date: '2026-10-18',
      kind: 'session' as const,
      exercises: [],
      durationSeconds: 1600,
      notes,
    };
    expect(timedSession(workout)?.treadmill).toEqual([log]);
    expect(readProgramSession(workout)).toMatchObject({ ...program, completed: true });
    expect(isTimedCardioOnly(workout)).toBe(true);
    expect(isStrengthWorkoutSession(workout)).toBe(false);
    expect(workoutActivityMinutes(workout)).toBe(20);
    expect(workoutActivityCalories(workout, 95)).toBe(92); // Use weight captured with the log.
    expect(estimateTreadmillCalories(0, 75)).toBe(0);
    const progress = trainingProgress(
      [workout],
      [],
      new Date(2026, 9, 1),
      new Date(2026, 9, 18, 20),
    );
    expect(progress.weeklyWorkouts).toBe(0);
    expect(progress.mix.find((m) => m.label === 'Walking')?.count).toBe(1);
    expect(
      timedSessionNotes({
        version: 1,
        completed: true,
        treadmill: Array.from({ length: 50 }, (_, i) => ({
          ...log,
          exerciseIndex: i,
          seconds: 7200,
          targetSeconds: 7200,
          weightKg: 300,
        })),
      }).length,
    ).toBeLessThan(2000);
  });
  it('rejects corrupted timer data and duplicate activities', () => {
    for (const invalid of [
      { ...log, seconds: -1 },
      { ...log, seconds: 1201 },
      { ...log, targetSeconds: 7201 },
      { ...log, weightKg: NaN },
    ])
      expect(() =>
        timedSessionNotes({ version: 1, completed: true, treadmill: [invalid] }),
      ).toThrow();
    expect(() =>
      timedSessionNotes({ version: 1, completed: true, treadmill: [log, log] }),
    ).toThrow();
    expect(
      timedSession({
        kind: 'session',
        notes: 'FitTrack Timed Session · {"v":1,"c":true,"t":[[0,1]]}',
      }),
    ).toBeNull();
    expect(
      timedSession({
        kind: 'routine',
        notes: timedSessionNotes({ version: 1, completed: true, treadmill: [log] }),
      }),
    ).toBeNull();
  });
});

import {
  indoorCardio,
  indoorCardioWorkout,
  indoorHistorySession,
  IndoorCardioRecord,
  validIndoorCardio,
} from './indoor-cardio';
import { workoutActivityCalories } from './workout-calories';
import { trainingProgress } from './training-progress';
import { isStrengthWorkoutSession } from './workout-kind';
const record: IndoorCardioRecord = {
  version: 1,
  mode: 'walking',
  startedAt: '2026-10-18T10:00:00Z',
  endedAt: '2026-10-18T10:30:00Z',
  distanceMeters: 2000,
  inclinePercent: 5,
  steps: null,
  calories: null,
};
describe('Indoor treadmill records', () => {
  it('round-trips machine readings without inventing GPS, steps or calories', () => {
    const workout = { ...indoorCardioWorkout(record, 'user', 'indoor_test'), id: 'saved' };
    expect(indoorCardio(workout)).toEqual(record);
    expect(workout.durationSeconds).toBe(1800);
    expect(workout.exercises).toEqual([]);
    expect(workout.notes!.length).toBeLessThan(2000);
    const history = indoorHistorySession(workout)!;
    expect(history.id).toBe('indoor:saved');
    expect(history.route).toEqual([]);
    expect(history.indoor?.steps).toBeNull();
    expect(history.indoor?.calories).toBeNull();
    expect(history.averageSpeedKmh).toBe(4);
    expect(workoutActivityCalories(workout, 75)).toBe(0);
    expect(isStrengthWorkoutSession(workout)).toBe(false);
  });
  it('rejects invalid durations, implausible speed and invalid optional readings', () => {
    expect(validIndoorCardio(record)).toBe(true);
    for (const invalid of [
      { ...record, distanceMeters: 0 },
      { ...record, distanceMeters: 100000 },
      { ...record, endedAt: record.startedAt },
      { ...record, inclinePercent: 26 },
      { ...record, steps: 1.5 },
      { ...record, calories: NaN },
      { ...record, program: {} },
    ])
      expect(validIndoorCardio(invalid)).toBe(false);
    expect(indoorCardio({ kind: 'session', notes: 'FitTrack Indoor Cardio · nope' })).toBeNull();
    expect(() => indoorCardioWorkout({ ...record, distanceMeters: -1 }, 'user', 'id')).toThrow();
  });
  it('contributes to activity and cardio mix, while leaving strength goals alone', () => {
    const workout = indoorCardioWorkout(
      { ...record, calories: 130, steps: 2400 },
      'user',
      'indoor_test',
    );
    const progress = trainingProgress(
      [workout],
      [],
      new Date(2026, 9, 1),
      new Date(2026, 9, 18, 20),
    );
    expect(progress.totalSessions).toBe(1);
    expect(progress.activeDays).toBe(1);
    expect(progress.weeklyWorkouts).toBe(0);
    expect(progress.mix.find((m) => m.label === 'Walking')!.count).toBe(1);
    expect(progress.mix.find((m) => m.label === 'Strength')!.count).toBe(0);
    expect(workoutActivityCalories(workout, 75)).toBe(130);
  });
});

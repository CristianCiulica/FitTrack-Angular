import { isWorkoutSession, personalWorkoutPlans } from './workout-kind';
import { previousExercises } from './workout-history';
import { Workout } from '../models/workout.model';
const base: Workout = {
  id: 'old',
  name: 'Push',
  date: '2026-10-03',
  userId: 'test',
  exercises: [{ exerciseName: 'Press', sets: 2, reps: 10, weight: 50, muscleGroup: 'Chest' }],
};
describe('Routine and session separation', () => {
  it('excludes a new routine from performed activity and previous exercise values', () => {
    const routine: Workout = { ...base, kind: 'routine' };
    expect(isWorkoutSession(routine)).toBe(false);
    expect(previousExercises([routine], '2026-10-03').size).toBe(0);
    expect(isWorkoutSession(base)).toBe(true);
  });
  it('keeps legacy plans once and never adds a completed session to the library', () => {
    const routine: Workout = { ...base, id: 'plan', kind: 'routine' };
    expect(
      personalWorkoutPlans([
        base,
        { ...base, id: 'old-copy' },
        routine,
        { ...base, id: 'session', kind: 'session' },
      ]),
    ).toEqual([routine]);
    expect(personalWorkoutPlans([{ ...base, kind: 'session' }])).toEqual([]);
  });
});

import { exerciseRecords } from './exercise-records';
import { Workout, ExerciseLog } from '../models/workout.model';
const exercise = (values: Partial<ExerciseLog> = {}): ExerciseLog => ({
  exerciseName: 'Bench Press',
  muscleGroup: 'Chest',
  sets: 2,
  reps: 10,
  weight: 60,
  setWeights: [60, 65],
  setReps: [10, 8],
  ...values,
});
const session = (date: string, exercises = [exercise()], more: Partial<Workout> = {}): Workout => ({
  date,
  name: 'Push',
  kind: 'session',
  userId: 'a',
  exercises,
  ...more,
});
describe('Exercise records from performed history', () => {
  it('keeps actual weight/reps pairs and the initial first set, independently of workout name or array order', () => {
    const records = exerciseRecords(
      [
        session(
          '2026-10-20',
          [exercise({ exerciseName: ' bench   press ', setWeights: [70, 65], setReps: [6, 12] })],
          { name: 'Other plan' },
        ),
        session('2026-10-01'),
      ],
      '2026-10-23',
    );
    expect(records).toHaveLength(1);
    expect(records[0].initial).toEqual({ weight: 60, reps: 10, date: '2026-10-01' });
    expect(records[0].bestWeight).toEqual({ weight: 70, reps: 6, date: '2026-10-20' });
    expect(records[0].bestReps).toEqual({ weight: 65, reps: 12, date: '2026-10-20' });
    expect(records[0].sessions).toHaveLength(2);
  });
  it('ignores templates, demos, future and unperformed sets but accepts historical legacy records', () => {
    const result = exerciseRecords(
      [
        session('2026-10-01', undefined, { kind: 'routine' }),
        session('2026-10-01', undefined, { isPredefined: true }),
        session('2027-01-01'),
        session('2026-10-02', [exercise({ sets: 0 })]),
        session('2026-10-03', [exercise({ setReps: [0, 0] })]),
        session('2026-10-04', undefined, { kind: undefined }),
      ],
      '2026-10-23',
    );
    expect(result).toHaveLength(1);
    expect(result[0].sessions).toHaveLength(1);
    expect(result[0].initial.date).toBe('2026-10-04');
  });
  it('updates after deletion/editing and accepts bodyweight zero and legacy aggregate values', () => {
    const old = session('2026-10-01', [
      exercise({ setWeights: undefined, setReps: undefined, weight: 0 }),
    ]);
    const later = session('2026-10-02', [exercise({ setWeights: [80, 80] })]);
    expect(exerciseRecords([old, later])[0].bestWeight.weight).toBe(80);
    expect(exerciseRecords([old])).toEqual([]);
    expect(exerciseRecords([old, later])[0].initial.weight).toBe(80);
  });
  it('uses performed timestamp to order same-day sessions and retains earliest record on ties', () => {
    const later = session('2026-10-01', [exercise({ setWeights: [70, 70] })], {
      createdAt: new Date('2026-10-01T18:00Z'),
    });
    const earlier = session('2026-10-01', undefined, { createdAt: new Date('2026-10-01T09:00Z') });
    expect(exerciseRecords([later, earlier])[0].initial.weight).toBe(60);
  });
  it('includes valid drops without replacing initial working set or combining reps and weight from separate sets', () => {
    const record = exerciseRecords([
      session('2026-10-01', [exercise({ dropSets: [{ setIndex: 1, weight: 40, reps: 20 }] })]),
    ])[0];
    expect(record.initial.reps).toBe(10);
    expect(record.bestWeight.reps).toBe(8);
    expect(record.bestReps).toMatchObject({ weight: 40, reps: 20, drop: true });
  });
  it('separates timed holds, handles zero loads, rejects invalid values and groups duplicate exercise entries in one session', () => {
    const result = exerciseRecords([
      session('2026-10-01', [
        exercise({
          exerciseName: 'Hold',
          repUnit: 'seconds',
          setWeights: [0, 0],
          setReps: [20, 30],
        }),
        exercise({ setWeights: [NaN, -1] }),
        exercise(),
        exercise(),
      ]),
    ], undefined, true);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.timed)?.bestReps.reps).toBe(30);
    expect(result.find((r) => !r.timed)?.sessions).toHaveLength(1);
  });
});

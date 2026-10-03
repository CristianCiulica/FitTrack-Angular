import { readWorkoutDraft, writeWorkoutDraft, WorkoutDraft } from './workout-draft';
const draft: WorkoutDraft = {
  version: 1,
  owner: 'alice',
  clientId: 'w_draft',
  date: '2026-10-03',
  routine: {
    name: 'Legs',
    exercises: [{ name: 'Squat', muscleGroup: 'Legs', sets: 2, reps: 20, weight: 0 }],
  },
  state: 'rest',
  exerciseIndex: 0,
  setIndex: 1,
  weights: [[0, null]],
  reps: [[18, null]],
  currentWeight: 0,
  currentReps: 18,
  startedAt: Date.now() - 60000,
  endedAt: null,
  restDeadline: Date.now() + 90000,
  restSeconds: 90,
  holdElapsedMs: 0,
};
describe('Durable workout draft', () => {
  beforeEach(() => localStorage.clear());
  it('recovers the actual sets, input, rest deadline and upload identity after reload', () => {
    expect(writeWorkoutDraft(draft)).toBe(true);
    expect(readWorkoutDraft('alice')).toEqual(draft);
    expect(readWorkoutDraft('bob')).toBeNull();
  });
  it('rejects corrupted counters and mismatched set arrays', () => {
    for (const bad of [
      { ...draft, setIndex: 99 },
      { ...draft, weights: [[null]] },
      { ...draft, weights: [[0, null]], reps: [[null, null]] },
      { ...draft, currentWeight: -1 },
    ]) {
      localStorage.setItem('fittrack_active_workout:alice', JSON.stringify(bad));
      expect(readWorkoutDraft('alice')).toBeNull();
    }
  });
});

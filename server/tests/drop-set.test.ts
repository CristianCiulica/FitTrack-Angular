import test from 'node:test';
import assert from 'node:assert/strict';
import { exerciseSchema } from '../src/validation/activity';
import { Workout } from '../src/models/workout.model';
const exercise = {exerciseName: 'Triceps Pushdown', muscleGroup: 'Arms', sets: 1, reps: 12, weight: 40, setWeights: [40], setReps: [12], dropSets: [{setIndex: 0, weight: 30, reps: 8}]};
test('drop logs survive API parsing and Mongo serialization', () => {
  const parsed = exerciseSchema.parse(exercise);
  const doc = new Workout({userId: 'test', name: 'Push', date: '2026-10-19', exercises: [parsed]});
  assert.deepEqual(doc.toObject().exercises[0].dropSets, exercise.dropSets);
});
test('drop sets reject orphaned parents, nonreductions, duplicates and invalid reps', () => {
  for (const dropSets of [
    [{setIndex: 1, weight: 30, reps: 8}], [{setIndex: 0, weight: 40, reps: 8}],
    [{setIndex: 0, weight: 30, reps: 0}], [{setIndex: 0, weight: 30, reps: 8.5}],
    [exercise.dropSets[0], exercise.dropSets[0]],
  ]) assert.equal(exerciseSchema.safeParse({...exercise, dropSets}).success, false);
});

import { Workout, MuscleGroup, MUSCLE_GROUPS } from '../models/workout.model';
import { isWorkoutSession } from './workout-kind';
import { exerciseKey } from './workout-history';
import { localDateKey } from './weight-progress';

export interface ExercisePerformance {
  weight: number;
  reps: number;
  date: string;
  drop?: boolean;
}
export interface ExerciseRecord {
  key: string;
  name: string;
  timed: boolean;
  muscleGroup: MuscleGroup;
  initial: ExercisePerformance;
  bestWeight: ExercisePerformance;
  bestReps: ExercisePerformance;
  sessions: { date: string; workout: string; best: ExercisePerformance }[];
}

/** Rebuilt from performed history, so edits/deletions also update personal records. */
export function exerciseRecords(
  workouts: Workout[],
  today = localDateKey(new Date()),
  includeZero = false,
): ExerciseRecord[] {
  const records = new Map<string, ExerciseRecord>();
  const history = workouts
    .filter(
      (w) =>
        isWorkoutSession(w) && /^\d{4}-\d{2}-\d{2}/.test(w.date) && w.date.slice(0, 10) <= today,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime() ||
        (a.id ?? '').localeCompare(b.id ?? ''),
    );
  for (const workout of history) {
    const touched = new Map<string, ExercisePerformance[]>();
    for (const exercise of workout.exercises) {
      if (!exercise.exerciseName.trim() || !Number.isInteger(exercise.sets) || exercise.sets < 1)
        continue;
      const timed = exercise.repUnit === 'seconds';
      const key = exerciseKey(exercise.exerciseName) + (timed ? ':seconds' : ':reps');
      const pairs: ExercisePerformance[] = Array.from(
        { length: Math.min(50, exercise.sets) },
        (_, i) => ({
          weight: exercise.setWeights?.[i] ?? exercise.weight,
          reps: exercise.setReps?.[i] ?? exercise.reps,
          date: workout.date,
        }),
      ).filter(
        (p) =>
          Number.isFinite(p.weight) &&
          (includeZero ? p.weight >= 0 : p.weight > 0) &&
          p.weight <= 1000 &&
          Number.isInteger(p.reps) &&
          p.reps > 0 &&
          p.reps <= 500,
      );
      if (!pairs.length) continue;
      let record = records.get(key);
      if (!record) {
        record = {
          key,
          name: exercise.exerciseName.trim().replace(/\s+/g, ' '),
          timed,
          muscleGroup: MUSCLE_GROUPS.includes(exercise.muscleGroup)
            ? exercise.muscleGroup
            : 'Full Body',
          initial: pairs[0],
          bestWeight: pairs[0],
          bestReps: pairs[0],
          sessions: [],
        };
        records.set(key, record);
      }
      record.muscleGroup = MUSCLE_GROUPS.includes(exercise.muscleGroup)
        ? exercise.muscleGroup
        : record.muscleGroup;
      for (const drop of exercise.dropSets ?? []) {
        if (
          !timed &&
          Number.isInteger(drop.setIndex) &&
          drop.setIndex >= 0 &&
          drop.setIndex < exercise.sets &&
          Number.isFinite(drop.weight) &&
          (includeZero ? drop.weight >= 0 : drop.weight > 0) &&
          drop.weight < (exercise.setWeights?.[drop.setIndex] ?? exercise.weight) &&
          Number.isInteger(drop.reps) &&
          drop.reps > 0 &&
          drop.reps <= 500
        )
          pairs.push({ weight: drop.weight, reps: drop.reps, date: workout.date, drop: true });
      }
      for (const pair of pairs) {
        if (
          pair.weight > record.bestWeight.weight ||
          (pair.weight === record.bestWeight.weight && pair.reps > record.bestWeight.reps)
        )
          record.bestWeight = pair;
        if (
          pair.reps > record.bestReps.reps ||
          (pair.reps === record.bestReps.reps && pair.weight > record.bestReps.weight)
        )
          record.bestReps = pair;
      }
      touched.set(key, [...(touched.get(key) ?? []), ...pairs]);
    }
    for (const [key, pairs] of touched) {
      const record = records.get(key)!;
      const best = pairs.reduce((a, b) =>
        (
          record.timed
            ? b.reps > a.reps
            : b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)
        )
          ? b
          : a,
      );
      record.sessions.push({ date: workout.date, workout: workout.name, best });
    }
  }
  return [...records.values()].sort((a, b) => a.name.localeCompare(b.name));
}

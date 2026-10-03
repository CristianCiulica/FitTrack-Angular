import { MuscleGroup, MUSCLE_GROUPS } from '../models/workout.model';

export interface WorkoutDraft {
  version: 1;
  owner: string;
  clientId: string;
  date: string;
  routine: {
    id?: string;
    name: string;
    restSeconds?: number;
    exercises: {
      name: string;
      sets: number;
      reps: number;
      weight: number;
      muscleGroup: MuscleGroup;
      repUnit?: 'seconds';
    }[];
  };
  state: 'active' | 'rest' | 'review';
  exerciseIndex: number;
  setIndex: number;
  weights: (number | null)[][];
  reps: (number | null)[][];
  currentWeight: number;
  currentReps: number;
  startedAt: number;
  endedAt: number | null;
  restDeadline: number;
  restSeconds: number;
  holdElapsedMs: number;
}

const bounded = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
export function readWorkoutDraft(owner: string): WorkoutDraft | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(`fittrack_active_workout:${owner}`) ?? 'null',
    ) as WorkoutDraft;
    if (
      !value ||
      value.version !== 1 ||
      value.owner !== owner ||
      !/^w_[a-zA-Z0-9-]+$/.test(value.clientId) ||
      !['active', 'rest', 'review'].includes(value.state) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
      !value.routine?.name ||
      !Array.isArray(value.routine.exercises) ||
      value.routine.exercises.length < 1 ||
      value.routine.exercises.length > 50 ||
      !Number.isFinite(value.startedAt) ||
      value.startedAt <= 0 ||
      value.startedAt > Date.now() ||
      !bounded(value.currentWeight, 1000) ||
      !bounded(value.currentReps, 500) ||
      !bounded(value.holdElapsedMs, 500_000) ||
      !bounded(value.restSeconds, 900) ||
      value.restSeconds < 1 ||
      !Number.isFinite(value.restDeadline) ||
      (value.endedAt !== null &&
        (!Number.isFinite(value.endedAt) || value.endedAt < value.startedAt)) ||
      !Array.isArray(value.weights) ||
      !Array.isArray(value.reps) ||
      value.weights.length !== value.routine.exercises.length ||
      value.reps.length !== value.weights.length ||
      !Number.isInteger(value.exerciseIndex) ||
      value.exerciseIndex < 0 ||
      value.exerciseIndex >= value.routine.exercises.length ||
      !Number.isInteger(value.setIndex) ||
      value.setIndex < 1 ||
      value.setIndex > value.routine.exercises[value.exerciseIndex].sets
    )
      return null;
    for (let i = 0; i < value.routine.exercises.length; i++) {
      const exercise = value.routine.exercises[i];
      if (
        !exercise.name ||
        !MUSCLE_GROUPS.includes(exercise.muscleGroup) ||
        !Number.isInteger(exercise.sets) ||
        exercise.sets < 1 ||
        exercise.sets > 50 ||
        !bounded(exercise.reps, 500) ||
        !bounded(exercise.weight, 1000) ||
        (exercise.repUnit != null && exercise.repUnit !== 'seconds')
      )
        return null;
      for (const [rows, maximum] of [
        [value.weights, 1000],
        [value.reps, 500],
      ] as const) {
        if (
          !Array.isArray(rows[i]) ||
          rows[i].length !== exercise.sets ||
          !rows[i].every((number) => number === null || bounded(number, maximum))
        )
          return null;
      }
      if (
        value.weights[i].some((weight, set) => (weight === null) !== (value.reps[i][set] === null))
      )
        return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function writeWorkoutDraft(value: WorkoutDraft): boolean {
  try {
    localStorage.setItem(`fittrack_active_workout:${value.owner}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function clearWorkoutDraft(owner: string): void {
  try {
    localStorage.removeItem(`fittrack_active_workout:${owner}`);
  } catch {
    /* Optional storage. */
  }
}

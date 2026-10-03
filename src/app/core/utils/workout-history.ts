import { Workout } from '../models/workout.model';
export interface PreviousExercise { date: string; pairs: { weight: number; reps: number }[]; }
export const exerciseKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
export function previousExercises(workouts: Workout[], onDate: string): Map<string, PreviousExercise> {
  const result = new Map<string, PreviousExercise>();
  const sorted = [...workouts].filter(w => !w.isPredefined && w.date.slice(0,10) <= onDate)
    .sort((a,b) => b.date.localeCompare(a.date) || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  for (const workout of sorted) for (const exercise of workout.exercises) {
    const key = exerciseKey(exercise.exerciseName);
    if (result.has(key) || !exercise.sets) continue;
    const count = Math.min(exercise.sets, 50);
    const pairs = Array.from({length: count}, (_, i) => ({
      weight: exercise.setWeights?.[i] ?? exercise.weight,
      reps: exercise.setReps?.[i] ?? exercise.reps,
    })).filter(pair => Number.isFinite(pair.weight) && Number.isFinite(pair.reps) && pair.weight >= 0 && pair.reps >= 0);
    if (pairs.length) result.set(key, {date: workout.date, pairs});
  }
  return result;
}
export function workoutVolume(workout: Workout): number {
  return workout.exercises.reduce((sum, ex) => sum + Array.from({length: ex.repUnit === 'seconds' ? 0 : ex.sets}, (_,i) =>
    (ex.setWeights?.[i] ?? ex.weight) * (ex.setReps?.[i] ?? ex.reps)).reduce((a,b) => a+b,0),0);
}
export function durationLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

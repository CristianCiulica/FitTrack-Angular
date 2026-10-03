import { Workout } from '../models/workout.model';

export const isWorkoutSession = (workout: Workout): boolean =>
  workout.kind !== 'routine' && !workout.isPredefined;

/** Retain legacy personal plans once each, without turning new sessions into plans. */
export function personalWorkoutPlans(workouts: Workout[]): Workout[] {
  const plans = new Map<string, Workout>();
  const candidates = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  for (const workout of candidates.filter((item) => item.kind === 'routine')) {
    plans.set(workout.id ?? workout.name.trim().toLowerCase(), workout);
  }
  for (const workout of candidates.filter((item) => item.kind == null && !item.isPredefined)) {
    const key = workout.name.trim().toLowerCase();
    if (![...plans.values()].some((plan) => plan.name.trim().toLowerCase() === key))
      plans.set(key, workout);
  }
  return [...plans.values()];
}

import { UserProfile } from '../models/user-profile.model';

export function activityFactor(days: number): number {
  if (days <= 0) return 1.2;
  if (days <= 2) return 1.375;
  if (days <= 4) return 1.55;
  if (days <= 6) return 1.725;
  return 1.9;
}

export function calorieTarget(
  basal: number,
  maintenance: number,
  goal: UserProfile['goal'],
  adjustment: number,
): number {
  if (goal === 'maintain') return maintenance;
  return Math.max(basal, maintenance + (goal === 'lose' ? -adjustment : adjustment));
}

export function profileCalorieTarget(profile: UserProfile): number {
  const basal = Math.round(
    10 * (profile.weightKg ?? 70) +
      6.25 * (profile.heightCm ?? 170) -
      5 * (profile.age ?? 30) +
      (profile.sex === 'female' ? -161 : 5),
  );
  const maintenance = Math.round(
    basal *
      activityFactor(profile.strengthTrainingDays ?? Math.min(7, profile.weeklyWorkoutGoal ?? 4)),
  );
  return (
    profile.nutritionCalorieOverride ??
    calorieTarget(
      basal,
      maintenance,
      profile.goal ?? 'maintain',
      Math.round(((profile.goalRate ?? 0.5) * 7700) / 7),
    )
  );
}

import {
  Food,
  FoodEntry,
  NutritionRecord,
  Nutrients,
  Portion,
  Recipe,
  nutrientKeys,
} from '../../core/models/nutrition.model';
import { UserProfile } from '../../core/models/user-profile.model';
import { WeightEntry } from '../../core/models/weight-entry.model';

export const emptyNutrients = (): Nutrients => ({
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
});
export const barcodePattern = /^(?:\d{8}|\d{12,14})$/;

export function portionNutrients({ food, amount }: Portion): Nutrients {
  const result = emptyNutrients();
  for (const key of nutrientKeys) {
    const value = food.values[key];
    result[key] = value === null ? null : (value * amount) / (food.basis === 'serving' ? 1 : 100);
  }
  return result;
}

export function summarize(items: Portion[]) {
  const values: Record<keyof Nutrients, number> = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const incomplete = { kcal: false, protein: false, carbs: false, fat: false };
  for (const item of items) {
    const nutrients = portionNutrients(item);
    for (const key of nutrientKeys) {
      const value = nutrients[key];
      if (value === null) incomplete[key] = true;
      else values[key] += value;
    }
  }
  return { values, incomplete };
}

export function recipeFood(recipe: Recipe, byWeight: boolean): Food {
  const totals = summarize(recipe.ingredients);
  const divisor = byWeight && recipe.cookedGrams ? recipe.cookedGrams / 100 : recipe.servings;
  const values = emptyNutrients();
  for (const key of nutrientKeys) {
    values[key] = totals.incomplete[key] ? null : totals.values[key] / divisor;
  }
  return {
    name: recipe.name,
    origin: 'recipe',
    basis: byWeight && recipe.cookedGrams ? 'g' : 'serving',
    values,
  };
}

export function moveDate(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export function weeklyNutrition(records: NutritionRecord[], end: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = moveDate(end, index - 6);
    const entries = records.filter(
      (row): row is FoodEntry => row.kind === 'entry' && row.date === date,
    );
    const complete = records.some((row) => row.kind === 'complete' && row.date === date);
    return { date, count: entries.length, complete, ...summarize(entries) };
  });
}

// Use two seven-day weight averages and only 21 contiguous, explicitly completed food days.
export function suggestTarget(
  records: NutritionRecord[],
  weights: WeightEntry[],
  today: string,
  profile: UserProfile,
  current: number,
): number | null {
  const days = [0, 7, 14].flatMap((offset) =>
    weeklyNutrition(records, moveDate(today, -1 - offset)),
  );
  if (days.some((day) => !day.complete || !day.count || day.incomplete.kcal)) return null;
  const recent = weights.filter((row) => row.date >= moveDate(today, -7) && row.date < today);
  const early = weights.filter(
    (row) => row.date >= moveDate(today, -21) && row.date < moveDate(today, -14),
  );
  if (early.length < 4 || recent.length < 4) return null;
  const mean = (rows: WeightEntry[]) =>
    rows.reduce((sum, row) => sum + row.weightKg, 0) / rows.length;
  const intake = days.reduce((sum, day) => sum + day.values.kcal, 0) / days.length;
  const weekChange =
    profile.goal === 'lose' ? -profile.goalRate : profile.goal === 'gain' ? profile.goalRate : 0;
  const maintenance = intake - ((mean(recent) - mean(early)) * 7700) / 14;
  const desired = Math.round((maintenance + (weekChange * 7700) / 7) / 25) * 25;
  const basal = Math.round(
    10 * (profile.weightKg ?? 70) +
      6.25 * (profile.heightCm ?? 170) -
      5 * (profile.age ?? 30) +
      (profile.sex === 'female' ? -161 : 5),
  );
  const target = Math.min(10_000, Math.max(basal, current - 100, Math.min(current + 100, desired)));
  return Number.isFinite(target) &&
    Math.abs(target - current) >= 50 &&
    Math.abs(target - current) <= 100
    ? target
    : null;
}

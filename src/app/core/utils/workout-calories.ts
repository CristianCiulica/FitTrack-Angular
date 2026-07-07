// Estimare de calorii pentru antrenamentele de forta, pe baza volumului de seturi
// si a greutatii corporale (MET ~5 pentru antrenament moderat cu greutati).

const MET_STRENGTH = 5;
const MINUTES_PER_SET = 2.2; // lucru + pauza
const DEFAULT_BODY_WEIGHT_KG = 75;

export function estimateSessionCalories(
  exercises: Array<{ sets: number }> | undefined | null,
  bodyWeightKg?: number | null,
): number {
  const totalSets = exercises?.reduce((acc, e) => acc + (e.sets || 0), 0) ?? 0;
  if (totalSets <= 0) return 0;

  const kg = bodyWeightKg && bodyWeightKg > 0 ? bodyWeightKg : DEFAULT_BODY_WEIGHT_KG;
  const minutes = totalSets * MINUTES_PER_SET;
  const kcalPerMinute = (MET_STRENGTH * 3.5 * kg) / 200;
  return Math.round(kcalPerMinute * minutes);
}

export function estimateSessionMinutes(
  exercises: Array<{ sets: number }> | undefined | null,
): number {
  const totalSets = exercises?.reduce((acc, e) => acc + (e.sets || 0), 0) ?? 0;
  return Math.round(totalSets * MINUTES_PER_SET);
}

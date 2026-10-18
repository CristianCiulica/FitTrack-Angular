import { WeightEntry } from '../models/weight-entry.model';
import { Units } from '../models/user-profile.model';
import { displayWeight } from './units';
import { localDateKey } from './weight-progress';

export function weightJourney(
  entries: WeightEntry[],
  currentKg: number | null | undefined,
  units: Units,
  today = new Date(),
) {
  const todayKey = localDateKey(today);
  const history = entries
    .filter(
      (entry) =>
        /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
        entry.date <= todayKey &&
        Number.isFinite(entry.weightKg) &&
        entry.weightKg > 0 &&
        localDateKey(new Date(`${entry.date}T12:00:00`)) === entry.date,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = history[0];
  const current = currentKg ?? history.at(-1)?.weightKg;
  return {
    start: first ? displayWeight(first.weightKg, units) : null,
    current:
      current != null && Number.isFinite(current) && current > 0
        ? displayWeight(current, units)
        : null,
    startedOn: first?.date ?? null,
    elapsedDays: first
      ? Math.floor(
          (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) /
            86_400_000,
        )
      : null,
  };
}

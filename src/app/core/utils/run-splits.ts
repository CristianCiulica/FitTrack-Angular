import type { RunningSession } from '../models/running-session.model';

type SplitSession = Pick<RunningSession, 'distanceMeters' | 'durationSeconds' | 'kilometreTimes'>;

/** Interpolate crossings between two accepted GPS fixes on the active-time clock. */
export function recordKilometres(times: number[], from: number, to: number, start: number, end: number): void {
  for (let mark = (times.length + 1) * 1000; mark <= to; mark += 1000) {
    times.push(start + (end - start) * ((mark - from) / (to - from)));
  }
}

export function validKilometreTimes(session: SplitSession): boolean {
  const times = session.kilometreTimes;
  return Array.isArray(times) && times.length === Math.floor(session.distanceMeters / 1000) &&
    times.every((t, i) => Number.isFinite(t) && t > (times[i - 1] ?? 0) && t < session.durationSeconds + 1);
}

export function runSplits(session: SplitSession) {
  const times = session.kilometreTimes;
  if (!times || !validKilometreTimes(session)) return [];
  const rows = times.map((end, index) => ({
    metres: 1000, seconds: Math.floor(end) - Math.floor(times[index - 1] ?? 0),
  }));
  const remainder = session.distanceMeters - times.length * 1000;
  if (remainder > 0) {
    rows.push({ metres: remainder, seconds: Math.max(0, session.durationSeconds - Math.floor(times.at(-1) ?? 0)) });
  }
  return rows;
}

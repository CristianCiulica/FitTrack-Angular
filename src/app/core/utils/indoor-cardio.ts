import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';
import { ProgramSessionContext } from '../models/workout-routine.model';
import { validProgramContext } from './program-records';
import { localDateKey } from './weight-progress';

const PREFIX = 'FitTrack Indoor Cardio · ';
export interface IndoorCardioRecord {
  version: 1;
  mode: 'walking' | 'running';
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  inclinePercent: number | null;
  steps: number | null;
  calories: number | null;
  program?: ProgramSessionContext;
}
export function validIndoorCardio(value: unknown): value is IndoorCardioRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as IndoorCardioRecord;
  const duration = (Date.parse(r.endedAt) - Date.parse(r.startedAt)) / 1000;
  const optional = (v: unknown, min: number, max: number) =>
    v === null || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max);
  return (
    r.version === 1 &&
    ['walking', 'running'].includes(r.mode) &&
    Number.isFinite(duration) &&
    duration >= 60 &&
    duration <= 14400 &&
    Number.isFinite(r.distanceMeters) &&
    r.distanceMeters > 0 &&
    r.distanceMeters <= 100000 &&
    r.distanceMeters / duration <= 15 &&
    optional(r.inclinePercent, 0, 25) &&
    optional(r.steps, 0, 100000) &&
    (r.steps === null || Number.isInteger(r.steps)) &&
    optional(r.calories, 0, 5000) &&
    (r.program === undefined || validProgramContext(r.program))
  );
}
export function indoorCardio(workout: Pick<Workout, 'kind' | 'notes'>): IndoorCardioRecord | null {
  if (workout.kind !== 'session' || !workout.notes?.startsWith(PREFIX)) return null;
  try {
    const r = JSON.parse(workout.notes.slice(PREFIX.length));
    return validIndoorCardio(r) ? r : null;
  } catch {
    return null;
  }
}
export function indoorCardioWorkout(
  record: IndoorCardioRecord,
  userId: string,
  clientId: string,
): Omit<Workout, 'id'> {
  if (!validIndoorCardio(record))
    throw new Error('Check the duration, distance and optional treadmill readings.');
  return {
    kind: 'session',
    clientId,
    userId,
    name: record.mode === 'running' ? 'Treadmill run' : 'Treadmill walk',
    date: localDateKey(new Date(record.startedAt)),
    durationSeconds: Math.round((Date.parse(record.endedAt) - Date.parse(record.startedAt)) / 1000),
    notes: PREFIX + JSON.stringify(record),
    exercises: [],
    isPredefined: false,
  };
}
export type CardioHistorySession = RunningSession & { indoor?: IndoorCardioRecord };
export function indoorHistorySession(workout: Workout): CardioHistorySession | null {
  const r = indoorCardio(workout);
  if (!r || !workout.id) return null;
  const durationSeconds = Math.round((Date.parse(r.endedAt) - Date.parse(r.startedAt)) / 1000);
  return {
    id: 'indoor:' + workout.id,
    userId: workout.userId,
    clientId: workout.clientId,
    mode: r.mode,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationSeconds,
    distanceMeters: r.distanceMeters,
    averageSpeedKmh: r.distanceMeters / 1000 / (durationSeconds / 3600),
    steps: r.steps ?? 0,
    calories: r.calories ?? 0,
    route: [],
    indoor: r,
  };
}

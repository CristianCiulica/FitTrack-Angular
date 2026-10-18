import { Workout } from '../models/workout.model';
import { ProgramSessionContext, validProgramContext } from '../models/workout-routine.model';

const PREFIX = 'FitTrack Timed Session · ';
export interface TreadmillLog {
  exerciseIndex: number;
  seconds: number;
  targetSeconds: number;
  weightKg: number;
}
export interface TimedSession {
  version: 1;
  program?: ProgramSessionContext;
  completed: boolean;
  treadmill: TreadmillLog[];
}
function validLog(log: TreadmillLog): boolean {
  return (
    Number.isInteger(log.exerciseIndex) &&
    log.exerciseIndex >= 0 &&
    log.exerciseIndex < 50 &&
    Number.isInteger(log.seconds) &&
    log.seconds >= 1 &&
    log.seconds <= 7200 &&
    Number.isInteger(log.targetSeconds) &&
    log.targetSeconds >= 60 &&
    log.targetSeconds <= 7200 &&
    log.seconds <= log.targetSeconds &&
    Number.isFinite(log.weightKg) &&
    log.weightKg >= 30 &&
    log.weightKg <= 300
  );
}
/** 3.5 MET assumes level walking at 4.0–4.7 km/h; no speed, incline or distance is measured.
 * Source: https://pacompendium.com/walking/ (2024 Adult Compendium, code 17352).
 * Gross energy estimate includes resting metabolism. */
export function estimateTreadmillCalories(seconds: number, weightKg: number): number {
  return Math.round(
    (((3.5 * 3.5 * Math.min(300, Math.max(30, weightKg || 75))) / 200) * Math.max(0, seconds)) / 60,
  );
}
export function timedSessionNotes(value: TimedSession): string {
  if (
    value.version !== 1 ||
    typeof value.completed !== 'boolean' ||
    (value.program && !validProgramContext(value.program)) ||
    value.treadmill.length > 50 ||
    !value.treadmill.every(validLog) ||
    new Set(value.treadmill.map((t) => t.exerciseIndex)).size !== value.treadmill.length
  )
    throw new Error('Invalid timed workout.');
  const notes =
    PREFIX +
    JSON.stringify({
      v: 1,
      c: value.completed,
      ...(value.program ? { p: value.program } : {}),
      t: value.treadmill.map((t) => [t.exerciseIndex, t.seconds, t.targetSeconds, t.weightKg]),
    });
  if (notes.length > 2000) throw new Error('Timed workout is too large to save.');
  return notes;
}
export function timedSession(workout: Pick<Workout, 'kind' | 'notes'>): TimedSession | null {
  if (workout.kind !== 'session' || !workout.notes?.startsWith(PREFIX)) return null;
  try {
    const value = JSON.parse(workout.notes.slice(PREFIX.length));
    if (
      !value ||
      value.v !== 1 ||
      typeof value.c !== 'boolean' ||
      (value.p !== undefined && !validProgramContext(value.p)) ||
      !Array.isArray(value.t) ||
      value.t.length > 50
    )
      return null;
    const treadmill: TreadmillLog[] = value.t.map((t: unknown) => {
      if (!Array.isArray(t) || t.length !== 4) throw new Error('Invalid timed entry.');
      return { exerciseIndex: t[0], seconds: t[1], targetSeconds: t[2], weightKg: t[3] };
    });
    if (
      !treadmill.every(validLog) ||
      new Set(treadmill.map((t) => t.exerciseIndex)).size !== treadmill.length
    )
      return null;
    return { version: 1, completed: value.c, ...(value.p ? { program: value.p } : {}), treadmill };
  } catch {
    return null;
  }
}
export function treadmillSeconds(workout: Pick<Workout, 'kind' | 'notes'>): number {
  return timedSession(workout)?.treadmill.reduce((sum, t) => sum + t.seconds, 0) ?? 0;
}
export function treadmillCalories(workout: Pick<Workout, 'kind' | 'notes'>): number {
  return (
    timedSession(workout)?.treadmill.reduce(
      (sum, t) => sum + estimateTreadmillCalories(t.seconds, t.weightKg),
      0,
    ) ?? 0
  );
}
export function isTimedCardioOnly(workout: Workout): boolean {
  return workout.exercises.length === 0 && treadmillSeconds(workout) > 0;
}

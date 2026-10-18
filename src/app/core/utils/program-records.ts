import { Workout } from '../models/workout.model';
import { ProgramSessionContext, validProgramContext } from '../models/workout-routine.model';
import { timedSession } from './timed-cardio';
export { validProgramContext } from '../models/workout-routine.model';
import { localDateKey } from './weight-progress';

export const PROGRAM_ENROLLMENT_PREFIX = 'FitTrack Program · ';
const SESSION_PREFIX = 'FitTrack Program Session · ';
export interface ProgramEnrollment {
  version: 1;
  id: string;
  programId: string;
  startDate: string;
  createdAt: string;
  stoppedAt?: string;
}
export interface ProgramSessionLog extends ProgramSessionContext {
  version: 1;
  completed: boolean;
}
const slug = (value: unknown) => typeof value === 'string' && /^[a-z0-9-]{1,60}$/.test(value);
export function validDayKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  );
}
export function readProgramEnrollment(
  workout: Pick<Workout, 'kind' | 'notes'>,
): ProgramEnrollment | null {
  if (workout.kind !== 'routine' || !workout.notes?.startsWith(PROGRAM_ENROLLMENT_PREFIX))
    return null;
  try {
    const m = JSON.parse(
      workout.notes.slice(PROGRAM_ENROLLMENT_PREFIX.length),
    ) as ProgramEnrollment;
    return m.version === 1 &&
      /^pg_[a-zA-Z0-9-]{1,80}$/.test(m.id) &&
      slug(m.programId) &&
      validDayKey(m.startDate) &&
      Number.isFinite(Date.parse(m.createdAt)) &&
      (m.stoppedAt === undefined ||
        (typeof m.stoppedAt === 'string' && Number.isFinite(Date.parse(m.stoppedAt))))
      ? m
      : null;
  } catch {
    return null;
  }
}
export function enrollmentWorkout(
  enrollment: ProgramEnrollment,
  title: string,
  userId: string,
): Omit<Workout, 'id'> {
  return {
    kind: 'routine',
    clientId: enrollment.id,
    userId,
    name: 'Program · ' + title,
    date: enrollment.startDate,
    notes: PROGRAM_ENROLLMENT_PREFIX + JSON.stringify(enrollment),
    isPredefined: false,
    exercises: [],
  };
}
export function programSessionNotes(context: ProgramSessionContext, completed: boolean): string {
  if (!validProgramContext(context)) throw new Error('Invalid program day.');
  return SESSION_PREFIX + JSON.stringify({ version: 1, ...context, completed });
}
export function readProgramSession(
  workout: Pick<Workout, 'kind' | 'notes'>,
): ProgramSessionLog | null {
  const timed = timedSession(workout);
  if (timed?.program) return { version: 1, ...timed.program, completed: timed.completed };
  if (workout.kind !== 'session' || !workout.notes?.startsWith(SESSION_PREFIX)) return null;
  try {
    const m: unknown = JSON.parse(workout.notes.slice(SESSION_PREFIX.length));
    if (!validProgramContext(m)) return null;
    const log = m as ProgramSessionLog;
    return log.version === 1 && typeof log.completed === 'boolean' ? log : null;
  } catch {
    return null;
  }
}
export function offsetDay(startDate: string, offset: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + offset));
}
export function programDayIndex(startDate: string, date: string): number {
  return Math.round(
    (Date.parse(date + 'T12:00:00Z') - Date.parse(startDate + 'T12:00:00Z')) / 86400000,
  );
}

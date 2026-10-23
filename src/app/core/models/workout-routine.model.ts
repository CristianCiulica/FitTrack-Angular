import { MuscleGroup } from './workout.model';

export interface ProgramSessionContext {
  schedule?: 'sessions';
  enrollmentId: string;
  programId: string;
  dayIndex: number;
  sessionId: string;
}
export interface PlannedExercise {
  name: string;
  sets: number;
  reps: number;
  repUnit?: 'seconds';
  repRange?: string;
  restSeconds?: number;
  rir?: number;
  cue?: string;
  compound?: boolean;
  activity?: 'treadmill';
  durationMinutes?: number;
  weight: number;
  muscleGroup: MuscleGroup;
}
export interface WorkoutRoutine {
  id?: string;
  clientId?: string;
  name: string;
  category?: string;
  description?: string;
  restSeconds?: number;
  program?: ProgramSessionContext;
  exercises: PlannedExercise[];
}
export function isTreadmillExercise(exercise: { name: string; activity?: string }): boolean {
  return exercise.activity === 'treadmill' || /\btreadmill\b/i.test(exercise.name);
}

export function validProgramContext(value: unknown): value is ProgramSessionContext {
  if (!value || typeof value !== 'object') return false;
  const c = value as ProgramSessionContext;
  return (
    (c.schedule === undefined || c.schedule === 'sessions') &&
    typeof c.enrollmentId === 'string' &&
    /^pg_[a-zA-Z0-9-]{1,80}$/.test(c.enrollmentId) &&
    typeof c.programId === 'string' &&
    /^[a-z0-9-]{1,60}$/.test(c.programId) &&
    typeof c.sessionId === 'string' &&
    /^[a-z0-9-]{1,60}$/.test(c.sessionId) &&
    Number.isInteger(c.dayIndex) &&
    c.dayIndex >= 0 &&
    c.dayIndex < 30
  );
}

export function isCompoundExercise(
  exercise: Pick<PlannedExercise, 'name' | 'compound' | 'repUnit'>,
): boolean {
  if (exercise.compound !== undefined) return exercise.compound;
  if (exercise.repUnit === 'seconds' || /calf|straight[ -]?arm/i.test(exercise.name)) return false;
  return /\b(?:press(?:es)?|squats?|deadlifts?|pull[ -]?(?:ups?|downs?)|rows?|dips?|lunges?|push[ -]?ups?|step[ -]?ups?|hip[ -]?thrusts?|rack[ -]?pulls?)\b/i.test(
    exercise.name,
  );
}
export function orderRoutineExercises<
  T extends Pick<PlannedExercise, 'name' | 'compound' | 'repUnit' | 'activity'>,
>(exercises: T[]): T[] {
  const rank = (e: T) => (isTreadmillExercise(e) ? 2 : isCompoundExercise(e) ? 0 : 1);
  return [...exercises].sort((a, b) => rank(a) - rank(b));
}

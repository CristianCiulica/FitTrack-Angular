import { MuscleGroup } from './workout.model';

export interface ProgramSessionContext {
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
  T extends Pick<PlannedExercise, 'name' | 'compound' | 'repUnit'>,
>(exercises: T[]): T[] {
  return [...exercises].sort(
    (a, b) => Number(isCompoundExercise(b)) - Number(isCompoundExercise(a)),
  );
}

export interface ExerciseLog {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: number;
  reps: number;
  /** Timed holds store seconds in reps/setReps; omitted for repetition counts. */
  repUnit?: 'seconds';
  weight: number;
  /** Greutatea folosita efectiv la fiecare set (progressive overload). */
  setWeights?: number[];
  /** Repetarile facute efectiv la fiecare set (progressive overload). */
  setReps?: number[];
}

export interface Workout {
  id?: string;
  clientId?: string;
  /** Older records without kind remain historical sessions. */
  kind?: 'routine' | 'session';
  /** Local outbox metadata, never persisted by the API. */
  pendingUpdate?: boolean;
  userId: string;
  name: string;
  date: string;
  exercises: ExerciseLog[];
  durationSeconds?: number;
  notes?: string;
  createdAt?: Date;
  isPredefined?: boolean;
}

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'Cardio'
  | 'Full Body';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Full Body',
];

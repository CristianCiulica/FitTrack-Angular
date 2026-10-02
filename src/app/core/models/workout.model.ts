export interface ExerciseLog {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: number;
  reps: number;
  weight: number;
  /** Greutatea folosita efectiv la fiecare set (progressive overload). */
  setWeights?: number[];
  /** Repetarile facute efectiv la fiecare set (progressive overload). */
  setReps?: number[];
}

export interface Workout {
  id?: string;
  userId: string;
  name: string;
  date: string;
  exercises: ExerciseLog[];
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

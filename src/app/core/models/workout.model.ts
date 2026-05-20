export interface ExerciseLog {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: number;
  reps: number;
  weight: number;
}

export interface Workout {
  id?: string;
  userId: string;
  name: string;
  date: string;
  exercises: ExerciseLog[];
  notes?: string;
  createdAt?: Date;
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

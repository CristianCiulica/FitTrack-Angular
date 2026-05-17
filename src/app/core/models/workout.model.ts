export interface Workout {
  id?: string;
  userId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: number;
  reps: number;
  weight: number;
  date: string;
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

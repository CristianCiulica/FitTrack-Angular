export interface ExerciseLog {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: number;
  reps: number;
  weight: number;
  /** Greutatea folosita efectiv la fiecare set (progressive overload). */
  setWeights?: number[];
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

export interface CommunityComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface CommunityWorkout {
  id: string;
  originalWorkoutId?: string;
  authorId: string;
  authorName: string;
  name: string;
  description: string;
  exercises: ExerciseLog[];
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  saveCount: number;
  comments: CommunityComment[];
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

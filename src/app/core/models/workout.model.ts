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

export interface CommunityComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export type CommunityDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface CommunityWorkout {
  id: string;
  originalWorkoutId?: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorFollowedByMe: boolean;
  name: string;
  description: string;
  exercises: ExerciseLog[];
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  saveCount: number;
  estimatedMinutes: number;
  difficulty: CommunityDifficulty;
  comments: CommunityComment[];
}

export interface CommunityAuthor {
  uid: string;
  name: string;
  avatar: string;
  postCount: number;
  totalLikes: number;
  totalSaves: number;
  followers: number;
  followedByMe: boolean;
}

/** o persoana din listele de followers/following */
export interface CommunityPerson {
  uid: string;
  name: string;
  avatar: string;
  followedByMe: boolean;
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

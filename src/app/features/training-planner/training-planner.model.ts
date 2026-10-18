import { MuscleGroup } from '../../core/models/workout.model';

export type TrainingGoal = 'muscle' | 'strength' | 'recomp';
export type TrainingExperience = 'new' | 'consistent' | 'experienced';
export type TrainingEquipment =
  | 'dumbbells'
  | 'bench'
  | 'barbell'
  | 'machines'
  | 'cables'
  | 'bands'
  | 'pullup';
export type TrainingFocus = 'balanced' | 'upper' | 'lower' | 'arms';
export type TrainingReadiness = 'ready' | 'returning' | 'restricted';
export type TrainingMuscle =
  | 'Chest'
  | 'Back'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Side delts'
  | 'Rear delts'
  | 'Biceps'
  | 'Triceps'
  | 'Calves'
  | 'Abs';
export type TrainingPattern =
  | 'press'
  | 'incline'
  | 'row'
  | 'pull'
  | 'squat'
  | 'hinge'
  | 'curl-leg'
  | 'lateral'
  | 'rear'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'core';

export interface TrainingPreferences {
  goal: TrainingGoal;
  experience: TrainingExperience;
  equipment: TrainingEquipment[];
  /** Monday = 0, Sunday = 6. */
  days: number[];
  minutes: 30 | 45 | 60 | 75;
  focus: TrainingFocus;
  readiness: TrainingReadiness;
}
export interface TrainingMovement {
  id: string;
  name: string;
  pattern: TrainingPattern;
  primary: TrainingMuscle;
  secondary: TrainingMuscle[];
  muscleGroup: MuscleGroup;
  equipment: TrainingEquipment[];
  compound: boolean;
  unilateral?: boolean;
  cue: string;
}
export interface TrainingExercise {
  movement: TrainingMovement;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  rir: number;
}
export interface TrainingDay {
  index: number;
  weekday: number;
  name: string;
  emphasis: string;
  exercises: TrainingExercise[];
  estimatedMinutes: number;
}
export interface TrainingPlan {
  id: string;
  createdAt: string;
  preferences: TrainingPreferences;
  split: string;
  rationale: string;
  days: TrainingDay[];
  notes: string[];
}
export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export const EQUIPMENT_OPTIONS: { value: TrainingEquipment; label: string; detail: string }[] = [
  { value: 'dumbbells', label: 'Dumbbells', detail: 'Adjustable or a selection of weights' },
  { value: 'bench', label: 'Adjustable bench', detail: 'A stable flat / incline bench' },
  { value: 'barbell', label: 'Barbell & rack', detail: 'Plates, rack and safety arms' },
  {
    value: 'machines',
    label: 'Gym machines',
    detail: 'Chest press, leg press, leg curl & pulldown',
  },
  { value: 'cables', label: 'Cable station', detail: 'Adjustable pulleys and handles' },
  { value: 'bands', label: 'Resistance bands', detail: 'With a secure, rated anchor' },
  { value: 'pullup', label: 'Pull-up bar', detail: 'Securely mounted; assistance if needed' },
];
export const GOAL_LABELS: Record<TrainingGoal, string> = {
  muscle: 'Build muscle',
  strength: 'Get stronger',
  recomp: 'Build & maintain muscle',
};
export const EXPERIENCE_LABELS: Record<TrainingExperience, string> = {
  new: 'Building my foundation',
  consistent: 'Training consistently',
  experienced: 'Experienced lifter',
};
export const FOCUS_LABELS: Record<TrainingFocus, string> = {
  balanced: 'Balanced development',
  upper: 'Chest & back',
  lower: 'Legs & glutes',
  arms: 'Shoulders & arms',
};

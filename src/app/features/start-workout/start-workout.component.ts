import { Component, HostListener, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth.service';
import { WorkoutService } from '../../core/services/workout.service';
import { ProfileService } from '../../core/services/profile.service';
import { MuscleGroup, Workout } from '../../core/models/workout.model';
import { estimateSessionCalories, estimateSessionMinutes } from '../../core/utils/workout-calories';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { CommunityComponent } from '../community/community.component';

interface PlannedExercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  muscleGroup: MuscleGroup;
}

interface Routine {
  id?: string;
  name: string;
  category?: string;
  exercises: PlannedExercise[];
}

const PREDEFINED_ROUTINES: Routine[] = [
  {
    name: 'Push Day (Chest, Shoulders, Triceps)',
    category: 'Push',
    exercises: [
      { name: 'Bench Press', sets: 4, reps: 10, weight: 60, muscleGroup: 'Chest' },
      { name: 'Overhead Press', sets: 3, reps: 10, weight: 40, muscleGroup: 'Shoulders' },
      { name: 'Tricep Pushdowns', sets: 3, reps: 12, weight: 20, muscleGroup: 'Arms' },
    ]
  },
  {
    name: 'Pull Day (Back, Biceps)',
    category: 'Pull',
    exercises: [
      { name: 'Pull-ups', sets: 4, reps: 8, weight: 0, muscleGroup: 'Back' },
      { name: 'Barbell Rows', sets: 4, reps: 10, weight: 50, muscleGroup: 'Back' },
      { name: 'Bicep Curls', sets: 3, reps: 12, weight: 15, muscleGroup: 'Arms' },
    ]
  },
  {
    name: 'Leg Day',
    category: 'Legs',
    exercises: [
      { name: 'Squats', sets: 4, reps: 8, weight: 80, muscleGroup: 'Legs' },
      { name: 'Leg Press', sets: 3, reps: 12, weight: 120, muscleGroup: 'Legs' },
      { name: 'Calf Raises', sets: 4, reps: 15, weight: 60, muscleGroup: 'Legs' },
    ]
  },
  {
    name: 'Full Body Strength',
    category: 'Full body',
    exercises: [
      { name: 'Back Squats', sets: 4, reps: 6, weight: 80, muscleGroup: 'Legs' },
      { name: 'Bench Press', sets: 4, reps: 8, weight: 60, muscleGroup: 'Chest' },
      { name: 'Barbell Rows', sets: 4, reps: 8, weight: 50, muscleGroup: 'Back' },
      { name: 'Romanian Deadlifts', sets: 3, reps: 10, weight: 70, muscleGroup: 'Legs' },
    ]
  },
  {
    name: 'Upper Body Power',
    category: 'Push',
    exercises: [
      { name: 'Incline Bench Press', sets: 4, reps: 8, weight: 50, muscleGroup: 'Chest' },
      { name: 'Pull-ups', sets: 4, reps: 8, weight: 0, muscleGroup: 'Back' },
      { name: 'Shoulder Press', sets: 3, reps: 10, weight: 32.5, muscleGroup: 'Shoulders' },
      { name: 'Hammer Curls', sets: 3, reps: 12, weight: 14, muscleGroup: 'Arms' },
    ]
  },
  {
    name: 'Lower Body & Glutes',
    category: 'Legs',
    exercises: [
      { name: 'Hip Thrusts', sets: 4, reps: 10, weight: 80, muscleGroup: 'Legs' },
      { name: 'Bulgarian Split Squats', sets: 3, reps: 10, weight: 20, muscleGroup: 'Legs' },
      { name: 'Romanian Deadlifts', sets: 4, reps: 8, weight: 70, muscleGroup: 'Legs' },
      { name: 'Leg Curls', sets: 3, reps: 12, weight: 35, muscleGroup: 'Legs' },
    ]
  },
  {
    name: 'Core & Conditioning',
    category: 'Core',
    exercises: [
      { name: 'Weighted Crunches', sets: 3, reps: 15, weight: 10, muscleGroup: 'Core' },
      { name: 'Hanging Leg Raises', sets: 3, reps: 12, weight: 0, muscleGroup: 'Core' },
      { name: 'Plank', sets: 3, reps: 1, weight: 0, muscleGroup: 'Core' },
      { name: 'Mountain Climbers', sets: 4, reps: 30, weight: 0, muscleGroup: 'Cardio' },
    ]
  },
  {
    name: 'HIIT Fat Burner',
    category: 'Cardio',
    exercises: [
      { name: 'Burpees', sets: 4, reps: 15, weight: 0, muscleGroup: 'Cardio' },
      { name: 'Jump Squats', sets: 4, reps: 15, weight: 0, muscleGroup: 'Legs' },
      { name: 'Mountain Climbers', sets: 4, reps: 40, weight: 0, muscleGroup: 'Cardio' },
      { name: 'Kettlebell Swings', sets: 4, reps: 20, weight: 16, muscleGroup: 'Full Body' },
    ]
  },
  {
    name: 'Steady Cardio & Core',
    category: 'Cardio',
    exercises: [
      { name: 'Jumping Jacks', sets: 4, reps: 40, weight: 0, muscleGroup: 'Cardio' },
      { name: 'High Knees', sets: 4, reps: 30, weight: 0, muscleGroup: 'Cardio' },
      { name: 'Russian Twists', sets: 3, reps: 24, weight: 8, muscleGroup: 'Core' },
      { name: 'Plank', sets: 3, reps: 1, weight: 0, muscleGroup: 'Core' },
    ]
  },
  {
    name: 'Back & Biceps Builder',
    category: 'Pull',
    exercises: [
      { name: 'Deadlifts', sets: 4, reps: 6, weight: 90, muscleGroup: 'Back' },
      { name: 'Lat Pulldown', sets: 4, reps: 10, weight: 50, muscleGroup: 'Back' },
      { name: 'Seated Cable Rows', sets: 3, reps: 12, weight: 45, muscleGroup: 'Back' },
      { name: 'Hammer Curls', sets: 3, reps: 12, weight: 14, muscleGroup: 'Arms' },
    ]
  },
  {
    name: 'Glutes & Hamstrings',
    category: 'Legs',
    exercises: [
      { name: 'Hip Thrusts', sets: 4, reps: 10, weight: 80, muscleGroup: 'Legs' },
      { name: 'Stiff-Leg Deadlifts', sets: 4, reps: 10, weight: 60, muscleGroup: 'Legs' },
      { name: 'Walking Lunges', sets: 3, reps: 20, weight: 20, muscleGroup: 'Legs' },
      { name: 'Leg Curls', sets: 3, reps: 12, weight: 35, muscleGroup: 'Legs' },
    ]
  }
];

// planuri "oficiale" ale legendelor fitness-ului: colectii de rutine cu
// identitate proprie, adunate intr-un hub deschis din promo-ul Legends' Plans
interface OfficialPlan {
  id: string;
  name: string;
  athlete: string;
  title: string;
  tagline: string;
  description: string;
  tone: string;
  routines: Routine[];
}

const OFFICIAL_PLANS: OfficialPlan[] = [
  {
    id: 'arnold',
    name: 'Arnold Official Plan',
    athlete: 'Arnold Schwarzenegger',
    title: '7× Mr. Olympia',
    tagline: 'The classic 6-day Golden Era split — days 1-3, repeated twice.',
    description:
      "Train like the 7x Mr. Olympia. Arnold's legendary high-volume 6-day split: chest & back together, a huge shoulders & arms day and a brutal leg day — then repeat days 1-3 for the second half of the week.",
    tone: 'purple',
    routines: [
      {
        name: 'Chest & Back',
        category: 'Day 1',
        exercises: [
          { name: 'Barbell Bench Press', sets: 5, reps: 8, weight: 80, muscleGroup: 'Chest' },
          { name: 'Incline Barbell Press', sets: 4, reps: 10, weight: 60, muscleGroup: 'Chest' },
          { name: 'Weighted Pull-Up', sets: 5, reps: 10, weight: 10, muscleGroup: 'Back' },
          { name: 'Barbell Bent Over Row', sets: 5, reps: 10, weight: 70, muscleGroup: 'Back' },
          { name: 'Incline Dumbbell Press', sets: 4, reps: 12, weight: 26, muscleGroup: 'Chest' },
          { name: 'T-Bar Row', sets: 4, reps: 12, weight: 60, muscleGroup: 'Back' },
          { name: 'Cable Fly', sets: 3, reps: 15, weight: 20, muscleGroup: 'Chest' },
          { name: 'Lat Pulldown', sets: 3, reps: 15, weight: 55, muscleGroup: 'Back' },
          { name: 'Dumbbell Pullover', sets: 3, reps: 15, weight: 22, muscleGroup: 'Chest' },
        ],
      },
      {
        name: 'Shoulders & Arms',
        category: 'Day 2',
        exercises: [
          { name: 'Standing Barbell Overhead Press', sets: 5, reps: 8, weight: 50, muscleGroup: 'Shoulders' },
          { name: 'Seated Dumbbell Press', sets: 4, reps: 10, weight: 24, muscleGroup: 'Shoulders' },
          { name: 'Close Grip Bench Press', sets: 4, reps: 8, weight: 60, muscleGroup: 'Arms' },
          { name: 'Barbell Curl', sets: 4, reps: 8, weight: 35, muscleGroup: 'Arms' },
          { name: 'Upright Row', sets: 3, reps: 12, weight: 30, muscleGroup: 'Shoulders' },
          { name: 'Lateral Raise', sets: 4, reps: 15, weight: 10, muscleGroup: 'Shoulders' },
          { name: 'Rear Delt Fly', sets: 4, reps: 15, weight: 10, muscleGroup: 'Shoulders' },
          { name: 'Skull Crushers', sets: 4, reps: 12, weight: 30, muscleGroup: 'Arms' },
          { name: 'Incline Dumbbell Curl', sets: 4, reps: 12, weight: 12, muscleGroup: 'Arms' },
          { name: 'Rope Pushdown', sets: 3, reps: 15, weight: 25, muscleGroup: 'Arms' },
          { name: 'Preacher Curl', sets: 3, reps: 15, weight: 25, muscleGroup: 'Arms' },
        ],
      },
      {
        name: 'Legs',
        category: 'Day 3',
        exercises: [
          { name: 'Back Squat', sets: 5, reps: 8, weight: 100, muscleGroup: 'Legs' },
          { name: 'Romanian Deadlift', sets: 4, reps: 10, weight: 80, muscleGroup: 'Legs' },
          { name: 'Leg Press', sets: 4, reps: 12, weight: 200, muscleGroup: 'Legs' },
          { name: 'Walking Lunges', sets: 3, reps: 12, weight: 20, muscleGroup: 'Legs' },
          { name: 'Leg Extension', sets: 4, reps: 15, weight: 50, muscleGroup: 'Legs' },
          { name: 'Lying Leg Curl', sets: 4, reps: 15, weight: 40, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raise', sets: 5, reps: 15, weight: 60, muscleGroup: 'Legs' },
          { name: 'Seated Calf Raise', sets: 4, reps: 20, weight: 40, muscleGroup: 'Legs' },
        ],
      },
    ],
  },
  {
    id: 'mentzer',
    name: 'Mike Mentzer Heavy Duty',
    athlete: 'Mike Mentzer',
    title: 'Mr. Universe 1978',
    tagline: 'High intensity, low volume — every set to absolute failure.',
    description:
      "Mentzer's Heavy Duty philosophy: brief, brutally intense workouts with a single working set per exercise taken beyond failure, then days of full recovery. The opposite of volume training — quality over quantity.",
    tone: 'blue',
    routines: [
      {
        name: 'Workout A',
        category: 'Heavy Duty',
        exercises: [
          { name: 'Incline Barbell Press', sets: 1, reps: 8, weight: 80, muscleGroup: 'Chest' },
          { name: 'Weighted Dips', sets: 1, reps: 8, weight: 20, muscleGroup: 'Chest' },
          { name: 'Chest Supported Row', sets: 1, reps: 8, weight: 60, muscleGroup: 'Back' },
          { name: 'Weighted Pull-Up', sets: 1, reps: 8, weight: 15, muscleGroup: 'Back' },
          { name: 'Cable Fly', sets: 1, reps: 10, weight: 25, muscleGroup: 'Chest' },
        ],
      },
      {
        name: 'Workout B',
        category: 'Heavy Duty',
        exercises: [
          { name: 'Back Squat', sets: 1, reps: 8, weight: 120, muscleGroup: 'Legs' },
          { name: 'Romanian Deadlift', sets: 1, reps: 8, weight: 100, muscleGroup: 'Legs' },
          { name: 'Leg Extension', sets: 1, reps: 10, weight: 60, muscleGroup: 'Legs' },
          { name: 'Leg Curl', sets: 1, reps: 10, weight: 50, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raise', sets: 1, reps: 15, weight: 80, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Workout C',
        category: 'Heavy Duty',
        exercises: [
          { name: 'Standing Overhead Press', sets: 1, reps: 8, weight: 55, muscleGroup: 'Shoulders' },
          { name: 'Close Grip Bench Press', sets: 1, reps: 8, weight: 70, muscleGroup: 'Arms' },
          { name: 'Barbell Curl', sets: 1, reps: 8, weight: 40, muscleGroup: 'Arms' },
          { name: 'Lateral Raise', sets: 1, reps: 12, weight: 12, muscleGroup: 'Shoulders' },
          { name: 'Rope Pushdown', sets: 1, reps: 10, weight: 30, muscleGroup: 'Arms' },
          { name: 'Incline Curl', sets: 1, reps: 10, weight: 14, muscleGroup: 'Arms' },
        ],
      },
    ],
  },
  {
    id: 'cbum',
    name: 'Cbum Classic Plan',
    athlete: 'Chris Bumstead',
    title: '6× Classic Physique Mr. Olympia',
    tagline: 'Modern Classic Physique — the full 5-day split from Cbum.',
    description:
      "Chris Bumstead's aesthetic-first training: controlled tempo, full range of motion and smart volume across a 5-day split. Built for that timeless Classic Physique look — proportion over pure mass.",
    tone: 'cyan',
    routines: [
      {
        name: 'Chest',
        category: 'Day 1',
        exercises: [
          { name: 'Incline Smith Press', sets: 4, reps: 8, weight: 100, muscleGroup: 'Chest' },
          { name: 'Flat Dumbbell Press', sets: 4, reps: 10, weight: 36, muscleGroup: 'Chest' },
          { name: 'Machine Chest Press', sets: 3, reps: 12, weight: 90, muscleGroup: 'Chest' },
          { name: 'Pec Deck', sets: 3, reps: 15, weight: 60, muscleGroup: 'Chest' },
          { name: 'Cable Fly', sets: 3, reps: 15, weight: 22, muscleGroup: 'Chest' },
        ],
      },
      {
        name: 'Back',
        category: 'Day 2',
        exercises: [
          { name: 'Chest Supported Row', sets: 4, reps: 10, weight: 70, muscleGroup: 'Back' },
          { name: 'Neutral Grip Pulldown', sets: 4, reps: 10, weight: 65, muscleGroup: 'Back' },
          { name: 'Machine High Row', sets: 3, reps: 12, weight: 70, muscleGroup: 'Back' },
          { name: 'Seated Cable Row', sets: 3, reps: 12, weight: 65, muscleGroup: 'Back' },
          { name: 'Straight Arm Pulldown', sets: 3, reps: 15, weight: 30, muscleGroup: 'Back' },
        ],
      },
      {
        name: 'Legs',
        category: 'Day 3',
        exercises: [
          { name: 'Hack Squat', sets: 4, reps: 10, weight: 120, muscleGroup: 'Legs' },
          { name: 'Romanian Deadlift', sets: 4, reps: 10, weight: 100, muscleGroup: 'Legs' },
          { name: 'Leg Press', sets: 3, reps: 12, weight: 220, muscleGroup: 'Legs' },
          { name: 'Walking Lunges', sets: 3, reps: 12, weight: 24, muscleGroup: 'Legs' },
          { name: 'Leg Extension', sets: 3, reps: 15, weight: 55, muscleGroup: 'Legs' },
          { name: 'Leg Curl', sets: 3, reps: 15, weight: 50, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raise', sets: 4, reps: 15, weight: 70, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Shoulders',
        category: 'Day 4',
        exercises: [
          { name: 'Smith Shoulder Press', sets: 4, reps: 8, weight: 70, muscleGroup: 'Shoulders' },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: 10, weight: 28, muscleGroup: 'Shoulders' },
          { name: 'Cable Lateral Raise', sets: 4, reps: 15, weight: 8, muscleGroup: 'Shoulders' },
          { name: 'Rear Delt Fly', sets: 4, reps: 15, weight: 12, muscleGroup: 'Shoulders' },
          { name: 'Machine Shrug', sets: 3, reps: 12, weight: 80, muscleGroup: 'Shoulders' },
        ],
      },
      {
        name: 'Arms',
        category: 'Day 5',
        exercises: [
          { name: 'Close Grip Bench Press', sets: 4, reps: 8, weight: 70, muscleGroup: 'Arms' },
          { name: 'EZ Bar Skull Crusher', sets: 3, reps: 10, weight: 30, muscleGroup: 'Arms' },
          { name: 'Rope Pushdown', sets: 3, reps: 12, weight: 28, muscleGroup: 'Arms' },
          { name: 'Barbell Curl', sets: 4, reps: 8, weight: 40, muscleGroup: 'Arms' },
          { name: 'Incline Dumbbell Curl', sets: 3, reps: 10, weight: 14, muscleGroup: 'Arms' },
          { name: 'Bayesian Curl', sets: 3, reps: 12, weight: 12, muscleGroup: 'Arms' },
          { name: 'Hammer Curl', sets: 3, reps: 12, weight: 16, muscleGroup: 'Arms' },
        ],
      },
    ],
  },
  {
    id: 'ronnie',
    name: 'Ronnie Coleman Power Plan',
    athlete: 'Ronnie Coleman',
    title: '8× Mr. Olympia',
    tagline: 'Yeah buddy! 5 days of heavy powerbuilding, lightweight baby!',
    description:
      "The King's powerbuilding: squat, deadlift and bench heavy like a powerlifter, then pump like a bodybuilder. Five days of massive compound lifts and serious volume — everybody wants to be a bodybuilder...",
    tone: 'green',
    routines: [
      {
        name: 'Back',
        category: 'Day 1',
        exercises: [
          { name: 'Deadlift', sets: 5, reps: 5, weight: 180, muscleGroup: 'Back' },
          { name: 'Barbell Row', sets: 4, reps: 8, weight: 100, muscleGroup: 'Back' },
          { name: 'T-Bar Row', sets: 4, reps: 10, weight: 80, muscleGroup: 'Back' },
          { name: 'Wide Grip Pulldown', sets: 4, reps: 10, weight: 70, muscleGroup: 'Back' },
          { name: 'Seated Cable Row', sets: 3, reps: 12, weight: 65, muscleGroup: 'Back' },
          { name: 'Straight Arm Pulldown', sets: 3, reps: 15, weight: 30, muscleGroup: 'Back' },
        ],
      },
      {
        name: 'Chest',
        category: 'Day 2',
        exercises: [
          { name: 'Barbell Bench Press', sets: 5, reps: 5, weight: 140, muscleGroup: 'Chest' },
          { name: 'Incline Dumbbell Press', sets: 4, reps: 8, weight: 40, muscleGroup: 'Chest' },
          { name: 'Machine Chest Press', sets: 4, reps: 10, weight: 100, muscleGroup: 'Chest' },
          { name: 'Weighted Dips', sets: 3, reps: 10, weight: 20, muscleGroup: 'Chest' },
          { name: 'Pec Deck', sets: 3, reps: 15, weight: 65, muscleGroup: 'Chest' },
          { name: 'Cable Fly', sets: 3, reps: 15, weight: 25, muscleGroup: 'Chest' },
        ],
      },
      {
        name: 'Legs',
        category: 'Day 3',
        exercises: [
          { name: 'Back Squat', sets: 5, reps: 5, weight: 180, muscleGroup: 'Legs' },
          { name: 'Leg Press', sets: 4, reps: 12, weight: 300, muscleGroup: 'Legs' },
          { name: 'Romanian Deadlift', sets: 4, reps: 8, weight: 120, muscleGroup: 'Legs' },
          { name: 'Walking Lunges', sets: 3, reps: 12, weight: 24, muscleGroup: 'Legs' },
          { name: 'Leg Extension', sets: 3, reps: 15, weight: 60, muscleGroup: 'Legs' },
          { name: 'Leg Curl', sets: 3, reps: 15, weight: 55, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raise', sets: 5, reps: 15, weight: 80, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Shoulders',
        category: 'Day 4',
        exercises: [
          { name: 'Standing Military Press', sets: 5, reps: 6, weight: 70, muscleGroup: 'Shoulders' },
          { name: 'Seated Dumbbell Press', sets: 4, reps: 8, weight: 32, muscleGroup: 'Shoulders' },
          { name: 'Upright Row', sets: 4, reps: 10, weight: 40, muscleGroup: 'Shoulders' },
          { name: 'Lateral Raise', sets: 4, reps: 15, weight: 14, muscleGroup: 'Shoulders' },
          { name: 'Rear Delt Fly', sets: 4, reps: 15, weight: 12, muscleGroup: 'Shoulders' },
          { name: 'Barbell Shrug', sets: 5, reps: 12, weight: 120, muscleGroup: 'Shoulders' },
        ],
      },
      {
        name: 'Arms',
        category: 'Day 5',
        exercises: [
          { name: 'Close Grip Bench Press', sets: 4, reps: 8, weight: 80, muscleGroup: 'Arms' },
          { name: 'EZ Bar Skull Crusher', sets: 4, reps: 10, weight: 35, muscleGroup: 'Arms' },
          { name: 'Rope Pushdown', sets: 3, reps: 15, weight: 30, muscleGroup: 'Arms' },
          { name: 'Barbell Curl', sets: 4, reps: 8, weight: 45, muscleGroup: 'Arms' },
          { name: 'Incline Dumbbell Curl', sets: 4, reps: 10, weight: 16, muscleGroup: 'Arms' },
          { name: 'Hammer Curl', sets: 3, reps: 12, weight: 20, muscleGroup: 'Arms' },
          { name: 'Preacher Curl', sets: 3, reps: 15, weight: 30, muscleGroup: 'Arms' },
        ],
      },
    ],
  },
  {
    id: 'dorian',
    name: 'Dorian Yates Blood & Guts',
    athlete: 'Dorian Yates',
    title: '6× Mr. Olympia',
    tagline: 'Two all-out working sets. Nothing left in the tank.',
    description:
      "The Shadow's Blood & Guts training: warm up, then a couple of working sets per exercise past failure — forced reps, drop sets, total war. Four short, savage days that changed bodybuilding forever.",
    tone: 'pink',
    routines: [
      {
        name: 'Back',
        category: 'Day 1',
        exercises: [
          { name: 'Rack Pull', sets: 2, reps: 8, weight: 180, muscleGroup: 'Back' },
          { name: 'Barbell Row', sets: 2, reps: 10, weight: 100, muscleGroup: 'Back' },
          { name: 'Hammer Strength Row', sets: 2, reps: 10, weight: 80, muscleGroup: 'Back' },
          { name: 'Wide Grip Pulldown', sets: 2, reps: 12, weight: 70, muscleGroup: 'Back' },
          { name: 'Machine Pullover', sets: 2, reps: 12, weight: 60, muscleGroup: 'Back' },
        ],
      },
      {
        name: 'Chest',
        category: 'Day 2',
        exercises: [
          { name: 'Incline Smith Press', sets: 2, reps: 8, weight: 100, muscleGroup: 'Chest' },
          { name: 'Hammer Strength Chest Press', sets: 2, reps: 10, weight: 90, muscleGroup: 'Chest' },
          { name: 'Incline Dumbbell Press', sets: 2, reps: 10, weight: 34, muscleGroup: 'Chest' },
          { name: 'Pec Deck', sets: 2, reps: 12, weight: 60, muscleGroup: 'Chest' },
          { name: 'Cable Fly', sets: 2, reps: 15, weight: 25, muscleGroup: 'Chest' },
        ],
      },
      {
        name: 'Legs',
        category: 'Day 3',
        exercises: [
          { name: 'Hack Squat', sets: 2, reps: 10, weight: 140, muscleGroup: 'Legs' },
          { name: 'Leg Press', sets: 2, reps: 12, weight: 250, muscleGroup: 'Legs' },
          { name: 'Romanian Deadlift', sets: 2, reps: 10, weight: 110, muscleGroup: 'Legs' },
          { name: 'Leg Curl', sets: 2, reps: 12, weight: 55, muscleGroup: 'Legs' },
          { name: 'Leg Extension', sets: 2, reps: 15, weight: 65, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raise', sets: 3, reps: 15, weight: 90, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Shoulders & Arms',
        category: 'Day 4',
        exercises: [
          { name: 'Smith Shoulder Press', sets: 2, reps: 8, weight: 80, muscleGroup: 'Shoulders' },
          { name: 'Dumbbell Lateral Raise', sets: 2, reps: 12, weight: 14, muscleGroup: 'Shoulders' },
          { name: 'Rear Delt Machine', sets: 2, reps: 12, weight: 50, muscleGroup: 'Shoulders' },
          { name: 'Close Grip Bench Press', sets: 2, reps: 8, weight: 80, muscleGroup: 'Arms' },
          { name: 'EZ Bar Curl', sets: 2, reps: 8, weight: 40, muscleGroup: 'Arms' },
          { name: 'Rope Pushdown', sets: 2, reps: 12, weight: 30, muscleGroup: 'Arms' },
          { name: 'Preacher Curl', sets: 2, reps: 12, weight: 30, muscleGroup: 'Arms' },
        ],
      },
    ],
  },
];

import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

@Component({
  selector: 'app-start-workout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzCardModule,
    NzProgressModule,
    NzTagModule,
    NzDrawerModule,
    NzPopconfirmModule,
    WorkoutModalComponent,
    AppMenuComponent,
    CommunityComponent,
  ],
  templateUrl: './start-workout.component.html',
  styleUrls: ['./start-workout.component.scss']
})
export class StartWorkoutComponent implements OnInit, OnDestroy {
  targetDate = signal<string>(new Date().toISOString().split('T')[0]);

  state = signal<'setup' | 'active' | 'rest' | 'finished'>('setup');

  routines = PREDEFINED_ROUTINES;
  officialPlans = OFFICIAL_PLANS;
  personalRoutines = signal<Routine[]>([]);
  selectedRoutineKey = signal('predefined-0');
  modalVisible = signal(false);
  communityDrawerVisible = signal(false);
  // hub-ul Legends' Plans: drawer-ul + planul selectat in el (null = lista de staruri)
  legendsOpen = signal(false);
  activePlan = signal<OfficialPlan | null>(null);

  currentRoutine = signal<Routine>({ name: 'Custom Workout', exercises: [] });

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(1);

  // progressive overload: greutatea si repetarile setului curent + ce ai logat
  currentWeight = signal(0);
  currentReps = signal(0);
  private loggedWeights: number[][] = [];
  private loggedReps: number[][] = [];
  // ultima greutate si ultimele repetari pe fiecare exercitiu, din istoric
  private lastWeights = signal(new Map<string, number>());
  private lastReps = signal(new Map<string, number>());
  // istoricul complet, pentru comparatia de volum de la finalul antrenamentului
  private historyWorkouts: Workout[] = [];

  // rezumatul de final: cat ai ridicat in total + diferenta fata de data trecuta
  finishedVolume = signal(0);
  finishedDelta = signal<number | null>(null);

  // greutatea si repetarile folosite data trecuta la exercitiul curent
  lastTimeWeight = computed(() => {
    const ex = this.currentExercise();
    if (!ex) return null;
    return this.lastWeights().get(ex.name.toLowerCase()) ?? null;
  });

  lastTimeReps = computed(() => {
    const ex = this.currentExercise();
    if (!ex) return null;
    return this.lastReps().get(ex.name.toLowerCase()) ?? null;
  });

  // diferenta fata de data trecuta (pozitiv = progres)
  overloadDelta = computed(() => {
    const last = this.lastTimeWeight();
    if (last === null || last === 0) return null;
    return Math.round((this.currentWeight() - last) * 10) / 10;
  });

  restTimeTarget = signal(60);
  restTimeRemaining = signal(60);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  workoutInProgress = computed(() =>
    this.state() === 'active' || this.state() === 'rest',
  );

  currentExercise = computed(() => {
    const ex = this.currentRoutine().exercises;
    const idx = this.currentExerciseIndex();
    if (idx < ex.length) return ex[idx];
    return null;
  });

  // filtre pe categorii, in stilul referintei (All / Push / Pull / ...)
  routineFilter = signal<string>('All');
  readonly routineFilters = ['All', ...Array.from(new Set(PREDEFINED_ROUTINES.map((r) => r.category!)))]

  filteredPredefined = computed(() => {
    const filter = this.routineFilter();
    return this.routines
      .map((routine, index) => ({ routine, index }))
      .filter(({ routine }) => filter === 'All' || routine.category === filter);
  });

  routineKcal(routine: Routine): number {
    return estimateSessionCalories(routine.exercises, this.profileService.weightKg());
  }

  routineMinutes(routine: Routine): number {
    return estimateSessionMinutes(routine.exercises);
  }

  // grupele musculare lucrate, pentru textul de pe card (ex. "Legs / Chest / Back")
  muscleSummary(routine: Routine): string {
    const groups = Array.from(new Set(routine.exercises.map((e) => e.muscleGroup)));
    return groups.slice(0, 3).join(' / ');
  }

  // tonuri alternante pentru cardurile din plan
  cardTone(index: number): string {
    return ['blue', 'purple', 'cyan', 'green'][index % 4];
  }

  progressPercent = computed(() => {
    const totalSets = this.currentRoutine().exercises.reduce((acc, ex) => acc + ex.sets, 0);
    if (totalSets === 0) return 0;

    let completed = 0;
    const exList = this.currentRoutine().exercises;
    for (let i = 0; i < this.currentExerciseIndex(); i++) completed += exList[i].sets;
    completed += (this.currentSetIndex() - 1);

    return Math.round((completed / totalSets) * 100);
  });

  constructor(
    private authService: AuthService,
    private workoutService: WorkoutService,
    private profileService: ProfileService,
    private message: NzMessageService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['date']) {
        this.targetDate.set(params['date']);
      }
    });

    this.selectRoutine(this.routines[0], 'predefined-0');
    this.loadPersonalRoutines();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  logout() {
    if (this.workoutInProgress()) {
      this.message.warning('Stop the current workout before logging out.');
      return;
    }
    this.authService.logout().subscribe();
  }

  selectRoutine(routine: Routine, key: string) {
    this.selectedRoutineKey.set(key);
    this.currentRoutine.set(JSON.parse(JSON.stringify(routine)));
  }

  blockNavigation(event: Event) {
    if (!this.workoutInProgress()) return;
    event.preventDefault();
    event.stopPropagation();
    this.message.warning('Stop the current workout before changing sections.');
  }

  canLeaveWorkout(): boolean {
    if (!this.workoutInProgress()) return true;
    this.message.warning('Stop the current workout before leaving this page.');
    return false;
  }

  @HostListener('window:beforeunload', ['$event'])
  preventBrowserExit(event: BeforeUnloadEvent): void {
    if (!this.workoutInProgress()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  openAddWorkout() {
    this.modalVisible.set(true);
  }

  onModalSave(workout: Partial<Workout>) {
    this.workoutService.addWorkout({
      userId: this.authService.currentUserId,
      name: workout.name || 'My workout',
      date: workout.date || this.targetDate(),
      notes: workout.notes ?? '',
      exercises: workout.exercises || [],
      isPredefined: false,
    }).subscribe({
      next: () => {
        this.modalVisible.set(false);
        this.loadPersonalRoutines();
        this.message.success('Workout saved successfully.');
      },
      error: () => this.message.error('Failed to save workout.')
    });
  }

  deleteWorkout(id: string | undefined) {
    if (!id) return;
    this.workoutService.deleteWorkout(id).subscribe({
      next: () => {
        this.message.success('Workout deleted successfully.');
        // Re-select first predefined routine if we deleted the selected one
        if (this.selectedRoutineKey() === 'personal-' + id) {
          this.selectRoutine(this.routines[0], 'predefined-0');
        }
        this.loadPersonalRoutines();
      },
      error: () => this.message.error('Failed to delete workout.')
    });
  }

  onModalCancel() {
    this.modalVisible.set(false);
  }

  openCommunityDrawer() {
    this.communityDrawerVisible.set(true);
  }

  openLegends() {
    this.activePlan.set(null);
    this.legendsOpen.set(true);
  }

  openPlan(plan: OfficialPlan) {
    this.activePlan.set(plan);
  }

  backToLegends() {
    this.activePlan.set(null);
  }

  closePlan() {
    this.legendsOpen.set(false);
    this.activePlan.set(null);
  }

  athleteInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts.length === 1
      ? parts[0].charAt(0).toUpperCase()
      : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // porneste direct o rutina dintr-un plan oficial (inchide drawer-ul intai)
  startFromPlan(routine: Routine, planId: string, index: number) {
    this.selectRoutine(routine, `plan-${planId}-${index}`);
    this.closePlan();
    this.startWorkout();
  }

  closeCommunityDrawer() {
    this.communityDrawerVisible.set(false);
    // Reload personal routines in case the user saved a community workout
    this.loadPersonalRoutines();
  }

  private loadPersonalRoutines() {
    this.workoutService.getWorkouts().subscribe((workouts) => {
      this.personalRoutines.set(
        workouts
          .filter((workout) => !workout.isPredefined)
          .map((workout) => ({
            id: workout.id,
            name: workout.name,
            exercises: workout.exercises.map((exercise) => ({
              name: exercise.exerciseName,
              muscleGroup: exercise.muscleGroup,
              sets: exercise.sets,
              reps: exercise.reps,
              weight: exercise.weight,
            })),
          })),
      );
    });
  }

  startWorkout() {
    if (this.currentRoutine().exercises.length === 0) return;
    this.currentExerciseIndex.set(0);
    this.currentSetIndex.set(1);
    this.loggedWeights = this.currentRoutine().exercises.map(() => []);
    this.loggedReps = this.currentRoutine().exercises.map(() => []);
    this.loadLastWeights();
    this.syncCurrentWeight();
    this.syncCurrentReps();
    this.state.set('active');
  }

  // cauta in istoricul salvat ultima greutate si ultimele repetari per exercitiu
  private loadLastWeights() {
    this.lastWeights.set(new Map());
    this.lastReps.set(new Map());
    this.workoutService.getWorkouts().subscribe((workouts) => {
      const weights = new Map<string, number>();
      const reps = new Map<string, number>();
      const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
      this.historyWorkouts = sorted;
      for (const w of sorted) {
        for (const ex of w.exercises) {
          const key = ex.exerciseName.toLowerCase();
          if (!weights.has(key)) {
            const logged = ex.setWeights?.length ? Math.max(...ex.setWeights) : ex.weight;
            if (logged > 0) weights.set(key, logged);
          }
          // doar repetarile logate efectiv conteaza (reps oficial poate fi planul)
          if (!reps.has(key) && ex.setReps?.length) {
            reps.set(key, Math.max(...ex.setReps));
          }
        }
      }
      this.lastWeights.set(weights);
      this.lastReps.set(reps);
      // istoricul soseste asincron; reasezam valorile propuse acum ca stim
      // cat s-a lucrat data trecuta (doar daca userul nu a logat inca un set)
      if (this.workoutInProgress() && !this.loggedWeights[this.currentExerciseIndex()]?.length) {
        this.syncCurrentWeight();
        this.syncCurrentReps();
      }
    });
  }

  // greutatea propusa pentru setul curent:
  // ultimul set logat in aceasta sesiune > ultima greutate din istoric > planul
  private syncCurrentWeight() {
    const exIdx = this.currentExerciseIndex();
    const logged = this.loggedWeights[exIdx];
    if (logged?.length) {
      this.currentWeight.set(logged[logged.length - 1]);
      return;
    }
    const ex = this.currentExercise();
    const lastTime = ex ? this.lastWeights().get(ex.name.toLowerCase()) : undefined;
    const planned = ex?.weight ?? 0;
    this.currentWeight.set(lastTime && lastTime > 0 ? lastTime : planned);
  }

  adjustWeight(delta: number) {
    this.currentWeight.set(Math.max(0, Math.round((this.currentWeight() + delta) * 10) / 10));
  }

  onWeightInput(value: string) {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1000) {
      this.currentWeight.set(Math.round(parsed * 10) / 10);
    }
  }

  // repetarile propuse pentru setul curent:
  // ultimul set logat in aceasta sesiune > cate ai facut data trecuta > planul
  private syncCurrentReps() {
    const exIdx = this.currentExerciseIndex();
    const logged = this.loggedReps[exIdx];
    if (logged?.length) {
      this.currentReps.set(logged[logged.length - 1]);
      return;
    }
    const ex = this.currentExercise();
    const lastTime = ex ? this.lastReps().get(ex.name.toLowerCase()) : undefined;
    this.currentReps.set(lastTime && lastTime > 0 ? lastTime : ex?.reps ?? 0);
  }

  adjustReps(delta: number) {
    this.currentReps.set(Math.max(0, Math.round(this.currentReps() + delta)));
  }

  onRepsInput(value: string) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 500) {
      this.currentReps.set(parsed);
    }
  }

  finishSet() {
    const exIdx = this.currentExerciseIndex();
    this.loggedWeights[exIdx]?.push(this.currentWeight());
    this.loggedReps[exIdx]?.push(this.currentReps());
    this.state.set('rest');
    this.restTimeRemaining.set(this.restTimeTarget());

    this.timerInterval = setInterval(() => {
      let t = this.restTimeRemaining();
      if (t > 0) {
        this.restTimeRemaining.set(t - 1);
      } else {
        this.skipRest();
      }
    }, 1000);
  }

  skipRest() {
    this.stopTimer();
    const currEx = this.currentExercise();
    if (!currEx) return;

    if (this.currentSetIndex() < currEx.sets) {
      this.currentSetIndex.set(this.currentSetIndex() + 1);
      this.syncCurrentWeight();
      this.syncCurrentReps();
      this.state.set('active');
    } else {
      if (this.currentExerciseIndex() + 1 < this.currentRoutine().exercises.length) {
        this.currentExerciseIndex.set(this.currentExerciseIndex() + 1);
        this.currentSetIndex.set(1);
        this.syncCurrentWeight();
        this.syncCurrentReps();
        this.state.set('active');
      } else {
        this.finishWorkout();
      }
    }
  }

  addTime(seconds: number) {
    this.restTimeRemaining.set(this.restTimeRemaining() + seconds);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // volumul total al sesiunii curente: suma reps×kg pe fiecare set logat
  private sessionVolume(): number {
    return this.loggedWeights.reduce(
      (total, weights, i) =>
        total + weights.reduce((s, w, setIdx) => s + w * (this.loggedReps[i]?.[setIdx] ?? 0), 0),
      0,
    );
  }

  // volumul unui antrenament salvat, cu aceleasi reguli ca in History
  private workoutVolume(w: Workout): number {
    return w.exercises.reduce((total, ex) => {
      const weights = ex.setWeights;
      const reps = ex.setReps;
      if (weights?.length && reps?.length === weights.length) {
        return total + weights.reduce((s, wt, i) => s + wt * reps[i], 0);
      }
      if (weights?.length) {
        return total + ex.reps * weights.reduce((s, wt) => s + wt, 0);
      }
      return total + ex.sets * ex.reps * ex.weight;
    }, 0);
  }

  private finishWorkout() {
    this.stopTimer();

    // rezumatul de final: total ridicat + comparatie cu ultima sesiune identica
    const volume = this.sessionVolume();
    this.finishedVolume.set(Math.round(volume));
    const name = this.currentRoutine().name.trim().toLowerCase();
    const previous = this.historyWorkouts.find((w) => w.name.trim().toLowerCase() === name);
    this.finishedDelta.set(previous ? Math.round(volume - this.workoutVolume(previous)) : null);

    this.saveWorkout();
    this.state.set('finished');
  }

  cancelWorkout() {
    this.stopTimer();
    this.state.set('setup');
  }

  saveWorkout() {
    const workout = this.currentRoutine();
    const dateStr = this.targetDate();
    const uid = this.authService.currentUserId;

    this.workoutService.addWorkout({
      userId: uid,
      name: workout.name,
      date: dateStr,
      notes: 'Auto-finished workout',
      isPredefined: false,
      exercises: workout.exercises.map((ex, i) => {
        const logged = this.loggedWeights[i] ?? [];
        const reps = this.loggedReps[i] ?? [];
        return {
          exerciseName: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: ex.sets,
          // valorile "oficiale" devin maximul lucrat efectiv
          reps: reps.length ? Math.max(...reps) : ex.reps,
          weight: logged.length ? Math.max(...logged) : ex.weight,
          ...(logged.length ? { setWeights: logged } : {}),
          ...(reps.length ? { setReps: reps } : {}),
        };
      })
    }).subscribe({
      next: () => this.message.success('Workout finished and saved!'),
      error: (err) => {
        console.warn('[start-workout] Failed to auto-save workout', err);
        this.message.error('Failed to save workout data.');
      }
    });
  }

  reset() {
    this.state.set('setup');
  }
}

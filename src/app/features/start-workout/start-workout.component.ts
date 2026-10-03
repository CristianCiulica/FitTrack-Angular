import { Subscription } from 'rxjs';
import { previousExercises, PreviousExercise, exerciseKey, workoutVolume, durationLabel } from '../../core/utils/workout-history';
import { createWorkoutSummaryImage } from '../../core/utils/workout-share';
import { localDateKey } from '../../core/utils/weight-progress';
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

interface PlannedExercise {
  name: string;
  sets: number;
  reps: number;
  repUnit?: 'seconds';
  weight: number;
  muscleGroup: MuscleGroup;
}

interface Routine {
  id?: string;
  name: string;
  category?: string;
  description?: string;
  restSeconds?: number;
  exercises: PlannedExercise[];
}

// General-purpose templates; users choose loads appropriate to their experience.
const PREDEFINED_ROUTINES: Routine[] = [
  {
    name: 'PUSH',
    category: 'Push',
    description: 'Your main push session. Chest, triceps and shoulders.',
    restSeconds: 90,
    exercises: [
      { name: 'Incline Dumbbell Press', sets: 4, reps: 10, weight: 0, muscleGroup: 'Chest' },
      { name: 'Triceps Pushdown', sets: 3, reps: 12, weight: 0, muscleGroup: 'Arms' },
      { name: 'Overhead Triceps Extension', sets: 3, reps: 12, weight: 0, muscleGroup: 'Arms' },
      { name: 'Chest Dip', sets: 3, reps: 10, weight: 0, muscleGroup: 'Chest' },
      { name: 'Lateral Raise (Dumbbell)', sets: 6, reps: 15, weight: 0, muscleGroup: 'Shoulders' },
    ],
  },
  {
    name: 'PULL',
    category: 'Pull',
    description: 'Your main pull session. Back, biceps and rear delts.',
    restSeconds: 90,
    exercises: [
      { name: 'Pull Up', sets: 4, reps: 8, weight: 0, muscleGroup: 'Back' },
      { name: 'Bicep Curl (Cable)', sets: 3, reps: 12, weight: 0, muscleGroup: 'Arms' },
      { name: 'Hammer Curl', sets: 3, reps: 12, weight: 0, muscleGroup: 'Arms' },
      { name: 'Bent Over Row (Machine)', sets: 3, reps: 10, weight: 0, muscleGroup: 'Back' },
      { name: 'Shrug (Barbell)', sets: 3, reps: 12, weight: 0, muscleGroup: 'Back' },
      { name: 'Rear Delt Work', sets: 3, reps: 15, weight: 0, muscleGroup: 'Shoulders' },
    ],
  },
  {
    name: 'LEGS',
    category: 'Legs',
    description: 'Your main gym leg session. Legs, calves and abs.',
    restSeconds: 90,
    exercises: [
      { name: 'Leg Press', sets: 4, reps: 10, weight: 0, muscleGroup: 'Legs' },
      { name: 'Calf Raises', sets: 4, reps: 15, weight: 0, muscleGroup: 'Legs' },
      { name: 'Leg Extension', sets: 4, reps: 12, weight: 0, muscleGroup: 'Legs' },
      { name: 'Hamstring Curl', sets: 3, reps: 12, weight: 0, muscleGroup: 'Legs' },
      { name: 'Abdominal Crunches', sets: 3, reps: 15, weight: 0, muscleGroup: 'Core' },
      { name: 'Leg Raises', sets: 3, reps: 15, weight: 0, muscleGroup: 'Core' },
    ],
  },
  {
    "name": "Foundation · A",
    "category": "Full body",
    "description": "Your first strength session. Squat, push, pull and hinge. Alternate with Foundation B.",
    "restSeconds": 90,
    "exercises": [
      {
        "name": "Goblet Squat",
        "sets": 3,
        "reps": 8,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Dumbbell Bench Press",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Chest"
      },
      {
        "name": "Chest-Supported Dumbbell Row",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Back"
      },
      {
        "name": "Dumbbell Romanian Deadlift",
        "sets": 2,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Dead Bug",
        "sets": 2,
        "reps": 8,
        "weight": 0,
        "muscleGroup": "Core"
      }
    ]
  },
  {
    "name": "Foundation · B",
    "category": "Full body",
    "description": "The other half of your week. Single-leg work, vertical pulling and controlled pressing.",
    "restSeconds": 90,
    "exercises": [
      {
        "name": "Reverse Lunge",
        "sets": 3,
        "reps": 8,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Lat Pulldown",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Back"
      },
      {
        "name": "Seated Dumbbell Shoulder Press",
        "sets": 2,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Shoulders"
      },
      {
        "name": "Glute Bridge",
        "sets": 3,
        "reps": 12,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Pallof Press",
        "sets": 2,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Core"
      }
    ]
  },
  {
    name: 'Lower Home',
    category: 'Legs',
    description: 'Bodyweight legs and core at home. Kickbacks are 20 reps per leg; hold the wide squat for 30 seconds.',
    restSeconds: 90,
    exercises: [
      { name: 'Bodyweight Squats', sets: 2, reps: 20, weight: 0, muscleGroup: 'Legs' },
      { name: 'Wide Squats', sets: 2, reps: 20, weight: 0, muscleGroup: 'Legs' },
      { name: 'Calf Raises', sets: 2, reps: 20, weight: 0, muscleGroup: 'Legs' },
      { name: 'Wide Squat Hold', sets: 1, reps: 30, repUnit: 'seconds', weight: 0, muscleGroup: 'Legs' },
      { name: 'Kickback (per leg)', sets: 3, reps: 20, weight: 0, muscleGroup: 'Legs' },
      { name: 'Lying Leg Raises', sets: 2, reps: 15, weight: 0, muscleGroup: 'Core' },
    ],
  },
  {
    "name": "Lower · Squat Focus",
    "category": "Legs",
    "description": "Quads lead the session. Hamstrings, calves and trunk round it out.",
    "restSeconds": 120,
    "exercises": [
      {
        "name": "Back Squat",
        "sets": 3,
        "reps": 6,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Leg Press",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Seated Leg Curl",
        "sets": 3,
        "reps": 12,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Standing Calf Raise",
        "sets": 3,
        "reps": 12,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Cable Crunch",
        "sets": 2,
        "reps": 12,
        "weight": 0,
        "muscleGroup": "Core"
      }
    ]
  },
  {
    "name": "Lower · Hinge Focus",
    "category": "Legs",
    "description": "A second lower-body day built around hamstrings, glutes and single-leg strength.",
    "restSeconds": 120,
    "exercises": [
      {
        "name": "Romanian Deadlift",
        "sets": 3,
        "reps": 8,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Hip Thrust",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Reverse Lunge",
        "sets": 2,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Lying Leg Curl",
        "sets": 2,
        "reps": 12,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Seated Calf Raise",
        "sets": 3,
        "reps": 15,
        "weight": 0,
        "muscleGroup": "Legs"
      }
    ]
  },
  {
    "name": "Dumbbells · The Essentials",
    "category": "Full body",
    "description": "A complete session with a pair of dumbbells and a bench. Simple equipment, purposeful work.",
    "restSeconds": 90,
    "exercises": [
      {
        "name": "Dumbbell Front Squat",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Dumbbell Floor Press",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Chest"
      },
      {
        "name": "Bench-Supported One-Arm Row",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Back"
      },
      {
        "name": "Dumbbell Romanian Deadlift",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Dumbbell Lateral Raise",
        "sets": 2,
        "reps": 12,
        "weight": 0,
        "muscleGroup": "Shoulders"
      }
    ]
  },
  {
    "name": "Core · Control & Stability",
    "category": "Core",
    "description": "Train trunk control without racing the clock. Pause briefly at the end of each rep.",
    "restSeconds": 90,
    "exercises": [
      {
        "name": "Dead Bug",
        "sets": 3,
        "reps": 8,
        "weight": 0,
        "muscleGroup": "Core"
      },
      {
        "name": "Bird Dog",
        "sets": 2,
        "reps": 8,
        "weight": 0,
        "muscleGroup": "Core"
      },
      {
        "name": "Pallof Press",
        "sets": 3,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Core"
      },
      {
        "name": "Reverse Crunch",
        "sets": 2,
        "reps": 12,
        "weight": 0,
        "muscleGroup": "Core"
      }
    ]
  },
  {
    "name": "Move · Low Impact",
    "category": "Cardio",
    "description": "A short, low-impact conditioning session. Keep the pace steady and rest between sets.",
    "restSeconds": 90,
    "exercises": [
      {
        "name": "Step Jack",
        "sets": 3,
        "reps": 20,
        "weight": 0,
        "muscleGroup": "Cardio"
      },
      {
        "name": "Bodyweight Squat",
        "sets": 3,
        "reps": 12,
        "weight": 0,
        "muscleGroup": "Legs"
      },
      {
        "name": "Standing Knee Drive",
        "sets": 3,
        "reps": 15,
        "weight": 0,
        "muscleGroup": "Cardio"
      },
      {
        "name": "Alternating Step-Back Lunge",
        "sets": 2,
        "reps": 10,
        "weight": 0,
        "muscleGroup": "Legs"
      }
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

import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

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
    NzModalModule,
    WorkoutModalComponent,
    AppMenuComponent,
  ],
  templateUrl: './start-workout.component.html',
  styleUrls: ['./start-workout.component.scss', './workout-live-layout.scss', './gym-plan.scss', './create-workout-action.scss']
})
export class StartWorkoutComponent implements OnInit, OnDestroy {
  targetDate = signal<string>(localDateKey());

  state = signal<'setup' | 'active' | 'rest' | 'review' | 'finished'>('setup');

  routines = PREDEFINED_ROUTINES;
  officialPlans = OFFICIAL_PLANS;
  readonly gymRoutines = PREDEFINED_ROUTINES.filter(routine => ['PUSH', 'PULL', 'LEGS'].includes(routine.name));
  readonly gymTotalSets = this.gymRoutines.reduce((total, routine) => total + routine.exercises.reduce((sets, exercise) => sets + exercise.sets, 0), 0);
  gymPlanOpen = signal(false);
  personalRoutines = signal<Routine[]>([]);
  selectedRoutineKey = signal('predefined-0');
  modalVisible = signal(false);
  deletingIds = signal<Set<string>>(new Set());
  completedSets = signal(0);
  saving = signal(false);
  // hub-ul Legends' Plans: drawer-ul + planul selectat in el (null = lista de staruri)
  legendsOpen = signal(false);
  activePlan = signal<OfficialPlan | null>(null);

  currentRoutine = signal<Routine>({ name: 'Custom Workout', exercises: [] });

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(1);

  // progressive overload: greutatea si repetarile setului curent + ce ai logat
  currentWeight = signal(0);
  currentReps = signal(0);
  readonly holdElapsedMs = signal(0);
  readonly holdRunning = signal(false);
  private holdAccumulatedMs = 0;
  private holdStartedAt = 0;
  private holdInterval: ReturnType<typeof setInterval> | null = null;
  readonly holdTargetSeconds = computed(() => Math.max(1, Math.min(500, this.currentExercise()?.reps ?? 1)));
  readonly holdRemainingSeconds = computed(() => Math.max(0, Math.ceil(this.holdTargetSeconds() - this.holdElapsedMs() / 1000)));
  readonly holdClock = computed(() => {
    const seconds = this.holdRemainingSeconds();
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  });
  readonly holdProgress = computed(() => Math.min(100, this.holdElapsedMs() / (this.holdTargetSeconds() * 10)));
  private loggedWeights: (number | null)[][] = [];
  private loggedReps: (number | null)[][] = [];
  private previousByExercise = signal(new Map<string, PreviousExercise>());
  private historyWorkouts: Workout[] = [];
  private sessionStartedAt = 0;
  private sessionEndedAt: number | null = null;
  private sessionGeneration = 0;
  private readonly reads = new Subscription();
  private inputsTouched = false;
  readonly historyLoading = signal(false);
  readonly historyUnavailable = signal(false);
  readonly previousSetData = computed(() => {
    const exercise = this.currentExercise();
    const previous = exercise ? this.previousByExercise().get(exerciseKey(exercise.name)) : undefined;
    if (!previous) return null;
    const index = Math.min(this.currentSetIndex() - 1, previous.pairs.length - 1);
    return {...previous.pairs[index], date: previous.date, set: index + 1};
  });
  readonly lastTimeWeight = computed(() => this.previousSetData()?.weight ?? null);
  readonly lastTimeReps = computed(() => this.previousSetData()?.reps ?? null);
  finishedVolume = signal(0);
  finishedDelta = signal<number | null>(null);
  finishedDuration = signal(0);
  finishedPrevious = signal<Workout | null>(null);
  finishedExercises = signal<{name:string;sets:number;volume:number}[]>([]);
  savedLocally = signal(false);
  exporting = signal(false);
  summaryImage = signal<string | null>(null);
  readonly durationLabel = durationLabel;

  restTimeTarget = signal(90);
  restTimeRemaining = signal(90);
  restClock = computed(() => `${Math.floor(this.restTimeRemaining() / 60)}:${String(this.restTimeRemaining() % 60).padStart(2, '0')}`);
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private restDeadline = 0;

  workoutInProgress = computed(() =>
    this.state() === 'active' || this.state() === 'rest' || this.state() === 'review',
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

  finishedCalories(): number {
    return estimateSessionCalories([{ sets: this.completedSets() }], this.profileService.weightKg());
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

    return Math.round((this.completedSets() / totalSets) * 100);
  });

  constructor(
    private authService: AuthService,
    private workoutService: WorkoutService,
    private profileService: ProfileService,
    private message: NzMessageService,
    private route: ActivatedRoute,
    private modalService: NzModalService,
  ) {}

  trackPersonalRoutine(_index: number, routine: { id?: string }) { return routine.id ?? routine; }
  trackPredefined(_index: number, item: { index: number }) { return item.index; }

  ngOnInit() {
    this.reads.add(this.route.queryParams.subscribe(params => {
      if (params['date']) {
        this.targetDate.set(params['date']);
      }
    }));

    this.selectRoutine(this.routines[0], 'predefined-0');
    this.loadPersonalRoutines();
  }

  private previousBodyOverflow: string | null = null;

  private unlockPageScroll(): void {
    if (this.previousBodyOverflow === null) return;
    document.body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = null;
  }

  ngOnDestroy() {
    this.unlockPageScroll();
    this.reads.unsubscribe();
    this.stopTimer();
    this.sessionGeneration++;
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
    this.restTimeTarget.set(routine.restSeconds ?? 90);
    this.currentRoutine.set({
      ...routine,
      exercises: routine.exercises.map(exercise => ({
        ...exercise,
        // Older saved routines allowed fractional/out-of-range set counts.
        sets: Math.max(1, Math.min(50, Math.floor(Number(exercise.sets) || 1))),
      })),
    });
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

  confirmDeleteWorkout(id?: string): void {
    if (!id) return;
    this.modalService.confirm({
      nzTitle: 'Delete workout?',
      nzContent: 'This workout will be removed from your library and history.',
      nzOkText: 'Delete', nzCancelText: 'Keep workout', nzOkDanger: true,
      nzCentered: true, nzWidth: 'min(400px, calc(100vw - 32px))',
      nzClassName: 'solid-modal workout-confirm',
      nzOnOk: () => this.deleteWorkout(id),
    });
  }

  confirmStopWorkout(): void {
    this.modalService.confirm({
      nzTitle: 'Stop this workout?',
      nzContent: 'Your unsaved sets will be lost. You can keep training or finish and save the session.',
      nzOkText: 'Stop workout', nzCancelText: 'Keep training', nzOkDanger: true,
      nzCentered: true, nzWidth: 'min(400px, calc(100vw - 32px))',
      nzClassName: 'solid-modal workout-confirm',
      nzOnOk: () => this.cancelWorkout(),
    });
  }

  deleteWorkout(id: string | undefined) {
    if (!id || this.deletingIds().has(id)) return;
    this.deletingIds.update(ids => new Set(ids).add(id));
    this.workoutService.deleteWorkout(id).subscribe({
      next: () => {
        this.deletingIds.update(ids => { const next = new Set(ids); next.delete(id); return next; });
        this.personalRoutines.update(routines => routines.filter(routine => routine.id !== id));
        this.message.success('Workout deleted.');
        // Re-select first predefined routine if we deleted the selected one
        if (this.selectedRoutineKey() === 'personal-' + id) {
          this.selectRoutine(this.routines[0], 'predefined-0');
        }
        this.loadPersonalRoutines();
      },
      error: () => {
        this.deletingIds.update(ids => { const next = new Set(ids); next.delete(id); return next; });
        this.message.error('Could not delete this workout. Please try again.');
      }
    });
  }

  onModalCancel() {
    this.modalVisible.set(false);
  }

  openGymPlan(): void {
    if (!this.workoutInProgress()) this.gymPlanOpen.set(true);
  }

  startFromGymPlan(routine: Routine): void {
    if (this.workoutInProgress() || !this.gymRoutines.includes(routine)) return;
    this.gymPlanOpen.set(false);
    this.selectRoutine(routine, `gym-ppl-${routine.name.toLowerCase()}`);
    this.startWorkout();
  }

  routineSets(routine: Routine): number {
    return routine.exercises.reduce((total, exercise) => total + exercise.sets, 0);
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

  private loadPersonalRoutines() {
    this.reads.add(this.workoutService.getWorkouts().subscribe((workouts) => {
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
              repUnit: exercise.repUnit,
              weight: exercise.weight,
            })),
          })),
      );
    }));
  }

  startWorkout() {
    if (this.currentRoutine().exercises.length === 0) return;
    this.previousBodyOverflow ??= document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.currentExerciseIndex.set(0);
    this.currentSetIndex.set(1);
    this.stopTimer();
    this.completedSets.set(0);
    this.loggedWeights = this.currentRoutine().exercises.map(ex => Array(ex.sets).fill(null));
    this.loggedReps = this.currentRoutine().exercises.map(ex => Array(ex.sets).fill(null));
    this.sessionStartedAt = Date.now();
    this.sessionEndedAt = null;
    this.inputsTouched = false;
    this.savedLocally.set(false);
    this.state.set('active');
    this.loadLastWeights();
    this.syncCurrentWeight();
    this.syncCurrentReps();
  }

  private loadLastWeights() {
    const generation = ++this.sessionGeneration;
    this.previousByExercise.set(new Map()); this.historyWorkouts = [];
    this.historyLoading.set(true); this.historyUnavailable.set(false);
    this.reads.add(this.workoutService.getWorkouts().subscribe({
      next: workouts => {
        if (generation !== this.sessionGeneration) return;
        this.historyLoading.set(false);
        const sorted = [...workouts].filter(w => !w.isPredefined && w.date.slice(0,10) <= this.targetDate())
          .sort((a,b) => b.date.localeCompare(a.date) || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
        this.historyWorkouts = sorted;
        this.previousByExercise.set(previousExercises(sorted, this.targetDate()));
        if (this.workoutInProgress() && !this.inputsTouched) { this.syncCurrentWeight(); this.syncCurrentReps(); }
      },
      error: () => { if (generation === this.sessionGeneration) { this.historyLoading.set(false); this.historyUnavailable.set(true); } },
    }));
  }

  // greutatea propusa pentru setul curent:
  // ultimul set logat in aceasta sesiune > ultima greutate din istoric > planul
  private syncCurrentWeight() {
    const exIdx = this.currentExerciseIndex();
    const logged = this.loggedWeights[exIdx];
    const saved = logged?.[this.currentSetIndex() - 1];
    const previous = logged?.slice(0, this.currentSetIndex() - 1).filter((value): value is number => value !== null).at(-1);
    if (saved != null) {
      this.currentWeight.set(saved);
      return;
    }
    const ex = this.currentExercise();
    const lastTime = this.previousSetData()?.weight;
    if (ex?.repUnit === 'seconds') { this.currentWeight.set(0); return; }
    const planned = ex?.weight ?? 0;
    this.currentWeight.set(lastTime ?? previous ?? planned);
  }

  adjustWeight(delta: number) {
    this.inputsTouched = true;
    this.currentWeight.set(Math.min(1000, Math.max(0, Math.round((this.currentWeight() + delta) * 10) / 10)));
  }

  onWeightInput(value: string) {
    this.inputsTouched = true;
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1000) {
      this.currentWeight.set(Math.round(parsed * 10) / 10);
    }
  }

  // repetarile propuse pentru setul curent:
  // ultimul set logat in aceasta sesiune > cate ai facut data trecuta > planul
  private syncCurrentReps() {
    if (this.currentExercise()?.repUnit === 'seconds') {
      this.resetHoldTimer();
      return;
    }
    const exIdx = this.currentExerciseIndex();
    const logged = this.loggedReps[exIdx];
    const saved = logged?.[this.currentSetIndex() - 1];
    const previous = logged?.slice(0, this.currentSetIndex() - 1).filter((value): value is number => value !== null).at(-1);
    if (saved != null) {
      this.currentReps.set(saved);
      return;
    }
    const ex = this.currentExercise();
    const lastTime = this.previousSetData()?.reps;
    this.currentReps.set(lastTime ?? previous ?? ex?.reps ?? 0);
  }

  adjustReps(delta: number) {
    this.inputsTouched = true;
    this.currentReps.set(Math.min(500, Math.max(0, Math.round(this.currentReps() + delta))));
  }

  onRepsInput(value: string) {
    this.inputsTouched = true;
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 500) {
      this.currentReps.set(parsed);
    }
  }

  readonly totalSets = computed(() => this.currentRoutine().exercises.reduce((total, ex) => total + ex.sets, 0));
  readonly canGoBack = computed(() => this.state() === 'rest' || this.state() === 'review' || this.currentExerciseIndex() > 0 || this.currentSetIndex() > 1);

  toggleHoldTimer() {
    if (this.state() !== 'active' || this.currentExercise()?.repUnit !== 'seconds') return;
    this.inputsTouched = true;
    if (this.holdRunning()) {
      this.stopHoldTimer();
      if (this.holdRemainingSeconds() === 0) this.finishSet();
      return;
    }
    this.holdStartedAt = Date.now();
    this.holdRunning.set(true);
    this.holdInterval = setInterval(() => this.updateHoldTimer(), 250);
  }

  resetHoldTimer() {
    this.stopHoldTimer();
    this.holdAccumulatedMs = 0;
    this.holdElapsedMs.set(0);
    if (this.currentExercise()?.repUnit === 'seconds') this.currentReps.set(0);
  }

  private sampleHoldTimer() {
    const elapsed = this.holdAccumulatedMs + (this.holdRunning() ? Math.max(0, Date.now() - this.holdStartedAt) : 0);
    const bounded = Math.min(this.holdTargetSeconds() * 1000, elapsed);
    this.holdElapsedMs.set(bounded);
    this.currentReps.set(Math.floor(bounded / 1000));
  }

  private stopHoldTimer() {
    if (this.holdRunning()) this.sampleHoldTimer();
    if (this.holdInterval !== null) clearInterval(this.holdInterval);
    this.holdInterval = null;
    this.holdAccumulatedMs = this.holdElapsedMs();
    this.holdRunning.set(false);
  }

  updateHoldTimer() {
    if (this.state() !== 'active' || !this.holdRunning()) return;
    this.sampleHoldTimer();
    if (this.holdRemainingSeconds() === 0) {
      const completedAt = this.holdStartedAt + this.holdTargetSeconds() * 1000 - this.holdAccumulatedMs;
      this.finishSet();
      // Preserve elapsed rest if the browser suspended timer callbacks.
      this.restDeadline = completedAt + this.restTimeTarget() * 1000;
      this.updateRestTime();
    }
  }

  finishSet() {
    if (this.state() !== 'active') return;
    if (this.currentExercise()?.repUnit === 'seconds') {
      this.stopHoldTimer();
      if (this.currentReps() < 1) return;
    }
    this.stopTimer();
    const exIdx = this.currentExerciseIndex();
    const setIdx = this.currentSetIndex() - 1;
    this.loggedWeights[exIdx][setIdx] = this.currentWeight();
    this.loggedReps[exIdx][setIdx] = this.currentReps();
    this.updateCompletedSets();
    this.state.set('rest');
    this.restTimeRemaining.set(this.restTimeTarget());
    this.restDeadline = Date.now() + this.restTimeTarget() * 1000;
    this.timerInterval = setInterval(() => this.updateRestTime(), 1000);
  }

  @HostListener('document:visibilitychange')
  updateRestTime() {
    this.updateHoldTimer();
    if (this.state() !== 'rest') return;
    const remaining = Math.max(0, Math.ceil((this.restDeadline - Date.now()) / 1000));
    this.restTimeRemaining.set(remaining);
    if (remaining === 0) this.skipRest();
  }

  previousSet() {
    if (!this.canGoBack() || !this.workoutInProgress()) return;
    this.stopTimer();
    // During rest/review return to the set just completed or skipped.
    if (this.state() === 'active') {
      if (this.currentSetIndex() > 1) {
        this.currentSetIndex.update(index => index - 1);
      } else {
        this.currentExerciseIndex.update(index => index - 1);
        this.currentSetIndex.set(this.currentExercise()!.sets);
      }
    }
    this.inputsTouched = false;
    this.sessionEndedAt = null;
    this.syncCurrentWeight();
    this.syncCurrentReps();
    this.state.set('active');
  }

  skipSet() {
    if (this.state() !== 'active') return;
    const exIdx = this.currentExerciseIndex();
    const setIdx = this.currentSetIndex() - 1;
    this.loggedWeights[exIdx][setIdx] = null;
    this.loggedReps[exIdx][setIdx] = null;
    this.updateCompletedSets();
    this.advanceSet();
  }

  skipRest() {
    if (this.state() !== 'rest') return;
    this.advanceSet();
  }

  private advanceSet() {
    this.stopTimer();
    const exercise = this.currentExercise();
    if (!exercise) return;
    if (this.currentSetIndex() < exercise.sets) {
      this.currentSetIndex.update(index => index + 1);
    } else if (this.currentExerciseIndex() + 1 < this.currentRoutine().exercises.length) {
      this.currentExerciseIndex.update(index => index + 1);
      this.currentSetIndex.set(1);
    } else {
      this.state.set('review');
      return;
    }
    this.inputsTouched = false;
    this.sessionEndedAt = null;
    this.syncCurrentWeight();
    this.syncCurrentReps();
    this.state.set('active');
  }

  private updateCompletedSets() {
    this.completedSets.set(this.loggedWeights.reduce((total, sets) => total + sets.filter(value => value !== null).length, 0));
  }

  addTime(seconds: number) {
    if (this.state() !== 'rest') return;
    this.restDeadline += seconds * 1000;
    this.updateRestTime();
  }

  private stopTimer() {
    this.stopHoldTimer();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // volumul total al sesiunii curente: suma reps×kg pe fiecare set logat
  private sessionVolume(): number {
    return this.loggedWeights.reduce(
      (total, weights, i) =>
        total + weights.reduce<number>((s, w, setIdx) => s + (w ?? 0) * (this.loggedReps[i]?.[setIdx] ?? 0), 0),
      0,
    );
  }

  finishWorkout() {
    if (this.state() !== 'review' || this.saving() || this.completedSets() === 0) return;
    this.stopTimer();

    // rezumatul de final: total ridicat + comparatie cu ultima sesiune identica
    const volume = this.sessionVolume();
    this.finishedVolume.set(Math.round(volume));
    const name = this.currentRoutine().name.trim().toLowerCase();
    const exerciseNames = this.currentRoutine().exercises.map(ex => exerciseKey(ex.name)).sort().join('|');
    const previous = this.historyWorkouts.find(w => w.name.trim().toLowerCase() === name && w.exercises.map(ex => exerciseKey(ex.exerciseName)).sort().join('|') === exerciseNames);
    this.finishedPrevious.set(previous ?? null);
    this.sessionEndedAt ??= Date.now();
    this.finishedDuration.set(Math.min(604800, Math.max(0, Math.floor((this.sessionEndedAt - this.sessionStartedAt) / 1000))));
    this.finishedExercises.set(this.currentRoutine().exercises.map((ex,i) => ({name:ex.name, sets:this.loggedWeights[i].filter(v => v !== null).length, volume:Math.round(this.loggedWeights[i].reduce<number>((sum,w,j) => sum + (w ?? 0) * (this.loggedReps[i][j] ?? 0),0))})).filter(ex => ex.sets > 0));
    this.finishedDelta.set(previous ? Math.round(volume - workoutVolume(previous)) : null);

    this.saveWorkout();
  }

  cancelWorkout() {
    this.stopTimer();
    this.sessionGeneration++;
    this.unlockPageScroll();
    this.state.set('setup');
  }

  saveWorkout() {
    const workout = this.currentRoutine();
    const dateStr = this.targetDate();
    const uid = this.authService.currentUserId;
    this.saving.set(true);

    this.workoutService.addWorkout({
      userId: uid,
      name: workout.name,
      date: dateStr,
      notes: 'Auto-finished workout',
      durationSeconds: this.finishedDuration(),
      isPredefined: false,
      exercises: workout.exercises.map((ex, i) => {
        const logged = (this.loggedWeights[i] ?? []).filter((value): value is number => value !== null);
        const reps = (this.loggedReps[i] ?? []).filter((value): value is number => value !== null);
        return {
          exerciseName: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: logged.length,
          // valorile "oficiale" devin maximul lucrat efectiv
          reps: reps.length ? Math.max(...reps) : ex.reps,
          ...(ex.repUnit ? { repUnit: ex.repUnit } : {}),
          weight: logged.length ? Math.max(...logged) : ex.weight,
          ...(logged.length ? { setWeights: logged } : {}),
          ...(reps.length ? { setReps: reps } : {}),
        };
      }).filter(exercise => exercise.sets > 0)
    }).subscribe({
      next: saved => {
        this.savedLocally.set(!!saved.id?.startsWith('w_'));
        this.saving.set(false);
        this.unlockPageScroll();
        this.state.set('finished');
        this.message.success(this.savedLocally() ? 'Saved on this device. Syncs when you reconnect.' : 'Workout saved.');
      },
      error: (err) => {
        this.saving.set(false);
        console.warn('[start-workout] Failed to auto-save workout', err);
        this.message.error('Failed to save workout data.');
      }
    });
  }

  async exportSummary() {
    if (this.state() !== 'finished' || this.exporting()) return;
    this.exporting.set(true);
    try {
      this.summaryImage.set(createWorkoutSummaryImage({name:this.currentRoutine().name,date:this.targetDate(),durationSeconds:this.finishedDuration(),sets:this.completedSets(),plannedSets:this.totalSets(),volume:this.finishedVolume(),calories:this.finishedCalories(),delta:this.finishedDelta()}));
    } catch { this.message.error('Could not save the image. Please try again.'); }
    finally { this.exporting.set(false); }
  }

  reset() {
    this.stopTimer();
    this.sessionGeneration++;
    this.unlockPageScroll();
    this.state.set('setup');
  }
}

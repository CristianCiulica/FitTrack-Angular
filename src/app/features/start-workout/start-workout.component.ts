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
    tagline: "The Austrian Oak's Golden Era split — 5 classic routines.",
    description:
      "Train like the 7x Mr. Olympia. Arnold's legendary high-volume split: chest & back supersets, brutal shoulder and arm days, and the famous Golden Six for full-body foundations.",
    tone: 'purple',
    routines: [
      {
        name: 'The Golden Six',
        category: 'Full body',
        exercises: [
          { name: 'Back Squats', sets: 4, reps: 10, weight: 60, muscleGroup: 'Legs' },
          { name: 'Wide-Grip Bench Press', sets: 3, reps: 10, weight: 50, muscleGroup: 'Chest' },
          { name: 'Chin-ups', sets: 3, reps: 8, weight: 0, muscleGroup: 'Back' },
          { name: 'Behind-the-Neck Press', sets: 4, reps: 10, weight: 30, muscleGroup: 'Shoulders' },
          { name: 'Barbell Curls', sets: 3, reps: 10, weight: 25, muscleGroup: 'Arms' },
          { name: 'Bent-Knee Sit-ups', sets: 3, reps: 20, weight: 0, muscleGroup: 'Core' },
        ],
      },
      {
        name: 'Chest & Back',
        category: 'Superset day',
        exercises: [
          { name: 'Bench Press', sets: 5, reps: 8, weight: 70, muscleGroup: 'Chest' },
          { name: 'Incline Bench Press', sets: 4, reps: 10, weight: 50, muscleGroup: 'Chest' },
          { name: 'Dumbbell Pullovers', sets: 4, reps: 12, weight: 20, muscleGroup: 'Chest' },
          { name: 'Wide-Grip Pull-ups', sets: 5, reps: 8, weight: 0, muscleGroup: 'Back' },
          { name: 'Bent-Over Rows', sets: 5, reps: 10, weight: 55, muscleGroup: 'Back' },
          { name: 'Deadlifts', sets: 3, reps: 8, weight: 100, muscleGroup: 'Back' },
        ],
      },
      {
        name: 'Shoulders & Arms',
        category: 'Pump day',
        exercises: [
          { name: 'Clean & Press', sets: 4, reps: 8, weight: 40, muscleGroup: 'Shoulders' },
          { name: 'Lateral Raises', sets: 4, reps: 12, weight: 10, muscleGroup: 'Shoulders' },
          { name: 'Barbell Curls', sets: 5, reps: 10, weight: 30, muscleGroup: 'Arms' },
          { name: 'Concentration Curls', sets: 4, reps: 10, weight: 12, muscleGroup: 'Arms' },
          { name: 'Close-Grip Bench Press', sets: 4, reps: 10, weight: 40, muscleGroup: 'Arms' },
          { name: 'Tricep Pushdowns', sets: 4, reps: 12, weight: 25, muscleGroup: 'Arms' },
        ],
      },
      {
        name: 'Legs & Lower Back',
        category: 'Foundation day',
        exercises: [
          { name: 'Back Squats', sets: 5, reps: 10, weight: 80, muscleGroup: 'Legs' },
          { name: 'Walking Lunges', sets: 4, reps: 12, weight: 20, muscleGroup: 'Legs' },
          { name: 'Leg Curls', sets: 4, reps: 12, weight: 35, muscleGroup: 'Legs' },
          { name: 'Stiff-Leg Deadlifts', sets: 4, reps: 10, weight: 60, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raises', sets: 5, reps: 15, weight: 50, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Abs & Core Finisher',
        category: 'Core day',
        exercises: [
          { name: 'Sit-ups', sets: 4, reps: 25, weight: 0, muscleGroup: 'Core' },
          { name: 'Hanging Leg Raises', sets: 4, reps: 12, weight: 0, muscleGroup: 'Core' },
          { name: 'Russian Twists', sets: 4, reps: 20, weight: 10, muscleGroup: 'Core' },
          { name: 'Plank', sets: 3, reps: 1, weight: 0, muscleGroup: 'Core' },
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
      "Mentzer's Heavy Duty philosophy: brief, brutally intense workouts with few working sets taken beyond failure, then days of full recovery. The opposite of volume training — quality over quantity.",
    tone: 'blue',
    routines: [
      {
        name: 'Chest & Back HIT',
        category: 'Heavy Duty',
        exercises: [
          { name: 'Incline Bench Press', sets: 2, reps: 8, weight: 70, muscleGroup: 'Chest' },
          { name: 'Pec Deck Flys', sets: 2, reps: 8, weight: 50, muscleGroup: 'Chest' },
          { name: 'Close-Grip Pulldowns', sets: 2, reps: 8, weight: 60, muscleGroup: 'Back' },
          { name: 'Deadlifts', sets: 1, reps: 8, weight: 120, muscleGroup: 'Back' },
        ],
      },
      {
        name: 'Legs HIT',
        category: 'Heavy Duty',
        exercises: [
          { name: 'Leg Extensions', sets: 2, reps: 10, weight: 50, muscleGroup: 'Legs' },
          { name: 'Leg Press', sets: 2, reps: 10, weight: 200, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raises', sets: 2, reps: 12, weight: 70, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Shoulders & Arms HIT',
        category: 'Heavy Duty',
        exercises: [
          { name: 'Lateral Raises', sets: 2, reps: 10, weight: 12, muscleGroup: 'Shoulders' },
          { name: 'Rear Delt Flys', sets: 2, reps: 10, weight: 10, muscleGroup: 'Shoulders' },
          { name: 'Barbell Curls', sets: 1, reps: 8, weight: 35, muscleGroup: 'Arms' },
          { name: 'Tricep Dips', sets: 2, reps: 8, weight: 20, muscleGroup: 'Arms' },
        ],
      },
    ],
  },
  {
    id: 'cbum',
    name: 'Cbum Classic Plan',
    athlete: 'Chris Bumstead',
    title: '6× Classic Physique Mr. Olympia',
    tagline: 'The modern classic physique split, straight from Cbum.',
    description:
      "Chris Bumstead's aesthetic-first training: controlled tempo, full range of motion and smart volume across a 5-day split. Built for that timeless Classic Physique look — proportion over pure mass.",
    tone: 'cyan',
    routines: [
      {
        name: 'Cbum Back Day',
        category: 'Pull',
        exercises: [
          { name: 'Deadlifts', sets: 4, reps: 6, weight: 140, muscleGroup: 'Back' },
          { name: 'Lat Pulldown', sets: 4, reps: 10, weight: 60, muscleGroup: 'Back' },
          { name: 'T-Bar Rows', sets: 4, reps: 10, weight: 60, muscleGroup: 'Back' },
          { name: 'Straight-Arm Pulldown', sets: 3, reps: 12, weight: 30, muscleGroup: 'Back' },
          { name: 'Rear Delt Flys', sets: 3, reps: 15, weight: 10, muscleGroup: 'Shoulders' },
        ],
      },
      {
        name: 'Cbum Chest Day',
        category: 'Push',
        exercises: [
          { name: 'Incline Dumbbell Press', sets: 4, reps: 10, weight: 32, muscleGroup: 'Chest' },
          { name: 'Bench Press', sets: 4, reps: 8, weight: 90, muscleGroup: 'Chest' },
          { name: 'Cable Flys', sets: 3, reps: 12, weight: 20, muscleGroup: 'Chest' },
          { name: 'Weighted Dips', sets: 3, reps: 10, weight: 20, muscleGroup: 'Chest' },
        ],
      },
      {
        name: 'Cbum Quad Day',
        category: 'Legs',
        exercises: [
          { name: 'Back Squats', sets: 4, reps: 8, weight: 140, muscleGroup: 'Legs' },
          { name: 'Hack Squats', sets: 4, reps: 10, weight: 120, muscleGroup: 'Legs' },
          { name: 'Leg Extensions', sets: 4, reps: 12, weight: 55, muscleGroup: 'Legs' },
          { name: 'Walking Lunges', sets: 3, reps: 20, weight: 24, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Cbum Shoulders & Arms',
        category: 'Push',
        exercises: [
          { name: 'Dumbbell Shoulder Press', sets: 4, reps: 10, weight: 28, muscleGroup: 'Shoulders' },
          { name: 'Lateral Raises', sets: 4, reps: 15, weight: 12, muscleGroup: 'Shoulders' },
          { name: 'EZ-Bar Curls', sets: 4, reps: 10, weight: 30, muscleGroup: 'Arms' },
          { name: 'Skull Crushers', sets: 4, reps: 10, weight: 30, muscleGroup: 'Arms' },
        ],
      },
      {
        name: 'Cbum Hamstrings & Glutes',
        category: 'Legs',
        exercises: [
          { name: 'Romanian Deadlifts', sets: 4, reps: 10, weight: 100, muscleGroup: 'Legs' },
          { name: 'Hip Thrusts', sets: 4, reps: 10, weight: 120, muscleGroup: 'Legs' },
          { name: 'Leg Curls', sets: 4, reps: 12, weight: 45, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raises', sets: 4, reps: 15, weight: 60, muscleGroup: 'Legs' },
        ],
      },
    ],
  },
  {
    id: 'ronnie',
    name: 'Ronnie Coleman Power Plan',
    athlete: 'Ronnie Coleman',
    title: '8× Mr. Olympia',
    tagline: 'Yeah buddy! Heavy power-bodybuilding, lightweight baby!',
    description:
      "The King's power-bodybuilding: squat and deadlift heavy like a powerlifter, then pump like a bodybuilder. Massive compound lifts, serious volume, zero excuses — everybody wants to be a bodybuilder...",
    tone: 'green',
    routines: [
      {
        name: 'Heavy Back & Deads',
        category: 'Power day',
        exercises: [
          { name: 'Deadlifts', sets: 5, reps: 5, weight: 180, muscleGroup: 'Back' },
          { name: 'Barbell Rows', sets: 4, reps: 8, weight: 90, muscleGroup: 'Back' },
          { name: 'T-Bar Rows', sets: 4, reps: 10, weight: 70, muscleGroup: 'Back' },
          { name: 'Lat Pulldown', sets: 3, reps: 12, weight: 65, muscleGroup: 'Back' },
        ],
      },
      {
        name: 'Heavy Squat Day',
        category: 'Power day',
        exercises: [
          { name: 'Back Squats', sets: 5, reps: 5, weight: 180, muscleGroup: 'Legs' },
          { name: 'Front Squats', sets: 4, reps: 8, weight: 100, muscleGroup: 'Legs' },
          { name: 'Leg Press', sets: 4, reps: 12, weight: 300, muscleGroup: 'Legs' },
          { name: 'Leg Curls', sets: 3, reps: 12, weight: 45, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Chest & Triceps Power',
        category: 'Push',
        exercises: [
          { name: 'Bench Press', sets: 5, reps: 6, weight: 120, muscleGroup: 'Chest' },
          { name: 'Incline Dumbbell Press', sets: 4, reps: 10, weight: 40, muscleGroup: 'Chest' },
          { name: 'Cable Flys', sets: 3, reps: 12, weight: 22, muscleGroup: 'Chest' },
          { name: 'Close-Grip Bench Press', sets: 4, reps: 8, weight: 80, muscleGroup: 'Arms' },
        ],
      },
      {
        name: 'Shoulders & Biceps Pump',
        category: 'Pump day',
        exercises: [
          { name: 'Military Press', sets: 4, reps: 8, weight: 60, muscleGroup: 'Shoulders' },
          { name: 'Lateral Raises', sets: 4, reps: 12, weight: 14, muscleGroup: 'Shoulders' },
          { name: 'Barbell Curls', sets: 4, reps: 10, weight: 40, muscleGroup: 'Arms' },
          { name: 'Hammer Curls', sets: 3, reps: 12, weight: 18, muscleGroup: 'Arms' },
        ],
      },
    ],
  },
  {
    id: 'dorian',
    name: 'Dorian Yates Blood & Guts',
    athlete: 'Dorian Yates',
    title: '6× Mr. Olympia',
    tagline: 'One all-out working set. Nothing left in the tank.',
    description:
      "The Shadow's Blood & Guts training: warm up, then ONE working set per exercise past failure — forced reps, drop sets, total war. Short, savage sessions that changed bodybuilding forever.",
    tone: 'pink',
    routines: [
      {
        name: 'Blood & Guts Back',
        category: 'HIT',
        exercises: [
          { name: 'Lat Pulldown', sets: 2, reps: 8, weight: 70, muscleGroup: 'Back' },
          { name: 'Barbell Rows', sets: 2, reps: 8, weight: 100, muscleGroup: 'Back' },
          { name: 'Seated Cable Rows', sets: 1, reps: 8, weight: 80, muscleGroup: 'Back' },
          { name: 'Deadlifts', sets: 1, reps: 8, weight: 150, muscleGroup: 'Back' },
        ],
      },
      {
        name: 'Blood & Guts Chest & Delts',
        category: 'HIT',
        exercises: [
          { name: 'Incline Bench Press', sets: 2, reps: 8, weight: 90, muscleGroup: 'Chest' },
          { name: 'Machine Chest Press', sets: 1, reps: 8, weight: 80, muscleGroup: 'Chest' },
          { name: 'Cable Flys', sets: 1, reps: 10, weight: 25, muscleGroup: 'Chest' },
          { name: 'Lateral Raises', sets: 2, reps: 10, weight: 15, muscleGroup: 'Shoulders' },
        ],
      },
      {
        name: 'Blood & Guts Legs',
        category: 'HIT',
        exercises: [
          { name: 'Leg Extensions', sets: 2, reps: 12, weight: 55, muscleGroup: 'Legs' },
          { name: 'Leg Press', sets: 2, reps: 10, weight: 250, muscleGroup: 'Legs' },
          { name: 'Hack Squats', sets: 1, reps: 10, weight: 120, muscleGroup: 'Legs' },
          { name: 'Leg Curls', sets: 2, reps: 10, weight: 50, muscleGroup: 'Legs' },
          { name: 'Standing Calf Raises', sets: 2, reps: 12, weight: 80, muscleGroup: 'Legs' },
        ],
      },
      {
        name: 'Blood & Guts Arms',
        category: 'HIT',
        exercises: [
          { name: 'Barbell Curls', sets: 2, reps: 8, weight: 40, muscleGroup: 'Arms' },
          { name: 'Preacher Curls', sets: 1, reps: 8, weight: 30, muscleGroup: 'Arms' },
          { name: 'Tricep Pushdowns', sets: 2, reps: 10, weight: 35, muscleGroup: 'Arms' },
          { name: 'Weighted Dips', sets: 1, reps: 8, weight: 25, muscleGroup: 'Arms' },
        ],
      },
    ],
  },
];

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

  // progressive overload: greutatea setului curent + ce ai logat la fiecare set
  currentWeight = signal(0);
  private loggedWeights: number[][] = [];
  // ultima greutate folosita pe fiecare exercitiu, din istoricul salvat
  private lastWeights = signal(new Map<string, number>());

  // greutatea folosita data trecuta la exercitiul curent (hint de progres)
  lastTimeWeight = computed(() => {
    const ex = this.currentExercise();
    if (!ex) return null;
    return this.lastWeights().get(ex.name.toLowerCase()) ?? null;
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
      error: (err) => {
        console.warn('[start-workout] Failed to save workout', err);
        this.message.error('Failed to save workout.');
      }
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
    this.loadLastWeights();
    this.syncCurrentWeight();
    this.state.set('active');
  }

  // cauta in istoricul salvat ultima greutate folosita la fiecare exercitiu
  private loadLastWeights() {
    this.lastWeights.set(new Map());
    this.workoutService.getWorkouts().subscribe((workouts) => {
      const map = new Map<string, number>();
      const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
      for (const w of sorted) {
        for (const ex of w.exercises) {
          const key = ex.exerciseName.toLowerCase();
          if (map.has(key)) continue;
          const logged = ex.setWeights?.length ? Math.max(...ex.setWeights) : ex.weight;
          if (logged > 0) map.set(key, logged);
        }
      }
      this.lastWeights.set(map);
      // istoricul soseste asincron; reasezam greutatea propusa acum ca stim
      // cat s-a lucrat data trecuta (doar daca userul nu a logat inca un set)
      if (this.workoutInProgress() && !this.loggedWeights[this.currentExerciseIndex()]?.length) {
        this.syncCurrentWeight();
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

  finishSet() {
    const exIdx = this.currentExerciseIndex();
    this.loggedWeights[exIdx]?.push(this.currentWeight());
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
      this.state.set('active');
    } else {
      if (this.currentExerciseIndex() + 1 < this.currentRoutine().exercises.length) {
        this.currentExerciseIndex.set(this.currentExerciseIndex() + 1);
        this.currentSetIndex.set(1);
        this.syncCurrentWeight();
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

  private finishWorkout() {
    this.stopTimer();
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
        return {
          exerciseName: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: ex.sets,
          reps: ex.reps,
          // greutatea "oficiala" devine maximul lucrat efectiv
          weight: logged.length ? Math.max(...logged) : ex.weight,
          ...(logged.length ? { setWeights: logged } : {}),
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

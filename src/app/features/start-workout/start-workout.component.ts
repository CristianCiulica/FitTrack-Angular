import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/services/auth.service';
import { WorkoutService } from '../../core/services/workout.service';
import { MuscleGroup, Workout } from '../../core/models/workout.model';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';

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
  exercises: PlannedExercise[];
}

const PREDEFINED_ROUTINES: Routine[] = [
  {
    name: 'Push Day (Chest, Shoulders, Triceps)',
    exercises: [
      { name: 'Bench Press', sets: 4, reps: 10, weight: 60, muscleGroup: 'Chest' },
      { name: 'Overhead Press', sets: 3, reps: 10, weight: 40, muscleGroup: 'Shoulders' },
      { name: 'Tricep Pushdowns', sets: 3, reps: 12, weight: 20, muscleGroup: 'Arms' },
    ]
  },
  {
    name: 'Pull Day (Back, Biceps)',
    exercises: [
      { name: 'Pull-ups', sets: 4, reps: 8, weight: 0, muscleGroup: 'Back' },
      { name: 'Barbell Rows', sets: 4, reps: 10, weight: 50, muscleGroup: 'Back' },
      { name: 'Bicep Curls', sets: 3, reps: 12, weight: 15, muscleGroup: 'Arms' },
    ]
  },
  {
    name: 'Leg Day',
    exercises: [
      { name: 'Squats', sets: 4, reps: 8, weight: 80, muscleGroup: 'Legs' },
      { name: 'Leg Press', sets: 3, reps: 12, weight: 120, muscleGroup: 'Legs' },
      { name: 'Calf Raises', sets: 4, reps: 15, weight: 60, muscleGroup: 'Legs' },
    ]
  }
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
    NzAvatarModule,
    NzCardModule,
    NzProgressModule,
    NzTagModule,
    WorkoutModalComponent,
  ],
  templateUrl: './start-workout.component.html',
  styleUrls: ['./start-workout.component.scss']
})
export class StartWorkoutComponent implements OnInit, OnDestroy {
  state = signal<'setup' | 'active' | 'rest' | 'finished'>('setup');

  routines = PREDEFINED_ROUTINES;
  personalRoutines = signal<Routine[]>([]);
  selectedRoutineKey = signal('predefined-0');
  modalVisible = signal(false);

  currentRoutine = signal<Routine>({ name: 'Custom Workout', exercises: [] });

  // Active state vars
  currentExerciseIndex = signal(0);
  currentSetIndex = signal(1);

  // Rest state vars
  restTimeTarget = signal(60);
  restTimeRemaining = signal(60);
  private timerInterval: any;

  userName = computed(() => {
    const u = this.authService.currentUser();
    return u?.displayName ?? u?.email ?? 'Athlete';
  });

  currentExercise = computed(() => {
    const ex = this.currentRoutine().exercises;
    const idx = this.currentExerciseIndex();
    if (idx < ex.length) return ex[idx];
    return null;
  });

  progressPercent = computed(() => {
    const totalSets = this.currentRoutine().exercises.reduce((acc, ex) => acc + ex.sets, 0);
    if (totalSets === 0) return 0;

    // completed sets
    let completed = 0;
    const exList = this.currentRoutine().exercises;
    for (let i = 0; i < this.currentExerciseIndex(); i++) completed += exList[i].sets;
    completed += (this.currentSetIndex() - 1);

    return Math.round((completed / totalSets) * 100);
  });

  constructor(
    private authService: AuthService,
    private workoutService: WorkoutService
  ) {}

  ngOnInit() {
    this.selectRoutine(this.routines[0], 'predefined-0');
    this.loadPersonalRoutines();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  logout() {
    this.authService.logout().subscribe();
  }

  selectRoutine(routine: Routine, key: string) {
    this.selectedRoutineKey.set(key);
    this.currentRoutine.set(JSON.parse(JSON.stringify(routine)));
  }

  openAddWorkout() {
    this.modalVisible.set(true);
  }

  onModalSave(workout: Partial<Workout>) {
    this.workoutService.addWorkout({
      userId: this.authService.currentUserId,
      name: workout.name || 'My workout',
      date: workout.date || new Date().toISOString().split('T')[0],
      notes: workout.notes ?? '',
      exercises: workout.exercises || [],
      isPredefined: false,
    }).subscribe(() => {
      this.modalVisible.set(false);
      this.loadPersonalRoutines();
    });
  }

  onModalCancel() {
    this.modalVisible.set(false);
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
    this.state.set('active');
  }

  finishSet() {
    // If not the last set or last exercise, go to rest
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
      // next set
      this.currentSetIndex.set(this.currentSetIndex() + 1);
      this.state.set('active');
    } else {
      // next exercise
      if (this.currentExerciseIndex() + 1 < this.currentRoutine().exercises.length) {
        this.currentExerciseIndex.set(this.currentExerciseIndex() + 1);
        this.currentSetIndex.set(1);
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
    const dateStr = new Date().toISOString().split('T')[0];
    const uid = this.authService.currentUserId;

    this.workoutService.addWorkout({
      userId: uid,
      name: workout.name,
      date: dateStr,
      notes: 'Auto-finished workout',
      isPredefined: false,
      exercises: workout.exercises.map(ex => ({
        exerciseName: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight
      }))
    }).subscribe(); // Ignoring sub errors for brevity here
  }

  reset() {
    this.state.set('setup');
  }
}

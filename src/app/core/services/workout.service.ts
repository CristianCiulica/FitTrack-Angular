import { Injectable, signal, computed, inject } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { Workout } from '../models/workout.model';
import { Observable, of, from } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  totalWorkouts = signal<number>(0);
  workouts = signal<Workout[]>([]);
  private readonly auth = inject(Auth);
  private readonly authState$ = user(this.auth);
  private readonly storagePrefix = 'fittrack_workouts';

  totalVolume = computed(() =>
    this.workouts().reduce((acc, w) => {
      const wVol = w.exercises?.reduce((eAcc, e) => eAcc + e.sets * e.reps * e.weight, 0) || 0;
      return acc + wVol;
    }, 0),
  );

  getWorkouts(): Observable<Workout[]> {
    return this.authState$.pipe(
      map((u) => this.loadWorkouts(u?.uid ?? '')),
    );
  }

  addWorkout(workout: Omit<Workout, 'id'>) {
    const uid = workout.userId;
    const current = this.loadWorkouts(uid);
    const nextWorkout: Workout = {
      ...workout,
      id: this.createWorkoutId(),
    };
    this.saveWorkouts(uid, [nextWorkout, ...current]);
    return of(nextWorkout);
  }

  updateWorkout(id: string, workout: Partial<Workout>) {
    const uid = workout.userId ?? this.auth.currentUser?.uid ?? '';
    const current = this.loadWorkouts(uid);
    const updated = current.map((item) => (item.id === id ? { ...item, ...workout } : item));
    this.saveWorkouts(uid, updated);
    return of(updated.find((item) => item.id === id));
  }

  deleteWorkout(id: string) {
    const uid = this.auth.currentUser?.uid ?? '';
    const current = this.loadWorkouts(uid);
    this.saveWorkouts(uid, current.filter((item) => item.id !== id));
    return of(void 0);
  }

  private getStorageKey(userId: string): string {
    return `${this.storagePrefix}:${userId}`;
  }

  private loadWorkouts(userId: string): Workout[] {
    if (!userId || typeof window === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(this.getStorageKey(userId));
    if (!raw) {
      const predefinedWorkouts = this.getPredefinedWorkouts(userId);
      this.saveWorkouts(userId, predefinedWorkouts);
      return predefinedWorkouts;
    }

    try {
      return (JSON.parse(raw) as Workout[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch {
      return [];
    }
  }

  private saveWorkouts(userId: string, workouts: Workout[]): void {
    if (!userId || typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(this.getStorageKey(userId), JSON.stringify(workouts));
    this.workouts.set(workouts);
    this.totalWorkouts.set(workouts.length);
  }

  private createWorkoutId(): string {
    return `w_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private getPredefinedWorkouts(userId: string): Workout[] {
    const today = new Date();
    const formatDate = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    return [
      {
        id: this.createWorkoutId() + '1',
        userId,
        name: 'Ziua de Piept & Triceps',
        date: formatDate(1),
        notes: 'Antrenament intens de împins',
        exercises: [
          { exerciseName: 'Bench Press', muscleGroup: 'Chest', sets: 4, reps: 10, weight: 80 },
          { exerciseName: 'Incline Dumbbell Press', muscleGroup: 'Chest', sets: 3, reps: 12, weight: 30 },
          { exerciseName: 'Tricep Pushdowns', muscleGroup: 'Arms', sets: 3, reps: 15, weight: 25 }
        ]
      },
      {
        id: this.createWorkoutId() + '2',
        userId,
        name: 'Ziua de Picioare',
        date: formatDate(2),
        notes: 'Pauză 2min între seturi',
        exercises: [
          { exerciseName: 'Squats', muscleGroup: 'Legs', sets: 4, reps: 8, weight: 100 },
          { exerciseName: 'Leg Press', muscleGroup: 'Legs', sets: 3, reps: 15, weight: 150 }
        ]
      },
      {
        id: this.createWorkoutId() + '3',
        userId,
        name: 'Spate & Biceps',
        date: formatDate(3),
        notes: 'Focus pe contracție',
        exercises: [
          { exerciseName: 'Pull-ups', muscleGroup: 'Back', sets: 4, reps: 10, weight: 0 },
          { exerciseName: 'Barbell Rows', muscleGroup: 'Back', sets: 4, reps: 8, weight: 70 },
          { exerciseName: 'Bicep Curls', muscleGroup: 'Arms', sets: 3, reps: 12, weight: 15 }
        ]
      },
      {
        id: this.createWorkoutId() + '4',
        userId,
        name: 'Umeri - Volum',
        date: formatDate(4),
        notes: 'Fără pauze mari',
        exercises: [
          { exerciseName: 'Overhead Press', muscleGroup: 'Shoulders', sets: 3, reps: 10, weight: 50 },
          { exerciseName: 'Lateral Raises', muscleGroup: 'Shoulders', sets: 4, reps: 15, weight: 12.5 }
        ]
      }
    ];
  }
}

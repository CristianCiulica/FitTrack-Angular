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
    this.workouts().reduce((acc, w) => acc + w.sets * w.reps * w.weight, 0),
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
      { id: this.createWorkoutId() + '1', userId, exerciseName: 'Bench Press', muscleGroup: 'Chest', sets: 4, reps: 10, weight: 80, date: formatDate(1), notes: 'Mișcare controlată' },
      { id: this.createWorkoutId() + '2', userId, exerciseName: 'Incline Dumbbell Press', muscleGroup: 'Chest', sets: 3, reps: 12, weight: 30, date: formatDate(1), notes: '' },
      { id: this.createWorkoutId() + '3', userId, exerciseName: 'Squats', muscleGroup: 'Legs', sets: 4, reps: 8, weight: 100, date: formatDate(2), notes: 'Pauză 2min între seturi' },
      { id: this.createWorkoutId() + '4', userId, exerciseName: 'Leg Press', muscleGroup: 'Legs', sets: 3, reps: 15, weight: 150, date: formatDate(2), notes: '' },
      { id: this.createWorkoutId() + '5', userId, exerciseName: 'Pull-ups', muscleGroup: 'Back', sets: 4, reps: 10, weight: 0, date: formatDate(3), notes: 'Bodyweight' },
      { id: this.createWorkoutId() + '6', userId, exerciseName: 'Barbell Rows', muscleGroup: 'Back', sets: 4, reps: 8, weight: 70, date: formatDate(3), notes: '' },
      { id: this.createWorkoutId() + '7', userId, exerciseName: 'Overhead Press', muscleGroup: 'Shoulders', sets: 3, reps: 10, weight: 50, date: formatDate(4), notes: '' },
      { id: this.createWorkoutId() + '8', userId, exerciseName: 'Lateral Raises', muscleGroup: 'Shoulders', sets: 4, reps: 15, weight: 12.5, date: formatDate(4), notes: '' },
      { id: this.createWorkoutId() + '9', userId, exerciseName: 'Bicep Curls', muscleGroup: 'Arms', sets: 3, reps: 12, weight: 15, date: formatDate(5), notes: '' },
      { id: this.createWorkoutId() + '10', userId, exerciseName: 'Tricep Pushdowns', muscleGroup: 'Arms', sets: 3, reps: 15, weight: 25, date: formatDate(5), notes: 'Cablu' }
    ];
  }
}

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
      return [];
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
}

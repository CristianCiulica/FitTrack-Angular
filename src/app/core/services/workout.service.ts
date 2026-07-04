import { Injectable, signal, computed, inject } from '@angular/core';
import { Workout } from '../models/workout.model';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  // folosim signals pentru statistici/lista
  totalWorkouts = signal<number>(0);
  workouts = signal<Workout[]>([]);
  private readonly api = inject(ApiService);

  totalVolume = computed(() =>
    this.workouts().reduce((acc, w) => {
      const wVol = w.exercises?.reduce((eAcc, e) => eAcc + e.sets * e.reps * e.weight, 0) || 0;
      return acc + wVol;
    }, 0),
  );

  getWorkouts(): Observable<Workout[]> {
    return this.api.get<{ workouts: Workout[] }>('/workouts').pipe(
      map((res) => res.workouts),
      tap((workouts) => {
        this.workouts.set(workouts);
        this.totalWorkouts.set(workouts.length);
      }),
    );
  }

  addWorkout(workout: Omit<Workout, 'id'>): Observable<Workout> {
    return this.api
      .post<{ workout: Workout }>('/workouts', workout)
      .pipe(map((res) => res.workout));
  }

  updateWorkout(id: string, workout: Partial<Workout>): Observable<Workout> {
    return this.api
      .put<{ workout: Workout }>(`/workouts/${id}`, workout)
      .pipe(map((res) => res.workout));
  }

  deleteWorkout(id: string): Observable<void> {
    return this.api.delete<{ deleted: boolean }>(`/workouts/${id}`).pipe(map(() => void 0));
  }
}

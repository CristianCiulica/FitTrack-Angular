import { Injectable, signal, computed, inject } from '@angular/core';
import { Workout } from '../models/workout.model';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  totalWorkouts = signal<number>(0);
  workouts = signal<Workout[]>([]);
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);

  totalVolume = computed(() =>
    this.workouts().reduce((acc, w) => {
      const wVol = w.exercises?.reduce((eAcc, e) => eAcc + e.sets * e.reps * e.weight, 0) || 0;
      return acc + wVol;
    }, 0),
  );

  private getStorageKey(): string {
    const uid = this.auth.currentUser?.uid || 'local';
    // IMPORTANT: prefix diferit de `fittrack_workouts:` — acela e citit de MigrationService
    // ca "date vechi de migrat"; daca am scrie acolo, cache-ul ar fi re-trimis la /api/migrate
    // si ar duplica toate datele in Mongo.
    return `fittrack_cache_workouts:${uid}`;
  }

  private loadLocal(): Workout[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocal(workouts: Workout[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.getStorageKey(), JSON.stringify(workouts));
    this.workouts.set(workouts);
    this.totalWorkouts.set(workouts.length);
  }

  // itemele create offline primesc id temporar pana ajung pe server
  private isTempId(id?: string): boolean {
    return !!id && id.startsWith('w_');
  }

  getWorkouts(): Observable<Workout[]> {
    return this.api.get<{ workouts: Workout[] }>('/workouts').pipe(
      map((res) => res.workouts),
      map((serverWorkouts) => {
        // nu pierdem itemele create offline: le pastram in fata listei si le re-trimitem
        const pending = this.loadLocal().filter((w) => this.isTempId(w.id));
        const merged = [...pending, ...serverWorkouts];
        this.saveLocal(merged);
        this.resyncPending(pending);
        return merged;
      }),
      catchError((err) => {
        console.warn('API get workouts failed, using local storage', err);
        const local = this.loadLocal();
        this.workouts.set(local);
        this.totalWorkouts.set(local.length);
        return of(local);
      })
    );
  }

  // re-trimite pe server workout-urile salvate doar local cat timp API-ul era picat
  private resyncPending(pending: Workout[]): void {
    for (const workout of pending) {
      this.api.post<{ workout: Workout }>('/workouts', workout).subscribe({
        next: ({ workout: saved }) => {
          const updated = this.loadLocal().map((item) => (item.id === workout.id ? saved : item));
          this.saveLocal(updated);
        },
        error: (err) => console.warn('[workouts] resync failed, will retry next load', err),
      });
    }
  }

  addWorkout(workout: Omit<Workout, 'id'>): Observable<Workout> {
    const tempId = 'w_' + Date.now();
    const newWorkout = { ...workout, id: tempId } as Workout;
    
    // Optimistic local update
    const current = this.loadLocal();
    this.saveLocal([newWorkout, ...current]);

    return this.api.post<{ workout: Workout }>('/workouts', workout).pipe(
      map((res) => res.workout),
      tap((w) => {
        // Replace temp workout with real one from API
        const updated = this.loadLocal().map(item => item.id === tempId ? w : item);
        this.saveLocal(updated);
      }),
      catchError((err) => {
        console.warn('API add workout failed, using local storage', err);
        return of(newWorkout);
      })
    );
  }

  updateWorkout(id: string, workout: Partial<Workout>): Observable<Workout> {
    const current = this.loadLocal();
    const updated = current.map(item => item.id === id ? { ...item, ...workout } : item) as Workout[];
    this.saveLocal(updated);
    const local = updated.find(item => item.id === id) ?? ({ ...workout, id } as Workout);

    // id temporar = inca nu exista pe server; PUT-ul ar da CastError
    if (this.isTempId(id)) {
      return of(local);
    }

    return this.api.put<{ workout: Workout }>(`/workouts/${id}`, workout).pipe(
      map((res) => res.workout),
      catchError((err) => {
        console.warn('API update workout failed, using local storage', err);
        return of(local);
      })
    );
  }

  deleteWorkout(id: string): Observable<void> {
    const current = this.loadLocal();
    this.saveLocal(current.filter(item => item.id !== id));

    // id temporar = exista doar local; nu are ce sterge pe server
    if (this.isTempId(id)) {
      return of(void 0);
    }

    return this.api.delete<{ deleted: boolean }>(`/workouts/${id}`).pipe(
      map(() => void 0),
      catchError((err) => {
        console.warn('API delete workout failed, using local storage', err);
        return of(void 0);
      })
    );
  }
}

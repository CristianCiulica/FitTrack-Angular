const fs = require('fs');
const path = './src/app/core/services/workout.service.ts';
let code = fs.readFileSync(path, 'utf8');

code = `import { Injectable, signal, computed, inject } from '@angular/core';
import { Workout } from '../models/workout.model';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  totalWorkouts = signal<number>(0);
  workouts = signal<Workout[]>([]);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  totalVolume = computed(() =>
    this.workouts().reduce((acc, w) => {
      const wVol = w.exercises?.reduce((eAcc, e) => eAcc + e.sets * e.reps * e.weight, 0) || 0;
      return acc + wVol;
    }, 0),
  );

  private getStorageKey(): string {
    const uid = this.auth.currentUser()?.uid || 'local';
    return \`fittrack_workouts:\${uid}\`;
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

  getWorkouts(): Observable<Workout[]> {
    return this.api.get<{ workouts: Workout[] }>('/workouts').pipe(
      map((res) => res.workouts),
      tap((workouts) => {
        this.saveLocal(workouts); // update local cache
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

    return this.api.put<{ workout: Workout }>(\`/workouts/\${id}\`, workout).pipe(
      map((res) => res.workout),
      catchError((err) => {
        console.warn('API update workout failed, using local storage', err);
        return of(updated.find(item => item.id === id) as Workout);
      })
    );
  }

  deleteWorkout(id: string): Observable<void> {
    const current = this.loadLocal();
    this.saveLocal(current.filter(item => item.id !== id));

    return this.api.delete<{ deleted: boolean }>(\`/workouts/\${id}\`).pipe(
      map(() => void 0),
      catchError((err) => {
        console.warn('API delete workout failed, using local storage', err);
        return of(void 0);
      })
    );
  }
}
\`;

fs.writeFileSync(path, code);
console.log('patched workout service');

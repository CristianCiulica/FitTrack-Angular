import { Injectable, signal, computed, inject } from '@angular/core';
import { Workout } from '../models/workout.model';
import { Observable, of } from 'rxjs';
import { map, tap, catchError, finalize, shareReplay, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  totalWorkouts = signal<number>(0);
  workouts = signal<Workout[]>([]);
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);
  private readonly uploads = new Map<string, Observable<Workout>>();
  private readonly uploadedIds = new Map<string, string>();

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
    for (const item of pending) {
      if (item.id && this.uploads.has(item.id)) continue;
      this.upload(item).subscribe({
        error: (err) => console.warn('[workouts] resync failed, will retry next load', err),
      });
    }
  }

  private upload(item: Workout): Observable<Workout> {
    const tempId = item.id!;
    const existing = this.uploads.get(tempId);
    if (existing) return existing;
    const upload = this.api.post<{ workout: Workout }>('/workouts', item).pipe(
      map(response => response.workout),
      tap(saved => {
        if (saved.id) this.uploadedIds.set(tempId, saved.id);
        this.saveLocal(this.loadLocal().map(record => record.id === tempId ? saved : record));
      }),
      finalize(() => this.uploads.delete(tempId)),
      // A delete waits for the same POST instead of starting another upload.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.uploads.set(tempId, upload);
    return upload;
  }

  addWorkout(workout: Omit<Workout, 'id'>): Observable<Workout> {
    const tempId = 'w_' + crypto.randomUUID();
    const newWorkout = { ...workout, id: tempId } as Workout;
    
    // Optimistic local update
    const current = this.loadLocal();
    this.saveLocal([newWorkout, ...current]);

    return this.upload(newWorkout).pipe(
      catchError((err) => {
        console.warn('API add workout failed, using local storage', err);
        return of(newWorkout);
      })
    );
  }

  updateWorkout(id: string, workout: Partial<Workout>): Observable<Workout> {
    id = this.uploadedIds.get(id) ?? id;
    const current = this.loadLocal();
    const updated = current.map(item => item.id === id ? { ...item, ...workout } : item) as Workout[];
    const local = updated.find(item => item.id === id) ?? ({ ...workout, id } as Workout);
    if (this.isTempId(id)) {
      this.saveLocal(updated);
      return of(local);
    }
    return this.api.put<{ workout: Workout }>(`/workouts/${id}`, workout).pipe(
      map(res => res.workout),
      tap(saved => this.saveLocal(this.loadLocal().map(item => item.id === id ? saved : item))),
    );
  }

  deleteWorkout(id: string): Observable<void> {
    const upload = this.uploads.get(id);
    if (upload) {
      // An offline item may already be uploading when its Delete button is
      // pressed. Wait for its server id, then delete that record as well.
      return upload.pipe(switchMap(saved => this.deleteWorkout(saved.id!)));
    }
    id = this.uploadedIds.get(id) ?? id;
    const removeLocal = () => this.saveLocal(this.loadLocal().filter(item => item.id !== id));
    if (this.isTempId(id)) {
      removeLocal();
      return of(void 0);
    }
    // A failed server deletion leaves the saved record available for retry.
    return this.api.delete<{ deleted: boolean }>(`/workouts/${id}`).pipe(
      tap(removeLocal),
      map(() => void 0),
    );
  }
}

import { Injectable, signal, computed, inject } from '@angular/core';
import { Workout } from '../models/workout.model';
import { Observable, of } from 'rxjs';
import { ReadCache } from '../utils/read-cache';
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

  private readonly volatileOwners = new Set<string>();
  private readonly memory = new Map<string, Workout[]>();
  private readonly reads = new ReadCache<Workout[]>();

  private owner(): string { return this.auth.currentUser?.uid || 'local'; }

  private getStorageKey(uid = this.owner()): string {
    // IMPORTANT: prefix diferit de `fittrack_workouts:` — acela e citit de MigrationService
    // ca "date vechi de migrat"; daca am scrie acolo, cache-ul ar fi re-trimis la /api/migrate
    // si ar duplica toate datele in Mongo.
    return `fittrack_cache_workouts:${uid}`;
  }

  private loadLocal(uid = this.owner()): Workout[] {
    if (this.volatileOwners.has(uid)) return this.memory.get(uid) ?? [];
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(uid));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.memory.get(uid) ?? [];
    }
  }

  private saveLocal(workouts: Workout[], uid = this.owner(), changed = true): void {
    if (uid === this.owner()) {
      this.workouts.set(workouts);
      this.totalWorkouts.set(workouts.length);
    }
    this.memory.set(uid, workouts);
    if (changed) this.reads.replace(uid, workouts);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(uid), JSON.stringify(workouts));
      this.volatileOwners.delete(uid);
    } catch { this.volatileOwners.add(uid); /* Keep the latest snapshot in memory. */ }
  }

  // itemele create offline primesc id temporar pana ajung pe server
  private isTempId(id?: string): boolean {
    return !!id && id.startsWith('w_');
  }

  getWorkouts(force = false): Observable<Workout[]> {
    const uid = this.owner();
    return this.reads.read(uid, () => this.loadLocal(uid), () =>
      this.api.get<{ workouts: Workout[] }>('/workouts').pipe(
        map(res => [...this.loadLocal(uid).filter(item => this.isTempId(item.id)), ...res.workouts]),
        catchError(() => of(this.loadLocal(uid))),
      ), value => {
        if (uid !== this.owner()) return;
        this.saveLocal(value, uid, false);
        this.resyncPending(value.filter(item => this.isTempId(item.id)));
      }, force).pipe(tap(value => { if (uid === this.owner()) { this.workouts.set(value); this.totalWorkouts.set(value.length); } }));
  }

  private resyncPending(pending: Workout[]): void {
    for (const item of pending) {
      if (item.id && this.uploads.has(item.id)) continue;
      this.upload(item).subscribe({
        error: (err) => console.warn('[workouts] resync failed, will retry next load', err),
      });
    }
  }

  private upload(item: Workout): Observable<Workout> {
    const uid = this.owner();
    const tempId = item.id!;
    const existing = this.uploads.get(tempId);
    if (existing) return existing;
    const upload = this.api.post<{ workout: Workout }>('/workouts', item).pipe(
      map(response => response.workout),
      tap(saved => {
        if (saved.id) this.uploadedIds.set(tempId, saved.id);
        this.saveLocal(this.loadLocal(uid).map(record => record.id === tempId ? saved : record), uid);
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
    const uid = this.owner();
    const current = this.loadLocal(uid);
    const updated = current.map(item => item.id === id ? { ...item, ...workout } : item) as Workout[];
    const local = updated.find(item => item.id === id) ?? ({ ...workout, id } as Workout);
    if (this.isTempId(id)) {
      this.saveLocal(updated);
      return of(local);
    }
    return this.api.put<{ workout: Workout }>(`/workouts/${id}`, workout).pipe(
      map(res => res.workout),
      tap(saved => this.saveLocal(this.loadLocal(uid).map(item => item.id === id ? saved : item), uid)),
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
    const uid = this.owner();
    const removeLocal = () => this.saveLocal(this.loadLocal(uid).filter(item => item.id !== id), uid);
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

import { Injectable, signal, computed, inject } from '@angular/core';
import { Workout } from '../models/workout.model';
import { Observable, of, defer } from 'rxjs';
import { isWorkoutSession } from '../utils/workout-kind';
import { workoutVolume } from '../utils/workout-history';
import { ReadCache } from '../utils/read-cache';
import { map, tap, catchError, finalize, shareReplay, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Auth } from '@angular/fire/auth';

const editable = (item: Workout) => ({
  name: item.name,
  date: item.date,
  exercises: item.exercises,
  kind: item.kind,
  notes: item.notes,
  durationSeconds: item.durationSeconds,
});

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  totalWorkouts = signal<number>(0);
  workouts = signal<Workout[]>([]);
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);
  private readonly uploads = new Map<string, Observable<Workout>>();
  private readonly uploadedIds = new Map<string, string>();

  totalVolume = computed(() =>
    this.workouts()
      .filter(isWorkoutSession)
      .reduce((acc, w) => acc + workoutVolume(w), 0),
  );

  private readonly volatileOwners = new Set<string>();
  private readonly memory = new Map<string, Workout[]>();
  private readonly reads = new ReadCache<Workout[]>();
  private readonly erasedOwners = new Set<string>();

  eraseCache(uid: string): void {
    this.erasedOwners.add(uid);
    this.memory.delete(uid);
    this.volatileOwners.delete(uid);
    this.reads.replace(uid, []);
    if (uid === this.owner()) {
      this.workouts.set([]);
      this.totalWorkouts.set(0);
    }
  }

  private owner(): string {
    return this.auth.currentUser?.uid || 'local';
  }

  private getStorageKey(uid = this.owner()): string {
    // IMPORTANT: prefix diferit de `fittrack_workouts:` — acela e citit de MigrationService
    // ca "date vechi de migrat"; daca am scrie acolo, cache-ul ar fi re-trimis la /api/migrate
    // si ar duplica toate datele in Mongo.
    return `fittrack_cache_workouts:${uid}`;
  }

  private loadLocal(uid = this.owner()): Workout[] {
    if (this.erasedOwners.has(uid)) return [];
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
    if (this.erasedOwners.has(uid)) return;
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
    } catch {
      this.volatileOwners.add(uid); /* Keep the latest snapshot in memory. */
    }
  }

  // itemele create offline primesc id temporar pana ajung pe server
  private isTempId(id?: string): boolean {
    return !!id && id.startsWith('w_');
  }

  isDurablySaved(workout: Workout): boolean {
    return !this.isTempId(workout.id) || !this.volatileOwners.has(this.owner());
  }

  getWorkouts(force = false): Observable<Workout[]> {
    const uid = this.owner();
    return this.reads
      .read(
        uid,
        () => this.loadLocal(uid),
        () =>
          this.api.get<{ workouts: Workout[] }>('/workouts').pipe(
            map((res) => {
              const pending = this.loadLocal(uid).filter(
                (item) => this.isTempId(item.id) || item.pendingUpdate,
              );
              return [
                ...pending,
                ...res.workouts.filter(
                  (item) =>
                    !pending.some(
                      (local) =>
                        local.id === item.id ||
                        (local.clientId && local.clientId === item.clientId),
                    ),
                ),
              ];
            }),
            catchError(() => of(this.loadLocal(uid))),
          ),
        (value) => {
          if (uid !== this.owner()) return;
          this.saveLocal(value, uid, false);
          this.resyncPending(value.filter((item) => this.isTempId(item.id) || item.pendingUpdate));
        },
        force,
      )
      .pipe(
        tap((value) => {
          if (uid === this.owner()) {
            this.workouts.set(value);
            this.totalWorkouts.set(value.length);
          }
        }),
      );
  }

  private resyncPending(pending: Workout[]): void {
    for (const item of pending) {
      if (item.id && this.uploads.has(item.id)) continue;
      (this.isTempId(item.id) ? this.upload(item) : this.syncEdit(item, this.owner())).subscribe({
        error: (err) => console.warn('[workouts] resync failed, will retry next load', err),
      });
    }
  }

  private upload(item: Workout): Observable<Workout> {
    const uid = this.owner();
    const tempId = item.id!;
    const existing = this.uploads.get(tempId);
    if (existing) return existing;
    const upload = this.api
      .post<{ workout: Workout }>('/workouts', { ...item, clientId: item.clientId ?? tempId })
      .pipe(
        map((response) => response.workout),
        switchMap((saved) => {
          const latest = this.loadLocal(uid).find((record) => record.id === tempId);
          return latest?.pendingUpdate ? this.flushEdit(latest, saved.id!, uid, tempId) : of(saved);
        }),
        tap((saved) => {
          if (saved.id) this.uploadedIds.set(tempId, saved.id);
          this.saveLocal(
            this.loadLocal(uid)
              .filter(
                (record) =>
                  record.id === tempId ||
                  (record.id !== saved.id &&
                    !(saved.clientId && record.clientId === saved.clientId)),
              )
              .map((record) => (record.id === tempId ? saved : record)),
            uid,
          );
        }),
        finalize(() => this.uploads.delete(tempId)),
        // A delete waits for the same POST instead of starting another upload.
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.uploads.set(tempId, upload);
    return upload;
  }

  addWorkout(workout: Omit<Workout, 'id'>): Observable<Workout> {
    const existing =
      workout.clientId && this.loadLocal().find((item) => item.clientId === workout.clientId);
    if (existing)
      return this.isTempId(existing.id)
        ? this.upload(existing).pipe(catchError(() => of(existing)))
        : of(existing);
    const tempId = 'w_' + crypto.randomUUID();
    const newWorkout = { ...workout, id: tempId, clientId: workout.clientId ?? tempId } as Workout;

    // Optimistic local update
    const current = this.loadLocal();
    this.saveLocal([newWorkout, ...current]);

    return this.upload(newWorkout).pipe(
      catchError((err) => {
        console.warn('API add workout failed, using local storage', err);
        return of(newWorkout);
      }),
    );
  }

  updateWorkout(id: string, workout: Partial<Workout>): Observable<Workout> {
    id = this.uploadedIds.get(id) ?? id;
    const uid = this.owner();
    const current = this.loadLocal(uid);
    const updated = current.map((item) =>
      item.id === id ? { ...item, ...workout } : item,
    ) as Workout[];
    const local = updated.find((item) => item.id === id) ?? ({ ...workout, id } as Workout);
    if (this.isTempId(id)) {
      local.pendingUpdate = true;
      this.saveLocal(updated, uid);
      return this.upload(local).pipe(
        catchError(() =>
          of(this.loadLocal(uid).find((item) => item.clientId === local.clientId) ?? local),
        ),
      );
    }
    return this.api.put<{ workout: Workout }>(`/workouts/${id}`, workout).pipe(
      map((res) => res.workout),
      tap((saved) =>
        this.saveLocal(
          this.loadLocal(uid).map((item) => (item.id === id ? saved : item)),
          uid,
        ),
      ),
    );
  }

  private flushEdit(
    local: Workout,
    serverId: string,
    uid: string,
    localId: string,
  ): Observable<Workout> {
    return this.api.put<{ workout: Workout }>(`/workouts/${serverId}`, local).pipe(
      switchMap((response) => {
        const latest = this.loadLocal(uid).find((item) => item.id === localId);
        if (latest && JSON.stringify(editable(latest)) !== JSON.stringify(editable(local))) {
          return this.flushEdit(latest, serverId, uid, localId);
        }
        return of(response.workout);
      }),
      catchError(() =>
        of({
          ...(this.loadLocal(uid).find((item) => item.id === localId) ?? local),
          id: serverId,
          pendingUpdate: true,
        }),
      ),
    );
  }

  private syncEdit(item: Workout, uid: string): Observable<Workout> {
    return defer(() => this.flushEdit(item, item.id!, uid, item.id!)).pipe(
      tap((saved) =>
        this.saveLocal(
          this.loadLocal(uid).map((record) => (record.id === item.id ? saved : record)),
          uid,
        ),
      ),
    );
  }

  deleteWorkout(id: string): Observable<void> {
    const upload = this.uploads.get(id);
    if (upload) {
      // An offline item may already be uploading when its Delete button is
      // pressed. Wait for its server id, then delete that record as well.
      return upload.pipe(switchMap((saved) => this.deleteWorkout(saved.id!)));
    }
    id = this.uploadedIds.get(id) ?? id;
    const uid = this.owner();
    const removeLocal = () =>
      this.saveLocal(
        this.loadLocal(uid).filter((item) => item.id !== id),
        uid,
      );
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

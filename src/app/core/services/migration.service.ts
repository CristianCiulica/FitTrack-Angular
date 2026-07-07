import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';

@Injectable({ providedIn: 'root' })
export class MigrationService {
  private readonly api = inject(ApiService);
  private readonly attempted = new Set<string>();

  // muta datele vechi din localStorage in backend, o singura data per uid
  migrateIfNeeded(uid: string): void {
    if (typeof window === 'undefined' || !uid || this.attempted.has(uid)) {
      return;
    }
    this.attempted.add(uid);

    const workoutsKey = `fittrack_workouts:${uid}`;
    const sessionsKey = `fittrack_running_sessions:${uid}`;
    // workout-urile predefinite erau doar date demo generate local, nu se migreaza
    const workouts = this.readLocalArray<Workout>(workoutsKey).filter((w) => !w.isPredefined);
    const runningSessions = this.readLocalArray<RunningSession>(sessionsKey);

    if (workouts.length === 0 && runningSessions.length === 0) {
      localStorage.removeItem(workoutsKey);
      localStorage.removeItem(sessionsKey);
      return;
    }

    this.api.post<{ migrated: boolean }>('/migrate', { workouts, runningSessions }).subscribe({
      next: () => {
        localStorage.removeItem(workoutsKey);
        localStorage.removeItem(sessionsKey);
      },
      error: (err) => {
        this.attempted.delete(uid);
        console.warn('[migration] failed, will retry next login', err);
      },
    });
  }

  private readLocalArray<T>(key: string): T[] {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

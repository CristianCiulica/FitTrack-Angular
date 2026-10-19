import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, defer, forkJoin, throwError } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';
import { AchievementId, validAchievementId } from '../models/achievement.model';
import { trainingProgress } from '../utils/training-progress';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';
import { WorkoutService } from './workout.service';
import { RunningSessionService } from './running-session.service';

@Injectable({ providedIn: 'root' })
export class AchievementsService {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly workouts = inject(WorkoutService);
  private readonly runs = inject(RunningSessionService);
  private readonly owner = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ready = computed(() => {
    this.auth.currentUser();
    return !!this.owner() && this.owner() === this.auth.currentUserId;
  });
  readonly badges = computed(
    () => trainingProgress(this.workouts.workouts(), this.runs.sessions(), new Date()).milestones,
  );
  readonly featured = computed(() => {
    if (!this.ready() || this.profile.profile()?.uid !== this.auth.currentUserId) return [];
    const earned = new Set(
      this.badges()
        .filter((badge) => badge.earned)
        .map((badge) => badge.id),
    );
    const stored = this.profile.profile()?.featuredBadgeIds;
    const ids = Array.isArray(stored) ? stored : [];
    return [...new Set(ids)]
      .filter(validAchievementId)
      .filter((id) => earned.has(id))
      .slice(0, 3)
      .map((id) => this.badges().find((badge) => badge.id === id)!);
  });

  load(): Observable<void> {
    return defer(() => {
      const uid = this.auth.currentUserId;
      if (!uid) return throwError(() => new Error('Sign in to load badges.'));
      this.loading.set(true);
      this.error.set('');
      this.owner.set('');
      return forkJoin([this.workouts.getWorkouts(), this.runs.getSessions()]).pipe(
        tap({
          next: () => {
            if (this.auth.currentUserId === uid) this.owner.set(uid);
          },
          error: () => {
            if (this.auth.currentUserId === uid)
              this.error.set('Your badges couldn’t load. Please try again.');
          },
        }),
        map(() => void 0),
        finalize(() => this.loading.set(false)),
      );
    });
  }

  isFeatured(id: AchievementId): boolean {
    return this.featured().some((badge) => badge.id === id);
  }

  toggle(id: AchievementId): void {
    if (
      !this.ready() ||
      this.loading() ||
      this.saving() ||
      this.profile.profile()?.uid !== this.auth.currentUserId ||
      !this.badges().some((badge) => badge.id === id && badge.earned)
    )
      return;
    const selected = this.featured().map((badge) => badge.id);
    if (!selected.includes(id) && selected.length >= 3) return;
    const featuredBadgeIds = selected.includes(id)
      ? selected.filter((value) => value !== id)
      : [...selected, id];
    const uid = this.auth.currentUserId;
    this.saving.set(true);
    this.error.set('');
    this.profile
      .patch({ featuredBadgeIds })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        error: () => {
          if (uid === this.auth.currentUserId)
            this.error.set('Your badge selection wasn’t saved. Please try again.');
        },
      });
  }
}

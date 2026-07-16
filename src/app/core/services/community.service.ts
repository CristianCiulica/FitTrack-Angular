import { Injectable, signal, inject } from '@angular/core';
import { CommunityWorkout } from '../models/workout.model';
import { Observable } from 'rxjs';
import { map, tap, finalize } from 'rxjs/operators';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CommunityService {
  readonly communityWorkouts = signal<CommunityWorkout[]>([]);
  readonly loading = signal<boolean>(false);
  private readonly api = inject(ApiService);

  loadCommunityWorkouts(): Observable<CommunityWorkout[]> {
    this.loading.set(true);
    return this.api.get<{ communityWorkouts: CommunityWorkout[] }>('/community').pipe(
      map((res) => res.communityWorkouts),
      tap((workouts) => this.communityWorkouts.set(workouts)),
      finalize(() => this.loading.set(false))
    );
  }

  publishWorkout(workout: Partial<CommunityWorkout>): Observable<CommunityWorkout> {
    return this.api
      .post<{ communityWorkout: CommunityWorkout }>('/community', workout)
      .pipe(map((res) => res.communityWorkout));
  }

  deletePost(id: string): Observable<void> {
    return this.api.delete<{ deleted: boolean }>(`/community/${id}`).pipe(
      tap(() => this.communityWorkouts.update((list) => list.filter((w) => w.id !== id))),
      map(() => void 0),
    );
  }

  toggleLike(id: string): Observable<CommunityWorkout> {
    return this.api
      .post<{ communityWorkout: CommunityWorkout }>(`/community/${id}/like`, {})
      .pipe(map((res) => res.communityWorkout), tap((w) => this.replace(w)));
  }

  addComment(id: string, text: string): Observable<CommunityWorkout> {
    return this.api
      .post<{ communityWorkout: CommunityWorkout }>(`/community/${id}/comments`, { text })
      .pipe(map((res) => res.communityWorkout), tap((w) => this.replace(w)));
  }

  deleteComment(id: string, commentId: string): Observable<CommunityWorkout> {
    return this.api
      .delete<{ communityWorkout: CommunityWorkout }>(`/community/${id}/comments/${commentId}`)
      .pipe(map((res) => res.communityWorkout), tap((w) => this.replace(w)));
  }

  registerSave(id: string): Observable<CommunityWorkout> {
    return this.api
      .post<{ communityWorkout: CommunityWorkout }>(`/community/${id}/save`, {})
      .pipe(map((res) => res.communityWorkout), tap((w) => this.replace(w)));
  }

  // inlocuieste postarea in feed cu varianta actualizata de pe server
  private replace(updated: CommunityWorkout): void {
    this.communityWorkouts.update((list) =>
      list.map((w) => (w.id === updated.id ? updated : w)),
    );
  }
}

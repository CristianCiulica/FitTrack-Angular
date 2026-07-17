import { Injectable, signal, inject } from '@angular/core';
import { CommunityAuthor, CommunityWorkout, MuscleGroup } from '../models/workout.model';
import { Observable } from 'rxjs';
import { map, tap, finalize } from 'rxjs/operators';
import { ApiService } from './api.service';

export type FeedTab = 'foryou' | 'following' | 'recent';

export interface FeedFilters {
  tab: FeedTab;
  muscle: MuscleGroup | null;
  q: string;
  maxMinutes: number | null;
}

interface FeedResponse {
  communityWorkouts: CommunityWorkout[];
  total: number;
  hasMore: boolean;
}

const PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class CommunityService {
  readonly communityWorkouts = signal<CommunityWorkout[]>([]);
  readonly picks = signal<CommunityWorkout[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loadingMore = signal<boolean>(false);
  readonly hasMore = signal<boolean>(false);
  private page = 0;
  private lastFilters: FeedFilters = { tab: 'foryou', muscle: null, q: '', maxMinutes: null };

  private readonly api = inject(ApiService);

  private feedParams(filters: FeedFilters, page: number): string {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    params.set('sort', filters.tab === 'recent' ? 'recent' : 'trending');
    if (filters.tab === 'following') params.set('feed', 'following');
    if (filters.muscle) params.set('muscle', filters.muscle);
    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.maxMinutes) params.set('maxMinutes', String(filters.maxMinutes));
    return params.toString();
  }

  // prima pagina (resetare feed la schimbarea filtrelor)
  loadFeed(filters: FeedFilters): Observable<CommunityWorkout[]> {
    this.lastFilters = { ...filters };
    this.page = 0;
    this.loading.set(true);
    return this.api.get<FeedResponse>(`/community?${this.feedParams(filters, 0)}`).pipe(
      tap((res) => {
        this.communityWorkouts.set(res.communityWorkouts);
        this.hasMore.set(res.hasMore);
      }),
      map((res) => res.communityWorkouts),
      finalize(() => this.loading.set(false)),
    );
  }

  // urmatoarea pagina (infinite scroll)
  loadMore(): Observable<CommunityWorkout[]> {
    this.page += 1;
    this.loadingMore.set(true);
    return this.api
      .get<FeedResponse>(`/community?${this.feedParams(this.lastFilters, this.page)}`)
      .pipe(
        tap((res) => {
          this.communityWorkouts.update((list) => [...list, ...res.communityWorkouts]);
          this.hasMore.set(res.hasMore);
        }),
        map((res) => res.communityWorkouts),
        finalize(() => this.loadingMore.set(false)),
      );
  }

  loadPicks(): Observable<CommunityWorkout[]> {
    return this.api.get<{ picks: CommunityWorkout[] }>('/community/picks').pipe(
      map((res) => res.picks),
      tap((picks) => this.picks.set(picks)),
    );
  }

  loadAuthor(uid: string): Observable<{ author: CommunityAuthor; posts: CommunityWorkout[] }> {
    return this.api.get<{ author: CommunityAuthor; posts: CommunityWorkout[] }>(
      `/community/author/${uid}`,
    );
  }

  toggleFollow(uid: string): Observable<{ following: boolean; followers: number }> {
    return this.api
      .post<{ following: boolean; followers: number }>(`/community/follow/${uid}`, {})
      .pipe(
        tap(({ following }) => {
          // reflectam starea pe toate postarile autorului din feed + picks
          const patch = (list: CommunityWorkout[]) =>
            list.map((w) => (w.authorId === uid ? { ...w, authorFollowedByMe: following } : w));
          this.communityWorkouts.update(patch);
          this.picks.update(patch);
        }),
      );
  }

  publishWorkout(workout: Partial<CommunityWorkout>): Observable<CommunityWorkout> {
    return this.api
      .post<{ communityWorkout: CommunityWorkout }>('/community', workout)
      .pipe(map((res) => res.communityWorkout));
  }

  deletePost(id: string): Observable<void> {
    return this.api.delete<{ deleted: boolean }>(`/community/${id}`).pipe(
      tap(() => {
        this.communityWorkouts.update((list) => list.filter((w) => w.id !== id));
        this.picks.update((list) => list.filter((w) => w.id !== id));
      }),
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

  // inlocuieste postarea in feed si in picks cu varianta actualizata de pe server
  private replace(updated: CommunityWorkout): void {
    const patch = (list: CommunityWorkout[]) =>
      list.map((w) => (w.id === updated.id ? updated : w));
    this.communityWorkouts.update(patch);
    this.picks.update(patch);
  }
}

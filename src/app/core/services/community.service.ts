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
}

import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { filter, map, Observable, tap } from 'rxjs';
import { WeightEntry } from '../models/weight-entry.model';
import { UserProfile } from '../models/user-profile.model';
import { ReadCache } from '../utils/read-cache';
import { ApiService } from './api.service';

interface WeightResponse { entries: WeightEntry[]; profile: UserProfile; }

@Injectable({ providedIn: 'root' })
export class WeightService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);
  private readonly reads = new ReadCache<WeightEntry[] | null>();
  private owner() { return this.auth.currentUser?.uid || 'local'; }

  getEntries(force = false): Observable<WeightEntry[]> {
    return this.reads.read(this.owner(), () => null, () =>
      this.api.get<{ entries: WeightEntry[] }>('/me/weight-entries').pipe(map(response => response.entries)),
      () => {}, force,
    ).pipe(filter((entries): entries is WeightEntry[] => entries !== null));
  }

  save(date: string, weightKg: number) {
    const uid = this.owner();
    return this.api.put<WeightResponse>(`/me/weight-entries/${date}`, { weightKg }).pipe(
      tap(response => this.reads.replace(uid, response.entries)),
    );
  }

  remove(date: string) {
    const uid = this.owner();
    return this.api.delete<WeightResponse>(`/me/weight-entries/${date}`).pipe(
      tap(response => this.reads.replace(uid, response.entries)),
    );
  }
}

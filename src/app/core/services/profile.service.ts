import * as rxjs from 'rxjs';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ProfileUpdate, UserProfile } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);

  readonly profile = signal<UserProfile | null>(null);
  readonly loaded = signal(false);

  // sursa unica de adevar pentru datele personale, folosita in Account, BMI, Nutrition, remindere
  readonly displayName = computed(() => this.profile()?.displayName ?? '');
  readonly heightCm = computed(() => this.profile()?.heightCm ?? null);
  readonly weightKg = computed(() => this.profile()?.weightKg ?? null);
  readonly age = computed(() => this.profile()?.age ?? null);
  readonly sex = computed(() => this.profile()?.sex ?? '');
  readonly units = computed(() => this.profile()?.units ?? 'metric');

  // onboarding-ul e complet cand avem datele de baza pentru BMI
  readonly isOnboarded = computed(() => {
    const p = this.profile();
    return !!p && p.heightCm != null && p.weightKg != null && p.age != null;
  });

  load(force = false): Observable<UserProfile | null> {
    if (this.loaded() && !force) {
      return of(this.profile());
    }
    return this.api.get<{ profile: UserProfile }>('/me').pipe(
      map((res) => res.profile),
      tap((profile) => {
        this.profile.set(profile);
        this.loaded.set(true);
      }),
    );
  }

  refresh(): Observable<UserProfile | null> {
    return this.load(true);
  }

  patch(update: ProfileUpdate): Observable<UserProfile> {
    // update optimist ca UI-ul sa reflecte instant schimbarea
    const current = this.profile();
    if (current) {
      this.profile.set({ ...current, ...update });
    }
    return this.api.patch<{ profile: UserProfile }>('/me', update).pipe(
      map((res) => res.profile),
      tap((profile) => this.profile.set(profile)),
      catchError((err) => {
        console.warn('[ProfileService] API patch failed, falling back to optimistic UI state', err);
        return rxjs.of({ ...current, ...update } as UserProfile);
      })
    );
  }

  exportData(): void {
    this.api.get('/me/export', { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fittrack_export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Failed to export data', err)
    });
  }

  deleteAccount(): Observable<void> {
    return this.api.delete<{ deleted: boolean }>('/me').pipe(map(() => void 0));
  }

  clear(): void {
    this.profile.set(null);
    this.loaded.set(false);
  }
}

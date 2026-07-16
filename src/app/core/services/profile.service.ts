import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Auth } from '@angular/fire/auth';
import { ProfileUpdate, UserProfile } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);

  readonly profile = signal<UserProfile | null>(null);
  readonly loaded = signal(false);

  // sursa unica de adevar pentru datele personale, folosita in Account, BMI, Nutrition, remindere
  readonly displayName = computed(() => this.profile()?.displayName ?? '');
  readonly heightCm = computed(() => this.profile()?.heightCm ?? null);
  readonly weightKg = computed(() => this.profile()?.weightKg ?? null);
  readonly age = computed(() => this.profile()?.age ?? null);
  readonly sex = computed(() => this.profile()?.sex ?? '');
  readonly units = computed(() => this.profile()?.units ?? 'metric');
  readonly goal = computed(() => this.profile()?.goal ?? 'maintain');
  readonly goalRate = computed(() => this.profile()?.goalRate ?? 0.5);
  readonly weeklyWorkoutGoal = computed(() => this.profile()?.weeklyWorkoutGoal ?? 4);

  // onboarding-ul e complet cand avem datele de baza pentru BMI
  readonly isOnboarded = computed(() => {
    const p = this.profile();
    return !!p && p.heightCm != null && p.weightKg != null && p.age != null;
  });

  private getStorageKey(): string {
    const uid = this.auth.currentUser?.uid || 'local';
    return `fittrack_profile:${uid}`;
  }

  private loadLocal(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveLocal(profile: UserProfile): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.getStorageKey(), JSON.stringify(profile));
  }

  load(force = false): Observable<UserProfile | null> {
    if (this.loaded() && !force) {
      return of(this.profile());
    }
    return this.api.get<{ profile: UserProfile }>('/me').pipe(
      map((res) => res.profile),
      tap((profile) => {
        this.saveLocal(profile);
        this.profile.set(profile);
        this.loaded.set(true);
      }),
      catchError((err) => {
        console.warn('API get profile failed, using local storage', err);
        const local = this.loadLocal();
        if (local) {
          // avem o copie locala valida — mergem offline cu ea
          this.profile.set(local);
          this.loaded.set(true);
          return of(local);
        }
        // fara copie locala NU marcam loaded si propagam eroarea:
        // onboardingGuard are propriul catchError care lasa userul sa treaca,
        // altfel un esec tranzitoriu la boot ar trimite gresit userul la /onboarding
        return throwError(() => err);
      })
    );
  }

  refresh(): Observable<UserProfile | null> {
    return this.load(true);
  }

  patch(update: ProfileUpdate): Observable<UserProfile> {
    const current = this.profile() || {} as UserProfile;
    const newProfile = { ...current, ...update };
    
    // Always optimistic update
    this.profile.set(newProfile);
    this.saveLocal(newProfile);
    
    return this.api.patch<{ profile: UserProfile }>('/me', update).pipe(
      map((res) => res.profile),
      tap((profile) => {
        this.profile.set(profile);
        this.saveLocal(profile);
      }),
      catchError((err) => {
        console.warn('[ProfileService] API patch failed, falling back to optimistic UI state', err);
        return of(newProfile);
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

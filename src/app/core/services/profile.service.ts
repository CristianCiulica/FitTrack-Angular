import { Injectable, computed, inject, signal } from '@angular/core';
import { defer, EMPTY, Observable, of, Subject, throwError } from 'rxjs';
import { concatMap, map, tap, catchError, filter, finalize, shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Auth } from '@angular/fire/auth';
import { ProfileUpdate, UserProfile } from '../models/user-profile.model';
import { eraseAccountStorage } from '../utils/account-storage';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);

  readonly profile = signal<UserProfile | null>(null);
  readonly loaded = signal(false);
  private loadedUid: string | null = null;
  private loadRequest: Observable<UserProfile | null> | null = null;
  private revision = 0;
  private readonly erasedOwners = new Set<string>();
  private confirmedProfile: UserProfile | null = null;
  private readonly writes = new Subject<() => Observable<unknown>>();

  constructor() {
    // Serialize autosaves so a slow response never becomes the final older value.
    this.writes.pipe(concatMap((write) => write())).subscribe();
  }

  // sursa unica de adevar pentru datele personale, folosita in Account, BMI, Nutrition, remindere
  readonly displayName = computed(() => this.profile()?.displayName ?? '');
  private static readonly DEFAULT_AVATAR = '/images/default-avatar.jpg';
  readonly avatar = computed(() => this.profile()?.avatar || ProfileService.DEFAULT_AVATAR);
  readonly heightCm = computed(() => this.profile()?.heightCm ?? null);
  readonly weightKg = computed(() => this.profile()?.weightKg ?? null);
  readonly age = computed(() => this.profile()?.age ?? null);
  readonly sex = computed(() => this.profile()?.sex ?? '');
  readonly units = computed(() => this.profile()?.units ?? 'metric');
  readonly goal = computed(() => this.profile()?.goal ?? 'maintain');
  readonly goalRate = computed(() => this.profile()?.goalRate ?? 0.5);
  readonly moveGoal = computed(() => this.profile()?.moveGoal ?? 500);
  readonly exerciseGoal = computed(() => this.profile()?.exerciseGoal ?? 30);
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
    if (
      typeof window === 'undefined' ||
      this.erasedOwners.has(this.auth.currentUser?.uid || 'local')
    )
      return;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(profile));
    } catch {
      /* Cache is optional. */
    }
  }

  load(force = false): Observable<UserProfile | null> {
    const uid = this.auth.currentUser?.uid || 'local';
    if (this.loadedUid !== uid) {
      this.clear();
      this.loadedUid = uid;
      const cached = this.loadLocal();
      if (cached) {
        this.profile.set(cached);
        this.confirmedProfile = cached;
        this.loaded.set(true);
      }
    }
    if (this.loaded() && !force) {
      return of(this.profile());
    }
    if (this.loadRequest) return this.loadRequest;
    const revision = this.revision;
    const request = this.api.get<{ profile: UserProfile }>('/me').pipe(
      filter(() => this.loadedUid === uid && !this.erasedOwners.has(uid)),
      map((res) => (revision === this.revision ? res.profile : (this.profile() ?? res.profile))),
      tap((profile) => {
        if (revision === this.revision) this.confirmedProfile = profile;
        this.saveLocal(profile);
        this.profile.set(profile);
        this.loaded.set(true);
      }),
      catchError((err) => {
        console.warn('API get profile failed, using local storage', err);
        if (this.loadedUid !== uid || this.erasedOwners.has(uid)) return of(null);
        if (err.status === 401 || err.status === 403) {
          this.clear();
          return throwError(() => err);
        }
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
      }),
      finalize(() => {
        if (this.loadRequest === request) this.loadRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.loadRequest = request;
    return request;
  }

  refresh(): Observable<UserProfile | null> {
    return this.load(true);
  }

  patch(update: ProfileUpdate): Observable<UserProfile> {
    const uid = this.auth.currentUser?.uid || 'local';
    if (this.erasedOwners.has(uid)) return throwError(() => new Error('Account was deleted'));
    const revision = ++this.revision;
    const current = this.profile() || ({} as UserProfile);
    const newProfile = { ...current, ...update };

    // Always optimistic update
    this.profile.set(newProfile);
    this.saveLocal(newProfile);

    return this.write(update, uid).pipe(
      tap((profile) => {
        if (uid !== (this.auth.currentUser?.uid || 'local') || this.erasedOwners.has(uid)) return;
        this.confirmedProfile = profile;
        if (revision !== this.revision) return;
        this.profile.set(profile);
        this.saveLocal(profile);
      }),
      catchError((err) => {
        if (
          uid === (this.auth.currentUser?.uid || 'local') &&
          !this.erasedOwners.has(uid) &&
          revision === this.revision
        ) {
          const previous = this.confirmedProfile ?? current;
          this.profile.set(previous);
          this.saveLocal(previous);
        }
        return throwError(() => err);
      }),
    );
  }

  // New measurements and goals are confirmed by the server before updating UI.
  acceptServerProfile(profile: UserProfile): void {
    if (profile.uid !== (this.auth.currentUser?.uid || 'local')) return;
    this.revision++;
    this.confirmedProfile = profile;
    this.profile.set(profile);
    try {
      this.saveLocal(profile);
    } catch {
      /* Cache is optional. */
    }
  }

  saveActivityGoals(
    update: Pick<UserProfile, 'moveGoal' | 'exerciseGoal' | 'weeklyWorkoutGoal'>,
  ): Observable<UserProfile> {
    const uid = this.auth.currentUser?.uid || 'local';
    const revision = ++this.revision;
    return this.write(update, uid).pipe(
      tap((profile) => {
        if (
          uid === (this.auth.currentUser?.uid || 'local') &&
          !this.erasedOwners.has(uid) &&
          revision === this.revision
        )
          this.acceptServerProfile(profile);
      }),
    );
  }

  private write(update: ProfileUpdate, uid: string): Observable<UserProfile> {
    return new Observable((subscriber) => {
      this.writes.next(() =>
        defer(() => {
          if (uid !== (this.auth.currentUser?.uid || 'local') || this.erasedOwners.has(uid))
            return throwError(() => new Error('Account changed'));
          return this.api.patch<{ profile: UserProfile }>('/me', update);
        }).pipe(
          tap((response) => {
            subscriber.next(response.profile);
            subscriber.complete();
          }),
          catchError((error) => {
            subscriber.error(error);
            return EMPTY;
          }),
        ),
      );
    });
  }

  exportData(): Observable<void> {
    return this.api.get('/me/export', { responseType: 'blob' }).pipe(
      tap((blob) => {
        const url = window.URL.createObjectURL(blob as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fittrack_export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }),
      map(() => void 0),
    );
  }

  deleteAccount(): Observable<void> {
    const uid = this.auth.currentUser?.uid ?? '';
    return this.api.delete<{ deleted: boolean }>('/me').pipe(
      map((response) => {
        if (!response.deleted) throw new Error('Account deletion was not confirmed');
        this.erasedOwners.add(uid);
        this.clear();
        eraseAccountStorage(uid);
      }),
    );
  }

  clear(): void {
    this.revision++;
    this.profile.set(null);
    this.loaded.set(false);
    this.loadedUid = null;
    this.loadRequest = null;
    this.confirmedProfile = null;
  }
}

import { Injectable, signal } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
  user,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  User,
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { from, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { inject } from '@angular/core';
import { MigrationService } from './migration.service';
import { ProfileService } from './profile.service';
import { NativeRunService } from './native-run.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private nativeRun = inject(NativeRunService);
  private router = inject(Router);
  private migration = inject(MigrationService);
  private profileService = inject(ProfileService);
  currentUser = signal<User | null>(null);

  isLoggedIn$: Observable<boolean> = user(this.auth).pipe(
    map((u) => {
      this.currentUser.set(u);
      return !!u;
    }),
  );

  // Include sign-out in the sequence so signing back into the same account reloads it.
  private readonly sessionSub = user(this.auth)
    .pipe(map(account => account?.uid ?? null), distinctUntilChanged())
    .subscribe(uid => {
      if (!uid) {
        this.profileService.clear();
        return;
      }
      this.migration.migrateIfNeeded(uid);
      this.profileService
        .load(true)
        .subscribe({ error: (err) => console.warn('[auth] Failed to load profile', err) });
    });

  // Firebase restores the session when returning from provider sign-in.
  private readonly redirectSub = getRedirectResult(this.auth)
    .then((result) => {
      if (result?.user) {
        this.router.navigate(['/dashboard']);
      }
    })
    .catch((err) => {
      console.warn('[auth] redirect result error', err);
    });

  // set persistence for remember me
  login(email: string, password: string, remember: boolean) {
    const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
    return from(
      setPersistence(this.auth, persistence).then(() =>
        signInWithEmailAndPassword(this.auth, email, password),
      ),
    );
  }

  register(email: string, password: string, firstName: string, lastName: string) {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password).then((cred) =>
        updateProfile(cred.user, { displayName: `${firstName} ${lastName}` }),
      ),
    );
  }

  logout() {
    const uid = this.currentUserId;
    return from(
      (async () => {
        // Preserve the native checkpoint for this owner while stopping GPS after logout.
        if (this.nativeRun.available) await this.nativeRun.stop(uid);
        await signOut(this.auth);
      })(),
    ).pipe(map(() => this.router.navigate(['/auth/login'])));
  }

  resetPassword(email: string) {
    return from(sendPasswordResetEmail(this.auth, email));
  }

  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // iOS PWA requires synchronous popup execution (no async/awaits before calling signInWithPopup).
    // Default persistence is already local, so we don't need to call setPersistence.
    return from(signInWithPopup(this.auth, provider));
  }

  signInWithApple() {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    provider.setCustomParameters({ locale: navigator.language.replace('-', '_') });
    const attempt = signInWithPopup(this.auth, provider).catch((error: { code?: string }) => {
      // A same-origin auth helper can recover the redirect session even with partitioned storage.
      if (error.code === 'auth/popup-blocked' && location.host === this.auth.config.authDomain) {
        return signInWithRedirect(this.auth, provider);
      }
      throw error;
    });
    return from(attempt);
  }

  get currentUserId(): string {
    return this.auth.currentUser?.uid ?? '';
  }
}

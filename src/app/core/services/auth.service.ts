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
  signInWithPopup,
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { from, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { inject } from '@angular/core';
import { MigrationService } from './migration.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);
  private migration = inject(MigrationService);
  currentUser = signal<any>(null);

  isLoggedIn$: Observable<boolean> = user(this.auth).pipe(
    map((u) => {
      this.currentUser.set(u);
      return !!u;
    }),
  );

  // migram automat datele vechi din localStorage la primul login dupa update
  private readonly migrationSub = user(this.auth)
    .pipe(
      filter((u): u is NonNullable<typeof u> => !!u),
      map((u) => u.uid),
      distinctUntilChanged(),
    )
    .subscribe((uid) => this.migration.migrateIfNeeded(uid));

  // setam persistenta pentru remember me
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
    return from(signOut(this.auth)).pipe(map(() => this.router.navigate(['/auth/login'])));
  }

  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    return from(
      setPersistence(this.auth, browserLocalPersistence).then(() =>
        signInWithPopup(this.auth, provider),
      ),
    );
  }

  get currentUserId(): string {
    return this.auth.currentUser?.uid ?? '';
  }
}

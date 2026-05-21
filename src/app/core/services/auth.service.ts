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
import { map } from 'rxjs/operators';
import { inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  currentUser = signal<any>(null);

  constructor() {
    // Force sign-out on refresh to show the Login page first.
    signOut(this.auth);
  }

  isLoggedIn$: Observable<boolean> = user(this.auth).pipe(
    map((u) => {
      this.currentUser.set(u);
      return !!u;
    }),
  );

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

  signInWithGoogle(remember: boolean) {
    const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return from(
      setPersistence(this.auth, persistence).then(() => signInWithPopup(this.auth, provider)),
    );
  }

  get currentUserId(): string {
    return this.auth.currentUser?.uid ?? '';
  }
}

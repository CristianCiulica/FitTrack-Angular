import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { from, switchMap, take } from 'rxjs';
import { getApiBaseUrl } from '../config/runtime-config';

export const firebaseAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = getApiBaseUrl();
  if (!req.url.startsWith(baseUrl)) {
    return next(req);
  }

  const auth = inject(Auth);

  // Asteptam ca Firebase sa termine restaurarea sesiunii (persistence) inainte de a
  // trimite requestul. Daca citim auth.currentUser sincron, la boot e inca null si
  // requestul pleaca fara token -> 401 (ex. "Failed to load community workouts").
  return user(auth).pipe(
    take(1),
    switchMap((currentUser) =>
      from(currentUser ? currentUser.getIdToken() : Promise.resolve(null)).pipe(
        switchMap((token) => {
          if (!token) return next(req);
          const authReq = req.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
          });
          return next(authReq);
        }),
      ),
    ),
  );
};

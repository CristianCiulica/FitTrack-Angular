import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { from, of, switchMap } from 'rxjs';
import { getApiBaseUrl } from '../config/runtime-config';

export const firebaseAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = getApiBaseUrl();
  if (!req.url.startsWith(baseUrl)) {
    return next(req);
  }

  const auth = inject(Auth);
  const currentUser = auth.currentUser;
  const tokenPromise = currentUser ? currentUser.getIdToken() : Promise.resolve(null);

  return from(tokenPromise).pipe(
    switchMap((token) => {
      if (!token) return next(req);
      const authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return next(authReq);
    }),
  );
};

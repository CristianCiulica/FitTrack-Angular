import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap, take, timeout } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';

// blocheaza paginile principale pana cand utilizatorul completeaza onboarding-ul
export const onboardingGuard: CanActivateFn = () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  return inject(AuthService).isLoggedIn$.pipe(
    take(1),
    switchMap(signedIn => {
      if (!signedIn) return of(router.createUrlTree(['/auth/login']));
      return profileService.load().pipe(
        // App observes late profile responses when the API is waking up.
        timeout({ first: 1500 }),
        map(() => profileService.isOnboarded() || router.createUrlTree(['/onboarding'])),
        catchError(() => of(true)),
      );
    }),
  );
};

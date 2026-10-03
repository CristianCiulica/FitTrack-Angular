import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, timeout } from 'rxjs';
import { ProfileService } from '../services/profile.service';

// blocheaza paginile principale pana cand utilizatorul completeaza onboarding-ul
export const onboardingGuard: CanActivateFn = () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  return profileService.load().pipe(
    // App keeps observing the profile and redirects once it arrives; a cold
    // backend must not block navigation for its entire startup time.
    timeout({ first: 1500 }),
    map(() => (profileService.isOnboarded() ? true : router.createUrlTree(['/onboarding']))),
    catchError(() => of(true)),
  );
};

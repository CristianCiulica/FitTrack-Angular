import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ProfileService } from '../services/profile.service';

// blocheaza paginile principale pana cand utilizatorul completeaza onboarding-ul
export const onboardingGuard: CanActivateFn = () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  return profileService.load().pipe(
    map(() => (profileService.isOnboarded() ? true : router.createUrlTree(['/onboarding']))),
    catchError(() => of(true)),
  );
};

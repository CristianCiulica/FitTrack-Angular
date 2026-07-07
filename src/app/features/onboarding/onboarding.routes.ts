import { Routes } from '@angular/router';

export const onboardingRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./onboarding.component').then((m) => m.OnboardingComponent),
  },
];

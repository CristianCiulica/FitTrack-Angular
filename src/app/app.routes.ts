import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then((m) => m.onboardingRoutes),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, onboardingGuard],
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
  },
  {
    path: 'workouts',
    canActivate: [authGuard, onboardingGuard],
    loadChildren: () => import('./features/workouts/workouts.routes').then((m) => m.workoutsRoutes),
  },
  {
    path: 'start-workout',
    canActivate: [authGuard, onboardingGuard],
    loadChildren: () =>
      import('./features/start-workout/start-workout.routes').then((m) => m.startWorkoutRoutes),
  },
  {
    path: 'bmi',
    canActivate: [authGuard, onboardingGuard],
    loadChildren: () => import('./features/bmi/bmi.routes').then((m) => m.bmiRoutes),
  },
  {
    path: 'running',
    canActivate: [authGuard, onboardingGuard],
    loadChildren: () => import('./features/running/running.routes').then((m) => m.runningRoutes),
  },
  {
    path: 'account',
    canActivate: [authGuard, onboardingGuard],
    loadChildren: () => import('./features/account/account.routes').then((m) => m.accountRoutes),
  },
  {
    path: 'settings',
    canActivate: [authGuard, onboardingGuard],
    loadChildren: () => import('./features/settings/settings.routes').then((m) => m.settingsRoutes),
  },
  { path: '**', redirectTo: 'auth/login' },
];

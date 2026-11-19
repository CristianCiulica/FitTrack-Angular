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
    title: 'Set up your profile · FitTrack',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then((m) => m.onboardingRoutes),
  },
  {
    path: '',
    loadComponent: () => import('./shared/navigation/navigation.component').then(m => m.NavigationComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Home · FitTrack',
        canActivate: [authGuard, onboardingGuard],
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
      },
      {
        path: 'workouts',
        title: 'Activity history · FitTrack',
        canActivate: [authGuard, onboardingGuard],
        loadChildren: () => import('./features/workouts/workouts.routes').then((m) => m.workoutsRoutes),
      },
      {
        path: 'start-workout',
        title: 'Workout · FitTrack',
        canActivate: [authGuard, onboardingGuard],
        loadChildren: () =>
          import('./features/start-workout/start-workout.routes').then((m) => m.startWorkoutRoutes),
      },
      {
        path: 'bmi',
        title: 'Nutrition · FitTrack',
        canActivate: [authGuard, onboardingGuard],
        loadChildren: () => import('./features/bmi/bmi.routes').then((m) => m.bmiRoutes),
      },
      {
        path: 'running',
        title: 'Running · FitTrack',
        canActivate: [authGuard, onboardingGuard],
        loadChildren: () => import('./features/running/running.routes').then((m) => m.runningRoutes),
      },
      {
        path: 'profile',
        redirectTo: 'account',
        pathMatch: 'full',
      },
      {
        path: 'progress',
        title: 'Progress · FitTrack',
        canActivate: [authGuard, onboardingGuard],
        loadComponent: () => import('./features/progress/progress.component').then((m) => m.ProgressComponent),
      },
      {
        path: 'account',
        title: 'Profile · FitTrack',
        canActivate: [authGuard, onboardingGuard],
        loadChildren: () => import('./features/account/account.routes').then((m) => m.accountRoutes),
      },
      { path: 'weight', title: 'Weight history · FitTrack', canActivate: [authGuard, onboardingGuard], loadComponent: () => import('./features/weight/weight.component').then(m => m.WeightComponent) },
      {
        path: 'settings',
        title: 'Settings · FitTrack',
        canActivate: [authGuard, onboardingGuard],
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.settingsRoutes),
      },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];

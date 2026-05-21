import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
  },
  {
    path: 'workouts',
    canActivate: [authGuard],
    loadChildren: () => import('./features/workouts/workouts.routes').then((m) => m.workoutsRoutes),
  },
  {
    path: 'start-workout',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/start-workout/start-workout.routes').then((m) => m.startWorkoutRoutes),
  },
  {
    path: 'bmi',
    canActivate: [authGuard],
    loadChildren: () => import('./features/bmi/bmi.routes').then((m) => m.bmiRoutes),
  },
  {
    path: 'running',
    canActivate: [authGuard],
    loadChildren: () => import('./features/running/running.routes').then((m) => m.runningRoutes),
  },
  { path: '**', redirectTo: 'auth/login' },
];

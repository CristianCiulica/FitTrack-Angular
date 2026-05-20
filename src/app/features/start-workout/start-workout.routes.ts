import { Routes } from '@angular/router';

export const startWorkoutRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./start-workout.component').then((m) => m.StartWorkoutComponent),
  },
];


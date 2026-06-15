import { Routes } from '@angular/router';
import { StartWorkoutComponent } from './start-workout.component';

export const startWorkoutRoutes: Routes = [
  {
    path: '',
    component: StartWorkoutComponent,
    canDeactivate: [
      (component: StartWorkoutComponent) => component.canLeaveWorkout(),
    ],
  },
];

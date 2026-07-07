import { Injectable, inject } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { WorkoutService } from './workout.service';
import { ProfileService } from './profile.service';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly profileService = inject(ProfileService);

  constructor(
    private notification: NzNotificationService,
    private workoutService: WorkoutService,
  ) {}

  scheduleCheck() {
    const workouts = this.workoutService.workouts();
    if (workouts.length === 0) return;

    const today = new Date();
    const sorted = [...workouts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const last = new Date(sorted[0].date);
    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    // pragul de zile e configurabil din Settings
    const threshold = this.profileService.profile()?.workoutReminderDays ?? 2;
    if (diffDays >= threshold) {
      setTimeout(() => {
        this.notification.warning(
          ' Time to work out!',
          `You have not logged a workout in ${diffDays} days.`,
          { nzDuration: 6000 },
        );
      }, 2000);
    }
  }
}

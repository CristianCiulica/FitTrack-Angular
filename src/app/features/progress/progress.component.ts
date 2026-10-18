import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, interval } from 'rxjs';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { ActivityCalendarComponent } from '../../shared/components/activity-calendar/activity-calendar.component';
import { ActivityGoalsComponent } from '../../shared/components/activity-goals/activity-goals.component';
import { WorkoutService } from '../../core/services/workout.service';
import { RunningSessionService } from '../../core/services/running-session.service';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { localDateKey } from '../../core/utils/weight-progress';
import { trainingProgress } from '../../core/utils/training-progress';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule,
    AppMenuComponent,
    ActivityCalendarComponent,
    ActivityGoalsComponent,
  ],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss',
})
export class ProgressComponent implements OnInit {
  private readonly workouts = inject(WorkoutService);
  private readonly runs = inject(RunningSessionService);
  private readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly period = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly today = signal(new Date());
  readonly loading = signal(true);
  readonly error = signal('');
  readonly monthLabel = computed(() =>
    this.period().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  );
  readonly summary = computed(() =>
    trainingProgress(this.workouts.workouts(), this.runs.sessions(), this.period(), this.today()),
  );
  readonly weeklyGoal = this.profile.weeklyWorkoutGoal;
  readonly goalPercent = computed(() =>
    Math.min(100, (this.summary().weeklyWorkouts / this.weeklyGoal()) * 100),
  );
  ngOnInit(): void {
    this.load();
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (localDateKey() !== localDateKey(this.today())) this.today.set(new Date());
      });
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin([this.workouts.getWorkouts(), this.runs.getSessions()])
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.loading.set(false),
        error: () => {
          this.loading.set(false);
          this.error.set('Your activity couldn’t load. Please try again.');
        },
      });
  }
  logout(): void {
    this.auth.logout().subscribe();
  }
}

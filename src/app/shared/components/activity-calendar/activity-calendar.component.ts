import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, interval } from 'rxjs';
import { WorkoutService } from '../../../core/services/workout.service';
import { RunningSessionService } from '../../../core/services/running-session.service';
import { ActivityDay, activityYear } from '../../../core/utils/activity-calendar';
import { localDateKey } from '../../../core/utils/weight-progress';

@Component({
  selector: 'app-activity-calendar',
  standalone: true,
  templateUrl: './activity-calendar.component.html',
  styleUrl: './activity-calendar.component.scss',
})
export class ActivityCalendarComponent implements OnInit {
  private readonly workouts = inject(WorkoutService);
  private readonly running = inject(RunningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly today = signal(new Date());
  readonly year = signal(this.today().getFullYear());
  readonly selectedKey = signal(localDateKey(this.today()));
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly calendar = computed(() =>
    activityYear(this.workouts.workouts(), this.running.sessions(), this.year(), this.today()),
  );
  readonly selectedDay = computed(() =>
    this.calendar()
      .months.flatMap((month) => month.days)
      .find((day) => day.key === this.selectedKey()),
  );

  ngOnInit(): void {
    this.load();
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (localDateKey() !== localDateKey(this.today())) this.today.set(new Date());
      });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin([this.workouts.getWorkouts(), this.running.getSessions()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loading.set(false),
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  changeYear(offset: number): void {
    const next = this.year() + offset;
    if (next < 1970 || next > this.today().getFullYear()) return;
    this.year.set(next);
    this.selectedKey.set(
      next === this.today().getFullYear() ? localDateKey(this.today()) : `${next}-01-01`,
    );
  }

  dayDescription(day: ActivityDay): string {
    const status =
      day.state === 'future'
        ? 'Upcoming day'
        : day.sessions.length
          ? `${day.sessions.length} ${day.sessions.length === 1 ? 'session' : 'sessions'}: ${day.sessions.join(', ')}`
          : 'No training logged';
    return `${day.label}${day.today ? ' · Today' : ''} · ${status}`;
  }

  tabStop(days: ActivityDay[]): string {
    return (
      days.find((day) => day.key === this.selectedKey())?.key ??
      days.find((day) => day.today)?.key ??
      days[0].key
    );
  }

  onDayKey(event: KeyboardEvent, day: ActivityDay, days: ActivityDay[]): void {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let index = day.number - 1;
    if (event.key in step) index += step[event.key];
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = days.length - 1;
    else return;
    event.preventDefault();
    const target = days[Math.max(0, Math.min(days.length - 1, index))];
    this.selectedKey.set(target.key);
    (event.currentTarget as HTMLElement).parentElement
      ?.querySelector<HTMLButtonElement>(`[data-date="${target.key}"]`)
      ?.focus();
  }
}

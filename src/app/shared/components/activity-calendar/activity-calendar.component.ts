import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  model,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, interval } from 'rxjs';
import { WorkoutService } from '../../../core/services/workout.service';
import { RunningSessionService } from '../../../core/services/running-session.service';
import { ActivityDay, activityYear } from '../../../core/utils/activity-calendar';
import { localDateKey } from '../../../core/utils/weight-progress';

@Component({
  selector: 'app-activity-calendar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './activity-calendar.component.html',
  styleUrl: './activity-calendar.component.scss',
})
export class ActivityCalendarComponent implements OnInit {
  private readonly workouts = inject(WorkoutService);
  private readonly running = inject(RunningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly picker = viewChild<ElementRef<HTMLDetailsElement>>('picker');
  readonly today = signal(new Date());
  readonly period = model(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly pickerYear = signal(this.today().getFullYear());
  readonly selectedKey = signal(localDateKey(this.today()));
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly monthNames = Array.from({ length: 12 }, (_, index) =>
    new Date(2026, index, 1).toLocaleDateString('en-GB', { month: 'short' }),
  );
  readonly calendar = computed(() =>
    activityYear(
      this.workouts.workouts(),
      this.running.sessions(),
      this.period().getFullYear(),
      this.today(),
    ),
  );
  readonly month = computed(() => this.calendar().months[this.period().getMonth()]);
  readonly selectedDay = computed(
    () => this.month().days.find((day) => day.key === this.selectedKey()) ?? this.month().days[0],
  );
  readonly currentPeriod = computed(
    () =>
      this.period().getFullYear() === this.today().getFullYear() &&
      this.period().getMonth() === this.today().getMonth(),
  );
  readonly monthLabel = computed(() =>
    this.period().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
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
  selectMonth(year: number, index: number): void {
    if (
      year < 1970 ||
      year * 12 + index > this.today().getFullYear() * 12 + this.today().getMonth()
    )
      return;
    this.period.set(new Date(year, index, 1));
    this.pickerYear.set(year);
    this.selectedKey.set(
      this.currentPeriod() ? localDateKey(this.today()) : localDateKey(this.period()),
    );
    this.closePicker();
  }
  shiftMonth(offset: number): void {
    const next = new Date(this.period().getFullYear(), this.period().getMonth() + offset, 1);
    this.selectMonth(next.getFullYear(), next.getMonth());
  }
  closePicker(): void {
    const picker = this.picker()?.nativeElement;
    if (picker) picker.open = false;
  }
  @HostListener('document:click', ['$event']) outsidePicker(event: MouseEvent): void {
    const picker = this.picker()?.nativeElement;
    if (picker?.open && !picker.contains(event.target as Node)) this.closePicker();
  }
  escapePicker(event: Event): void {
    event.preventDefault();
    this.closePicker();
    this.picker()?.nativeElement.querySelector('summary')?.focus();
  }
  dayDescription(day: ActivityDay): string {
    return `${day.label}${day.today ? ' · Today' : ''} · ${day.state === 'future' ? 'Upcoming day' : day.sessions.length ? day.sessions.join(', ') : 'No training logged'}`;
  }
  onDayKey(event: KeyboardEvent, day: ActivityDay): void {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let index = day.number - 1;
    if (event.key in step) index += step[event.key];
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = this.month().days.length - 1;
    else return;
    event.preventDefault();
    const target = this.month().days[Math.max(0, Math.min(this.month().days.length - 1, index))];
    this.selectedKey.set(target.key);
    (event.currentTarget as HTMLElement).parentElement
      ?.querySelector<HTMLButtonElement>(`[data-date="${target.key}"]`)
      ?.focus();
  }
}

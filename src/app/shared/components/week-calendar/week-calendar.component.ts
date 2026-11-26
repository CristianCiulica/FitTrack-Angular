import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { localDateKey } from '../../../core/utils/weight-progress';

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const month = new Intl.DateTimeFormat('en', { month: 'long' });

@Component({
  selector: 'ft-week-calendar',
  imports: [DatePipe],
  templateUrl: './week-calendar.component.html',
  styleUrl: './week-calendar.component.scss',
})
export class WeekCalendarComponent {
  readonly selected = input.required<string>();
  readonly today = input(localDateKey());
  readonly label = input('Activity calendar');
  readonly markerLabel = input('activity recorded');
  readonly markedDates = input<ReadonlySet<string>>(new Set());
  readonly min = input('');
  readonly max = input('');
  readonly datePicker = input(false);
  readonly disabled = input(false);
  readonly selectedChange = output<string>();

  readonly selectedDate = computed(() => new Date(this.selected() + 'T12:00:00'));
  readonly days = computed(() => {
    const monday = new Date(this.selectedDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return weekdays.map((label, index) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + index);
      return { date, key: localDateKey(date), label };
    });
  });
  readonly weekLabel = computed(() => {
    const first = this.days()[0].date;
    const last = this.days()[6].date;
    return (
      month.format(first) +
      ' ' +
      first.getDate() +
      '–' +
      (first.getMonth() === last.getMonth() ? '' : month.format(last) + ' ') +
      last.getDate()
    );
  });

  readonly canGoBack = computed(
    () => !this.disabled() && (!this.min() || this.days()[0].key > this.min()),
  );
  readonly canGoForward = computed(
    () => !this.disabled() && (!this.max() || this.days()[6].key < this.max()),
  );

  isDisabled(date: string): boolean {
    return (
      this.disabled() || (!!this.min() && date < this.min()) || (!!this.max() && date > this.max())
    );
  }

  select(date: string): void {
    if (date && !this.isDisabled(date)) this.selectedChange.emit(date);
  }

  shift(direction: -1 | 1): void {
    const date = new Date(this.selectedDate());
    date.setDate(date.getDate() + direction * 7);
    const key = localDateKey(date);
    if (this.min() && key < this.min()) this.select(this.min());
    else if (this.max() && key > this.max()) this.select(this.max());
    else this.select(key);
  }
}

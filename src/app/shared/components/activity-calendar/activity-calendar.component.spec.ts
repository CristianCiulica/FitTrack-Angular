import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { ActivityCalendarComponent } from './activity-calendar.component';
import { WorkoutService } from '../../../core/services/workout.service';
import { RunningSessionService } from '../../../core/services/running-session.service';
import { Workout } from '../../../core/models/workout.model';

describe('Monthly progress calendar', () => {
  const workouts = signal<Workout[]>([]);
  beforeEach(() => {
    workouts.set([
      { userId: 'test', name: 'Pull', date: '2026-10-16', kind: 'session', exercises: [] },
    ]);
    TestBed.configureTestingModule({
      imports: [ActivityCalendarComponent],
      providers: [
        provideRouter([]),
        { provide: WorkoutService, useValue: { workouts } },
        {
          provide: RunningSessionService,
          useValue: { sessions: signal([]) },
        },
      ],
    });
  });
  const create = () => {
    const fixture = TestBed.createComponent(ActivityCalendarComponent);
    fixture.componentInstance.today.set(new Date(2026, 9, 17, 12));
    fixture.componentInstance.period.set(new Date(2026, 9, 1));
    fixture.componentInstance.selectedKey.set('2026-10-17');
    fixture.detectChanges();
    return fixture;
  };
  it('renders real activity, date details and keyboard navigation', () => {
    const fixture = create();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.month')).toHaveLength(1);
    expect(element.querySelectorAll('.day')).toHaveLength(31);
    const active = element.querySelector<HTMLButtonElement>('[data-date="2026-10-16"]')!;
    expect(active.classList.contains('active')).toBe(true);
    active.click();
    fixture.detectChanges();
    expect(element.querySelector('.day-detail')?.textContent).toContain('Pull');
    active.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedKey()).toBe('2026-10-17');
    expect(element.querySelector('.day-detail')?.textContent).toContain('No training logged');
    expect(element.querySelector('[data-date="2026-10-18"]')?.classList.contains('future')).toBe(
      true,
    );
    fixture.destroy();
  });
  it('opens another month, crosses a year boundary and blocks future months', () => {
    const fixture = create();
    fixture.componentInstance.shiftMonth(1);
    expect(fixture.componentInstance.period().getMonth()).toBe(9);
    fixture.componentInstance.selectMonth(2024, 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.day')).toHaveLength(29);
    expect(fixture.componentInstance.selectedDay().key).toBe('2024-02-01');
    fixture.componentInstance.selectMonth(2026, 0);
    fixture.componentInstance.shiftMonth(-1);
    expect(fixture.componentInstance.period().getFullYear()).toBe(2025);
    expect(fixture.componentInstance.period().getMonth()).toBe(11);
    fixture.componentInstance.selectMonth(2026, 9);
    fixture.detectChanges();
    const picker = fixture.nativeElement.querySelector('details');
    picker.open = true;
    fixture.componentInstance.selectMonth(2026, 8);
    fixture.detectChanges();
    expect(picker.open).toBe(false);
    expect(fixture.componentInstance.selectedDay().key).toBe('2026-09-01');
    fixture.destroy();
  });
  it('shows the full month and cached sessions throughout a refresh', () => {
    const fixture = create();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.day')).toHaveLength(31);
    expect(fixture.nativeElement.querySelector('.day-detail').textContent).toContain('Updating activity');
    expect(fixture.nativeElement.querySelector('[data-date="2026-10-16"]').classList.contains('active')).toBe(true);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.day.active')).toHaveLength(1);
    workouts.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.day.active')).toHaveLength(0);
    fixture.destroy();
  });
});

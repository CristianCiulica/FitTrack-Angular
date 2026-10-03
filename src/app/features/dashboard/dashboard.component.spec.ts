import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { ProfileService } from '../../core/services/profile.service';
import { RunningSessionService } from '../../core/services/running-session.service';
import { RunningSession } from '../../core/models/running-session.model';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import { NzMessageService } from 'ng-zorro-antd/message';

describe('Dashboard Activity data', () => {
  const sessions = signal<RunningSession[]>([]);
  const units = signal('metric');
  let component: DashboardComponent;

  beforeEach(() => {
    sessions.set([]);
    units.set('metric');
    TestBed.configureTestingModule({ providers: [
      { provide: ProfileService, useValue: { moveGoal: signal(500), exerciseGoal: signal(30), weightKg: signal(75), weeklyWorkoutGoal: signal(4), units } },
      { provide: RunningSessionService, useValue: { sessions } },
    ] });
    component = TestBed.runInInjectionContext(() => new DashboardComponent(
      {} as WorkoutService, {} as AuthService, {} as NzMessageService,
    ));
    component.selectedDate.set(new Date(2026, 9, 1));
  });

  it('uses only the selected local day for movement and distance, with profile units', () => {
    sessions.set([
      { startedAt: new Date(2026, 9, 1, 10).toISOString(), durationSeconds: 2400, distanceMeters: 1609.344, steps: 2100, calories: 650 } as RunningSession,
      { startedAt: new Date(2026, 9, 2, 10).toISOString(), durationSeconds: 600, distanceMeters: 1000, steps: 1000, calories: 100 } as RunningSession,
    ]);
    expect(component.burnedKcal()).toBe(650);
    expect(component.exerciseMinutes()).toBe(40);
    expect(component.stepsForDay()).toBe(2100);
    expect(component.activityDistance()).toBeCloseTo(1.609344);
    units.set('imperial');
    expect(component.activityDistance()).toBeCloseTo(1);
    expect(component.activityDistanceUnit()).toBe('MI');
    expect(component.activityRings()[0].progress).toBe(100);
    expect(component.activityRings()[0].value).toBe(650);
  });

  it('counts the selected calendar week across month boundaries and resets on an empty day', () => {
    component.workouts.set(['2026-09-27', '2026-09-28', '2026-10-01', '2026-10-04', '2026-10-05'].map(date => ({
      userId: 'test', name: 'Workout', date, exercises: [],
    })));
    expect(component.activityWeekWorkouts()).toBe(3);
    component.selectedDate.set(new Date(2026, 9, 5));
    expect(component.activityWeekWorkouts()).toBe(1);
    expect(component.activityRings().map(ring => ring.value)).toEqual([0, 0, 1]);
    expect(component.activityDistance()).toBe(0);
  });
});

describe('Unperformed routines', () => {
  it('never counts a saved plan as movement, exercise or a completed workout', () => {
    TestBed.configureTestingModule({ providers: [
      { provide: ProfileService, useValue: { moveGoal: signal(500), exerciseGoal: signal(30), weightKg: signal(75), weeklyWorkoutGoal: signal(4), units: signal('metric') } },
      { provide: RunningSessionService, useValue: { sessions: signal([]) } },
    ] });
    const component = TestBed.runInInjectionContext(() => new DashboardComponent({} as any, {} as any, {} as any));
    component.selectedDate.set(new Date(2026, 9, 3));
    component.workouts.set([{ kind: 'routine', userId: 'test', name: 'New plan', date: '2026-10-03', exercises: [{ exerciseName: 'Squat', muscleGroup: 'Legs', sets: 3, reps: 20, weight: 0 }] }]);
    expect(component.activityWeekWorkouts()).toBe(0);
    expect(component.burnedKcal()).toBe(0);
    expect(component.exerciseMinutes()).toBe(0);
  });
});

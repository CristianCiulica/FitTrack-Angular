import { Workout } from '../../core/models/workout.model';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { WorkoutsComponent } from './workouts.component';
import { indoorCardioWorkout } from '../../core/utils/indoor-cardio';
import { enrollmentWorkout } from '../../core/utils/program-records';

describe('History separates actual strength and indoor cardio', () => {
  it('retains treadmill records through refresh and deletes them through WorkoutService', () => {
    const cardio = {
      ...indoorCardioWorkout(
        {
          version: 1,
          mode: 'walking',
          startedAt: '2026-10-18T10:00:00Z',
          endedAt: '2026-10-18T10:30:00Z',
          distanceMeters: 2000,
          inclinePercent: 4,
          steps: null,
          calories: null,
        },
        'u',
        'indoor_one',
      ),
      id: 'cardio',
    };
    const strength = {
      userId: 'u',
      id: 'strength',
      kind: 'session' as const,
      name: 'Upper',
      date: '2026-10-18',
      exercises: [],
    };
    const marker = enrollmentWorkout(
      {
        version: 1,
        id: 'pg_test',
        programId: 'build-30',
        startDate: '2026-10-18',
        createdAt: '2026-10-18T09:00:00Z',
      },
      'Build',
      'u',
    );
    const records = signal<Workout[]>([cardio, strength, marker]);
    const service = {
      getWorkouts: () => of(records()),
      deleteWorkout: vi.fn((id: string) => {
        records.update((list) => list.filter((w) => w.id !== id));
        return of(undefined);
      }),
    };
    TestBed.configureTestingModule({});
    const component = TestBed.runInInjectionContext(
      () =>
        new WorkoutsComponent(
          service as any,
          { getSessions: () => of([]) } as any,
          {} as any,
          {} as any,
          { success: vi.fn() } as any,
          {} as any,
        ),
    );
    component.ngOnInit();
    expect(component.filteredWorkouts().map((w) => w.id)).toEqual(['strength']);
    expect(component.runningSessions().map((s) => s.id)).toEqual(['indoor:cardio']);
    expect(component.runningSessions()[0].indoor?.calories).toBeNull();
    component.deleteRunningSession('indoor:cardio');
    expect(service.deleteWorkout).toHaveBeenCalledWith('cardio');
    expect(component.runningSessions()).toEqual([]);
    expect(component.filteredWorkouts().length).toBe(1);
  });
});

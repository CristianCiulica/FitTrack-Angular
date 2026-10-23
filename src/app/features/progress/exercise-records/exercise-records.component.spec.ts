import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ExerciseRecordsComponent } from './exercise-records.component';
import { WorkoutService } from '../../../core/services/workout.service';
import { ProfileService } from '../../../core/services/profile.service';
import { Workout } from '../../../core/models/workout.model';

describe('Exercise muscle group selection', () => {
  const workouts = signal<Workout[]>([]);
  let component: ExerciseRecordsComponent;
  beforeEach(() => {
    workouts.set([
      {
        userId: 'test',
        name: 'Push',
        date: '2026-10-01',
        kind: 'session',
        exercises: [
          { exerciseName: 'Press', muscleGroup: 'Chest', sets: 1, reps: 10, weight: 40 },
          { exerciseName: 'Pushdown', muscleGroup: 'Arms', sets: 1, reps: 12, weight: 30 },
          { exerciseName: 'Curl', muscleGroup: 'Arms', sets: 1, reps: 10, weight: 15 },
        ],
      },
    ]);
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkoutService, useValue: { workouts } },
        { provide: ProfileService, useValue: { units: () => 'metric' } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new ExerciseRecordsComponent());
  });
  it('starts with only recorded muscle groups and no endless list of exercises', () => {
    expect(component.groups()).toEqual([
      { name: 'Chest', count: 1 },
      { name: 'Arms', count: 2 },
    ]);
    expect(component.filtered()).toEqual([]);
  });
  it('filters search inside a selected group and resets search when returning to the group picker', () => {
    component.chooseGroup('Arms');
    expect(component.filtered()).toHaveLength(2);
    component.search.set('curl');
    expect(component.filtered().map((r) => r.name)).toEqual(['Curl']);
    component.chooseGroup(null);
    expect(component.search()).toBe('');
    expect(component.filtered()).toEqual([]);
    component.chooseGroup('Chest');
    expect(component.filtered().map((r) => r.name)).toEqual(['Press']);
  });
  it('returns to the picker if deleting history removes the selected muscle group', () => {
    component.chooseGroup('Arms');
    workouts.set([]);
    expect(component.activeGroup()).toBeNull();
    expect(component.filtered()).toEqual([]);
  });
});

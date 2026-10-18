import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { WorkoutService } from '../../core/services/workout.service';
import { Workout } from '../../core/models/workout.model';
import { TrainingPlannerComponent } from './training-planner.component';
import { buildTrainingPlan } from './training-planner.engine';
import { TrainingPreferences } from './training-planner.model';
const preferences: TrainingPreferences = {
  goal: 'muscle',
  experience: 'consistent',
  equipment: ['machines', 'dumbbells', 'bench', 'cables'],
  days: [0, 1, 3, 4],
  minutes: 60,
  focus: 'balanced',
  readiness: 'ready',
};

describe('Training planner save and recovery', () => {
  let component: TrainingPlannerComponent;
  let records: ReturnType<typeof signal<Workout[]>>;
  let service: {
    workouts: typeof records;
    addWorkout: ReturnType<typeof vi.fn>;
    updateWorkout: ReturnType<typeof vi.fn>;
    isDurablySaved: ReturnType<typeof vi.fn>;
  };
  let auth: { currentUserId: string };
  beforeEach(() => {
    localStorage.clear();
    records = signal<Workout[]>([]);
    auth = { currentUserId: 'training-user' };
    service = {
      workouts: records,
      addWorkout: vi.fn((record: Workout) => {
        const saved = { ...record, id: 'saved-' + record.clientId };
        records.update((r) => [...r, saved]);
        return of(saved);
      }),
      updateWorkout: vi.fn((id: string, record: Workout) => {
        const saved = { ...record, id };
        records.update((r) => r.map((w) => (w.id === id ? saved : w)));
        return of(saved);
      }),
      isDurablySaved: vi.fn(() => true),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkoutService, useValue: service },
        { provide: AuthService, useValue: auth },
        { provide: ProfileService, useValue: { units: signal('metric') } },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new TrainingPlannerComponent());
    component.plan.set(buildTrainingPlan(preferences));
    component.answers.set(preferences);
  });
  afterEach(() => TestBed.resetTestingModule());
  it('saves one routine per day and a second save cannot duplicate them', async () => {
    expect(await component.save()).toBe(true);
    expect(records().length).toBe(4);
    expect(component.saved()).toBe(true);
    expect(await component.save()).toBe(true);
    expect(service.addWorkout).toHaveBeenCalledTimes(4);
    expect(service.updateWorkout).not.toHaveBeenCalled();
    expect(records().every((r) => r.kind === 'routine')).toBe(true);
  });
  it('resumes after a partial failure using the same client identifiers', async () => {
    const original = service.addWorkout.getMockImplementation()!;
    service.addWorkout
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => throwError(() => new Error('Connection interrupted')));
    expect(await component.save()).toBe(false);
    expect(records().length).toBe(1);
    expect(component.saved()).toBe(false);
    expect(component.saving()).toBe(false);
    expect(await component.save()).toBe(true);
    expect(records().length).toBe(4);
    expect(new Set(records().map((r) => r.clientId)).size).toBe(4);
  });
  it('reports durable device saves honestly and does not claim success on storage failure', async () => {
    service.addWorkout.mockImplementation((record: Workout) => {
      const saved = { ...record, id: 'w_' + record.clientId };
      records.update((r) => [...r, saved]);
      return of(saved);
    });
    expect(await component.save()).toBe(true);
    expect(component.saveMessage()).toContain('this device');
    records.set([]);
    component.saved.set(false);
    service.isDurablySaved.mockReturnValue(false);
    expect(await component.save()).toBe(false);
    expect(component.saved()).toBe(false);
    expect(component.error()).toContain('storage');
  });
  it('restores unfinished preferences and keeps draft ownership separate', () => {
    component.plan.set(null);
    component.choose('goal', 'strength');
    component.choose('experience', 'new');
    component.step.set(2);
    component.choose('equipment', ['dumbbells']);
    const next = TestBed.runInInjectionContext(() => new TrainingPlannerComponent());
    (next as any).restoreDraft();
    expect(next.answers().goal).toBe('strength');
    expect(next.answers().equipment).toEqual(['dumbbells']);
    expect(next.step()).toBe(2);
    auth.currentUserId = 'other-user';
    const other = TestBed.runInInjectionContext(() => new TrainingPlannerComponent());
    (other as any).restoreDraft();
    expect(other.answers().goal).toBeUndefined();
  });
  it('stops a multi-day save if the signed-in account changes', async () => {
    const response = new Subject<Workout>();
    service.addWorkout.mockReturnValueOnce(response);
    const pending = component.save();
    auth.currentUserId = 'other-user';
    response.next({
      userId: 'training-user',
      id: 'saved',
      name: 'First day',
      date: '2026-10-18',
      exercises: [],
    });
    response.complete();
    expect(await pending).toBe(false);
    expect(service.addWorkout).toHaveBeenCalledTimes(1);
    expect(component.saved()).toBe(false);
  });
  it('does not save for an unsigned account', async () => {
    auth.currentUserId = '';
    expect(await component.save()).toBe(false);
    expect(service.addWorkout).not.toHaveBeenCalled();
  });
});

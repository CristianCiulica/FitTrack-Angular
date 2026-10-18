import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { indoorCardio } from '../../../core/utils/indoor-cardio';
import { IndoorCardioComponent } from './indoor-cardio.component';

describe('Treadmill logger', () => {
  let component: IndoorCardioComponent;
  let add: ReturnType<typeof vi.fn>;
  const units = signal('metric');
  beforeEach(() => {
    units.set('metric');
    add = vi.fn((w) => of({ ...w, id: 'saved' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUserId: 'u' } },
        { provide: ProfileService, useValue: { units } },
        { provide: WorkoutService, useValue: { addWorkout: add, isDurablySaved: () => true } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new IndoorCardioComponent());
    (component as any).owner = 'u';
    (component as any).clientId = 'indoor_test';
    component.finishedAt = '2026-01-01T12:00';
    component.minutes = 30;
    component.distance = 2;
  });
  afterEach(() => TestBed.resetTestingModule());
  it('accepts numeric Angular input values and converts imperial distance once', async () => {
    units.set('imperial');
    component.distance = 1;
    component.calories = 120;
    component.incline = 5;
    expect(component.canSave).toBe(true);
    await component.save();
    const value = add.mock.calls[0][0];
    expect(indoorCardio(value)?.distanceMeters).toBeCloseTo(1609.344);
    expect(indoorCardio(value)?.calories).toBe(120);
    expect(indoorCardio(value)?.steps).toBeNull();
    expect(component.success()).toContain('Cardio');
  });
  it('prevents invalid and future sessions, accepts blank optional values', () => {
    component.minutes = null;
    expect(component.canSave).toBe(false);
    component.minutes = 30;
    component.distance = 0;
    expect(component.canSave).toBe(false);
    component.distance = 2;
    component.finishedAt = '2099-01-01T12:00';
    expect(component.canSave).toBe(false);
    component.finishedAt = '2026-01-01T12:00';
    component.incline = null;
    component.steps = null;
    expect(component.canSave).toBe(true);
  });
  it('retries with the same client id and never submits twice after success', async () => {
    add.mockReturnValueOnce(throwError(() => new Error('Offline')));
    expect(component.canSave).toBe(true);
    await component.save();
    expect(component.error()).toBe('Offline');
    await component.save();
    await component.save();
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((c) => c[0].clientId)).toEqual(['indoor_test', 'indoor_test']);
  });
});

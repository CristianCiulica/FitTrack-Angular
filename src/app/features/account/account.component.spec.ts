import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WeightService } from '../../core/services/weight.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { AccountComponent } from './account.component';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { UserProfile } from '../../core/models/user-profile.model';

describe('Redesigned profile', () => {
  const profile = signal<UserProfile>({
    displayName: 'Cristian',
    age: 25,
    heightCm: 180,
    weightKg: 80,
    sex: 'male',
    units: 'metric',
    goal: 'maintain',
  } as UserProfile);
  const units = signal<'metric' | 'imperial'>('metric');
  const patch = vi.fn();
  let component: AccountComponent;
  beforeEach(() => {
    profile.set({
      displayName: 'Cristian',
      age: 25,
      heightCm: 180,
      weightKg: 80,
      sex: 'male',
      units: 'metric',
      goal: 'maintain',
    } as UserProfile);
    units.set('metric');
    patch.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AchievementsService, useValue: { load: () => of(void 0) } },
        { provide: WeightService, useValue: { getEntries: () => of([]) } },
        {
          provide: ProfileService,
          useValue: {
            profile,
            units,
            displayName: signal('Cristian'),
            weeklyWorkoutGoal: signal(4),
            load: () => of(profile()),
            patch,
          },
        },
        { provide: AuthService, useValue: { logout: () => of(null) } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AccountComponent());
    component.ngOnInit();
  });
  it('preserves draft edits on errors and validates empty or invalid values', () => {
    expect(component.dirty()).toBe(false);
    component.name.set('Updated');
    component.age.set(null);
    expect(component.valid()).toBe(false);
    component.save();
    expect(patch).not.toHaveBeenCalled();
    component.age.set(26);
    patch.mockReturnValue(throwError(() => new Error('offline')));
    component.save();
    expect(component.name()).toBe('Updated');
    expect(component.dirty()).toBe(true);
    expect(component.error()).toContain('weren’t saved');
    expect(component.saving()).toBe(false);
    component.discard();
    expect(component.name()).toBe('Cristian');
    expect(component.dirty()).toBe(false);
  });
  it('prevents duplicate saves and accepts a confirmed saved profile', () => {
    const response = new Subject<UserProfile>();
    patch.mockReturnValue(response);
    component.name.set('New name');
    component.save();
    component.save();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(component.saving()).toBe(true);
    profile.update((value) => ({ ...value, displayName: 'New name' }));
    response.next(profile());
    response.complete();
    expect(component.dirty()).toBe(false);
    expect(component.notice()).toContain('up to date');
  });
  it('converts imperial input to metric storage and preserves null fields for validation', () => {
    units.set('imperial');
    component.onWeightInput(176.4);
    expect(component.weightKg()).toBeCloseTo(80, 0);
    component.onFeetInput(6);
    expect(component.heightCm()).toBeGreaterThan(180);
    component.onWeightInput(null);
    expect(component.weightInput()).toBeNull();
    expect(component.valid()).toBe(false);
  });
});

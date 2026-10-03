import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { BmiComponent } from './bmi.component';

describe('Nutrition autosave', () => {
  afterEach(() => vi.useRealTimers());
  it('flushes the latest input when leaving before the debounce expires', () => {
    vi.useFakeTimers();
    const patch = vi.fn((_update: unknown) => of({}));
    TestBed.configureTestingModule({ providers: [
      { provide: ProfileService, useValue: { load: () => of(null), profile: signal({ weightKg: 75 }), units: signal('metric'), patch } },
      { provide: AuthService, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => new BmiComponent());
    component.onWeightInput(76); component.onWeightInput(77);
    component.setGoal('maintain');
    expect(patch).not.toHaveBeenCalled();
    component.ngOnDestroy();
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch.mock.calls[0][0]).toMatchObject({ weightKg: 77 });
    expect(patch.mock.calls[1][0]).toMatchObject({ goal: 'maintain' });
    vi.advanceTimersByTime(1000);
    expect(patch).toHaveBeenCalledTimes(2);
  });
});

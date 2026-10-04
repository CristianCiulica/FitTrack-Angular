import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { ArrowLeftOutline, ArrowRightOutline, ThunderboltOutline } from '@ant-design/icons-angular/icons';
import { ProfileService } from '../../core/services/profile.service';
import { ThemeService, THEME_STORAGE_KEY } from '../../core/services/theme.service';
import { OnboardingComponent } from './onboarding.component';

describe('New account onboarding', () => {
  let component: OnboardingComponent;
  let onboarded: ReturnType<typeof signal<boolean>>;
  let response: Subject<any>;
  let patch: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let error: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    onboarded = signal(false);
    response = new Subject();
    patch = vi.fn(() => { onboarded.set(true); return response; });
    navigate = vi.fn().mockResolvedValue(true);
    error = vi.fn();
    TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [provideNoopAnimations(), provideNzIcons([ArrowLeftOutline, ArrowRightOutline, ThunderboltOutline]),
        { provide: ProfileService, useValue: { profile: signal(null), isOnboarded: onboarded, patch } },
        { provide: Router, useValue: { navigate } },
        { provide: NzMessageService, useValue: { error } },
      ],
    });
    component = TestBed.createComponent(OnboardingComponent).componentInstance;
    component.ngOnInit();
    TestBed.tick();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
    document.documentElement.style.removeProperty('background-color');
  });

  function reachPlan() {
    component.name.set('Alex');
    for (let i = 0; i < 7; i++) component.next();
    expect(component.step()).toBe('plan');
  }

  it('asks for appearance after the name and keeps selections when going back', () => {
    component.next();
    expect(component.step()).toBe('name');
    component.name.set('Alex');
    component.next();
    expect(component.step()).toBe('appearance');
    component.appearance.setPreference('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    component.next();
    expect(component.step()).toBe('age');
    component.back();
    expect(component.step()).toBe('appearance');
    expect(component.appearance.preference()).toBe('dark');
    expect(component.name()).toBe('Alex');
  });

  it('blocks missing or out-of-range body values and invalid age', () => {
    component.step.set('age');
    for (const age of [null, NaN, 11, 101, 25.5]) {
      component.age.set(age as number);
      component.next();
      expect(component.step()).toBe('age');
    }
    component.age.set(25); component.next();
    expect(component.step()).toBe('body');
    for (const weight of [null, NaN, 29, 301, Infinity]) {
      component.weightKg.set(weight as number);
      component.next();
      expect(component.step()).toBe('body');
    }
    component.weightKg.set(70); component.heightCm.set(231);
    component.next(); expect(component.step()).toBe('body');
    component.heightCm.set(170); component.next(); expect(component.step()).toBe('goal');
  });

  it('saves the theme and Later opens Home only after saving succeeds', () => {
    reachPlan();
    component.appearance.setPreference('dark');
    component.finish(false);
    TestBed.tick();
    expect(navigate).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Alex', theme: 'dark', weeklyWorkoutGoal: 4 }));
    response.next({}); response.complete(); TestBed.tick();
    expect(navigate.mock.calls).toEqual([[['/dashboard']]]);
  });

  it('opens the recommended collection without an optimistic redirect or duplicate save', () => {
    reachPlan();
    component.finish(true); component.finish(false); component.back();
    TestBed.tick();
    expect(patch).toHaveBeenCalledTimes(1);
    expect(component.step()).toBe('plan');
    expect(navigate).not.toHaveBeenCalled();
    response.next({}); response.complete(); TestBed.tick();
    expect(navigate.mock.calls).toEqual([[['/start-workout'], { queryParams: { plan: 'push-pull-legs' } }]]);
  });

  it('keeps a failed save retryable with the chosen appearance and destination', () => {
    reachPlan();
    component.appearance.setPreference('system');
    component.finish(true); response.error(new Error('Offline'));
    onboarded.set(false); TestBed.tick();
    expect(component.saving()).toBe(false);
    expect(component.step()).toBe('plan');
    expect(error).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    response = new Subject();
    component.finish(true); response.next({}); response.complete(); TestBed.tick();
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch.mock.calls[1][0].theme).toBe('system');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('rechecks earlier values before saving and redirects existing profiles', () => {
    reachPlan(); component.heightCm.set(0); component.finish();
    expect(component.step()).toBe('body');
    expect(patch).not.toHaveBeenCalled();
    onboarded.set(true); TestBed.tick();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(TestBed.inject(ThemeService).preference()).toBe('system');
  });
});

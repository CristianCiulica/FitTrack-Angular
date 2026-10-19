import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AchievementsService } from './achievements.service';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';
import { WorkoutService } from './workout.service';
import { RunningSessionService } from './running-session.service';
import { Workout } from '../models/workout.model';
import { AchievementId } from '../models/achievement.model';
import { localDateKey } from '../utils/weight-progress';

describe('Earned profile badges', () => {
  const user = signal({ uid: 'alice' });
  const records = signal<Workout[]>([]);
  const profile = signal({ uid: 'alice', featuredBadgeIds: [] as AchievementId[] });
  const patch = vi.fn();
  const getWorkouts = vi.fn();
  let service: AchievementsService;
  beforeEach(() => {
    user.set({ uid: 'alice' });
    records.set([]);
    profile.set({ uid: 'alice', featuredBadgeIds: [] });
    getWorkouts.mockReset().mockImplementation(() => of(records()));
    patch.mockReset().mockImplementation((update) => {
      profile.update((p) => ({ ...p, ...update }));
      return of(profile());
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: user,
            get currentUserId() {
              return user().uid;
            },
          },
        },
        { provide: ProfileService, useValue: { profile, patch } },
        { provide: WorkoutService, useValue: { workouts: records, getWorkouts } },
        {
          provide: RunningSessionService,
          useValue: { sessions: signal([]), getSessions: () => of([]) },
        },
      ],
    });
    service = TestBed.inject(AchievementsService);
  });
  function sessions(count: number): Workout[] {
    return Array.from({ length: count }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        userId: 'alice',
        kind: 'session',
        name: 'Training',
        date: localDateKey(date),
        exercises: [],
      };
    });
  }
  it('only features earned badges; routines cannot earn them', async () => {
    records.set(sessions(1).map((w) => ({ ...w, kind: 'routine' })));
    profile.set({ uid: 'alice', featuredBadgeIds: ['first-session'] });
    await firstValueFrom(service.load());
    expect(service.featured()).toEqual([]);
    service.toggle('first-session');
    expect(patch).not.toHaveBeenCalled();
    records.set(sessions(1));
    expect(service.featured().map((b) => b.id)).toEqual(['first-session']);
    service.toggle('first-session');
    expect(patch).toHaveBeenLastCalledWith({ featuredBadgeIds: [] });
  });
  it('persists at most three earned badges and supports replacing one', async () => {
    records.set(sessions(25));
    await firstValueFrom(service.load());
    for (const badge of service.badges()) service.toggle(badge.id);
    expect(profile().featuredBadgeIds).toHaveLength(3);
    expect(patch).toHaveBeenCalledTimes(3);
    service.toggle('first-session');
    service.toggle('seven-day-streak');
    expect(profile().featuredBadgeIds).toEqual([
      'ten-sessions',
      'twenty-five-days',
      'seven-day-streak',
    ]);
  });
  it('hides badges across account changes and ignores late history responses', async () => {
    records.set(sessions(1));
    profile.set({ uid: 'alice', featuredBadgeIds: ['first-session'] });
    await firstValueFrom(service.load());
    expect(service.featured()).toHaveLength(1);
    const response = new Subject<Workout[]>();
    getWorkouts.mockReturnValue(response);
    const loading = firstValueFrom(service.load());
    user.set({ uid: 'bob' });
    response.next([]);
    response.complete();
    await loading;
    expect(service.ready()).toBe(false);
    expect(service.featured()).toEqual([]);
    service.toggle('first-session');
    expect(patch).not.toHaveBeenCalled();
  });
  it('blocks duplicate writes and exposes failure without keeping an unsaved selection', async () => {
    records.set(sessions(1));
    await firstValueFrom(service.load());
    const response = new Subject<never>();
    patch.mockReturnValue(response);
    service.toggle('first-session');
    service.toggle('first-session');
    expect(patch).toHaveBeenCalledTimes(1);
    response.error(new Error('offline'));
    expect(service.saving()).toBe(false);
    expect(service.error()).toContain('wasn’t saved');
    expect(service.featured()).toEqual([]);
    getWorkouts.mockReturnValue(throwError(() => new Error('offline')));
    await expect(firstValueFrom(service.load())).rejects.toThrow('offline');
    expect(service.ready()).toBe(false);
    expect(service.loading()).toBe(false);
    expect(service.error()).toContain('couldn’t load');
  });
});

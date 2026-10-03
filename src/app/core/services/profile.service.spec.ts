import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from './api.service';
import { ProfileService } from './profile.service';
import { UserProfile } from '../models/user-profile.model';

describe('Profile responsiveness', () => {
  let service: ProfileService;
  let api: { get: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
  const profile = { uid: 'a', displayName: 'Alex', heightCm: 180, weightKg: 75, age: 30 } as UserProfile;
  beforeEach(() => {
    localStorage.clear();
    api = { get: vi.fn(() => of({ profile })), patch: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: api }, { provide: Auth, useValue: { currentUser: { uid: 'a' } } },
    ] });
    service = TestBed.inject(ProfileService);
  });
  it('uses the cached profile without waiting for a background refresh', () => {
    localStorage.setItem('fittrack_profile:a', JSON.stringify(profile));
    const response = new Subject<{ profile: UserProfile }>();
    api.get.mockReturnValue(response);
    service.load(true).subscribe();
    const ready = vi.fn();
    service.load().subscribe(ready);
    expect(ready).toHaveBeenCalledWith(profile);
    expect(service.isOnboarded()).toBe(true);
    expect(api.get).toHaveBeenCalledOnce();
  });
  it('shares concurrent profile reads', () => {
    api.get.mockReturnValue(new Subject());
    service.load().subscribe(); service.load().subscribe();
    expect(api.get).toHaveBeenCalledOnce();
  });
  it('sends rapid edits in order and keeps the newest input visible', () => {
    service.load().subscribe();
    const first = new Subject<{ profile: UserProfile }>();
    const second = new Subject<{ profile: UserProfile }>();
    api.patch.mockReturnValueOnce(first).mockReturnValueOnce(second);
    service.patch({ weightKg: 76 }).subscribe();
    service.patch({ weightKg: 77 }).subscribe();
    expect(api.patch).toHaveBeenCalledTimes(1);
    first.next({ profile: { ...profile, weightKg: 76 } }); first.complete();
    expect(service.weightKg()).toBe(77);
    expect(api.patch).toHaveBeenCalledTimes(2);
    second.next({ profile: { ...profile, weightKg: 77 } }); second.complete();
    expect(service.weightKg()).toBe(77);
  });
  it('reports a failed save and continues processing subsequent edits', () => {
    service.load().subscribe();
    api.patch.mockReturnValueOnce(throwError(() => new Error('Offline'))).mockReturnValueOnce(of({ profile: { ...profile, weightKg: 77 } }));
    const error = vi.fn();
    service.patch({ weightKg: 76 }).subscribe({ error });
    expect(error).toHaveBeenCalledOnce();
    expect(service.weightKg()).toBe(75);
    service.patch({ weightKg: 77 }).subscribe();
    expect(service.weightKg()).toBe(77);
  });
  it('does not replace an edit with an older background profile response', () => {
    service.load().subscribe();
    const response = new Subject<{ profile: UserProfile }>();
    api.get.mockReturnValue(response);
    service.refresh().subscribe();
    api.patch.mockReturnValue(of({ profile: { ...profile, weightKg: 77 } }));
    service.patch({ weightKg: 77 }).subscribe();
    response.next({ profile }); response.complete();
    expect(service.weightKg()).toBe(77);
  });
  it('keeps a confirmed weigh-in when an older profile read arrives', () => {
    service.load().subscribe();
    const response = new Subject<{ profile: UserProfile }>();
    api.get.mockReturnValue(response);
    service.refresh().subscribe();
    service.acceptServerProfile({ ...profile, weightKg: 74 });
    response.next({ profile }); response.complete();
    expect(service.weightKg()).toBe(74);
  });
});

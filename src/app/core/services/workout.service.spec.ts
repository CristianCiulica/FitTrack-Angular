import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { WorkoutService } from './workout.service';

describe('Workout persistence', () => {
  const record = {
    id: 'server-id',
    name: 'Push',
    exercises: [],
    date: '2026-10-01',
    userId: 'test',
  };
  let service: WorkoutService;
  let api: {
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    localStorage.clear();
    api = {
      get: vi.fn(() => of({ workouts: [record] })),
      delete: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Auth, useValue: { currentUser: { uid: 'test' } } },
      ],
    });
    service = TestBed.inject(WorkoutService);
    service.getWorkouts().subscribe();
  });
  it('retains a record and reports a failed server deletion', () => {
    api.delete.mockReturnValue(throwError(() => new Error('Offline')));
    const failure = vi.fn();
    service.deleteWorkout(record.id).subscribe({ error: failure });
    expect(failure).toHaveBeenCalled();
    expect(service.workouts()).toEqual([record]);
  });
  it('removes the cache only once the server confirms deletion', () => {
    api.delete.mockReturnValue(of({ deleted: true }));
    service.deleteWorkout(record.id).subscribe();
    expect(service.workouts()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('fittrack_cache_workouts:test')!)).toEqual([]);
  });
  it('does not erase the saved version when an edit fails', () => {
    api.put.mockReturnValue(throwError(() => new Error('Offline')));
    service.updateWorkout(record.id, { name: 'Changed' }).subscribe({ error: () => {} });
    expect(service.workouts()[0].name).toBe('Push');
  });

  it('still confirms the uploaded workout when browser storage is blocked', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    api.post.mockReturnValue(of({ workout: { ...record, id: 'uploaded-id' } }));
    service.addWorkout(record).subscribe();
    expect(service.workouts().some((item) => item.id === 'uploaded-id')).toBe(true);
    storage.mockRestore();
  });

  it('waits for an in-flight upload before deleting its server record', () => {
    const upload = new Subject<{ workout: typeof record }>();
    api.post.mockReturnValue(upload);
    api.delete.mockReturnValue(of({ deleted: true }));
    service.addWorkout(record).subscribe();
    const tempId = service.workouts().find((item) => item.id?.startsWith('w_'))!.id!;
    const deleted = vi.fn();
    service.deleteWorkout(tempId).subscribe({ next: deleted });
    expect(api.delete).not.toHaveBeenCalled();
    upload.next({ workout: { ...record, id: 'uploaded-id' } });
    upload.complete();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledWith('/workouts/uploaded-id');
    expect(deleted).toHaveBeenCalledOnce();
    expect(service.workouts()).toEqual([record]);
  });

  it('shares an offline resync and deletes it even when two loads overlap', () => {
    const pending = { ...record, id: 'w_offline' };
    localStorage.setItem('fittrack_cache_workouts:test', JSON.stringify([pending]));
    const upload = new Subject<{ workout: typeof record }>();
    api.post.mockReturnValue(upload);
    api.get.mockReturnValue(of({ workouts: [] }));
    api.delete.mockReturnValue(of({ deleted: true }));
    service.getWorkouts(true).subscribe();
    service.getWorkouts(true).subscribe();
    service.deleteWorkout(pending.id).subscribe();
    upload.next({ workout: { ...record, id: 'uploaded-id' } });
    upload.complete();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledWith('/workouts/uploaded-id');
    expect(service.workouts()).toEqual([]);
  });

  it('retains the offline workout and reports a failed upload while deleting', () => {
    const upload = new Subject<{ workout: typeof record }>();
    api.post.mockReturnValue(upload);
    service.addWorkout(record).subscribe();
    const pending = service.workouts().find((item) => item.id?.startsWith('w_'))!;
    const failure = vi.fn();
    service.deleteWorkout(pending.id!).subscribe({ error: failure });
    upload.error(new Error('Offline'));
    expect(failure).toHaveBeenCalledOnce();
    expect(api.delete).not.toHaveBeenCalled();
    expect(service.workouts()).toContainEqual(pending);
  });

  it('resolves stale temporary ids after upload and retains a failed server deletion', () => {
    const upload = new Subject<{ workout: typeof record }>();
    api.post.mockReturnValue(upload);
    service.addWorkout(record).subscribe();
    const tempId = service.workouts().find((item) => item.id?.startsWith('w_'))!.id!;
    const saved = { ...record, id: 'uploaded-id' };
    upload.next({ workout: saved });
    upload.complete();
    api.delete.mockReturnValue(throwError(() => new Error('Offline')));
    const failure = vi.fn();
    service.deleteWorkout(tempId).subscribe({ error: failure });
    expect(api.delete).toHaveBeenCalledWith('/workouts/uploaded-id');
    expect(failure).toHaveBeenCalledOnce();
    expect(service.workouts()).toContainEqual(saved);
  });
});

describe('Workout upload consistency', () => {
  let service: WorkoutService;
  let api: any;
  const record = { userId: 'test', name: 'Original', date: '2026-10-03', exercises: [] };
  beforeEach(() => {
    localStorage.clear();
    api = { get: vi.fn(() => of({ workouts: [] })), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Auth, useValue: { currentUser: { uid: 'test' } } },
      ],
    });
    service = TestBed.inject(WorkoutService);
  });
  it('saves an edit made while the original POST is pending', () => {
    const pending = new Subject<any>();
    api.post.mockReturnValue(pending);
    api.put.mockImplementation((_path: string, body: any) =>
      of({ workout: { ...body, id: 'saved', pendingUpdate: undefined } }),
    );
    service.addWorkout(record).subscribe();
    const id = service.workouts()[0].id!;
    service.updateWorkout(id, { name: 'Edited' }).subscribe();
    pending.next({ workout: { ...record, id: 'saved' } });
    pending.complete();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith(
      '/workouts/saved',
      expect.objectContaining({ name: 'Edited' }),
    );
    expect(service.workouts()[0].name).toBe('Edited');
  });
  it('keeps an unconfirmed edit in the outbox and retries it after reconnecting', () => {
    const pending = new Subject<any>();
    api.post.mockReturnValue(pending);
    api.put.mockReturnValue(throwError(() => new Error('Offline')));
    service.addWorkout(record).subscribe();
    service.updateWorkout(service.workouts()[0].id!, { name: 'Edited' }).subscribe();
    pending.next({ workout: { ...record, id: 'saved' } });
    pending.complete();
    expect(service.workouts()[0]).toMatchObject({ name: 'Edited', pendingUpdate: true });
    api.get.mockReturnValue(of({ workouts: [{ ...record, id: 'saved' }] }));
    api.put.mockReturnValue(of({ workout: { ...record, name: 'Edited', id: 'saved' } }));
    service.getWorkouts(true).subscribe();
    expect(service.workouts()[0].name).toBe('Edited');
    expect(service.workouts()[0].pendingUpdate).toBeUndefined();
  });
  it('keeps the same client id across reloads and retries', () => {
    api.post.mockReturnValue(throwError(() => new Error('Lost response')));
    service.addWorkout({ ...record, clientId: 'w_session' }).subscribe();
    const clientId = api.post.mock.calls[0][1].clientId;
    service.getWorkouts(true).subscribe();
    expect(api.post.mock.calls.at(-1)[1].clientId).toBe(clientId);
    service.addWorkout({ ...record, clientId: 'w_session' }).subscribe();
    expect(service.workouts()).toHaveLength(1);
  });
  it('never restores erased account data from an old in-flight response', () => {
    const pending = new Subject<any>();
    api.post.mockReturnValue(pending);
    service.addWorkout(record).subscribe();
    service.eraseCache('test');
    pending.next({ workout: { ...record, id: 'saved' } });
    pending.complete();
    expect(service.workouts()).toEqual([]);
  });
});

describe('Lost workout response reconciliation', () => {
  it('shows one workout when GET already contains the unacknowledged POST', () => {
    localStorage.clear();
    const pending = {
      id: 'w_pending',
      clientId: 'w_stable',
      name: 'Push',
      exercises: [],
      date: '2026-10-04',
      userId: 'test',
      kind: 'session',
    };
    localStorage.setItem('fittrack_cache_workouts:test', JSON.stringify([pending]));
    const api = {
      get: vi.fn(() => of({ workouts: [{ ...pending, id: 'canonical' }] })),
      post: vi.fn(() => of({ workout: { ...pending, id: 'canonical' } })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Auth, useValue: { currentUser: { uid: 'test' } } },
      ],
    });
    const service = TestBed.inject(WorkoutService);
    service.getWorkouts(true).subscribe();
    expect(service.workouts()).toHaveLength(1);
    expect(service.workouts()[0].id).toBe('canonical');
  });
  it('reports memory-only data as unsafe when both storage and upload fail', () => {
    localStorage.clear();
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { post: () => throwError(() => new Error('Offline')) } },
        { provide: Auth, useValue: { currentUser: { uid: 'test' } } },
      ],
    });
    const service = TestBed.inject(WorkoutService);
    service
      .addWorkout({ name: 'Push', exercises: [], date: '2026-10-04', userId: 'test' })
      .subscribe((saved) => expect(service.isDurablySaved(saved)).toBe(false));
    blocked.mockRestore();
  });
});

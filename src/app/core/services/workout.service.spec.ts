import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { WorkoutService } from './workout.service';

describe('Workout persistence', () => {
  const record = { id: 'server-id', name: 'Push', exercises: [], date: '2026-10-01', userId: 'test' };
  let service: WorkoutService;
  let api: { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    localStorage.clear();
    api = { get: vi.fn(() => of({ workouts: [record] })), delete: vi.fn(), put: vi.fn(), post: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, { provide: Auth, useValue: { currentUser: { uid: 'test' } } }] });
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

  it('waits for an in-flight upload before deleting its server record', () => {
    const upload = new Subject<{ workout: typeof record }>();
    api.post.mockReturnValue(upload);
    api.delete.mockReturnValue(of({ deleted: true }));
    service.addWorkout(record).subscribe();
    const tempId = service.workouts().find(item => item.id?.startsWith('w_'))!.id!;
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
    service.getWorkouts().subscribe();
    service.getWorkouts().subscribe();
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
    const pending = service.workouts().find(item => item.id?.startsWith('w_'))!;
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
    const tempId = service.workouts().find(item => item.id?.startsWith('w_'))!.id!;
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

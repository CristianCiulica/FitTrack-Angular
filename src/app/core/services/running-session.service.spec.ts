import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { RunningSessionService } from './running-session.service';

describe('Running session persistence', () => {
  const record = { id: 'server-id', mode: 'running' as const, startedAt: '2026-10-01T12:00:00Z', endedAt: '2026-10-01T12:10:00Z', durationSeconds: 600, distanceMeters: 1000, steps: 900, averageSpeedKmh: 6, calories: 60, route: [[44.4, 26.1]] as [number, number][], userId: 'test' };
  let service: RunningSessionService;
  let api: { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    localStorage.clear();
    api = { get: vi.fn(() => of({ sessions: [record] })), delete: vi.fn(), put: vi.fn(), post: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, { provide: Auth, useValue: { currentUser: { uid: 'test' } } }] });
    service = TestBed.inject(RunningSessionService);
    service.getSessions().subscribe();
  });
  it('retains a record and reports a failed server deletion', () => {
    api.delete.mockReturnValue(throwError(() => new Error('Offline')));
    const failure = vi.fn();
    service.deleteSession(record.id).subscribe({ error: failure });
    expect(failure).toHaveBeenCalled();
    expect(service.sessions()).toEqual([record]);
  });
  it('removes the cache only once the server confirms deletion', () => {
    api.delete.mockReturnValue(of({ deleted: true }));
    service.deleteSession(record.id).subscribe();
    expect(service.sessions()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('fittrack_cache_sessions:test')!)).toEqual([]);
  });
  it('waits for an in-flight upload before deleting its server record', () => {
    const upload = new Subject<{ session: typeof record }>();
    api.post.mockReturnValue(upload);
    api.delete.mockReturnValue(of({ deleted: true }));
    service.saveSession(record).subscribe();
    const tempId = service.sessions().find(item => item.id?.startsWith('r_'))!.id!;
    const deleted = vi.fn();
    service.deleteSession(tempId).subscribe({ next: deleted });
    expect(api.delete).not.toHaveBeenCalled();
    upload.next({ session: { ...record, id: 'uploaded-id' } });
    upload.complete();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledWith('/running-sessions/uploaded-id');
    expect(deleted).toHaveBeenCalledOnce();
    expect(service.sessions()).toEqual([record]);
  });

  it('shares an offline resync and deletes it even when two loads overlap', () => {
    const pending = { ...record, id: 'r_offline' };
    localStorage.setItem('fittrack_cache_sessions:test', JSON.stringify([pending]));
    const upload = new Subject<{ session: typeof record }>();
    api.post.mockReturnValue(upload);
    api.get.mockReturnValue(of({ sessions: [] }));
    api.delete.mockReturnValue(of({ deleted: true }));
    service.getSessions().subscribe();
    service.getSessions().subscribe();
    service.deleteSession(pending.id).subscribe();
    upload.next({ session: { ...record, id: 'uploaded-id' } });
    upload.complete();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledWith('/running-sessions/uploaded-id');
    expect(service.sessions()).toEqual([]);
  });

  it('retains the offline session and reports a failed upload while deleting', () => {
    const upload = new Subject<{ session: typeof record }>();
    api.post.mockReturnValue(upload);
    service.saveSession(record).subscribe();
    const pending = service.sessions().find(item => item.id?.startsWith('r_'))!;
    const failure = vi.fn();
    service.deleteSession(pending.id!).subscribe({ error: failure });
    upload.error(new Error('Offline'));
    expect(failure).toHaveBeenCalledOnce();
    expect(api.delete).not.toHaveBeenCalled();
    expect(service.sessions()).toContainEqual(pending);
  });

  it('resolves stale temporary ids after upload and retains a failed server deletion', () => {
    const upload = new Subject<{ session: typeof record }>();
    api.post.mockReturnValue(upload);
    service.saveSession(record).subscribe();
    const tempId = service.sessions().find(item => item.id?.startsWith('r_'))!.id!;
    const saved = { ...record, id: 'uploaded-id' };
    upload.next({ session: saved });
    upload.complete();
    api.delete.mockReturnValue(throwError(() => new Error('Offline')));
    const failure = vi.fn();
    service.deleteSession(tempId).subscribe({ error: failure });
    expect(api.delete).toHaveBeenCalledWith('/running-sessions/uploaded-id');
    expect(failure).toHaveBeenCalledOnce();
    expect(service.sessions()).toContainEqual(saved);
  });
});

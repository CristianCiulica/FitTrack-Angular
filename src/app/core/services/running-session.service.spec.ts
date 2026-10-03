import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { RunningSessionService } from './running-session.service';

describe('Running session persistence', () => {
  const record = {
    id: 'server-id',
    mode: 'running' as const,
    startedAt: '2026-10-01T12:00:00Z',
    endedAt: '2026-10-01T12:10:00Z',
    durationSeconds: 600,
    distanceMeters: 1000,
    steps: 900,
    averageSpeedKmh: 6,
    calories: 60,
    route: [[44.4, 26.1]] as [number, number][],
    userId: 'test',
  };
  let service: RunningSessionService;
  let api: {
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    localStorage.clear();
    api = {
      get: vi.fn(() => of({ sessions: [record] })),
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
    const tempId = service.sessions().find((item) => item.id?.startsWith('r_'))!.id!;
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
    service.getSessions(true).subscribe();
    service.getSessions(true).subscribe();
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
    const pending = service.sessions().find((item) => item.id?.startsWith('r_'))!;
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
    const tempId = service.sessions().find((item) => item.id?.startsWith('r_'))!.id!;
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
  it('recovers an active run after a fresh service instance is created', () => {
    service.checkpointRun({
      ...record,
      startedAt: '2026-10-03T09:00:00Z',
      endedAt: '2026-10-03T09:10:00Z',
    });
    const fresh = TestBed.runInInjectionContext(() => new RunningSessionService());
    expect(fresh.recoverRun()?.session).toMatchObject({
      durationSeconds: 600,
      distanceMeters: 1000,
      route: record.route,
    });
    fresh.clearRunDraft();
    expect(service.recoverRun()).toBeNull();
  });

  it('does not expose another account’s run or accept corrupted checkpoints', () => {
    localStorage.setItem(
      'fittrack_active_run:test',
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        session: { ...record, userId: 'other' },
      }),
    );
    expect(service.recoverRun()).toBeNull();
    service.checkpointRun({ ...record, userId: 'other' });
    expect(service.recoverRun()).toBeNull();
    localStorage.setItem(
      'fittrack_active_run:test',
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        session: { ...record, route: [[1000, 26]] },
      }),
    );
    expect(service.recoverRun()).toBeNull();
    localStorage.setItem('fittrack_active_run:test', '{broken');
    expect(service.recoverRun()).toBeNull();
  });

  it('retains an interrupted run until a finished record is durably stored, even offline', () => {
    const run = { ...record, startedAt: '2026-10-03T09:00:00Z', endedAt: '2026-10-03T09:10:00Z' };
    service.checkpointRun(run);
    api.post.mockReturnValue(throwError(() => new Error('Offline')));
    service.saveSession(run, true).subscribe();
    expect(service.recoverRun()).toBeNull();
    expect(
      JSON.parse(localStorage.getItem('fittrack_cache_sessions:test')!).some(
        (item: typeof record) => item.startedAt === run.startedAt,
      ),
    ).toBe(true);
  });

  it('does not recover a draft already saved before the browser closed', () => {
    localStorage.setItem(
      'fittrack_active_run:test',
      JSON.stringify({ version: 1, updatedAt: Date.now(), session: record }),
    );
    expect(service.recoverRun()).toBeNull();
    expect(localStorage.getItem('fittrack_active_run:test')).toBeNull();
  });

  it('keeps the durable draft if both the finished cache write and upload fail', () => {
    const run = { ...record, startedAt: '2026-10-03T09:00:00Z', endedAt: '2026-10-03T09:10:00Z' };
    service.checkpointRun(run);
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key.startsWith('fittrack_cache_sessions:')) throw new Error('Quota exceeded');
      original.call(this, key, value);
    });
    api.post.mockReturnValue(throwError(() => new Error('Offline')));
    try {
      service.saveSession(run, true).subscribe();
      expect(localStorage.getItem('fittrack_active_run:test')).not.toBeNull();
      const fresh = TestBed.runInInjectionContext(() => new RunningSessionService());
      expect(fresh.recoverRun()?.session.durationSeconds).toBe(600);
    } finally {
      write.mockRestore();
    }
  });

  it('does not clear another account’s draft when an earlier upload finishes', () => {
    const run = { ...record, startedAt: '2026-10-03T09:00:00Z', endedAt: '2026-10-03T09:10:00Z' };
    const upload = new Subject<{ session: typeof record }>();
    api.post.mockReturnValue(upload);
    service.checkpointRun(run);
    service.saveSession(run, true).subscribe();
    (TestBed.inject(Auth) as unknown as { currentUser: { uid: string } }).currentUser = {
      uid: 'other',
    };
    service.checkpointRun({ ...run, userId: 'other' });
    upload.next({ session: { ...run, id: 'uploaded-id' } });
    upload.complete();
    expect(service.recoverRun()?.session.userId).toBe('other');
  });
});

describe('Lost running response reconciliation', () => {
  it('shows one run when GET already contains the unacknowledged POST', () => {
    localStorage.clear();
    const pending = {
      id: 'r_pending',
      clientId: 'r_stable',
      userId: 'test',
      mode: 'running',
      startedAt: '2026-10-04T12:00:00Z',
      endedAt: '2026-10-04T12:10:00Z',
      durationSeconds: 600,
      distanceMeters: 1000,
      steps: 900,
      averageSpeedKmh: 6,
      calories: 60,
      route: [],
    };
    localStorage.setItem('fittrack_cache_sessions:test', JSON.stringify([pending]));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiService,
          useValue: {
            get: () => of({ sessions: [{ ...pending, id: 'canonical' }] }),
            post: () => of({ session: { ...pending, id: 'canonical' } }),
          },
        },
        { provide: Auth, useValue: { currentUser: { uid: 'test' } } },
      ],
    });
    const service = TestBed.inject(RunningSessionService);
    service.getSessions(true).subscribe();
    expect(service.sessions()).toHaveLength(1);
    expect(service.sessions()[0].id).toBe('canonical');
  });
});

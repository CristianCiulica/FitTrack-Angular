import { vi } from 'vitest';
import { WorkoutWakeLockDirective } from './workout-wake-lock.directive';

describe('WorkoutWakeLockDirective', () => {
  const createLock = () => ({ released: false, release: vi.fn(async () => {}) });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('releases on hide, reacquires on return and releases when the workout closes', async () => {
    const first = createLock();
    const second = createLock();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    vi.stubGlobal('navigator', { wakeLock: { request } });
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const directive = new WorkoutWakeLockDirective();

    directive.ngOnInit();
    await Promise.resolve();
    expect(request).toHaveBeenCalledExactlyOnceWith('screen');

    visibility.mockReturnValue('hidden');
    await directive.syncWakeLock();
    expect(first.release).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(1);

    visibility.mockReturnValue('visible');
    await directive.syncWakeLock();
    expect(request).toHaveBeenCalledTimes(2);

    directive.ngOnDestroy();
    expect(second.release).toHaveBeenCalledOnce();
  });

  it('releases a lock granted after the workout closes', async () => {
    const lock = createLock();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn().mockResolvedValue(lock) } });
    const directive = new WorkoutWakeLockDirective();

    directive.ngOnInit();
    directive.ngOnDestroy();
    await Promise.resolve();

    expect(lock.release).toHaveBeenCalledOnce();
  });
});

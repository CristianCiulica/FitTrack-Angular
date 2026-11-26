import { Directive, HostListener, OnDestroy, OnInit } from '@angular/core';

@Directive({ selector: '[ftWorkoutWakeLock]' })
export class WorkoutWakeLockDirective implements OnInit, OnDestroy {
  private lock?: WakeLockSentinel;
  private requestVersion = 0;
  private destroyed = false;

  ngOnInit(): void {
    void this.syncWakeLock();
  }

  @HostListener('document:visibilitychange')
  async syncWakeLock(): Promise<void> {
    if (this.destroyed) return;
    if (document.visibilityState !== 'visible') {
      this.releaseWakeLock();
      return;
    }
    if (this.lock && !this.lock.released) return;

    const version = ++this.requestVersion;
    try {
      const lock = await navigator.wakeLock?.request('screen');
      if (!lock) return;
      if (version !== this.requestVersion) {
        await lock.release();
        return;
      }
      this.lock = lock;
    } catch {
      // The browser can deny a wake lock, for example in battery saver mode.
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.releaseWakeLock();
  }

  private releaseWakeLock(): void {
    this.requestVersion++;
    void this.lock?.release();
    this.lock = undefined;
  }
}

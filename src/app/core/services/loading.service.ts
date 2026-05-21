import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  readonly isLoading = signal(false);
  private pendingDurationMs: number | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  show() {
    this.clearTimer();
    this.isLoading.set(true);
  }

  hide() {
    this.clearTimer();
    this.isLoading.set(false);
  }

  showFor(durationMs: number) {
    this.show();
    this.hideTimer = setTimeout(() => this.hide(), durationMs);
  }

  showAfterNextNavigation(durationMs: number) {
    this.pendingDurationMs = durationMs;
  }

  consumePendingDuration(): number | null {
    const value = this.pendingDurationMs;
    this.pendingDurationMs = null;
    return value;
  }

  private clearTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}

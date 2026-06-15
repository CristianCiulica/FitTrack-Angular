import { Injectable, signal } from '@angular/core';
import { RunningSession } from '../models/running-session.model';

@Injectable({ providedIn: 'root' })
export class RunningSessionService {
  readonly trackingActive = signal(false);
  readonly sessions = signal<RunningSession[]>([]);
  private readonly storagePrefix = 'fittrack_running_sessions';

  setTrackingActive(active: boolean): void {
    this.trackingActive.set(active);
  }

  getSessions(userId: string): RunningSession[] {
    const sessions = this.loadSessions(userId);
    this.sessions.set(sessions);
    return sessions;
  }

  saveSession(session: Omit<RunningSession, 'id'>): RunningSession {
    const savedSession: RunningSession = {
      ...session,
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    const sessions = [savedSession, ...this.loadSessions(session.userId)];
    this.persistSessions(session.userId, sessions);
    return savedSession;
  }

  private getStorageKey(userId: string): string {
    return `${this.storagePrefix}:${userId}`;
  }

  private loadSessions(userId: string): RunningSession[] {
    if (!userId || typeof window === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(this.getStorageKey(userId));
    if (!raw) {
      return [];
    }

    try {
      return (JSON.parse(raw) as RunningSession[]).sort(
        (first, second) =>
          new Date(second.startedAt).getTime() - new Date(first.startedAt).getTime(),
      );
    } catch {
      return [];
    }
  }

  private persistSessions(userId: string, sessions: RunningSession[]): void {
    if (!userId || typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(this.getStorageKey(userId), JSON.stringify(sessions));
    this.sessions.set(sessions);
  }
}

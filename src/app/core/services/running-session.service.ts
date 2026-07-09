import { Injectable, signal, inject } from '@angular/core';
import { RunningSession } from '../models/running-session.model';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class RunningSessionService {
  readonly trackingActive = signal(false);
  readonly sessions = signal<RunningSession[]>([]);
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);

  private getStorageKey(): string {
    const uid = this.auth.currentUser?.uid || 'local';
    return `fittrack_running_sessions:${uid}`;
  }

  private loadLocal(): RunningSession[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocal(sessions: RunningSession[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.getStorageKey(), JSON.stringify(sessions));
    this.sessions.set(sessions);
  }

  setTrackingActive(active: boolean): void {
    this.trackingActive.set(active);
  }

  getSessions(): Observable<RunningSession[]> {
    return this.api.get<{ sessions: RunningSession[] }>('/running-sessions').pipe(
      map((res) => res.sessions),
      tap((sessions) => this.saveLocal(sessions)),
      catchError((err) => {
        console.warn('API get running sessions failed, using local storage', err);
        const local = this.loadLocal();
        this.sessions.set(local);
        return of(local);
      })
    );
  }

  saveSession(session: Omit<RunningSession, 'id'>): Observable<RunningSession> {
    const tempId = 'r_' + Date.now();
    const newSession = { ...session, id: tempId } as RunningSession;
    
    const current = this.loadLocal();
    this.saveLocal([newSession, ...current]);

    return this.api.post<{ session: RunningSession }>('/running-sessions', session).pipe(
      map((res) => res.session),
      tap((saved) => {
        const updated = this.loadLocal().map(s => s.id === tempId ? saved : s);
        this.saveLocal(updated);
      }),
      catchError((err) => {
        console.warn('API save running session failed, using local storage', err);
        return of(newSession);
      })
    );
  }
}

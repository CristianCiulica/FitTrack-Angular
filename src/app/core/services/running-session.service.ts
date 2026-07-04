import { Injectable, signal, inject } from '@angular/core';
import { RunningSession } from '../models/running-session.model';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class RunningSessionService {
  readonly trackingActive = signal(false);
  readonly sessions = signal<RunningSession[]>([]);
  private readonly api = inject(ApiService);

  setTrackingActive(active: boolean): void {
    this.trackingActive.set(active);
  }

  getSessions(): Observable<RunningSession[]> {
    return this.api.get<{ sessions: RunningSession[] }>('/running-sessions').pipe(
      map((res) => res.sessions),
      tap((sessions) => this.sessions.set(sessions)),
    );
  }

  saveSession(session: Omit<RunningSession, 'id'>): Observable<RunningSession> {
    return this.api.post<{ session: RunningSession }>('/running-sessions', session).pipe(
      map((res) => res.session),
      tap((saved) => this.sessions.update((current) => [saved, ...current])),
    );
  }
}

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
    // IMPORTANT: prefix diferit de `fittrack_running_sessions:` — acela e citit de
    // MigrationService ca "date vechi de migrat"; cache-ul nu trebuie sa ajunga acolo.
    return `fittrack_cache_sessions:${uid}`;
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

  // sesiunile salvate offline primesc id temporar pana ajung pe server
  private isTempId(id?: string): boolean {
    return !!id && id.startsWith('r_');
  }

  getSessions(): Observable<RunningSession[]> {
    return this.api.get<{ sessions: RunningSession[] }>('/running-sessions').pipe(
      map((res) => res.sessions),
      map((serverSessions) => {
        // nu pierdem sesiunile salvate offline: le pastram si le re-trimitem
        const pending = this.loadLocal().filter((s) => this.isTempId(s.id));
        const merged = [...pending, ...serverSessions];
        this.saveLocal(merged);
        this.resyncPending(pending);
        return merged;
      }),
      catchError((err) => {
        console.warn('API get running sessions failed, using local storage', err);
        const local = this.loadLocal();
        this.sessions.set(local);
        return of(local);
      })
    );
  }

  private resyncPending(pending: RunningSession[]): void {
    for (const session of pending) {
      this.api.post<{ session: RunningSession }>('/running-sessions', session).subscribe({
        next: ({ session: saved }) => {
          const updated = this.loadLocal().map((s) => (s.id === session.id ? saved : s));
          this.saveLocal(updated);
        },
        error: (err) => console.warn('[running] resync failed, will retry next load', err),
      });
    }
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

  deleteSession(id: string): Observable<void> {
    const updated = this.loadLocal().filter((s) => s.id !== id);
    this.saveLocal(updated);

    if (this.isTempId(id)) {
      return of(undefined);
    }

    return this.api.delete<{ deleted: boolean }>(`/running-sessions/${id}`).pipe(
      map(() => undefined),
      catchError((err) => {
        console.warn('API delete running session failed, removed locally', err);
        return of(undefined);
      })
    );
  }
}

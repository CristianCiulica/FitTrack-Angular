import { Injectable, signal, inject } from '@angular/core';
import { RunningSession } from '../models/running-session.model';
import { Observable, of } from 'rxjs';
import { map, tap, catchError, finalize, shareReplay, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { routeForStorage } from '../utils/route';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class RunningSessionService {
  readonly trackingActive = signal(false);
  readonly sessions = signal<RunningSession[]>([]);
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);
  private readonly uploads = new Map<string, Observable<RunningSession>>();
  private readonly uploadedIds = new Map<string, string>();

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
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveLocal(sessions: RunningSession[]): void {
    this.sessions.set(sessions);
    if (typeof window === 'undefined') return;
    // A full/blocked browser cache must not prevent uploading a recorded route.
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(sessions));
    } catch (error) {
      console.warn('[running] browser cache unavailable', error);
    }
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
    for (const item of pending) {
      if (item.id && this.uploads.has(item.id)) continue;
      this.upload(item).subscribe({
        error: (err) => console.warn('[sessions] resync failed, will retry next load', err),
      });
    }
  }

  private upload(item: RunningSession): Observable<RunningSession> {
    const tempId = item.id!;
    const existing = this.uploads.get(tempId);
    if (existing) return existing;
    const upload = this.api.post<{ session: RunningSession }>('/running-sessions', { ...item, route: routeForStorage(item.route) }).pipe(
      map(response => response.session),
      tap(saved => {
        if (saved.id) this.uploadedIds.set(tempId, saved.id);
        this.saveLocal(this.loadLocal().map(record => record.id === tempId ? saved : record));
      }),
      finalize(() => this.uploads.delete(tempId)),
      // A delete waits for the same POST instead of starting another upload.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.uploads.set(tempId, upload);
    return upload;
  }

  saveSession(session: Omit<RunningSession, 'id'>): Observable<RunningSession> {
    session = { ...session, route: routeForStorage(session.route) };
    const tempId = 'r_' + crypto.randomUUID();
    const newSession = { ...session, id: tempId } as RunningSession;
    
    const current = this.loadLocal();
    this.saveLocal([newSession, ...current]);

    return this.upload(newSession).pipe(
      catchError((err) => {
        console.warn('API save running session failed, using local storage', err);
        return of(newSession);
      })
    );
  }

  deleteSession(id: string): Observable<void> {
    const upload = this.uploads.get(id);
    if (upload) {
      // An offline item may already be uploading when its Delete button is
      // pressed. Wait for its server id, then delete that record as well.
      return upload.pipe(switchMap(saved => this.deleteSession(saved.id!)));
    }
    id = this.uploadedIds.get(id) ?? id;
    const removeLocal = () => this.saveLocal(this.loadLocal().filter(item => item.id !== id));
    if (this.isTempId(id)) {
      removeLocal();
      return of(void 0);
    }
    // A failed server deletion leaves the saved record available for retry.
    return this.api.delete<{ deleted: boolean }>(`/running-sessions/${id}`).pipe(
      tap(removeLocal),
      map(() => void 0),
    );
  }
}

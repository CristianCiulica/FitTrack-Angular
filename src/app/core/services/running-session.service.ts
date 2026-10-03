import { Injectable, signal, inject } from '@angular/core';
import { RunningSession } from '../models/running-session.model';
import { Observable, of } from 'rxjs';
import { ReadCache } from '../utils/read-cache';
import { map, tap, catchError, finalize, shareReplay, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { routeForStorage } from '../utils/route';
import { Auth } from '@angular/fire/auth';

export interface ActiveRunDraft {
  version: 1;
  updatedAt: number;
  session: Omit<RunningSession, 'id'>;
}

@Injectable({ providedIn: 'root' })
export class RunningSessionService {
  readonly trackingActive = signal(false);
  readonly sessions = signal<RunningSession[]>([]);
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);
  private readonly uploads = new Map<string, Observable<RunningSession>>();
  private readonly uploadedIds = new Map<string, string>();

  private readonly volatileOwners = new Set<string>();
  private readonly memory = new Map<string, RunningSession[]>();
  private readonly reads = new ReadCache<RunningSession[]>();
  private readonly erasedOwners = new Set<string>();
  eraseCache(uid: string): void {
    this.erasedOwners.add(uid);
    this.memory.delete(uid);
    this.volatileOwners.delete(uid);
    this.clearRunDraft(uid);
    this.reads.replace(uid, []);
    if (uid === this.owner()) this.sessions.set([]);
  }

  private owner(): string {
    return this.auth.currentUser?.uid || 'local';
  }

  private getStorageKey(uid = this.owner()): string {
    // IMPORTANT: prefix diferit de `fittrack_running_sessions:` — acela e citit de
    // MigrationService ca "date vechi de migrat"; cache-ul nu trebuie sa ajunga acolo.
    return `fittrack_cache_sessions:${uid}`;
  }

  private loadLocal(uid = this.owner()): RunningSession[] {
    if (this.erasedOwners.has(uid)) return [];
    if (this.volatileOwners.has(uid)) return this.memory.get(uid) ?? [];
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(uid));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.memory.get(uid) ?? [];
    }
  }

  private saveLocal(sessions: RunningSession[], uid = this.owner(), changed = true): void {
    if (this.erasedOwners.has(uid)) return;
    if (uid === this.owner()) this.sessions.set(sessions);
    this.memory.set(uid, sessions);
    if (changed) this.reads.replace(uid, sessions);
    if (typeof window === 'undefined') return;
    // A full/blocked browser cache must not prevent uploading a recorded route.
    try {
      localStorage.setItem(this.getStorageKey(uid), JSON.stringify(sessions));
      this.volatileOwners.delete(uid);
    } catch (error) {
      this.volatileOwners.add(uid);
      console.warn('[running] browser cache unavailable', error);
    }
  }

  private volatileDraftOwners = new Set<string>();
  private draftMemory = new Map<string, ActiveRunDraft>();

  checkpointRun(session: Omit<RunningSession, 'id'>): void {
    const uid = this.owner();
    if (session.userId !== uid || this.erasedOwners.has(uid)) return;
    const draft: ActiveRunDraft = {
      version: 1,
      updatedAt: Date.now(),
      session: { ...session, route: routeForStorage(session.route) },
    };
    this.draftMemory.set(uid, draft);
    try {
      localStorage.setItem(`fittrack_active_run:${uid}`, JSON.stringify(draft));
      this.volatileDraftOwners.delete(uid);
    } catch {
      this.volatileDraftOwners.add(uid);
    }
  }

  recoverRun(): ActiveRunDraft | null {
    const uid = this.owner();
    if (this.volatileDraftOwners.has(uid)) return this.draftMemory.get(uid) ?? null;
    try {
      const raw = localStorage.getItem(`fittrack_active_run:${uid}`);
      if (!raw) {
        this.draftMemory.delete(uid);
        return null;
      }
      const draft = JSON.parse(raw) as ActiveRunDraft;
      const session = draft?.session;
      if (
        draft.version !== 1 ||
        session?.userId !== uid ||
        session.mode !== 'running' ||
        !Number.isFinite(draft.updatedAt) ||
        !Number.isFinite(Date.parse(session.startedAt)) ||
        !Number.isFinite(session.durationSeconds) ||
        session.durationSeconds < 0 ||
        !Number.isFinite(session.distanceMeters) ||
        session.distanceMeters < 0 ||
        !Number.isFinite(Date.parse(session.endedAt)) ||
        ![session.steps, session.averageSpeedKmh, session.calories].every(
          (value) => Number.isFinite(value) && value >= 0,
        ) ||
        !Array.isArray(session.route) ||
        !session.route.every(
          (point) =>
            Array.isArray(point) &&
            point.length === 2 &&
            Number.isFinite(point[0]) &&
            Math.abs(point[0]) <= 90 &&
            Number.isFinite(point[1]) &&
            Math.abs(point[1]) <= 180,
        )
      )
        return null;
      if (
        !this.volatileOwners.has(uid) &&
        this.loadLocal(uid).some(
          (record) =>
            record.startedAt === session.startedAt &&
            Date.parse(record.endedAt) >= Date.parse(session.endedAt),
        )
      ) {
        this.clearRunDraft();
        return null;
      }
      return draft;
    } catch {
      return this.draftMemory.get(uid) ?? null;
    }
  }

  clearRunDraft(uid = this.owner()): void {
    this.draftMemory.delete(uid);
    try {
      localStorage.removeItem(`fittrack_active_run:${uid}`);
      this.volatileDraftOwners.delete(uid);
    } catch {
      this.volatileDraftOwners.add(uid);
    }
  }

  setTrackingActive(active: boolean): void {
    this.trackingActive.set(active);
  }
  hasSavedRun(session: Omit<RunningSession, 'id'>): boolean {
    return this.loadLocal().some(
      (saved) =>
        this.isDurablySaved(saved) &&
        ((session.clientId && saved.clientId === session.clientId) ||
          saved.startedAt === session.startedAt) &&
        Date.parse(saved.endedAt) >= Date.parse(session.endedAt),
    );
  }
  isDurablySaved(session: RunningSession): boolean {
    return !this.isTempId(session.id) || !this.volatileOwners.has(this.owner());
  }

  // sesiunile salvate offline primesc id temporar pana ajung pe server
  private isTempId(id?: string): boolean {
    return !!id && id.startsWith('r_');
  }

  getSessions(force = false): Observable<RunningSession[]> {
    const uid = this.owner();
    return this.reads
      .read(
        uid,
        () => this.loadLocal(uid),
        () =>
          this.api.get<{ sessions: RunningSession[] }>('/running-sessions').pipe(
            map((res) => {
              const pending = this.loadLocal(uid).filter((item) => this.isTempId(item.id));
              return [
                ...pending,
                ...res.sessions.filter(
                  (item) =>
                    !pending.some(
                      (local) =>
                        local.id === item.id ||
                        (local.clientId && local.clientId === item.clientId),
                    ),
                ),
              ];
            }),
            catchError(() => of(this.loadLocal(uid))),
          ),
        (value) => {
          if (uid !== this.owner()) return;
          this.saveLocal(value, uid, false);
          this.resyncPending(value.filter((item) => this.isTempId(item.id)));
        },
        force,
      )
      .pipe(
        tap((value) => {
          if (uid === this.owner()) {
            this.sessions.set(value);
          }
        }),
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
    const uid = this.owner();
    const tempId = item.id!;
    const existing = this.uploads.get(tempId);
    if (existing) return existing;
    const upload = this.api
      .post<{
        session: RunningSession;
      }>('/running-sessions', {
        ...item,
        clientId: item.clientId ?? item.id,
        route: routeForStorage(item.route),
      })
      .pipe(
        map((response) => response.session),
        tap((saved) => {
          if (saved.id) this.uploadedIds.set(tempId, saved.id);
          this.saveLocal(
            this.loadLocal(uid)
              .filter(
                (record) =>
                  record.id === tempId ||
                  (record.id !== saved.id &&
                    !(saved.clientId && record.clientId === saved.clientId)),
              )
              .map((record) => (record.id === tempId ? saved : record)),
            uid,
          );
        }),
        finalize(() => this.uploads.delete(tempId)),
        // A delete waits for the same POST instead of starting another upload.
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.uploads.set(tempId, upload);
    return upload;
  }

  saveSession(
    session: Omit<RunningSession, 'id'>,
    finishActiveRun = false,
  ): Observable<RunningSession> {
    const uid = this.owner();
    const existing =
      session.clientId && this.loadLocal(uid).find((item) => item.clientId === session.clientId);
    if (existing) {
      if (finishActiveRun && !this.volatileOwners.has(uid)) this.clearRunDraft(uid);
      return this.isTempId(existing.id)
        ? this.upload(existing).pipe(catchError(() => of(existing)))
        : of(existing);
    }
    session = { ...session, route: routeForStorage(session.route) };
    const tempId = 'r_' + crypto.randomUUID();
    const newSession = {
      ...session,
      id: tempId,
      clientId: session.clientId ?? tempId,
    } as RunningSession;

    const current = this.loadLocal();
    this.saveLocal([newSession, ...current]);
    if (finishActiveRun && !this.volatileOwners.has(uid)) this.clearRunDraft(uid);

    return this.upload(newSession).pipe(
      tap(() => {
        if (finishActiveRun) this.clearRunDraft(uid);
      }),
      catchError((err) => {
        console.warn('API save running session failed, using local storage', err);
        return of(newSession);
      }),
    );
  }

  deleteSession(id: string): Observable<void> {
    const upload = this.uploads.get(id);
    if (upload) {
      // An offline item may already be uploading when its Delete button is
      // pressed. Wait for its server id, then delete that record as well.
      return upload.pipe(switchMap((saved) => this.deleteSession(saved.id!)));
    }
    id = this.uploadedIds.get(id) ?? id;
    const uid = this.owner();
    const removeLocal = () =>
      this.saveLocal(
        this.loadLocal(uid).filter((item) => item.id !== id),
        uid,
      );
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

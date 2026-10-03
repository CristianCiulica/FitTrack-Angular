import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { catchError, EMPTY, Observable, switchMap } from 'rxjs';

/** Prepare the main tabs after input/painting, without using a metered connection. */
@Injectable({ providedIn: 'root' })
export class IdlePreloadingService implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!['dashboard', 'workouts', 'start-workout', 'bmi', 'running', 'weight', 'account', 'settings'].includes(route.path ?? '')
      || connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')) return EMPTY;
    return new Observable<void>(subscriber => {
      const ready = () => { subscriber.next(); subscriber.complete(); };
      if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(ready, { timeout: 2500 });
        return () => window.cancelIdleCallback(id);
      }
      const id = setTimeout(ready, 800);
      return () => clearTimeout(id);
    }).pipe(switchMap(load), catchError(() => EMPTY));
  }
}

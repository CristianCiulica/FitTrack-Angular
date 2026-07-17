import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, retry, timer } from 'rxjs';
import { getApiBaseUrl } from '../config/runtime-config';

// backend-ul de pe Render (plan gratuit) adoarme dupa ~15 min si porneste in
// 20-50s; reincercam GET-urile (idempotente) cu pauze crescatoare ca prima
// vizita de dimineata sa nu pice cu totul
const RETRY_DELAYS_MS = [2000, 5000, 12000, 20000];

function isTransient(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  // status 0 = timeout/retea; 5xx si 502-504 apar cat timp serviciul se trezeste
  return error.status === 0 || error.status >= 500;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = getApiBaseUrl();

  get<T>(path: string, options?: any): Observable<T> {
    return (this.http.get(this.url(path), options) as Observable<T>).pipe(
      retry({
        count: RETRY_DELAYS_MS.length,
        delay: (error, retryCount) => {
          if (!isTransient(error)) throw error;
          return timer(RETRY_DELAYS_MS[retryCount - 1]);
        },
      }),
    );
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.url(path), body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.url(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  url(path: string): string {
    const trimmed = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${trimmed}`;
  }

  isApiUrl(url: string): boolean {
    return url.startsWith(this.baseUrl);
  }
}

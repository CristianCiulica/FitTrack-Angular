import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiBaseUrl } from '../config/runtime-config';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = getApiBaseUrl();

  get<T>(path: string, options?: any): Observable<T> {
    return this.http.get(this.url(path), options) as Observable<T>;
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

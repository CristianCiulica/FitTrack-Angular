import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'fittrack_theme';

function preference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function isLoginScreen(url: string): boolean {
  return /^\/(?:auth(?:\/login)?)?\/?$/.test(url.split(/[?#]/)[0]);
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly router = inject(Router, { optional: true });
  private loginScreen = !!this.router && isLoginScreen(this.window?.location.pathname ?? '');
  private readonly media = this.window?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly selected = signal<ThemePreference>(this.readPreference());
  private readonly resolved = signal<'light' | 'dark'>('light');

  readonly preference = this.selected.asReadonly();
  readonly theme = this.resolved.asReadonly();

  constructor() {
    this.apply();
    this.router?.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.loginScreen = isLoginScreen(event.urlAfterRedirects);
        this.apply();
      }
    });
    const systemChanged = () => {
      if (this.selected() === 'system') this.apply();
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      this.selected.set(this.readPreference());
      this.apply();
    };
    this.media?.addEventListener('change', systemChanged);
    this.window?.addEventListener('storage', storageChanged);
    inject(DestroyRef).onDestroy(() => {
      this.media?.removeEventListener('change', systemChanged);
      this.window?.removeEventListener('storage', storageChanged);
    });
  }

  setPreference(value: ThemePreference): void {
    this.selected.set(value);
    try {
      this.window?.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Appearance still works for this session when browser storage is unavailable.
    }
    this.apply();
  }

  private readPreference(): ThemePreference {
    try {
      return preference(this.window?.localStorage.getItem(THEME_STORAGE_KEY) ?? null);
    } catch {
      return 'system';
    }
  }

  private apply(): void {
    const choice = this.selected();
    const theme = this.loginScreen ? 'light'
      : choice === 'system' ? (this.media?.matches ? 'dark' : 'light') : choice;
    this.resolved.set(theme);
    this.document.documentElement.dataset['theme'] = theme;
    this.document.documentElement.style.colorScheme = theme;
    this.document.documentElement.style.backgroundColor = theme === 'dark' ? '#0b0c0f' : '#ffffff';
    this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0c0f' : '#ffffff');
  }
}

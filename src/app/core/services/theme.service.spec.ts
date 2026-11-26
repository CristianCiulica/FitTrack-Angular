import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('Theme preference', () => {
  const originalUrl = window.location.href;
  let systemDark: boolean;
  let changed: (() => void) | undefined;
  const remove = vi.fn();
  beforeEach(() => {
    window.history.replaceState({}, '', '/dashboard');
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem('fittrack_effects');
    systemDark = false;
    changed = undefined;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return systemDark; },
      addEventListener: (_event: string, listener: () => void) => { changed = listener; },
      removeEventListener: remove,
    })));
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem('fittrack_effects');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-effects');
    document.documentElement.style.removeProperty('color-scheme');
    document.documentElement.style.removeProperty('background-color');
    window.history.replaceState({}, '', originalUrl);
  });
  it('restores a persisted preference and applies the native color scheme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('dark');
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
  it('follows live system changes only in Auto and applies Auto immediately', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
    systemDark = true;
    changed?.();
    expect(service.theme()).toBe('dark');
    service.setPreference('light');
    changed?.();
    expect(service.theme()).toBe('light');
    service.setPreference('system');
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });
  it('continues working when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    const service = TestBed.inject(ThemeService);
    expect(() => service.setPreference('dark')).not.toThrow();
    expect(service.theme()).toBe('dark');
  });
  it('restores the rendering preference and keeps it independent of the colour theme', () => {
    localStorage.setItem('fittrack_effects', 'blur');
    const service = TestBed.inject(ThemeService);
    service.setPreference('dark');
    expect(document.documentElement.dataset['effects']).toBe('blur');
    service.setEffectStyle('glass');
    expect(localStorage.getItem('fittrack_effects')).toBe('glass');
    localStorage.setItem('fittrack_effects', 'blur');
    window.dispatchEvent(new StorageEvent('storage', { key: 'fittrack_effects' }));
    expect(service.effectStyle()).toBe('blur');
    expect(service.theme()).toBe('dark');
  });
  it('respects the saved theme on a direct visit to login', () => {
    window.history.replaceState({}, '', '/auth/login');
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });
  it('synchronizes other tabs and falls back to Auto for an invalid stored value', () => {
    const service = TestBed.inject(ThemeService);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    expect(service.theme()).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    expect(service.preference()).toBe('system');
    expect(service.theme()).toBe('light');
  });
});

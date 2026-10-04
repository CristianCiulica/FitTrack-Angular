import { vi, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationError, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { App } from './app';
import { ProfileService } from './core/services/profile.service';
import { LoadingService } from './core/services/loading.service';

describe('App shell', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ProfileService, useValue: { loaded: signal(false), profile: signal(null), isOnboarded: signal(false) } },
      ],
    }).compileComponents();
  });

  it('keeps one lens definition outside route transitions', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('#ft-dock-lens').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.route-shell #ft-dock-lens')).toBeNull();
  });

  it('only blocks content while loading', () => {
    const fixture = TestBed.createComponent(App);
    const loading = TestBed.inject(LoadingService);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
    loading.show();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-overlay')).not.toBeNull();
    loading.hide();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
  });

  it('dismisses the startup screen only after navigation completes', () => {
    const events = new Subject<NavigationEnd>();
    vi.spyOn(TestBed.inject(Router), 'events', 'get').mockReturnValue(events);
    const dispatch = vi.spyOn(document, 'dispatchEvent');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(dispatch.mock.calls.some(([event]) => event.type === 'fittrack:ready')).toBe(false);
    events.next(new NavigationEnd(1, '/dashboard', '/dashboard'));
    expect(dispatch.mock.calls.some(([event]) => event.type === 'fittrack:ready')).toBe(true);
    fixture.destroy();
  });

  it('offers startup recovery when the initial route fails to load', () => {
    const events = new Subject<NavigationError>();
    vi.spyOn(TestBed.inject(Router), 'events', 'get').mockReturnValue(events);
    const dispatch = vi.spyOn(document, 'dispatchEvent');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    events.next(new NavigationError(1, '/dashboard', new Error('Chunk unavailable')));
    expect(dispatch.mock.calls.some(([event]) => event.type === 'fittrack:startup-error')).toBe(true);
    expect(dispatch.mock.calls.some(([event]) => event.type === 'fittrack:ready')).toBe(false);
    fixture.destroy();
  });
});

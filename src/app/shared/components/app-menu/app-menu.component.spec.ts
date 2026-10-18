import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { NzIconService, provideNzIcons } from 'ng-zorro-antd/icon';
import {
  CloseOutline,
  LineChartOutline,
  SettingOutline,
  UserOutline,
} from '@ant-design/icons-angular/icons';
import { AppMenuComponent } from './app-menu.component';
import { ProfileService } from '../../../core/services/profile.service';
import { AuthService } from '../../../core/services/auth.service';

describe('Mobile navigation lifecycle', () => {
  let events: Subject<NavigationStart>;
  let desktop = false;
  beforeEach(() => {
    desktop = false;
    events = new Subject();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width: 901px') && desktop,
      addEventListener() {},
      removeEventListener() {},
    }));
    TestBed.configureTestingModule({
      imports: [AppMenuComponent],
      providers: [
        provideNoopAnimations(),
        provideNzIcons([CloseOutline, LineChartOutline, SettingOutline, UserOutline]),
        { provide: Router, useValue: { events, url: '/progress', navigate: vi.fn() } },
        {
          provide: ProfileService,
          useValue: {
            profile: signal({ email: 'test@example.com' }),
            displayName: signal('Test'),
            avatar: signal(''),
          },
        },
        { provide: AuthService, useValue: { logout: () => of(null) } },
      ],
    });
    const icons = TestBed.inject(NzIconService);
    for (const name of ['home', 'history', 'workout', 'run', 'nutrition'])
      icons.addIconLiteral(
        'ft:' + name,
        '<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>',
      );
  });
  afterEach(() => vi.unstubAllGlobals());
  it('creates no drawer at startup and returns to closed state after recreation', () => {
    const first = TestBed.createComponent(AppMenuComponent);
    first.detectChanges();
    expect(first.nativeElement.querySelector('nz-drawer')).toBeNull();
    expect(first.nativeElement.querySelector('.hamburger').getAttribute('aria-expanded')).toBe(
      'false',
    );
    first.nativeElement.querySelector('.hamburger').click();
    first.detectChanges();
    expect(document.querySelector('.ant-drawer-open')).not.toBeNull();
    expect(document.querySelectorAll('#mobile-navigation .menu-link')).toHaveLength(9);
    first.destroy();
    const refreshed = TestBed.createComponent(AppMenuComponent);
    refreshed.detectChanges();
    expect(refreshed.nativeElement.querySelector('nz-drawer')).toBeNull();
    expect(document.querySelector('.ant-drawer-open')).toBeNull();
    refreshed.destroy();
  });
  it('closes on navigation, desktop resizing and restoration from browser history', () => {
    const fixture = TestBed.createComponent(AppMenuComponent);
    fixture.detectChanges();
    const menu = fixture.componentInstance;
    menu.toggle();
    events.next(new NavigationStart(1, '/account'));
    expect(menu.open()).toBe(false);
    menu.toggle();
    desktop = true;
    menu.onResize();
    expect(menu.open()).toBe(false);
    desktop = false;
    menu.toggle();
    menu.onPageShow({ persisted: true } as PageTransitionEvent);
    expect(menu.open()).toBe(false);
    fixture.destroy();
  });
  it('includes every primary destination when the persistent sidebar is hidden', () => {
    const fixture = TestBed.createComponent(AppMenuComponent);
    fixture.detectChanges();
    const paths = fixture.componentInstance.links.map((link) => link.path);
    expect(paths).toEqual([
      '/dashboard',
      '/workouts',
      '/start-workout',
      '/running',
      '/bmi',
      '/progress',
      '/weight',
      '/account',
      '/settings',
    ]);
    expect(fixture.componentInstance.isCurrent('/progress')).toBe(true);
    fixture.destroy();
  });
});

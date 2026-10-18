import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationStart, Router } from '@angular/router';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

interface MenuLink {
  label: string;
  description: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, NzDrawerModule, NzIconModule],
  templateUrl: './app-menu.component.html',
  styleUrls: ['./app-menu.component.scss'],
})
export class AppMenuComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  readonly open = signal(false);
  readonly menuCreated = signal(false);

  readonly profile = this.profileService.profile;
  readonly displayName = this.profileService.displayName;
  readonly avatar = this.profileService.avatar;
  readonly initials = computed(() => {
    const name = this.profileService.displayName() || this.profile()?.email || '';
    const parts = name
      .trim()
      .split(/[\s@.]+/)
      .filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  });

  readonly links: MenuLink[] = [
    { label: 'Home', description: 'Your daily activity', icon: 'ft:home', path: '/dashboard' },
    {
      label: 'History',
      description: 'Your completed workouts',
      icon: 'ft:history',
      path: '/workouts',
    },
    {
      label: 'Workout',
      description: 'Start your next session',
      icon: 'ft:workout',
      path: '/start-workout',
    },
    { label: 'Run', description: 'Running & walking', icon: 'ft:run', path: '/running' },
    {
      label: 'Nutrition',
      description: 'Your nutrition targets',
      icon: 'ft:nutrition',
      path: '/bmi',
    },
    {
      label: 'Progress',
      description: 'Your training, month by month',
      icon: 'line-chart',
      path: '/progress',
    },
    {
      label: 'Weight',
      description: 'Daily weigh-ins & your progress',
      icon: 'line-chart',
      path: '/weight',
    },
    {
      label: 'Profile',
      description: 'Your details & body metrics',
      icon: 'user',
      path: '/account',
    },
    {
      label: 'Settings',
      description: 'Appearance, units & goals',
      icon: 'setting',
      path: '/settings',
    },
  ];

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((event) => {
      if (event instanceof NavigationStart) this.close();
    });
  }

  @HostListener('window:resize') onResize(): void {
    if (window.matchMedia('(min-width: 901px)').matches) this.close();
  }

  @HostListener('window:pageshow', ['$event']) onPageShow(event: PageTransitionEvent): void {
    if (event.persisted) this.close();
  }

  isCurrent(path: string): boolean {
    return this.router.url.split(/[?#]/)[0] === path;
  }

  toggle(): void {
    this.menuCreated.set(true);
    this.open.set(!this.open());
  }

  close(): void {
    this.open.set(false);
  }

  go(path: string): void {
    this.close();
    this.router.navigate([path]);
  }

  logout(): void {
    this.close();
    this.auth.logout().subscribe();
  }
}

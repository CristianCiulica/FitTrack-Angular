import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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

  readonly profile = this.profileService.profile;
  readonly displayName = this.profileService.displayName;
  readonly avatar = this.profileService.avatar;
  readonly initials = computed(() => {
    const name = this.profileService.displayName() || this.profile()?.email || '';
    const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  });

  readonly links: MenuLink[] = [
    { label: 'Account', description: 'Your details & body metrics', icon: 'user', path: '/account' },
    { label: 'Settings', description: 'Units, reminders & more', icon: 'setting', path: '/settings' },
  ];

  toggle(): void {
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

import { ThemeService } from './core/services/theme.service';
import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { NzIconService } from 'ng-zorro-antd/icon';
import { LoadingService } from './core/services/loading.service';
import { ProfileService } from './core/services/profile.service';
import { LiquidGlassComponent } from './shared/components/liquid-glass/liquid-glass.component';

import { FT_ICONS } from './shared/glisse/icons';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LiquidGlassComponent],
  template: `
    <button type="button" class="skip-link" (click)="focusContent()">Skip to content</button>
    <app-liquid-glass />
    <div class="route-shell">
      <router-outlet />
      <div class="loading-overlay" *ngIf="loadingService.isLoading()">
        <div class="loading-card">
          <div class="spinner" aria-hidden="true"></div>
          <div class="loading-text">Loading...</div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./app.css'],
})
export class App implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly profileService = inject(ProfileService);

  constructor(
    private router: Router,
    public loadingService: LoadingService,
    iconService: NzIconService,
  ) {
    for (const [name, svg] of Object.entries(FT_ICONS)) {
      iconService.addIconLiteral(name, svg);
    }

    // plasa de siguranta pentru onboarding: daca API-ul e lent la prima incarcare
    // (ex. serverul de pe Render se trezeste), guard-ul lasa userul sa treaca; cand
    // profilul soseste totusi si nu e complet, il ducem la onboarding
    effect(() => {
      const loaded = this.profileService.loaded();
      const profile = this.profileService.profile();
      const onboarded = this.profileService.isOnboarded();
      if (!loaded || !profile || onboarded) return;
      const url = this.router.url;
      if (url.startsWith('/onboarding') || url.startsWith('/auth')) return;
      this.router.navigate(['/onboarding']);
    });
  }

  focusContent(preventScroll = false): void {
    const content = Array.from(document.querySelectorAll<HTMLElement>('.route-shell :is(main, [role="main"])')).find(landmark => !landmark.closest('[inert]'));
    const target = content?.querySelector<HTMLElement>('h1') ?? content;
    if (target) {
      target.tabIndex = -1;
      target.focus({ preventScroll });
    }
  }

  ngOnInit(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Keep the static startup screen until a route has actually rendered.
        document.dispatchEvent(new Event('fittrack:ready'));
        if (event.id > 1) requestAnimationFrame(() => this.focusContent(true));
        const pendingDuration = this.loadingService.consumePendingDuration();
        if (pendingDuration) {
          this.loadingService.showFor(pendingDuration);
        } else {
          this.loadingService.hide();
        }
      }
      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.loadingService.hide();
        if (event instanceof NavigationError) {
          document.dispatchEvent(new Event('fittrack:startup-error'));
        }
      }
    });
  }

}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { trigger, transition, style, animate, query, group } from '@angular/animations';
import { NzIconService } from 'ng-zorro-antd/icon';
import { LoadingService } from './core/services/loading.service';

// iconite custom, stil SF Symbols, pentru navigarea principala.
// fill="none" trebuie pus pe fiecare forma: ng-zorro suprascrie fill-ul de pe radacina svg.
const FT_ICON_ATTRS = 'viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const FT_SHAPE = 'fill="none"';
const FT_ICONS: Record<string, string> = {
  'ft:home': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M3.5 10.6 12 3.6l8.5 7"/><path ${FT_SHAPE} d="M5.5 9.4V19a1.6 1.6 0 0 0 1.6 1.6h9.8A1.6 1.6 0 0 0 18.5 19V9.4"/><path ${FT_SHAPE} d="M9.7 20.6v-4.8a2.3 2.3 0 0 1 4.6 0v4.8"/></svg>`,
  'ft:history': `<svg ${FT_ICON_ATTRS}><circle ${FT_SHAPE} cx="12" cy="12" r="8.3"/><path ${FT_SHAPE} d="M12 7.6V12l3.1 1.8"/></svg>`,
  'ft:workout': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M2.8 10.6v2.8"/><path ${FT_SHAPE} d="M6 8.2v7.6"/><path ${FT_SHAPE} d="M18 8.2v7.6"/><path ${FT_SHAPE} d="M21.2 10.6v2.8"/><path ${FT_SHAPE} d="M6 12h12"/></svg>`,
  'ft:run': `<svg ${FT_ICON_ATTRS}><circle ${FT_SHAPE} cx="5.4" cy="18.2" r="1.8"/><path ${FT_SHAPE} d="M7.2 18.2h6.6a4.1 4.1 0 0 0 0-8.2h-1.9"/><path ${FT_SHAPE} d="M18 3.4a3.3 3.3 0 0 1 3.3 3.3c0 2.5-3.3 5.5-3.3 5.5s-3.3-3-3.3-5.5A3.3 3.3 0 0 1 18 3.4Z"/><circle cx="18" cy="6.7" r="0.4" fill="currentColor"/></svg>`,
  'ft:nutrition': `<svg ${FT_ICON_ATTRS}><path ${FT_SHAPE} d="M12 7.8c-2.1-1.7-5.6-1-6.6 2-1.2 3.6 1.2 8.7 3.5 10.1 1 .7 2.1.7 3.1 0 1 .7 2.1.7 3.1 0 2.3-1.4 4.7-6.5 3.5-10.1-1-3-4.5-3.7-6.6-2Z"/><path ${FT_SHAPE} d="M12 7.8c0-2.1 1.1-3.6 3.1-4.3"/></svg>`,
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="route-shell" [@routeAnimations]="prepareRoute(outlet)">
      <router-outlet #outlet="outlet" />
      <div class="loading-overlay" *ngIf="loadingService.isLoading()">
        <div class="loading-card">
          <div class="spinner" aria-hidden="true"></div>
          <div class="loading-text">Loading...</div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./app.css'],
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        query(':enter, :leave', style({ position: 'absolute', width: '100%' }), { optional: true }),
        group([
          query(':leave', [
            style({ opacity: 1, transform: 'translateY(0)' }),
            animate('180ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 0, transform: 'translateY(-6px)' })),
          ], { optional: true }),
          query(':enter', [
            style({ opacity: 0, transform: 'translateY(8px)' }),
            animate('240ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
          ], { optional: true }),
        ]),
      ]),
    ]),
  ],
})
export class App implements OnInit {
  constructor(
    private router: Router,
    public loadingService: LoadingService,
    iconService: NzIconService,
  ) {
    for (const [name, svg] of Object.entries(FT_ICONS)) {
      iconService.addIconLiteral(name, svg);
    }
  }

  ngOnInit(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const pendingDuration = this.loadingService.consumePendingDuration();
        if (pendingDuration) {
          this.loadingService.showFor(pendingDuration);
        } else {
          this.loadingService.hide();
        }
      }
      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.loadingService.hide();
      }
    });
  }

  prepareRoute(outlet: RouterOutlet) {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches) {
      return 'mobile';
    }
    if (!outlet?.isActivated) return 'root';
    return outlet.activatedRouteData?.['animation'] ?? outlet.activatedRoute?.routeConfig?.path;
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { trigger, transition, style, animate, query, group } from '@angular/animations';
import { ReminderService } from './core/services/reminder.service';
import { LoadingService } from './core/services/loading.service';

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
    private reminderService: ReminderService,
    private router: Router,
    public loadingService: LoadingService,
  ) {}

  ngOnInit(): void {
    this.reminderService.scheduleCheck();
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
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches) {
      return 'mobile';
    }
    if (!outlet?.isActivated) return 'root';
    return outlet.activatedRouteData?.['animation'] ?? outlet.activatedRoute?.routeConfig?.path;
  }
}

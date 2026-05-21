import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { trigger, transition, style, animate, query, group } from '@angular/animations';
import { ReminderService } from './core/services/reminder.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="route-shell" [@routeAnimations]="prepareRoute(outlet)">
      <router-outlet #outlet="outlet" />
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
  constructor(private reminderService: ReminderService) {}

  ngOnInit(): void {
    this.reminderService.scheduleCheck();
  }

  prepareRoute(outlet: RouterOutlet) {
    if (!outlet?.isActivated) return 'root';
    return outlet.activatedRouteData?.['animation'] ?? outlet.activatedRoute?.routeConfig?.path;
  }
}

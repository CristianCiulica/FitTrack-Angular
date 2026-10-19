import { Component, input } from '@angular/core';
import { AchievementId } from '../../../core/models/achievement.model';

@Component({
  selector: 'app-achievement-badge',
  standalone: true,
  template: `
    <svg viewBox="0 0 80 90" [class.locked]="!earned()" aria-hidden="true" focusable="false">
      <path class="ribbon" d="m22 54-6 32 15-7 9 9 4-32m14-2 6 32-15-7-9 9-4-32" />
      <path
        class="seal"
        d="m40 3 9 5 10 1 5 9 8 7-1 11 1 10-8 7-5 9-10 2-9 5-9-5-10-2-5-9-8-7 1-10-1-11 8-7 5-9 10-1Z"
      />
      <circle class="ring" cx="40" cy="36" r="24" />
      <circle class="face" cx="40" cy="36" r="20" />
      <g class="symbol">
        @switch (badge()) {
          @case ('first-session') {
            <path d="m40 21 4.5 9 10 1.5-7.2 7 1.7 10-9-4.7-9 4.7 1.7-10-7.2-7L35.5 30Z" />
          }
          @case ('ten-sessions') {
            <path d="M25 31v10m6-15v20m18-20v20m6-15v10M31 36h18" />
          }
          @case ('twenty-five-days') {
            <path d="m25 47 10-18 7 12 5-8 9 14H25Zm12-11 3 2 2-2M40 29V20h12l-4 4 4 4H40" />
          }
          @case ('seven-day-streak') {
            <path
              d="M42 20c1 9 10 11 10 20a12 12 0 0 1-24 0c0-5 3-8 6-11 0 6 3 8 5 8 4-5 4-10 3-17Z"
            />
            <path d="M39 40c-4 4-5 6-4 9a5 5 0 0 0 10-2c0-3-3-5-3-7 0 3-2 4-3 5Z" />
          }
        }
      </g>
      <path class="shine" d="m27 15 8-3m-14 9 2-2" />
    </svg>
  `,
  styleUrl: './achievement-badge.component.scss',
})
export class AchievementBadgeComponent {
  readonly badge = input.required<AchievementId>();
  readonly earned = input(true);
}

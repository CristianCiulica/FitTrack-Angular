import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FitTabBar } from '../glisse/controls';

@Component({
  selector: 'ft-navigation',
  imports: [RouterLink, RouterLinkActive, NzIconModule, FitTabBar],
  template: `
    <aside>
      <div class="wordmark">FitTrack<span>.</span></div>
      <ft-tab-bar [locked]="locked()" (blocked)="blocked.emit($event)" />
      <nav aria-label="Profile and progress">
        @for (item of secondary; track item[0]) {
          <a [routerLink]="locked() ? null : item[0]" routerLinkActive="current"
            ariaCurrentWhenActive="page" [attr.aria-disabled]="locked() || null" [attr.aria-label]="item[1]" [title]="item[1]"
            (click)="locked() && blocked.emit($event)">
            <span nz-icon [nzType]="item[2]" aria-hidden="true"></span><span class="link-label">{{ item[1] }}</span>
          </a>
        }
      </nav>
      <button type="button" class="sign-out" aria-label="Log out" title="Log out" (click)="signOut.emit()">
        <span nz-icon nzType="ft:sign-out" aria-hidden="true"></span><span class="link-label">Log out</span>
      </button>
    </aside>
  `,
  styleUrl: './navigation.component.css',
})
export class NavigationComponent {
  readonly locked = input(false);
  readonly signOut = output();
  readonly blocked = output<Event>();
  readonly secondary = [
    ['/progress', 'Progress', 'line-chart'], ['/weight', 'Weight', 'ft:weight'],
    ['/account', 'Profile', 'user'], ['/settings', 'Settings', 'setting'],
  ];
}

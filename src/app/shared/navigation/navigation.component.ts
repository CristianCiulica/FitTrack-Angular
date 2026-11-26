import { Component, DestroyRef, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { AuthService } from '../../core/services/auth.service';
import { FitTabBar } from '../glisse/controls';

@Component({
  selector: 'ft-navigation',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NzIconModule, FitTabBar],
  template: `
    <aside>
      <div class="bar">
        <div class="wordmark">FitTrack<span>.</span></div>
        <ft-tab-bar [desktop]="desktop()" />
        <details #account class="account-menu" (keydown.escape)="dismiss($event)">
          <summary aria-label="Account menu" title="Account menu"><span nz-icon nzType="user"></span></summary>
          <nav aria-label="Account">
            @for (item of secondary; track item[0]) {
              <a [routerLink]="item[0]" routerLinkActive="current" ariaCurrentWhenActive="page">
                <span nz-icon [nzType]="item[2]" aria-hidden="true"></span>{{ item[1] }}
              </a>
            }
            <button type="button" (click)="logout()"><span nz-icon nzType="ft:sign-out"></span>Log out</button>
          </nav>
        </details>
      </div>
    </aside>
    <router-outlet />
  `,
  styleUrl: './navigation.component.css',
})
export class NavigationComponent {
  private readonly auth = inject(AuthService);
  private readonly account = viewChild<ElementRef<HTMLDetailsElement>>('account');
  private readonly wide = window.matchMedia('(min-width: 901px)');
  readonly desktop = signal(this.wide.matches);
  readonly secondary = [
    ['/account', 'Profile', 'user'], ['/weight', 'Weight', 'ft:weight'], ['/settings', 'Settings', 'setting'],
    ['/nutrition-goals', 'Nutrition goals', 'ft:nutrition'],
  ];
  constructor() {
    const resize = () => { this.desktop.set(this.wide.matches); this.closeMenu(); };
    this.wide.addEventListener('change', resize);
    inject(DestroyRef).onDestroy(() => this.wide.removeEventListener('change', resize));
    inject(Router).events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationEnd) this.closeMenu();
    });
  }
  private closeMenu(): void {
    const details = this.account()?.nativeElement;
    if (details) details.open = false;
  }
  @HostListener('document:click', ['$event'])
  outside(event: MouseEvent): void {
    const details = this.account()?.nativeElement;
    if (details?.open && !details.contains(event.target as Node)) details.open = false;
  }
  dismiss(event: Event): void {
    const details = this.account()?.nativeElement;
    if (!details?.open) return;
    event.preventDefault();
    details.open = false;
    details.querySelector('summary')?.focus();
  }
  logout(): void {
    this.closeMenu();
    this.auth.logout().subscribe();
  }
}

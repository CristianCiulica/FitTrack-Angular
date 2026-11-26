import { Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LoadingService } from '../../core/services/loading.service';
import { FitAction } from '../../shared/glisse/controls';

type Provider = 'Google' | 'Apple';

@Component({
  selector: 'app-auth-providers',
  imports: [FitAction],
  templateUrl: './auth-providers.component.html',
  styles: `
    :host { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    ft-action { display: block; min-width: 0; --lg-edge: var(--auth-line); --lg-foreground: var(--ink); }
    .google-icon { display: inline-flex; }
  `,
})
export class AuthProvidersComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly loading = inject(LoadingService);
  readonly disabled = input(false);
  readonly busyChange = output<boolean>();
  readonly pending = signal<Provider | null>(null);

  signIn(provider: Provider): void {
    if (this.disabled() || this.pending()) return;
    this.pending.set(provider);
    this.busyChange.emit(true);
    const request = provider === 'Google' ? this.auth.signInWithGoogle() : this.auth.signInWithApple();
    request.pipe(finalize(() => {
      this.pending.set(null);
      this.busyChange.emit(false);
    })).subscribe({
      next: () => {
        this.loading.showAfterNextNavigation(1000);
        void this.router.navigate(['/dashboard']);
      },
      error: (error: { code?: string }) => {
        switch (error.code) {
          case 'auth/popup-closed-by-user':
          case 'auth/cancelled-popup-request':
            return;
          case 'auth/popup-blocked':
            this.message.error(`Allow pop-ups for FitTrack, then try ${provider} again.`); return;
          case 'auth/network-request-failed':
            this.message.error('Check your connection and try again.'); return;
          case 'auth/account-exists-with-different-credential':
            this.message.error('This email already has a FitTrack account. Use your original sign-in method.'); return;
          case 'auth/operation-not-allowed':
          case 'auth/unauthorized-domain':
            this.message.error(`${provider} sign-in is currently unavailable on FitTrack.`); return;
          default:
            this.message.error(`${provider} sign-in failed. Please try again.`);
        }
      },
    });
  }
}

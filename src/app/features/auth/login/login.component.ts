import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzMessageService } from 'ng-zorro-antd/message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzCheckboxModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  googleLoading = false;
  passwordVisible = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private message: NzMessageService,
    private loadingService: LoadingService,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      remember: [false],
    });
  }

  submit() {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach(c => c.markAsDirty());
      return;
    }
    this.loading = true;
    const { email, password, remember } = this.form.value;
    this.auth.login(email, password, !!remember).subscribe({
      next: () => {
        this.loadingService.showAfterNextNavigation(1000);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.message.error('Incorrect email or password.');
        this.loading = false;
      }
    });
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  forgotPassword() {
    const emailControl = this.form.get('email');
    if (!emailControl?.value || emailControl.invalid) {
      this.message.warning('Please enter a valid email address to reset your password.');
      emailControl?.markAsDirty();
      return;
    }

    this.loading = true;
    this.auth.resetPassword(emailControl.value).subscribe({
      next: () => {
        this.message.success('Password reset email sent! Check your inbox.');
        this.loading = false;
      },
      error: (err) => {
        this.message.error('Failed to send reset email. Please try again.');
        console.warn('[auth] reset failed', err);
        this.loading = false;
      }
    });
  }

  // sign in with google
  signInWithGoogle() {
    this.googleLoading = true;
    this.auth.signInWithGoogle().subscribe({
      next: () => {
        this.loadingService.showAfterNextNavigation(1000);
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.showGoogleError(error);
        this.googleLoading = false;
      },
    });
  }

  private showGoogleError(error: { code?: string }) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      this.message.warning('Google sign-in was cancelled.');
      return;
    }
    if (error?.code === 'auth/popup-blocked') {
      this.message.error('The Google window was blocked. Allow popups and try again.');
      return;
    }
    if (error?.code === 'auth/unauthorized-domain') {
      this.message.error('This website domain must be authorized in Firebase Authentication.');
      return;
    }
    if (error?.code === 'auth/operation-not-allowed') {
      this.message.error('Google sign-in is not enabled in Firebase Authentication.');
      return;
    }
    if (error?.code === 'auth/network-request-failed') {
      this.message.error('Network error. Check your connection and try again.');
      return;
    }
    if (error?.code === 'auth/account-exists-with-different-credential') {
      this.message.error('This email is already registered with a password. Sign in with your email and password instead.');
      return;
    }
    this.message.error(`Google sign-in failed${error?.code ? ' (' + error.code + ')' : ''}. Please try again.`);
  }
}

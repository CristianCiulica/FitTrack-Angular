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
import { NzMessageService } from 'ng-zorro-antd/message';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  form: FormGroup;
  loading = false;
  googleLoading = false;
  passwordVisible = false;
  confirmPasswordVisible = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private message: NzMessageService,
    private loadingService: LoadingService,
  ) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', Validators.required]
    }, { validators: passwordMatchValidator });
  }

  submit() {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach(c => c.markAsDirty());
      return;
    }
    this.loading = true;
    const { email, password, firstName, lastName } = this.form.value;
    this.auth.register(email, password, firstName, lastName).subscribe({
      next: () => {
        this.message.success('Account created successfully!');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.message.error(err.message ?? 'Registration failed.');
        this.loading = false;
      }
    });
  }

  toggleConfirmPasswordVisibility() {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

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

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pass === confirm ? null : { passwordMismatch: true };
}

export function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value ?? '';
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
  const hasLength = value.length >= 6;
  if (hasUpper && hasLower && hasNumber && hasSpecial && hasLength) return null;
  return { strongPassword: true };
}

import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
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
    NzCheckboxModule,
    NzIconModule,
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
      password: ['', [Validators.required, strongPasswordValidator]],
      remember: [false]
    });
  }

  submit() {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach(c => c.markAsDirty());
      return;
    }
    this.loading = true;
    const { email, password, remember } = this.form.value;
    this.auth.login(email, password, remember).subscribe({
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

  signInWithGoogle() {
    const remember = this.form.get('remember')?.value ?? false;
    this.googleLoading = true;
    this.auth.signInWithGoogle(remember).subscribe({
      next: () => {
        this.loadingService.showAfterNextNavigation(1000);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.message.error('Google sign-in failed. Please try again.');
        this.googleLoading = false;
      },
    });
  }
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

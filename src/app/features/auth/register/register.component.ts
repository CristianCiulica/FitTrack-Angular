import { AuthProvidersComponent } from '../auth-providers.component';
import { FitAction } from '../../../shared/glisse/controls';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
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
    FitAction,
    AuthProvidersComponent,
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
  providerBusy = false;
  passwordVisible = false;
  confirmPasswordVisible = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private message: NzMessageService,
  ) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', Validators.required]
    }, { validators: passwordMatchValidator });
  }

  get showPasswordMismatch(): boolean {
    const confirmation = this.form.controls['confirmPassword'];
    return confirmation.dirty && !confirmation.hasError('required') && this.form.hasError('passwordMismatch');
  }

  submit() {
    if (this.providerBusy || this.loading) return;
    if (this.form.invalid) {
      for (const control of Object.values(this.form.controls)) {
        control.markAsDirty();
        control.updateValueAndValidity({ onlySelf: true });
      }
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

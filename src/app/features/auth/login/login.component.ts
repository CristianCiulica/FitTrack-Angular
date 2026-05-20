import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { environment } from '../../../../environments/environment';

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
  passwordVisible = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private message: NzMessageService
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
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.message.error('Email sau parola incorecte.');
        this.loading = false;
      }
    });
  }

  demoLogin() {
    const demo = environment.demoAccount;
    if (!demo?.email || !demo?.password) {
      this.message.warning('Contul demo nu este configurat. Seteaza-l in environment.ts.');
      return;
    }
    this.form.patchValue({ email: demo.email, password: demo.password, remember: true });
    this.loading = true;

    this.auth.login(demo.email, demo.password, true).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        // Dacă login eșuează (ex. cont inexistent), încearcă să-l creeze automat
        this.auth.register(demo.email, demo.password, 'Test', 'User').subscribe({
          next: () => {
            this.message.success('Cont de test creat automat cu succes!');
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.message.error('Autentificarea cu contul de test a eșuat.');
            this.loading = false;
          }
        });
      }
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

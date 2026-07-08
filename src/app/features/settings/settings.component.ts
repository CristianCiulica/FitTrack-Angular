import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { Units } from '../../core/models/user-profile.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzCardModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    AppMenuComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly firebaseAuth = inject(Auth);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly units = this.profileService.units;
  readonly reminderDays = signal<number>(2);
  readonly deleting = signal(false);

  ngOnInit(): void {
    this.profileService.load().subscribe(() => this.hydrate());
    this.hydrate();
  }

  private hydrate(): void {
    const p = this.profileService.profile();
    if (p) this.reminderDays.set(p.workoutReminderDays ?? 2);
  }

  setUnits(units: Units): void {
    if (this.units() === units) return;
    this.profileService.patch({ units }).subscribe({
      error: () => this.message.error('Could not update units.'),
    });
  }

  onReminderChange(days: number): void {
    this.reminderDays.set(days);
    this.profileService.patch({ workoutReminderDays: days }).subscribe({
      error: () => this.message.error('Could not update reminders.'),
    });
  }

  exportData(): void {
    this.profileService.exportData();
  }

  deleteAccount(): void {
    this.deleting.set(true);
    // backend-ul sterge datele + contul din Firebase Auth (Admin SDK);
    // clientul doar se delogheaza dupa aceea
    this.profileService.deleteAccount().subscribe({
      next: () => {
        this.profileService.clear();
        signOut(this.firebaseAuth).finally(() => {
          this.deleting.set(false);
          this.message.success('Your account has been deleted.');
          this.router.navigate(['/auth/register']);
        });
      },
      error: (err) => {
        this.deleting.set(false);
        if (err?.error?.error === 'requires-recent-login') {
          this.message.error(
            'For your security, please log out and log back in to verify your identity before deleting your account.',
            { nzDuration: 7000 }
          );
        } else {
          this.message.error('Could not delete your account. Please try again.');
        }
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}

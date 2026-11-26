import { FitAction } from '../../shared/glisse/controls';
import { achievementReportHtml } from '../../core/utils/activity-export';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { ConfirmationService } from '../../shared/components/confirmation';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { Units } from '../../core/models/user-profile.model';
import { ThemeService } from '../../core/services/theme.service';
import { WorkoutService } from '../../core/services/workout.service';
import { RunningSessionService } from '../../core/services/running-session.service';
import { WeightService } from '../../core/services/weight.service';
import { NativeRunService } from '../../core/services/native-run.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FitAction,
    CommonModule,
    FormsModule,
    NzLayoutModule,
    NzButtonModule,
    NzIconModule,
    NzCardModule,
    AppMenuComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  private readonly confirmation = inject(ConfirmationService);
  readonly appearance = inject(ThemeService);
  readonly effectOptions = ['glass', 'blur'] as const;
  readonly appearanceOptions = ['light', 'dark', 'system'] as const;
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly firebaseAuth = inject(Auth);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly units = this.profileService.units;
  readonly deleting = signal(false);
  readonly exporting = signal(false);
  readonly exportingPdf = signal(false);
  private readonly workouts = inject(WorkoutService);
  private readonly runs = inject(RunningSessionService);
  private readonly weights = inject(WeightService);
  private readonly nativeRun = inject(NativeRunService);

  ngOnInit(): void {
    this.profileService.load().subscribe();
  }

  setUnits(units: Units): void {
    if (this.units() === units) return;
    this.profileService.patch({ units }).subscribe({
      error: () => this.message.error('Could not update units.'),
    });
  }

  exportData(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.profileService
      .exportData()
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe({
        error: () =>
          this.message.error('Could not export your data. Check your connection and try again.'),
      });
  }

  exportPdf(): void {
    if (this.exportingPdf()) return;
    const report = window.open('', '_blank');
    if (!report) {
      this.message.error('Allow pop-ups to open your PDF report.');
      return;
    }
    report.opener = null;
    report.document.body.textContent = 'Preparing your FitTrack achievements…';
    this.exportingPdf.set(true);
    this.profileService
      .getExportData()
      .pipe(finalize(() => this.exportingPdf.set(false)))
      .subscribe({
        next: (data) => {
          if (report.closed) return;
          report.document.open();
          report.document.write(achievementReportHtml(data));
          report.document.close();
          void report.document.fonts.ready.then(() => {
            if (!report.closed) {
              report.focus();
              report.print();
            }
          });
        },
        error: () => {
          report.close();
          this.message.error('Could not export your achievements. Please try again.');
        },
      });
  }

  confirmDeleteAccount(): void {
    this.confirmation.confirm({
      nzTitle: 'Delete your account?',
      nzContent: "Your profile, workouts, runs and weight entries will be permanently deleted. This can't be undone.",
      nzCancelText: 'Keep account', nzOkText: 'Delete account', nzOkDanger: true,
      nzOnOk: () => this.deleteAccount(),
    });
  }

  deleteAccount(): void {
    if (this.deleting()) return;
    const uid = this.auth.currentUserId;
    this.deleting.set(true);
    // backend-ul sterge datele + contul din Firebase Auth (Admin SDK);
    // clientul doar se delogheaza dupa aceea
    this.profileService.deleteAccount().subscribe({
      next: () => {
        void this.nativeRun.clear(uid);
        this.workouts.eraseCache(uid);
        this.runs.eraseCache(uid);
        this.weights.eraseCache(uid);
        this.profileService.clear();
        signOut(this.firebaseAuth).finally(() => {
          this.deleting.set(false);
          this.message.success('Your account has been deleted.');
          this.router.navigate(['/auth/register']);
        });
      },
      error: () => {
        this.deleting.set(false);
        this.message.error('Could not delete your account. Please try again.');
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}

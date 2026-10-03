import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-activity-goals', standalone: true, imports: [FormsModule, NzModalModule],
  template: `
    <button type="button" class="goals-link" (click)="show()">Edit goals</button>
    <nz-modal [nzVisible]="open()" nzTitle="Your Activity goals" [nzFooter]="null"
      [nzClosable]="!saving()" [nzMaskClosable]="!saving()" [nzKeyboard]="!saving()"
      nzCentered [nzWidth]="'min(420px, calc(100vw - 32px))'" nzClassName="solid-modal"
      (nzOnCancel)="open.set(false)">
      <ng-container *nzModalContent>
        <form class="goals-form" (ngSubmit)="save()">
          <p>Choose targets that fit your routine.</p>
          <label>Move <span>kcal per day</span><input name="move" type="number" min="50" max="5000" step="50" required [(ngModel)]="move" /></label>
          <label>Exercise <span>minutes per day</span><input name="exercise" type="number" min="5" max="300" step="5" required [(ngModel)]="exercise" /></label>
          <label>Workouts <span>sessions per week</span><input name="weekly" type="number" min="1" max="14" step="1" required [(ngModel)]="weekly" /></label>
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          <button class="save-goals" type="submit" [disabled]="saving() || !valid()">{{ saving() ? 'Saving…' : 'Save goals' }}</button>
        </form>
      </ng-container>
    </nz-modal>`,
  styles: [`
    .goals-link { border: 0; background: transparent; color: var(--accent); padding: 8px 0 8px 12px; cursor: pointer; font-size: 12px; font-weight: 600; }
    .goals-form { color: var(--ink); }
    .goals-form p { color: var(--ink-secondary); font-size: 13px; }
    label { display: grid; grid-template-columns: 1fr 90px; gap: 2px 16px; padding: 16px 0; border-bottom: 1px solid var(--hairline); font-weight: 600; }
    label span { grid-column: 1; font-size: 12px; font-weight: 400; color: var(--ink-secondary); }
    input { grid-column: 2; grid-row: 1 / span 2; align-self: center; width: 100%; min-width: 0; border: 1px solid var(--hairline); border-radius: 12px; background: var(--surface-input); color: var(--ink); padding: 10px; font: inherit; text-align: center; }
    .save-goals { margin-top: 22px; border: 0; border-radius: 24px; background: #007aff; color: #fff; padding: 13px; width: 100%; font-weight: 600; cursor: pointer; }
    .save-goals:disabled { opacity: .5; cursor: default; }
    .goals-form .form-error { color: var(--red); }
  `],
})
export class ActivityGoalsComponent {
  private readonly profile = inject(ProfileService);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  move = 500; exercise = 30; weekly = 4;
  show() {
    this.move = this.profile.moveGoal(); this.exercise = this.profile.exerciseGoal();
    this.weekly = this.profile.weeklyWorkoutGoal(); this.error.set(''); this.open.set(true);
  }
  valid() {
    return Number.isInteger(this.move) && this.move >= 50 && this.move <= 5000
      && Number.isInteger(this.exercise) && this.exercise >= 5 && this.exercise <= 300
      && Number.isInteger(this.weekly) && this.weekly >= 1 && this.weekly <= 14;
  }
  save() {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true); this.error.set('');
    this.profile.saveActivityGoals({moveGoal: this.move, exerciseGoal: this.exercise, weeklyWorkoutGoal: this.weekly}).subscribe({
      next: () => { this.saving.set(false); this.open.set(false); },
      error: () => { this.saving.set(false); this.error.set('Could not save your goals. Please try again.'); },
    });
  }
}

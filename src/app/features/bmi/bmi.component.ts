import { Component, computed, effect, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import {
  cmToFeetInches,
  displayWeight,
  feetInchesToCm,
  toCanonicalWeight,
  weightUnitLabel,
} from '../../core/utils/units';

@Component({
  selector: 'app-bmi',
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
    NzTagModule,
    AppMenuComponent,
  ],
  templateUrl: './bmi.component.html',
  styleUrls: ['./bmi.component.scss']
})
export class BmiComponent implements OnDestroy {
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);

  // canonical metric — seeded from profile, synced back to profile (single source of truth)
  height = signal<number>(170); // cm
  weight = signal<number>(70);  // kg
  age = signal<number>(30);
  sex = signal<'male' | 'female'>('male');

  // calculator state only, not persisted in profile
  strengthTrainingDays = signal<number>(4);
  goal = signal<'lose' | 'maintain' | 'gain'>('lose');
  goalRate = signal<number>(0.5);

  readonly units = this.profileService.units;
  readonly isImperial = computed(() => this.units() === 'imperial');
  readonly weightUnit = computed(() => weightUnitLabel(this.units()));
  readonly weightInput = computed(() => displayWeight(this.weight(), this.units()));
  readonly feet = computed(() => cmToFeetInches(this.height()).feet);
  readonly inches = computed(() => cmToFeetInches(this.height()).inches);

  private hydrated = false;
  private patchTimer: ReturnType<typeof setTimeout> | null = null;
  private goalTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.profileService.load().subscribe();
    // seed from profile once, when it becomes available — includem si obiectivul,
    // ritmul si numarul de antrenamente alese la onboarding
    effect(() => {
      const p = this.profileService.profile();
      if (!p || this.hydrated) return;
      if (p.heightCm) this.height.set(p.heightCm);
      if (p.weightKg) this.weight.set(p.weightKg);
      if (p.age) this.age.set(p.age);
      if (p.sex === 'male' || p.sex === 'female') this.sex.set(p.sex);
      if (p.goal) this.goal.set(p.goal);
      if (p.goalRate) this.goalRate.set(p.goalRate);
      if (p.weeklyWorkoutGoal) this.strengthTrainingDays.set(p.weeklyWorkoutGoal);
      this.hydrated = true;
    });
  }

  ngOnDestroy() {
    if (this.patchTimer) clearTimeout(this.patchTimer);
    if (this.goalTimer) clearTimeout(this.goalTimer);
  }

  // use computed for auto calculated values
  bmi = computed(() => {
    const h = this.height() / 100;
    const w = this.weight();
    if (h === 0) return '0.0';
    return (w / (h * h)).toFixed(1);
  });

  bmiCategory = computed(() => {
    const value = parseFloat(this.bmi());
    if (value < 18.5) return { text: 'Underweight', color: 'blue' };
    if (value < 25) return { text: 'Healthy weight', color: 'green' };
    if (value < 30) return { text: 'Overweight', color: 'red' };
    return { text: 'Obesity', color: 'red' };
  });

  activityFactor = computed(() => {
    const days = this.strengthTrainingDays();
    if (days <= 0) return 1.2;
    if (days <= 2) return 1.375;
    if (days <= 4) return 1.55;
    if (days <= 6) return 1.725;
    return 1.9;
  });

  basalCalories = computed(() => {
    const base =
      10 * this.weight() +
      6.25 * this.height() -
      5 * this.age();
    return Math.round(base + (this.sex() === 'male' ? 5 : -161));
  });

  maintenanceCalories = computed(() =>
    Math.round(this.basalCalories() * this.activityFactor()),
  );

  calorieAdjustment = computed(() =>
    Math.round((this.goalRate() * 7700) / 7),
  );

  targetCalories = computed(() => {
    if (this.goal() === 'maintain') {
      return this.maintenanceCalories();
    }
    const target =
      this.goal() === 'lose'
        ? this.maintenanceCalories() - this.calorieAdjustment()
        : this.maintenanceCalories() + this.calorieAdjustment();
    return Math.max(this.basalCalories(), Math.round(target));
  });

  setGoal(goal: 'lose' | 'maintain' | 'gain') {
    this.goal.set(goal);
    if (goal === 'gain' && this.goalRate() > 0.5) {
      this.goalRate.set(0.5);
    }
    this.queueGoalSync();
  }

  onGoalRate(value: number) {
    this.goalRate.set(value);
    this.queueGoalSync();
  }

  onStrengthDays(value: number) {
    this.strengthTrainingDays.set(value);
    this.queueGoalSync();
  }

  // obiectivul, ritmul si antrenamentele/saptamana sunt persistate in profil,
  // ca sa ramana sincronizate cu onboarding-ul si dashboard-ul
  private queueGoalSync() {
    if (!this.profileService.profile()) return;
    if (this.goalTimer) clearTimeout(this.goalTimer);
    this.goalTimer = setTimeout(() => {
      this.profileService
        .patch({
          goal: this.goal(),
          goalRate: Math.round(this.goalRate() * 10) / 10,
          weeklyWorkoutGoal: Math.max(1, Math.round(this.strengthTrainingDays())),
        })
        .subscribe({ error: (err) => console.warn('[bmi] Failed to sync goal', err) });
    }, 600);
  }

  // physical data changes propagate to the rest of the app via profile
  onHeightCm(value: number) {
    this.height.set(value);
    this.queueProfileSync();
  }

  onWeightInput(value: number) {
    this.weight.set(toCanonicalWeight(value, this.units()));
    this.queueProfileSync();
  }

  onFeetInput(value: number) {
    this.height.set(feetInchesToCm(value, this.inches()));
    this.queueProfileSync();
  }

  onInchesInput(value: number) {
    this.height.set(feetInchesToCm(this.feet(), value));
    this.queueProfileSync();
  }

  onAge(value: number) {
    this.age.set(value);
    this.queueProfileSync();
  }

  onSex(value: 'male' | 'female') {
    this.sex.set(value);
    this.queueProfileSync();
  }

  private queueProfileSync() {
    if (!this.profileService.profile()) return;
    if (this.patchTimer) clearTimeout(this.patchTimer);
    this.patchTimer = setTimeout(() => {
      this.profileService
        .patch({
          heightCm: Math.round(this.height()),
          weightKg: Math.round(this.weight() * 10) / 10,
          age: this.age(),
          sex: this.sex(),
        })
        .subscribe({ error: (err) => console.warn('[bmi] Failed to sync profile', err) });
    }, 600);
  }

  logout() {
    this.authService.logout().subscribe();
  }
}

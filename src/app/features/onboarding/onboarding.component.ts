import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ProfileService } from '../../core/services/profile.service';
import { Sex } from '../../core/models/user-profile.model';

type Step = 'name' | 'age' | 'body' | 'goal' | 'training' | 'result';
type Goal = 'lose' | 'maintain' | 'gain';

const STEP_ORDER: Step[] = ['name', 'age', 'body', 'goal', 'training', 'result'];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzInputNumberModule, NzIconModule],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss'],
})
export class OnboardingComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly step = signal<Step>('name');
  readonly saving = signal(false);

  constructor() {
    // daca profilul soseste tarziu (race la boot) si userul e deja onboarded,
    // il scoatem automat de pe acest ecran — dar nu in timp ce salveaza el insusi
    effect(() => {
      if (this.profileService.isOnboarded() && !this.saving()) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  readonly name = signal('');
  readonly age = signal(25);
  readonly heightCm = signal(170);
  readonly weightKg = signal(70);
  readonly sex = signal<Exclude<Sex, ''>>('male');
  readonly goal = signal<Goal>('maintain');
  readonly goalRate = signal(0.5);
  readonly weeklyWorkoutGoal = signal(4);
  readonly workoutOptions = [1, 2, 3, 4, 5, 6, 7];

  readonly stepIndex = computed(() => STEP_ORDER.indexOf(this.step()));
  readonly progress = computed(() =>
    Math.round(((this.stepIndex() + 1) / STEP_ORDER.length) * 100),
  );

  readonly bmi = computed(() => {
    const h = this.heightCm() / 100;
    if (h <= 0) return 0;
    return this.weightKg() / (h * h);
  });

  readonly bmiLabel = computed(() => this.bmi().toFixed(1));

  readonly bmiCategory = computed(() => {
    const value = this.bmi();
    if (value < 18.5) return { text: 'Underweight', tone: 'low' };
    if (value < 25) return { text: 'Healthy weight', tone: 'good' };
    if (value < 30) return { text: 'Overweight', tone: 'mid' };
    return { text: 'Obesity', tone: 'high' };
  });

  // proiectie simpla: cate kg poti castiga/pierde daca te tii de plan
  readonly projectionWeeks = 12;
  readonly projectedWeight = computed(() => {
    const delta = this.goalRate() * this.projectionWeeks;
    if (this.goal() === 'lose') return Math.max(35, this.weightKg() - delta);
    if (this.goal() === 'gain') return this.weightKg() + delta;
    return this.weightKg();
  });

  readonly projectedBmi = computed(() => {
    const h = this.heightCm() / 100;
    if (h <= 0) return 0;
    return this.projectedWeight() / (h * h);
  });

  readonly projectionHeadline = computed(() => {
    const diff = Math.abs(this.projectedWeight() - this.weightKg());
    if (this.goal() === 'maintain' || diff < 0.1) {
      return 'Stay consistent and hold a healthy, stable weight.';
    }
    const verb = this.goal() === 'lose' ? 'lose' : 'gain';
    return `Stay consistent and you could ${verb} ~${diff.toFixed(1)} kg in ${this.projectionWeeks} weeks.`;
  });

  ngOnInit(): void {
    if (this.profileService.isOnboarded()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    const profile = this.profileService.profile();
    if (profile) {
      if (profile.displayName) this.name.set(profile.displayName);
      if (profile.age) this.age.set(profile.age);
      if (profile.heightCm) this.heightCm.set(profile.heightCm);
      if (profile.weightKg) this.weightKg.set(profile.weightKg);
      if (profile.sex === 'male' || profile.sex === 'female') this.sex.set(profile.sex);
      if (profile.goal) this.goal.set(profile.goal);
      if (profile.goalRate) this.goalRate.set(profile.goalRate);
      if (profile.weeklyWorkoutGoal) this.weeklyWorkoutGoal.set(profile.weeklyWorkoutGoal);
    }
  }

  get firstName(): string {
    return this.name().trim().split(' ')[0] || 'there';
  }

  canAdvance(): boolean {
    switch (this.step()) {
      case 'name':
        return this.name().trim().length > 0;
      case 'age':
        return this.age() >= 12 && this.age() <= 100;
      case 'body':
        return this.heightCm() >= 120 && this.heightCm() <= 230 && this.weightKg() >= 30;
      default:
        return true;
    }
  }

  next(): void {
    if (!this.canAdvance()) return;
    const idx = this.stepIndex();
    if (idx < STEP_ORDER.length - 1) {
      this.step.set(STEP_ORDER[idx + 1]);
    }
  }

  back(): void {
    const idx = this.stepIndex();
    if (idx > 0) this.step.set(STEP_ORDER[idx - 1]);
  }

  setGoal(goal: Goal): void {
    this.goal.set(goal);
    if (goal === 'gain' && this.goalRate() > 0.5) this.goalRate.set(0.5);
  }

  finish(): void {
    this.saving.set(true);
    this.profileService
      .patch({
        displayName: this.name().trim(),
        age: this.age(),
        heightCm: this.heightCm(),
        weightKg: this.weightKg(),
        sex: this.sex(),
        goal: this.goal(),
        goalRate: this.goalRate(),
        weeklyWorkoutGoal: this.weeklyWorkoutGoal(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.saving.set(false);
          this.message.error('Could not save your details. Please try again.');
        },
      });
  }
}

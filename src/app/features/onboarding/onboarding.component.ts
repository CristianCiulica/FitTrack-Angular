import { Component, ElementRef, Injector, OnInit, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ProfileService } from '../../core/services/profile.service';
import { Sex } from '../../core/models/user-profile.model';
import { ThemeService } from '../../core/services/theme.service';

type Step = 'name' | 'appearance' | 'age' | 'body' | 'goal' | 'training' | 'result' | 'plan';
type Goal = 'lose' | 'maintain' | 'gain';

const STEP_ORDER: Step[] = ['name', 'appearance', 'age', 'body', 'goal', 'training', 'result', 'plan'];

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
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('stepTitle');
  private readonly body = viewChild<ElementRef<HTMLElement>>('stepBody');
  private readonly completionStarted = signal(false);
  readonly appearance = inject(ThemeService);
  readonly themes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'Auto' },
  ] as const;

  readonly step = signal<Step>('name');
  readonly saving = signal(false);
  readonly direction = signal<'forward' | 'back'>('forward');

  constructor() {
    // An existing profile may arrive late. Our own optimistic save must not
    // redirect away from the plan the user just chose.
    effect(() => {
      if (this.profileService.isOnboarded() && !this.completionStarted()) {
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
  readonly totalSteps = STEP_ORDER.length;
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
      return 'Your goal is to maintain your current weight.';
    }
    const verb = this.goal() === 'lose' ? 'lose' : 'gain';
    return `At your chosen pace: ${verb} ${diff.toFixed(1)} kg over ${this.projectionWeeks} weeks.`;
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
        return this.name().trim().length > 0 && this.name().trim().length <= 80;
      case 'age':
        return Number.isInteger(this.age()) && this.age() >= 12 && this.age() <= 100;
      case 'body':
        return this.heightCm() >= 120 && this.heightCm() <= 230 && this.weightKg() >= 30 && this.weightKg() <= 300;
      default:
        return true;
    }
  }

  next(): void {
    if (this.saving() || !this.canAdvance()) return;
    const idx = this.stepIndex();
    if (idx < STEP_ORDER.length - 1) {
      this.moveTo(STEP_ORDER[idx + 1], 'forward');
    }
  }

  back(): void {
    if (this.saving()) return;
    const idx = this.stepIndex();
    if (idx > 0) this.moveTo(STEP_ORDER[idx - 1], 'back');
  }

  private moveTo(step: Step, direction: 'forward' | 'back'): void {
    this.direction.set(direction);
    this.step.set(step);
    afterNextRender(() => {
      const body = this.body()?.nativeElement;
      if (body) body.scrollTop = 0;
      this.heading()?.nativeElement.focus({ preventScroll: true });
    }, { injector: this.injector });
  }

  setGoal(goal: Goal): void {
    this.goal.set(goal);
    if (goal === 'gain' && this.goalRate() > 0.5) this.goalRate.set(0.5);
  }

  finish(explorePlan = false): void {
    if (this.saving() || this.step() !== 'plan') return;
    // Recheck earlier fields before sending the complete profile.
    if (!this.name().trim() || this.name().trim().length > 80) { this.moveTo('name', 'back'); return; }
    if (!Number.isInteger(this.age()) || this.age() < 12 || this.age() > 100) { this.moveTo('age', 'back'); return; }
    if (!(this.heightCm() >= 120 && this.heightCm() <= 230 && this.weightKg() >= 30 && this.weightKg() <= 300)) { this.moveTo('body', 'back'); return; }
    this.completionStarted.set(true);
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
        theme: this.appearance.preference(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          if (explorePlan) this.router.navigate(['/start-workout'], { queryParams: { plan: 'push-pull-legs' } });
          else this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.saving.set(false);
          this.message.error('Could not save your details. Please try again.');
        },
      });
  }
}

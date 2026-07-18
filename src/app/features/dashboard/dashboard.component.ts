import { Component, ElementRef, OnInit, ViewChild, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { RunningSessionService } from '../../core/services/running-session.service';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Workout } from '../../core/models/workout.model';
import { estimateSessionCalories } from '../../core/utils/workout-calories';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import {
  ASSISTANT_OPTIONS,
  AssistantAnswers,
  AssistantOption,
  AssistantStep,
  MealRecommendation,
  createMealRecommendation,
} from './nutrition-assistant.data';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzCardModule,
    NzStatisticModule,
    NzIconModule,
    NzButtonModule,
    NzDropDownModule,
    NzTagModule,
    NzModalModule,
    AppMenuComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  @ViewChild('chatBody') private chatBody?: ElementRef<HTMLElement>;

  private readonly profileService = inject(ProfileService);
  readonly firstName = computed(() => {
    const name = this.profileService.displayName().trim();
    return name ? name.split(' ')[0] : '';
  });

  workouts = signal<Workout[]>([]);

  readonly assistantStepOrder: Exclude<AssistantStep, 'result'>[] = [
    'goal',
    'meal',
    'diet',
    'time',
    'budget',
  ];
  isChatOpen = signal(false);
  assistantStep = signal<AssistantStep>('goal');
  assistantAnswers = signal<Partial<AssistantAnswers>>({});
  assistantResult = signal<MealRecommendation | null>(null);

  assistantProgress = computed(() => {
    const step = this.assistantStep();
    if (step === 'result') return 100;
    const index = this.assistantStepOrder.indexOf(step);
    return Math.round(((index + 1) / this.assistantStepOrder.length) * 100);
  });

  assistantQuestion = computed(() => {
    switch (this.assistantStep()) {
      case 'goal': return { eyebrow: 'Step 1 of 5', title: 'What is your main goal?', description: 'This changes the suggested portions and macro balance.' };
      case 'meal': return { eyebrow: 'Step 2 of 5', title: 'What do you want to plan?', description: 'Choose the moment when you want to eat this meal.' };
      case 'diet': return { eyebrow: 'Step 3 of 5', title: 'Any dietary preference?', description: 'The assistant will only use compatible meal ideas.' };
      case 'time': return { eyebrow: 'Step 4 of 5', title: 'How much time do you have?', description: 'We will match the preparation style to your schedule.' };
      case 'budget': return { eyebrow: 'Step 5 of 5', title: 'Choose your budget', description: 'One last choice before building your recommendation.' };
      case 'result': return { eyebrow: 'Your plan', title: 'Meal recommendation', description: 'Built locally from your selected preferences.' };
    }
  });

  assistantOptions = computed<AssistantOption[]>(() => {
    const step = this.assistantStep();
    return step === 'result' ? [] : ASSISTANT_OPTIONS[step];
  });

  selectedAnswerLabels = computed(() =>
    this.assistantStepOrder
      .map((step) => {
        const value = this.assistantAnswers()[step];
        const option = ASSISTANT_OPTIONS[step].find((item) => item.value === value);
        return option ? { step, label: option.label } : null;
      })
      .filter((item): item is { step: Exclude<AssistantStep, 'result'>; label: string } => !!item),
  );

  totalWorkouts = computed(() => this.workouts().length);
  totalVolume = computed(() =>
    this.workouts().reduce((acc, w) => {
      const vol = w.exercises?.reduce((eAcc, e) => eAcc + e.sets * e.reps * e.weight, 0) || 0;
      return acc + vol;
    }, 0)
  );
  // inceputul saptamanii calendaristice curente (luni, 00:00) — obiectivul se
  // reseteaza la fiecare saptamana, nu pe o fereastra glisanta de 7 zile
  private startOfWeek(): Date {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday;
  }
  thisWeekWorkouts = computed(() => {
    const monday = this.startOfWeek();
    return this.workouts().filter(w => new Date(w.date) >= monday).length;
  });
  recentWorkouts = computed(() => [...this.workouts()].slice(0, 5));

  // aceleasi tonuri pe grupe musculare ca in History/Community
  private readonly muscleTones: Record<string, string> = {
    Chest: 'blue',
    Back: 'green',
    Shoulders: 'purple',
    Arms: 'cyan',
    Legs: 'indigo',
    Core: 'pink',
    Cardio: 'red',
    'Full Body': 'graphite',
  };

  getPrimaryMuscle(workout: Workout): string {
    return workout.exercises?.[0]?.muscleGroup ?? 'Full Body';
  }

  muscleTone(muscleGroup: string): string {
    return this.muscleTones[muscleGroup] ?? 'graphite';
  }

  /* ---------------- Activity calendar + daily metrics ---------------- */

  private readonly runningSessionService = inject(RunningSessionService);
  private readonly runningSessions = this.runningSessionService.sessions;

  readonly selectedDate = signal<Date>(new Date());

  toKey(date: Date): string {
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
  }

  // saptamana afisata incepe luni, in jurul zilei selectate
  readonly weekDays = computed(() => {
    const selected = this.selectedDate();
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));

    const workoutKeys = new Set(this.workouts().map((w) => (w.date ?? '').slice(0, 10)));
    const runKeys = new Set(this.runningSessions().map((s) => this.toKey(new Date(s.startedAt))));
    const todayKey = this.toKey(new Date());
    const selectedKey = this.toKey(selected);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const key = this.toKey(date);
      return {
        date,
        key,
        label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
        dayNum: date.getDate(),
        selected: key === selectedKey,
        isToday: key === todayKey,
        hasActivity: workoutKeys.has(key) || runKeys.has(key),
      };
    });
  });

  selectDay(date: Date) {
    this.selectedDate.set(new Date(date));
  }

  shiftWeek(direction: -1 | 1) {
    const next = new Date(this.selectedDate());
    next.setDate(next.getDate() + direction * 7);
    this.selectedDate.set(next);
  }

  private readonly sessionsForDay = computed(() => {
    const key = this.toKey(this.selectedDate());
    return this.runningSessions().filter((s) => this.toKey(new Date(s.startedAt)) === key);
  });

  readonly stepsForDay = computed(() =>
    this.sessionsForDay().reduce((acc, s) => acc + (s.steps ?? 0), 0),
  );

  private readonly workoutsForDay = computed(() => {
    const key = this.toKey(this.selectedDate());
    return this.workouts().filter((w) => (w.date ?? '').slice(0, 10) === key);
  });

  readonly workoutsOnDay = computed(() => this.workoutsForDay().length);

  // caloriile estimate ale unui antrenament de forta, pe baza greutatii din profil
  workoutKcal(workout: Workout): number {
    return estimateSessionCalories(workout.exercises, this.profileService.weightKg());
  }

  // tinta zilnica de calorii din profil (Mifflin-St Jeor, activitate usoara)
  readonly targetKcal = computed(() => {
    const p = this.profileService.profile();
    if (!p?.weightKg || !p?.heightCm || !p?.age) return 2200;
    const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'female' ? -161 : 5);
    return Math.round(base * 1.375);
  });

  // arse = alergari + antrenamentele de forta din ziua selectata
  readonly burnedKcal = computed(() => {
    const runs = this.sessionsForDay().reduce((acc, s) => acc + (s.calories ?? 0), 0);
    const weight = this.profileService.weightKg();
    const workouts = this.workoutsForDay().reduce(
      (acc, w) => acc + estimateSessionCalories(w.exercises, weight),
      0,
    );
    return Math.round(runs + workouts);
  });

  readonly remainingKcal = computed(() => Math.max(0, this.targetKcal() - this.burnedKcal()));

  readonly burnedPercent = computed(() => {
    const target = this.targetKcal();
    if (target <= 0) return 0;
    return Math.min(100, Math.round((this.burnedKcal() / target) * 100));
  });

  // tinta de antrenamente/saptamana aleasa la onboarding
  readonly weeklyGoal = computed(() => this.profileService.weeklyWorkoutGoal());
  readonly goalPercent = computed(() =>
    Math.min(100, Math.round((this.thisWeekWorkouts() / this.weeklyGoal()) * 100)),
  );
  // obiectivul saptamanal a fost atins
  readonly goalReached = computed(() => this.thisWeekWorkouts() >= this.weeklyGoal());

  toggleChat() {
    this.isChatOpen.update(v => !v);
    if (this.isChatOpen()) {
      this.scrollAssistantToTop();
    }
  }

  chooseAssistantOption(value: string) {
    const step = this.assistantStep();
    if (step === 'result') return;

    this.assistantAnswers.update((answers) => ({ ...answers, [step]: value }));
    const currentIndex = this.assistantStepOrder.indexOf(step);

    if (currentIndex === this.assistantStepOrder.length - 1) {
      const completeAnswers = this.assistantAnswers() as AssistantAnswers;
      this.assistantResult.set(createMealRecommendation(completeAnswers));
      this.assistantStep.set('result');
    } else {
      this.assistantStep.set(this.assistantStepOrder[currentIndex + 1]);
    }
    this.scrollAssistantToTop();
  }

  isAssistantOptionSelected(value: string): boolean {
    const step = this.assistantStep();
    return step !== 'result' && this.assistantAnswers()[step] === value;
  }

  goBackAssistant() {
    const step = this.assistantStep();
    if (step === 'goal') return;

    if (step === 'result') {
      this.assistantStep.set('budget');
      this.assistantResult.set(null);
    } else {
      const currentIndex = this.assistantStepOrder.indexOf(step);
      this.assistantStep.set(this.assistantStepOrder[currentIndex - 1]);
    }
    this.scrollAssistantToTop();
  }

  resetAssistant() {
    this.assistantAnswers.set({});
    this.assistantResult.set(null);
    this.assistantStep.set('goal');
    this.scrollAssistantToTop();
  }

  showAnotherRecipe() {
    const answers = this.assistantAnswers() as AssistantAnswers;
    this.assistantResult.set(createMealRecommendation(answers));
    this.scrollAssistantToTop();
  }

  private scrollAssistantToTop() {
    setTimeout(() => {
      const chatBody = this.chatBody?.nativeElement;
      if (!chatBody) return;
      chatBody.scrollTop = 0;
    });
  }

  constructor(
    private workoutService: WorkoutService,
    private authService: AuthService,
    private message: NzMessageService
  ) { }

  ngOnInit() {
    this.workoutService.getWorkouts().subscribe({
      next: (data) => {
        this.workouts.set(data);
        this.workoutService.workouts.set(data);
        this.workoutService.totalWorkouts.set(data.length);
      },
      error: (err) => console.warn('[dashboard] Failed to load workouts', err)
    });
    this.runningSessionService.getSessions().subscribe({
      error: (err) => console.warn('[dashboard] Failed to load running sessions', err)
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }
}

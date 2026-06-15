import { Component, ElementRef, OnInit, ViewChild, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { Workout } from '../../core/models/workout.model';
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
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  @ViewChild('chatBody') private chatBody?: ElementRef<HTMLElement>;

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
  thisWeekWorkouts = computed(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.workouts().filter(w => new Date(w.date) >= weekAgo).length;
  });
  recentWorkouts = computed(() => [...this.workouts()].slice(0, 5));

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
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.workoutService.getWorkouts().subscribe(data => {
      this.workouts.set(data);
      this.workoutService.workouts.set(data);
      this.workoutService.totalWorkouts.set(data.length);
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }
}

import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { firstValueFrom } from 'rxjs';
import { Workout } from '../../core/models/workout.model';
import { AuthService } from '../../core/services/auth.service';
import { WorkoutService } from '../../core/services/workout.service';
import { ProfileService } from '../../core/services/profile.service';
import { localDateKey } from '../../core/utils/weight-progress';
import { displayWeight, weightUnitLabel } from '../../core/utils/units';
import { CircularDialogMotion } from '../../shared/components/circular-dialog-motion';
import {
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LABELS,
  FOCUS_LABELS,
  GOAL_LABELS,
  TrainingEquipment,
  TrainingExercise,
  TrainingPlan,
  TrainingPreferences,
  WEEKDAYS,
} from './training-planner.model';
import {
  TRAINING_SOURCES,
  buildTrainingPlan,
  startingLoad,
  swapTrainingMovement,
  trainingAlternatives,
  trainingBlocker,
  validPreferences,
} from './training-planner.engine';
import { savedTrainingPlans, trainingPlanWorkouts } from './training-plan-storage';

@Component({
  selector: 'app-training-planner',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  templateUrl: './training-planner.component.html',
  styleUrls: ['./training-planner-result.scss', './training-planner.component.scss'],
})
export class TrainingPlannerComponent {
  @ViewChild('launcher') private launcher!: ElementRef<HTMLButtonElement>;
  @ViewChild('dialog') private dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('screen') private screen!: ElementRef<HTMLElement>;
  @ViewChild('scrollBody') private scrollBody!: ElementRef<HTMLElement>;
  @ViewChild('heading') private heading?: ElementRef<HTMLElement>;
  private readonly workouts = inject(WorkoutService);
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private motion?: CircularDialogMotion;
  private destroyed = false;
  readonly opened = signal(false);
  readonly step = signal(0);
  readonly answers = signal<Partial<TrainingPreferences>>({
    equipment: [],
    days: [],
    minutes: 45,
    focus: 'balanced',
  });
  readonly plan = signal<TrainingPlan | null>(null);
  readonly activeDay = signal(0);
  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saveMessage = signal('');
  readonly swapIndex = signal<number | null>(null);
  readonly sources = TRAINING_SOURCES;
  readonly weekdays = WEEKDAYS;
  readonly equipmentOptions = EQUIPMENT_OPTIONS;
  readonly goalLabels = GOAL_LABELS;
  readonly experienceLabels = EXPERIENCE_LABELS;
  readonly focusLabels = FOCUS_LABELS;
  readonly steps = ['Your goal', 'Experience', 'Equipment', 'Your week', 'Your focus', 'Readiness'];
  readonly minuteOptions = [30, 45, 60, 75] as const;
  readonly questions = [
    {
      title: 'A plan with your name on it.',
      description: 'Start with what you want to achieve. We’ll build the training around you.',
    },
    {
      title: 'Meet yourself where you are.',
      description:
        'Your experience sets the starting workload. Consistency matters more than an ambitious label.',
    },
    {
      title: 'Your space. Your equipment.',
      description:
        'Select what you can actually use. Every exercise and alternative will respect this list.',
    },
    {
      title: 'Make room for stronger.',
      description:
        'Choose two to six days you can sustain, then the time you have for each session.',
    },
    {
      title: 'What deserves extra attention?',
      description:
        'We’ll prioritise your focus while keeping the rest of your training in balance.',
    },
    {
      title: 'Start from a good place.',
      description: 'A useful plan matches your current readiness, as well as your ambition.',
    },
  ];
  readonly selectedDay = computed(() => this.plan()?.days[this.activeDay()] ?? null);
  readonly alternatives = computed(() => {
    const p = this.plan(),
      d = this.selectedDay(),
      i = this.swapIndex();
    return p && d && i !== null ? trainingAlternatives(d.exercises[i], d, p.preferences) : [];
  });
  readonly canContinue = computed(() => {
    const p = this.answers();
    switch (this.step()) {
      case 0:
        return !!p.goal;
      case 1:
        return !!p.experience;
      case 2:
        return !!p.equipment?.some((e) => e !== 'bench');
      case 3:
        return !!p.days && p.days.length >= 2 && p.days.length <= 6 && !!p.minutes;
      case 4:
        return !!p.focus;
      case 5:
        return !!p.readiness;
      default:
        return false;
    }
  });
  readonly totalSets = computed(
    () => this.selectedDay()?.exercises.reduce((sum, e) => sum + e.sets, 0) ?? 0,
  );
  readonly focusOptions = [
    {
      value: 'balanced' as const,
      title: 'Balanced development',
      description: 'Give the whole body a strong foundation.',
    },
    {
      value: 'upper' as const,
      title: 'Chest & back',
      description: 'Prioritise pressing and pulling work.',
    },
    {
      value: 'lower' as const,
      title: 'Legs & glutes',
      description: 'Give lower-body work first call on extra time.',
    },
    {
      value: 'arms' as const,
      title: 'Shoulders & arms',
      description: 'Prioritise delts, biceps and triceps accessories.',
    },
  ];
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.motion?.destroy();
    });
  }
  private get draftKey() {
    return `fittrack_training_builder:${this.auth.currentUserId || 'local'}`;
  }
  async open() {
    if (this.opened()) return;
    if (!this.plan()) {
      const existing = savedTrainingPlans(this.workouts.workouts()).at(0);
      if (existing) {
        this.plan.set(existing.plan);
        this.answers.set(existing.plan.preferences);
        this.saved.set(existing.savedDays === existing.plan.days.length);
        this.step.set(6);
      }
      this.restoreDraft();
    }
    this.motion ??= new CircularDialogMotion(
      this.dialog.nativeElement,
      this.launcher.nativeElement,
      this.screen.nativeElement,
    );
    this.opened.set(true);
    await this.motion.open();
    if (this.dialog.nativeElement.open && !this.motion.closing) this.focusHeading();
  }
  async close() {
    await this.motion?.close();
    if (!this.dialog.nativeElement.open) this.opened.set(false);
  }
  cancel(event: Event) {
    event.preventDefault();
    void this.close();
  }
  trapTab(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = Array.from(
      this.dialog.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((e) => e.getClientRects().length > 0);
    const first = items[0],
      last = items.at(-1),
      active = document.activeElement;
    if (
      first &&
      last &&
      ((event.shiftKey && active === first) || (!event.shiftKey && active === last))
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
  choose<K extends keyof TrainingPreferences>(key: K, value: TrainingPreferences[K]) {
    this.answers.update((p) => ({ ...p, [key]: value }));
    this.error.set('');
    this.persistDraft();
  }
  toggleEquipment(value: TrainingEquipment) {
    const current = this.answers().equipment ?? [];
    this.choose(
      'equipment',
      current.includes(value) ? current.filter((e) => e !== value) : [...current, value],
    );
  }
  equipmentPreset(gym: boolean) {
    this.choose(
      'equipment',
      gym ? ['dumbbells', 'bench', 'barbell', 'machines', 'cables', 'pullup'] : ['dumbbells'],
    );
  }
  toggleDay(day: number) {
    const current = this.answers().days ?? [];
    if (!current.includes(day) && current.length === 6) {
      this.error.set('Keep at least one day free from lifting. Choose up to six training days.');
      return;
    }
    this.choose(
      'days',
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }
  next() {
    if (!this.canContinue()) return;
    if (this.step() === 5) {
      const p = this.answers() as TrainingPreferences,
        blocker = trainingBlocker(p);
      if (blocker) {
        this.error.set(blocker);
        return;
      }
      this.plan.set(buildTrainingPlan(p, `tp_${crypto.randomUUID()}`));
      this.activeDay.set(0);
      this.saved.set(false);
      this.saveMessage.set('');
      this.step.set(6);
    } else this.step.update((s) => s + 1);
    this.error.set('');
    this.persistDraft();
    this.scrollTop();
  }
  back() {
    if (this.step() === 0) return;
    this.step.update((s) => (s === 6 ? 5 : s - 1));
    this.error.set('');
    this.swapIndex.set(null);
    this.persistDraft();
    this.scrollTop();
  }
  editPreferences() {
    if (this.saving()) return;
    this.answers.set({ ...this.plan()!.preferences });
    this.step.set(0);
    this.error.set('');
    this.saveMessage.set('');
    this.persistDraft();
    this.scrollTop();
  }
  selectDay(index: number) {
    this.activeDay.set(index);
    this.swapIndex.set(null);
    this.error.set('');
  }
  swap(index: number, id: string) {
    try {
      this.plan.set(swapTrainingMovement(this.plan()!, this.activeDay(), index, id));
      this.saved.set(false);
      this.saveMessage.set('');
      this.swapIndex.set(null);
      this.error.set('');
      this.persistDraft();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not change this exercise.');
    }
  }
  toggleSwap(index: number) {
    this.swapIndex.set(this.swapIndex() === index ? null : index);
    this.error.set('');
  }
  loadHint(exercise: TrainingExercise): { label: string; value: string } {
    const info = startingLoad(exercise, this.workouts.workouts(), localDateKey(new Date()));
    return {
      label: info.label,
      value:
        info.weight > 0
          ? `${displayWeight(info.weight, this.profile.units())} ${weightUnitLabel(this.profile.units())}`
          : 'Find your starting load',
    };
  }
  restLabel(seconds: number) {
    return seconds >= 60
      ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`
      : `${seconds} sec`;
  }
  weekLabel(day: number) {
    return WEEKDAYS[day].slice(0, 3);
  }
  dayForWeekday(weekday: number) {
    return this.plan()?.days.find((d) => d.weekday === weekday);
  }
  async save(): Promise<boolean> {
    const plan = this.plan(),
      owner = this.auth.currentUserId;
    if (!plan || this.saving()) return false;
    if (!owner) {
      this.error.set('Sign in to save this plan to your account.');
      return false;
    }
    this.saving.set(true);
    this.error.set('');
    this.saveMessage.set('');
    this.persistDraft();
    try {
      const records = trainingPlanWorkouts(
        plan,
        owner,
        this.workouts.workouts(),
        localDateKey(new Date()),
      );
      let local = false;
      for (const record of records) {
        if (this.destroyed || this.auth.currentUserId !== owner) return false;
        const existing = this.workouts
          .workouts()
          .find((w) => w.kind === 'routine' && w.clientId === record.clientId);
        let result: Workout;
        if (
          existing?.id &&
          existing.notes === record.notes &&
          JSON.stringify(existing.exercises) === JSON.stringify(record.exercises)
        )
          result = existing;
        else
          result = await firstValueFrom(
            existing?.id
              ? this.workouts.updateWorkout(existing.id, record)
              : this.workouts.addWorkout(record),
          );
        if (this.destroyed || this.auth.currentUserId !== owner) return false;
        if (!this.workouts.isDurablySaved(result))
          throw new Error(
            'Device storage and sync are unavailable. Keep this plan open and retry saving.',
          );
        local ||= !!result.id?.startsWith('w_') || !!result.pendingUpdate;
      }
      if (this.destroyed) return false;
      this.saved.set(true);
      this.saveMessage.set(
        local
          ? 'Saved on this device. Your routines sync when you reconnect.'
          : 'Saved to Workout → My training. Your plan is ready when you are.',
      );
      try {
        localStorage.removeItem(this.draftKey);
      } catch {
        /* Optional draft cache. */
      }
      return true;
    } catch (e) {
      this.error.set(
        (e instanceof Error ? e.message : 'Could not save the complete plan.') +
          ' Retry to finish saving; already saved days will not be duplicated.',
      );
      return false;
    } finally {
      if (!this.destroyed) this.saving.set(false);
    }
  }
  async startSelectedDay() {
    if (this.saving() || !this.plan()) return;
    if (!this.saved() && !(await this.save())) return;
    const clientId = `${this.plan()!.id}.${this.activeDay()}`;
    await this.close();
    if (!this.destroyed)
      await this.router.navigate(['/start-workout'], { queryParams: { routine: clientId } });
  }
  private scrollTop() {
    this.scrollBody.nativeElement.scrollTop = 0;
    setTimeout(() => {
      if (!this.destroyed && this.opened()) this.focusHeading();
    });
  }
  private focusHeading() {
    this.heading?.nativeElement.focus({ preventScroll: true });
  }
  private persistDraft() {
    try {
      const plan = this.plan();
      localStorage.setItem(
        this.draftKey,
        JSON.stringify({
          version: 1,
          answers: this.answers(),
          step: this.step(),
          records: plan
            ? trainingPlanWorkouts(plan, this.auth.currentUserId, [], localDateKey(new Date()))
            : [],
        }),
      );
    } catch {
      /* Saving actual routines reports durability separately. */
    }
  }
  private restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(this.draftKey) ?? 'null');
      if (draft?.version !== 1) return;
      const candidate = {
        goal: 'muscle',
        experience: 'new',
        equipment: [],
        days: [0, 2, 4],
        minutes: 45,
        focus: 'balanced',
        readiness: 'ready',
        ...draft.answers,
      };
      if (Array.isArray(candidate.days) && candidate.days.length === 0) candidate.days = [0, 2, 4];
      if (
        !validPreferences(candidate) ||
        !Number.isInteger(draft.step) ||
        draft.step < 0 ||
        draft.step > 6
      )
        return;
      const restored = Array.isArray(draft.records)
        ? savedTrainingPlans(draft.records)[0]?.plan
        : null;
      if (restored) {
        this.plan.set(restored);
        this.saved.set(false);
      }
      this.answers.set(draft.answers);
      this.step.set(draft.step === 6 && !restored ? 0 : draft.step);
    } catch {
      /* Ignore malformed or unavailable local drafts. */
    }
  }
}

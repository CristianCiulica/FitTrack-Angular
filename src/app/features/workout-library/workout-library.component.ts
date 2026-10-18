import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { WorkoutRoutine, orderRoutineExercises } from '../../core/models/workout-routine.model';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ProgramEnrollment,
  enrollmentWorkout,
  offsetDay,
  programDayIndex,
  validDayKey,
  readProgramEnrollment,
} from '../../core/utils/program-records';
import { localDateKey } from '../../core/utils/weight-progress';
import { GOAL_LABELS } from '../training-planner/training-planner.model';
import { savedTrainingPlans } from '../training-planner/training-plan-storage';
import {
  WorkoutProgram,
  PROGRAM_PHASES,
  programCalendar,
  programEnrollments,
  programRoutine,
  workoutPrograms,
} from './workout-programs';

@Component({
  selector: 'app-workout-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workout-library.component.html',
  styleUrls: ['./workout-library.component.scss', './workout-program-detail.scss'],
})
export class WorkoutLibraryComponent {
  readonly gymRoutines = input<WorkoutRoutine[]>([]);
  readonly homeRoutines = input<WorkoutRoutine[]>([]);
  readonly routines = input<WorkoutRoutine[]>([]);
  readonly personalRoutines = input<WorkoutRoutine[]>([]);
  @Input() deletingIds = new Set<string>();
  @Output() startRoutine = new EventEmitter<{ routine: WorkoutRoutine; key: string }>();
  @Output() createWorkout = new EventEmitter<void>();
  @Output() deleteRoutine = new EventEmitter<string>();
  @Output() openLegends = new EventEmitter<void>();
  @ViewChild('detailDialog') private dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('detailBody') private detailBody!: ElementRef<HTMLElement>;
  private readonly workouts = inject(WorkoutService);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  private destroyed = false;
  private opener: HTMLElement | null = null;
  private pendingEnrollment: ProgramEnrollment | null = null;
  readonly tab = signal<'discover' | 'mine' | 'sessions'>('discover');
  readonly goal = signal('all');
  readonly query = signal('');
  readonly page = signal(0);
  readonly minePage = signal(0);
  readonly savedPage = signal(0);
  readonly blockPage = signal(0);
  readonly goalLabels = GOAL_LABELS;
  readonly selectedProgram = signal<WorkoutProgram | null>(null);
  readonly selectedRoutine = signal<WorkoutRoutine | null>(null);
  readonly selectedSavedId = signal<string | null>(null);
  readonly selectedEnrollment = signal<ProgramEnrollment | null>(null);
  readonly selectedDay = signal(0);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly status = signal('');
  readonly today = signal(localDateKey());
  private readonly startRevision = signal(0);
  startDate = localDateKey();
  readonly phases = PROGRAM_PHASES;
  readonly programs = computed(() => workoutPrograms(this.gymRoutines(), this.homeRoutines()));
  readonly enrollments = computed(() =>
    programEnrollments(this.workouts.workouts()).filter((e) =>
      this.programs().some((p) => p.id === e.programId),
    ),
  );
  readonly activeEnrollment = computed(() => {
    const latest = this.enrollments()[0];
    return latest && !latest.stoppedAt ? latest : null;
  });
  readonly stopRequested = signal(false);
  readonly activeProgram = computed(
    () => this.programs().find((p) => p.id === this.activeEnrollment()?.programId) ?? null,
  );
  readonly filteredPrograms = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.programs().filter(
      (p) =>
        (this.goal() === 'all' || p.goal === this.goal()) &&
        (!q ||
          [p.title, p.eyebrow, p.description, p.level, p.equipment, ...p.highlights]
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
  });
  readonly filteredSessions = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.routines().filter(
      (r) =>
        !q ||
        [r.name, r.description, r.category, ...r.exercises.map((e) => e.name)]
          .join(' ')
          .toLowerCase()
          .includes(q),
    );
  });
  readonly visibleSessions = computed(() =>
    this.filteredSessions().slice(this.page() * 6, this.page() * 6 + 6),
  );
  readonly savedPlans = computed(() => savedTrainingPlans(this.workouts.workouts()));
  readonly filteredSaved = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.savedPlans().filter(
      ({ plan }) =>
        !q ||
        [
          plan.split,
          GOAL_LABELS[plan.preferences.goal],
          this.dateLabel(plan.createdAt.slice(0, 10)),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
    );
  });
  readonly visibleSaved = computed(() =>
    this.filteredSaved().slice(this.savedPage() * 6, this.savedPage() * 6 + 6),
  );
  readonly previousBlocks = computed(() =>
    this.enrollments().filter((e) => e.id !== this.activeEnrollment()?.id),
  );
  readonly visibleBlocks = computed(() =>
    this.previousBlocks().slice(this.blockPage() * 6, this.blockPage() * 6 + 6),
  );
  readonly customRoutines = computed(() =>
    this.personalRoutines().filter((r) => r.exercises.length > 0 && !r.clientId?.startsWith('tp_')),
  );
  readonly filteredCustom = computed(() =>
    this.customRoutines().filter((r) => r.name.toLowerCase().includes(this.query().toLowerCase())),
  );
  readonly visibleCustom = computed(() =>
    this.filteredCustom().slice(this.minePage() * 6, this.minePage() * 6 + 6),
  );
  readonly selectedSavedPlan = computed(
    () => this.savedPlans().find((item) => item.plan.id === this.selectedSavedId())?.plan ?? null,
  );
  readonly calendar = computed(() => {
    const p = this.selectedProgram();
    return p
      ? programCalendar(p, this.viewEnrollment(), this.workouts.workouts(), this.today())
      : [];
  });
  readonly currentDay = computed<ReturnType<typeof programCalendar>[number] | null>(
    () => this.calendar()[this.selectedDay()] ?? null,
  );
  readonly currentRoutine = computed(
    () => this.currentDay()?.day.routine ?? this.selectedRoutine(),
  );
  readonly completed = computed(
    () => this.calendar().filter((d) => d.day.type !== 'rest' && d.done).length,
  );
  readonly totalSessions = computed(
    () => this.calendar().filter((d) => d.day.type !== 'rest').length,
  );
  readonly activeSummary = computed(() => {
    const p = this.activeProgram(),
      e = this.activeEnrollment();
    if (!p || !e) return null;
    const calendar = programCalendar(p, e, this.workouts.workouts(), this.today()),
      done = calendar.filter((d) => d.day.type !== 'rest' && d.done).length,
      total = calendar.filter((d) => d.day.type !== 'rest').length;
    const next = calendar.find((d) => d.day.type !== 'rest' && !d.done);
    return {
      program: p,
      enrollment: e,
      done,
      total,
      next,
      day: Math.min(30, Math.max(1, programDayIndex(e.startDate, this.today()) + 1)),
      percent: total ? (done / total) * 100 : 0,
    };
  });
  readonly goals = [
    { id: 'all', label: 'All plans' },
    { id: 'muscle', label: 'Build muscle' },
    { id: 'fat-loss', label: 'Strength + cardio' },
    { id: 'busy', label: 'Short on time' },
    { id: 'glutes', label: 'Glute focus' },
    { id: 'home', label: 'At home' },
  ];
  constructor() {
    this.destroy.onDestroy(() => {
      this.destroyed = true;
      if (this.dialog?.nativeElement.open) this.dialog.nativeElement.close();
    });
  }
  setTab(tab: 'discover' | 'mine' | 'sessions') {
    this.tab.set(tab);
    this.query.set('');
    this.page.set(0);
    this.minePage.set(0);
    this.savedPage.set(0);
  }
  search(value: string) {
    this.query.set(value);
    this.page.set(0);
    this.minePage.set(0);
    this.savedPage.set(0);
  }
  showProgram(program: WorkoutProgram, enrollment?: ProgramEnrollment) {
    this.today.set(localDateKey());
    this.stopRequested.set(false);
    this.selectedProgram.set(program);
    this.selectedRoutine.set(null);
    this.selectedSavedId.set(null);
    const existing =
      enrollment ?? this.enrollments().find((e) => e.programId === program.id) ?? null;
    this.selectedEnrollment.set(existing);
    this.startDate = existing?.startDate ?? this.today();
    this.pendingEnrollment = null;
    this.error.set('');
    this.status.set('');
    const days = programCalendar(
      program,
      this.viewEnrollment(),
      this.workouts.workouts(),
      this.today(),
    );
    this.selectedDay.set(
      existing ? (days.find((d) => d.day.type !== 'rest' && !d.done)?.index ?? 0) : 0,
    );
    this.showDialog();
  }
  viewRoutine(routine: WorkoutRoutine) {
    this.selectedProgram.set(null);
    this.selectedSavedId.set(null);
    this.selectedRoutine.set({ ...routine, exercises: orderRoutineExercises(routine.exercises) });
    this.error.set('');
    this.status.set('');
    this.showDialog();
  }
  viewSavedPlan(id: string) {
    this.selectedProgram.set(null);
    this.selectedSavedId.set(id);
    this.chooseSavedDay(0);
    this.error.set('');
    this.status.set('');
    this.showDialog();
  }
  chooseSavedDay(index: number) {
    const id = this.selectedSavedId();
    const routine = this.personalRoutines().find((r) => r.clientId === `${id}.${index}`);
    this.selectedRoutine.set(
      routine ? { ...routine, exercises: orderRoutineExercises(routine.exercises) } : null,
    );
  }
  private showDialog() {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.nativeElement.showModal();
    this.detailBody.nativeElement.scrollTop = 0;
  }
  close() {
    if (this.saving()) return;
    this.stopRequested.set(false);
    this.dialog.nativeElement.close();
    this.opener?.focus({ preventScroll: true });
  }
  cancel(event: Event) {
    event.preventDefault();
    this.close();
  }
  viewEnrollment(): ProgramEnrollment {
    this.startRevision();
    return (
      this.selectedEnrollment() ?? {
        version: 1,
        id: 'pg_preview',
        programId: this.selectedProgram()?.id ?? 'preview',
        startDate: validDayKey(this.startDate) ? this.startDate : this.today(),
        createdAt: new Date().toISOString(),
      }
    );
  }
  updateStartDate(value: string) {
    this.startDate = value;
    this.startRevision.update((n) => n + 1);
    this.pendingEnrollment = null;
    this.today.set(localDateKey());
  }
  selectDay(index: number) {
    this.selectedDay.set(index);
    this.error.set('');
  }
  async enroll() {
    const program = this.selectedProgram(),
      uid = this.auth.currentUserId;
    if (!program || this.selectedEnrollment() || this.saving()) return;
    if (!uid) {
      this.error.set('Sign in before starting a plan.');
      return;
    }
    if (
      !validDayKey(this.startDate) ||
      this.startDate < this.today() ||
      this.startDate > offsetDay(this.today(), 365)
    ) {
      this.error.set('Choose a valid start date between today and the next year.');
      return;
    }
    this.pendingEnrollment ??= {
      version: 1,
      id: 'pg_' + crypto.randomUUID(),
      programId: program.id,
      startDate: validDayKey(this.startDate) ? this.startDate : this.today(),
      createdAt: new Date().toISOString(),
    };
    this.saving.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.workouts.addWorkout(enrollmentWorkout(this.pendingEnrollment, program.title, uid)),
      );
      if (this.destroyed || this.auth.currentUserId !== uid) return;
      if (!this.workouts.isDurablySaved(result))
        throw new Error('Storage and sync are unavailable. Keep this screen open and retry.');
      this.selectedEnrollment.set(this.pendingEnrollment);
      this.status.set(
        result.id?.startsWith('w_')
          ? 'Plan saved on this device. It syncs when you reconnect.'
          : 'Your 30-day plan is ready. Choose a day to get started.',
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not save the plan. Please retry.');
    } finally {
      if (!this.destroyed) this.saving.set(false);
    }
  }
  newBlock() {
    if (this.saving()) return;
    this.selectedEnrollment.set(null);
    this.updateStartDate(localDateKey());
    this.selectedDay.set(0);
    this.error.set('');
    this.status.set(
      'Your previous block stays in My training. Choose a start date for the next one.',
    );
  }
  startDay() {
    const p = this.selectedProgram(),
      e = this.selectedEnrollment(),
      day = this.currentDay();
    if (!p || !e || !day || day.future) return;
    if (e.stoppedAt || day.day.type === 'rest') return;
    const routine = programRoutine(p, day.index, e);
    this.close();
    this.startRoutine.emit({ routine, key: `${e.id}.${day.index}` });
  }
  requestStop(program: WorkoutProgram, enrollment: ProgramEnrollment) {
    this.showProgram(program, enrollment);
    this.stopRequested.set(true);
  }
  async stopPlan() {
    const enrollment = this.selectedEnrollment(),
      owner = this.auth.currentUserId;
    const workout = this.workouts
      .workouts()
      .find((w) => readProgramEnrollment(w)?.id === enrollment?.id);
    if (!enrollment || !workout?.id || !owner || this.saving() || enrollment.stoppedAt) return;
    const stopped = { ...enrollment, stoppedAt: new Date().toISOString() };
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = await firstValueFrom(
        this.workouts.updateWorkout(workout.id, {
          notes: enrollmentWorkout(stopped, this.selectedProgram()!.title, owner).notes,
        }),
      );
      if (this.destroyed || this.auth.currentUserId !== owner) return;
      if (!this.workouts.isDurablySaved(saved))
        throw new Error('Could not save the change. Keep this screen open and retry.');
      this.selectedEnrollment.set(stopped);
      this.stopRequested.set(false);
      this.status.set('Plan stopped. Your completed sessions and progress are kept.');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not stop this plan. Please retry.');
    } finally {
      if (!this.destroyed) this.saving.set(false);
    }
  }
  startSingle() {
    const routine = this.selectedRoutine();
    if (!routine) return;
    this.close();
    this.startRoutine.emit({
      routine,
      key: routine.id ? 'personal-' + routine.id : 'library-' + routine.name,
    });
  }
  minuteEstimate(routine: WorkoutRoutine) {
    return Math.round(
      (300 +
        routine.exercises.reduce(
          (sum, e) =>
            sum +
            e.sets * (e.repUnit === 'seconds' ? e.reps : e.reps * 3) +
            Math.max(0, e.sets - 1) * (e.restSeconds ?? 90) +
            60,
          0,
        )) /
        60,
    );
  }
  totalSets(routine: WorkoutRoutine) {
    return routine.exercises.reduce((sum, e) => sum + e.sets, 0);
  }
  currentWeek() {
    return Math.min(3, Math.floor(this.selectedDay() / 7));
  }
  changePage(direction: number) {
    this.page.update((p) => Math.max(0, p + direction));
  }
  changeMinePage(direction: number) {
    this.minePage.update((p) => Math.max(0, p + direction));
  }
  changeSavedPage(direction: number) {
    this.savedPage.update((p) => Math.max(0, p + direction));
  }
  changeBlockPage(direction: number) {
    this.blockPage.update((p) => Math.max(0, p + direction));
  }
  completionText() {
    const summary = this.activeSummary();
    return summary ? `${summary.done} of ${summary.total} sessions recorded` : '';
  }
  nextSession() {
    const next = this.activeSummary()?.next;
    return next ? next.day.title : 'Block complete';
  }
  dateLabel(value: string) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  trapTab(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = Array.from(
      this.dialog.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),a[href],summary',
      ),
    ).filter((e) => e.getClientRects().length);
    const first = items[0],
      last = items.at(-1);
    if (
      first &&
      last &&
      ((event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last))
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
}

import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { ProfileService } from '../../../core/services/profile.service';
import { Workout } from '../../../core/models/workout.model';
import { ProgramSessionContext } from '../../../core/models/workout-routine.model';
import {
  IndoorCardioRecord,
  indoorCardioWorkout,
  validIndoorCardio,
} from '../../../core/utils/indoor-cardio';

@Component({
  selector: 'app-indoor-cardio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './indoor-cardio.component.html',
  styleUrl: './indoor-cardio.component.scss',
})
export class IndoorCardioComponent {
  @Input() showLauncher = true;
  @Output() saved = new EventEmitter<Workout>();
  @ViewChild('dialog') private dialog!: ElementRef<HTMLDialogElement>;
  private readonly auth = inject(AuthService);
  private readonly workouts = inject(WorkoutService);
  private readonly profile = inject(ProfileService);
  private readonly destroy = inject(DestroyRef);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  mode: 'walking' | 'running' = 'walking';
  finishedAt = '';
  minutes: string | number | null = '';
  distance: string | number | null = '';
  incline: string | number | null = '';
  steps: string | number | null = '';
  calories: string | number | null = '';
  targetMinutes: number | null = null;
  private context?: ProgramSessionContext;
  private clientId = '';
  private owner = '';
  private opener: HTMLElement | null = null;
  private destroyed = false;
  get imperial() {
    return this.profile.units() === 'imperial';
  }
  get distanceUnit() {
    return this.imperial ? 'mi' : 'km';
  }
  constructor() {
    this.destroy.onDestroy(() => {
      this.destroyed = true;
      if (this.dialog?.nativeElement.open) this.dialog.nativeElement.close();
    });
  }
  open(context?: ProgramSessionContext, targetMinutes?: number) {
    if (this.dialog.nativeElement.open) return;
    this.context = context;
    this.targetMinutes = targetMinutes ?? null;
    this.owner = this.auth.currentUserId;
    this.clientId = 'indoor_' + crypto.randomUUID();
    this.mode = 'walking';
    this.minutes = '';
    this.distance = '';
    this.incline = '';
    this.steps = '';
    this.calories = '';
    this.error.set('');
    this.success.set('');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    this.finishedAt = now.toISOString().slice(0, 16);
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.nativeElement.showModal();
  }
  close() {
    if (this.saving()) return;
    this.dialog.nativeElement.close();
    this.opener?.focus({ preventScroll: true });
  }
  cancel(event: Event) {
    event.preventDefault();
    this.close();
  }
  private record(): IndoorCardioRecord | null {
    const minutes = Number(this.minutes),
      distance = Number(this.distance),
      end = new Date(this.finishedAt).getTime();
    if (
      this.minutes == null ||
      String(this.minutes).trim() === '' ||
      this.distance == null ||
      String(this.distance).trim() === '' ||
      !Number.isFinite(end) ||
      end > Date.now() + 60_000 ||
      minutes < 1 ||
      minutes > 240 ||
      !Number.isFinite(minutes) ||
      distance <= 0
    )
      return null;
    const optional = (value: string | number | null) =>
      value == null || String(value).trim() === '' ? null : Number(value);
    const result: IndoorCardioRecord = {
      version: 1,
      mode: this.mode,
      startedAt: new Date(end - minutes * 60_000).toISOString(),
      endedAt: new Date(end).toISOString(),
      distanceMeters: distance * (this.imperial ? 1609.344 : 1000),
      inclinePercent: optional(this.incline),
      steps: optional(this.steps),
      calories: optional(this.calories),
      ...(this.context ? { program: this.context } : {}),
    };
    return validIndoorCardio(result) ? result : null;
  }
  get canSave() {
    return !!this.record() && !this.saving() && !this.success();
  }
  async save() {
    const record = this.record();
    if (!record || this.saving() || this.success()) return;
    if (!this.owner || this.owner !== this.auth.currentUserId) {
      this.error.set('Sign in again before saving this session.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = await firstValueFrom(
        this.workouts.addWorkout(indoorCardioWorkout(record, this.owner, this.clientId)),
      );
      if (this.destroyed || this.owner !== this.auth.currentUserId) return;
      if (!this.workouts.isDurablySaved(saved))
        throw new Error('Storage is unavailable and sync failed. Keep this form open and retry.');
      this.success.set(
        saved.id?.startsWith('w_')
          ? 'Saved on this device. Syncs when you reconnect.'
          : 'Saved to Cardio history.',
      );
      this.saved.emit(saved);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'Could not save your treadmill session. Please retry.',
      );
    } finally {
      if (!this.destroyed) this.saving.set(false);
    }
  }
  trapTab(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = Array.from(
      this.dialog.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled])',
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

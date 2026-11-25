import { ConfirmationService } from '../../shared/components/confirmation';
import { routeForStorage } from '../../core/utils/route';
import { activityDateKey } from '../../core/utils/activity-calendar';
import { timedSession, TreadmillLog, estimateTreadmillCalories } from '../../core/utils/timed-cardio';
import { CardioHistorySession, indoorCardio, indoorHistorySession } from '../../core/utils/indoor-cardio';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { durationLabel } from '../../core/utils/workout-history';
import { isWorkoutSession } from '../../core/utils/workout-kind';
import { displayWeight, displayDistance, displaySpeed, distanceUnitLabel, weightUnitLabel } from '../../core/utils/units';
import { Component, DestroyRef, inject, OnInit, signal, computed, linkedSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutService } from '../../core/services/workout.service';
import { RunningSessionService } from '../../core/services/running-session.service';
import { AuthService } from '../../core/services/auth.service';
import { Workout } from '../../core/models/workout.model';
import { RunSplitsComponent } from '../../shared/components/run-splits/run-splits.component';
import { RouteMapComponent } from '../../shared/components/route-map/route-map.component';
import { RunningSession } from '../../core/models/running-session.model';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { NzMessageService } from 'ng-zorro-antd/message';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { ProfileService } from '../../core/services/profile.service';
import { workoutActivityCalories } from '../../core/utils/workout-calories';

type WorkoutSortColumn = 'name' | 'date' | 'exerciseCount' | 'primaryMuscle' | 'volume';
type SortDirection = 'ascend' | 'descend' | null;

// Draw collapsed routes without loading another tile map for every list item.
function routeThumbnail(run: RunningSession) {
  const points = routeForStorage(run.route, 48);
  if (!points.length) return null;
  const longitudeScale = Math.cos(points[0][0] * Math.PI / 180);
  const xs = points.map(point => point[1] * longitudeScale);
  const ys = points.map(point => -point[0]);
  const left = Math.min(...xs), top = Math.min(...ys);
  const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
  const scale = 36 / (Math.max(width, height) || 1);
  const coords = points.map((_, i) => ({
    x: 24 + (xs[i] - left - width / 2) * scale,
    y: 24 + (ys[i] - top - height / 2) * scale,
  }));
  return { line: coords.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '), end: coords[coords.length - 1] };
}

@Component({
  selector: 'app-workouts',
  standalone: true,
  imports: [
    RunSplitsComponent,
    CommonModule,
    NzIconModule,
    NzLayoutModule,
    WorkoutModalComponent,
    AppMenuComponent,
    RouteMapComponent,
  ],
  templateUrl: './workouts.component.html',
  styleUrls: ['./workouts.component.scss']
})
export class WorkoutsComponent implements OnInit {
  get distanceUnit() { return distanceUnitLabel(this.profileService.units()); }
  get weightUnit() { return weightUnitLabel(this.profileService.units()); }
  displayLoad(kg: number) { return displayWeight(kg, this.profileService.units()); }
  distanceValue(meters: number) { return displayDistance(meters, this.profileService.units()); }
  speedValue(kmh: number) { return displaySpeed(kmh, this.profileService.units()); }
  private readonly destroy = inject(DestroyRef);
  readonly durationLabel = durationLabel;
  workouts = signal<Workout[]>([]);
  private readonly outdoorSessions = signal<RunningSession[]>([]);
  readonly runningSessions = computed<CardioHistorySession[]>(() => [
    ...this.outdoorSessions(),
    ...this.workouts().map(indoorHistorySession).filter((session): session is CardioHistorySession => !!session),
  ].sort((a,b) => b.startedAt.localeCompare(a.startedAt)));
  sortColumn = signal<WorkoutSortColumn>('date');
  sortDirection = signal<SortDirection>('descend');
  modalVisible = signal(false);
  modalSaving = signal(false);
  editingWorkout = signal<Workout | null>(null);
  readonly sortOptions: { column: WorkoutSortColumn; direction: 'ascend' | 'descend'; label: string }[] = [
    { column: 'date', direction: 'descend', label: 'Newest first' }, { column: 'date', direction: 'ascend', label: 'Oldest first' },
    { column: 'name', direction: 'ascend', label: 'Name A–Z' }, { column: 'name', direction: 'descend', label: 'Name Z–A' },
    { column: 'exerciseCount', direction: 'descend', label: 'Most exercises' }, { column: 'exerciseCount', direction: 'ascend', label: 'Fewest exercises' },
    { column: 'volume', direction: 'descend', label: 'Highest volume' }, { column: 'volume', direction: 'ascend', label: 'Lowest volume' },
  ];
  readonly filters = ['All', 'Runs', 'Workouts'] as const;
  readonly filter = signal<(typeof this.filters)[number]>('All');
  private readonly timeline = computed(() => {
    const runs = this.filter() === 'Workouts' ? [] : this.runningSessions().map(run => ({
      key: 'run:' + (run.id ?? run.startedAt), date: run.startedAt, run, workout: null, thumbnail: routeThumbnail(run),
    }));
    const workouts = this.filter() === 'Runs' ? [] : this.filteredWorkouts().map(workout => ({
      key: 'workout:' + (workout.id ?? workout.date + workout.name), date: workout.date, run: null, workout, thumbnail: null,
    }));
    const entries = [...runs, ...workouts];
    if (this.filter() !== 'Workouts') entries.sort((a,b) => b.date.localeCompare(a.date));
    return entries;
  });
  readonly months = computed(() => {
    const entries = this.timeline();
    const groups = new Map<string, typeof entries>();
    for (const entry of entries) {
      const month = activityDateKey(entry.date)?.slice(0, 7) ?? '';
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(entry);
    }
    return Array.from(groups, ([month, entries]) => ({ month, entries })).sort((a,b) =>
      this.filter() === 'Workouts' && this.sortColumn() === 'date' && this.sortDirection() === 'ascend'
        ? a.month.localeCompare(b.month) : b.month.localeCompare(a.month));
  });
  readonly expanded = linkedSignal({
    source: () => ({ filter: this.filter(), first: this.months()[0]?.entries[0]?.key }),
    computation: (source, previous): Set<string> =>
      previous?.source.filter === source.filter && previous.source.first
        ? previous.value : new Set(source.first ? [source.first] : []),
  });
  toggleEntry(key: string): void {
    this.expanded.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  filteredWorkouts = computed(() => {
    let data = this.workouts().filter(w => isWorkoutSession(w) && !indoorCardio(w));

    const sc = this.sortColumn();
    const sd = this.sortDirection();
    if (sc && sd) {
      const multiplier = sd === 'ascend' ? 1 : -1;
      data.sort((a, b) => {
        const av = this.getSortValue(a, sc);
        const bv = this.getSortValue(b, sc);
        if (typeof av === 'string' && typeof bv === 'string') {
          return av.localeCompare(bv) * multiplier;
        }
        return (Number(av) - Number(bv)) * multiplier;
      });
    }

    return data;
  });



  sortWorkouts(index: number) {
    const option = this.sortOptions[index];
    this.sortColumn.set(option.column);
    this.sortDirection.set(option.direction);
  }

  getExerciseCount(workout: Workout): number {
    return (workout.exercises?.length ?? 0) + this.treadmillRecords(workout).length;
  }

  getPrimaryMuscle(workout: Workout): string {
    return workout.exercises?.[0]?.muscleGroup ?? (this.treadmillRecords(workout).length ? 'Cardio' : 'Mixed');
  }

  // greutatile reale pe seturi, ex. "60 / 62.5 / 65 kg"
  formatSetWeights(setWeights: number[]): string {
    return setWeights.map(weight => this.displayLoad(weight)).join(' / ') + ' ' + this.weightUnit;
  }

  // repetarile reale pe seturi, ex. "10 / 9 / 8 reps"
  formatSetReps(setReps: number[], repUnit?: 'seconds'): string {
    return setReps.join(' / ') + (repUnit === 'seconds' ? ' sec' : ' reps');
  }

  getWorkoutVolume(workout: Workout): number {
    return workout.exercises?.reduce((total, exercise) => {
      if (exercise.repUnit === 'seconds') return total;
      total += (exercise.dropSets ?? []).reduce((sum, d) => sum + d.weight * d.reps, 0);
      const weights = exercise.setWeights;
      const reps = exercise.setReps;
      // perechi reale reps×kg pe set, cand au fost logate amandoua
      if (weights?.length && reps?.length === weights.length) {
        return total + weights.reduce((s, w, i) => s + w * reps[i], 0);
      }
      if (weights?.length) {
        return total + exercise.reps * weights.reduce((s, w) => s + w, 0);
      }
      return total + exercise.sets * exercise.reps * exercise.weight;
    }, 0) ?? 0;
  }

  // estimare de calorii arse, pe baza greutatii din profil
  getWorkoutCalories(workout: Workout): number {
    return workoutActivityCalories(workout, this.profileService.weightKg());
  }

  treadmillRecords(workout: Workout): TreadmillLog[] { return timedSession(workout)?.treadmill ?? []; }
  treadmillEnergy(log: TreadmillLog): number { return estimateTreadmillCalories(log.seconds, log.weightKg); }

  // ritmul mediu, in stil alergare: min/km (ex. 5'32")
  formatPace(session: RunningSession): string {
    const km = this.distanceValue(session.distanceMeters);
    if (session.distanceMeters < 20 || km <= 0) return '–';
    const secPerKm = session.durationSeconds / km;
    if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '–';
    const rounded = Math.round(secPerKm);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
  }

  private getSortValue(workout: Workout, column: WorkoutSortColumn): string | number {
    switch (column) {
      case 'name':
        return workout.name.toLowerCase();
      case 'date': {
        const time = new Date(workout.date).getTime();
        return Number.isFinite(time) ? time : 0;
      }
      case 'exerciseCount':
        return this.getExerciseCount(workout);
      case 'primaryMuscle':
        return this.getPrimaryMuscle(workout).toLowerCase();
      case 'volume':
        return this.getWorkoutVolume(workout);
    }
  }

  constructor(
    private workoutService: WorkoutService,
    private runningSessionService: RunningSessionService,
    private authService: AuthService,
    private profileService: ProfileService,
    private message: NzMessageService,
    private modalService: ConfirmationService
  ) { }

  ngOnInit() {
    this.refreshWorkouts();
    this.runningSessionService.getSessions().pipe(takeUntilDestroyed(this.destroy)).subscribe((sessions) => {
      this.outdoorSessions.set(sessions);
    });
  }

  formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  refreshWorkouts() {
    this.workoutService.getWorkouts().pipe(takeUntilDestroyed(this.destroy)).subscribe((data) => this.workouts.set(data.filter(isWorkoutSession)));
  }

  openEdit(workout: Workout) {
    this.editingWorkout.set(workout);
    this.modalVisible.set(true);
  }

  onModalSave(workout: Partial<Workout>) {
    if (this.modalSaving()) return;
    const editing = this.editingWorkout();
    if (!editing?.id) return;
    this.modalSaving.set(true);
    this.workoutService.updateWorkout(editing.id, workout).subscribe({
      next: () => {
        this.modalSaving.set(false);
        this.modalVisible.set(false);
        this.message.success('Workout updated!');
        this.refreshWorkouts();
      },
      error: () => { this.modalSaving.set(false); this.message.error('Update failed.'); }
    });
  }

  onModalCancel() {
    this.modalVisible.set(false);
  }

  confirmDeleteRunningSession(id: string): void {
    this.modalService.confirm({
      nzTitle: 'Delete this session?', nzContent: 'This recorded activity will be removed from your history.',
      nzCancelText: 'Keep session', nzOkText: 'Delete session', nzOkDanger: true,
      nzOnOk: () => this.deleteRunningSession(id),
    });
  }

  deleteWorkout(id: string) {
    this.modalService.confirm({
      nzTitle: 'Delete workout?',
      nzContent: 'Are you sure you want to delete this workout?',
      nzOkText: 'Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => {
        this.workoutService.deleteWorkout(id).subscribe({
          next: () => {
            this.message.success('Workout deleted!');
            this.refreshWorkouts();
          },
          error: () => this.message.error('Delete failed.')
        });
      }
    });
  }

  deleteRunningSession(id: string) {
    if (!id) return;
    if (id.startsWith('indoor:')) {
      this.workoutService.deleteWorkout(id.slice(7)).subscribe({
        next: () => { this.message.success('Treadmill session deleted.'); this.refreshWorkouts(); },
        error: () => this.message.error('Delete failed.'),
      });
      return;
    }
    this.runningSessionService.deleteSession(id).subscribe({
      next: () => {
        this.message.success('Running session deleted!');
        this.runningSessionService.getSessions().pipe(takeUntilDestroyed(this.destroy)).subscribe((sessions) => {
          this.outdoorSessions.set(sessions);
        });
      },
      error: () => this.message.error('Delete failed.')
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }

}

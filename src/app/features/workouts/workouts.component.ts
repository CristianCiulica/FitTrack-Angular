import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../core/services/workout.service';
import { RunningSessionService } from '../../core/services/running-session.service';
import { AuthService } from '../../core/services/auth.service';
import { Workout } from '../../core/models/workout.model';
import { RunningSession } from '../../core/models/running-session.model';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { RouterLinkActive } from '@angular/router';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';
import { ProfileService } from '../../core/services/profile.service';
import { estimateSessionCalories } from '../../core/utils/workout-calories';
import { CommunityService } from '../../core/services/community.service';

type WorkoutSortColumn = 'name' | 'date' | 'exerciseCount' | 'primaryMuscle' | 'volume';
type SortDirection = 'ascend' | 'descend' | null;

@Component({
  selector: 'app-workouts',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzPopconfirmModule,
    NzLayoutModule,
    NzMenuModule,
    NzModalModule,
    WorkoutModalComponent,
    AppMenuComponent,
  ],
  templateUrl: './workouts.component.html',
  styleUrls: ['./workouts.component.scss']
})
export class WorkoutsComponent implements OnInit {
  workouts = signal<Workout[]>([]);
  runningSessions = signal<RunningSession[]>([]);
  sortColumn = signal<WorkoutSortColumn>('date');
  sortDirection = signal<SortDirection>('descend');
  modalVisible = signal(false);
  editingWorkout = signal<Workout | null>(null);
  cardioHistoryOpen = signal(true);
  workoutHistoryOpen = signal(true);
  readonly hideTableNoResult: string | undefined = undefined;
  expandSet = new Set<string>();
  publishingIds = signal<Set<string>>(new Set());

  filteredWorkouts = computed(() => {
    let data = [...this.workouts()];

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

  //sortare pe fiecare coloana
  onSortOrderChange(column: WorkoutSortColumn, direction: string | null) {
    this.sortColumn.set(column);
    this.sortDirection.set(
      direction === 'ascend' || direction === 'descend' ? direction : null,
    );
  }

  getExerciseCount(workout: Workout): number {
    return workout.exercises?.length ?? 0;
  }

  getPrimaryMuscle(workout: Workout): string {
    return workout.exercises?.[0]?.muscleGroup ?? 'Mixed';
  }

  // ton de culoare distinct pentru fiecare grupa musculara, in loc de tag-ul gri implicit
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

  muscleTone(muscleGroup: string): string {
    return this.muscleTones[muscleGroup] ?? 'graphite';
  }

  // greutatile reale pe seturi, ex. "60 / 62.5 / 65 kg"
  formatSetWeights(setWeights: number[]): string {
    return setWeights.join(' / ') + ' kg';
  }

  getWorkoutVolume(workout: Workout): number {
    return workout.exercises?.reduce(
      (total, exercise) =>
        total +
        (exercise.setWeights?.length
          ? exercise.reps * exercise.setWeights.reduce((s, w) => s + w, 0)
          : exercise.sets * exercise.reps * exercise.weight),
      0,
    ) ?? 0;
  }

  // estimare de calorii arse, pe baza greutatii din profil
  getWorkoutCalories(workout: Workout): number {
    return estimateSessionCalories(workout.exercises, this.profileService.weightKg());
  }

  // proiecteaza traseul GPS in coordonate SVG (viewBox W x H), pastrand proportiile
  private projectRoute(session: RunningSession, W: number, H: number, pad: number): { x: number; y: number }[] | null {
    const route = session.route;
    if (!route || route.length < 2) return null;

    const lats = route.map((p) => p[0]);
    const lngs = route.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 1e-5);
    const spanLng = Math.max(maxLng - minLng, 1e-5);

    const scale = Math.min((W - pad * 2) / spanLng, (H - pad * 2) / spanLat);
    const offsetX = (W - spanLng * scale) / 2;
    const offsetY = (H - spanLat * scale) / 2;

    return route.map((p) => ({
      x: offsetX + (p[1] - minLng) * scale,
      y: H - (offsetY + (p[0] - minLat) * scale),
    }));
  }

  // path-ul SVG al traseului, in viewBox 100x56
  routePath(session: RunningSession): string | null {
    const pts = this.projectRoute(session, 100, 56, 6);
    if (!pts) return null;
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  // punctele de start/finish pentru bulinele de pe traseu
  routeStart(session: RunningSession): { x: number; y: number } | null {
    const pts = this.projectRoute(session, 100, 56, 6);
    return pts ? pts[0] : null;
  }

  routeEnd(session: RunningSession): { x: number; y: number } | null {
    const pts = this.projectRoute(session, 100, 56, 6);
    return pts ? pts[pts.length - 1] : null;
  }

  // ritmul mediu, in stil alergare: min/km (ex. 5'32")
  formatPace(session: RunningSession): string {
    const km = session.distanceMeters / 1000;
    if (km <= 0) return '–';
    const secPerKm = session.durationSeconds / km;
    if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '–';
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.round(secPerKm % 60);
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
  }

  // expandarea cardurilor de alergare din History
  readonly expandedRuns = signal<Set<string>>(new Set());

  toggleRun(id: string): void {
    this.expandedRuns.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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

  toggleCardioHistory() {
    this.cardioHistoryOpen.update((isOpen) => !isOpen);
  }

  toggleWorkoutHistory() {
    this.workoutHistoryOpen.update((isOpen) => !isOpen);
  }

  onExpandChange(id: string, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
    }
  }

  constructor(
    private workoutService: WorkoutService,
    private runningSessionService: RunningSessionService,
    private authService: AuthService,
    private profileService: ProfileService,
    private message: NzMessageService,
    private modalService: NzModalService,
    private communityService: CommunityService
  ) { }

  ngOnInit() {
    this.refreshWorkouts();
    this.runningSessionService.getSessions().subscribe((sessions) => {
      this.runningSessions.set(sessions);
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

  private refreshWorkouts() {
    this.workoutService.getWorkouts().subscribe((data) => this.workouts.set(data));
  }

  openEdit(workout: Workout) {
    this.editingWorkout.set(workout);
    this.modalVisible.set(true);
  }

  onModalSave(workout: Partial<Workout>) {
    const editing = this.editingWorkout();
    if (!editing?.id) return;
    this.workoutService.updateWorkout(editing.id, workout).subscribe({
      next: () => {
        this.message.success('Workout updated!');
        this.refreshWorkouts();
      },
      error: () => this.message.error('Update failed.')
    });
    this.modalVisible.set(false);
  }

  onModalCancel() {
    this.modalVisible.set(false);
  }

  deleteWorkout(id: string) {
    this.modalService.confirm({
      nzTitle: 'Delete workout?',
      nzContent: 'Are you sure you want to delete this workout?',
      nzOkText: 'Delete',
      nzOkType: 'primary',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzCentered: true,
      nzWidth: 320,
      nzClassName: 'solid-modal',
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

  logout() {
    this.authService.logout().subscribe();
  }

  shareToCommunity(workout: Workout) {
    this.publishingIds.update(set => new Set(set).add(workout.id!));
    this.communityService.publishWorkout({
      originalWorkoutId: workout.id,
      name: workout.name,
      description: workout.notes || '',
      exercises: workout.exercises
    }).subscribe({
      next: () => {
        this.message.success('Workout shared to community!');
        this.publishingIds.update(set => {
          const newSet = new Set(set);
          newSet.delete(workout.id!);
          return newSet;
        });
      },
      error: () => {
        this.message.error('Failed to share workout.');
        this.publishingIds.update(set => {
          const newSet = new Set(set);
          newSet.delete(workout.id!);
          return newSet;
        });
      }
    });
  }
}

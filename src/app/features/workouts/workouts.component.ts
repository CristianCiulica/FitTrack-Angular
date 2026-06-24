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
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { RouterLinkActive } from '@angular/router';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';

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
    NzTagModule,
    NzPopconfirmModule,
    NzLayoutModule,
    NzMenuModule,
    WorkoutModalComponent,
  ],
  templateUrl: './workouts.component.html',
  styleUrls: ['./workouts.component.scss']
})
export class WorkoutsComponent implements OnInit {
  workouts = signal<Workout[]>([]);
  runningSessions = signal<RunningSession[]>([]);
  sortColumn = signal<WorkoutSortColumn>('date');
  sortDirection = signal<SortDirection>('descend');
  searchQuery = signal<string>('');
  modalVisible = signal(false);
  editingWorkout = signal<Workout | null>(null);
  cardioHistoryOpen = signal(true);
  workoutHistoryOpen = signal(true);
  readonly hideTableNoResult: any = null;
  expandSet = new Set<string>();

  filteredWorkouts = computed(() => {
    let data = [...this.workouts()];
    const query = this.searchQuery().trim().toLowerCase();

    if (query) {
      data = data.filter(w =>
        (w.name && w.name.toLowerCase().includes(query)) ||
        (w.date && w.date.toLowerCase().includes(query)) ||
        String(this.getWorkoutVolume(w)).includes(query) ||
        (w.exercises && w.exercises.some(e => e.muscleGroup && e.muscleGroup.toLowerCase().includes(query))) ||
        (w.exercises && w.exercises.some(e => e.exerciseName && e.exerciseName.toLowerCase().includes(query)))
      );
    }

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

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.searchQuery.set(value);
  }

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

  getWorkoutVolume(workout: Workout): number {
    return workout.exercises?.reduce(
      (total, exercise) => total + exercise.sets * exercise.reps * exercise.weight,
      0,
    ) ?? 0;
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
    private message: NzMessageService
  ) { }

  ngOnInit() {
    this.refreshWorkouts();
    this.runningSessions.set(
      this.runningSessionService.getSessions(this.authService.currentUserId),
    );
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
    this.workoutService.getWorkouts().subscribe(data => {
      this.workouts.set(data);
      this.workoutService.workouts.set(data);
      this.workoutService.totalWorkouts.set(data.length);
    });
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
    this.workoutService.deleteWorkout(id).subscribe({
      next: () => {
        this.message.success('Workout deleted!');
        this.refreshWorkouts();
      },
      error: () => this.message.error('Delete failed.')
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }
}

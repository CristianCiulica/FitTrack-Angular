import { Component, OnInit, signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';
import { Workout, MUSCLE_GROUPS, MuscleGroup } from '../../core/models/workout.model';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { RouterLinkActive } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { WorkoutModalComponent } from '../../shared/components/workout-modal/workout-modal.component';

@Component({
  selector: 'app-workouts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
    NzPopconfirmModule,
    NzLayoutModule,
    NzMenuModule,
    NzDropDownModule,
    NzAvatarModule,
    WorkoutModalComponent,
  ],
  templateUrl: './workouts.component.html',
  styleUrls: ['./workouts.component.scss']
})
export class WorkoutsComponent implements OnInit {
  workouts = signal<Workout[]>([]);
  searchText = signal('');
  filterMuscle = signal<MuscleGroup | ''>('');
  sortColumn = signal<string>('date');
  sortDirection = signal<'ascend' | 'descend' | null>('descend');
  isCollapsed = false;
  modalVisible = signal(false);
  editingWorkout = signal<Workout | null>(null);
  muscleGroups = MUSCLE_GROUPS;
  readonly hideTableNoResult: any = null;
  expandSet = new Set<string>();

  filteredWorkouts = computed(() => {
    let data = [...this.workouts()];
    const search = this.searchText().toLowerCase();
    if (search) {
      data = data.filter(w =>
        w.name.toLowerCase().includes(search) ||
        w.exercises?.some(ex => ex.exerciseName.toLowerCase().includes(search))
      );
    }
    if (this.filterMuscle()) {
      data = data.filter(w => w.exercises?.some(ex => ex.muscleGroup === this.filterMuscle()));
    }
    // Apply sorting
    const sc = this.sortColumn();
    const sd = this.sortDirection();
    if (sc && sd) {
      const multiplier = sd === 'ascend' ? 1 : -1;
      data.sort((a, b) => {
        let av: any = (a as any)[sc];
        let bv: any = (b as any)[sc];
        if (sc === 'date') {
          av = new Date(av).getTime();
          bv = new Date(bv).getTime();
        }
        if (typeof av === 'string' && typeof bv === 'string') {
          return av.localeCompare(bv) * multiplier;
        }
        return ((av ?? 0) - (bv ?? 0)) * multiplier;
      });
    }

    return data;
  });

  onSortOrderChange(column: string, direction: string | null) {
    this.sortColumn.set(column);
    this.sortDirection.set(direction as 'ascend' | 'descend' | null);
  }

  onExpandChange(id: string, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
    }
  }

  userName = computed(() => {
    const u = this.authService.currentUser();
    return u?.displayName ?? u?.email ?? 'Athlete';
  });

  muscleColors: Record<string, string> = {
    'Chest': 'red', 'Back': 'blue', 'Shoulders': 'orange',
    'Arms': 'purple', 'Legs': 'green', 'Core': 'cyan',
    'Cardio': 'magenta', 'Full Body': 'gold'
  };

  constructor(
    private workoutService: WorkoutService,
    private authService: AuthService,
    private exportService: ExportService,
    private message: NzMessageService
  ) { }

  ngOnInit() {
    this.refreshWorkouts();
  }

  private refreshWorkouts() {
    this.workoutService.getWorkouts().subscribe(data => {
      this.workouts.set(data);
      this.workoutService.workouts.set(data);
      this.workoutService.totalWorkouts.set(data.length);
    });
  }

  openAdd() {
    this.editingWorkout.set(null);
    this.modalVisible.set(true);
  }

  openEdit(workout: Workout) {
    this.editingWorkout.set(workout);
    this.modalVisible.set(true);
  }

  onModalSave(workout: Partial<Workout>) {
    const editing = this.editingWorkout();
    if (editing?.id) {
      this.workoutService.updateWorkout(editing.id, workout).subscribe({
        next: () => {
          this.message.success('Workout actualizat!');
          this.refreshWorkouts();
        },
        error: () => this.message.error('Eroare la actualizare.')
      });
    } else {
      const full: Omit<Workout, 'id'> = {
        userId: this.authService.currentUserId,
        name: workout.name || 'Sesțiune nouă',
        date: workout.date!,
        notes: workout.notes ?? '',
        exercises: workout.exercises || [],
      };
      this.workoutService.addWorkout(full).subscribe({
        next: () => {
          this.message.success('Workout adăugat!');
          this.refreshWorkouts();
        },
        error: () => this.message.error('Eroare la adăugare.')
      });
    }
    this.modalVisible.set(false);
  }

  onModalCancel() {
    this.modalVisible.set(false);
  }

  deleteWorkout(id: string) {
    this.workoutService.deleteWorkout(id).subscribe({
      next: () => {
        this.message.success('Workout șters!');
        this.refreshWorkouts();
      },
      error: () => this.message.error('Eroare la ștergere.')
    });
  }

  exportPDF() {
    this.exportService.exportToPDF(this.filteredWorkouts());
  }

  exportExcel() {
    this.exportService.exportToExcel(this.filteredWorkouts());
  }

  logout() {
    this.authService.logout().subscribe();
  }
}

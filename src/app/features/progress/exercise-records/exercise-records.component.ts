import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutService } from '../../../core/services/workout.service';
import { ProfileService } from '../../../core/services/profile.service';
import { exerciseRecords } from '../../../core/utils/exercise-records';
import { displayWeight, weightUnitLabel } from '../../../core/utils/units';

@Component({
  selector: 'app-exercise-records',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exercise-records.component.html',
  styleUrl: './exercise-records.component.scss',
})
export class ExerciseRecordsComponent {
  private readonly workouts = inject(WorkoutService);
  private readonly profile = inject(ProfileService);
  readonly expanded = signal(new Set<string>());
  toggleHistory(key: string, open: boolean) {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }
  readonly loading = input(false);
  readonly search = signal('');
  readonly records = computed(() => exerciseRecords(this.workouts.workouts()));
  readonly filtered = computed(() =>
    this.records().filter((r) => r.name.toLowerCase().includes(this.search().trim().toLowerCase())),
  );
  readonly unit = computed(() => weightUnitLabel(this.profile.units()));
  load(kg: number) {
    return displayWeight(kg, this.profile.units());
  }
}

import { Component, effect, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { Workout, MUSCLE_GROUPS } from '../../../core/models/workout.model';

@Component({
  selector: 'app-workout-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzSelectModule,
    NzInputNumberModule,
  ],
  templateUrl: './workout-modal.component.html',
  styleUrls: ['./workout-modal.component.scss']
})
export class WorkoutModalComponent {
  visible = input(false);
  workout = input<Workout | null>(null);
  save = output<Partial<Workout>>();
  cancel = output<void>();

  form: FormGroup;
  muscleGroups = MUSCLE_GROUPS;

  get isEdit() { return !!this.workout(); }
  get title() { return this.isEdit ? 'Edit workout' : 'Add new workout'; }
  get exercises() { return this.form.get('exercises') as FormArray; }

  constructor(private fb: FormBuilder) {
    this.form = this.buildForm();
    effect(() => {
      if (this.visible()) {
        this.resetForm(this.workout());
      }
    });
  }

  private resetForm(workout: Workout | null) {
    this.form = this.buildForm();
    if (!workout) return;

    this.form.patchValue({
      name: workout.name
    });
    this.exercises.clear();
    if (workout.exercises && workout.exercises.length) {
      workout.exercises.forEach(ex => this.addExercise(ex));
    } else {
      this.addExercise();
    }
  }

  buildForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      exercises: this.fb.array([this.createExerciseGroup()])
    });
  }

  createExerciseGroup(ex?: any): FormGroup {
    return this.fb.group({
      exerciseName: [ex?.exerciseName || '', [Validators.required, Validators.minLength(2)]],
      muscleGroup: [ex?.muscleGroup || null, Validators.required],
      sets: [ex?.sets || 3, [Validators.required, Validators.min(1)]],
      reps: [ex?.reps || 10, [Validators.required, Validators.min(1)]],
      weight: [ex?.weight || 0, [Validators.required, Validators.min(0)]]
    });
  }

  addExercise(ex?: any) {
    this.exercises.push(this.createExerciseGroup(ex));
  }

  removeExercise(index: number) {
    if (this.exercises.length > 1) {
      this.exercises.removeAt(index);
    }
  }

  submit() {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach(c => c.markAsDirty());
      return;
    }
    this.save.emit(this.form.value);
  }

  onCancel() {
    this.cancel.emit();
  }
}

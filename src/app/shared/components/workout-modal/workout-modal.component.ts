import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { Workout, ExerciseLog, MUSCLE_GROUPS } from '../../../core/models/workout.model';

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
export class WorkoutModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() saving = false;
  @Input() workout: Workout | null = null;
  @Output() save = new EventEmitter<Partial<Workout>>();
  @Output() cancel = new EventEmitter<void>();

  private originalExercises = new WeakMap<AbstractControl, Partial<ExerciseLog>>();
  form: FormGroup;
  muscleGroups = MUSCLE_GROUPS;

  get isEdit() { return !!this.workout; }
  get title() { return this.isEdit ? 'Edit workout' : 'Add new workout'; }
  get subtitle() {
    return this.isEdit
      ? 'Update the details of your session.'
      : 'Build a custom session from scratch.';
  }
  get exercises() { return this.form.get('exercises') as FormArray; }

  get filledExercises(): number {
    return this.exercises.controls.filter(
      (c) => (c.get('exerciseName')?.value || '').trim().length > 0,
    ).length;
  }
  // greutatea se stabileste in timpul antrenamentului, asa ca sumarul din footer
  // arata volumul de lucru (seturi), nu tonajul
  get totalSets(): number {
    return this.exercises.controls.reduce(
      (acc, c) => acc + (Number(c.get('sets')?.value) || 0),
      0,
    );
  }

  // eroare vizibila doar dupa ce utilizatorul a atins campul
  showError(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  constructor(private fb: FormBuilder) {
    this.form = this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && this.visible) {
      this.originalExercises = new WeakMap();
      this.form = this.buildForm();
      if (this.workout) {
        this.form.patchValue({
          name: this.workout.name
        });
        this.exercises.clear();
        if (this.workout.exercises && this.workout.exercises.length) {
          this.workout.exercises.forEach(ex => this.addExercise(ex));
        } else {
          this.addExercise();
        }
      }
    }
  }

  buildForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120), Validators.pattern(/.*\S.*/)]],
      exercises: this.fb.array([this.createExerciseGroup()])
    });
  }

  createExerciseGroup(ex?: Partial<ExerciseLog>): FormGroup {
    const group = this.fb.group({
      exerciseName: [ex?.exerciseName || '', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      muscleGroup: [ex?.muscleGroup || null, Validators.required],
      sets: [ex?.sets ?? 3, [Validators.required, Validators.min(1), Validators.max(50), Validators.pattern(/^\d+$/)]],
      reps: [ex?.reps ?? 10, [Validators.required, Validators.min(0), Validators.max(500), Validators.pattern(/^\d+$/)]],
      weight: [ex?.weight ?? 0, [Validators.required, Validators.min(0), Validators.max(1000)]]
    });
    if (ex) this.originalExercises.set(group, ex);
    return group;
  }

  addExercise(ex?: Partial<ExerciseLog>) {
    if (this.exercises.length >= 50) return;
    this.exercises.push(this.createExerciseGroup(ex));
  }

  removeExercise(index: number) {
    if (this.exercises.length > 1) {
      this.exercises.removeAt(index);
    }
  }

  submit() {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit({
      name: this.form.value.name.trim(),
      exercises: this.exercises.controls.map(control => {
        const value = control.value as ExerciseLog;
        const original = this.originalExercises.get(control);
        // Renaming a workout/exercise must not erase the individual sets.
        // A changed set count or rep target explicitly replaces those metrics.
        const sameCount = original?.sets === value.sets;
        return {
          ...value, exerciseName: value.exerciseName.trim(),
          ...(original?.repUnit ? { repUnit: original.repUnit } : {}),
          ...(sameCount && original?.setWeights ? { setWeights: [...original.setWeights] } : {}),
          ...(sameCount && original?.setReps ? {
            setReps: original.reps === value.reps ? [...original.setReps] : Array(value.sets).fill(value.reps),
          } : {}),
        };
      }),
    });
  }

  onCancel() {
    if (this.saving) return;
    this.cancel.emit();
  }
}

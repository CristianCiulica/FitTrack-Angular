import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
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
    NzSelectModule,
    NzInputNumberModule,
    NzDatePickerModule,
  ],
  templateUrl: './workout-modal.component.html',
  styleUrls: ['./workout-modal.component.scss']
})
export class WorkoutModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() workout: Workout | null = null;
  @Output() save = new EventEmitter<Partial<Workout>>();
  @Output() cancel = new EventEmitter<void>();

  form: FormGroup;
  muscleGroups = MUSCLE_GROUPS;

  get isEdit() { return !!this.workout; }
  get title() { return this.isEdit ? 'Editează workout' : 'Adaugă workout nou'; }

  constructor(private fb: FormBuilder) {
    this.form = this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && this.visible) {
      this.form = this.buildForm();
      if (this.workout) {
        this.form.patchValue(this.workout);
      }
    }
  }

  buildForm(): FormGroup {
    return this.fb.group({
      exerciseName: ['', [Validators.required, Validators.minLength(2)]],
      muscleGroup: [null, Validators.required],
      sets: [3, [Validators.required, Validators.min(1)]],
      reps: [10, [Validators.required, Validators.min(1)]],
      weight: [0, [Validators.required, Validators.min(0)]],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      notes: [''],
    });
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

import { FormBuilder } from '@angular/forms';
import { SimpleChange } from '@angular/core';
import { WorkoutModalComponent } from './workout-modal.component';

describe('Editing recorded workouts', () => {
  it('preserves individual sets when renaming and removing another exercise', () => {
    const component = new WorkoutModalComponent(new FormBuilder());
    component.workout = { userId: 'test', name: 'Workout', date: '2026-10-01', exercises: [
      { exerciseName: 'Row', muscleGroup: 'Back', sets: 1, reps: 10, weight: 40 },
      { exerciseName: 'Press', muscleGroup: 'Chest', sets: 2, reps: 10, weight: 65, setWeights: [60,65], setReps: [10,8] },
    ] };
    component.visible = true;
    component.ngOnChanges({ visible: new SimpleChange(false, true, false) });
    component.form.patchValue({ name: 'Renamed workout' });
    component.removeExercise(0);
    let saved: any;
    component.save.subscribe(value => saved = value);
    component.submit();
    expect(saved.exercises[0].setWeights).toEqual([60,65]);
    expect(saved.exercises[0].setReps).toEqual([10,8]);
  });
});

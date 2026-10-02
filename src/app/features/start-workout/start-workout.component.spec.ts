import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { StartWorkoutComponent } from './start-workout.component';

describe('Workout session recovery', () => {
  let component: StartWorkoutComponent;
  let save: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    save = vi.fn(() => of({ id: 'saved' }));
    component = new StartWorkoutComponent(
      { currentUserId: 'test' } as any,
      { getWorkouts: () => of([]), addWorkout: save } as any,
      { weightKg: () => 75 } as any,
      { success: vi.fn(), error: vi.fn(), warning: vi.fn() } as any,
      { queryParams: of({}) } as any,
      { confirm: vi.fn() } as any,
    );
    component.selectRoutine({ name: 'Two exercises', exercises: [
      { name: 'Press', sets: 2, reps: 10, weight: 50, muscleGroup: 'Chest' },
      { name: 'Row', sets: 1, reps: 8, weight: 40, muscleGroup: 'Back' },
    ] }, 'test');
    component.startWorkout();
  });
  afterEach(() => { component.ngOnDestroy(); vi.useRealTimers(); });

  it('normalizes legacy fractional set counts before allocating session slots', () => {
    component.selectRoutine({ name: 'Legacy', exercises: [{ name: 'Press', sets: 2.5, reps: 10, weight: 50, muscleGroup: 'Chest' }] }, 'legacy');
    expect(() => component.startWorkout()).not.toThrow();
    expect(component.totalSets()).toBe(2);
  });

  it('returns to a skipped set and crosses exercise boundaries', () => {
    component.skipSet();
    component.skipSet();
    expect(component.currentExerciseIndex()).toBe(1);
    component.previousSet();
    expect(component.currentExerciseIndex()).toBe(0);
    expect(component.currentSetIndex()).toBe(2);
    component.previousSet();
    expect(component.currentSetIndex()).toBe(1);
    expect(component.completedSets()).toBe(0);
  });

  it('edits a completed set without counting it twice or losing later sets', () => {
    component.finishSet(); component.skipRest();
    component.currentWeight.set(55); component.finishSet(); component.skipRest();
    component.previousSet();
    expect(component.currentWeight()).toBe(55);
    component.currentWeight.set(60); component.finishSet(); component.skipRest();
    component.finishSet(); component.skipRest();
    expect(component.state()).toBe('review');
    expect(component.completedSets()).toBe(3);
    component.finishWorkout();
    const saved = save.mock.calls[0][0];
    expect(saved.exercises[0].setWeights).toEqual([50, 60]);
    expect(saved.exercises[0].setReps).toEqual([10, 10]);
    expect(component.finishedVolume()).toBe(1420);
    component.finishWorkout();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('returns from rest to the same set and cancels the rest timer', () => {
    component.finishSet(); component.previousSet();
    expect(component.currentSetIndex()).toBe(1);
    vi.advanceTimersByTime(65000);
    expect(component.state()).toBe('active');
    expect(component.currentSetIndex()).toBe(1);
  });

  it('lets the final skipped set be recovered before saving', () => {
    component.skipSet(); component.skipSet(); component.skipSet();
    expect(component.state()).toBe('review');
    component.finishWorkout();
    expect(save).not.toHaveBeenCalled();
    component.previousSet();
    expect(component.currentExerciseIndex()).toBe(1);
    component.finishSet(); component.skipRest(); component.finishWorkout();
    expect(save.mock.calls[0][0].exercises).toHaveLength(1);
    expect(save.mock.calls[0][0].exercises[0].exerciseName).toBe('Row');
  });

  it('does not mark skipped sets completed or include them in saved volume', () => {
    component.skipSet(); component.currentWeight.set(60); component.finishSet(); component.skipRest(); component.skipSet();
    expect(component.progressPercent()).toBe(33);
    component.finishWorkout();
    expect(component.finishedVolume()).toBe(600);
    expect(save.mock.calls[0][0].exercises[0].sets).toBe(1);
  });

  it('stays in review and permits retry when saving fails', () => {
    save.mockImplementation(() => throwError(() => new Error('Offline')));
    component.finishSet(); component.skipRest(); component.skipSet(); component.skipSet(); component.finishWorkout();
    expect(component.state()).toBe('review');
    expect(component.saving()).toBe(false);
    expect(component.canLeaveWorkout()).toBe(false);
  });
});

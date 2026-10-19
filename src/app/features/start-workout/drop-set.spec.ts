import { vi } from 'vitest';
import { of } from 'rxjs';
import { StartWorkoutComponent } from './start-workout.component';
import { previousExercises, workoutVolume } from '../../core/utils/workout-history';
import { readWorkoutDraft } from '../../core/utils/workout-draft';

describe('Drop sets', () => {
  let component: StartWorkoutComponent;
  const save = vi.fn((workout: any) => of({...workout, id: 'saved'}));
  const create = () => new StartWorkoutComponent(
    {currentUserId: 'drops-test'} as any,
    {getWorkouts: () => of([]), addWorkout: save, isDurablySaved: () => true} as any,
    {weightKg: () => 75, units: () => 'metric'} as any,
    {success: vi.fn(), error: vi.fn(), warning: vi.fn()} as any,
    {queryParams: of({})} as any, {confirm: vi.fn()} as any,
  );
  const start = (name = 'Triceps Rope Pushdown') => {
    component.selectRoutine({name: 'Push', exercises: [{name, sets: 2, reps: 12, weight: 40, muscleGroup: 'Arms'}]}, 'test');
    component.startWorkout();
  };
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); save.mockClear(); component = create(); });
  afterEach(() => { component.ngOnDestroy(); vi.useRealTimers(); });

  it.each(['Triceps Rope Pushdown', 'Triceps Pushdown', 'Lateral Raises', 'Lateral Raise (Dumbbell)', 'Cable Lateral Raise'])('offers a drop set for %s', name => {
    start(name); expect(component.supportsDropSet()).toBe(true);
    component.startDropSet(); expect(component.activeDrop()).toBe(true);
    expect(component.currentWeight()).toBe(30); expect(component.state()).toBe('active');
    expect(component.completedSets()).toBe(1); expect(component.totalSets()).toBe(2);
  });
  it('does not enable drops on other exercises', () => {
    start('Bench Press'); component.startDropSet(); expect(component.activeDrop()).toBe(false);
  });
  it('records both stages, rests only after the drop, and includes volume without altering main set history', () => {
    start(); component.startDropSet(); component.onRepsInput('8'); component.finishSet();
    expect(component.state()).toBe('rest');
    component.skipRest(); component.finishSet(); component.skipRest(); component.finishWorkout();
    const workout = save.mock.calls[0][0];
    expect(workout.exercises[0]).toMatchObject({sets: 2, setWeights: [40, 40], setReps: [12, 12], dropSets: [{setIndex: 0, weight: 30, reps: 8}]});
    expect(workoutVolume(workout)).toBe(1200); expect(component.finishedVolume()).toBe(1200);
    expect(component.finishedExercises()[0].volume).toBe(1200);
    expect(previousExercises([workout], workout.date).get('triceps rope pushdown')?.pairs).toEqual([{weight: 40, reps: 12}, {weight: 40, reps: 12}]);
  });
  it('recovers an unfinished drop after refresh and saves its parent when a later set is skipped', () => {
    start(); component.startDropSet(); component.onRepsInput('9'); component.ngOnDestroy();
    expect(readWorkoutDraft('drops-test')?.activeDrop).toBe(true);
    component = create(); component.ngOnInit(); expect(component.activeDrop()).toBe(true); expect(component.currentWeight()).toBe(30);
    component.finishSet(); component.skipRest(); component.skipSet(); component.finishWorkout();
    expect(save.mock.calls[0][0].exercises[0]).toMatchObject({sets: 1, dropSets: [{setIndex: 0, weight: 30, reps: 9}]});
  });
  it('retains an unfinished drop draft even while a user types an invalid load', () => {
    start(); component.startDropSet(); component.onWeightInput('45'); component.ngOnDestroy();
    component = create(); component.ngOnInit();
    expect(component.activeDrop()).toBe(true); expect(component.dropInputValid()).toBe(false);
    component.onWeightInput('25'); component.finishSet(); expect(component.state()).toBe('rest');
  });
  it('remaps the parent index after skipped working sets', () => {
    start(); component.skipSet(); component.startDropSet(); component.finishSet(); component.skipRest(); component.finishWorkout();
    expect(save.mock.calls[0][0].exercises[0].dropSets[0].setIndex).toBe(0);
  });
  it('skips only the drop while preserving the completed main set', () => {
    start(); component.startDropSet(); component.skipSet(); expect(component.state()).toBe('rest');
    component.skipRest(); component.skipSet(); component.finishWorkout();
    expect(save.mock.calls[0][0].exercises[0]).toMatchObject({sets: 1, setWeights: [40]});
    expect(save.mock.calls[0][0].exercises[0].dropSets).toBeUndefined();
  });
  it('blocks equal/heavier loads and zero reps, and can return to the main set', () => {
    start(); component.startDropSet(); component.onWeightInput('40'); component.finishSet(); expect(component.state()).toBe('active');
    component.onWeightInput('30'); component.onRepsInput('0'); component.finishSet(); expect(component.state()).toBe('active');
    component.previousSet(); expect(component.activeDrop()).toBe(false); expect(component.currentSetIndex()).toBe(1); expect(component.currentWeight()).toBe(40);
  });
});

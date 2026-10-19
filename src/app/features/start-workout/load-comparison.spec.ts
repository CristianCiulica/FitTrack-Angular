import { signal } from '@angular/core';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { StartWorkoutComponent } from './start-workout.component';

describe('Working set load comparison', () => {
  let component: StartWorkoutComponent;
  const units = signal<'metric' | 'imperial'>('metric');
  const history = vi.fn();
  const create = () => new StartWorkoutComponent(
    {currentUserId: 'load-test'} as any,
    {getWorkouts: history, addWorkout: (w: any) => of({...w,id:'saved'}), isDurablySaved: () => true} as any,
    {weightKg: () => 75, units} as any,
    {success: vi.fn(), warning: vi.fn(), error: vi.fn()} as any,
    {queryParams: of({})} as any, {confirm: vi.fn()} as any,
  );
  const start = (name = 'Bench Press', repUnit?: 'seconds') => {
    component.selectRoutine({name: 'Different plan', exercises: [{name, sets: 3, reps: 10, weight: 40, muscleGroup: 'Chest', ...(repUnit ? {repUnit} : {})}]}, 'test');
    component.startWorkout();
  };
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear(); units.set('metric');
    history.mockReturnValue(of([{name:'Previous plan',kind:'session',userId:'load-test',date:'2026-10-01',exercises:[{exerciseName:'Bench Press',muscleGroup:'Chest',sets:2,weight:65,reps:10,setWeights:[60,65],setReps:[10,8]}]}]));
    component = create();
  });
  afterEach(() => {component.ngOnDestroy();vi.useRealTimers()});
  it('tracks increases, decreases and unchanged loads against the matching set', () => {
    start(); component.onWeightInput('62.5'); expect(component.currentLoadChange()).toEqual({delta:2.5,date:'2026-10-01'});
    component.onWeightInput('55'); expect(component.currentLoadChange()?.delta).toBe(-5);
    component.onWeightInput('60'); expect(component.currentLoadChange()?.delta).toBe(0);
    component.finishSet(); component.skipRest(); component.onWeightInput('62.5'); expect(component.currentLoadChange()?.delta).toBe(-2.5);
    component.finishSet(); component.skipRest(); expect(component.currentLoadChange()).toBeNull();
  });
  it('converts both loads into the selected units and rounds without signed zero', () => {
    start(); units.set('imperial'); component.currentWeight.set(62.5); expect(component.currentLoadChange()?.delta).toBe(5.5);
    component.currentWeight.set(60.001); expect(component.currentLoadChange()?.delta).toBe(0);
  });
  it('hides comparisons for invalid input, new exercises and unavailable history', () => {
    start(); component.onWeightInput('invalid'); expect(component.currentLoadChange()).toBeNull();
    component.reset(); start('New exercise'); expect(component.currentLoadChange()).toBeNull();
    component.reset(); history.mockReturnValue(throwError(()=>new Error('offline'))); start(); expect(component.currentLoadChange()).toBeNull();
  });
  it('does not compare timed holds or drop stages against working sets', () => {
    start('Bench Press','seconds'); expect(component.currentLoadChange()).toBeNull();
    component.reset(); history.mockReturnValue(of([{name:'Push',kind:'session',userId:'load-test',date:'2026-10-01',exercises:[{exerciseName:'Triceps Pushdown',muscleGroup:'Arms',sets:1,weight:40,reps:12}]}]));
    start('Triceps Pushdown'); expect(component.currentLoadChange()?.delta).toBe(0);
    component.startDropSet(); expect(component.currentLoadChange()).toBeNull();
  });
  it('keeps the final comparisons for completed sets and excludes skipped work', () => {
    start(); component.onWeightInput('62.5'); component.finishSet(); component.skipRest();
    component.onWeightInput('60'); component.finishSet(); component.skipRest(); component.skipSet(); component.finishWorkout();
    expect(component.finishedExercises()[0].loadChanges).toEqual([{set:1,delta:2.5,date:'2026-10-01'},{set:2,delta:-5,date:'2026-10-01'}]);
  });
});

import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { StartWorkoutComponent } from '../start-workout/start-workout.component';
import { buildTrainingPlan } from './training-planner.engine';
import { trainingPlanWorkouts } from './training-plan-storage';
import { TrainingPreferences } from './training-planner.model';

const p: TrainingPreferences = {
  goal: 'muscle',
  experience: 'consistent',
  equipment: ['machines', 'dumbbells', 'bench', 'cables'],
  days: [0, 1, 3, 4],
  minutes: 60,
  focus: 'balanced',
  readiness: 'ready',
};
describe('Personal plan in a live workout', () => {
  let components: StartWorkoutComponent[];
  beforeEach(() => {
    localStorage.clear();
    components = [];
  });
  afterEach(() => {
    for (const component of components) component.ngOnDestroy();
  });
  function create(requested: string | null) {
    const plan = buildTrainingPlan(p, 'tp_live');
    const records = trainingPlanWorkouts(plan, 'test', [], '2026-10-18').map((r, i) => ({
      ...r,
      id: 'routine-' + i,
    }));
    const component = new StartWorkoutComponent(
      { currentUserId: 'test' } as any,
      { getWorkouts: () => of(records), workouts: signal(records) } as any,
      { weightKg: () => 75, units: () => 'metric' } as any,
      { success: vi.fn(), warning: vi.fn(), error: vi.fn() } as any,
      { queryParams: of({}), snapshot: { queryParamMap: { get: () => requested } } } as any,
      { confirm: vi.fn() } as any,
    );
    components.push(component);
    return component;
  }
  it('launches the chosen saved day and uses its rep range, coaching and per-exercise rest', async () => {
    const component = create('tp_live.0');
    component.ngOnInit();
    await Promise.resolve();
    expect(component.state()).toBe('active');
    expect(component.currentRoutine().name).toBe('Your plan · Upper body A');
    expect(component.currentExercise()).toMatchObject({
      repRange: '6–10',
      rir: 2,
      restSeconds: 120,
    });
    expect(component.currentExercise()!.cue).toBeTruthy();
    component.finishSet();
    expect(component.restTimeRemaining()).toBe(120);
    expect(component.restClock()).toBe('2:00');
    component.skipRest();
    expect(component.currentSetIndex()).toBe(2);
  });
  it('restores coaching after refresh and preserves an unfinished workout ahead of another launch link', async () => {
    const first = create('tp_live.0');
    first.ngOnInit();
    await Promise.resolve();
    first.finishSet();
    first.checkpointWorkout();
    first.ngOnDestroy();
    const restored = create('tp_live.1');
    restored.ngOnInit();
    await Promise.resolve();
    expect(restored.currentRoutine().name).toBe('Your plan · Upper body A');
    expect(restored.currentExercise()).toMatchObject({
      repRange: '6–10',
      rir: 2,
      restSeconds: 120,
    });
    expect(restored.state()).toBe('rest');
  });
});

import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { StartWorkoutComponent } from './start-workout.component';
import { timedSession } from '../../core/utils/timed-cardio';
import { readWorkoutDraft } from '../../core/utils/workout-draft';
const treadmill = {
  name: 'Treadmill walk',
  activity: 'treadmill' as const,
  durationMinutes: 20,
  sets: 1,
  reps: 1,
  weight: 0,
  muscleGroup: 'Cardio' as const,
};
describe('Live treadmill session', () => {
  let component: StartWorkoutComponent;
  let save: ReturnType<typeof vi.fn>;
  const create = () =>
    new StartWorkoutComponent(
      { currentUserId: 'timer-test' } as any,
      {
        workouts: signal([]),
        getWorkouts: () => of([]),
        addWorkout: save,
        isDurablySaved: () => true,
      } as any,
      { weightKg: () => 75, units: () => 'metric' } as any,
      { success: vi.fn(), warning: vi.fn(), error: vi.fn() } as any,
      { queryParams: of({}) } as any,
      { confirm: vi.fn() } as any,
    );
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    save = vi.fn((w) => of({ ...w, id: 'saved' }));
    component = create();
    component.selectRoutine({ name: 'Walk', exercises: [treadmill] }, 'walk');
    component.startWorkout();
  });
  afterEach(() => {
    component.ngOnDestroy();
    vi.useRealTimers();
    localStorage.clear();
  });
  it('validates chosen minutes, pauses without adding time and saves a partial walk without invented exercise reps', () => {
    component.updateTreadmillMinutes('0');
    component.toggleHoldTimer();
    expect(component.holdRunning()).toBe(false);
    component.updateTreadmillMinutes('15');
    expect(component.holdTargetSeconds()).toBe(900);
    component.toggleHoldTimer();
    vi.advanceTimersByTime(90000);
    component.toggleHoldTimer();
    vi.advanceTimersByTime(60000);
    expect(component.currentReps()).toBe(90);
    component.toggleHoldTimer();
    vi.advanceTimersByTime(30000);
    component.finishSet();
    expect(component.state()).toBe('review');
    component.finishWorkout();
    expect(save.mock.calls[0][0].exercises).toEqual([]);
    expect(save.mock.calls[0][0].durationSeconds).toBe(120);
    expect(timedSession(save.mock.calls[0][0])).toMatchObject({
      completed: false,
      treadmill: [{ seconds: 120, targetSeconds: 900 }],
    });
    expect(component.finishedCalories()).toBe(9);
  });
  it('automatically completes at the target, including when callbacks were suspended', () => {
    component.updateTreadmillMinutes('1');
    component.toggleHoldTimer();
    vi.setSystemTime(Date.now() + 65000);
    component.updateHoldTimer();
    expect(component.state()).toBe('review');
    expect(component.completedSets()).toBe(1);
    component.finishWorkout();
    expect(timedSession(save.mock.calls[0][0])).toMatchObject({
      completed: true,
      treadmill: [{ seconds: 60 }],
    });
    expect(save.mock.calls[0][0].durationSeconds).toBe(60);
  });
  it('recovers a long-running timer paused after refresh, with the chosen duration and stable upload identity', () => {
    component.toggleHoldTimer();
    vi.advanceTimersByTime(610000);
    component.checkpointWorkout();
    const draft = readWorkoutDraft('timer-test')!;
    expect(draft.holdElapsedMs).toBe(610000);
    component.ngOnDestroy();
    component = create();
    component.ngOnInit();
    expect(component.treadmillActive()).toBe(true);
    expect(component.holdRunning()).toBe(false);
    expect(component.currentReps()).toBe(610);
    expect(component.treadmillMinutes()).toBe(20);
    component.toggleHoldTimer();
    vi.advanceTimersByTime(10000);
    component.finishSet();
    component.finishWorkout();
    expect(save.mock.calls[0][0].clientId).toBe(draft.clientId);
    expect(timedSession(save.mock.calls[0][0])?.treadmill[0].seconds).toBe(620);
  });
  it('runs treadmill after strength, preserves normal weights/reps and does not apply a strength rest after the timer', () => {
    component.cancelWorkout();
    component.selectRoutine(
      {
        name: 'Mixed',
        exercises: [
          treadmill,
          { name: 'Bench Press', sets: 1, reps: 10, weight: 20, muscleGroup: 'Chest' },
        ],
      },
      'mixed',
    );
    component.startWorkout();
    expect(component.currentExercise()?.name).toBe('Bench Press');
    component.finishSet();
    component.skipRest();
    expect(component.treadmillActive()).toBe(true);
    component.updateTreadmillMinutes('1');
    component.toggleHoldTimer();
    vi.advanceTimersByTime(60000);
    expect(component.state()).toBe('review');
    component.finishWorkout();
    expect(save.mock.calls[0][0].exercises).toEqual([
      expect.objectContaining({
        exerciseName: 'Bench Press',
        sets: 1,
        setWeights: [20],
        setReps: [10],
      }),
    ]);
    expect(timedSession(save.mock.calls[0][0])?.treadmill[0].exerciseIndex).toBe(1);
    expect(component.finishedVolume()).toBe(200);
  });
  it('keeps draft recovery valid when going back from a long walk to strength work', () => {
    component.cancelWorkout();
    component.selectRoutine(
      {
        name: 'Mixed',
        exercises: [
          { name: 'Press', sets: 1, reps: 10, weight: 20, muscleGroup: 'Chest' },
          treadmill,
        ],
      },
      'mixed',
    );
    component.startWorkout();
    component.finishSet();
    component.skipRest();
    component.toggleHoldTimer();
    vi.advanceTimersByTime(610000);
    component.finishSet();
    component.previousSet();
    component.previousSet();
    component.checkpointWorkout();
    expect(component.currentExercise()?.name).toBe('Press');
    expect(readWorkoutDraft('timer-test')).not.toBeNull();
  });
});

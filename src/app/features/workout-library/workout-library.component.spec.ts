import { enrollmentWorkout, readProgramEnrollment } from '../../core/utils/program-records';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { WorkoutService } from '../../core/services/workout.service';
import { WorkoutLibraryComponent } from './workout-library.component';

describe('Workout library navigation', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [WorkoutLibraryComponent],
      providers: [
        { provide: AuthService, useValue: { currentUserId: 'u' } },
        { provide: ProfileService, useValue: { units: signal('metric') } },
        {
          provide: WorkoutService,
          useValue: {
            workouts: signal([]),
            addWorkout: vi.fn((w) => of({ ...w, id: 'saved' })),
            isDurablySaved: () => true,
            updateWorkout: vi.fn(),
          },
        },
      ],
    }),
  );
  it('shows six sessions per page and resets pagination when the search changes', () => {
    const fixture = TestBed.createComponent(WorkoutLibraryComponent),
      component = fixture.componentInstance;
    const routines = Array.from({ length: 19 }, (_, i) => ({
      name: `Session ${i + 1}`,
      exercises: [
        {
          name: i === 18 ? 'Special row' : 'Squat',
          sets: 3,
          reps: 10,
          weight: 0,
          muscleGroup: 'Legs',
        },
      ],
    }));
    fixture.componentRef.setInput('routines', routines);
    fixture.componentRef.setInput(
      'personalRoutines',
      routines.map((r, i) => ({ ...r, id: String(i) })),
    );
    expect(component.visibleSessions().length).toBe(6);
    component.changePage(1);
    expect(component.visibleSessions()[0].name).toBe('Session 7');
    component.search('Special row');
    expect(component.page()).toBe(0);
    expect(component.visibleSessions().map((r) => r.name)).toEqual(['Session 19']);
    component.search('');
    component.changeMinePage(1);
    expect(component.visibleCustom().length).toBe(6);
    component.search('Session 19');
    expect(component.visibleCustom().length).toBe(1);
    expect(component.minePage()).toBe(0);
  });
  it('collapses the exercise preview without truncating the session and resets it for another day', () => {
    const component = TestBed.createComponent(WorkoutLibraryComponent).componentInstance;
    component.selectedProgram.set(component.programs()[0]);
    const allExercises = component.currentRoutine()!.exercises;
    expect(allExercises.length).toBeGreaterThan(3);
    expect(component.visibleExercises()).toEqual(allExercises.slice(0, 3));
    component.expandedExercises.set(true);
    expect(component.visibleExercises()).toEqual(allExercises);
    component.selectDay(1);
    expect(component.expandedExercises()).toBe(false);
    expect(component.visibleExercises().length).toBe(3);
    expect(component.currentRoutine()!.exercises.length).toBeGreaterThan(3);
    component.selectDay(6);
    expect(component.visibleExercises()).toEqual([]);
  });
  it('filters programs by goal and keeps custom sessions out of the discovery grid', () => {
    const fixture = TestBed.createComponent(WorkoutLibraryComponent),
      component = fixture.componentInstance;
    expect(component.filteredPrograms().length).toBe(6);
    component.goal.set('busy');
    expect(component.filteredPrograms().map((p) => p.id)).toEqual(['busy-30']);
    component.goal.set('all');
    component.search('glute');
    expect(component.filteredPrograms().some((p) => p.id === 'glutes-30')).toBe(true);
  });
  it('retries enrollment with one stable identity and launches a future scheduled session', async () => {
    const component = TestBed.createComponent(WorkoutLibraryComponent).componentInstance;
    const service = TestBed.inject(WorkoutService);
    const durable = vi.spyOn(service, 'isDurablySaved').mockReturnValue(false);
    component.selectedProgram.set(component.programs()[0]);
    await component.enroll();
    expect(component.selectedEnrollment()).toBeNull();
    expect(component.error()).toContain('Storage');
    durable.mockReturnValue(true);
    await component.enroll();
    const calls = vi.mocked(service.addWorkout).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0].clientId).toBe(calls[1][0].clientId);
    expect(component.selectedEnrollment()?.id).toBe(calls[0][0].clientId);
    component.selectedDay.set(1);
    expect(component.currentDay()?.future).toBe(true);
    vi.spyOn(component, 'close').mockImplementation(() => {});
    const launch = vi.spyOn(component.startRoutine, 'emit');
    component.startDay();
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({
        routine: expect.objectContaining({ program: expect.objectContaining({ dayIndex: 1 }) }),
      }),
    );
    launch.mockClear();
    component.selectDay(6);
    component.startDay();
    expect(launch).not.toHaveBeenCalled();
    component.selectDay(1);
    component.selectedEnrollment.update((e) => ({ ...e!, stoppedAt: new Date().toISOString() }));
    component.startDay();
    expect(launch).not.toHaveBeenCalled();
  });
  it('shows a session title once while retaining distinct saved-plan day names', () => {
    const component = TestBed.createComponent(WorkoutLibraryComponent).componentInstance;
    component.selectedRoutine.set({ name: 'PUSH', exercises: [] });
    expect(component.previewTitle()).toBe('PUSH');
    expect(component.showSessionTitle()).toBe(false);
    vi.spyOn(component, 'selectedSavedPlan').mockReturnValue({ split: 'Upper / Lower' } as any);
    component.selectedRoutine.set({ name: 'Upper A', exercises: [] });
    expect(component.previewTitle()).toBe('Upper / Lower');
    expect(component.showSessionTitle()).toBe(true);
  });
  it('stops the active block without deleting progress or reviving an older block', async () => {
    const component = TestBed.createComponent(WorkoutLibraryComponent).componentInstance;
    const service = TestBed.inject(WorkoutService);
    const old = {
      version: 1 as const,
      id: 'pg_old',
      programId: 'busy-30',
      startDate: '2026-10-16',
      createdAt: '2026-10-16T10:00:00Z',
    };
    const current = {
      ...old,
      id: 'pg_current',
      programId: 'build-30',
      createdAt: '2026-10-18T10:00:00Z',
    };
    service.workouts.set(
      [old, current].map((e) => ({ ...enrollmentWorkout(e, 'Plan', 'u'), id: e.id })),
    );
    component.selectedProgram.set(component.programs()[0]);
    component.selectedEnrollment.set(current);
    vi.mocked(service.updateWorkout).mockReturnValueOnce(throwError(() => new Error('Offline')));
    await component.stopPlan();
    expect(component.error()).toBe('Offline');
    expect(component.activeEnrollment()?.id).toBe('pg_current');
    vi.mocked(service.updateWorkout).mockImplementation((id, patch) => {
      const saved = { ...service.workouts().find((w) => w.id === id)!, ...patch };
      service.workouts.update((list) => list.map((w) => (w.id === id ? saved : w)));
      return of(saved);
    });
    await component.stopPlan();
    expect(service.workouts().length).toBe(2);
    expect(readProgramEnrollment(service.workouts()[1])?.stoppedAt).toBeTruthy();
    expect(component.activeEnrollment()).toBeNull();
    expect(component.previousBlocks().length).toBe(2);
    const start = vi.spyOn(component.startRoutine, 'emit');
    component.startDay();
    expect(start).not.toHaveBeenCalled();
  });
});

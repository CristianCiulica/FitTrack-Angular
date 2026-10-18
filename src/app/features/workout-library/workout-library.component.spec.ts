import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
  it('retries enrollment with one stable identity and refuses a session from a future day', async () => {
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
    const launch = vi.spyOn(component.startRoutine, 'emit');
    component.startDay();
    expect(launch).not.toHaveBeenCalled();
  });
});

import { StartWorkoutComponent } from '../start-workout/start-workout.component';
import { Workout } from '../../core/models/workout.model';
import { isCompoundExercise, orderRoutineExercises } from '../../core/models/workout-routine.model';
import {
  enrollmentWorkout,
  ProgramEnrollment,
  programSessionNotes,
  readProgramEnrollment,
  readProgramSession,
} from '../../core/utils/program-records';
import { timedSessionNotes } from '../../core/utils/timed-cardio';
import { indoorCardioWorkout } from '../../core/utils/indoor-cardio';
import { isWorkoutSession, personalWorkoutPlans } from '../../core/utils/workout-kind';
import { workoutPrograms, programCalendar, programRoutine } from './workout-programs';

const component = new StartWorkoutComponent(
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
);
const programs = workoutPrograms(component.gymRoutines, component.homeRoutines);
const enrollment: ProgramEnrollment = {
  version: 1,
  id: 'pg_test',
  programId: 'build-30',
  startDate: '2026-12-20',
  createdAt: '2026-12-20T08:00:00Z',
};
describe('30-day training programs', () => {
  it('provides six distinct blocks with honest weekly requirements and recovery', () => {
    expect(programs.map((p) => p.id)).toEqual([
      'build-30',
      'lean-30',
      'busy-30',
      'aesthetics-30',
      'glutes-30',
      'home-30',
    ]);
    for (const program of programs) {
      expect(program.week.length).toBe(7);
      expect(program.week.filter((d) => d.type === 'strength').length).toBe(program.gymDays);
      expect(program.week.some((d) => d.type === 'rest')).toBe(true);
      for (const day of program.week) {
        if (day.routine) {
          let isolation = false;
          for (const e of day.routine.exercises) {
            if (!isCompoundExercise(e)) isolation = true;
            else expect(isolation, e.name).toBe(false);
            expect(e.sets).toBeGreaterThan(0);
            expect(e.weight).toBe(0);
          }
        }
      }
    }
    expect(programs.find((p) => p.id === 'busy-30')!.gymDays).toBe(2);
    expect(
      programs.find((p) => p.id === 'lean-30')!.week.filter((d) => d.type === 'cardio').length,
    ).toBe(2);
  });
  it('preserves the user’s aesthetics movements and sets while putting compounds first', () => {
    const program = programs.find((p) => p.id === 'aesthetics-30')!;
    const sessions = program.week.filter((d) => d.type === 'strength');
    sessions.forEach((day, index) =>
      expect(
        day
          .routine!.exercises.map((e) => ({ name: e.name, sets: e.sets }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ).toEqual(
        component.gymRoutines[index].exercises
          .map((e) => ({ name: e.name, sets: e.sets }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    );
    expect(
      sessions[0].routine!.exercises.map(({ name, sets, reps }) => ({ name, sets, reps })),
    ).toEqual([
      { name: 'Dumbbell Bench Press', sets: 3, reps: 10 },
      { name: 'Incline Chest Press (Machine)', sets: 4, reps: 10 },
      { name: 'Chest Dip', sets: 1, reps: 15 },
      { name: 'Shoulder Press', sets: 3, reps: 12 },
      { name: 'Triceps Rope Pushdown', sets: 3, reps: 12 },
      { name: 'Overhead Triceps Extension', sets: 3, reps: 12 },
      { name: 'Lateral Raise (Dumbbell)', sets: 6, reps: 15 },
    ]);
    expect(sessions[1].routine!.exercises.slice(0, 2).map((e) => e.name)).toEqual([
      'Pull Up',
      'Bent Over Row (Machine)',
    ]);
  });
  it('keeps Aesthetics lifting days in place and replaces cardio with recovery', () => {
    const p = programs.find((p) => p.id === 'aesthetics-30')!;
    const days = programCalendar(p, { ...enrollment, programId: p.id }, [], enrollment.startDate);
    expect(p.week.map((d) => d.type)).toEqual([
      'strength',
      'rest',
      'strength',
      'rest',
      'strength',
      'rest',
      'rest',
    ]);
    expect(p.week.filter((d) => d.type === 'strength').map((d) => d.id)).toEqual([
      'push',
      'pull',
      'legs',
    ]);
    expect(days.filter((d) => d.day.type !== 'rest')).toHaveLength(13);
    const context = programRoutine(p, 2, { ...enrollment, programId: p.id }).program!;
    const log: Workout = {
      userId: 'u',
      kind: 'session',
      name: 'PULL',
      date: enrollment.startDate,
      exercises: [],
      notes: programSessionNotes(context, true),
    };
    expect(
      programCalendar(p, { ...enrollment, programId: p.id }, [log], enrollment.startDate)[2].done,
    ).toBe(true);
    expect(isWorkoutSession(log)).toBe(true);
  });
  it('links an early workout to the chosen future plan day using its actual logged date', () => {
    const routine = programRoutine(programs[0], 8, enrollment);
    const log: Workout = {
      userId: 'u',
      kind: 'session',
      name: routine.name,
      date: enrollment.startDate,
      exercises: [],
      notes: programSessionNotes(routine.program!, true),
    };
    const days = programCalendar(programs[0], enrollment, [log], enrollment.startDate);
    expect(days[8].future).toBe(true);
    expect(days[8].done).toBe(true);
    expect(days.filter((d) => d.done)).toHaveLength(1);
    expect(log.date).toBe(enrollment.startDate);
  });
  it('maps exactly 30 actual calendar days across year boundaries and creates linked sessions', () => {
    const program = programs[0],
      days = programCalendar(program, enrollment, [], '2026-12-20');
    expect(days.length).toBe(30);
    expect(days[0].date).toBe('2026-12-20');
    expect(days[29].date).toBe('2027-01-18');
    expect(days[0].today).toBe(true);
    expect(days[1].future).toBe(true);
    const routine = programRoutine(program, 0, enrollment);
    expect(routine.program).toMatchObject({
      enrollmentId: 'pg_test',
      dayIndex: 0,
      sessionId: 'upper-a',
    });
    expect(routine.exercises.every((e) => e.rir === 3)).toBe(true);
    expect(programRoutine(program, 7, enrollment).exercises.every((e) => e.rir === 2)).toBe(true);
    expect(() => programRoutine(program, 6, enrollment)).toThrow();
    expect(() => programRoutine(program, 30, enrollment)).toThrow();
    expect(() => programRoutine(program, -1, enrollment)).toThrow();
    expect(() => programRoutine(programs[1], 0, enrollment)).toThrow();
  });
  it('does not count enrollment as exercise and retains complete vs partial logs', () => {
    const marker = enrollmentWorkout(enrollment, programs[0].title, 'user');
    expect(readProgramEnrollment(marker)).toEqual(enrollment);
    expect(isWorkoutSession(marker)).toBe(false);
    expect(personalWorkoutPlans([marker])).toEqual([]);
    const context = programRoutine(programs[0], 0, enrollment).program!;
    const log: Workout = {
      userId: 'user',
      kind: 'session',
      name: 'Upper',
      date: '2026-12-20',
      notes: programSessionNotes(context, false),
      exercises: [],
    };
    expect(readProgramSession(log)?.completed).toBe(false);
    let days = programCalendar(programs[0], enrollment, [log], '2026-12-20');
    expect(days[0].partial).toBe(true);
    expect(days[0].done).toBe(false);
    days = programCalendar(
      programs[0],
      enrollment,
      [log, { ...log, notes: programSessionNotes(context, true) }],
      '2026-12-20',
    );
    expect(days[0].done).toBe(true);
    expect(days.filter((d) => d.done).length).toBe(1);
    expect(
      readProgramSession({ ...log, notes: log.notes!.replace('"dayIndex":0', '"dayIndex":40') }),
    ).toBeNull();
  });
  it('keeps short cardio sessions partial and combines actual minutes toward the planned day', () => {
    const context = {
      enrollmentId: enrollment.id,
      programId: enrollment.programId,
      dayIndex: 2,
      sessionId: 'cardio-a',
    };
    const record = indoorCardioWorkout(
      {
        version: 1,
        mode: 'walking',
        startedAt: '2026-12-22T10:00:00Z',
        endedAt: '2026-12-22T10:10:00Z',
        distanceMeters: 800,
        inclinePercent: null,
        steps: null,
        calories: null,
        program: context,
      },
      'user',
      'indoor_one',
    );
    let days = programCalendar(programs[0], enrollment, [record], '2026-12-22');
    expect(days[2].partial).toBe(true);
    expect(days[2].done).toBe(false);
    expect(programCalendar(programs[0], enrollment, [record, record], '2026-12-22')[2].done).toBe(
      false,
    );
    days = programCalendar(
      programs[0],
      enrollment,
      [record, { ...record, clientId: 'indoor_two' }],
      '2026-12-22',
    );
    expect(days[2].done).toBe(true);
    expect(
      programCalendar(programs[0], { ...enrollment, id: 'pg_other' }, [record], '2026-12-22').some(
        (d) => d.done,
      ),
    ).toBe(false);
  });
  it('orders a copied routine without mutating the source or calling timed holds compound lifts', () => {
    const original = [
      { name: 'Curl' },
      { name: 'Bench Press' },
      { name: 'Calf Raise' },
      { name: 'Row' },
      { name: 'Wide Squat Hold', repUnit: 'seconds' as const },
    ];
    expect(orderRoutineExercises(original).map((e) => e.name)).toEqual([
      'Bench Press',
      'Row',
      'Curl',
      'Calf Raise',
      'Wide Squat Hold',
    ]);
    expect(original[0].name).toBe('Curl');
    expect(isCompoundExercise({ name: 'Lat Pulldown' })).toBe(true);
    expect(isCompoundExercise({ name: 'Rack Pull' })).toBe(true);
    expect(isCompoundExercise({ name: 'Straight Arm Pulldown' })).toBe(false);
    expect(isCompoundExercise({ name: 'Calf Press' })).toBe(false);
  });
  it('launches cardio in the normal workout player and counts actual timer seconds toward the day', () => {
    const routine = programRoutine(programs[0], 2, enrollment);
    expect(routine.exercises).toEqual([
      expect.objectContaining({ activity: 'treadmill', durationMinutes: 20, sets: 1 }),
    ]);
    const log: Workout = {
      userId: 'u',
      clientId: 'w_timer1',
      kind: 'session',
      name: routine.name,
      date: '2026-12-22',
      exercises: [],
      notes: timedSessionNotes({
        version: 1,
        program: routine.program,
        completed: false,
        treadmill: [{ exerciseIndex: 0, seconds: 600, targetSeconds: 1200, weightKg: 75 }],
      }),
    };
    expect(programCalendar(programs[0], enrollment, [log], '2026-12-22')[2].partial).toBe(true);
    expect(programCalendar(programs[0], enrollment, [log, log], '2026-12-22')[2].done).toBe(false);
    expect(
      programCalendar(
        programs[0],
        enrollment,
        [log, { ...log, clientId: 'w_timer2' }],
        '2026-12-22',
      )[2].done,
    ).toBe(true);
    expect(() =>
      programRoutine(programs[0], 0, { ...enrollment, stoppedAt: new Date().toISOString() }),
    ).toThrow();
  });
});

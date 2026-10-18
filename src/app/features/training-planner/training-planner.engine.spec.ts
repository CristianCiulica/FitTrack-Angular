import {
  buildTrainingPlan,
  canUseMovement,
  estimateTrainingMinutes,
  startingLoad,
  swapTrainingMovement,
  trainingAlternatives,
  trainingBlocker,
  trainingVolume,
} from './training-planner.engine';
import { TrainingPreferences, TrainingEquipment } from './training-planner.model';
import {
  savedTrainingPlans,
  trainingMetadata,
  trainingPlanWorkouts,
  trainingRoutineDetails,
} from './training-plan-storage';
import { Workout } from '../../core/models/workout.model';
const preferences: TrainingPreferences = {
  goal: 'muscle',
  experience: 'consistent',
  equipment: ['machines', 'dumbbells', 'bench', 'cables', 'barbell'],
  days: [0, 1, 3, 4],
  minutes: 60,
  focus: 'balanced',
  readiness: 'ready',
};

describe('Personal training programming', () => {
  it('keeps equipment, time, coverage and conservative session volume across supported combinations', () => {
    const setups: TrainingEquipment[][] = [
      ['dumbbells'],
      ['bands'],
      ['machines'],
      ['barbell'],
      ['pullup'],
      ['cables'],
      preferences.equipment,
    ];
    for (const equipment of setups)
      for (const days of [
        [0, 3],
        [0, 1],
        [0, 2, 4],
        [0, 1, 2],
        [0, 1, 3, 4],
        [0, 1, 3, 4, 5],
        [0, 1, 2, 3, 4, 5],
      ])
        for (const minutes of [30, 45, 60, 75] as const)
          for (const experience of ['new', 'consistent', 'experienced'] as const)
            for (const goal of ['muscle', 'strength', 'recomp'] as const) {
              const p = { ...preferences, equipment, days, minutes, experience, goal };
              const plan = buildTrainingPlan(p);
              expect(plan.days.length).toBe(days.length);
              for (const day of plan.days) {
                expect(
                  day.exercises.length,
                  JSON.stringify({ p, day: day.name }),
                ).toBeGreaterThanOrEqual(2);
                expect(day.estimatedMinutes).toBeLessThanOrEqual(minutes);
                expect(day.estimatedMinutes).toBe(estimateTrainingMinutes(day.exercises));
                expect(new Set(day.exercises.map((e) => e.movement.id)).size).toBe(
                  day.exercises.length,
                );
                for (const e of day.exercises) {
                  expect(canUseMovement(e.movement, p)).toBe(true);
                  expect(e.sets).toBeGreaterThanOrEqual(2);
                  expect(e.sets).toBeLessThanOrEqual(4);
                  expect(e.rir).toBeGreaterThanOrEqual(2);
                  expect(e.minReps).toBeLessThanOrEqual(e.maxReps);
                }
                for (const muscle of new Set(day.exercises.map((e) => e.movement.primary)))
                  expect(
                    day.exercises
                      .filter((e) => e.movement.primary === muscle)
                      .reduce((sum, e) => sum + e.sets, 0),
                  ).toBeLessThanOrEqual(8);
              }
              const weekly = trainingVolume(plan);
              for (const muscle of ['Chest', 'Back', 'Quads'])
                expect(weekly.find((r) => r.muscle === muscle)!.direct).toBeGreaterThan(0);
              expect(
                weekly
                  .filter((r) => r.muscle === 'Hamstrings' || r.muscle === 'Glutes')
                  .reduce((sum, r) => sum + r.direct, 0),
              ).toBeGreaterThan(0);
            }
  });
  it('uses recovery-aware layouts and reproducible exercise selection', () => {
    expect(buildTrainingPlan({ ...preferences, days: [0, 3] }).split).toBe('Full body');
    expect(buildTrainingPlan({ ...preferences, days: [0, 1] }).split).toBe('Upper / Lower');
    expect(buildTrainingPlan({ ...preferences, days: [0, 1, 2] }).split).toBe('Push / Pull / Legs');
    const a = buildTrainingPlan(preferences, 'tp_test', '2026-10-18T12:00:00Z');
    expect(buildTrainingPlan(preferences, 'tp_test', '2026-10-18T12:00:00Z')).toEqual(a);
    expect(preferences.days).toEqual([0, 1, 3, 4]);
  });
  it('changes prescriptions for experience, strength, focus and returning lifters', () => {
    const strength = buildTrainingPlan({ ...preferences, goal: 'strength' });
    expect(strength.days[0].exercises[0]).toMatchObject({
      minReps: 4,
      maxReps: 6,
      restSeconds: 180,
    });
    const novice = buildTrainingPlan({ ...preferences, experience: 'new', goal: 'strength' });
    expect(novice.days[0].exercises[0]).toMatchObject({ minReps: 6, maxReps: 10, rir: 3 });
    const returning = buildTrainingPlan({ ...preferences, readiness: 'returning' });
    expect(
      returning.days.flatMap((d) => d.exercises).every((e) => e.sets === 2 && e.rir === 3),
    ).toBe(true);
    const upper = buildTrainingPlan({ ...preferences, focus: 'upper', minutes: 45 });
    const arms = buildTrainingPlan({ ...preferences, focus: 'arms', minutes: 45 });
    expect(upper.days.map((d) => d.exercises)).not.toEqual(arms.days.map((d) => d.exercises));
    expect(trainingVolume(arms).find((r) => r.muscle === 'Biceps')!.direct).toBeGreaterThan(0);
  });
  it('allows only compatible substitutions and enforces the new time estimate', () => {
    const plan = buildTrainingPlan(preferences),
      day = plan.days[0],
      original = day.exercises[0];
    const options = trainingAlternatives(original, day, preferences);
    expect(options.length).toBeGreaterThan(0);
    for (const m of options) {
      expect(m.primary).toBe(original.movement.primary);
      expect(m.pattern).toBe(original.movement.pattern);
      expect(canUseMovement(m, preferences)).toBe(true);
    }
    const changed = swapTrainingMovement(plan, 0, 0, options[0].id);
    expect(changed.days[0].exercises[0].movement.id).toBe(options[0].id);
    expect(plan.days[0].exercises[0]).toBe(original);
    expect(() => swapTrainingMovement(plan, 0, 0, 'leg-curl')).toThrow();
  });
  it('does not invent a load, use future sessions or mistake routines for performance', () => {
    const exercise = buildTrainingPlan(preferences).days[0].exercises[0];
    const record: Workout = {
      userId: 'u',
      kind: 'session',
      date: '2026-10-01',
      name: 'Upper',
      exercises: [
        {
          exerciseName: exercise.movement.name,
          muscleGroup: 'Chest',
          sets: 3,
          reps: 10,
          weight: 50,
          setWeights: [40, 45, 50],
        },
      ],
    };
    expect(startingLoad(exercise, [], '2026-10-18').weight).toBe(0);
    expect(
      startingLoad(
        exercise,
        [
          { ...record, kind: 'routine' },
          { ...record, date: '2026-10-20' },
        ],
        '2026-10-18',
      ).weight,
    ).toBe(0);
    expect(startingLoad(exercise, [record], '2026-10-18').weight).toBe(40);
    expect(startingLoad(exercise, [record], '2027-01-01').weight).toBe(0);
    expect(startingLoad({ ...exercise, rir: 3 }, [record], '2026-10-18').weight).toBe(40);
  });
  it('blocks unsupported inputs and medical restrictions instead of generating a generic plan', () => {
    expect(trainingBlocker({ ...preferences, readiness: 'restricted' })).toContain(
      'individual assessment',
    );
    expect(trainingBlocker({ ...preferences, equipment: ['bench'] })).toContain('back');
    expect(() => buildTrainingPlan({ ...preferences, days: [0, 0] })).toThrow();
    expect(() => buildTrainingPlan({ ...preferences, days: [0, 1, 2, 3, 4, 5, 6] })).toThrow();
  });
});

describe('Training plan persistence', () => {
  it('saves repeatable routines, round-trips prescriptions and never writes a completed session', () => {
    let plan = buildTrainingPlan(preferences, 'tp_test', '2026-10-18T12:00:00Z');
    const alt = trainingAlternatives(plan.days[0].exercises[0], plan.days[0], preferences)[0];
    plan = swapTrainingMovement(plan, 0, 0, alt.id);
    const records = trainingPlanWorkouts(plan, 'u', [], '2026-10-18');
    expect(new Set(records.map((r) => r.clientId)).size).toBe(4);
    for (const record of records) {
      expect(record.kind).toBe('routine');
      expect(record.notes!.length).toBeLessThanOrEqual(2000);
      expect(record.exercises.every((e) => e.weight === 0)).toBe(true);
      expect(trainingMetadata(record)).not.toBeNull();
    }
    const restored = savedTrainingPlans(records)[0];
    expect(restored.savedDays).toBe(4);
    expect(restored.plan).toEqual(plan);
    expect(trainingRoutineDetails(records[0])![0]).toMatchObject({
      repRange: '6–10',
      restSeconds: 120,
      rir: 2,
    });
    expect(trainingPlanWorkouts(plan, 'u', [], '2026-10-18').map((r) => r.clientId)).toEqual(
      records.map((r) => r.clientId),
    );
    expect(savedTrainingPlans(records.slice(0, 2))[0].savedDays).toBe(2);
  });
  it('rejects malformed metadata and avoids attaching stale coaching to renamed exercises', () => {
    const record = trainingPlanWorkouts(buildTrainingPlan(preferences), 'u', [], '2026-10-18')[0];
    expect(trainingMetadata({ ...record, notes: '{oops' })).toBeNull();
    expect(
      trainingMetadata({
        ...record,
        exercises: [
          { ...record.exercises[0], exerciseName: 'A different movement' },
          ...record.exercises.slice(1),
        ],
      }),
    ).toBeNull();
    expect(
      savedTrainingPlans([{ ...record, notes: record.notes!.replace('"day":0', '"day":999') }]),
    ).toEqual([]);
  });
});

import { Workout } from '../../core/models/workout.model';
import {
  buildTrainingPlan,
  compoundsFirst,
  estimateTrainingMinutes,
  startingLoad,
  validPreferences,
  canUseMovement,
} from './training-planner.engine';
import { TRAINING_MOVEMENTS } from './training-movements';
import { TrainingExercise, TrainingPlan, TrainingPreferences } from './training-planner.model';

const PREFIX = 'FitTrack Training Plan · ';
interface PlanMetadata {
  version: 1;
  id: string;
  createdAt: string;
  day: number;
  preferences: TrainingPreferences;
  exercises: { id: string; min: number; max: number; rest: number; rir: number }[];
}
export function trainingMetadata(
  workout: Pick<Workout, 'notes' | 'exercises'>,
): PlanMetadata | null {
  if (!workout.notes?.startsWith(PREFIX)) return null;
  try {
    const m = JSON.parse(workout.notes.slice(PREFIX.length)) as PlanMetadata;
    if (
      m.version !== 1 ||
      !/^tp_[a-zA-Z0-9-]{1,80}$/.test(m.id) ||
      !Number.isFinite(Date.parse(m.createdAt)) ||
      !validPreferences(m.preferences) ||
      m.preferences.readiness === 'restricted' ||
      !Number.isInteger(m.day) ||
      m.day < 0 ||
      m.day >= m.preferences.days.length ||
      !Array.isArray(m.exercises) ||
      m.exercises.length !== workout.exercises.length ||
      m.exercises.length > 12
    )
      return null;
    if (
      !m.exercises.every((e, i) => {
        const movement = TRAINING_MOVEMENTS.find((item) => item.id === e.id);
        return (
          movement &&
          canUseMovement(movement, m.preferences) &&
          movement.name === workout.exercises[i].exerciseName &&
          Number.isInteger(e.min) &&
          e.min >= 1 &&
          Number.isInteger(e.max) &&
          e.max >= e.min &&
          e.max <= 30 &&
          Number.isInteger(e.rest) &&
          e.rest >= 30 &&
          e.rest <= 300 &&
          Number.isInteger(e.rir) &&
          e.rir >= 1 &&
          e.rir <= 4 &&
          Number.isInteger(workout.exercises[i].sets) &&
          workout.exercises[i].sets >= 1 &&
          workout.exercises[i].sets <= 8
        );
      })
    )
      return null;
    return m;
  } catch {
    return null;
  }
}
export function trainingRoutineDetails(
  workout: Workout,
): { repRange: string; restSeconds: number; rir: number; cue: string; compound: boolean }[] | null {
  const m = trainingMetadata(workout);
  if (!m) return null;
  return m.exercises.map((e) => ({
    repRange: `${e.min}–${e.max}`,
    restSeconds: e.rest,
    rir: e.rir,
    cue: TRAINING_MOVEMENTS.find((item) => item.id === e.id)!.cue,
    compound: TRAINING_MOVEMENTS.find((item) => item.id === e.id)!.compound,
  }));
}
export function trainingPlanWorkouts(
  plan: TrainingPlan,
  userId: string,
  history: Workout[],
  date: string,
): Omit<Workout, 'id'>[] {
  return plan.days.map((day) => {
    const metadata: PlanMetadata = {
      version: 1,
      id: plan.id,
      createdAt: plan.createdAt,
      day: day.index,
      preferences: plan.preferences,
      exercises: day.exercises.map((e) => ({
        id: e.movement.id,
        min: e.minReps,
        max: e.maxReps,
        rest: e.restSeconds,
        rir: e.rir,
      })),
    };
    const notes = PREFIX + JSON.stringify(metadata);
    if (notes.length > 2000) throw new Error('This plan is too large to save.');
    return {
      clientId: `${plan.id}.${day.index}`,
      kind: 'routine',
      userId,
      name: `Your plan · ${day.name}`,
      date,
      isPredefined: false,
      notes,
      exercises: day.exercises.map((e) => ({
        exerciseName: e.movement.name,
        muscleGroup: e.movement.muscleGroup,
        sets: e.sets,
        reps: e.minReps,
        weight: startingLoad(e, history, date).weight,
      })),
    };
  });
}
/** Server-synced routine records are the source of truth, including after signing in on another device. */
export function savedTrainingPlans(
  workouts: Workout[],
): { plan: TrainingPlan; savedDays: number }[] {
  const groups = new Map<string, { base: PlanMetadata; records: Map<number, Workout> }>();
  for (const workout of workouts.filter((w) => w.kind === 'routine')) {
    const m = trainingMetadata(workout);
    if (!m) continue;
    if (!groups.has(m.id)) groups.set(m.id, { base: m, records: new Map() });
    groups.get(m.id)!.records.set(m.day, workout);
  }
  const result: { plan: TrainingPlan; savedDays: number }[] = [];
  for (const { base, records } of groups.values()) {
    try {
      const plan = buildTrainingPlan(base.preferences, base.id, base.createdAt);
      for (const [index, workout] of records) {
        const m = trainingMetadata(workout)!;
        const exercises: TrainingExercise[] = m.exercises.map((e, i) => ({
          movement: TRAINING_MOVEMENTS.find((item) => item.id === e.id)!,
          sets: workout.exercises[i].sets,
          minReps: e.min,
          maxReps: e.max,
          restSeconds: e.rest,
          rir: e.rir,
        }));
        plan.days[index] = {
          ...plan.days[index],
          exercises: compoundsFirst(exercises),
          estimatedMinutes: estimateTrainingMinutes(exercises),
        };
      }
      result.push({ plan, savedDays: records.size });
    } catch {
      /* An edited or incompatible old record stays available as a normal routine. */
    }
  }
  return result.sort((a, b) => b.plan.createdAt.localeCompare(a.plan.createdAt));
}

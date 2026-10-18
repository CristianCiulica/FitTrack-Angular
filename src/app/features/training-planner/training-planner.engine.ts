import { Workout } from '../../core/models/workout.model';
import { exerciseKey } from '../../core/utils/workout-history';
import { isWorkoutSession } from '../../core/utils/workout-kind';
import { TRAINING_MOVEMENTS } from './training-movements';
import {
  TrainingDay,
  TrainingEquipment,
  TrainingExercise,
  TrainingMovement,
  TrainingMuscle,
  TrainingPattern,
  TrainingPlan,
  TrainingPreferences,
} from './training-planner.model';

export const TRAINING_SOURCES = [
  {
    label: 'ACSM · Resistance training position stand, 2026',
    url: 'https://doi.org/10.1249/MSS.0000000000003897',
  },
  {
    label: 'IUSCA · Hypertrophy position stand, 2021',
    url: 'https://doi.org/10.47206/ijsc.v1i1.81',
  },
];
const equipment: TrainingEquipment[] = [
  'dumbbells',
  'bench',
  'barbell',
  'machines',
  'cables',
  'bands',
  'pullup',
];
export function validPreferences(value: unknown): value is TrainingPreferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as TrainingPreferences;
  return (
    ['muscle', 'strength', 'recomp'].includes(p.goal) &&
    ['new', 'consistent', 'experienced'].includes(p.experience) &&
    Array.isArray(p.equipment) &&
    p.equipment.length <= equipment.length &&
    p.equipment.every((e) => equipment.includes(e)) &&
    Array.isArray(p.days) &&
    p.days.length >= 2 &&
    p.days.length <= 6 &&
    new Set(p.days).size === p.days.length &&
    p.days.every((d) => Number.isInteger(d) && d >= 0 && d < 7) &&
    [30, 45, 60, 75].includes(p.minutes) &&
    ['balanced', 'upper', 'lower', 'arms'].includes(p.focus) &&
    ['ready', 'returning', 'restricted'].includes(p.readiness)
  );
}
export function canUseMovement(m: TrainingMovement, p: TrainingPreferences): boolean {
  return m.equipment.every((e) => p.equipment.includes(e));
}
export function trainingBlocker(p: TrainingPreferences): string | null {
  if (!validPreferences(p)) return 'Complete your training preferences before building your plan.';
  if (p.readiness === 'restricted')
    return 'Pain, a current injury or medical restrictions need an individual assessment. Get guidance from a qualified clinician or trainer before building a general training plan here.';
  if (
    !p.equipment.some((e) =>
      ['dumbbells', 'barbell', 'machines', 'cables', 'bands', 'pullup'].includes(e),
    )
  )
    return 'A balanced hypertrophy plan needs a way to train your back with resistance. Add dumbbells, anchored bands, a pull-up bar or gym equipment to continue.';
  return null;
}
type SessionType = 'full' | 'upper' | 'lower' | 'push' | 'pull';
const templates: Record<SessionType, TrainingPattern[]> = {
  full: [
    'squat',
    'press',
    'row',
    'hinge',
    'pull',
    'lateral',
    'curl-leg',
    'biceps',
    'triceps',
    'calves',
    'core',
  ],
  upper: ['press', 'row', 'pull', 'incline', 'lateral', 'biceps', 'triceps', 'rear'],
  lower: ['squat', 'hinge', 'curl-leg', 'calves', 'core'],
  push: ['press', 'incline', 'lateral', 'triceps'],
  pull: ['pull', 'row', 'rear', 'biceps'],
};
const titles: Record<SessionType, string> = {
  full: 'Full body',
  upper: 'Upper body',
  lower: 'Lower body',
  push: 'Push',
  pull: 'Pull',
};
const emphasis: Record<SessionType, string> = {
  full: 'A balanced session for your whole body.',
  upper: 'Chest, back, shoulders and arms.',
  lower: 'Quads, posterior chain, calves and core.',
  push: 'Chest, side delts and triceps.',
  pull: 'Back, rear delts and biceps.',
};
function hasAdjacentDays(days: number[]): boolean {
  return days.some((d, i) => (days[(i + 1) % days.length] - d + 7) % 7 === 1);
}
function sessionLayout(p: TrainingPreferences): {
  types: SessionType[];
  split: string;
  reason: string;
} {
  const n = p.days.length;
  if (n >= 3 && p.equipment.every((e) => e === 'pullup' || e === 'bench'))
    return {
      types: Array.from({ length: n }, (_, i) => (i % 2 ? 'lower' : 'upper')),
      split: 'Upper / Lower',
      reason:
        'With a pull-up bar and bodyweight, upper and lower sessions make better use of your available movements than separate push and pull days. Start with the scheduled workload and add resistance as you outgrow it.',
    };
  if (n === 2 && hasAdjacentDays(p.days))
    return {
      types: ['upper', 'lower'],
      split: 'Upper / Lower',
      reason:
        'Your two days are consecutive, so upper and lower sessions separate the main muscle groups instead of repeating a full-body session the next day.',
    };
  if (n <= 3 && !hasAdjacentDays(p.days))
    return {
      types: Array(n).fill('full'),
      split: 'Full body',
      reason:
        'Full-body sessions spread the main movement patterns across your available days, with recovery days between sessions.',
    };
  if (n === 2)
    return {
      types: ['full', 'full'],
      split: 'Full body',
      reason:
        'Two full-body sessions cover the major muscle groups while keeping the weekly commitment manageable.',
    };
  if (n === 3)
    return {
      types: ['push', 'pull', 'lower'],
      split: 'Push / Pull / Legs',
      reason:
        'Your days include back-to-back sessions. A push, pull and legs split separates the main muscle groups; each gets one focused session this week.',
    };
  if (n === 4)
    return {
      types: ['upper', 'lower', 'upper', 'lower'],
      split: 'Upper / Lower',
      reason:
        'Four sessions distribute upper- and lower-body work across two exposures each, keeping sessions focused and repeatable.',
    };
  if (n === 5)
    return {
      types: ['upper', 'lower', 'push', 'pull', 'lower'],
      split: 'Upper / Lower + Push / Pull / Legs',
      reason:
        'Two upper-body exposures and two lower-body sessions distribute the weekly work across five days, without repeating the same session every day.',
    };
  return {
    types: ['push', 'pull', 'lower', 'push', 'pull', 'lower'],
    split: 'Push / Pull / Legs',
    reason:
      'A six-day split divides the workload into shorter, focused sessions. More days are a scheduling choice, not a guarantee of better growth.',
  };
}
function focusPattern(pattern: TrainingPattern, p: TrainingPreferences): boolean {
  return (
    (p.focus === 'upper' && ['press', 'incline', 'row', 'pull'].includes(pattern)) ||
    (p.focus === 'lower' && ['squat', 'hinge', 'curl-leg'].includes(pattern)) ||
    (p.focus === 'arms' && ['lateral', 'rear', 'biceps', 'triceps'].includes(pattern))
  );
}
function movementFor(
  pattern: TrainingPattern,
  p: TrainingPreferences,
  variant: number,
  used: Set<string>,
): TrainingMovement | undefined {
  let candidates = TRAINING_MOVEMENTS.filter(
    (m) => m.pattern === pattern && canUseMovement(m, p) && !used.has(m.id),
  );
  // A row is an explicit lat-training fallback when no overhead pulling setup is available.
  if (!candidates.length && pattern === 'row')
    candidates = TRAINING_MOVEMENTS.filter(
      (m) => m.pattern === 'pull' && canUseMovement(m, p) && !used.has(m.id),
    );
  if (!candidates.length && pattern === 'pull')
    candidates = TRAINING_MOVEMENTS.filter(
      (m) => m.pattern === 'row' && canUseMovement(m, p) && !used.has(m.id),
    );
  if (!candidates.length && pattern === 'incline')
    candidates = TRAINING_MOVEMENTS.filter(
      (m) => m.pattern === 'press' && canUseMovement(m, p) && !used.has(m.id),
    );
  if (p.experience === 'new' || p.readiness === 'returning')
    candidates.sort((a, b) => Number(a.id.startsWith('bb-')) - Number(b.id.startsWith('bb-')));
  // Variety is deliberate and small; a weekly program stays identical until the user edits it.
  return candidates[Math.min(variant % 2, candidates.length - 1)];
}
function prescription(m: TrainingMovement, p: TrainingPreferences): TrainingExercise {
  const returning = p.readiness === 'returning';
  const strength = p.goal === 'strength' && m.compound && p.experience !== 'new' && !returning;
  let minReps = m.compound ? 6 : 10,
    maxReps = m.compound ? 10 : 15;
  if (strength) {
    minReps = 4;
    maxReps = 6;
  }
  if (['lateral', 'rear', 'calves'].includes(m.pattern)) {
    minReps = 12;
    maxReps = 20;
  }
  if (m.equipment.length === 0) {
    minReps = 8;
    maxReps = 20;
  }
  if (m.id === 'ham-walkout') {
    minReps = 6;
    maxReps = 10;
  }
  if (m.id === 'dead-bug') {
    minReps = 6;
    maxReps = 10;
  }
  return {
    movement: m,
    sets: 2,
    minReps,
    maxReps,
    restSeconds: m.compound ? (strength ? 180 : 120) : 75,
    rir: returning || p.experience === 'new' ? 3 : 2,
  };
}
/** Includes warm-up, exercise transitions, rest and both sides of unilateral work. */
export function estimateTrainingMinutes(exercises: TrainingExercise[]): number {
  const seconds =
    300 +
    exercises.reduce(
      (sum, e) =>
        sum +
        e.sets * e.maxReps * 3 * (e.movement.unilateral ? 2 : 1) +
        Math.max(0, e.sets - 1) * e.restSeconds +
        75 +
        (e.movement.compound ? 75 : 0),
      0,
    );
  return Math.ceil(seconds / 60);
}
function volumeFor(days: TrainingDay[], muscle: TrainingMuscle): number {
  return days.reduce(
    (sum, d) =>
      sum +
      d.exercises.filter((e) => e.movement.primary === muscle).reduce((n, e) => n + e.sets, 0),
    0,
  );
}
export function trainingVolume(
  plan: TrainingPlan,
): { muscle: TrainingMuscle; direct: number; support: number }[] {
  const muscles: TrainingMuscle[] = [
    'Chest',
    'Back',
    'Quads',
    'Hamstrings',
    'Glutes',
    'Side delts',
    'Rear delts',
    'Biceps',
    'Triceps',
    'Calves',
    'Abs',
  ];
  return muscles.map((muscle) => ({
    muscle,
    direct: volumeFor(plan.days, muscle),
    support: plan.days.reduce(
      (sum, d) =>
        sum +
        d.exercises
          .filter((e) => e.movement.secondary.includes(muscle))
          .reduce((n, e) => n + e.sets, 0),
      0,
    ),
  }));
}
export function buildTrainingPlan(
  preferences: TrainingPreferences,
  id: string = `tp_${crypto.randomUUID()}`,
  createdAt = new Date().toISOString(),
): TrainingPlan {
  const blocked = trainingBlocker(preferences);
  if (blocked) throw new Error(blocked);
  const p = {
    ...preferences,
    equipment: [...new Set(preferences.equipment)],
    days: [...preferences.days].sort((a, b) => a - b),
  };
  const layout = sessionLayout(p);
  const days: TrainingDay[] = layout.types.map((type, index) => {
    const used = new Set<string>();
    let patterns = [...templates[type]];
    // Full-body A/B alternates horizontal and vertical pulling; never doubles a row just to fill a slot.
    if (type === 'full')
      patterns = patterns.filter((pattern) => pattern !== (index % 2 ? 'row' : 'pull'));
    if (type === 'full' && index % 2)
      patterns = patterns.map((pattern) => (pattern === 'press' ? 'incline' : pattern));
    const essential = type === 'full' ? 4 : type === 'upper' ? 3 : type === 'lower' ? 3 : 2;
    const extras = patterns
      .slice(essential)
      .sort((a, b) => Number(focusPattern(b, p)) - Number(focusPattern(a, p)));
    patterns = [...patterns.slice(0, essential), ...extras];
    const exercises: TrainingExercise[] = [];
    for (const pattern of patterns) {
      const movement = movementFor(pattern, p, index >= 2 ? 1 : 0, used);
      if (!movement) continue;
      const exercise = prescription(movement, p);
      if (estimateTrainingMinutes([...exercises, exercise]) > p.minutes) continue;
      used.add(movement.id);
      exercises.push(exercise);
    }
    return {
      index,
      weekday: p.days[index],
      name:
        titles[type] +
        ' ' +
        String.fromCharCode(65 + layout.types.slice(0, index).filter((t) => t === type).length),
      emphasis: emphasis[type],
      exercises,
      estimatedMinutes: estimateTrainingMinutes(exercises),
    };
  });
  // Add useful sets within the session time and a conservative direct-set ceiling.
  // Secondary work is displayed separately rather than being counted as full direct sets.
  const baseCap =
    p.readiness === 'returning' || p.experience === 'new'
      ? 8
      : p.experience === 'consistent'
        ? 12
        : 14;
  for (let pass = 0; pass < 2; pass++)
    for (const day of days) {
      const ordered = [...day.exercises].sort(
        (a, b) =>
          Number(focusPattern(b.movement.pattern, p)) -
            Number(focusPattern(a.movement.pattern, p)) ||
          Number(b.movement.compound) - Number(a.movement.compound),
      );
      for (const exercise of ordered) {
        const maxSets = p.readiness === 'returning' ? 2 : p.experience === 'new' ? 3 : 4;
        const target =
          Math.max(4, baseCap - (p.goal === 'recomp' ? 2 : 0)) +
          (focusPattern(exercise.movement.pattern, p) ? 2 : 0);
        if (exercise.sets >= maxSets || volumeFor(days, exercise.movement.primary) >= target)
          continue;
        exercise.sets++;
        const sameMuscle = day.exercises
          .filter((e) => e.movement.primary === exercise.movement.primary)
          .reduce((sum, e) => sum + e.sets, 0);
        if (estimateTrainingMinutes(day.exercises) > p.minutes || sameMuscle > 8) exercise.sets--;
      }
      day.estimatedMinutes = estimateTrainingMinutes(day.exercises);
    }
  const notes: string[] = [];
  if (p.minutes === 30)
    notes.push(
      'Thirty-minute sessions prioritise the main movements. Some smaller muscles get supporting work rather than a dedicated isolation exercise.',
    );
  if (p.experience === 'new' && p.days.length > 4)
    notes.push(
      'You selected a frequent schedule. Two to four well-recovered sessions can also build a strong foundation; reduce your days if consistency or recovery suffers.',
    );
  if (p.readiness === 'returning')
    notes.push(
      'Return with two working sets per exercise and about three good repetitions left. Rebuild consistency before adding sets or chasing your old loads.',
    );
  if (p.goal === 'recomp')
    notes.push(
      'The plan keeps resistance training challenging while limiting extra volume. Adjust food intake separately; a workout cannot guarantee fat loss or spot reduction.',
    );
  if (!p.equipment.some((e) => ['machines', 'cables', 'bands', 'pullup'].includes(e)))
    notes.push(
      'Your equipment supports rows but no overhead pull. Rows cover the back here; add a pull-up bar or anchored bands for another pulling direction.',
    );
  if (p.equipment.length === 1 && p.equipment[0] === 'pullup')
    notes.push(
      'Lower-body and pressing work use bodyweight progressions. Add adjustable resistance when the top of the rep range becomes easy.',
    );
  if (hasAdjacentDays(p.days))
    notes.push(
      'Your schedule includes consecutive days. Keep the planned split order; if fatigue carries over, move a session or take an extra rest day rather than forcing it.',
    );
  return {
    id,
    createdAt,
    preferences: p,
    split: layout.split,
    rationale: layout.reason,
    days,
    notes,
  };
}
export function trainingAlternatives(
  exercise: TrainingExercise,
  day: TrainingDay,
  p: TrainingPreferences,
): TrainingMovement[] {
  return TRAINING_MOVEMENTS.filter(
    (m) =>
      m.id !== exercise.movement.id &&
      m.pattern === exercise.movement.pattern &&
      m.primary === exercise.movement.primary &&
      canUseMovement(m, p) &&
      !day.exercises.some((e) => e.movement.id === m.id),
  );
}
export function swapTrainingMovement(
  plan: TrainingPlan,
  dayIndex: number,
  exerciseIndex: number,
  movementId: string,
): TrainingPlan {
  const day = plan.days[dayIndex],
    exercise = day?.exercises[exerciseIndex];
  if (!exercise) throw new Error('Exercise not found.');
  const movement = trainingAlternatives(exercise, day, plan.preferences).find(
    (m) => m.id === movementId,
  );
  if (!movement) throw new Error('This exercise does not match the equipment and training role.');
  const replacement = { ...prescription(movement, plan.preferences), sets: exercise.sets };
  const exercises = day.exercises.map((e, i) => (i === exerciseIndex ? replacement : e));
  if (estimateTrainingMinutes(exercises) > plan.preferences.minutes)
    throw new Error(
      'This alternative needs more time. Choose another movement or edit your session length.',
    );
  return {
    ...plan,
    days: plan.days.map((d, i) =>
      i === dayIndex
        ? { ...d, exercises, estimatedMinutes: estimateTrainingMinutes(exercises) }
        : d,
    ),
  };
}
export function startingLoad(
  exercise: TrainingExercise,
  history: Workout[],
  onDate: string,
): { weight: number; label: string } {
  const records = [...history]
    .filter((w) => isWorkoutSession(w) && w.date.slice(0, 10) <= onDate)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );
  const recent = records.find(
    (w) =>
      (Date.parse(onDate) - Date.parse(w.date.slice(0, 10))) / 86400000 <= 42 &&
      w.exercises.some(
        (e) => exerciseKey(e.exerciseName) === exerciseKey(exercise.movement.name) && e.sets > 0,
      ),
  );
  const found = recent?.exercises.find(
    (e) => exerciseKey(e.exerciseName) === exerciseKey(exercise.movement.name) && e.sets > 0,
  );
  const weight = found?.setWeights?.[0] ?? found?.weight;
  if (
    weight != null &&
    Number.isFinite(weight) &&
    weight > 0 &&
    weight <= 1000 &&
    exercise.movement.equipment.length &&
    exercise.movement.id !== 'pullup'
  ) {
    const returning = exercise.rir === 3;
    return {
      weight,
      label: returning
        ? 'Previous load for reference. Start lighter after a break and calibrate in warm-up; this is not a prescribed weight.'
        : 'Reference from your recent log. Confirm the load and reps in warm-up.',
    };
  }
  return {
    weight: 0,
    label: exercise.movement.equipment.length
      ? 'Choose the load in warm-up. Aim for the target reps with good form and the planned reps in reserve.'
      : 'Start with bodyweight. Adjust leverage or assistance to stay in the target range.',
  };
}

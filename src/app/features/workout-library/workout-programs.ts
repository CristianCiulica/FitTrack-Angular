import {
  PlannedExercise,
  WorkoutRoutine,
  orderRoutineExercises,
  ProgramSessionContext,
  isCompoundExercise,
} from '../../core/models/workout-routine.model';
import { Workout } from '../../core/models/workout.model';
import {
  ProgramEnrollment,
  offsetDay,
  readProgramEnrollment,
  readProgramSession,
  validProgramContext,
} from '../../core/utils/program-records';
import { isTimedCardioOnly, treadmillSeconds } from '../../core/utils/timed-cardio';
import { indoorCardio } from '../../core/utils/indoor-cardio';
import { TRAINING_MOVEMENTS } from '../training-planner/training-movements';

export interface ProgramCardio {
  mode: 'walking' | 'running';
  minutes: number;
  effort: string;
  instructions: string;
}
export interface ProgramDay {
  id: string;
  type: 'strength' | 'cardio' | 'rest';
  title: string;
  subtitle: string;
  routine?: WorkoutRoutine;
  cardio?: ProgramCardio;
}
export interface WorkoutProgram {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  audience: string;
  goal: 'muscle' | 'fat-loss' | 'busy' | 'glutes' | 'home';
  gymDays: number;
  minutes: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  equipment: string;
  accent: string;
  icon: 'build' | 'lean' | 'busy' | 'aesthetic' | 'glutes' | 'home';
  highlights: string[];
  guidance: string[];
  week: ProgramDay[];
}
export const PROGRAM_PHASES = [
  {
    title: 'Find your starting point',
    detail:
      'Learn the sessions. Start near the lower end of each rep range with about three good reps left.',
  },
  {
    title: 'Build the repetitions',
    detail:
      'Keep the same movements. Add a rep where you can while preserving control and range of motion.',
  },
  {
    title: 'Progress with intent',
    detail:
      'When all sets reach the top of the range with the planned reserve, try the smallest available load increase.',
  },
  {
    title: 'Make it repeatable',
    detail:
      'Consolidate your progress. If fatigue persists or performance drops, use fewer sets and easier effort for a week.',
  },
];
function exercise(id: string, sets = 3, min = 8, max = 12): PlannedExercise {
  const m = TRAINING_MOVEMENTS.find((e) => e.id === id);
  if (!m) throw new Error('Unknown program exercise: ' + id);
  return {
    name: m.name,
    sets,
    reps: min,
    repRange: `${min}–${max}`,
    weight: 0,
    muscleGroup: m.muscleGroup,
    compound: m.compound,
    cue: m.cue,
    restSeconds: m.compound ? 120 : 75,
    rir: 2,
  };
}
function custom(
  name: string,
  muscleGroup: PlannedExercise['muscleGroup'],
  sets: number,
  min: number,
  max: number,
  compound: boolean,
  cue: string,
): PlannedExercise {
  return {
    name,
    muscleGroup,
    sets,
    reps: min,
    repRange: `${min}–${max}`,
    weight: 0,
    compound,
    cue,
    restSeconds: compound ? 120 : 75,
    rir: 2,
  };
}
const hipThrust = () =>
  custom(
    'Hip Thrust (Machine or Barbell)',
    'Legs',
    3,
    8,
    12,
    true,
    'Use a secure padded setup. Keep ribs down, drive through the feet and finish with your hips extended without arching the lower back.',
  );
const abduction = () =>
  custom(
    'Hip Abduction (Machine)',
    'Legs',
    2,
    15,
    20,
    false,
    'Set a comfortable starting position. Open the knees under control and return slowly without bouncing the stack.',
  );
const kickback = () =>
  custom(
    'Cable Glute Kickback (each leg)',
    'Legs',
    2,
    12,
    15,
    false,
    'Use an ankle attachment and a stable support. Move through the hip without arching the lower back; match reps on both sides.',
  );
function strength(
  id: string,
  title: string,
  subtitle: string,
  exercises: PlannedExercise[],
): ProgramDay {
  return {
    id,
    type: 'strength',
    title,
    subtitle,
    routine: {
      name: title,
      description: subtitle,
      exercises: orderRoutineExercises(
        exercises.map((e) => ({
          ...e,
          restSeconds: e.restSeconds ?? (isCompoundExercise(e) ? 120 : 75),
        })),
      ),
    },
  };
}
const rest = (id: string): ProgramDay => ({
  id,
  type: 'rest',
  title: 'Recover & reset',
  subtitle: 'Rest from lifting. Easy everyday movement is welcome.',
});
function cardio(id: string, minutes: number): ProgramDay {
  return {
    id,
    type: 'cardio',
    title: 'Easy treadmill cardio',
    subtitle: `${minutes} min · conversational effort`,
    cardio: {
      mode: 'walking',
      minutes,
      effort: 'Comfortably conversational',
      instructions:
        'Begin and finish easily. Choose a walking speed and optional gentle incline that let you speak in full sentences. Reduce the pace if the effort climbs; do not chase a calorie target.',
    },
  };
}
export function workoutPrograms(
  aesthetics: WorkoutRoutine[],
  home: WorkoutRoutine[],
): WorkoutProgram[] {
  const upperA = strength('upper-a', 'Upper A', 'Balanced pressing, pulling and arms.', [
    exercise('machine-press'),
    exercise('chest-row'),
    exercise('pulldown'),
    exercise('db-lateral', 2, 12, 20),
    exercise('cable-curl', 2, 10, 15),
    exercise('pushdown', 2, 10, 15),
  ]);
  const upperB = strength(
    'upper-b',
    'Upper B',
    'A second exposure with a different press and row.',
    [
      exercise('incline-db'),
      exercise('cable-row'),
      exercise('cable-pulldown'),
      exercise('cable-lateral', 2, 12, 20),
      exercise('reverse-fly', 2, 12, 20),
      exercise('db-curl', 2, 10, 15),
      exercise('db-triceps', 2, 10, 15),
    ],
  );
  const lowerA = strength('lower-a', 'Lower A', 'Quads, hamstrings, calves and core.', [
    exercise('leg-press'),
    exercise('db-rdl'),
    exercise('leg-curl'),
    exercise('calf-machine', 3, 12, 20),
    exercise('reverse-crunch', 2, 10, 15),
  ]);
  const lowerB = strength('lower-b', 'Lower B', 'Single-leg control and posterior-chain work.', [
    exercise('db-split-squat', 3, 8, 10),
    exercise('bb-rdl'),
    exercise('leg-curl', 2, 10, 15),
    exercise('db-calf', 3, 12, 20),
    exercise('cable-crunch', 2, 10, 15),
  ]);
  const fullA = strength(
    'full-a',
    'Full body A',
    'The essentials, then a small amount of supporting work.',
    [
      exercise('leg-press'),
      exercise('db-press'),
      exercise('cable-row'),
      exercise('db-rdl', 2),
      exercise('db-lateral', 2, 12, 20),
    ],
  );
  const fullB = strength('full-b', 'Full body B', 'A repeatable second full-body session.', [
    exercise('goblet-squat'),
    exercise('incline-db'),
    exercise('pulldown'),
    exercise('leg-curl', 2, 10, 15),
    exercise('reverse-crunch', 2, 10, 15),
  ]);
  const fullC = strength(
    'full-c',
    'Full body C',
    'Practice the main patterns and finish the week strong.',
    [
      exercise('db-rdl'),
      exercise('machine-press'),
      exercise('chest-row'),
      exercise('db-split-squat', 2, 8, 10),
      exercise('cable-lateral', 2, 12, 20),
    ],
  );
  const common = [
    'Calibrate loads during warm-up. The listed sets are working sets, not warm-ups.',
    'Keep the exercise order: compound movements first, isolation work afterward.',
    'A missed day is not a failed plan. Resume the next unfinished session and take recovery when needed.',
  ];
  return [
    {
      id: 'build-30',
      title: 'Build · 30',
      eyebrow: 'HYPERTROPHY',
      description:
        'A clear month of upper/lower training. Four focused gym days with room to recover.',
      audience:
        'For lifters comfortable with the main movements who want a structured muscle-building block.',
      goal: 'muscle',
      gymDays: 4,
      minutes: '45–60',
      level: 'Intermediate',
      equipment: 'Full gym',
      accent: 'build',
      icon: 'build',
      highlights: [
        'Upper / Lower twice weekly',
        'Clear rep ranges & progression',
        'Two easy cardio sessions',
      ],
      guidance: common,
      week: [
        upperA,
        lowerA,
        cardio('cardio-a', 20),
        upperB,
        lowerB,
        cardio('cardio-b', 25),
        rest('rest'),
      ],
    },
    {
      id: 'lean-30',
      title: 'Lean & Strong',
      eyebrow: 'STRENGTH + CARDIO',
      description:
        'Three lifting days and two cardio sessions, organised into one sustainable month.',
      audience: 'For people pursuing fat loss while keeping resistance training in their routine.',
      goal: 'fat-loss',
      gymDays: 3,
      minutes: '35–55',
      level: 'Beginner',
      equipment: 'Full gym + treadmill',
      accent: 'lean',
      icon: 'lean',
      highlights: [
        'Three full-body sessions',
        'Two conversational cardio days',
        'Recovery built into the week',
      ],
      guidance: [
        'Fat loss depends on energy balance over time. This plan supports activity and muscle retention; it does not promise a particular weight change.',
        'Start cardio at an effort that allows full sentences. Build duration gradually rather than forcing speed or incline.',
        ...common,
      ],
      week: [
        fullA,
        cardio('cardio-a', 25),
        fullB,
        rest('rest-a'),
        fullC,
        cardio('cardio-b', 30),
        rest('rest-b'),
      ],
    },
    {
      id: 'busy-30',
      title: 'Busy, Still Strong',
      eyebrow: 'TWO GYM DAYS',
      description:
        'Two compact sessions that cover the essentials. Built for the week you actually have.',
      audience: 'For busy people, new lifters and anyone returning to a consistent routine.',
      goal: 'busy',
      gymDays: 2,
      minutes: '30–40',
      level: 'Beginner',
      equipment: 'Gym',
      accent: 'busy',
      icon: 'busy',
      highlights: [
        'Just two gym visits',
        'Four main movements per session',
        'Short walks between lifting days',
      ],
      guidance: [
        'Start with two working sets and about three reps in reserve. Repeat the same sessions so progress is easy to see.',
        'Choose an easy treadmill pace on walking days. Adjust your duration before starting the timer.',
        ...common,
      ],
      week: [
        strength('full-a', 'Essentials A', 'Squat, press, row and hinge.', [
          exercise('leg-press', 2),
          exercise('machine-press', 2),
          exercise('chest-row', 2),
          exercise('db-rdl', 2),
        ]),
        rest('rest-a'),
        cardio('cardio-a', 20),
        strength('full-b', 'Essentials B', 'A second exposure to the main patterns.', [
          exercise('goblet-squat', 2),
          exercise('incline-db', 2),
          exercise('pulldown', 2),
          exercise('leg-curl', 2, 10, 15),
        ]),
        rest('rest-b'),
        cardio('cardio-b', 20),
        rest('rest-c'),
      ],
    },
    {
      id: 'aesthetics-30',
      title: 'Aesthetics',
      eyebrow: 'PUSH / PULL / LEGS',
      description:
        'Your familiar sessions, organised into a month. Compounds lead; detail work finishes.',
      audience:
        'For experienced lifters who prefer your established Push / Pull / Legs sessions and can recover from the higher session volume.',
      goal: 'muscle',
      gymDays: 3,
      minutes: '50–75',
      level: 'Advanced',
      equipment: 'Full gym',
      accent: 'aesthetic',
      icon: 'aesthetic',
      highlights: [
        'Your Push / Pull / Legs split',
        'Extra upper-chest & biceps work',
        'Your existing sets are preserved',
      ],
      guidance: [
        'This is the higher-volume option. If you are new or fatigue carries into the next session, begin with Build · 30 or reduce accessory sets.',
        'The existing exercises and set counts are retained; choose your own working loads and allow extra time when needed.',
        ...common,
      ],
      week: [
        strength(
          'push',
          'PUSH',
          'Chest, shoulders and triceps.',
          aesthetics[0]?.exercises ?? upperA.routine!.exercises,
        ),
        cardio('cardio-a', 20),
        strength(
          'pull',
          'PULL',
          'Back, rear delts and biceps.',
          aesthetics[1]?.exercises ?? upperB.routine!.exercises,
        ),
        rest('rest-a'),
        strength(
          'legs',
          'LEGS',
          'Legs, calves and core.',
          aesthetics[2]?.exercises ?? lowerA.routine!.exercises,
        ),
        cardio('cardio-b', 20),
        rest('rest-b'),
      ],
    },
    {
      id: 'glutes-30',
      title: 'Glute Focus',
      eyebrow: 'LOWER-BODY PRIORITY',
      description:
        'Two complementary lower-body days, one complete upper session and sensible recovery.',
      audience:
        'For anyone prioritising glute development while keeping upper-body and leg training balanced.',
      goal: 'glutes',
      gymDays: 3,
      minutes: '45–60',
      level: 'Beginner',
      equipment: 'Full gym',
      accent: 'glutes',
      icon: 'glutes',
      highlights: [
        'Two lower-body exposures',
        'Hip extension, squat & unilateral work',
        'Upper-body training stays in',
      ],
      guidance: [
        'Use loads you can control without compensating through the lower back. A comfortable range matters more than forcing depth.',
        'Add reps before load. Avoid adding extra glute work simply because the target muscle is your priority.',
        ...common,
      ],
      week: [
        strength('lower-a', 'Glutes & Legs A', 'Hip extension, quads and hamstrings.', [
          hipThrust(),
          exercise('leg-press'),
          exercise('leg-curl'),
          abduction(),
          exercise('calf-machine', 2, 12, 20),
        ]),
        cardio('cardio-a', 20),
        upperA,
        rest('rest-a'),
        strength('lower-b', 'Glutes & Legs B', 'Hinge, single-leg work and a controlled finish.', [
          exercise('db-rdl'),
          exercise('db-split-squat', 3, 8, 10),
          hipThrust(),
          kickback(),
          exercise('reverse-crunch', 2, 10, 15),
        ]),
        cardio('cardio-b', 20),
        rest('rest-b'),
      ],
    },
    {
      id: 'home-30',
      title: 'Home Foundations',
      eyebrow: 'UPPER / LOWER AT HOME',
      description: 'A four-day upper/lower rhythm with dumbbells and a way to train your back.',
      audience: 'For people training at home with dumbbells and secure pulling equipment.',
      goal: 'home',
      gymDays: 4,
      minutes: '35–55',
      level: 'Beginner',
      equipment: 'Dumbbells + pull-up bar or bands',
      accent: 'home',
      icon: 'home',
      highlights: [
        'Upper / Lower structure',
        'Your home sessions in one plan',
        'Reps, timed holds & recovery',
      ],
      guidance: [
        'Use a secure pull-up bar or anchored bands for pulling. Never improvise an unstable support.',
        'If your dumbbells become too light at the top of the range, use a controlled harder variation or add resistance.',
        ...common,
      ],
      week: [
        strength(
          'upper-a',
          'Upper Home A',
          'Pressing, pulling, shoulders and arms.',
          home[0]?.exercises ?? [
            exercise('pushup'),
            exercise('db-row'),
            exercise('pullup'),
            exercise('db-lateral', 2, 12, 20),
            exercise('db-curl', 2, 10, 15),
          ],
        ),
        strength(
          'lower-a',
          'Lower Home A',
          'Legs, posterior chain and core.',
          home[1]?.exercises ?? [
            exercise('goblet-squat'),
            exercise('db-rdl'),
            exercise('db-split-squat', 2, 8, 10),
            exercise('db-calf', 2, 12, 20),
            exercise('reverse-crunch', 2, 10, 15),
          ],
        ),
        rest('rest-a'),
        strength(
          'upper-b',
          'Upper Home B',
          'Repeat the upper session and build your reps.',
          home[0]?.exercises ?? [
            exercise('pushup'),
            exercise('db-row'),
            exercise('pullup'),
            exercise('db-lateral', 2, 12, 20),
            exercise('db-curl', 2, 10, 15),
          ],
        ),
        strength(
          'lower-b',
          'Lower Home B',
          'Repeat the lower session with consistent technique.',
          home[1]?.exercises ?? [
            exercise('goblet-squat'),
            exercise('db-rdl'),
            exercise('db-split-squat', 2, 8, 10),
            exercise('db-calf', 2, 12, 20),
            exercise('reverse-crunch', 2, 10, 15),
          ],
        ),
        cardio('cardio-a', 20),
        rest('rest-b'),
      ],
    },
  ];
}
export function programRoutine(
  program: WorkoutProgram,
  dayIndex: number,
  enrollment: ProgramEnrollment,
): WorkoutRoutine {
  if (
    enrollment.programId !== program.id ||
    !validProgramContext({
      enrollmentId: enrollment.id,
      programId: program.id,
      dayIndex,
      sessionId: 'check',
    })
  )
    throw new Error('Invalid plan session.');
  const day = program.week[dayIndex % 7];
  if (enrollment.stoppedAt || day.type === 'rest')
    throw new Error('This day is not available to train.');
  const routine = day.routine ?? {
    name: day.title,
    exercises: [
      {
        name: 'Treadmill walk',
        sets: 1,
        reps: 1,
        weight: 0,
        muscleGroup: 'Cardio' as const,
        activity: 'treadmill' as const,
        durationMinutes: day.cardio!.minutes,
      },
    ],
  };
  const context: ProgramSessionContext = {
    enrollmentId: enrollment.id,
    programId: program.id,
    dayIndex,
    sessionId: day.id,
  };
  return {
    ...routine,
    name: program.title + ' · ' + day.title,
    program: context,
    exercises: orderRoutineExercises(
      routine.exercises.map((e) => ({
        ...e,
        weight: 0,
        rir: dayIndex < 7 ? 3 : 2,
        restSeconds: e.restSeconds ?? (isCompoundExercise(e) ? 120 : 75),
      })),
    ),
  };
}
export function programCompletions(
  enrollment: ProgramEnrollment,
  workouts: Workout[],
  program?: WorkoutProgram,
): Map<number, { complete: boolean; date: string }> {
  const result = new Map<number, { complete: boolean; date: string }>();
  const cardioSeconds = new Map<number, number>();
  const seen = new Set<string>();
  for (const workout of workouts) {
    const key = workout.clientId ?? workout.id;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const strength = readProgramSession(workout),
      cardio = indoorCardio(workout);
    const context = strength ?? cardio?.program;
    if (
      !context ||
      context.enrollmentId !== enrollment.id ||
      context.programId !== enrollment.programId
    )
      continue;
    const planned = program?.week[context.dayIndex % 7];
    if (
      planned &&
      (planned.id !== context.sessionId ||
        planned.type !== (isTimedCardioOnly(workout) || cardio ? 'cardio' : 'strength'))
    )
      continue;
    if (isTimedCardioOnly(workout)) {
      const seconds = (cardioSeconds.get(context.dayIndex) ?? 0) + treadmillSeconds(workout);
      cardioSeconds.set(context.dayIndex, seconds);
      result.set(context.dayIndex, {
        complete: seconds >= (planned?.cardio?.minutes ?? 1) * 60,
        date: workout.date,
      });
    } else if (strength) {
      if (!result.get(context.dayIndex)?.complete)
        result.set(context.dayIndex, { complete: strength.completed, date: workout.date });
    } else if (cardio) {
      const seconds =
        (cardioSeconds.get(context.dayIndex) ?? 0) +
        (Date.parse(cardio.endedAt) - Date.parse(cardio.startedAt)) / 1000;
      cardioSeconds.set(context.dayIndex, seconds);
      result.set(context.dayIndex, {
        complete: seconds >= (planned?.cardio?.minutes ?? 0) * 60,
        date: workout.date,
      });
    }
  }
  return result;
}
export function programCalendar(
  program: WorkoutProgram,
  enrollment: ProgramEnrollment,
  workouts: Workout[],
  today: string,
) {
  const completions = programCompletions(enrollment, workouts, program);
  return Array.from({ length: 30 }, (_, index) => {
    const day = program.week[index % 7],
      date = offsetDay(enrollment.startDate, index),
      log = completions.get(index);
    return {
      index,
      date,
      day,
      done: !!log?.complete,
      partial: !!log && !log.complete,
      today: date === today,
      future: date > today,
    };
  });
}
export function programEnrollments(workouts: Workout[]): ProgramEnrollment[] {
  return workouts
    .map(readProgramEnrollment)
    .filter((e): e is ProgramEnrollment => !!e)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

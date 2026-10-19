import { z } from 'zod';
import { MUSCLE_GROUPS } from '../models/workout.model';

export const clientIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9_.:-]+$/);
const dateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  const day = value.slice(0, 10);
  return (
    Number.isFinite(Date.parse(value)) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
  );
}, 'Invalid calendar date');
const instantSchema = z.string().datetime({ offset: true });

export const exerciseSchema = z
  .object({
    exerciseName: z.string().trim().min(1).max(120),
    muscleGroup: z.enum(MUSCLE_GROUPS),
    sets: z.number().int().min(0).max(50),
    reps: z.number().int().min(0).max(500),
    repUnit: z.literal('seconds').optional(),
    weight: z.number().finite().min(0).max(1000),
    dropSets: z.array(z.object({
      setIndex: z.number().int().min(0).max(49),
      weight: z.number().finite().min(0).max(1000),
      reps: z.number().int().min(1).max(500),
    })).max(50).optional(),
    setWeights: z.array(z.number().finite().min(0).max(1000)).max(50).optional(),
    setReps: z.array(z.number().int().min(0).max(500)).max(50).optional(),
  })
  .superRefine((exercise, ctx) => {
    if (exercise.dropSets?.some((drop, i, drops) =>
      exercise.repUnit === 'seconds' || drop.setIndex >= exercise.sets ||
      drops.findIndex(d => d.setIndex === drop.setIndex) !== i ||
      drop.weight >= (exercise.setWeights?.[drop.setIndex] ?? exercise.weight))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dropSets'], message: 'Drop sets require a unique parent set and a lower weight' });
    }
    for (const field of ['setWeights', 'setReps'] as const) {
      if (exercise[field] && exercise[field]!.length !== exercise.sets) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: 'Provide one value per set',
        });
      }
    }
  });

export const workoutBodySchema = z.object({
  clientId: clientIdSchema.optional(),
  kind: z.enum(['routine', 'session']).optional(),
  name: z.string().trim().min(1).max(120),
  date: dateSchema,
  durationSeconds: z.number().int().min(0).max(604800).optional(),
  notes: z.string().max(2000).optional(),
  isPredefined: z.boolean().optional(),
  exercises: z.array(exerciseSchema).max(50),
});

export const sessionBodySchema = z
  .object({
    clientId: clientIdSchema.optional(),
    mode: z.enum(['running', 'walking']),
    startedAt: instantSchema,
    endedAt: instantSchema,
    durationSeconds: z.number().int().min(0).max(604800),
    distanceMeters: z.number().finite().min(0).max(500000),
    steps: z.number().int().min(0).max(200000),
    averageSpeedKmh: z.number().finite().min(0).max(200),
    calories: z.number().finite().min(0).max(20000),
    route: z
      .array(
        z.tuple([z.number().finite().min(-90).max(90), z.number().finite().min(-180).max(180)]),
      )
      .max(5000)
      .optional()
      .default([]),
  })
  .superRefine((session, ctx) => {
    const elapsed = (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000;
    if (elapsed < 0 || session.durationSeconds > elapsed + 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endedAt'],
        message: 'Session time range is inconsistent',
      });
    }
  });

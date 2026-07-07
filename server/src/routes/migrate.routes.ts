import { Router } from 'express';
import { z } from 'zod';
import { Workout, MUSCLE_GROUPS } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';
import { UserProfile } from '../models/user-profile.model';
import { strictLimiter } from '../middleware/rate-limit';

const router = Router();

const exerciseSchema = z.object({
  exerciseName: z.string().trim().min(1),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  sets: z.number().min(0).max(50),
  reps: z.number().min(0).max(500),
  weight: z.number().min(0).max(1000),
});

const migrationSchema = z.object({
  workouts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        date: z.string().min(1),
        notes: z.string().max(2000).optional().default(''),
        isPredefined: z.boolean().optional().default(false),
        exercises: z.array(exerciseSchema).max(50).default([]),
      }),
    )
    .max(500)
    .default([]),
  runningSessions: z
    .array(
      z.object({
        mode: z.enum(['running', 'walking']),
        startedAt: z.string().min(1),
        endedAt: z.string().min(1),
        durationSeconds: z.number().min(0).max(604800),
        distanceMeters: z.number().min(0).max(500000),
        steps: z.number().min(0).max(200000),
        averageSpeedKmh: z.number().min(0),
        calories: z.number().min(0).max(20000),
        route: z.array(z.tuple([z.number(), z.number()])).max(5000).optional().default([]),
      }),
    )
    .max(200)
    .default([]),
});

router.post('/', strictLimiter, async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const profile = await UserProfile.findOne({ uid });

    if (profile?.migratedFromLocalStorage) {
      res.json({ migrated: false, reason: 'already-migrated' });
      return;
    }

    const body = migrationSchema.parse(req.body);

    const ops: Promise<unknown>[] = [];
    if (body.workouts.length) {
      ops.push(Workout.insertMany(body.workouts.map((w) => ({ ...w, userId: uid }))));
    }
    if (body.runningSessions.length) {
      ops.push(
        RunningSession.insertMany(body.runningSessions.map((s) => ({ ...s, userId: uid }))),
      );
    }
    await Promise.all(ops);

    await UserProfile.updateOne(
      { uid },
      { $set: { migratedFromLocalStorage: true } },
      { upsert: true },
    );

    res.json({
      migrated: true,
      counts: {
        workouts: body.workouts.length,
        runningSessions: body.runningSessions.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

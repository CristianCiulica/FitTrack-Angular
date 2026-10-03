import { Router } from 'express';
import { z } from 'zod';
import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';
import { UserProfile } from '../models/user-profile.model';
import { strictLimiter } from '../middleware/rate-limit';

import { createHash } from 'node:crypto';
import { workoutBodySchema, sessionBodySchema } from '../validation/activity';
import { createOnce } from '../utils/idempotent-create';

const router = Router();

const migrationSchema = z.object({
  workouts: z
    .array(workoutBodySchema.extend({ exercises: workoutBodySchema.shape.exercises.default([]) }))
    .max(500)
    .default([]),
  runningSessions: z.array(sessionBodySchema).max(200).default([]),
});

// Content-derived keys also protect legacy clients that have no local record id.
const legacyId = (type: string, value: unknown) =>
  `legacy_${type}_${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

router.post('/', strictLimiter, async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const profile = await UserProfile.findOne({ uid });

    if (profile?.migratedFromLocalStorage) {
      res.json({ migrated: false, reason: 'already-migrated' });
      return;
    }

    const body = migrationSchema.parse(req.body);

    // Every insertion is idempotent. A partial failure or failed migration marker
    // can safely be retried without requiring a Mongo replica-set transaction.
    for (const workout of body.workouts) {
      const value = { ...workout };
      await createOnce(Workout, uid, {
        ...value,
        clientId: workout.clientId ?? legacyId('workout', value),
      });
    }
    for (const session of body.runningSessions) {
      await createOnce(RunningSession, uid, {
        ...session,
        clientId: session.clientId ?? legacyId('run', session),
      });
    }

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

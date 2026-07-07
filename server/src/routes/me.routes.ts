import { Router } from 'express';
import { z } from 'zod';
import { UserProfile } from '../models/user-profile.model';
import { getAuth } from '../config/firebase-admin';
import { strictLimiter } from '../middleware/rate-limit';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  age: z.number().int().positive().max(120).nullable().optional(),
  sex: z.enum(['male', 'female', '']).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  workoutReminderDays: z.number().int().min(0).max(30).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const profile = await UserProfile.findOneAndUpdate(
      { uid: user.uid },
      {
        $set: { email: user.email },
        $setOnInsert: { displayName: user.displayName, uid: user.uid },
      },
      { new: true, upsert: true },
    );
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.patch('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const update = updateProfileSchema.parse(req.body);
    const profile = await UserProfile.findOneAndUpdate(
      { uid: user.uid },
      { $set: update },
      { new: true, upsert: true },
    );
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.delete('/', strictLimiter, async (req, res, next) => {
  try {
    const user = req.user!;
    
    const nowSecs = Math.floor(Date.now() / 1000);
    if (nowSecs - user.authTime > 300) {
      res.status(403).json({ error: 'requires-recent-login' });
      return;
    }

    await Promise.all([
      UserProfile.deleteOne({ uid: user.uid }),
      (await import('../models/workout.model')).Workout.deleteMany({ userId: user.uid }),
      (await import('../models/running-session.model')).RunningSession.deleteMany({
        userId: user.uid,
      }),
    ]);

    // stergem si contul din Firebase Auth (Admin SDK) ca sa nu ramana un cont orfan
    // fara datele lui; bypaseaza cerinta de "recent login" a clientului
    try {
      await getAuth().deleteUser(user.uid);
    } catch (authErr) {
      console.warn('[me] firebase auth user delete failed', (authErr as Error).message);
    }

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

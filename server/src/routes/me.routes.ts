import { Router } from 'express';
import { z } from 'zod';
import { UserProfile } from '../models/user-profile.model';
import { getAuth } from '../config/firebase-admin';
import { strictLimiter } from '../middleware/rate-limit';

import { WeightEntry } from '../models/weight-entry.model';
import { weightDateSchema, weightBodySchema } from '../validation/weight-entry';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  avatar: z
    .string()
    .max(200_000)
    .refine((v) => v === '' || v.startsWith('data:image/'), 'avatar must be an image data URL')
    .optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  age: z.number().int().positive().max(120).nullable().optional(),
  sex: z.enum(['male', 'female', '']).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  goal: z.enum(['lose', 'maintain', 'gain']).optional(),
  goalRate: z.number().min(0).max(2).optional(),
  weeklyWorkoutGoal: z.number().int().min(1).max(14).optional(),
  moveGoal: z.number().int().min(50).max(5000).optional(),
  exerciseGoal: z.number().int().min(5).max(300).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;

    let profile = await UserProfile.findOne({ uid: user.uid }).select('-following');
    if (!profile) {
      // Profil inexistent = prima logare SAU un request intarziat (ex. retry) cu
      // un token ramas valid dupa stergerea contului. Tokenurile Firebase nu se
      // invalideaza la deleteUser, asa ca fara verificarea asta un request
      // intarziat ar re-crea prin upsert profilul abia sters.
      try {
        await getAuth().getUser(user.uid);
      } catch {
        res.status(401).json({ error: 'account-deleted' });
        return;
      }
      profile = await UserProfile.create({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
    } else if (profile.email !== user.email) {
      profile.email = user.email ?? '';
      await profile.save();
    }

    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

// Each account has one weigh-in per calendar day. PUT updates that day's entry.
router.get('/weight-entries', async (req, res, next) => {
  try {
    const entries = await WeightEntry.find({ userId: req.user!.uid }).sort({ date: 1 }).select('date weightKg -_id').lean();
    res.json({ entries });
  } catch (err) { next(err); }
});

async function weightResponse(uid: string) {
  const entries = await WeightEntry.find({ userId: uid }).sort({ date: 1 }).select('date weightKg -_id').lean();
  const latest = entries.at(-1);
  // Backdated entries never replace the more recent measurement in the profile.
  const profile = latest
    ? await UserProfile.findOneAndUpdate({ uid }, { $set: { weightKg: latest.weightKg } }, { new: true }).select('-following')
    : await UserProfile.findOne({ uid }).select('-following');
  return { entries, profile };
}

router.put('/weight-entries/:date', async (req, res, next) => {
  try {
    const date = weightDateSchema.parse(req.params.date);
    const { weightKg } = weightBodySchema.parse(req.body);
    const filter = { userId: req.user!.uid, date };
    try {
      await WeightEntry.findOneAndUpdate(filter, { $set: { weightKg } }, { upsert: true, runValidators: true });
    } catch (err: any) {
      if (err.code !== 11000) throw err;
      await WeightEntry.updateOne(filter, { $set: { weightKg } }, { runValidators: true });
    }
    res.json(await weightResponse(req.user!.uid));
  } catch (err) { next(err); }
});

router.delete('/weight-entries/:date', async (req, res, next) => {
  try {
    const date = weightDateSchema.parse(req.params.date);
    await WeightEntry.deleteOne({ userId: req.user!.uid, date });
    res.json(await weightResponse(req.user!.uid));
  } catch (err) { next(err); }
});

router.get('/export', strictLimiter, async (req, res, next) => {
  try {
    const user = req.user!;
    
    const [profile, workouts, runningSessions, weightEntries] = await Promise.all([
      UserProfile.findOne({ uid: user.uid }).select('-following').lean(),
      (await import('../models/workout.model')).Workout.find({ userId: user.uid }).lean(),
      (await import('../models/running-session.model')).RunningSession.find({ userId: user.uid }).lean(),
      WeightEntry.find({ userId: user.uid }).sort({ date: 1 }).select('date weightKg -_id').lean()
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      },
      profile,
      workouts,
      runningSessions,
      weightEntries
    });
  } catch (error) {
    next(error);
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
    ).select('-following');
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.delete('/', strictLimiter, async (req, res, next) => {
  try {
    const user = req.user!;

    // Community is retired, but account deletion must still erase any legacy
    // posts, comments, likes and follow relationships belonging to this user.
    const legacyPosts = UserProfile.db.collection<{
      authorId: string;
      likes: string[];
      comments: { authorId: string }[];
    }>('communityworkouts');
    const legacyProfiles = UserProfile.db.collection<{
      uid: string;
      following: string[];
    }>(UserProfile.collection.collectionName);

    // Nota: nu mai cerem "recent login". auth_time din tokenul Firebase nu se
    // reimprospateaza la refresh, asa ca orice user logat de peste 5 min ramanea
    // blocat definitiv. Endpoint-ul e oricum protejat de un ID token valid, iar
    // stergerea contului din Firebase Auth se face cu Admin SDK mai jos.
    await Promise.all([
      UserProfile.deleteOne({ uid: user.uid }),
      WeightEntry.deleteMany({ userId: user.uid }),
      (await import('../models/workout.model')).Workout.deleteMany({ userId: user.uid }),
      (await import('../models/running-session.model')).RunningSession.deleteMany({
        userId: user.uid,
      }),
      legacyPosts.deleteMany({ authorId: user.uid }),
      legacyPosts.updateMany(
        { authorId: { $ne: user.uid } },
        { $pull: { likes: user.uid, comments: { authorId: user.uid } } },
      ),
      legacyProfiles.updateMany(
        { following: user.uid },
        { $pull: { following: user.uid } },
      ),
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

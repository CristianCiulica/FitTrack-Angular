import { Router } from 'express';
import { z } from 'zod';
import { CommunityWorkout } from '../models/community-workout.model';
import { MUSCLE_GROUPS } from '../models/workout.model';
import { UserProfile } from '../models/user-profile.model';

const router = Router();

const exerciseSchema = z.object({
  exerciseName: z.string().trim().min(1),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  sets: z.number().min(0).max(50),
  reps: z.number().min(0).max(500),
  weight: z.number().min(0).max(1000),
});

const communityWorkoutBodySchema = z.object({
  originalWorkoutId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().default(''),
  exercises: z.array(exerciseSchema).max(50).default([]),
});

function serialize(doc: any) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    originalWorkoutId: obj.originalWorkoutId,
    authorId: obj.authorId,
    authorName: obj.authorName,
    name: obj.name,
    description: obj.description,
    exercises: obj.exercises,
    createdAt: obj.createdAt,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const items = await CommunityWorkout.find().sort({ createdAt: -1 }).limit(100);
    res.json({ communityWorkouts: items.map(serialize) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = communityWorkoutBodySchema.parse(req.body);
    const user = req.user!;
    
    // Fetch user profile to get display name
    const profile = await UserProfile.findOne({ uid: user.uid });
    const authorName = profile?.displayName || user.email || 'Anonymous';

    const created = await CommunityWorkout.create({
      ...body,
      authorId: user.uid,
      authorName,
    });
    
    res.status(201).json({ communityWorkout: serialize(created) });
  } catch (err) {
    next(err);
  }
});

export default router;

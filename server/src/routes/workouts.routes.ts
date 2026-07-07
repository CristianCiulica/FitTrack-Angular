import { Router } from 'express';
import { z } from 'zod';
import { Workout, MUSCLE_GROUPS } from '../models/workout.model';

const router = Router();

const exerciseSchema = z.object({
  exerciseName: z.string().trim().min(1),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  sets: z.number().min(0),
  reps: z.number().min(0),
  weight: z.number().min(0),
});

const workoutBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.string().min(1),
  notes: z.string().max(2000).optional().default(''),
  isPredefined: z.boolean().optional().default(false),
  exercises: z.array(exerciseSchema).default([]),
});

function serialize(doc: any) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    userId: obj.userId,
    name: obj.name,
    date: obj.date,
    notes: obj.notes,
    isPredefined: obj.isPredefined,
    exercises: obj.exercises,
    createdAt: obj.createdAt,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const items = await Workout.find({ userId: req.user!.uid }).sort({ date: -1, createdAt: -1 });
    res.json({ workouts: items.map(serialize) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = workoutBodySchema.parse(req.body);
    const created = await Workout.create({ ...body, userId: req.user!.uid });
    res.status(201).json({ workout: serialize(created) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const body = workoutBodySchema.partial().parse(req.body);
    const updated = await Workout.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.uid },
      { $set: body },
      { new: true },
    );
    if (!updated) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json({ workout: serialize(updated) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await Workout.deleteOne({ _id: req.params.id, userId: req.user!.uid });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

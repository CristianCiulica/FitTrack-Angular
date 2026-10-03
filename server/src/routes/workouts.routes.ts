import { Router } from 'express';
import { Workout } from '../models/workout.model';
import { workoutBodySchema } from '../validation/activity';
import { createOnce } from '../utils/idempotent-create';

const router = Router();

function serialize(doc: any) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    clientId: obj.clientId,
    kind: obj.kind,
    userId: obj.userId,
    name: obj.name,
    date: obj.date,
    notes: obj.notes,
    durationSeconds: obj.durationSeconds,
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
    const created = await createOnce(Workout, req.user!.uid, body);
    res.status(201).json({ workout: serialize(created) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const body = workoutBodySchema.partial().parse(req.body);
    delete body.clientId;
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

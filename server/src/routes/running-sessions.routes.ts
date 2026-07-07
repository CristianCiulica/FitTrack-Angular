import { Router } from 'express';
import { Document } from 'mongoose';
import { z } from 'zod';
import { RunningSession } from '../models/running-session.model';

const router = Router();

const sessionBodySchema = z.object({
  mode: z.enum(['running', 'walking']),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationSeconds: z.number().min(0),
  distanceMeters: z.number().min(0),
  steps: z.number().min(0),
  averageSpeedKmh: z.number().min(0),
  calories: z.number().min(0),
  route: z.array(z.tuple([z.number(), z.number()])).max(5000).optional().default([]),
});

function serialize(doc: Document | any) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    userId: obj.userId,
    mode: obj.mode,
    startedAt: obj.startedAt,
    endedAt: obj.endedAt,
    durationSeconds: obj.durationSeconds,
    distanceMeters: obj.distanceMeters,
    steps: obj.steps,
    averageSpeedKmh: obj.averageSpeedKmh,
    calories: obj.calories,
    route: obj.route ?? [],
  };
}

router.get('/', async (req, res, next) => {
  try {
    const items = await RunningSession.find({ userId: req.user!.uid }).sort({ startedAt: -1 });
    res.json({ sessions: items.map(serialize) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = sessionBodySchema.parse(req.body);
    const created = await RunningSession.create({ ...body, userId: req.user!.uid });
    res.status(201).json({ session: serialize(created) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await RunningSession.deleteOne({ _id: req.params.id, userId: req.user!.uid });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

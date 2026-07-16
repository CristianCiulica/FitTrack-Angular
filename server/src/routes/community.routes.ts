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
  setWeights: z.array(z.number().min(0).max(1000)).max(50).optional(),
});

const communityWorkoutBodySchema = z.object({
  originalWorkoutId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().default(''),
  exercises: z.array(exerciseSchema).max(50).default([]),
});

const commentBodySchema = z.object({
  text: z.string().trim().min(1).max(300),
});

// numele afisat al userului curent (profil > email > Anonymous)
async function resolveAuthorName(uid: string, email?: string): Promise<string> {
  const profile = await UserProfile.findOne({ uid });
  return profile?.displayName || email || 'Anonymous';
}

function serialize(doc: any, viewerUid?: string) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  const likes: string[] = obj.likes ?? [];
  return {
    id: String(obj._id),
    originalWorkoutId: obj.originalWorkoutId,
    authorId: obj.authorId,
    authorName: obj.authorName,
    name: obj.name,
    description: obj.description,
    exercises: obj.exercises,
    createdAt: obj.createdAt,
    likeCount: likes.length,
    likedByMe: viewerUid ? likes.includes(viewerUid) : false,
    saveCount: obj.saveCount ?? 0,
    comments: (obj.comments ?? []).map((c: any) => ({
      id: String(c._id),
      authorId: c.authorId,
      authorName: c.authorName,
      text: c.text,
      createdAt: c.createdAt,
    })),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const items = await CommunityWorkout.find().sort({ createdAt: -1 }).limit(100);
    res.json({ communityWorkouts: items.map((i) => serialize(i, req.user!.uid)) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = communityWorkoutBodySchema.parse(req.body);
    const user = req.user!;
    const authorName = await resolveAuthorName(user.uid, user.email);

    const created = await CommunityWorkout.create({
      ...body,
      authorId: user.uid,
      authorName,
    });

    res.status(201).json({ communityWorkout: serialize(created, user.uid) });
  } catch (err) {
    next(err);
  }
});

// autorul isi poate sterge postarea
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await CommunityWorkout.deleteOne({
      _id: req.params.id,
      authorId: req.user!.uid,
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// like/unlike (toggle)
router.post('/:id/like', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const post = await CommunityWorkout.findById(req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const already = post.likes.includes(uid);
    const updated = await CommunityWorkout.findByIdAndUpdate(
      req.params.id,
      already ? { $pull: { likes: uid } } : { $addToSet: { likes: uid } },
      { new: true },
    );
    res.json({ communityWorkout: serialize(updated, uid) });
  } catch (err) {
    next(err);
  }
});

// comentarii
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { text } = commentBodySchema.parse(req.body);
    const user = req.user!;
    const authorName = await resolveAuthorName(user.uid, user.email);

    const updated = await CommunityWorkout.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { authorId: user.uid, authorName, text } } },
      { new: true },
    );
    if (!updated) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.status(201).json({ communityWorkout: serialize(updated, user.uid) });
  } catch (err) {
    next(err);
  }
});

// stergere comentariu: autorul comentariului sau autorul postarii
router.delete('/:id/comments/:commentId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const post = await CommunityWorkout.findById(req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    if (comment.authorId !== uid && post.authorId !== uid) {
      res.status(403).json({ error: 'Not allowed' });
      return;
    }
    comment.deleteOne();
    await post.save();
    res.json({ communityWorkout: serialize(post, uid) });
  } catch (err) {
    next(err);
  }
});

// numaram cate salvari in bibliotecile personale are o rutina
router.post('/:id/save', async (req, res, next) => {
  try {
    const updated = await CommunityWorkout.findByIdAndUpdate(
      req.params.id,
      { $inc: { saveCount: 1 } },
      { new: true },
    );
    if (!updated) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json({ communityWorkout: serialize(updated, req.user!.uid) });
  } catch (err) {
    next(err);
  }
});

export default router;

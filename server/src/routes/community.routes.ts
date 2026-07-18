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
  setReps: z.array(z.number().min(0).max(500)).max(50).optional(),
});

// praguri de calitate la publicare: minim 2 exercitii si o descriere reala
const communityWorkoutBodySchema = z.object({
  originalWorkoutId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(10).max(2000),
  exercises: z.array(exerciseSchema).min(2).max(50),
});

const commentBodySchema = z.object({
  text: z.string().trim().min(1).max(300),
});

const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  sort: z.enum(['trending', 'recent', 'popular']).default('trending'),
  muscle: z.enum(MUSCLE_GROUPS).optional(),
  q: z.string().trim().max(80).optional(),
  maxMinutes: z.coerce.number().int().min(1).max(600).optional(),
  feed: z.enum(['all', 'following']).default('all'),
});

// numele afisat al userului curent (profil > email > Anonymous)
async function resolveAuthorName(uid: string, email?: string): Promise<string> {
  const profile = await UserProfile.findOne({ uid });
  return profile?.displayName || email || 'Anonymous';
}

// durata estimata (min): ~45s pe set + ~60s pauza intre seturi, ca in frontend
function estimateMinutes(exercises: any[]): number {
  const totalSets = exercises.reduce((acc, e) => acc + (e.sets || 0), 0);
  return Math.max(5, Math.round((totalSets * 105) / 60));
}

// dificultate dedusa din volum, ca sa nu mai cerem inca un camp la publicare
function estimateDifficulty(exercises: any[]): 'Beginner' | 'Intermediate' | 'Advanced' {
  const totalSets = exercises.reduce((acc, e) => acc + (e.sets || 0), 0);
  if (totalSets <= 9 && exercises.length <= 3) return 'Beginner';
  if (totalSets <= 16) return 'Intermediate';
  return 'Advanced';
}

// scor "trending": interactiuni ponderate, cu decadere exponentiala in ~7 zile
function trendingScore(obj: any): number {
  const likes = (obj.likes ?? []).length;
  const saves = obj.saveCount ?? 0;
  const comments = (obj.comments ?? []).length;
  const ageDays = (Date.now() - new Date(obj.createdAt).getTime()) / 86_400_000;
  return (1 + likes * 2 + saves * 3 + comments) * Math.exp(-ageDays / 7);
}

function serialize(doc: any, viewerUid?: string, followingSet?: Set<string>) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  const likes: string[] = obj.likes ?? [];
  return {
    id: String(obj._id),
    originalWorkoutId: obj.originalWorkoutId,
    authorId: obj.authorId,
    authorName: obj.authorName,
    authorFollowedByMe: followingSet ? followingSet.has(obj.authorId) : false,
    name: obj.name,
    description: obj.description,
    exercises: obj.exercises,
    createdAt: obj.createdAt,
    likeCount: likes.length,
    likedByMe: viewerUid ? likes.includes(viewerUid) : false,
    saveCount: obj.saveCount ?? 0,
    estimatedMinutes: estimateMinutes(obj.exercises ?? []),
    difficulty: estimateDifficulty(obj.exercises ?? []),
    comments: (obj.comments ?? []).map((c: any) => ({
      id: String(c._id),
      authorId: c.authorId,
      authorName: c.authorName,
      text: c.text,
      createdAt: c.createdAt,
    })),
  };
}

async function viewerFollowing(uid: string): Promise<Set<string>> {
  const profile = await UserProfile.findOne({ uid }).select('following').lean();
  return new Set(profile?.following ?? []);
}

// feed-ul principal: filtre + sortare + paginare
router.get('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const query = feedQuerySchema.parse(req.query);
    const followingSet = await viewerFollowing(uid);

    const mongoFilter: Record<string, unknown> = {};
    if (query.muscle) mongoFilter['exercises.muscleGroup'] = query.muscle;
    if (query.q) {
      const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      mongoFilter.$or = [{ name: rx }, { authorName: rx }];
    }
    if (query.feed === 'following') {
      mongoFilter.authorId = { $in: Array.from(followingSet) };
    }

    // aducem o fereastra recenta si finisam in memorie (durata + trending sunt
    // campuri calculate); la scara actuala e simplu si corect
    const window = await CommunityWorkout.find(mongoFilter)
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    let items = window;
    if (query.maxMinutes) {
      items = items.filter((w) => estimateMinutes(w.exercises ?? []) <= query.maxMinutes!);
    }

    if (query.sort === 'trending') {
      items = [...items].sort((a, b) => trendingScore(b) - trendingScore(a));
    } else if (query.sort === 'popular') {
      items = [...items].sort(
        (a, b) =>
          (b.likes?.length ?? 0) - (a.likes?.length ?? 0) ||
          (b.saveCount ?? 0) - (a.saveCount ?? 0),
      );
    }
    // 'recent' e deja sortat desc dupa createdAt

    const start = query.page * query.limit;
    const pageItems = items.slice(start, start + query.limit);

    res.json({
      communityWorkouts: pageItems.map((i) => serialize(i, uid, followingSet)),
      total: items.length,
      hasMore: start + query.limit < items.length,
    });
  } catch (err) {
    next(err);
  }
});

// FitTrack Picks: cele mai salvate rutine din ultimele 30 de zile
router.get('/picks', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const followingSet = await viewerFollowing(uid);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const recent = await CommunityWorkout.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    const picks = [...recent]
      .sort(
        (a, b) =>
          (b.saveCount ?? 0) - (a.saveCount ?? 0) ||
          (b.likes?.length ?? 0) - (a.likes?.length ?? 0),
      )
      .slice(0, 5)
      .filter((w) => (w.saveCount ?? 0) + (w.likes?.length ?? 0) > 0);
    res.json({ picks: picks.map((p) => serialize(p, uid, followingSet)) });
  } catch (err) {
    next(err);
  }
});

// profilul public al unui autor: statistici + postarile lui
router.get('/author/:uid', async (req, res, next) => {
  try {
    const viewer = req.user!.uid;
    const authorId = req.params.uid;
    const followingSet = await viewerFollowing(viewer);

    const [posts, followers] = await Promise.all([
      CommunityWorkout.find({ authorId }).sort({ createdAt: -1 }).limit(100).lean(),
      UserProfile.countDocuments({ following: authorId }),
    ]);

    const authorName =
      posts[0]?.authorName ||
      (await UserProfile.findOne({ uid: authorId }).select('displayName').lean())?.displayName ||
      'Athlete';

    res.json({
      author: {
        uid: authorId,
        name: authorName,
        postCount: posts.length,
        totalLikes: posts.reduce((acc, p) => acc + (p.likes?.length ?? 0), 0),
        totalSaves: posts.reduce((acc, p) => acc + (p.saveCount ?? 0), 0),
        followers,
        followedByMe: followingSet.has(authorId),
      },
      posts: posts.map((p) => serialize(p, viewer, followingSet)),
    });
  } catch (err) {
    next(err);
  }
});

// follow/unfollow un autor (toggle)
router.post('/follow/:uid', async (req, res, next) => {
  try {
    const me = req.user!.uid;
    const target = req.params.uid;
    if (target === me) {
      res.status(400).json({ error: "You can't follow yourself" });
      return;
    }
    const profile = await UserProfile.findOne({ uid: me });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const already = profile.following.includes(target);
    await UserProfile.updateOne(
      { uid: me },
      already ? { $pull: { following: target } } : { $addToSet: { following: target } },
    );
    const followers = await UserProfile.countDocuments({ following: target });
    res.json({ following: !already, followers });
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
    res.json({ communityWorkout: serialize(updated, uid, await viewerFollowing(uid)) });
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
    res
      .status(201)
      .json({ communityWorkout: serialize(updated, user.uid, await viewerFollowing(user.uid)) });
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
    res.json({ communityWorkout: serialize(post, uid, await viewerFollowing(uid)) });
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
    const uid = req.user!.uid;
    res.json({ communityWorkout: serialize(updated, uid, await viewerFollowing(uid)) });
  } catch (err) {
    next(err);
  }
});

export default router;

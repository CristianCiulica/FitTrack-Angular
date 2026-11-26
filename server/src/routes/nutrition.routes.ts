import { Router } from 'express';
import { z } from 'zod';
import { NutritionRecord } from '../models/nutrition-record.model';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { findFoods } from '../services/food-catalog';
import { importRecipe } from '../services/recipe-import';
import { barcodeSchema, nutritionIdSchema, nutritionRecordsSchema } from '../validation/nutrition';
import { weightDateSchema } from '../validation/weight-entry';

const router = Router();
const catalogSearchLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) => req.user!.uid ?? ipKeyGenerator(req.ip ?? ''),
});
const recipeImportLimit = rateLimit({
  windowMs: 60_000,
  limit: 5,
  keyGenerator: (req) => req.user!.uid ?? ipKeyGenerator(req.ip ?? ''),
});

router.get('/', async (req, res, next) => {
  try {
    const from = weightDateSchema.parse(req.query.from);
    const to = weightDateSchema.parse(req.query.to);
    const range = (Date.parse(to) - Date.parse(from)) / 86400000;
    if (range < 0 || range > 35) {
      res.status(400).json({ error: 'Choose a range of up to 36 days.' });
      return;
    }
    const rows = await NutritionRecord.find({
      userId: req.user!.uid,
      $or: [{ date: null }, { date: { $gte: from, $lte: to } }],
    })
      .sort({ _id: 1 })
      .select('data -_id')
      .lean();
    res.json({ records: rows.map((row) => row.data) });
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const records = nutritionRecordsSchema.parse(req.body);
    const userId = req.user!.uid;
    const writes = records.map((data) => ({
      updateOne: {
        filter: { userId, recordId: data.id },
        update: { $set: { data, date: 'date' in data ? data.date : null } },
        upsert: true,
      },
    }));
    await NutritionRecord.bulkWrite(writes);
    res.json({ records });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await NutritionRecord.deleteOne({
      userId: req.user!.uid,
      recordId: nutritionIdSchema.parse(req.params.id),
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/catalog/:code', async (req, res, next) => {
  try {
    res.json({ foods: await findFoods(barcodeSchema.parse(req.params.code), true) });
  } catch (error) {
    next(error);
  }
});

router.get('/catalog', catalogSearchLimit, async (req, res, next) => {
  try {
    const query = z.string().trim().min(2).max(80).parse(req.query.q);
    res.json({ foods: await findFoods(query, false) });
  } catch (error) {
    next(error);
  }
});

router.post('/recipe-import', recipeImportLimit, async (req, res, next) => {
  try {
    const url = z.string().url().max(2048).parse(req.body?.url);
    res.json(await importRecipe(url));
  } catch (error) {
    next(error);
  }
});

export default router;

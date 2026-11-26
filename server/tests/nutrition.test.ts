import { findUsdaFoods } from '../src/services/usda-catalog';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapProduct } from '../src/services/food-catalog';
import { importRecipe, parseRecipeHtml } from '../src/services/recipe-import';
import { nutritionRecordsSchema } from '../src/validation/nutrition';

test('catalog normalizes the Romanian title, kJ and missing values', () => {
  const product = mapProduct({
    code: '5941209017244',
    product_name: 'Yogurt',
    product_name_ro: 'Iaurt',
    nutriments: {
      'energy-kj_100g': 418.4,
      proteins_100g: '4.2',
      carbohydrates_100g: '',
      fat_100g: 0,
    },
  });
  assert.equal(product?.name, 'Iaurt');
  assert.ok(Math.abs((product?.values.kcal ?? 0) - 100) < 1e-9);
  assert.equal(product?.values.protein, 4.2);
  assert.equal(product?.values.carbs, null);
  assert.equal(product?.values.fat, 0);
});

test('recipe import extracts a reviewable ingredient list from structured metadata', () => {
  const html =
    '<script type="application/ld+json">invalid</script>' +
    '<script type="application/ld+json">' +
    JSON.stringify({
      '@graph': [
        {
          '@type': ['Recipe'],
          name: 'Supă',
          recipeYield: '4 servings',
          recipeIngredient: ['100 g morcovi', '800 ml apă'],
        },
      ],
    }) +
    '</script>';
  assert.deepEqual(parseRecipeHtml(html), {
    name: 'Supă',
    servings: 4,
    ingredients: ['100 g morcovi', '800 ml apă'],
  });
});

test('recipe import accepts public HTTPS pages only', async () => {
  await assert.rejects(() => importRecipe('file:///etc/hosts'), { status: 422 });
  await assert.rejects(() => importRecipe('https://127.0.0.1/recipe'), { status: 422 });
});

test('day completion IDs cannot overwrite food records and future entries fail validation', () => {
  assert.equal(
    nutritionRecordsSchema.safeParse([
      { id: 'day-2025-01-01', kind: 'complete', date: '2025-01-01' },
    ]).success,
    true,
  );
  assert.equal(
    nutritionRecordsSchema.safeParse([
      { id: 'day-2025-01-02', kind: 'complete', date: '2025-01-01' },
    ]).success,
    false,
  );
  assert.equal(
    nutritionRecordsSchema.safeParse([
      { id: 'day-2999-01-01', kind: 'complete', date: '2999-01-01' },
    ]).success,
    false,
  );
});

test('nutrition routes keep a saved entry private and retry a write without creating duplicates', async () => {
  const { default: express } = await import('express');
  const { NutritionRecord } = await import('../src/models/nutrition-record.model');
  const { default: router } = await import('../src/routes/nutrition.routes');
  const { errorHandler } = await import('../src/middleware/error');
  const storage = new Map<string, object>();
  const key = ({ userId, recordId }: { userId: string; recordId: string }) =>
    `${userId}:${recordId}`;
  const writes = NutritionRecord.bulkWrite;
  const find = NutritionRecord.find;
  const remove = NutritionRecord.deleteOne;

  NutritionRecord.bulkWrite = (async (ops: any[]) => {
    for (const { updateOne } of ops) {
      storage.set(key(updateOne.filter), updateOne.update.$set.data);
    }
  }) as typeof writes;
  NutritionRecord.find = ((filter: { userId: string }) => ({
    sort: () => ({
      select: () => ({
        lean: async () =>
          [...storage]
            .filter(([id]) => id.startsWith(filter.userId + ':'))
            .map(([, data]) => ({ data })),
      }),
    }),
  })) as unknown as typeof find;
  NutritionRecord.deleteOne = (async (filter: Parameters<typeof key>[0]) => {
    storage.delete(key(filter));
  }) as unknown as typeof remove;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      uid: req.get('x-test-account') ?? 'alice',
      email: '',
      displayName: '',
      authTime: 0,
    };
    next();
  });
  app.use('/nutrition', router);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/nutrition`;
    const query = '?from=2025-01-01&to=2025-01-01';
    const entry = {
      id: '11111111-1111-1111-1111-111111111111',
      kind: 'entry',
      date: '2025-01-01',
      meal: 'dinner',
      amount: 150,
      food: {
        name: 'Yogurt',
        basis: 'g',
        origin: 'manual',
        values: { kcal: 72, protein: 5, carbs: 4, fat: null },
      },
    };
    const write = () =>
      fetch(base, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([entry]),
      });
    assert.equal((await write()).status, 200);
    assert.equal((await write()).status, 200);
    const bob = { 'x-test-account': 'bob' };
    assert.deepEqual(await (await fetch(base + query, { headers: bob })).json(), { records: [] });
    assert.equal(
      (await fetch(base + '/' + entry.id, { method: 'DELETE', headers: bob })).status,
      204,
    );
    assert.deepEqual(await (await fetch(base + query)).json(), { records: [entry] });
  } finally {
    server.close();
    NutritionRecord.bulkWrite = writes;
    NutritionRecord.find = find;
    NutritionRecord.deleteOne = remove;
  }
});

test('Romanian food queries find USDA reference foods with all nutrition values', () => {
  const results = findUsdaFoods('piept de pui');
  assert.ok(results.length);
  assert.ok(results[0].name.toLowerCase().includes('chicken'));
  assert.ok(results[0].name.toLowerCase().includes('breast'));
  assert.ok(
    results.every((food) => food.fdcId > 0 && Object.values(food.values).every(Number.isFinite)),
  );
});

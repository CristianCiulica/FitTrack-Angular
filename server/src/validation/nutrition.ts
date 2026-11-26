import { z } from 'zod';
import { weightDateSchema } from './weight-entry';

export const barcodeSchema = z.string().regex(/^(?:\d{8}|\d{12,14})$/);
export const nutritionIdSchema = z.string().regex(/^(?:[a-f0-9-]{36}|day-\d{4}-\d{2}-\d{2})$/);
const name = z.string().trim().min(1).max(160);
const value = z.number().finite().min(0).max(100_000).nullable();
const nutrients = z.object({ kcal: value, protein: value, carbs: value, fat: value });
const amount = z.number().finite().positive().max(100_000);
const food = z.object({
  name,
  values: nutrients,
  brand: z.string().max(120).optional(),
  basis: z.enum(['g', 'ml', 'serving']),
  origin: z.enum(['manual', 'open-food-facts', 'recipe']),
  barcode: barcodeSchema.optional(),
});
const portion = z.object({ food, amount });
const entry = portion.extend({
  id: nutritionIdSchema,
  kind: z.literal('entry'),
  date: weightDateSchema,
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
});
const library = z.object({ id: nutritionIdSchema, name });
export const nutritionRecordsSchema = z
  .array(
    z
      .discriminatedUnion('kind', [
        entry,
        z.object({ id: nutritionIdSchema, kind: z.literal('complete'), date: weightDateSchema }),
        library.extend({ kind: z.literal('food'), food }),
        library.extend({ kind: z.literal('meal'), items: z.array(portion).min(1).max(100) }),
        library.extend({
          kind: z.literal('recipe'),
          ingredients: z.array(portion).min(1).max(100),
          servings: z.number().int().min(1).max(1000),
          cookedGrams: amount.nullable(),
        }),
      ])
      .superRefine((row, ctx) => {
        if (row.kind === 'complete' ? row.id !== `day-${row.date}` : row.id.startsWith('day-')) {
          ctx.addIssue({
            code: 'custom',
            path: ['id'],
            message: 'Invalid record ID for this record type.',
          });
        }
      }),
  )
  .min(1)
  .max(100);

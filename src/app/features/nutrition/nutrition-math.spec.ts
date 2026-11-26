import { Food, NutritionRecord, Recipe } from '../../core/models/nutrition.model';
import { UserProfile } from '../../core/models/user-profile.model';
import { WeightEntry } from '../../core/models/weight-entry.model';
import { moveDate, portionNutrients, recipeFood, suggestTarget, summarize } from './nutrition-math';
import { expandUpce } from './food-scanner';

const yogurt: Food = {
  name: 'Yogurt',
  basis: 'g',
  origin: 'manual',
  values: { kcal: 72, protein: 5, carbs: 0, fat: null },
};

describe('nutrition totals', () => {
  it('scales label values without turning missing nutrients into zero', () => {
    expect(portionNutrients({ food: yogurt, amount: 150 })).toEqual({
      kcal: 108,
      protein: 7.5,
      carbs: 0,
      fat: null,
    });
    expect(summarize([{ food: yogurt, amount: 150 }]).incomplete).toEqual({
      kcal: false,
      protein: false,
      carbs: false,
      fat: true,
    });
  });

  it('calculates both servings and cooked grams from the same recipe', () => {
    const recipe: Recipe = {
      id: 'recipe',
      kind: 'recipe',
      name: 'Yogurt bowl',
      ingredients: [{ food: yogurt, amount: 600 }],
      cookedGrams: 450,
      servings: 3,
    };
    expect(portionNutrients({ food: recipeFood(recipe, false), amount: 1 }).kcal).toBe(144);
    expect(portionNutrients({ food: recipeFood(recipe, true), amount: 150 }).kcal).toBeCloseTo(144);
    expect(recipeFood(recipe, true).values.fat).toBeNull();
  });

  it('uses the 21 days immediately before today and requires explicit completion', () => {
    const today = '2026-11-26';
    const profile = { goal: 'maintain', goalRate: 0.5 } as UserProfile;
    const records: NutritionRecord[] = [];
    const weights: WeightEntry[] = [];
    for (let offset = 1; offset <= 21; offset++) {
      const date = moveDate(today, -offset);
      records.push(
        { id: 'day-' + date, kind: 'complete', date },
        {
          id: date,
          kind: 'entry',
          date,
          meal: 'breakfast',
          food: {
            ...yogurt,
            basis: 'serving',
            values: { ...yogurt.values, kcal: 2400 },
          },
          amount: 1,
        },
      );
      weights.push({ date, weightKg: 75 });
    }
    expect(suggestTarget(records, weights, today, profile, 2200)).toBe(2300);
    expect(suggestTarget(records.slice(1), weights, today, profile, 2200)).toBeNull();
  });

  it('expands UPC-E into the full code without dropping its leading zero', () => {
    expect(expandUpce('04252614')).toBe('042100005264');
  });
});

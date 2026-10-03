import {
  ASSISTANT_OPTIONS,
  AssistantAnswers,
  createMealRecommendation,
} from './nutrition-assistant.data';

function answers(overrides: Partial<AssistantAnswers> = {}): AssistantAnswers {
  return {
    goal: 'maintain',
    meal: 'lunch',
    diet: 'balanced',
    time: 'quick',
    budget: 'low',
    ...overrides,
  };
}

describe('Nutrition meal recommendations', () => {
  it('respects active prep time and budget across all preference combinations', () => {
    for (const goal of ASSISTANT_OPTIONS.goal) {
      for (const meal of ASSISTANT_OPTIONS.meal) {
        for (const diet of ASSISTANT_OPTIONS.diet) {
          for (const time of ASSISTANT_OPTIONS.time) {
            for (const budget of ASSISTANT_OPTIONS.budget) {
              const preferences = {
                goal: goal.value,
                meal: meal.value,
                diet: diet.value,
                time: time.value,
                budget: budget.value,
              } as AssistantAnswers;
              for (let rotation = 0; rotation < 25; rotation++) {
                const recipe = createMealRecommendation(preferences);
                if (preferences.time === 'quick')
                  expect(recipe.prepMinutes).toBeLessThanOrEqual(10);
                if (preferences.time === 'standard')
                  expect(recipe.prepMinutes).toBeLessThanOrEqual(30);
                if (preferences.budget === 'low') expect(recipe.cost).toBe('Low');
                if (preferences.budget === 'medium') expect(recipe.cost).not.toBe('High');
                const ingredients = recipe.ingredients.join(' ').toLowerCase();
                if (preferences.diet === 'vegan' || preferences.diet === 'vegetarian') {
                  expect(ingredients).not.toMatch(/chicken|turkey|beef|salmon|tuna|shrimp|cod\b/);
                }
                if (preferences.diet === 'vegan') {
                  expect(ingredients).not.toMatch(
                    /\beggs?\b|skyr|yogurt|ricotta|parmesan|cottage cheese|honey|whey/,
                  );
                  expect(ingredients).not.toMatch(/\d+ ml milk\b/);
                }
                if (preferences.diet === 'lactose-free') {
                  expect(ingredients).not.toMatch(
                    /skyr|greek yogurt|ricotta|parmesan|cottage cheese|whey/,
                  );
                }
              }
            }
          }
        }
      }
    }
  });

  it('rotates through new recipes instead of hiding them behind the first eight matches', () => {
    const seen = new Set(
      Array.from(
        { length: 60 },
        () => createMealRecommendation(answers({ budget: 'flexible' })).title,
      ),
    );
    expect(seen.has('Lemon white bean toast')).toBe(true);
    expect(seen.has('Smoky chickpea couscous')).toBe(true);
    expect(seen.has('Ginger edamame soba')).toBe(true);
    expect(seen.has('Turkey & lentil lettuce cups')).toBe(true);
  });

  it('keeps nutrition consistent with the recipe serving when a goal changes', () => {
    const servings = new Map<string, { calories: number; ingredients: string[] }>();
    for (const goal of ['maintain', 'lose', 'gain'] as const) {
      for (let rotation = 0; rotation < 60; rotation++) {
        const recipe = createMealRecommendation(
          answers({ goal, meal: 'dinner', time: 'standard', budget: 'flexible' }),
        );
        const previous = servings.get(recipe.title);
        if (previous) {
          expect(recipe.calories).toBe(previous.calories);
          expect(recipe.ingredients).toEqual(previous.ingredients);
        }
        servings.set(recipe.title, { calories: recipe.calories, ingredients: recipe.ingredients });
      }
    }
  });

  it('returns independent ingredient lists so edits cannot alter future recommendations', () => {
    const preferences = answers({ meal: 'breakfast', diet: 'vegan' });
    for (let rotation = 0; rotation < 40; rotation++) {
      const recipe = createMealRecommendation(preferences);
      expect(recipe.ingredients).not.toContain('fixture mutation');
      recipe.ingredients.push('fixture mutation');
    }
  });
});

export type NutritionGoal = 'lose' | 'maintain' | 'gain';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'post-workout';
export type DietType = 'balanced' | 'vegetarian' | 'vegan' | 'lactose-free';
export type PrepTime = 'quick' | 'standard' | 'meal-prep';
export type BudgetType = 'low' | 'medium' | 'flexible';
export type AssistantStep = 'goal' | 'meal' | 'diet' | 'time' | 'budget' | 'result';

export interface AssistantAnswers {
  goal: NutritionGoal;
  meal: MealType;
  diet: DietType;
  time: PrepTime;
  budget: BudgetType;
}

export interface AssistantOption {
  value: string;
  label: string;
  description: string;
  icon: string;
}

export interface MealRecommendation {
  title: string;
  subtitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  prepMinutes: number;
  cost: string;
  ingredients: string[];
  steps: string[];
  swaps: string[];
  coachTip: string;
}

interface MealTemplate extends MealRecommendation {
  meals: MealType[];
  diets: DietType[];
  times: PrepTime[];
  budgets: BudgetType[];
}

export const ASSISTANT_OPTIONS: Record<Exclude<AssistantStep, 'result'>, AssistantOption[]> = {
  goal: [
    { value: 'lose', label: 'Fat loss', description: 'High volume, filling meals and controlled calories.', icon: '↘' },
    { value: 'maintain', label: 'Maintain', description: 'Balanced portions for energy and recovery.', icon: '◎' },
    { value: 'gain', label: 'Build muscle', description: 'More calories, protein and training fuel.', icon: '↗' },
  ],
  meal: [
    { value: 'breakfast', label: 'Breakfast', description: 'Start the day with steady energy.', icon: '☀' },
    { value: 'lunch', label: 'Lunch', description: 'A complete meal for the middle of the day.', icon: '◐' },
    { value: 'dinner', label: 'Dinner', description: 'Recovery-focused and easy to digest.', icon: '☾' },
    { value: 'snack', label: 'Snack', description: 'Small, practical and protein-aware.', icon: '◇' },
    { value: 'post-workout', label: 'Post-workout', description: 'Protein and carbohydrates for recovery.', icon: '⚡' },
  ],
  diet: [
    { value: 'balanced', label: 'No restrictions', description: 'Uses a wide range of foods.', icon: '✓' },
    { value: 'vegetarian', label: 'Vegetarian', description: 'No meat or fish.', icon: '◉' },
    { value: 'vegan', label: 'Vegan', description: 'Only plant-based ingredients.', icon: '⌁' },
    { value: 'lactose-free', label: 'Lactose-free', description: 'No regular dairy products.', icon: '○' },
  ],
  time: [
    { value: 'quick', label: 'Under 10 min', description: 'Minimal cooking and cleanup.', icon: '10' },
    { value: 'standard', label: '10–30 min', description: 'A normal freshly cooked meal.', icon: '25' },
    { value: 'meal-prep', label: 'Meal prep', description: 'Cook several portions at once.', icon: '×4' },
  ],
  budget: [
    { value: 'low', label: 'Budget friendly', description: 'Simple and affordable staples.', icon: '$' },
    { value: 'medium', label: 'Balanced budget', description: 'Good variety without overspending.', icon: '$$' },
    { value: 'flexible', label: 'Flexible', description: 'Prioritizes taste and nutrition.', icon: '$$$' },
  ],
};

const MEALS: MealTemplate[] = [
  {
    title: 'Protein overnight oats',
    subtitle: 'Creamy oats with berries, seeds and a high-protein base.',
    meals: ['breakfast', 'snack'],
    diets: ['balanced', 'vegetarian'],
    times: ['quick', 'meal-prep'],
    budgets: ['low', 'medium'],
    calories: 455,
    protein: 35,
    carbs: 57,
    fats: 11,
    prepMinutes: 7,
    cost: 'Low',
    ingredients: ['60 g oats', '200 g Greek yogurt', '100 ml milk', '100 g berries', '10 g chia seeds', 'Cinnamon'],
    steps: ['Mix oats, yogurt, milk and chia.', 'Refrigerate overnight or at least 2 hours.', 'Add berries and cinnamon before eating.'],
    swaps: ['Use soy yogurt and soy milk for a vegan version.', 'Replace berries with banana for more carbohydrates.'],
    coachTip: 'Prepare three jars at once to make breakfast automatic on busy training days.',
  },
  {
    title: 'Egg and avocado breakfast wrap',
    subtitle: 'A warm, filling wrap with protein, fiber and healthy fats.',
    meals: ['breakfast', 'post-workout'],
    diets: ['balanced', 'vegetarian', 'lactose-free'],
    times: ['quick', 'standard'],
    budgets: ['low', 'medium'],
    calories: 520,
    protein: 31,
    carbs: 48,
    fats: 23,
    prepMinutes: 10,
    cost: 'Low',
    ingredients: ['3 eggs', '1 whole-wheat wrap', '½ avocado', 'Tomato', 'Spinach', 'Salt and pepper'],
    steps: ['Scramble the eggs with spinach.', 'Warm the wrap.', 'Add eggs, avocado and tomato, then roll tightly.'],
    swaps: ['Use egg whites for fewer calories.', 'Add salsa or hot sauce without significantly increasing calories.'],
    coachTip: 'For fat loss, use 2 eggs and extra vegetables. For muscle gain, add a second wrap.',
  },
  {
    title: 'Tofu berry smoothie bowl',
    subtitle: 'A thick plant-based bowl with fruit and complete soy protein.',
    meals: ['breakfast', 'snack', 'post-workout'],
    diets: ['vegan', 'lactose-free'],
    times: ['quick'],
    budgets: ['medium', 'flexible'],
    calories: 430,
    protein: 28,
    carbs: 61,
    fats: 10,
    prepMinutes: 6,
    cost: 'Medium',
    ingredients: ['180 g silken tofu', '1 frozen banana', '150 g frozen berries', '150 ml soy milk', '20 g oats', '10 g peanut butter'],
    steps: ['Blend tofu, fruit, soy milk and oats until thick.', 'Pour into a bowl.', 'Top with peanut butter and a few berries.'],
    swaps: ['Use mango instead of berries.', 'Add vegan protein powder to increase protein by 20–25 g.'],
    coachTip: 'Soy milk and tofu provide more protein than most other plant-based alternatives.',
  },
  {
    title: 'Chicken rice power bowl',
    subtitle: 'A reliable high-protein bowl for performance and recovery.',
    meals: ['lunch', 'dinner', 'post-workout'],
    diets: ['balanced', 'lactose-free'],
    times: ['standard', 'meal-prep'],
    budgets: ['low', 'medium'],
    calories: 650,
    protein: 52,
    carbs: 78,
    fats: 14,
    prepMinutes: 25,
    cost: 'Medium',
    ingredients: ['170 g chicken breast', '200 g cooked rice', '150 g mixed vegetables', '1 tsp olive oil', 'Soy sauce', 'Garlic and paprika'],
    steps: ['Season and cook the chicken.', 'Sauté or steam the vegetables.', 'Serve over rice and finish with soy sauce.'],
    swaps: ['Replace chicken with turkey.', 'Use cauliflower rice for a lower-calorie version.'],
    coachTip: 'Cook four portions and store the sauce separately so the rice keeps its texture.',
  },
  {
    title: 'Salmon potato recovery plate',
    subtitle: 'Omega-3 fats, lean protein and easy-to-digest carbohydrates.',
    meals: ['lunch', 'dinner', 'post-workout'],
    diets: ['balanced', 'lactose-free'],
    times: ['standard'],
    budgets: ['medium', 'flexible'],
    calories: 690,
    protein: 46,
    carbs: 63,
    fats: 27,
    prepMinutes: 28,
    cost: 'High',
    ingredients: ['170 g salmon', '300 g potatoes', 'Green beans', '1 tsp olive oil', 'Lemon', 'Dill and garlic'],
    steps: ['Roast or air-fry the potatoes.', 'Season and cook the salmon.', 'Steam the beans and serve with lemon.'],
    swaps: ['Use canned tuna for a cheaper option.', 'Replace potatoes with rice after intense training.'],
    coachTip: 'This is especially useful after demanding sessions because it combines protein, carbs and omega-3 fats.',
  },
  {
    title: 'Turkey hummus crunch wrap',
    subtitle: 'Fast, portable and balanced for lunch or a substantial snack.',
    meals: ['lunch', 'snack'],
    diets: ['balanced', 'lactose-free'],
    times: ['quick'],
    budgets: ['low', 'medium'],
    calories: 480,
    protein: 38,
    carbs: 51,
    fats: 14,
    prepMinutes: 8,
    cost: 'Low',
    ingredients: ['1 whole-wheat wrap', '120 g sliced turkey', '40 g hummus', 'Lettuce', 'Cucumber', 'Bell pepper'],
    steps: ['Spread hummus over the wrap.', 'Layer turkey and vegetables.', 'Roll tightly and slice in half.'],
    swaps: ['Use cooked chicken leftovers.', 'Add a second wrap for a higher-calorie meal.'],
    coachTip: 'Keep washed vegetables ready in the fridge to make this meal in under five minutes.',
  },
  {
    title: 'Lentil quinoa meal-prep bowl',
    subtitle: 'Plant-based protein, fiber and slow-release carbohydrates.',
    meals: ['lunch', 'dinner'],
    diets: ['vegetarian', 'vegan', 'lactose-free'],
    times: ['standard', 'meal-prep'],
    budgets: ['low', 'medium'],
    calories: 570,
    protein: 29,
    carbs: 85,
    fats: 13,
    prepMinutes: 30,
    cost: 'Low',
    ingredients: ['180 g cooked lentils', '150 g cooked quinoa', 'Roasted peppers', 'Spinach', '1 tbsp tahini', 'Lemon and cumin'],
    steps: ['Cook quinoa and warm the lentils.', 'Roast or sauté the vegetables.', 'Mix tahini with lemon and water, then assemble.'],
    swaps: ['Use brown rice instead of quinoa.', 'Add tofu or edamame for more protein.'],
    coachTip: 'Legumes and grains complement each other and create a stronger amino-acid profile.',
  },
  {
    title: 'Creamy high-protein pasta',
    subtitle: 'Comforting pasta with a lighter protein-rich sauce.',
    meals: ['lunch', 'dinner', 'post-workout'],
    diets: ['balanced', 'vegetarian'],
    times: ['standard', 'meal-prep'],
    budgets: ['low', 'medium'],
    calories: 720,
    protein: 48,
    carbs: 98,
    fats: 16,
    prepMinutes: 22,
    cost: 'Medium',
    ingredients: ['100 g dry pasta', '180 g cottage cheese', 'Tomato sauce', 'Spinach', '15 g parmesan', 'Garlic and basil'],
    steps: ['Cook the pasta and reserve a little water.', 'Blend cottage cheese with tomato sauce.', 'Warm the sauce, add spinach and combine with pasta.'],
    swaps: ['Use lentil pasta for more protein.', 'Use lactose-free cottage cheese if needed.'],
    coachTip: 'This is a strong post-workout choice when you need both protein and a larger carbohydrate serving.',
  },
  {
    title: 'Chickpea vegetable curry',
    subtitle: 'A warming plant-based dinner built from affordable pantry foods.',
    meals: ['lunch', 'dinner'],
    diets: ['vegetarian', 'vegan', 'lactose-free'],
    times: ['standard', 'meal-prep'],
    budgets: ['low'],
    calories: 590,
    protein: 23,
    carbs: 91,
    fats: 15,
    prepMinutes: 27,
    cost: 'Low',
    ingredients: ['200 g chickpeas', '150 g cooked rice', 'Tomato', 'Light coconut milk', 'Mixed vegetables', 'Curry powder'],
    steps: ['Cook vegetables with curry powder.', 'Add tomato, coconut milk and chickpeas.', 'Simmer for 12 minutes and serve with rice.'],
    swaps: ['Add tofu for more protein.', 'Use less rice and more vegetables for fat loss.'],
    coachTip: 'Freeze individual portions so you always have a balanced meal available.',
  },
  {
    title: 'Greek yogurt protein cup',
    subtitle: 'A no-cook snack with protein, fruit and a little crunch.',
    meals: ['snack', 'breakfast'],
    diets: ['balanced', 'vegetarian'],
    times: ['quick'],
    budgets: ['low', 'medium'],
    calories: 330,
    protein: 30,
    carbs: 37,
    fats: 8,
    prepMinutes: 3,
    cost: 'Low',
    ingredients: ['250 g Greek yogurt', '1 small banana', '15 g walnuts', 'Cinnamon', '1 tsp honey'],
    steps: ['Add yogurt to a bowl.', 'Top with sliced banana, walnuts and cinnamon.', 'Add honey if desired.'],
    swaps: ['Use lactose-free yogurt.', 'Replace walnuts with cereal for more carbohydrates.'],
    coachTip: 'This snack works well one to two hours before training because it is easy to digest.',
  },
  {
    title: 'Tuna and bean protein salad',
    subtitle: 'High protein, high fiber and ready in minutes.',
    meals: ['lunch', 'dinner', 'snack'],
    diets: ['balanced', 'lactose-free'],
    times: ['quick'],
    budgets: ['low'],
    calories: 470,
    protein: 44,
    carbs: 42,
    fats: 13,
    prepMinutes: 7,
    cost: 'Low',
    ingredients: ['1 can tuna', '150 g white beans', 'Tomato', 'Cucumber', 'Red onion', 'Lemon and 1 tsp olive oil'],
    steps: ['Drain the tuna and beans.', 'Chop the vegetables.', 'Mix everything with lemon, oil, salt and pepper.'],
    swaps: ['Use chickpeas and tofu for a plant-based version.', 'Serve with bread after training.'],
    coachTip: 'Rinsing canned beans lowers sodium and improves their texture.',
  },
  {
    title: 'Peanut banana recovery shake',
    subtitle: 'Fast carbohydrates and protein when a full meal is not practical.',
    meals: ['post-workout', 'snack', 'breakfast'],
    diets: ['balanced', 'vegetarian', 'lactose-free', 'vegan'],
    times: ['quick'],
    budgets: ['low', 'medium', 'flexible'],
    calories: 510,
    protein: 34,
    carbs: 68,
    fats: 14,
    prepMinutes: 4,
    cost: 'Low',
    ingredients: ['1 banana', '300 ml soy milk', '30 g protein powder', '20 g peanut butter', '30 g oats', 'Ice and cinnamon'],
    steps: ['Add all ingredients to a blender.', 'Blend until smooth.', 'Drink immediately after training or alongside a lighter meal.'],
    swaps: ['Use berries for fewer carbohydrates.', 'Add another banana for muscle gain.'],
    coachTip: 'Choose a plant or whey protein that provides around 20–25 g protein per serving.',
  },
];

const GOAL_ADJUSTMENTS: Record<NutritionGoal, { calories: number; protein: number; carbs: number; fats: number; tip: string }> = {
  lose: {
    calories: -110,
    protein: 5,
    carbs: -18,
    fats: -4,
    tip: 'The portion is adjusted for fat loss: protein stays high while energy-dense extras are reduced.',
  },
  maintain: {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    tip: 'The portion is balanced for maintenance, daily energy and training recovery.',
  },
  gain: {
    calories: 180,
    protein: 7,
    carbs: 28,
    fats: 5,
    tip: 'The portion is adjusted for muscle gain with extra protein and training carbohydrates.',
  },
};

export function createMealRecommendation(answers: AssistantAnswers): MealRecommendation {
  const scoredMeals = MEALS.map((meal) => {
    let score = 0;
    if (meal.meals.includes(answers.meal)) score += 8;
    if (meal.diets.includes(answers.diet)) score += 7;
    if (meal.times.includes(answers.time)) score += 4;
    if (meal.budgets.includes(answers.budget)) score += 3;
    if (answers.goal === 'gain' && meal.protein >= 35) score += 3;
    if (answers.goal === 'lose' && meal.calories <= 520) score += 3;
    return { meal, score };
  }).sort((first, second) => second.score - first.score);

  const selected = scoredMeals[0].meal;
  const adjustment = GOAL_ADJUSTMENTS[answers.goal];

  return {
    title: selected.title,
    subtitle: selected.subtitle,
    calories: Math.max(220, selected.calories + adjustment.calories),
    protein: Math.max(15, selected.protein + adjustment.protein),
    carbs: Math.max(15, selected.carbs + adjustment.carbs),
    fats: Math.max(5, selected.fats + adjustment.fats),
    prepMinutes: selected.prepMinutes,
    cost: selected.cost,
    ingredients: [...selected.ingredients],
    steps: [...selected.steps],
    swaps: [...selected.swaps],
    coachTip: `${adjustment.tip} ${selected.coachTip}`,
  };
}

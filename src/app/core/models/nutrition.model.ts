export const nutrientKeys = ['kcal', 'protein', 'carbs', 'fat'] as const;
export type Nutrient = (typeof nutrientKeys)[number];
export type Nutrients = Record<Nutrient, number | null>;

export const meals = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
  { id: 'snack', name: 'Snacks' },
] as const;
export type Meal = (typeof meals)[number]['id'];

export interface Food {
  name: string;
  barcode?: string;
  brand?: string;
  basis: 'g' | 'ml' | 'serving';
  origin: 'manual' | 'open-food-facts' | 'recipe' | 'usda';
  fdcId?: number;
  values: Nutrients;
}

export interface Portion {
  food: Food;
  amount: number;
}
export interface FoodEntry extends Portion {
  id: string;
  kind: 'entry';
  date: string;
  meal: Meal;
}
export interface CompleteDay {
  id: string;
  kind: 'complete';
  date: string;
}
export interface SavedFood {
  id: string;
  kind: 'food';
  name: string;
  food: Food;
}
export interface SavedMeal {
  id: string;
  kind: 'meal';
  name: string;
  items: Portion[];
}
export interface Recipe {
  id: string;
  kind: 'recipe';
  name: string;
  ingredients: Portion[];
  servings: number;
  cookedGrams: number | null;
}
export type NutritionRecord = FoodEntry | CompleteDay | SavedFood | SavedMeal | Recipe;

export interface ImportedRecipe {
  name: string;
  servings: number | null;
  ingredients: string[];
}

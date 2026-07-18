export type Sex = 'male' | 'female' | '';
export type Units = 'metric' | 'imperial';
export type ThemePreference = 'light' | 'dark' | 'system';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  /** poza de profil, ca data-URL (redimensionata client-side) */
  avatar: string;
  heightCm: number | null;
  weightKg: number | null;
  age: number | null;
  sex: Sex;
  units: Units;
  theme: ThemePreference;
  // obiectivul si ritmul saptamanal alese la onboarding, refolosite in Nutrition
  goal: Goal;
  goalRate: number;
  // cate antrenamente pe saptamana isi propune userul
  weeklyWorkoutGoal: number;
  migratedFromLocalStorage?: boolean;
}

// campurile pe care utilizatorul le poate edita din Account/Settings/Nutrition
export type ProfileUpdate = Partial<
  Pick<
    UserProfile,
    | 'displayName'
    | 'avatar'
    | 'heightCm'
    | 'weightKg'
    | 'age'
    | 'sex'
    | 'units'
    | 'theme'
    | 'goal'
    | 'goalRate'
    | 'weeklyWorkoutGoal'
  >
>;

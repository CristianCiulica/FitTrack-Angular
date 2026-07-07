export type Sex = 'male' | 'female' | '';
export type Units = 'metric' | 'imperial';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  heightCm: number | null;
  weightKg: number | null;
  age: number | null;
  sex: Sex;
  units: Units;
  theme: ThemePreference;
  workoutReminderDays: number;
  migratedFromLocalStorage?: boolean;
}

// campurile pe care utilizatorul le poate edita din Account/Settings
export type ProfileUpdate = Partial<
  Pick<
    UserProfile,
    'displayName' | 'heightCm' | 'weightKg' | 'age' | 'sex' | 'units' | 'theme' | 'workoutReminderDays'
  >
>;

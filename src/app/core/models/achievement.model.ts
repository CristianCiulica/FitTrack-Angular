export const ACHIEVEMENT_IDS = [
  'first-session',
  'ten-sessions',
  'twenty-five-days',
  'seven-day-streak',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];
export interface Achievement {
  id: AchievementId;
  label: string;
  detail: string;
  earned: boolean;
}
export function validAchievementId(value: unknown): value is AchievementId {
  return typeof value === 'string' && (ACHIEVEMENT_IDS as readonly string[]).includes(value);
}

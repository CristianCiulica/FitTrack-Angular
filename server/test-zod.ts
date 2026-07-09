import { z } from "zod";
const updateProfileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  age: z.number().int().positive().max(120).nullable().optional(),
  sex: z.enum(['male', 'female', '']).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  workoutReminderDays: z.number().int().min(0).max(30).optional(),
});
console.log(updateProfileSchema.parse({ units: 'imperial' }));

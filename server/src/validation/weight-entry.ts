import { z } from 'zod';

export const weightDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(date => {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  // A user's local calendar can be one day ahead of UTC.
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return date >= '1900-01-01' && date <= tomorrow;
}, 'Choose a valid past or current date');
export const weightBodySchema = z.object({ weightKg: z.number().finite().min(1).max(500) });

import { Schema, model, type InferSchemaType } from 'mongoose';

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Full Body',
] as const;

const exerciseLogSchema = new Schema(
  {
    exerciseName: { type: String, required: true },
    muscleGroup: { type: String, enum: MUSCLE_GROUPS, required: true },
    sets: { type: Number, required: true, min: 0 },
    reps: { type: Number, required: true, min: 0 },
    repUnit: { type: String, enum: ['seconds'], default: undefined },
    weight: { type: Number, required: true, min: 0 },
    setWeights: { type: [Number], default: undefined },
    setReps: { type: [Number], default: undefined },
  },
  { _id: false },
);

const workoutSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    clientId: { type: String, default: undefined },
    kind: { type: String, enum: ['routine', 'session'], default: undefined },
    name: { type: String, required: true },
    date: { type: String, required: true },
    durationSeconds: { type: Number, min: 0, max: 604800, default: undefined },
    notes: { type: String, default: '' },
    isPredefined: { type: Boolean, default: false },
    exercises: { type: [exerciseLogSchema], default: [] },
  },
  { timestamps: true },
);

workoutSchema.index({ userId: 1, date: -1 });
workoutSchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } },
);

export type WorkoutDoc = InferSchemaType<typeof workoutSchema>;
export const Workout = model('Workout', workoutSchema);
export { MUSCLE_GROUPS };

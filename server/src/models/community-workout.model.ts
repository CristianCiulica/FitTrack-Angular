import { Schema, model, type InferSchemaType } from 'mongoose';
import { MUSCLE_GROUPS } from './workout.model';

const exerciseLogSchema = new Schema(
  {
    exerciseName: { type: String, required: true },
    muscleGroup: { type: String, enum: MUSCLE_GROUPS, required: true },
    sets: { type: Number, required: true, min: 0 },
    reps: { type: Number, required: true, min: 0 },
    weight: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const communityWorkoutSchema = new Schema(
  {
    originalWorkoutId: { type: String, required: false },
    authorId: { type: String, required: true, index: true },
    authorName: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    exercises: { type: [exerciseLogSchema], default: [] },
  },
  { timestamps: true },
);

// We can search/sort by newest
communityWorkoutSchema.index({ createdAt: -1 });

export type CommunityWorkoutDoc = InferSchemaType<typeof communityWorkoutSchema>;
export const CommunityWorkout = model('CommunityWorkout', communityWorkoutSchema);

import { Schema, model, type InferSchemaType } from 'mongoose';

const userProfileSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: '' },
    displayName: { type: String, default: '' },
    // poza de profil, ca data-URL redimensionat client-side (max ~200KB)
    avatar: { type: String, default: '' },
    heightCm: { type: Number, default: null },
    weightKg: { type: Number, default: null },
    age: { type: Number, default: null },
    sex: { type: String, enum: ['male', 'female', ''], default: '' },
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    goal: { type: String, enum: ['lose', 'maintain', 'gain'], default: 'maintain' },
    goalRate: { type: Number, default: 0.5 },
    moveGoal: { type: Number, default: 500 },
    exerciseGoal: { type: Number, default: 30 },
    weeklyWorkoutGoal: { type: Number, default: 4 },
    migratedFromLocalStorage: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type UserProfileDoc = InferSchemaType<typeof userProfileSchema>;
export const UserProfile = model('UserProfile', userProfileSchema);

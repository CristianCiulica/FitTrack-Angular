import { Schema, model, type InferSchemaType } from 'mongoose';

const runningSessionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    mode: { type: String, enum: ['running', 'walking'], required: true },
    startedAt: { type: String, required: true },
    endedAt: { type: String, required: true },
    durationSeconds: { type: Number, required: true, min: 0 },
    distanceMeters: { type: Number, required: true, min: 0 },
    steps: { type: Number, required: true, min: 0 },
    averageSpeedKmh: { type: Number, required: true, min: 0 },
    calories: { type: Number, required: true, min: 0 },
    // traseul GPS: perechi [lat, lng]
    route: { type: [[Number]], default: [] },
  },
  { timestamps: true },
);

runningSessionSchema.index({ userId: 1, startedAt: -1 });

export type RunningSessionDoc = InferSchemaType<typeof runningSessionSchema>;
export const RunningSession = model('RunningSession', runningSessionSchema);

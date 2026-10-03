import { Schema, model } from 'mongoose';

const schema = new Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  weightKg: { type: Number, required: true, min: 1, max: 500 },
}, { timestamps: true });
schema.index({ userId: 1, date: 1 }, { unique: true });
export const WeightEntry = model('WeightEntry', schema);

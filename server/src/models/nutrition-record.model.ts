import { Schema, model } from 'mongoose';

const schema = new Schema({
  userId: { type: String, required: true },
  recordId: { type: String, required: true },
  date: { type: String },
  data: { type: Schema.Types.Mixed, required: true },
});

schema.index({ userId: 1, recordId: 1 }, { unique: true });
schema.index({ userId: 1, date: 1 });

export const NutritionRecord = model('NutritionRecord', schema);

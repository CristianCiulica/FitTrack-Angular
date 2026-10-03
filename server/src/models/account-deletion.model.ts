import { Schema, model } from 'mongoose';

// Kept only while deletion is pending; removed after every store is erased.
export const AccountDeletion = model(
  'AccountDeletion',
  new Schema(
    {
      uid: { type: String, unique: true, required: true },
    },
    { timestamps: true },
  ),
);

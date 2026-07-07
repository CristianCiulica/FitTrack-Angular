import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectMongo(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { autoIndex: true });
  console.log(`[mongo] connected to ${redactUri(env.mongoUri)}`);
}

function redactUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

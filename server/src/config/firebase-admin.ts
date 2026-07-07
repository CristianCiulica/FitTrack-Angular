import * as fs from 'node:fs';
import * as path from 'node:path';
import admin from 'firebase-admin';
import { env } from './env';

let initialized = false;

export function initFirebaseAdmin(): void {
  if (initialized) return;

  const credentials = resolveServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(credentials),
    projectId: env.firebaseProjectId || credentials.project_id,
  });
  initialized = true;
}

export function getAuth() {
  if (!initialized) initFirebaseAdmin();
  return admin.auth();
}

function resolveServiceAccount(): admin.ServiceAccount & { project_id?: string } {
  if (env.firebaseServiceAccountJson) {
    try {
      return JSON.parse(env.firebaseServiceAccountJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  }

  if (env.firebaseServiceAccountPath) {
    const absolutePath = path.isAbsolute(env.firebaseServiceAccountPath)
      ? env.firebaseServiceAccountPath
      : path.resolve(process.cwd(), env.firebaseServiceAccountPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Firebase service account file not found at ${absolutePath}`);
    }
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  }

  throw new Error(
    'Provide either FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON',
  );
}

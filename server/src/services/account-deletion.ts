import { getAuth } from '../config/firebase-admin';
import { AccountDeletion } from '../models/account-deletion.model';
import { UserProfile } from '../models/user-profile.model';
import { WeightEntry } from '../models/weight-entry.model';
import { Workout } from '../models/workout.model';
import { RunningSession } from '../models/running-session.model';

const inFlight = new Map<string, Promise<void>>();

export async function performDeletion(steps: {
  markPending: () => Promise<unknown>;
  eraseData: () => Promise<unknown>;
  eraseIdentity: () => Promise<unknown>;
  eraseProfile: () => Promise<unknown>;
  finish: () => Promise<unknown>;
}): Promise<void> {
  await steps.markPending();
  await steps.eraseData();
  try {
    await steps.eraseIdentity();
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  await steps.eraseProfile();
  await steps.finish();
}

async function erase(uid: string): Promise<void> {
  return performDeletion({
    markPending: async () =>
      await AccountDeletion.updateOne({ uid }, { $setOnInsert: { uid } }, { upsert: true }),
    eraseData: async () => {
      const legacyPosts = UserProfile.db.collection('communityworkouts');
      const legacyProfiles = UserProfile.db.collection(UserProfile.collection.collectionName);
      await Promise.all([
        WeightEntry.deleteMany({ userId: uid }),
        Workout.deleteMany({ userId: uid }),
        RunningSession.deleteMany({ userId: uid }),
        legacyPosts.deleteMany({ authorId: uid }),
        legacyPosts.updateMany({ authorId: { $ne: uid } }, {
          $pull: { likes: uid, comments: { authorId: uid } },
        } as any),
        legacyProfiles.updateMany({ following: uid }, { $pull: { following: uid } } as any),
      ]);
    },
    // Never report success while the Firebase identity still exists. Keeping the
    // profile and deletion job until this succeeds makes outages safely retryable.
    eraseIdentity: () => getAuth().deleteUser(uid),
    eraseProfile: async () => UserProfile.deleteOne({ uid }),
    finish: async () => AccountDeletion.deleteOne({ uid }),
  });
}

export function deleteAccount(uid: string): Promise<void> {
  const existing = inFlight.get(uid);
  if (existing) return existing;
  const request = erase(uid).finally(() => inFlight.delete(uid));
  inFlight.set(uid, request);
  return request;
}

export function resumeAccountDeletions(): void {
  let scanning = false;
  const retry = async () => {
    if (scanning) return;
    scanning = true;
    try {
      const pending = await AccountDeletion.find().select('uid').limit(100).lean();
      for (const job of pending) {
        try {
          await deleteAccount(job.uid);
        } catch (error) {
          console.warn('[account] deletion will retry', (error as Error).message);
        }
      }
    } catch (error) {
      console.warn('[account] deletion queue unavailable', (error as Error).message);
    } finally {
      scanning = false;
    }
  };
  void retry();
  setInterval(() => void retry(), 60_000).unref();
}

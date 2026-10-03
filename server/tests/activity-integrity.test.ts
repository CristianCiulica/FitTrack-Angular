import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workoutBodySchema, sessionBodySchema } from '../src/validation/activity';
import { createOnce } from '../src/utils/idempotent-create';
import { performDeletion } from '../src/services/account-deletion';
import { makeRequireAuth } from '../src/middleware/auth';

const workout = {
  name: 'Push',
  date: '2026-10-03',
  kind: 'session',
  exercises: [
    {
      exerciseName: 'Press',
      muscleGroup: 'Chest',
      sets: 2,
      reps: 10,
      weight: 50,
      setReps: [10, 8],
      setWeights: [50, 55],
    },
  ],
};
test('rejects invalid dates, fractional sets and mismatched per-set data while retaining timed exercises', () => {
  assert.equal(workoutBodySchema.safeParse(workout).success, true);
  for (const changes of [
    { date: 'not-a-date' },
    { date: '2026-02-30' },
    { exercises: [{ ...workout.exercises[0], sets: 2.5 }] },
    { exercises: [{ ...workout.exercises[0], setReps: [10] }] },
  ]) {
    assert.equal(workoutBodySchema.safeParse({ ...workout, ...changes }).success, false);
  }
  assert.equal(
    workoutBodySchema.safeParse({
      ...workout,
      exercises: [{ ...workout.exercises[0], repUnit: 'seconds' }],
    }).success,
    true,
  );
});
test('rejects impossible run time ranges and fractional steps', () => {
  const session = {
    mode: 'running',
    startedAt: '2026-10-03T12:00:00Z',
    endedAt: '2026-10-03T12:10:00Z',
    durationSeconds: 600,
    distanceMeters: 1000,
    steps: 900,
    averageSpeedKmh: 6,
    calories: 60,
  };
  assert.equal(sessionBodySchema.safeParse(session).success, true);
  assert.equal(
    sessionBodySchema.safeParse({ ...session, endedAt: '2026-10-03T11:00:00Z' }).success,
    false,
  );
  assert.equal(sessionBodySchema.safeParse({ ...session, durationSeconds: 700 }).success, false);
  assert.equal(sessionBodySchema.safeParse({ ...session, steps: 10.5 }).success, false);
});
test('retrying the same operation, including after a lost response, creates one record per account', async () => {
  const records = new Map<string, any>();
  const model = {
    findOneAndUpdate: async (filter: any, update: any) => {
      const key = `${filter.userId}:${filter.clientId}`;
      if (!records.has(key)) records.set(key, { ...update.$setOnInsert, _id: records.size + 1 });
      return records.get(key);
    },
  };
  const first = await createOnce(model, 'alice', { ...workout, clientId: 'w_same' });
  const retry = await createOnce(model, 'alice', { ...workout, clientId: 'w_same' });
  assert.deepEqual(first, retry);
  assert.equal(records.size, 1);
  await createOnce(model, 'bob', { ...workout, clientId: 'w_same' });
  assert.equal(records.size, 2);
});
test('a concurrent unique-key conflict returns the already created record', async () => {
  const saved = { _id: 'saved' };
  const model = {
    findOneAndUpdate: async () => {
      throw Object.assign(new Error('Duplicate'), { code: 11000 });
    },
    findOne: async () => saved,
  };
  assert.equal(await createOnce(model, 'alice', { clientId: 'w_same' }), saved);
});
test('Firebase deletion failure keeps the deletion pending and never confirms completion', async () => {
  const calls: string[] = [];
  const step = (name: string) => async () => {
    calls.push(name);
  };
  await assert.rejects(
    performDeletion({
      markPending: step('pending'),
      eraseData: step('data'),
      eraseIdentity: async () => {
        throw new Error('Firebase offline');
      },
      eraseProfile: step('profile'),
      finish: step('finished'),
    }),
    /offline/,
  );
  assert.deepEqual(calls, ['pending', 'data']);
});
test('a retry after identity deletion finishes cleanup instead of recreating the account', async () => {
  const calls: string[] = [];
  const step = (name: string) => async () => {
    calls.push(name);
  };
  await performDeletion({
    markPending: step('pending'),
    eraseData: step('data'),
    eraseIdentity: async () => {
      throw Object.assign(new Error('Gone'), { code: 'auth/user-not-found' });
    },
    eraseProfile: step('profile'),
    finish: step('finished'),
  });
  assert.deepEqual(calls, ['pending', 'data', 'profile', 'finished']);
});
test('authentication checks revocation before allowing access and blocks a pending deletion except its retry', async () => {
  let revokedCheck = false;
  const middleware = makeRequireAuth({
    auth: () =>
      ({
        verifyIdToken: async (_token: string, revoked: boolean) => {
          revokedCheck = revoked;
          return { uid: 'alice', auth_time: 0 };
        },
      }) as any,
    deletionExists: async () => true as any,
  });
  let status = 0;
  let passed = false;
  const res = {
    status: (value: number) => {
      status = value;
      return res;
    },
    json: () => {},
  } as any;
  await middleware(
    {
      headers: { authorization: 'Bearer retained' },
      method: 'GET',
      baseUrl: '/api/me',
      path: '/',
    } as any,
    res,
    () => {
      passed = true;
    },
  );
  assert.equal(revokedCheck, true);
  assert.equal(status, 403);
  assert.equal(passed, false);
  await middleware(
    {
      headers: { authorization: 'Bearer retained' },
      method: 'DELETE',
      baseUrl: '/api/me',
      path: '/',
    } as any,
    res,
    () => {
      passed = true;
    },
  );
  assert.equal(passed, true);
});
test('a revoked or deleted identity never reaches private routes', async () => {
  let passed = false;
  let status = 0;
  const middleware = makeRequireAuth({
    auth: () =>
      ({
        verifyIdToken: async () => {
          throw new Error('Deleted');
        },
      }) as any,
    deletionExists: async () => null as any,
  });
  const res = {
    status: (value: number) => {
      status = value;
      return res;
    },
    json: () => {},
  } as any;
  await middleware({ headers: { authorization: 'Bearer retained' } } as any, res, () => {
    passed = true;
  });
  assert.equal(passed, false);
  assert.equal(status, 401);
});

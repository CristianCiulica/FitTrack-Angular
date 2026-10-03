import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Workout } from '../src/models/workout.model';
import { UserProfile } from '../src/models/user-profile.model';
import router from '../src/routes/migrate.routes';

test('a migration marker failure can be retried without inserting the same legacy session twice', async () => {
  const records = new Map<string, any>();
  let failed = false;
  let migrated = false;
  (UserProfile as any).findOne = async () => ({ migratedFromLocalStorage: migrated });
  (UserProfile as any).updateOne = async () => {
    if (!failed) {
      failed = true;
      throw new Error('Lost marker');
    }
    migrated = true;
  };
  (Workout as any).findOneAndUpdate = async (filter: any, update: any) => {
    const key = `${filter.userId}:${filter.clientId}`;
    if (!records.has(key)) records.set(key, { ...update.$setOnInsert, _id: 'saved' });
    return records.get(key);
  };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { uid: 'alice' };
    next();
  });
  app.use('/migrate', router);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(500).json({ error: err.message }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as any).port}/migrate`;
    const body = JSON.stringify({
      workouts: [{ name: 'Push', date: '2026-10-03', exercises: [] }],
    });
    const request = () =>
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal((await request()).status, 500);
    assert.equal(records.size, 1);
    assert.equal((await request()).status, 200);
    assert.equal(records.size, 1);
    assert.equal(migrated, true);
  } finally {
    server.close();
  }
});

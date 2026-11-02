import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyAppData, type ActiveSession, type CompletedWorkout, type Profile } from '../domain/types';
import { deleteDb, MIGRATIONS, openDb, SCHEMA_VERSION, StorageError } from './db';
import { commitWorkout, deleteKv, loadAll, putKv, putRecoveryDay, putThoughtDay, putWorkout, replaceAll } from './repo';

// Every test uses its own throw-away database name; the real "pullup-pro"
// database is never opened by tests (guardrail: tests never touch real data).
const opened: { name: string; db: IDBDatabase }[] = [];
async function freshDb(migrations = MIGRATIONS, version?: number) {
  const name = `test-${crypto.randomUUID()}`;
  const db = await openDb(name, migrations, version);
  opened.push({ name, db });
  return { name, db };
}
afterEach(async () => {
  for (const { name, db } of opened.splice(0)) {
    db.close();
    await deleteDb(name);
  }
});

const profile: Profile = {
  name: 'Isa', lang: 'en', equipment: ['bar'], daysPerWeek: 4, sessionMinutes: 30, goals: [],
  startDate: '2025-03-03', createdAtUtc: '2025-03-03T08:00:00.000Z', onboarding: 'done',
};

function workout(id: string, localDate = '2025-03-04'): CompletedWorkout {
  return {
    id, type: 'pullStrength', level: 1, startedAtUtc: `${localDate}T08:00:00.000Z`, completedAtUtc: `${localDate}T08:30:00.000Z`,
    localDate, timeZone: 'Europe/Istanbul', durationSec: 1800, exercises: [],
    flags: { lighterWeek: false, returnAfterBreak: false, feelingOff: false, maxTestSuggested: false, noPullEquipment: false, painRecently: false },
    mood: null, note: '', finishedEarly: false,
  };
}

describe('storage', () => {
  it('opens at the latest schema version with every store', async () => {
    const { db } = await freshDb();
    expect(db.version).toBe(SCHEMA_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['kv', 'recoveryDays', 'snapshots', 'thoughtDays', 'workouts']);
  });

  it('returns defaults for an empty database', async () => {
    const { db } = await freshDb();
    const data = await loadAll(db);
    expect(data.profile).toBeNull();
    expect(data.settings).toEqual(DEFAULT_SETTINGS);
    expect(data.workouts).toEqual([]);
  });

  it('round-trips key-value records and merges new setting defaults', async () => {
    const { db } = await freshDb();
    await putKv(db, 'profile', profile);
    await putKv(db, 'settings', { sound: true } as never);
    await putKv(db, 'favorites', ['life-01']);
    const data = await loadAll(db);
    expect(data.profile).toEqual(profile);
    expect(data.settings).toEqual({ sound: true, vibration: true });
    expect(data.favorites).toEqual(['life-01']);
    await deleteKv(db, 'favorites');
    expect((await loadAll(db)).favorites).toEqual([]);
  });

  it('sorts workouts, recovery days and thought days chronologically', async () => {
    const { db } = await freshDb();
    await putWorkout(db, workout('b', '2025-03-06'));
    await putWorkout(db, workout('a', '2025-03-04'));
    await putRecoveryDay(db, { localDate: '2025-03-07', atUtc: '2025-03-07T09:00:00.000Z', timeZone: null, reason: null });
    await putRecoveryDay(db, { localDate: '2025-03-05', atUtc: '2025-03-05T09:00:00.000Z', timeZone: null, reason: 'tired' });
    await putThoughtDay(db, { localDate: '2025-03-05', thoughtId: 'time-01', atUtc: '2025-03-05T09:00:00.000Z' });
    const data = await loadAll(db);
    expect(data.workouts.map((w) => w.id)).toEqual(['a', 'b']);
    expect(data.recoveryDays.map((d) => d.localDate)).toEqual(['2025-03-05', '2025-03-07']);
    expect(data.thoughtDays).toHaveLength(1);
  });

  it('commits a workout and clears the active session in one transaction', async () => {
    const { db } = await freshDb();
    await putKv(db, 'active', { id: 'w1' } as ActiveSession);
    await commitWorkout(db, workout('w1'));
    const data = await loadAll(db);
    expect(data.active).toBeNull();
    expect(data.workouts.map((w) => w.id)).toEqual(['w1']);
  });

  it('keeps the active session when the completion write fails (atomic)', async () => {
    const { db } = await freshDb();
    await putKv(db, 'active', { id: 'w1' } as ActiveSession);
    const broken = { ...workout('w1'), id: undefined } as unknown as CompletedWorkout; // violates keyPath
    await expect(commitWorkout(db, broken)).rejects.toBeInstanceOf(StorageError);
    const data = await loadAll(db);
    expect(data.active).toEqual({ id: 'w1' });
    expect(data.workouts).toEqual([]);
  });

  it('replaceAll swaps every data store in one go and keeps snapshots', async () => {
    const { db } = await freshDb();
    await putKv(db, 'profile', profile);
    await putWorkout(db, workout('old'));
    await putRecoveryDay(db, { localDate: '2025-03-05', reason: null, atUtc: '2025-03-05T08:00:00.000Z', timeZone: null });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').put({ id: 'snap-1' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const next = emptyAppData();
    next.profile = { ...profile, name: 'New' };
    next.workouts = [workout('a', '2025-03-10'), workout('b', '2025-03-11')];
    next.favorites = ['t-1'];
    await replaceAll(db, next);
    const data = await loadAll(db);
    expect(data.profile?.name).toBe('New');
    expect(data.workouts.map((w) => w.id)).toEqual(['a', 'b']);
    expect(data.recoveryDays).toEqual([]);
    expect(data.favorites).toEqual(['t-1']);
    const snaps = await new Promise<unknown[]>((resolve) => {
      const req = db.transaction('snapshots').objectStore('snapshots').getAll();
      req.onsuccess = () => resolve(req.result as unknown[]);
    });
    expect(snaps).toHaveLength(1);
  });

  it('replaceAll changes nothing when any record is invalid (atomic)', async () => {
    const { db } = await freshDb();
    await putKv(db, 'profile', profile);
    await putWorkout(db, workout('keep'));
    const next = emptyAppData();
    next.profile = { ...profile, name: 'Broken' };
    next.workouts = [workout('a'), { ...workout('b'), id: undefined } as unknown as CompletedWorkout];
    await expect(replaceAll(db, next)).rejects.toBeInstanceOf(StorageError);
    const data = await loadAll(db);
    expect(data.profile?.name).toBe('Isa');
    expect(data.workouts.map((w) => w.id)).toEqual(['keep']);
  });

  it('migrates v1 → v3 and preserves every existing record', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const v1 = await openDb(name, MIGRATIONS.slice(0, 1), 1);
    const legacy = workout('old');
    delete (legacy as Partial<CompletedWorkout>).timeZone;
    await putWorkout(v1, legacy);
    await putKv(v1, 'profile', profile);
    await putRecoveryDay(v1, { localDate: '2025-03-05', atUtc: '2025-03-05T09:00:00.000Z', timeZone: null, reason: null });
    expect([...v1.objectStoreNames]).not.toContain('thoughtDays');
    expect((await loadAll(v1)).workouts).toHaveLength(1); // loadAll copes with a v1 schema
    v1.close();

    const v2 = await openDb(name);
    opened.push({ name, db: v2 });
    expect(v2.version).toBe(MIGRATIONS.length);
    const data = await loadAll(v2);
    expect(data.profile).toEqual(profile);
    expect(data.rotation).toBeNull(); // derived from the history on the next start
    expect(data.recoveryDays).toHaveLength(1);
    expect(data.workouts).toHaveLength(1);
    expect(data.workouts[0]).toEqual({ ...legacy, timeZone: null });
    await putThoughtDay(v2, { localDate: '2025-03-06', thoughtId: 'hope-02', atUtc: '2025-03-06T07:00:00.000Z' });
    expect((await loadAll(v2)).thoughtDays).toHaveLength(1);
  });

  it('keeps the rotation checkpoint in kv; a replace without one clears the old one', async () => {
    const { db } = await freshDb();
    const rotation = {
      rules: 2, asOf: '2026-01-14', startDate: '2026-01-05', weekStart: '2026-01-12', activeDaysPerWeek: 4, plannedTrainingSessionsPerWeek: 4,
      scheduleCursor: 2, rotationDays: 4, trainingRotationIndex: 2, completedTrainingSessions: 2, completedRecoverySessions: 0, digest: 'abc',
    } as const;
    await putKv(db, 'rotation', rotation);
    expect((await loadAll(db)).rotation).toEqual(rotation);
    await replaceAll(db, { ...emptyAppData(), profile });
    expect((await loadAll(db)).rotation).toBeNull();
  });

  it('migrations are strictly increasing and documented', () => {
    MIGRATIONS.forEach((m, i) => {
      expect(m.version).toBe(i + 1);
      expect(m.description.length).toBeGreaterThan(10);
    });
  });
});

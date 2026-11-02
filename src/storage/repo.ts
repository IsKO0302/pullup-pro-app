import {
  DEFAULT_META, DEFAULT_SETTINGS, emptyAppData,
  type ActiveSession, type AppData, type CompletedWorkout, type MaxEntry, type Meta, type Profile,
  type RecentThought, type RecoveryDay, type Settings, type ThoughtDay,
} from '../domain/types';
import { collect, runTx, SCHEMA_VERSION, StorageError, type StoreName } from './db';

export type KvKey = 'profile' | 'settings' | 'meta' | 'active' | 'favorites' | 'recent' | 'maxEntries';
export interface KvValues {
  profile: Profile;
  settings: Settings;
  meta: Meta;
  active: ActiveSession;
  favorites: string[];
  recent: RecentThought[];
  maxEntries: MaxEntry[];
}

export const DATA_STORES: StoreName[] = ['kv', 'workouts', 'recoveryDays', 'thoughtDays'];

function existingStores(db: IDBDatabase, stores: StoreName[]): StoreName[] {
  return stores.filter((s) => db.objectStoreNames.contains(s));
}

function toAppData(keys: IDBValidKey[], values: unknown[], workouts: unknown[], recovery: unknown[], thoughts: unknown[]): AppData {
  const data = emptyAppData();
  const kv = new Map<string, unknown>(keys.map((k, i) => [String(k), values[i]]));
  data.profile = (kv.get('profile') as Profile | undefined) ?? null;
  data.settings = { ...DEFAULT_SETTINGS, ...((kv.get('settings') as Partial<Settings> | undefined) ?? {}) };
  data.meta = { ...DEFAULT_META, ...((kv.get('meta') as Partial<Meta> | undefined) ?? {}) };
  data.active = (kv.get('active') as ActiveSession | undefined) ?? null;
  data.favorites = (kv.get('favorites') as string[] | undefined) ?? [];
  data.recent = (kv.get('recent') as RecentThought[] | undefined) ?? [];
  data.maxEntries = (kv.get('maxEntries') as MaxEntry[] | undefined) ?? [];
  data.workouts = sortWorkouts(workouts as CompletedWorkout[]);
  data.recoveryDays = (recovery as RecoveryDay[]).sort((a, b) => a.localDate.localeCompare(b.localDate));
  data.thoughtDays = (thoughts as ThoughtDay[]).sort((a, b) => a.localDate.localeCompare(b.localDate));
  return data;
}

/** Issues every read inside `tx`; calls `done` once all of them succeeded. */
function readAll(tx: IDBTransaction, stores: StoreName[], done: (data: AppData) => void) {
  const kv = tx.objectStore('kv');
  const keys = kv.getAllKeys();
  const values = kv.getAll();
  const workouts = tx.objectStore('workouts').getAll();
  const recovery = tx.objectStore('recoveryDays').getAll();
  const thoughts = stores.includes('thoughtDays') ? tx.objectStore('thoughtDays').getAll() : null;
  const requests: IDBRequest[] = [keys, values, workouts, recovery, ...(thoughts ? [thoughts] : [])];
  let left = requests.length;
  const onSuccess = () => {
    left -= 1;
    if (left === 0) done(toAppData(keys.result, values.result, workouts.result, recovery.result, thoughts?.result ?? []));
  };
  for (const r of requests) r.addEventListener('success', onSuccess);
}

/** Clears the data stores and writes `data` (inside an open readwrite `tx`). */
function writeAll(tx: IDBTransaction, stores: StoreName[], data: AppData) {
  for (const s of stores) tx.objectStore(s).clear();
  const kv = tx.objectStore('kv');
  if (data.profile) kv.put(data.profile, 'profile');
  kv.put(data.settings, 'settings');
  kv.put(data.meta, 'meta');
  if (data.active) kv.put(data.active, 'active');
  kv.put(data.favorites, 'favorites');
  kv.put(data.recent, 'recent');
  kv.put(data.maxEntries, 'maxEntries');
  const workouts = tx.objectStore('workouts');
  for (const w of data.workouts) workouts.put(w);
  const recovery = tx.objectStore('recoveryDays');
  for (const r of data.recoveryDays) recovery.put(r);
  if (stores.includes('thoughtDays')) {
    const thoughts = tx.objectStore('thoughtDays');
    for (const t of data.thoughtDays) thoughts.put(t);
  }
}

export async function loadAll(db: IDBDatabase): Promise<AppData> {
  const stores = existingStores(db, DATA_STORES);
  const box = await runTx(db, stores, 'readonly', (tx) => {
    const out: { data: AppData | null } = { data: null };
    readAll(tx, stores, (d) => { out.data = d; });
    return out;
  });
  if (!box.data) throw new StorageError('unknown', 'Reading the database did not finish');
  return box.data;
}

export function sortWorkouts(list: CompletedWorkout[]): CompletedWorkout[] {
  return [...list].sort((a, b) => a.startedAtUtc.localeCompare(b.startedAtUtc));
}

export function putKv<K extends KvKey>(db: IDBDatabase, key: K, value: KvValues[K]): Promise<void> {
  return runTx(db, ['kv'], 'readwrite', (tx) => { tx.objectStore('kv').put(value, key); });
}

export function deleteKv(db: IDBDatabase, key: KvKey): Promise<void> {
  return runTx(db, ['kv'], 'readwrite', (tx) => { tx.objectStore('kv').delete(key); });
}

/** Atomic completion: the workout is written and the active session removed in ONE transaction. */
export function commitWorkout(db: IDBDatabase, workout: CompletedWorkout): Promise<void> {
  return runTx(db, ['kv', 'workouts'], 'readwrite', (tx) => {
    tx.objectStore('workouts').put(workout);
    tx.objectStore('kv').delete('active');
  });
}

export function putWorkout(db: IDBDatabase, workout: CompletedWorkout): Promise<void> {
  return runTx(db, ['workouts'], 'readwrite', (tx) => { tx.objectStore('workouts').put(workout); });
}

export function deleteWorkout(db: IDBDatabase, id: string): Promise<void> {
  return runTx(db, ['workouts'], 'readwrite', (tx) => { tx.objectStore('workouts').delete(id); });
}

export function putRecoveryDay(db: IDBDatabase, day: RecoveryDay): Promise<void> {
  return runTx(db, ['recoveryDays'], 'readwrite', (tx) => { tx.objectStore('recoveryDays').put(day); });
}

export function deleteRecoveryDay(db: IDBDatabase, localDate: string): Promise<void> {
  return runTx(db, ['recoveryDays'], 'readwrite', (tx) => { tx.objectStore('recoveryDays').delete(localDate); });
}

export function putThoughtDay(db: IDBDatabase, day: ThoughtDay): Promise<void> {
  return runTx(db, ['thoughtDays'], 'readwrite', (tx) => { tx.objectStore('thoughtDays').put(day); });
}

/**
 * Replaces ALL user data in one transaction (dev/e2e demo seeding).
 * Either everything is written or nothing changes. Snapshots are kept.
 */
export function replaceAll(db: IDBDatabase, data: AppData): Promise<void> {
  const stores = existingStores(db, DATA_STORES);
  return runTx(db, stores, 'readwrite', (tx) => writeAll(tx, stores, data));
}

// ── Snapshots: automatic internal copies before every destructive change ────

export type SnapshotReason = 'preImport' | 'preReset' | 'preRestore';
export interface SnapshotInfo {
  id: string;
  reason: SnapshotReason;
  atUtc: string;
  schemaVersion: number;
  workouts: number;
}
export interface Snapshot extends SnapshotInfo {
  data: AppData;
}

/** The newest copies are kept; older ones are pruned in the same transaction. */
export const SNAPSHOT_KEEP = 3;

export interface ApplyResult {
  before: AppData;
  after: AppData;
  /** null when there was nothing to protect (no profile, no history). */
  snapshotId: string | null;
}

/**
 * The ONLY way import, reset and restore change data: inside ONE readwrite
 * transaction it reads the current data, stores it as a snapshot (pruning
 * old ones), computes `next = transform(current)` and writes it. If anything
 * fails — a bad record, a full disk, an exception in `transform` — the whole
 * transaction aborts: no snapshot, no change.
 */
export function applyWithSnapshot(
  db: IDBDatabase,
  reason: SnapshotReason,
  atUtc: string,
  transform: (current: AppData) => AppData,
  isEmpty: (data: AppData) => boolean = () => false,
): Promise<ApplyResult> {
  const stores = existingStores(db, DATA_STORES);
  const out: { result: ApplyResult | null; error: unknown } = { result: null, error: null };
  return runTx(db, [...stores, 'snapshots'], 'readwrite', (tx) => {
    const guard = (fn: () => void) => {
      try {
        fn();
      } catch (err) {
        out.error = err;
        try { tx.abort(); } catch { /* already aborting */ }
      }
    };
    readAll(tx, stores, (current) => guard(() => {
      const next = transform(current);
      let snapshotId: string | null = null;
      if (isEmpty(current)) {
        writeAll(tx, stores, next);
      } else {
        const id = `${atUtc}|${reason}`;
        snapshotId = id;
        const snapshots = tx.objectStore('snapshots');
        const snapshot: Snapshot = { id, reason, atUtc, schemaVersion: SCHEMA_VERSION, workouts: current.workouts.length, data: current };
        const keys = snapshots.getAllKeys();
        keys.onsuccess = () => guard(() => {
          const old = (keys.result as string[]).filter((k) => k !== id).sort();
          for (const k of old.slice(0, Math.max(0, old.length - (SNAPSHOT_KEEP - 1)))) snapshots.delete(k);
          snapshots.put(snapshot);
          writeAll(tx, stores, next);
        });
      }
      out.result = { before: current, after: next, snapshotId };
    }));
  }).then(
    () => {
      if (!out.result) throw new StorageError('unknown', 'The change did not finish');
      return out.result;
    },
    (err: unknown) => {
      // Prefer the original cause (e.g. a bad record) over the generic abort.
      const cause = out.error ?? err;
      throw cause instanceof Error ? cause : new StorageError('unknown', String(cause));
    },
  );
}

export async function listSnapshots(db: IDBDatabase): Promise<SnapshotInfo[]> {
  const box = await runTx(db, ['snapshots'], 'readonly', (tx) => collect(tx.objectStore('snapshots').getAll()));
  return ((box.value ?? []) as Snapshot[])
    .map(({ id, reason, atUtc, schemaVersion, workouts }) => ({ id, reason, atUtc, schemaVersion, workouts }))
    .sort((a, b) => b.atUtc.localeCompare(a.atUtc));
}

export async function getSnapshot(db: IDBDatabase, id: string): Promise<Snapshot | null> {
  const box = await runTx(db, ['snapshots'], 'readonly', (tx) => collect(tx.objectStore('snapshots').get(id)));
  return (box.value as Snapshot | undefined) ?? null;
}

/** Nothing worth a snapshot (fresh install or right after a reset). */
export function isEmptyData(data: AppData): boolean {
  return !data.profile && data.workouts.length === 0 && data.recoveryDays.length === 0 && data.maxEntries.length === 0 && data.favorites.length === 0;
}

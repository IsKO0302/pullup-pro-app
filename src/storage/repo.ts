import {
  DEFAULT_META, DEFAULT_SETTINGS, emptyAppData,
  type ActiveSession, type AppData, type CompletedWorkout, type MaxEntry, type Meta, type Profile,
  type RecentThought, type RecoveryDay, type Settings, type ThoughtDay,
} from '../domain/types';
import { collect, runTx, type StoreName } from './db';

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

export async function loadAll(db: IDBDatabase): Promise<AppData> {
  const stores = existingStores(db, DATA_STORES);
  const boxes = await runTx(db, stores, 'readonly', (tx) => {
    const kv = tx.objectStore('kv');
    const keys = collect(kv.getAllKeys());
    const values = collect(kv.getAll());
    const workouts = collect(tx.objectStore('workouts').getAll());
    const recovery = collect(tx.objectStore('recoveryDays').getAll());
    const thoughts = stores.includes('thoughtDays') ? collect(tx.objectStore('thoughtDays').getAll()) : { value: [] };
    return { keys, values, workouts, recovery, thoughts };
  });
  const data = emptyAppData();
  const keys = (boxes.keys.value ?? []) as IDBValidKey[];
  const values = (boxes.values.value ?? []) as unknown[];
  const kv = new Map<string, unknown>(keys.map((k, i) => [String(k), values[i]]));
  data.profile = (kv.get('profile') as Profile | undefined) ?? null;
  data.settings = { ...DEFAULT_SETTINGS, ...((kv.get('settings') as Partial<Settings> | undefined) ?? {}) };
  data.meta = { ...DEFAULT_META, ...((kv.get('meta') as Partial<Meta> | undefined) ?? {}) };
  data.active = (kv.get('active') as ActiveSession | undefined) ?? null;
  data.favorites = (kv.get('favorites') as string[] | undefined) ?? [];
  data.recent = (kv.get('recent') as RecentThought[] | undefined) ?? [];
  data.maxEntries = (kv.get('maxEntries') as MaxEntry[] | undefined) ?? [];
  data.workouts = sortWorkouts((boxes.workouts.value ?? []) as CompletedWorkout[]);
  data.recoveryDays = ((boxes.recovery.value ?? []) as RecoveryDay[]).sort((a, b) => a.localDate.localeCompare(b.localDate));
  data.thoughtDays = ((boxes.thoughts.value ?? []) as ThoughtDay[]).sort((a, b) => a.localDate.localeCompare(b.localDate));
  return data;
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
 * Replaces ALL user data in one transaction (import "replace", snapshot restore).
 * Either everything is written or nothing changes. Snapshots are kept.
 */
export function replaceAll(db: IDBDatabase, data: AppData): Promise<void> {
  const stores = existingStores(db, DATA_STORES);
  return runTx(db, stores, 'readwrite', (tx) => {
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
  });
}

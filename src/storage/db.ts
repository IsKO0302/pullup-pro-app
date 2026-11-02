/**
 * IndexedDB access with a versioned schema and an explicit, tested migration
 * runner. Every schema change is a new Migration; existing records are kept.
 */
export type StoreName = 'kv' | 'workouts' | 'recoveryDays' | 'snapshots' | 'thoughtDays';

export interface Migration {
  version: number;
  description: string;
  upgrade: (db: IDBDatabase, tx: IDBTransaction) => void;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial stores: kv (profile, settings, meta, active session, favorites), workouts, recovery days, snapshots.',
    upgrade(db) {
      db.createObjectStore('kv');
      const workouts = db.createObjectStore('workouts', { keyPath: 'id' });
      workouts.createIndex('localDate', 'localDate');
      db.createObjectStore('recoveryDays', { keyPath: 'localDate' });
      db.createObjectStore('snapshots', { keyPath: 'id' });
    },
  },
  {
    version: 2,
    description: 'thoughtDays store (thought of the day pinned per local date); backfill workouts.timeZone = null.',
    upgrade(db, tx) {
      if (!db.objectStoreNames.contains('thoughtDays')) db.createObjectStore('thoughtDays', { keyPath: 'localDate' });
      const cursorReq = tx.objectStore('workouts').openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        const value = cursor.value as Record<string, unknown>;
        if (value.timeZone === undefined) cursor.update({ ...value, timeZone: null });
        cursor.continue();
      };
    },
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

// Distinct from the PULLUP PRO 2.0 web app, which also uses "pullup-pro" on the shared github.io origin.
export const DEFAULT_DB_NAME = 'pullup-pro-app';

export type StorageErrorCode = 'unavailable' | 'blocked' | 'quota' | 'aborted' | 'unknown';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

function toStorageError(err: unknown): StorageError {
  if (err instanceof StorageError) return err;
  const e = err as { name?: string; message?: string } | null;
  if (e?.name === 'QuotaExceededError') return new StorageError('quota', e.message ?? 'Storage is full');
  if (e?.name === 'AbortError') return new StorageError('aborted', e.message ?? 'Transaction aborted');
  return new StorageError('unknown', e?.message ?? String(err));
}

export function openDb(name: string, migrations: readonly Migration[] = MIGRATIONS, version: number = migrations[migrations.length - 1]!.version): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('unavailable', 'IndexedDB is not available'));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(name, version);
    } catch (err) {
      reject(toStorageError(err));
      return;
    }
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction;
      if (!tx) return;
      for (const m of migrations) {
        if (m.version > event.oldVersion && m.version <= version) m.upgrade(db, tx);
      }
    };
    req.onblocked = () => reject(new StorageError('blocked', 'Another tab is holding an older version of the database'));
    req.onerror = () => reject(toStorageError(req.error));
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function deleteDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(toStorageError(req.error));
    req.onblocked = () => resolve();
  });
}

/**
 * Runs `fn` inside ONE transaction. Requests must be issued synchronously in
 * `fn` (IndexedDB auto-commits). Resolves after the transaction committed,
 * rejects (and nothing is written) if anything fails.
 */
export function runTx<T>(db: IDBDatabase, stores: StoreName[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
    } catch (err) {
      reject(toStorageError(err));
      return;
    }
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(toStorageError(tx.error));
    tx.onabort = () => reject(toStorageError(tx.error ?? new StorageError('aborted', 'Transaction aborted')));
    try {
      result = fn(tx);
    } catch (err) {
      try { tx.abort(); } catch { /* already finished */ }
      reject(toStorageError(err));
    }
  });
}

/** Collects request results inside runTx: `const box = collect(store.getAll())` → `box.value` after commit. */
export function collect<T>(req: IDBRequest<T>): { value: T | undefined } {
  const box: { value: T | undefined } = { value: undefined };
  req.onsuccess = () => { box.value = req.result; };
  return box;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  emptyAppData,
  type ActiveSession, type AppData, type CompletedWorkout, type MaxEntry, type Meta, type Profile,
  type RecentThought, type RecoveryDay, type Settings, type ThoughtDay,
} from '../domain/types';
import { DEFAULT_DB_NAME, openDb, StorageError } from '../storage/db';
import * as repo from '../storage/repo';

export type StoreStatus = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; detail: string };

export interface StoreActions {
  saveProfile: (p: Profile) => Promise<boolean>;
  saveSettings: (s: Settings) => Promise<boolean>;
  saveMeta: (patch: Partial<Meta>) => Promise<boolean>;
  saveActive: (a: ActiveSession | null) => Promise<boolean>;
  /** Atomic: stores the workout and removes the active session together. */
  completeWorkout: (w: CompletedWorkout) => Promise<boolean>;
  updateWorkout: (w: CompletedWorkout) => Promise<boolean>;
  deleteWorkout: (id: string) => Promise<boolean>;
  addMaxEntry: (e: MaxEntry) => Promise<boolean>;
  saveMaxEntries: (list: MaxEntry[]) => Promise<boolean>;
  saveRecoveryDay: (d: RecoveryDay) => Promise<boolean>;
  removeRecoveryDay: (localDate: string) => Promise<boolean>;
  saveThoughtDay: (d: ThoughtDay) => Promise<boolean>;
  saveFavorites: (ids: string[]) => Promise<boolean>;
  saveRecent: (list: RecentThought[]) => Promise<boolean>;
  /** Re-reads everything from IndexedDB (after import / reset / restore). */
  reload: () => Promise<void>;
}

export interface StoreValue {
  status: StoreStatus;
  data: AppData;
  db: IDBDatabase | null;
  saveError: string | null;
  dismissSaveError: () => void;
  actions: StoreActions;
}

const StoreContext = createContext<StoreValue | null>(null);

export function describeError(err: unknown): string {
  if (err instanceof StorageError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function StoreProvider({ dbName, children }: { dbName: string; children: ReactNode }) {
  const [status, setStatus] = useState<StoreStatus>({ kind: 'loading' });
  const [data, setData] = useState<AppData>(emptyAppData);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dbRef = useRef<IDBDatabase | null>(null);
  const dataRef = useRef<AppData>(data);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    let opened: IDBDatabase | null = null;
    openDb(dbName)
      .then(async (db) => {
        opened = db;
        const loaded = await repo.loadAll(db);
        if (cancelled) return;
        dbRef.current = db;
        dataRef.current = loaded;
        setData(loaded);
        setStatus({ kind: 'ready' });
      })
      .catch((err: unknown) => {
        if (!cancelled) setStatus({ kind: 'error', detail: describeError(err) });
      });
    return () => {
      cancelled = true;
      opened?.close();
      dbRef.current = null;
    };
  }, [dbName]);

  /** Serialised write-then-apply: memory only changes after IndexedDB confirmed the write. */
  const run = useCallback((write: (db: IDBDatabase) => Promise<void>, apply: (d: AppData) => AppData): Promise<boolean> => {
    const task = queue.current.then(async () => {
      const db = dbRef.current;
      if (!db) return false;
      try {
        await write(db);
        const next = apply(dataRef.current);
        dataRef.current = next;
        setData(next);
        return true;
      } catch (err) {
        setSaveError(describeError(err));
        return false;
      }
    });
    queue.current = task;
    return task;
  }, []);

  const actions = useMemo<StoreActions>(() => ({
    saveProfile: (p) => run((db) => repo.putKv(db, 'profile', p), (d) => ({ ...d, profile: p })),
    saveSettings: (s) => run((db) => repo.putKv(db, 'settings', s), (d) => ({ ...d, settings: s })),
    saveMeta: (patch) => {
      const meta = { ...dataRef.current.meta, ...patch };
      return run((db) => repo.putKv(db, 'meta', meta), (d) => ({ ...d, meta }));
    },
    saveActive: (a) => run(
      (db) => (a ? repo.putKv(db, 'active', a) : repo.deleteKv(db, 'active')),
      (d) => ({ ...d, active: a }),
    ),
    completeWorkout: (w) => run(
      (db) => repo.commitWorkout(db, w),
      (d) => ({ ...d, active: null, workouts: repo.sortWorkouts([...d.workouts.filter((x) => x.id !== w.id), w]) }),
    ),
    updateWorkout: (w) => run(
      (db) => repo.putWorkout(db, w),
      (d) => ({ ...d, workouts: d.workouts.map((x) => (x.id === w.id ? w : x)) }),
    ),
    deleteWorkout: (id) => run(
      (db) => repo.deleteWorkout(db, id),
      (d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== id) }),
    ),
    addMaxEntry: (e) => {
      const list = [...dataRef.current.maxEntries, e];
      return run((db) => repo.putKv(db, 'maxEntries', list), (d) => ({ ...d, maxEntries: list }));
    },
    saveMaxEntries: (list) => run((db) => repo.putKv(db, 'maxEntries', list), (d) => ({ ...d, maxEntries: list })),
    saveRecoveryDay: (day) => run(
      (db) => repo.putRecoveryDay(db, day),
      (d) => ({ ...d, recoveryDays: [...d.recoveryDays.filter((x) => x.localDate !== day.localDate), day].sort((a, b) => a.localDate.localeCompare(b.localDate)) }),
    ),
    removeRecoveryDay: (localDate) => run(
      (db) => repo.deleteRecoveryDay(db, localDate),
      (d) => ({ ...d, recoveryDays: d.recoveryDays.filter((x) => x.localDate !== localDate) }),
    ),
    saveThoughtDay: (day) => run(
      (db) => repo.putThoughtDay(db, day),
      (d) => ({ ...d, thoughtDays: [...d.thoughtDays.filter((x) => x.localDate !== day.localDate), day].sort((a, b) => a.localDate.localeCompare(b.localDate)) }),
    ),
    saveFavorites: (ids) => run((db) => repo.putKv(db, 'favorites', ids), (d) => ({ ...d, favorites: ids })),
    saveRecent: (list) => run((db) => repo.putKv(db, 'recent', list), (d) => ({ ...d, recent: list })),
    reload: async () => {
      await queue.current;
      const db = dbRef.current;
      if (!db) return;
      const loaded = await repo.loadAll(db);
      dataRef.current = loaded;
      setData(loaded);
    },
  }), [run]);

  // Only dev/e2e builds running on a SEPARATE database get the demo-data hook; production never does.
  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'e2e') || dbName === DEFAULT_DB_NAME || status.kind !== 'ready') return;
    void import('./dev/hooks').then((m) => m.installTestHooks(() => dbRef.current, actions.reload));
  }, [status.kind, actions, dbName]);

  const value = useMemo<StoreValue>(() => ({
    status,
    data,
    db: dbRef.current,
    saveError,
    dismissSaveError: () => setSaveError(null),
    actions,
  }), [status, data, saveError, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

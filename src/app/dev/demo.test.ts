import { describe, expect, it } from 'vitest';
import { EXERCISE_IDS } from '../../domain/types';
import { demoData } from './demo';

describe('demo data (dev / e2e screenshots only)', () => {
  it('is deterministic, realistic and stays before today', () => {
    const a = demoData({ today: '2026-03-18', lang: 'ru', weeks: 8 });
    const b = demoData({ today: '2026-03-18', lang: 'ru', weeks: 8 });
    expect(a).toEqual(b);
    expect(a.profile?.lang).toBe('ru');
    expect(a.workouts.length).toBeGreaterThan(20);
    expect(a.workouts.every((w) => w.localDate < '2026-03-18')).toBe(true);
    expect(a.workouts.every((w) => w.exercises.every((e) => EXERCISE_IDS.includes(e.exerciseId) && e.sets.length > 0))).toBe(true);
    expect(new Set(a.workouts.map((w) => w.id)).size).toBe(a.workouts.length);
    expect(a.workouts.some((w) => w.note.length > 0)).toBe(true);
  });
});

describe('test hook guard', () => {
  it('refuses to seed the real database name (no database is opened here)', async () => {
    const g = globalThis as unknown as { window?: unknown };
    const hadWindow = 'window' in g;
    g.window ??= globalThis;
    const { installTestHooks } = await import('./hooks');
    const { DEFAULT_DB_NAME } = await import('../../storage/db');
    const fakeRealDb = { name: DEFAULT_DB_NAME } as IDBDatabase;
    installTestHooks(() => fakeRealDb, async () => {});
    const hook = (globalThis as unknown as { __pullupTest: { seedDemo: (o: { today: string }) => Promise<void> } }).__pullupTest;
    await expect(hook.seedDemo({ today: '2026-03-18' })).rejects.toThrow(/refusing to seed the real database/);
    if (!hadWindow) delete g.window;
  });
});

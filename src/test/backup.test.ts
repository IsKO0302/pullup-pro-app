import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { demoData } from '../app/dev/demo';
import { emptyAppData, type AppData, type CompletedWorkout } from '../domain/types';
import { deleteDb, MIGRATIONS, openDb, SCHEMA_VERSION } from '../storage/db';
import { buildExport, EXPORT_FORMAT, exportFileName, serializeExport, type ExportFile } from '../storage/exportFile';
import { FILE_MIGRATIONS, mergeInto, migrateFileData, newWorkoutsIn, parseExport, replaceWith, resetData } from '../storage/importFile';
import { applyWithSnapshot, getSnapshot, isEmptyData, listSnapshots, loadAll, replaceAll, SNAPSHOT_KEEP } from '../storage/repo';

// Guardrail 2: throw-away database names only — the real "pullup-pro" is never opened.
const opened: { name: string; db: IDBDatabase }[] = [];
async function freshDb() {
  const name = `test-backup-${crypto.randomUUID()}`;
  const db = await openDb(name);
  opened.push({ name, db });
  return db;
}
afterEach(async () => {
  for (const { name, db } of opened.splice(0)) {
    db.close();
    await deleteDb(name);
  }
});

const TODAY = '2026-03-18';
const STAMP = { atUtc: '2026-03-18T19:30:00.000Z', localDate: TODAY, timeZone: 'Europe/Istanbul' };

function demo(over: Partial<Parameters<typeof demoData>[0]> = {}): AppData {
  const d = demoData({ today: TODAY, weeks: 6, lang: 'ru', ...over });
  d.meta = { ...d.meta, persist: 'granted' };
  d.favorites = ['life-01', 'time-02'];
  d.recent = [{ id: 'time-02', atUtc: '2026-03-17T10:00:00.000Z' }, { id: 'life-01', atUtc: '2026-03-16T10:00:00.000Z' }];
  d.thoughtDays = [{ localDate: '2026-03-17', thoughtId: 'hope-02', atUtc: '2026-03-17T06:00:00.000Z' }];
  d.settings = { sound: true, vibration: false };
  return d;
}

const roundTrip = (data: AppData) => parseExport(serializeExport(buildExport(data, STAMP, '1.0.0')));
function fileOf(data: AppData): ExportFile {
  const res = roundTrip(data);
  if (!res.ok) throw new Error(`${res.code} ${res.detail}`);
  return res.file;
}
function tamper(data: AppData, edit: (json: Record<string, any>) => void): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  const json = JSON.parse(serializeExport(buildExport(data, STAMP, '1.0.0')));
  edit(json);
  return JSON.stringify(json);
}

describe('export file', () => {
  it('is readable JSON with schemaVersion, exportedAt (UTC + local date + zone) and every part of the data', () => {
    const data = demo();
    const text = serializeExport(buildExport(data, STAMP, '1.0.0'));
    expect(text).toContain('\n  "schemaVersion": ');
    const json = JSON.parse(text);
    expect(json).toMatchObject({ format: EXPORT_FORMAT, schemaVersion: SCHEMA_VERSION, appVersion: '1.0.0', exportedAt: STAMP.atUtc, exportedLocalDate: TODAY, timeZone: 'Europe/Istanbul' });
    expect(Object.keys(json.data).sort()).toEqual(['active', 'favorites', 'maxEntries', 'meta', 'profile', 'recent', 'recoveryDays', 'rotation', 'settings', 'thoughtDays', 'workouts']);
    expect(json.summary).toEqual({ workouts: data.workouts.length, notes: data.workouts.filter((w) => w.note).length, favorites: 2, recoveryDays: data.recoveryDays.length });
    expect(json.data.meta).toEqual({ lastExportAtUtc: STAMP.atUtc, reminderDismissedAtUtc: null }); // no device facts
    expect(exportFileName(TODAY)).toBe('pullup-pro-backup-2026-03-18.json');
  });

  it('round-trips: replace(parse(export(data))) is the post-export state exactly', () => {
    const data = demo();
    const restored = replaceWith(emptyAppData(), fileOf(data).data);
    expect(restored).toEqual({ ...data, meta: { ...data.meta, lastExportAtUtc: STAMP.atUtc, persist: null } });
    const sameDevice = replaceWith(data, fileOf(data).data);
    expect(sameDevice).toEqual({ ...data, meta: { ...data.meta, lastExportAtUtc: STAMP.atUtc } });
  });

  it('round-trips an unfinished workout and an empty profile-less state', () => {
    const data = demo();
    data.active = {
      id: 's1', variant: 'planned', plan: { localDate: TODAY, type: 'pullStrength', level: 2, exercises: [{ exerciseId: 'strict-pullup', slot: 'pullStrength.main', sets: 4, target: 5, restSec: 120, role: 'main' }], estimatedMinutes: 30, muscles: ['back'], flags: { lighterWeek: false, returnAfterBreak: false, feelingOff: false, maxTestSuggested: false, noPullEquipment: false, painRecently: false } },
      startedAtUtc: '2026-03-18T18:00:00.000Z', localDate: TODAY, timeZone: 'Europe/Istanbul', exIndex: 0, setIndex: 1, phase: 'rest',
      restEndsAtUtc: '2026-03-18T18:05:00.000Z', restTotalSec: 120, pausedAtUtc: null, pausedRestLeftSec: null, pausedSec: 0, holdStartedAtUtc: null,
      log: [{ exerciseId: 'strict-pullup', slot: 'pullStrength.main', unit: 'reps', role: 'main', target: 5, plannedSets: 4, restSec: 120, sets: [{ target: 5, actual: 5, status: 'done', atUtc: '2026-03-18T18:03:00.000Z' }], swappedFrom: null }],
      feelingOff: false, restCount: 1, warmupDone: [0],
    };
    expect(fileOf(data).data.active).toEqual(data.active);
    expect(fileOf(emptyAppData()).data).toMatchObject({ profile: null, workouts: [], active: null });
  });
});

describe('import validation', () => {
  const data = demo();
  const fail = (raw: string) => {
    const res = parseExport(raw);
    expect(res.ok).toBe(false);
    return res.ok ? null : res;
  };

  it('refuses files that are not JSON, not ours, or from a newer schema', () => {
    expect(fail('not json {')?.code).toBe('notJson');
    expect(fail('')?.code).toBe('notJson');
    expect(fail('[]')?.code).toBe('notApp');
    expect(fail(JSON.stringify({ format: 'other-app', schemaVersion: 1, data: {} }))?.code).toBe('notApp');
    expect(fail(tamper(data, (j) => { j.schemaVersion = SCHEMA_VERSION + 1; }))).toMatchObject({ code: 'newer', detail: String(SCHEMA_VERSION + 1) });
    expect(fail(tamper(data, (j) => { j.schemaVersion = '2'; }))?.code).toBe('invalid');
  });

  it('points at the damaged part', () => {
    expect(fail(tamper(data, (j) => { j.data.workouts[1].exercises[0].sets[0].actual = 'ten'; }))).toMatchObject({ code: 'invalid', detail: 'workouts[1].exercises[0].sets[0].actual' });
    expect(fail(tamper(data, (j) => { j.data.workouts[0].exercises[0].exerciseId = 'flying-pullup'; }))?.detail).toBe('workouts[0].exercises[0].exerciseId');
    expect(fail(tamper(data, (j) => { j.data.workouts[2].localDate = '2026-02-30'; }))?.detail).toBe('workouts[2].localDate');
    expect(fail(tamper(data, (j) => { j.data.workouts[0].completedAtUtc = '18.03.2026 19:00'; }))?.detail).toBe('workouts[0].completedAtUtc');
    expect(fail(tamper(data, (j) => { j.data.profile.lang = 'de'; }))?.detail).toBe('profile.lang');
    expect(fail(tamper(data, (j) => { j.data.workouts = {}; }))?.detail).toBe('workouts');
    expect(fail(tamper(data, (j) => { delete j.data; }))?.detail).toBe('data');
    expect(fail(tamper(data, (j) => { j.exportedAt = 'yesterday'; }))?.detail).toBe('exportedAt');
  });

  it('refuses duplicates that would silently collapse in the database', () => {
    expect(fail(tamper(data, (j) => { j.data.workouts.push(j.data.workouts[0]); }))?.detail).toMatch(/^workouts\[\d+\]$/);
    expect(fail(tamper(data, (j) => { j.data.recoveryDays.push(j.data.recoveryDays[0]); }))?.detail).toMatch(/^recoveryDays\[\d+\]$/);
  });

  it('drops unknown fields, fills harmless gaps with defaults, ignores the untrusted summary and a BOM', () => {
    const raw = tamper(data, (j) => {
      j.data.workouts[0].sparkle = true;
      delete j.data.workouts[0].mood;
      delete j.data.workouts[0].note;
      delete j.data.workouts[0].flags;
      delete j.data.settings;
      j.summary = { workouts: 99999 };
    });
    const res = parseExport(`\uFEFF${raw}`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const w = res.file.data.workouts[0] as CompletedWorkout & { sparkle?: boolean };
    expect(w.sparkle).toBeUndefined();
    expect(w).toMatchObject({ mood: null, note: '', flags: { lighterWeek: false, painRecently: false } });
    expect(res.file.data.settings).toEqual({ sound: false, vibration: true });
    expect(res.file.summary.workouts).toBe(data.workouts.length);
  });

  it('migrates older files forward (v1: no workout time zone, no thought days)', () => {
    const raw = tamper(data, (j) => {
      j.schemaVersion = 1;
      for (const w of j.data.workouts) delete w.timeZone;
      delete j.data.thoughtDays;
      delete j.data.rotation;
    });
    const res = parseExport(raw);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(res.file.data.workouts.every((w) => w.timeZone === null)).toBe(true);
    expect(res.file.data.thoughtDays).toEqual([]);
    expect(res.file.data.rotation).toBeNull();
    expect(migrateFileData({ workouts: [{ id: 'a', timeZone: 'UTC' }] }, 1)).toEqual({ workouts: [{ id: 'a', timeZone: 'UTC' }], thoughtDays: [], rotation: null });
    expect(migrateFileData({ workouts: [] }, 2)).toEqual({ workouts: [], rotation: null });
    expect(migrateFileData({ workouts: [] }, SCHEMA_VERSION)).toEqual({ workouts: [] });
  });

  it('carries the rotation checkpoint and refuses a damaged one', () => {
    expect(data.rotation).not.toBeNull();
    expect(fileOf(data).data.rotation).toEqual(data.rotation);
    expect(fail(tamper(data, (j) => { j.data.rotation.trainingRotationIndex = 9; }))?.detail).toBe('rotation.trainingRotationIndex');
    expect(fail(tamper(data, (j) => { j.data.rotation.activeDaysPerWeek = 8; }))?.detail).toBe('rotation.activeDaysPerWeek');
    const without = parseExport(tamper(data, (j) => { delete j.data.rotation; }));
    expect(without.ok && without.file.data.rotation).toBeNull();
  });

  it('has one file migration for every database migration after v1', () => {
    expect(FILE_MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.slice(1).map((m) => m.version));
    for (const m of FILE_MIGRATIONS) expect(m.description.length).toBeGreaterThan(10);
  });
});

describe('merge, replace, reset', () => {
  const mine = demo({ seed: 3, weeks: 3 });
  const other = demo({ seed: 9, weeks: 8, lang: 'tr', name: 'Other' });
  const theirs = { ...other, workouts: other.workouts.map((w) => ({ ...w, id: `other-${w.id}` })) }; // another phone

  it('merge adds what is missing and never overwrites this device', () => {
    const shared = { ...theirs.workouts[0]!, id: mine.workouts[0]!.id, note: 'from the file' };
    const file = { ...fileOf(theirs).data, workouts: [shared, ...theirs.workouts.slice(1)] };
    file.thoughtDays = [{ localDate: '2026-03-17', thoughtId: 'time-09', atUtc: '2026-03-17T05:00:00.000Z' }, { localDate: '2026-03-10', thoughtId: 'life-03', atUtc: '2026-03-10T05:00:00.000Z' }];
    file.favorites = ['time-02', 'hope-01'];
    const merged = mergeInto(mine, file);
    expect(merged.profile).toEqual(mine.profile);
    expect(merged.settings).toEqual(mine.settings);
    expect(merged.meta).toEqual(mine.meta);
    expect(merged.workouts.find((w) => w.id === shared.id)).toEqual(mine.workouts[0]);
    expect(merged.workouts).toHaveLength(mine.workouts.length + theirs.workouts.length - 1);
    expect(merged.workouts.map((w) => w.startedAtUtc)).toEqual([...merged.workouts.map((w) => w.startedAtUtc)].sort());
    expect(merged.thoughtDays.map((t) => [t.localDate, t.thoughtId])).toEqual([['2026-03-10', 'life-03'], ['2026-03-17', 'hope-02']]);
    expect(merged.favorites).toEqual(['life-01', 'time-02', 'hope-01']);
    expect(newWorkoutsIn(mine, file)).toBe(theirs.workouts.length - 1);
    expect(mergeInto(merged, file)).toEqual(merged); // idempotent
  });

  it('merge keeps the rotation checkpoint of this device, replace takes the one in the file', () => {
    expect(mergeInto(mine, fileOf(theirs).data).rotation).toEqual(mine.rotation);
    expect(replaceWith(mine, fileOf(theirs).data).rotation).toEqual(theirs.rotation);
  });

  it('merge takes the profile from the file when this device has none', () => {
    const fresh = resetData(mine);
    const merged = mergeInto(fresh, fileOf(theirs).data);
    expect(merged.profile?.name).toBe('Other');
    expect(merged.settings).toEqual(theirs.settings);
    expect(merged.meta.persist).toBe('granted');
  });

  it('merge keeps the newest view of each recent thought and caps the list', () => {
    const file = fileOf(theirs).data;
    file.recent = Array.from({ length: 40 }, (_, i) => ({ id: `t-${i}`, atUtc: `2026-02-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00.000Z` }));
    file.recent.push({ id: 'life-01', atUtc: '2026-03-18T10:00:00.000Z' });
    const merged = mergeInto(mine, file);
    expect(merged.recent).toHaveLength(30);
    expect(merged.recent[0]).toEqual({ id: 'life-01', atUtc: '2026-03-18T10:00:00.000Z' });
    expect(merged.recent.filter((r) => r.id === 'life-01')).toHaveLength(1);
  });

  it('reset returns to a first launch and keeps only the storage-protection fact', () => {
    expect(resetData(mine)).toEqual({ ...emptyAppData(), meta: { ...emptyAppData().meta, persist: 'granted' } });
    expect(isEmptyData(resetData(mine))).toBe(true);
    expect(isEmptyData(mine)).toBe(false);
  });
});

describe('snapshots + atomic apply (fake IndexedDB)', () => {
  it('export → reset → import restores the identical state; every step leaves a snapshot', async () => {
    const db = await freshDb();
    await replaceAll(db, demo());
    const before = await loadAll(db);
    const exported = serializeExport(buildExport(before, STAMP, '1.0.0'));
    const afterExport = { ...before, meta: { ...before.meta, lastExportAtUtc: STAMP.atUtc } };
    await replaceAll(db, afterExport); // the app records the export time

    const reset = await applyWithSnapshot(db, 'preReset', '2026-03-18T20:00:00.000Z', resetData, isEmptyData);
    expect(reset.snapshotId).not.toBeNull();
    expect(isEmptyData(await loadAll(db))).toBe(true);

    const parsed = parseExport(exported);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const imported = await applyWithSnapshot(db, 'preImport', '2026-03-18T20:01:00.000Z', (cur) => replaceWith(cur, parsed.file.data), isEmptyData);
    expect(imported.snapshotId).toBeNull(); // nothing to protect after a reset
    expect(await loadAll(db)).toEqual(afterExport);

    const snaps = await listSnapshots(db);
    expect(snaps.map((s) => s.reason)).toEqual(['preReset']);
    expect((await getSnapshot(db, snaps[0]!.id))?.data).toEqual(afterExport);
  });

  it('keeps only the newest snapshots', async () => {
    const db = await freshDb();
    await replaceAll(db, demo());
    for (let i = 0; i < SNAPSHOT_KEEP + 2; i++) {
      await applyWithSnapshot(db, 'preImport', `2026-03-18T20:0${i}:00.000Z`, (cur) => ({ ...cur, favorites: [`f-${i}`] }));
    }
    const snaps = await listSnapshots(db);
    expect(snaps).toHaveLength(SNAPSHOT_KEEP);
    expect(snaps.map((s) => s.atUtc)).toEqual(['2026-03-18T20:04:00.000Z', '2026-03-18T20:03:00.000Z', '2026-03-18T20:02:00.000Z']);
    expect((await getSnapshot(db, snaps[0]!.id))?.data.favorites).toEqual(['f-3']);
  });

  it('a failing change leaves data AND snapshots untouched', async () => {
    const db = await freshDb();
    await replaceAll(db, demo());
    const before = await loadAll(db);
    await expect(applyWithSnapshot(db, 'preImport', '2026-03-18T20:00:00.000Z', () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const broken = (cur: AppData): AppData => ({ ...cur, workouts: [...cur.workouts, { ...cur.workouts[0]!, id: undefined } as unknown as CompletedWorkout] });
    await expect(applyWithSnapshot(db, 'preImport', '2026-03-18T20:01:00.000Z', broken)).rejects.toThrow();
    expect(await loadAll(db)).toEqual(before);
    expect(await listSnapshots(db)).toEqual([]);
  });

  it('a file that fails validation never reaches the database', async () => {
    const db = await freshDb();
    await replaceAll(db, demo());
    const before = await loadAll(db);
    const res = parseExport(tamper(demo(), (j) => { j.data.workouts[3].durationSec = -5; }));
    expect(res).toMatchObject({ ok: false, code: 'invalid', detail: 'workouts[3].durationSec' });
    expect(await loadAll(db)).toEqual(before);
  });
});

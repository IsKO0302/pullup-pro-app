/**
 * Beginner safety and progression consistency (DECISIONS D61–D63):
 * negatives only with safe top access and a controlled descent, strict sets only
 * with 2+ reps in reserve (one more on weaker days), assisted fallbacks instead.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises/catalog';
import { WEEK1, WEEK3, complete, history, makeProfile, maxEntry, simulate, workoutOf, type Perform } from '../test/fixtures';
import { workoutsBefore, type History } from './history';
import { workingMax } from './level';
import { RESERVE_REPS, buildSession, negativesReady, planDay } from './plan';
import { addDays } from './time';
import type { DayType, Equipment, Profile, Workout } from './types';

const EQUIPMENT: Record<string, Equipment[]> = {
  none: [],
  bar: ['bar'],
  barBox: ['bar', 'box'],
  barBands: ['bar', 'bands'],
  barBandsBox: ['bar', 'bands', 'box'],
  rings: ['rings'],
  ringsBox: ['rings', 'box'],
  full: ['bar', 'dipBars', 'bands', 'rings', 'box'],
};
const MAXES = [0, 1, 2, 3, 4, 5, 6, 8, 10, 13, 20];
const TYPES: DayType[] = ['pullStrength', 'pullVolume', 'push', 'legsCore', 'recovery', 'light', 'short', 'maxTest'];
const isStrict = (id: string) => EXERCISES[id as keyof typeof EXERCISES].family === 'pullup';
const working = (w: Workout) => w.exercises.filter((e) => e.role !== 'test' && e.role !== 'warmup');

/** Every rule a generated workout must keep, given the strict max it was planned from. */
function violations(w: Workout, max: number, owned: readonly Equipment[], h: History, label: string): string[] {
  const out: string[] = [];
  const say = (m: string) => out.push(`${label} [${w.type}] ${m}`);
  const weaker = w.flags.feelingOff || w.flags.returnAfterBreak;
  const limit = max - RESERVE_REPS - (weaker ? 1 : 0);
  for (const e of working(w)) {
    if (isStrict(e.exerciseId) && (e.target < 1 || e.target > limit)) say(`${e.exerciseId} × ${e.target} with max ${max} (limit ${limit})`);
    if (e.exerciseId === 'negative-pullup' && e.target > 5) say(`negatives × ${e.target}`);
  }
  if (w.exercises.some((e) => e.exerciseId === 'negative-pullup') && !negativesReady(w.level, owned, workoutsBefore(h, w.localDate))) {
    say('negatives without box access or a controlled descent');
  }
  const warm = w.exercises.find((e) => e.role === 'warmup');
  if (warm && isStrict(warm.exerciseId) && warm.target > max - RESERVE_REPS) say(`strict warm-up × ${warm.target} with max ${max}`);
  if (w.type !== 'maxTest' && w.exercises.some((e) => e.role === 'test')) say('test set outside a max test');
  const pulls = w.type === 'pullStrength' || w.type === 'pullVolume' || w.type === 'short';
  if (pulls && (owned.includes('bar') || owned.includes('rings')) && w.exercises[0]?.role !== 'main') say('no main exercise');
  return out;
}

describe('every generated workout respects ability (configuration grid)', () => {
  for (const days of [2, 4, 7]) {
    it(`${days} days: all equipment × maxes 0–20 × session types × normal / lighter / returning / feeling off`, () => {
      const failures: string[] = [];
      for (const [eqName, owned] of Object.entries(EQUIPMENT)) {
        const profile = makeProfile({ daysPerWeek: days, equipment: owned });
        for (const max of MAXES) {
          const fresh = history({ maxEntries: [maxEntry(max)] });
          // Back after 10 days off (one earlier session).
          const back = history({ maxEntries: fresh.maxEntries, workouts: [workoutOf(addDays(WEEK1, -10), 'legsCore', [['squat', [12]]])] });
          for (const type of TYPES) {
            const variant = type === 'maxTest' || type === 'short' || type === 'light' ? type : 'planned';
            const cases: [string, History, string, boolean][] = [
              ['normal', fresh, WEEK1, false],
              ['lighter', fresh, WEEK3, false],
              ['returning', back, WEEK1, false],
              ['off', fresh, WEEK1, true],
              ['returning+off', back, WEEK1, true],
            ];
            for (const [name, h, date, feelingOff] of cases) {
              const w = buildSession(profile, h, date, type, { variant, feelingOff });
              failures.push(...violations(w, max, owned, h, `${eqName} max ${max} ${name}`));
            }
          }
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it('L0 never gets negatives without a box; with a box only once a controlled descent is shown', () => {
    for (const owned of Object.values(EQUIPMENT)) {
      for (const type of ['pullStrength', 'pullVolume', 'short'] as DayType[]) {
        const w = buildSession(makeProfile({ equipment: owned }), history(), WEEK1, type, { variant: type === 'short' ? 'short' : 'planned' });
        expect(w.exercises.map((e) => e.exerciseId), `${owned.join('+')} ${type}`).not.toContain('negative-pullup');
      }
    }
    const box: Equipment[] = ['bar', 'box'];
    const before = (items: Parameters<typeof workoutOf>[2]) => [workoutOf(addDays(WEEK1, -2), 'pullVolume', items)];
    expect(negativesReady(0, box, [])).toBe(false);
    expect(negativesReady(0, ['bar'], before([['dead-hang', [30]], ['scapular-pull', [10]]]))).toBe(false); // no box
    expect(negativesReady(0, box, before([['dead-hang', [30]], ['scapular-pull', [9]]]))).toBe(false);
    expect(negativesReady(0, box, before([['dead-hang', [25]], ['scapular-pull', [12]]]))).toBe(false);
    expect(negativesReady(0, box, before([['active-hang', [30]], ['scapular-pull', [10]]]))).toBe(true);
    expect(negativesReady(0, ['bar', 'bands', 'box'], before([['band-pullup', [8]]]))).toBe(true);
    expect(negativesReady(0, box, before([['negative-pullup', [2]]]))).toBe(true);
    expect(negativesReady(1, box, [])).toBe(true);
    expect(negativesReady(1, ['rings'], [])).toBe(false);
  });

  it('L1 with a max of 1–2: no strict working sets, an assisted variation or row leads instead', () => {
    for (const max of [1, 2]) {
      for (const [eqName, owned] of Object.entries(EQUIPMENT).filter(([, o]) => o.includes('bar') || o.includes('rings'))) {
        for (const type of ['pullStrength', 'pullVolume', 'short'] as DayType[]) {
          const w = buildSession(makeProfile({ equipment: owned }), history({ maxEntries: [maxEntry(max)] }), WEEK1, type, { variant: type === 'short' ? 'short' : 'planned' });
          expect(working(w).filter((e) => isStrict(e.exerciseId)), `${eqName} max ${max} ${type}`).toEqual([]);
          expect(['band-pullup', 'feet-assisted-pullup', 'negative-pullup', 'australian-row']).toContain(w.exercises[0]!.exerciseId);
        }
      }
    }
  });

  it('strict singles start once the reserve allows them (max 3), and weaker days fall back to assisted', () => {
    const owned: Equipment[] = ['bar', 'bands'];
    const l3 = history({ maxEntries: [maxEntry(3)] });
    expect(buildSession(makeProfile({ equipment: owned }), l3, WEEK1, 'pullStrength').exercises[0]).toMatchObject({ exerciseId: 'strict-pullup', target: 1 });
    expect(buildSession(makeProfile({ equipment: owned }), l3, WEEK1, 'pullStrength', { feelingOff: true }).exercises[0]!.exerciseId).toBe('band-pullup');
    // Max 5 feeling off: the usual 10 % cut, still inside the lowered reserve (5 − 1 − 2).
    const l5 = history({ maxEntries: [maxEntry(5)] });
    expect(buildSession(makeProfile(), l5, WEEK1, 'pullStrength').exercises[0]).toMatchObject({ exerciseId: 'strict-pullup', target: 3 });
    expect(buildSession(makeProfile(), l5, WEEK1, 'pullStrength', { feelingOff: true }).exercises[0]).toMatchObject({ exerciseId: 'strict-pullup', target: 2 });
  });

  it('max tests: warm-up singles only with reserve; the test is the only near-max effort', () => {
    const p = makeProfile();
    for (const max of [1, 2, 3, 4, 6, 10]) {
      const w = buildSession(p, history({ maxEntries: [maxEntry(max)] }), WEEK1, 'maxTest', { variant: 'maxTest' });
      const warm = w.exercises.find((e) => e.role === 'warmup')!;
      expect(warm.exerciseId, `max ${max}`).toBe(max >= 3 ? 'strict-pullup' : 'scapular-pull');
      expect(w.exercises.filter((e) => e.role === 'test')).toEqual([expect.objectContaining({ exerciseId: 'strict-pullup', target: max, sets: 1 })]);
    }
  });
});

describe('progression over months stays inside ability', () => {
  /** Does every set as planned; max tests (when taken) add one rep. */
  const plusOneOnTests: Perform = (ex) => (ex.role === 'test' ? ex.target + 1 : ex.target);

  function check(profile: Profile, h0: History, weeks: number, takeTests: boolean): { h: History; failures: string[] } {
    const h = simulate(profile, h0, profile.startDate, weeks * 7, plusOneOnTests, { takeTests });
    const failures: string[] = [];
    for (const w of h.workouts) {
      const max = workingMax({ workouts: workoutsBefore(h, w.localDate), maxEntries: h.maxEntries }, w.localDate)?.value ?? 0;
      failures.push(...violations(w as unknown as Workout, max, profile.equipment, h, w.localDate));
    }
    return { h, failures };
  }

  it('L0 with a bar only: 26 weeks without a single negative or strict set', () => {
    const { h, failures } = check(makeProfile(), history(), 26, false);
    expect(failures).toEqual([]);
    expect(h.workouts.flatMap((w) => w.exercises).some((e) => e.exerciseId === 'negative-pullup' || isStrict(e.exerciseId))).toBe(false);
  });

  it('L0 with a bar and a box: negatives appear only after hangs and scapular pulls are established', () => {
    const profile = makeProfile({ equipment: ['bar', 'box'] });
    const { h, failures } = check(profile, history(), 26, false);
    expect(failures).toEqual([]);
    const first = h.workouts.find((w) => w.exercises.some((e) => e.exerciseId === 'negative-pullup'));
    expect(first, 'negatives eventually unlock').toBeDefined();
    expect(first!.localDate > addDays(profile.startDate, 14)).toBe(true);
    expect(h.workouts.flatMap((w) => w.exercises).filter((e) => e.exerciseId === 'negative-pullup').every((e) => e.target <= 5)).toBe(true);
  });

  for (const max of [1, 2, 3, 4, 6, 9]) {
    it(`max ${max}: 20 weeks with tests and every equipment set keep strict sets 2+ reps short of the max`, () => {
      for (const owned of [EQUIPMENT.bar!, EQUIPMENT.barBandsBox!, EQUIPMENT.rings!]) {
        const { failures } = check(makeProfile({ equipment: owned, daysPerWeek: 4 }), history({ maxEntries: [maxEntry(max)] }), 20, true);
        expect(failures).toEqual([]);
      }
    });
  }

  it('a band at the top of its range does not jump to strict sets without reserve', () => {
    const profile = makeProfile({ equipment: ['bar', 'bands'] });
    const top = { exerciseId: 'band-pullup' as const, sets: 3, target: 15, restSec: 90, role: 'accessory' as const };
    const log = (date: string) => complete({ ...buildSession(profile, history({ maxEntries: [maxEntry(2)] }), date, 'pullStrength'), exercises: [{ ...top, slot: 'pullStrength.assist' }] });
    const h = history({ maxEntries: [maxEntry(2)], workouts: [log(WEEK1)] });
    const next = buildSession(profile, h, addDays(WEEK1, 7), 'pullStrength');
    expect(working(next).filter((e) => isStrict(e.exerciseId))).toEqual([]);
    // Feeling off after a break is never worse than either alone.
    const off = planDay(profile, h, addDays(WEEK1, 14), { variant: 'early', feelingOff: true });
    expect(working(off).filter((e) => isStrict(e.exerciseId))).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { START, WEEK1, history, makeProfile, maxEntry, recoveryDay, simulate, workoutOf } from '../test/fixtures';
import { byStart } from './history';
import { addYears, bestSets, MILESTONES, maxSeries, milestones, progressTotals, rhythmSummary, rhythmWeeks } from './progress';
import { withRhythm } from './schedule';
import { recordsOf } from './stats';
import { addDays } from './time';

// 4 days a week: Mon pull strength · Tue push · Wed rest · Thu pull volume · Fri legs + core · Sat/Sun rest.
const MON = WEEK1;
const TUE = addDays(WEEK1, 1);
const WED = addDays(WEEK1, 2);
const THU = addDays(WEEK1, 3);
const FRI = addDays(WEEK1, 4);

describe('progressTotals', () => {
  it('is honest with no data', () => {
    expect(progressTotals(history())).toEqual({ workouts: 0, pullups: 0, max: null });
  });

  it('counts unassisted pull-ups of all grips, never band-assisted or negatives', () => {
    const h = history({
      maxEntries: [maxEntry(5)],
      workouts: [
        workoutOf(MON, 'pullStrength', [['strict-pullup', [4, 4, 3]], ['chin-up', [5]], ['band-pullup', [8, 8]], ['negative-pullup', [3]]]),
        workoutOf(THU, 'pullVolume', [['strict-pullup', [2, null]]]),
      ],
    });
    const t = progressTotals(h);
    expect(t.workouts).toBe(2);
    expect(t.pullups).toBe(4 + 4 + 3 + 5 + 2);
    expect(t.max?.value).toBe(5);
  });

  it('the current max comes from strict pull-ups only', () => {
    const h = history({ maxEntries: [maxEntry(3)], workouts: [workoutOf(MON, 'pullStrength', [['chin-up', [9]], ['strict-pullup', [4]]])] });
    expect(progressTotals(h).max).toMatchObject({ value: 4, source: 'set' });
  });
});

describe('maxSeries', () => {
  it('one point per week: the best strict set, earliest workout on ties', () => {
    const a = workoutOf(MON, 'pullStrength', [['strict-pullup', [5, 6, 6]]]);
    const b = workoutOf(THU, 'pullVolume', [['strict-pullup', [6, 4]]]);
    const c = workoutOf(addDays(MON, 7), 'pullStrength', [['strict-pullup', [7]]]);
    const s = maxSeries([c, b, a]);
    expect(s).toEqual([
      { week: MON, value: 6, workoutId: a.id, localDate: MON, test: false },
      { week: addDays(MON, 7), value: 7, workoutId: c.id, localDate: addDays(MON, 7), test: false },
    ]);
  });

  it('ignores assisted reps, negatives, chin-ups, skipped sets and zero tests', () => {
    const s = maxSeries([
      workoutOf(MON, 'pullStrength', [['band-pullup', [10]], ['negative-pullup', [5]], ['chin-up', [8]], ['strict-pullup', [null, null]]]),
      workoutOf(addDays(MON, 7), 'maxTest', [['strict-pullup', [0], 'test']]),
    ]);
    expect(s).toEqual([]);
  });

  it('marks max-test points', () => {
    expect(maxSeries([workoutOf(MON, 'maxTest', [['strict-pullup', [9], 'test']])])[0]?.test).toBe(true);
  });
});

describe('rhythmWeeks', () => {
  const profile = makeProfile({ startDate: START });

  it('always returns 12 weeks, the current week last; weeks before the start are empty', () => {
    const weeks = rhythmWeeks(profile, history(), FRI);
    expect(weeks).toHaveLength(12);
    expect(weeks[11]!.start).toBe(MON);
    expect(weeks[11]!.status).toBe('current');
    expect(weeks[10]!.start).toBe(START);
    expect(weeks[9]!.status).toBe('none');
    expect(weeks[9]!.days.every((d) => d.state === 'none')).toBe(true);
    expect(weeks.every((w) => w.days.length === 7)).toBe(true);
  });

  it('a week with every planned day trained is on plan; planned rest is part of the plan', () => {
    const h = history({ workouts: [MON, TUE, THU, FRI].map((d) => workoutOf(d, 'push', [['pushup', [10]]])) });
    const [week] = rhythmWeeks(profile, h, addDays(MON, 7), 2).slice(0, 1);
    expect(week).toMatchObject({ start: MON, planned: 4, done: 4, recoveryPlanned: 0, recoveryDone: 0, restChosen: 0, status: 'onPlan' });
    expect(week!.days.map((d) => d.state)).toEqual(['done', 'done', 'rest', 'done', 'done', 'rest', 'rest']);
  });

  it('a chosen rest day is shown as rest, not missed — but only training counts toward the target', () => {
    const base = [MON, TUE, THU].map((d) => workoutOf(d, 'push', [['pushup', [10]]]));
    const withRecovery = history({ workouts: base, recoveryDays: [recoveryDay(FRI, 'tired')] });
    const [a] = rhythmWeeks(profile, withRecovery, addDays(MON, 7), 2);
    expect(a).toMatchObject({ planned: 4, done: 3, restChosen: 1, status: 'partial' });
    expect(a!.days[4]!.state).toBe('recovery');

    const [b] = rhythmWeeks(profile, history({ workouts: base }), addDays(MON, 7), 2);
    expect(b).toMatchObject({ planned: 4, done: 3, restChosen: 0, status: 'partial' });
    expect(b!.days[4]!.state).toBe('missed');
  });

  it('recovery sessions are counted on their own and never toward the training target', () => {
    const five = makeProfile({ startDate: START, daysPerWeek: 5 });
    const SAT = addDays(MON, 5);
    const training = [MON, TUE, THU, FRI].map((d) => workoutOf(d, 'push', [['pushup', [10]]]));
    const recovery = workoutOf(SAT, 'recovery', [['cat-cow', [8]]]);
    const [full] = rhythmWeeks(five, history({ workouts: [...training, recovery] }), addDays(MON, 7), 2);
    expect(full).toMatchObject({ planned: 4, done: 4, recoveryPlanned: 1, recoveryDone: 1, status: 'onPlan' });
    expect(full!.days[5]!.state).toBe('done');
    // Recovery instead of a training session: 3 of 4 training, still partial.
    const [swapped] = rhythmWeeks(five, history({ workouts: [...training.slice(0, 3), recovery] }), addDays(MON, 7), 2);
    expect(swapped).toMatchObject({ planned: 4, done: 3, recoveryDone: 1, status: 'partial' });
    // A recovery slot that passes quietly is rest, not "missed".
    const [quiet] = rhythmWeeks(five, history({ workouts: training }), addDays(MON, 7), 2);
    expect(quiet).toMatchObject({ planned: 4, done: 4, recoveryDone: 0, status: 'onPlan' });
    expect(quiet!.days[5]!.state).toBe('rest');
  });

  it('a session brought forward to a rest day counts as done', () => {
    const h = history({ workouts: [MON, TUE, WED, FRI].map((d) => workoutOf(d, 'pullVolume', [['australian-row', [8]]])) });
    const [week] = rhythmWeeks(profile, h, addDays(MON, 7), 2);
    expect(week).toMatchObject({ planned: 4, done: 4, status: 'onPlan' });
  });

  it('light extras do not count as sessions; optional recovery-mobility days are not "planned"', () => {
    const five = makeProfile({ startDate: START, daysPerWeek: 5 });
    const h = history({ workouts: [workoutOf(MON, 'light', [['dead-hang', [20]]])] });
    const [week] = rhythmWeeks(five, h, addDays(MON, 7), 2);
    expect(week).toMatchObject({ planned: 4, done: 0, status: 'partial' });
  });

  it('past weeks keep the rhythm that applied then', () => {
    const changed = withRhythm(makeProfile({ startDate: START, daysPerWeek: 4 }), 2, addDays(MON, 7));
    const h = history({ workouts: [MON, TUE, THU, FRI].map((d) => workoutOf(d, 'push', [['pushup', [10]]])) });
    const weeks = rhythmWeeks(changed, h, addDays(MON, 7), 2);
    expect(weeks[0]).toMatchObject({ planned: 4, done: 4, status: 'onPlan' });
    expect(weeks[1]!.days.map((d) => d.state)).toEqual(['today', 'rest', 'rest', 'planned', 'rest', 'rest', 'rest']);
  });

  it('summary counts complete weeks only', () => {
    const h = history({ workouts: [MON, TUE, THU, FRI].map((d) => workoutOf(d, 'push', [['pushup', [10]]])) });
    expect(rhythmSummary(rhythmWeeks(profile, h, addDays(MON, 9)))).toEqual({ onPlan: 1, weeks: 2 });
  });
});

describe('bestSets', () => {
  it('keeps one row per variation, strict pull-ups first, then catalog order, real values only', () => {
    const rows = bestSets([
      workoutOf(MON, 'pullStrength', [['band-pullup', [8, 9]], ['strict-pullup', [3, 4]], ['cat-cow', [8]], ['plank', [40]]]),
      workoutOf(THU, 'pullVolume', [['strict-pullup', [5]], ['negative-pullup', [null]]]),
    ]);
    expect(rows.map((r) => [r.exerciseId, r.value, r.localDate])).toEqual([
      ['strict-pullup', 5, THU],
      ['band-pullup', 9, MON],
      ['plank', 40, MON],
    ]);
    expect(rows.find((r) => r.exerciseId === 'plank')?.unit).toBe('seconds');
  });
});

describe('milestones', () => {
  const profile = makeProfile({ startDate: START });

  it('12 milestones in a fixed order, none reached without data', () => {
    const m = milestones(profile, history(), FRI);
    expect(m).toHaveLength(12);
    expect(m.map((x) => x.id)).toEqual([...MILESTONES]);
    expect(m.every((x) => x.reachedOn === null)).toBe(true);
  });

  const at = (m: ReturnType<typeof milestones>, id: string) => m.find((x) => x.id === id)?.reachedOn ?? null;

  it('first workout and first strict pull-up are dated by the real workouts', () => {
    const h = history({
      workouts: [
        workoutOf(MON, 'pullStrength', [['band-pullup', [6]]]),
        workoutOf(THU, 'pullVolume', [['strict-pullup', [1]]]),
      ],
    });
    const m = milestones(profile, h, FRI);
    expect(at(m, 'firstWorkout')).toBe(MON);
    expect(at(m, 'firstStrict')).toBe(THU);
    expect(at(m, 'workouts10')).toBeNull();
  });

  it('workout counts and pull-up totals are dated by the crossing workout', () => {
    const ws = Array.from({ length: 12 }, (_, i) => workoutOf(addDays(START, i), 'pullVolume', [['strict-pullup', [5, 5]]]));
    const m = milestones(profile, history({ workouts: ws }), addDays(START, 20));
    expect(at(m, 'workouts10')).toBe(addDays(START, 9));
    expect(at(m, 'pullups100')).toBe(addDays(START, 9));
    expect(at(m, 'pullups1000')).toBeNull();
  });

  it('a record needs a previous best — the setup answer counts for strict pull-ups', () => {
    const first = workoutOf(MON, 'pullStrength', [['strict-pullup', [5]], ['chin-up', [6]]]);
    expect(at(milestones(profile, history({ workouts: [first] }), FRI), 'firstRecord')).toBeNull();
    expect(at(milestones(profile, history({ workouts: [first], maxEntries: [maxEntry(5)] }), FRI), 'firstRecord')).toBeNull();
    expect(at(milestones(profile, history({ workouts: [first], maxEntries: [maxEntry(4)] }), FRI), 'firstRecord')).toBe(MON);
    const second = workoutOf(THU, 'pullVolume', [['chin-up', [7]]]);
    expect(at(milestones(profile, history({ workouts: [first, second] }), FRI), 'firstRecord')).toBe(THU);
  });

  it('first max test needs a logged test set', () => {
    const h = history({ workouts: [workoutOf(MON, 'maxTest', [['strict-pullup', [null], 'test']]), workoutOf(THU, 'maxTest', [['strict-pullup', [6], 'test']])] });
    expect(at(milestones(profile, h, FRI), 'firstMaxTest')).toBe(THU);
  });

  it('4 weeks of rhythm: four complete on-plan weeks in a row, dated on the 4th Sunday', () => {
    const days = (mon: string) => [0, 1, 3, 4].map((i) => workoutOf(addDays(mon, i), 'push', [['pushup', [10]]]));
    const mondays = [0, 1, 2, 3, 4].map((w) => addDays(START, 7 * w));
    const full = history({ workouts: mondays.flatMap(days) });
    expect(at(milestones(profile, full, addDays(START, 40)), 'rhythm4')).toBe(addDays(START, 27));
    // Not reached while the 4th week is still running.
    expect(at(milestones(profile, full, addDays(START, 25)), 'rhythm4')).toBeNull();
    // A gap week resets the run.
    const gap = history({ workouts: [mondays[0]!, mondays[2]!, mondays[3]!, mondays[4]!].flatMap(days) });
    expect(at(milestones(profile, gap, addDays(START, 40)), 'rhythm4')).toBeNull();
    // Recovery-only weeks are on plan but do not make a rhythm.
    const rest = history({ recoveryDays: mondays.flatMap((m) => [0, 1, 3, 4].map((i) => recoveryDay(addDays(m, i), 'busy'))) });
    expect(at(milestones(profile, rest, addDays(START, 40)), 'rhythm4')).toBeNull();
  });

  it('first muscle-up stage: 8 strict pull-ups + 10 dips (or 15 push-ups without dip bars)', () => {
    const h = history({ workouts: [workoutOf(MON, 'push', [['pushup', [15]]]), workoutOf(THU, 'pullStrength', [['strict-pullup', [8]]])] });
    expect(at(milestones(profile, h, FRI), 'muscleUpStage')).toBe(THU);
    const withDips = makeProfile({ startDate: START, equipment: ['bar', 'dipBars'] });
    expect(at(milestones(withDips, h, FRI), 'muscleUpStage')).toBeNull();
  });

  it('one year after the first workout, not before', () => {
    const h = history({ workouts: [workoutOf(MON, 'push', [['pushup', [10]]])] });
    expect(at(milestones(profile, h, '2027-01-11'), 'oneYear')).toBeNull();
    expect(at(milestones(profile, h, '2027-01-12'), 'oneYear')).toBe('2027-01-12');
  });

  it('records agree with the completion screen over a simulated half year', () => {
    const h = simulate(profile, history({ maxEntries: [maxEntry(4)] }), START, 26 * 7, (ex, i) => ex.target + (i === 0 ? 1 : 0), { takeTests: true });
    const sorted = [...h.workouts].sort(byStart);
    const firstHit = sorted.find((w) => recordsOf(w, sorted, h.maxEntries).length > 0);
    expect(firstHit).toBeDefined();
    expect(at(milestones(profile, h, addDays(START, 26 * 7)), 'firstRecord')).toBe(firstHit!.localDate);
    expect(at(milestones(profile, h, addDays(START, 26 * 7)), 'firstMaxTest')).not.toBeNull();
  });
});

describe('addYears', () => {
  it('handles leap days', () => {
    expect(addYears('2026-03-01', 1)).toBe('2027-03-01');
    expect(addYears('2028-02-29', 1)).toBe('2029-03-01');
  });
});

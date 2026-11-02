import { describe, expect, it } from 'vitest';
import { START, WEEK1, complete, history, makeProfile, recoveryDay } from '../test/fixtures';
import { planDay } from './plan';
import { addDays } from './time';
import { dayState, weekStrip } from './week';

const p = makeProfile({ daysPerWeek: 4 }); // Mon P, Tue U, Thu V, Fri L
const done = (date: string, opts = {}) => complete(planDay(p, history(), date, opts));

describe('week strip', () => {
  it('distinguishes done, recovery, rest, missed, today and planned', () => {
    const today = addDays(WEEK1, 3); // Thursday
    const h = history({
      workouts: [done(WEEK1), done(addDays(WEEK1, 2), { variant: 'light' })],
      recoveryDays: [recoveryDay(addDays(WEEK1, 1), 'tired')],
    });
    const strip = weekStrip(p, h, today);
    expect(strip.map((c) => c.state)).toEqual(['done', 'recovery', 'rest', 'today', 'planned', 'rest', 'rest']);
    expect(strip.map((c) => c.isToday)).toEqual([false, false, false, true, false, false, false]);
    expect(strip[0]!.scheduled).toBe('pullStrength');
  });

  it('shows a past training day without a session as missed (never a rest day)', () => {
    expect(dayState(p, history(), WEEK1, addDays(WEEK1, 2)).state).toBe('missed');
    expect(dayState(p, history(), addDays(WEEK1, 2), addDays(WEEK1, 3)).state).toBe('rest');
  });

  it('a planned recovery session not done is rest, not missed (no guilt)', () => {
    const seven = makeProfile({ daysPerWeek: 7 });
    expect(dayState(seven, history(), addDays(WEEK1, 4), addDays(WEEK1, 5)).state).toBe('rest');
    const rec = complete(planDay(seven, history(), addDays(WEEK1, 4)));
    expect(rec.type).toBe('recovery');
    expect(dayState(seven, history({ workouts: [rec] }), addDays(WEEK1, 4), addDays(WEEK1, 5)).state).toBe('done');
  });

  it('today: done once trained; a rest day stays rest; recovery when chosen', () => {
    expect(dayState(p, history({ workouts: [done(WEEK1)] }), WEEK1, WEEK1).state).toBe('done');
    expect(dayState(p, history(), addDays(WEEK1, 2), addDays(WEEK1, 2)).state).toBe('rest');
    expect(dayState(p, history({ recoveryDays: [recoveryDay(WEEK1, null)] }), WEEK1, WEEK1).state).toBe('recovery');
  });

  it('days before the program start are neutral rest days', () => {
    const late = makeProfile({ startDate: addDays(START, 3) });
    expect(dayState(late, history(), START, addDays(START, 4))).toMatchObject({ state: 'rest', scheduled: null });
  });
});

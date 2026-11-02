import { describe, expect, it } from 'vitest';
import { THOUGHTS } from '../data/thoughts';
import {
  COMPLETION_CATEGORIES, NO_REPEAT_DAYS, RECENT_LIMIT, REST_CATEGORIES, completionThoughtId, dailyThoughtId, hashString,
  pushRecent, resolveThoughts, restThoughtId, seededShuffle, thoughtById, thoughtsIn, toggleFavorite,
} from './thoughts';
import { addDays } from './time';
import type { ThoughtDay } from './types';

const pin = (localDate: string, thoughtId: string): ThoughtDay => ({ localDate, thoughtId, atUtc: `${localDate}T08:00:00.000Z` });

/** Simulates a user who opens the app every day: each day's pick is pinned before the next day. */
function simulate(start: string, n: number): ThoughtDay[] {
  const days: ThoughtDay[] = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i);
    days.push(pin(d, dailyThoughtId(d, days)));
  }
  return days;
}

describe('hashString / seededShuffle', () => {
  it('is stable and spreads values', () => {
    expect(hashString('2025-03-01|pullup-pro')).toBe(hashString('2025-03-01|pullup-pro'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('')).toBe(0x811c9dc5);
  });
  it('shuffles deterministically without losing items', () => {
    const list = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(list, 's1')).toEqual(seededShuffle(list, 's1'));
    expect(seededShuffle(list, 's1')).not.toEqual(seededShuffle(list, 's2'));
    expect([...seededShuffle(list, 's1')].sort((a, b) => a - b)).toEqual(list);
  });
});

describe('dailyThoughtId', () => {
  it('is deterministic for a date and always a short thought', () => {
    for (let i = 0; i < 100; i++) {
      const d = addDays('2025-01-01', i);
      const id = dailyThoughtId(d, []);
      expect(id).toBe(dailyThoughtId(d, []));
      expect(thoughtById(id)?.format).toBe('short');
    }
  });

  it('a thought pinned for the date wins (stable all day)', () => {
    expect(dailyThoughtId('2025-05-05', [pin('2025-05-05', 'hope-3')])).toBe('hope-3');
    // A pin for an id that no longer exists falls back to the computed pick.
    expect(dailyThoughtId('2025-05-05', [pin('2025-05-05', 'gone-1')])).toBe(dailyThoughtId('2025-05-05', []));
  });

  it(`never repeats within any ${NO_REPEAT_DAYS}-day window over 400 simulated days`, () => {
    const days = simulate('2025-01-01', 400);
    for (let i = 0; i < days.length; i++) {
      const window = days.slice(Math.max(0, i - NO_REPEAT_DAYS), i).map((d) => d.thoughtId);
      expect(window, days[i]!.localDate).not.toContain(days[i]!.thoughtId);
    }
    // And it actually travels the library instead of cycling a few thoughts.
    expect(new Set(days.map((d) => d.thoughtId)).size).toBe(THOUGHTS.filter((t) => t.format === 'short').length);
  });

  it('ignores pins outside the 30-day window and in the future', () => {
    const base = dailyThoughtId('2025-06-30', []);
    expect(dailyThoughtId('2025-06-30', [pin('2025-05-30', base)])).toBe(base); // 31 days ago
    expect(dailyThoughtId('2025-06-30', [pin('2025-07-01', base)])).toBe(base); // future
    expect(dailyThoughtId('2025-06-30', [pin('2025-05-31', base)])).not.toBe(base); // 30 days ago
  });

  it('changes from one day to the next when the user opens it daily', () => {
    const days = simulate('2026-02-01', 60);
    for (let i = 1; i < days.length; i++) expect(days[i]!.thoughtId).not.toBe(days[i - 1]!.thoughtId);
  });
});

describe('rest and completion thoughts', () => {
  it('rest thoughts come from the rest categories and differ for every rest of a session', () => {
    const ids = Array.from({ length: 20 }, (_, i) => restThoughtId('session-1', i));
    expect(new Set(ids).size).toBe(20);
    for (const id of ids) {
      const t = thoughtById(id)!;
      expect(t.format).toBe('short');
      expect(REST_CATEGORIES).toContain(t.category);
    }
    expect(restThoughtId('session-1', 3)).toBe(restThoughtId('session-1', 3));
    expect(restThoughtId('session-1', 20)).toBe(restThoughtId('session-1', 0));
    expect(restThoughtId('session-1', -1)).toBe(restThoughtId('session-1', 19));
  });

  it('completion thought is stable per workout and comes from the completion categories', () => {
    const id = completionThoughtId('w-1');
    expect(completionThoughtId('w-1')).toBe(id);
    expect(COMPLETION_CATEGORIES).toContain(thoughtById(id)!.category);
    expect(thoughtById(id)!.format).toBe('short');
    expect(new Set(Array.from({ length: 50 }, (_, i) => completionThoughtId(`w-${i}`))).size).toBeGreaterThan(10);
  });
});

describe('favorites and recently viewed', () => {
  it('recent: newest first, no duplicates, capped', () => {
    let list = pushRecent([], 'a', 't1');
    list = pushRecent(list, 'b', 't2');
    list = pushRecent(list, 'a', 't3');
    expect(list).toEqual([{ id: 'a', atUtc: 't3' }, { id: 'b', atUtc: 't2' }]);
    for (let i = 0; i < 50; i++) list = pushRecent(list, `x${i}`, `t${i}`);
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]!.id).toBe('x49');
  });

  it('favorites toggle on and off, newest first', () => {
    expect(toggleFavorite([], 'a')).toEqual(['a']);
    expect(toggleFavorite(['a'], 'b')).toEqual(['b', 'a']);
    expect(toggleFavorite(['b', 'a'], 'a')).toEqual(['b']);
  });

  it('resolves ids and skips unknown ones; filters by category', () => {
    expect(resolveThoughts(['life-1', 'nope', 'time-5']).map((t) => t.id)).toEqual(['life-1', 'time-5']);
    expect(thoughtById(null)).toBeNull();
    expect(thoughtsIn(null)).toHaveLength(THOUGHTS.length);
    expect(thoughtsIn('hope').every((t) => t.category === 'hope')).toBe(true);
    expect(thoughtsIn('hope')).toHaveLength(6);
  });
});

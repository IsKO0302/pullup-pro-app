import { THOUGHTS, THOUGHTS_BY_ID } from '../data/thoughts';
import { daysBetween, type LocalDate } from './time';
import type { RecentThought, Thought, ThoughtCategory, ThoughtDay } from './types';

/** Salt for the daily pick: changing it reshuffles every user's calendar, so keep it fixed. */
export const DAILY_SALT = 'pullup-pro';
/** The thought of the day never repeats one shown in this many previous days. */
export const NO_REPEAT_DAYS = 30;
export const RECENT_LIMIT = 30;

/** Rest-timer thoughts (spec §6) and the completion thought: short format only. */
export const REST_CATEGORIES: readonly ThoughtCategory[] = ['sport', 'discipline', 'patience', 'consistency', 'innerStrength'];
export const COMPLETION_CATEGORIES: readonly ThoughtCategory[] = ['growth', 'success', 'consistency', 'patience', 'innerStrength', 'selfRespect'];

/** FNV-1a (32-bit): tiny and identical on every platform. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic shuffle (mulberry32 PRNG + Fisher–Yates). */
export function seededShuffle<T>(list: readonly T[], seed: string): T[] {
  let a = hashString(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const byId = (a: Thought, b: Thought) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const shortIn = (cats?: readonly ThoughtCategory[]) =>
  THOUGHTS.filter((t) => t.format === 'short' && (!cats || cats.includes(t.category))).sort(byId);

const DAILY_POOL = shortIn();
const REST_POOL = shortIn(REST_CATEGORIES);
const COMPLETION_POOL = shortIn(COMPLETION_CATEGORIES);

export const thoughtById = (id: string | null | undefined): Thought | null => (id ? THOUGHTS_BY_ID.get(id) ?? null : null);

/**
 * Thought of the day for a local calendar date.
 * 1. A thought already pinned for that date (persisted on first view) always wins → stable all day,
 *    even if the library or the algorithm changes later.
 * 2. Otherwise: hash(date + salt) picks from the short thoughts not shown in the previous 30 days.
 */
export function dailyThoughtId(date: LocalDate, days: readonly ThoughtDay[]): string {
  const pinned = days.find((d) => d.localDate === date);
  if (pinned && THOUGHTS_BY_ID.has(pinned.thoughtId)) return pinned.thoughtId;
  const used = new Set(
    days.filter((d) => {
      const ago = daysBetween(d.localDate, date);
      return ago >= 1 && ago <= NO_REPEAT_DAYS;
    }).map((d) => d.thoughtId),
  );
  const fresh = DAILY_POOL.filter((t) => !used.has(t.id));
  const pool = fresh.length > 0 ? fresh : DAILY_POOL;
  return pool[hashString(`${date}|${DAILY_SALT}`) % pool.length]!.id;
}

/** A different short thought for each rest of a session (cycles only after all 20 were shown). */
export function restThoughtId(sessionId: string, restIndex: number): string {
  const order = seededShuffle(REST_POOL, `${sessionId}|rest`);
  return order[((restIndex % order.length) + order.length) % order.length]!.id;
}

export function completionThoughtId(workoutId: string): string {
  return COMPLETION_POOL[hashString(`${workoutId}|done`) % COMPLETION_POOL.length]!.id;
}

/** Newest first, no duplicates, capped. */
export function pushRecent(list: readonly RecentThought[], id: string, atUtc: string): RecentThought[] {
  return [{ id, atUtc }, ...list.filter((r) => r.id !== id)].slice(0, RECENT_LIMIT);
}

/** Newest favorite first. */
export function toggleFavorite(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
}

/** Resolves stored ids to thoughts, silently skipping ids that no longer exist in the library. */
export function resolveThoughts(ids: readonly string[]): Thought[] {
  return ids.map((id) => THOUGHTS_BY_ID.get(id)).filter((t): t is Thought => !!t);
}

export function thoughtsIn(category: ThoughtCategory | null): readonly Thought[] {
  return category ? THOUGHTS.filter((t) => t.category === category) : THOUGHTS;
}

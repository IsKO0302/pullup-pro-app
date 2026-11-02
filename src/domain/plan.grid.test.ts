/**
 * Property tests over the whole configuration grid: days/week 2–7 × session
 * length × level 0–4 × equipment × every session of the week's template × variants.
 * Sessions are built directly (buildSession) so every type is covered; the weekly
 * rotation itself is tested in rotation.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES, hasEquipment } from '../data/exercises/catalog';
import { WEEK1, history, makeProfile, maxEntry } from '../test/fixtures';
import { estimateMinutes, estimateSeconds } from './duration';
import { buildSession, type Variant } from './plan';
import { planTemplate } from './schedule';
import { addDays } from './time';
import { DAYS_PER_WEEK, SESSION_MINUTES, type Equipment, type Workout } from './types';

const LEVEL_MAX = [0, 2, 5, 10, 15] as const;
const EQUIPMENT_SETS: Record<string, Equipment[]> = {
  bar: ['bar'],
  full: ['bar', 'dipBars', 'bands', 'rings', 'box'],
  barBox: ['bar', 'box'],
  rings: ['rings'],
  none: [],
  dipsOnly: ['dipBars'],
};

function problems(w: Workout, owned: readonly Equipment[], targetMin: number, label: string): string[] {
  const out: string[] = [];
  const say = (m: string) => out.push(`${label} [${w.type}] ${m}`);
  if (w.exercises.length === 0) say('no exercises');
  const sec = estimateSeconds(w.exercises);
  const reduced = w.flags.lighterWeek || w.flags.returnAfterBreak || w.flags.feelingOff;
  if (!reduced && (sec < targetMin * 60 * 0.85 || sec > targetMin * 60 * 1.15)) say(`duration ${(sec / 60).toFixed(1)} min vs ${targetMin}`);
  if (w.estimatedMinutes !== estimateMinutes(w.exercises)) say('estimatedMinutes mismatch');
  const ids = w.exercises.filter((e) => e.role !== 'test' && e.role !== 'warmup').map((e) => e.exerciseId);
  if (new Set(ids).size !== ids.length) say(`duplicate exercises ${ids.join(',')}`);
  const slots = w.exercises.map((e) => e.slot);
  if (new Set(slots).size !== slots.length) say('duplicate slots');
  if (w.exercises[0] && w.exercises[0].role !== 'main' && w.exercises[0].role !== 'warmup') say('first exercise is not the main one');
  for (const e of w.exercises) {
    const def = EXERCISES[e.exerciseId];
    if (def.optional) say(`optional exercise ${e.exerciseId} prescribed`);
    if (!hasEquipment(def, owned)) say(`${e.exerciseId} needs missing equipment`);
    if (e.sets < 1 || e.target < 1 || e.restSec < 15) say(`bad numbers ${e.exerciseId} ${e.sets}x${e.target} rest ${e.restSec}`);
    if (e.role !== 'test' && e.role !== 'warmup' && (w.level < def.levelRange[0] || w.level > def.levelRange[1])) say(`${e.exerciseId} outside its level range at L${w.level}`);
  }
  if (w.muscles.length === 0) say('no muscles');
  return out;
}

describe('planDay — configuration grid', () => {
  for (const days of DAYS_PER_WEEK) {
    for (const minutes of SESSION_MINUTES) {
      it(`${days} days × ${minutes} min: every day, level, equipment and variant is valid`, () => {
        const failures: string[] = [];
        for (const [eqName, owned] of Object.entries(EQUIPMENT_SETS)) {
          for (const [level, max] of LEVEL_MAX.entries()) {
            const profile = makeProfile({ daysPerWeek: days, sessionMinutes: minutes, equipment: owned });
            const h = history({ maxEntries: [maxEntry(max)] });
            for (let d = 0; d < 7; d++) {
              const date = addDays(WEEK1, d);
              const label = `${eqName} L${level} ${date}`;
              const scheduled = planTemplate(days)[d] ?? null;
              const planned = buildSession(profile, h, date, scheduled ?? 'light');
              expect(planned.level).toBe(level);
              const plannedMinutes = scheduled === 'recovery' ? Math.min(20, Math.max(10, minutes)) : scheduled === null ? 10 : minutes;
              failures.push(...problems(planned, owned, plannedMinutes, label));
              if (scheduled === null && planned.type !== 'light') failures.push(`${label} rest day is not light`);
              if (scheduled !== null && owned.some((e) => e === 'bar' || e === 'rings') && planned.type !== scheduled) failures.push(`${label} type ${planned.type} ≠ ${scheduled}`);
              for (const variant of ['short', 'light'] as Variant[]) {
                failures.push(...problems(buildSession(profile, h, date, variant as 'short' | 'light', { variant }), owned, 10, `${label} ${variant}`));
              }
              expect(buildSession(profile, h, date, scheduled ?? 'light')).toEqual(planned);
            }
          }
        }
        expect(failures).toEqual([]);
      });
    }
  }
});

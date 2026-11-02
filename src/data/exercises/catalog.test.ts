import { describe, expect, it } from 'vitest';
import { LEGS_CORE, LIGHT, PULL_STRENGTH, PULL_VOLUME, PUSH, RECOVERY, skillSlot, type SlotSpec } from '../../domain/slots';
import { EXERCISE_IDS, LANGS, type Equipment } from '../../domain/types';
import { EXERCISES, EXERCISE_LIST, EXERCISE_TEXT, hasEquipment } from './index';

const allSlots: SlotSpec[] = [
  ...[PULL_STRENGTH, PULL_VOLUME, PUSH, LEGS_CORE].flatMap((t) => Object.values(t).flat()),
  ...RECOVERY,
  ...LIGHT,
  ...[1, 2, 3, 4, 5, 6].map(skillSlot),
];

describe('exercise catalog', () => {
  it('defines every exercise id exactly once', () => {
    expect(EXERCISE_LIST.map((e) => e.id).sort()).toEqual([...EXERCISE_IDS].sort());
    for (const id of EXERCISE_IDS) expect(EXERCISES[id].id).toBe(id);
  });

  it('has sane numbers and valid references', () => {
    for (const def of EXERCISE_LIST) {
      expect(def.start, def.id).toBeGreaterThan(0);
      expect(def.secPerRep, def.id).toBeGreaterThan(0);
      expect(def.levelRange[0], def.id).toBeLessThanOrEqual(def.levelRange[1]);
      expect(def.muscles.length, def.id).toBeGreaterThan(0);
      for (const ref of [...def.easier, ...def.harder, ...def.alternatives]) {
        expect(EXERCISES[ref], `${def.id} → ${ref}`).toBeDefined();
        expect(ref, def.id).not.toBe(def.id);
      }
    }
  });

  it('always offers a swap that works with the same equipment', () => {
    for (const def of EXERCISE_LIST) {
      for (const owned of def.equipment) {
        const ok = def.alternatives.some((a) => hasEquipment(EXERCISES[a], owned as Equipment[]));
        expect(ok, `${def.id} with [${owned.join(',')}]`).toBe(true);
      }
    }
  });

  it('keeps bench dips and shoulder dislocates optional, never in a plan table (guardrail 4)', () => {
    expect(EXERCISE_LIST.filter((e) => e.optional).map((e) => e.id).sort()).toEqual(['bench-dips', 'shoulder-dislocates']);
    for (const slot of allSlots) for (const opt of slot.options) expect(EXERCISES[opt.id].optional, `${slot.key}: ${opt.id}`).toBeUndefined();
    for (const id of ['bench-dips', 'shoulder-dislocates'] as const) {
      expect(EXERCISE_LIST.some((e) => e.alternatives.includes(id)), id).toBe(true);
    }
  });

  it('only strict-pullup family exercises are unassisted pull-ups', () => {
    expect(EXERCISES['strict-pullup'].family).toBe('pullup');
    expect(EXERCISES['band-pullup'].family).toBe('assisted');
    expect(EXERCISES['negative-pullup'].family).toBe('negative');
    expect(EXERCISES['australian-row'].family).toBeUndefined();
  });
});

describe('exercise texts', () => {
  for (const lang of LANGS) {
    it(`${lang}: name, three cues, a common mistake for every exercise`, () => {
      const texts = EXERCISE_TEXT[lang];
      expect(Object.keys(texts).sort()).toEqual([...EXERCISE_IDS].sort());
      const names = new Set<string>();
      for (const id of EXERCISE_IDS) {
        const t = texts[id];
        expect(t.name.trim(), id).not.toBe('');
        expect(names.has(t.name), `duplicate name ${t.name}`).toBe(false);
        names.add(t.name);
        expect(t.cues).toHaveLength(3);
        for (const cue of t.cues) {
          expect(cue.trim(), id).not.toBe('');
          expect(cue.length, `${id}: ${cue}`).toBeLessThanOrEqual(110);
          expect(cue, id).toMatch(/[.!?…]$/u);
        }
        expect(t.mistake.trim(), id).not.toBe('');
        for (const s of [t.name, ...t.cues, t.mistake, t.safety ?? '']) expect(s, id).not.toMatch(/\s{2,}|TODO|lorem/iu);
      }
    });

    it(`${lang}: optional exercises carry a safety note`, () => {
      for (const def of EXERCISE_LIST.filter((e) => e.optional)) expect(EXERCISE_TEXT[lang][def.id].safety?.trim(), def.id).toBeTruthy();
    });
  }

  it('translations are real translations (not copies of the English text)', () => {
    for (const id of EXERCISE_IDS) {
      const en = EXERCISE_TEXT.en[id];
      expect(EXERCISE_TEXT.ru[id].cues.join(' '), id).toMatch(/[а-яё]/iu);
      expect(EXERCISE_TEXT.tr[id].cues.join(' '), id).not.toBe(en.cues.join(' '));
      expect(EXERCISE_TEXT.tr[id].mistake, id).not.toBe(en.mistake);
      expect(Boolean(EXERCISE_TEXT.ru[id].safety), id).toBe(Boolean(en.safety));
      expect(Boolean(EXERCISE_TEXT.tr[id].safety), id).toBe(Boolean(en.safety));
    }
  });
});

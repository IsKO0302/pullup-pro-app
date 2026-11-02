import { describe, expect, it } from 'vitest';
import { LANGS } from '../../domain/types';
import { createI18n, interpolate, placeholders } from './core';
import { DICTIONARIES, type MessageKey } from './index';

const keysOf = (lang: 'en' | 'ru' | 'tr') => Object.keys(DICTIONARIES[lang]).sort();

describe('dictionaries', () => {
  it('have identical key sets in EN, RU and TR', () => {
    expect(keysOf('ru')).toEqual(keysOf('en'));
    expect(keysOf('tr')).toEqual(keysOf('en'));
  });

  it.each(LANGS)('%s has no empty values', (lang) => {
    const empty = Object.entries(DICTIONARIES[lang]).filter(([, v]) => v.trim() === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it.each(['ru', 'tr'] as const)('%s uses exactly the same placeholders as EN', (lang) => {
    const mismatched = (Object.keys(DICTIONARIES.en) as MessageKey[]).filter(
      (k) => placeholders(DICTIONARIES.en[k]).join() !== placeholders(DICTIONARIES[lang][k]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it.each(LANGS)('%s welcome text keeps the 9 lines and the motto', (lang) => {
    const lines = DICTIONARIES[lang]['welcome.text'].split('\n');
    expect(lines).toHaveLength(9);
    expect(lines[5]).toBe('YOU VS. YOU.');
  });

  it('every plural message contains {n}', () => {
    for (const lang of LANGS) {
      for (const [k, v] of Object.entries(DICTIONARIES[lang])) {
        if (k.startsWith('plural.')) expect(v, `${lang} ${k}`).toContain('{n}');
      }
    }
  });
});

describe('createI18n', () => {
  it('interpolates variables and keeps unknown placeholders', () => {
    expect(interpolate('Set {i} of {n}', { i: 2, n: 4 }, String)).toBe('Set 2 of 4');
    expect(interpolate('Hi {name}', {}, String)).toBe('Hi {name}');
    expect(interpolate('No vars', undefined, String)).toBe('No vars');
  });

  it('formats numbers per locale', () => {
    expect(createI18n('en').num(1234)).toBe('1,234');
    expect(createI18n('ru').num(1234).replace(/\s/g, ' ')).toBe('1 234');
  });

  it('applies Russian plural rules', () => {
    const { tp } = createI18n('ru');
    expect(tp('plural.workouts', 1)).toBe('1 тренировка');
    expect(tp('plural.workouts', 3)).toBe('3 тренировки');
    expect(tp('plural.workouts', 5)).toBe('5 тренировок');
    expect(tp('plural.workouts', 11)).toBe('11 тренировок');
    expect(tp('plural.workouts', 21)).toBe('21 тренировка');
    expect(tp('plural.workouts', 0)).toBe('0 тренировок');
  });

  it('applies English and Turkish plural rules', () => {
    expect(createI18n('en').tp('plural.workouts', 1)).toBe('1 workout');
    expect(createI18n('en').tp('plural.workouts', 0)).toBe('0 workouts');
    expect(createI18n('tr').tp('plural.workouts', 7)).toBe('7 antrenman');
  });

  it('upper-cases Turkish i correctly', () => {
    expect(createI18n('tr').upper('istanbul ılık')).toBe('İSTANBUL ILIK');
    expect(createI18n('en').upper('istanbul')).toBe('ISTANBUL');
  });

  it('formats local dates without time-zone drift', () => {
    const en = createI18n('en').date('2025-03-09', { day: 'numeric', month: 'long' });
    expect(en).toBe('9 March');
    expect(createI18n('ru').date('2025-03-09', { day: 'numeric', month: 'long' })).toBe('9 марта');
    expect(createI18n('tr').date('2025-03-09', { day: 'numeric', month: 'long' })).toBe('9 Mart');
  });
});

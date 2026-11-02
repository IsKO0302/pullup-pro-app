import { describe, expect, it } from 'vitest';
import { createI18n } from '../../data/i18n/core';
import { muscleList } from './labels';

describe('muscleList', () => {
  it('separates muscles with commas in every language', () => {
    expect(muscleList(createI18n('en').t, ['back', 'biceps', 'forearms'])).toBe('back, biceps, grip');
    expect(muscleList(createI18n('ru').t, ['back', 'biceps', 'forearms'])).toMatch(/^[^,]+, [^,]+, [^,]+$/);
    expect(muscleList(createI18n('tr').t, ['back', 'biceps', 'forearms'])).toMatch(/^[^,]+, [^,]+, [^,]+$/);
  });
});

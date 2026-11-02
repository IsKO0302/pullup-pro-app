/**
 * Phase 9 QA checks shared by qa.spec.ts: things a person would notice on a
 * phone — sideways scrolling, cut-off text, targets too small to hit — plus an
 * axe-core audit and a mixed-language detector.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { EXERCISE_TEXT } from '../src/data/exercises';
import { DICTIONARIES, LANGUAGE_NAMES, LANGUAGE_PICKER_LABEL } from '../src/data/i18n';
import { THOUGHTS } from '../src/data/thoughts';
import type { Lang } from '../src/domain/types';

/** Minimum touch target (spec §11). */
export const TARGET = 48;

/** Layout problems in the current state of the page (runs in the browser). */
export function layoutProblems(page: Page, checkTargets: boolean): Promise<string[]> {
  return page.evaluate(({ checkTargets, target }) => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    const describe = (el: Element) => {
      const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `<${el.tagName.toLowerCase()}${cls}> "${text}"`;
    };
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) return false; // empty or visually hidden (sr-only)
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
    };
    const srOnly = (el: Element) => {
      for (let p: Element | null = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.clip.startsWith('rect') || cs.clipPath.startsWith('inset(50%')) return true;
        const r = p.getBoundingClientRect();
        if (r.width <= 1 && r.height <= 1 && cs.overflow !== 'visible') return true;
      }
      return false;
    };
    const insideClipper = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };

    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
    for (const el of document.body.querySelectorAll('*')) {
      if (!shown(el) || srOnly(el)) continue;
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.left < -1) && !insideClipper(el)) out.push(`sticks out of the screen: ${describe(el)} [${Math.round(r.left)}…${Math.round(r.right)} of ${vw}]`);
      if (el instanceof SVGElement || el instanceof HTMLCanvasElement) continue;
      const cs = getComputedStyle(el);
      const ellipsis = cs.textOverflow === 'ellipsis' || Number(cs.webkitLineClamp) > 0;
      if (!ellipsis && ['hidden', 'clip'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`cut off (width): ${describe(el)} ${el.scrollWidth} > ${el.clientWidth}`);
      if (!ellipsis && ['hidden', 'clip'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push(`cut off (height): ${describe(el)} ${el.scrollHeight} > ${el.clientHeight}`);
    }

    if (checkTargets) {
      const interactive = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=radio], [role=checkbox], [role=slider], [role=link]';
      for (const el of document.querySelectorAll(interactive)) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (el.closest('[aria-hidden="true"], [inert]')) continue;
        let r = el.getBoundingClientRect();
        const native = el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type);
        if (r.width < 2 || r.height < 2 || native) {
          // A native checkbox / radio (or a visually hidden control) is hit through its label.
          const label = el.closest('label') ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
          if (label) r = label.getBoundingClientRect();
          else if (r.width < 2 || r.height < 2) continue;
        }
        if (r.width === 0 && r.height === 0) continue; // inside a closed dialog / collapsed section
        if (r.width < target - 0.5 || r.height < target - 0.5) out.push(`small target: ${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return [...new Set(out)];
  }, { checkTargets, target: TARGET });
}

/** WCAG 2.2 A/AA + best-practice violations reported by axe-core. */
export async function axeProblems(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return result.violations.map((v) => `axe ${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

const words = (s: string, lang: Lang) => s.replace(/\{[^}]*\}/g, ' ').toLocaleLowerCase(lang).match(/\p{L}[\p{L}’'-]*\p{L}|\p{L}/gu) ?? [];

function vocabulary(lang: Lang): Set<string> {
  const out = new Set<string>();
  const add = (s: string | undefined) => { if (s) for (const w of words(s, lang)) out.add(w); };
  Object.values(DICTIONARIES[lang]).forEach(add);
  for (const t of Object.values(EXERCISE_TEXT[lang])) { add(t.name); t.cues.forEach(add); add(t.mistake); add(t.safety); }
  for (const t of THOUGHTS) add(t.text[lang]);
  Object.values(LANGUAGE_NAMES).forEach(add);
  add(LANGUAGE_PICKER_LABEL);
  return out;
}

const VOCAB: Record<Lang, Set<string>> = { en: vocabulary('en'), ru: vocabulary('ru'), tr: vocabulary('tr') };
// Month and weekday names (Intl, as the app formats them): English ones catch dates
// formatted in the wrong language; each language's own ones are of course allowed.
for (const lang of ['en', 'ru', 'tr'] as const) {
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(2026, m, 5));
    for (const opts of [{ month: 'long' }, { month: 'short' }, { day: 'numeric', month: 'long' }, { day: 'numeric', month: 'short' }, { weekday: 'long' }, { weekday: 'short' }] as const) {
      for (const w of words(d.toLocaleDateString(lang, { ...opts, timeZone: 'UTC' }), lang)) VOCAB[lang].add(w);
    }
  }
}

/**
 * English words visible (text, aria-label, title, placeholder, alt) on a RU or
 * TR screen that the RU / TR texts never use — i.e. mixed languages.
 */
export async function mixedLanguage(page: Page, lang: Lang, userWords: readonly string[] = []): Promise<string[]> {
  const texts = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim()) continue;
      if (el.closest('script, style, [aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0 && !el.closest('.visually-hidden')) continue;
      out.push(n.textContent);
    }
    for (const el of document.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
      for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
        const v = el.getAttribute(a);
        if (v) out.push(v);
      }
    }
    return out;
  });
  const foreign = new Set<string>();
  for (const t of texts) {
    for (const w of words(t, lang)) {
      if (VOCAB.en.has(w) && !VOCAB[lang].has(w) && !userWords.includes(w)) foreign.add(`"${w}" in "${t.trim().slice(0, 60)}"`);
    }
  }
  return [...foreign].map((f) => `English word on a ${lang.toUpperCase()} screen: ${f}`);
}

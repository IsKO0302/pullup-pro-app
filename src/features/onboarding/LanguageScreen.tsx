import { ArrowRight } from 'lucide-react';
import { currentTimeZone } from '../../app/clock';
import { storeLang } from '../../app/config';
import { useStore } from '../../app/store';
import { LANGUAGE_NAMES, LANGUAGE_PICKER_LABEL } from '../../data/i18n';
import { localDateOf } from '../../domain/time';
import { LANGS, type Lang, type Profile } from '../../domain/types';
import './onboarding.css';

export function newProfile(lang: Lang, now: Date): Profile {
  return {
    name: '',
    lang,
    equipment: ['bar'],
    daysPerWeek: 4,
    sessionMinutes: 30,
    goals: [],
    startDate: localDateOf(now, currentTimeZone()),
    createdAtUtc: now.toISOString(),
    onboarding: 'welcome',
  };
}

/** Language-neutral first screen: three text options, no flags. */
export function LanguageScreen() {
  const { actions } = useStore();
  const pick = (lang: Lang) => {
    storeLang(lang);
    void actions.saveProfile(newProfile(lang, new Date()));
  };
  return (
    <main className="lang">
      <p className="t-eyebrow lang__brand">PULLUP PRO</p>
      <h1 className="lang__title" id="lang-title">{LANGUAGE_PICKER_LABEL}</h1>
      <div className="lang__options" role="group" aria-labelledby="lang-title">
        {LANGS.map((l) => (
          <button key={l} type="button" lang={l} className="lang__option" onClick={() => pick(l)}>
            <span>{LANGUAGE_NAMES[l]}</span>
            <ArrowRight size={20} strokeWidth={1.5} aria-hidden />
          </button>
        ))}
      </div>
    </main>
  );
}

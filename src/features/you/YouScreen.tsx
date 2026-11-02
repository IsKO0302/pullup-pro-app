import { ChevronRight } from 'lucide-react';
import { APP_VERSION } from '../../app/config';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { LANGUAGE_NAMES } from '../../data/i18n';
import { LANGS, type Lang } from '../../domain/types';
import { ChoiceGroup } from '../../ui';

/** Phase 2 subset of YOU: language (instant), welcome replay, safety, version. */
export function YouScreen() {
  const { t } = useI18n();
  const { data, actions } = useStore();
  const profile = data.profile;
  if (!profile) return null;
  const setLang = (lang: Lang) => void actions.saveProfile({ ...profile, lang });
  return (
    <div className="screen-pad">
      <h1 className="t-h1">{t('you.title')}</h1>
      <section className="you__section">
        <h2 className="t-eyebrow">{t('you.language')}</h2>
        <ChoiceGroup label={t('you.language')} value={profile.lang} onChange={setLang} options={LANGS.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))} />
      </section>
      <section className="you__section">
        <h2 className="t-eyebrow">{t('you.about')}</h2>
        <ul className="list">
          <li>
            <button type="button" className="list__row" onClick={() => navigate('welcome')}>
              <span className="list__main">{t('you.replayWelcome')}</span>
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
            </button>
          </li>
        </ul>
        <h3 className="t-caption muted">{t('you.safety')}</h3>
        <p className="t-caption muted">{t('you.safetyText')}</p>
        <p className="t-caption faint">{t('you.version', { v: APP_VERSION })}</p>
      </section>
    </div>
  );
}

import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { currentTimeZone, todayLocal } from '../../app/clock';
import { APP_VERSION } from '../../app/config';
import { useHistory } from '../../app/history';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { LANGUAGE_NAMES } from '../../data/i18n';
import { workingMax } from '../../domain/level';
import { withRhythm } from '../../domain/schedule';
import { makeStamp } from '../../domain/time';
import { DAYS_PER_WEEK, EQUIPMENT, GOALS, LANGS, SESSION_MINUTES, type Equipment, type Lang, type Profile } from '../../domain/types';
import { Button, Chip, ChoiceGroup, Stepper, Switch } from '../../ui';
import { RhythmSplit } from '../common/RhythmSplit';
import { UpdateBanner } from '../common/UpdateBanner';
import { openSavedThoughts } from '../thoughts/memory';
import { DataSection } from './DataSection';
import './you.css';

/** YOU (spec 4.6): every setting saves the moment it changes — no Save buttons except the deliberate max. */
export default function YouScreen() {
  const { data } = useStore();
  const profile = data.profile;
  if (!profile) return null;
  return <You profile={profile} />;
}

function You({ profile }: { profile: Profile }) {
  const { t, tp } = useI18n();
  const { data, actions } = useStore();
  const save = (patch: Partial<Profile>) => void actions.saveProfile({ ...profile, ...patch });
  const { sound, vibration } = data.settings;
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  return (
    <div className="screen-pad you">
      <h1 className="t-h1">{t('you.title')}</h1>
      <UpdateBanner explainWait />

      <section className="you__section" aria-labelledby="you-profile">
        <h2 id="you-profile" className="t-eyebrow">{t('you.profile')}</h2>
        <NameField key={profile.name} profile={profile} />
        <div className="you__item">
          <h3 className="you__label">{t('you.language')}</h3>
          <ChoiceGroup label={t('you.language')} value={profile.lang} onChange={(lang: Lang) => save({ lang })} options={LANGS.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))} />
        </div>
      </section>

      <section className="you__section" aria-labelledby="you-training">
        <h2 id="you-training" className="t-eyebrow">{t('you.training')}</h2>
        <div className="you__item">
          <h3 className="you__label" id="you-goals">{t('you.goals')}</h3>
          <div className="chips" role="group" aria-labelledby="you-goals">
            {GOALS.map((g) => (
              <Chip key={g} selected={profile.goals.includes(g)} onToggle={() => save({ goals: toggle(GOALS, profile.goals, g) })}>{t(`goal.${g}`)}</Chip>
            ))}
          </div>
          <p className="t-caption muted">{t('you.goalsHelp')}</p>
        </div>
        <div className="you__item">
          <h3 className="you__label" id="you-equipment">{t('you.equipment')}</h3>
          <div className="chips" role="group" aria-labelledby="you-equipment">
            {EQUIPMENT.map((e) => (
              <Chip key={e} selected={profile.equipment.includes(e)} onToggle={() => save({ equipment: toggle<Equipment>(EQUIPMENT, profile.equipment, e) })}>{t(`equipment.${e}`)}</Chip>
            ))}
          </div>
          {!profile.equipment.includes('bar') && <p className="t-caption muted">{t('setup.equipment.noBar')}</p>}
        </div>
        <div className="you__item">
          <h3 className="you__label">{t('setup.rhythm.days')}</h3>
          <ChoiceGroup
            label={t('setup.rhythm.days')}
            grid
            value={profile.daysPerWeek}
            onChange={(n: number) => void actions.saveProfile(withRhythm(profile, n, todayLocal()))}
            options={DAYS_PER_WEEK.map((n) => ({ value: n, label: String(n) }))}
          />
          <RhythmSplit days={profile.daysPerWeek} />
          <p className="t-caption muted">{t('you.rhythmHelp')}</p>
        </div>
        <div className="you__item">
          <h3 className="you__label">{t('setup.rhythm.length')}</h3>
          <ChoiceGroup
            label={t('setup.rhythm.length')}
            grid
            value={profile.sessionMinutes}
            onChange={(sessionMinutes) => save({ sessionMinutes })}
            options={SESSION_MINUTES.map((n) => ({ value: n, label: t('common.min', { n }) }))}
          />
        </div>
        <MaxField />
      </section>

      <section className="you__section" aria-labelledby="you-thoughts">
        <h2 id="you-thoughts" className="t-eyebrow">{t('you.savedThoughts')}</h2>
        <ul className="list">
          <li>
            <button type="button" className="list__row" onClick={openSavedThoughts}>
              <span className="list__main">{t('you.openFavorites')}</span>
              <span className="list__sub num">{tp('plural.favorites', data.favorites.length)}</span>
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
            </button>
          </li>
        </ul>
      </section>

      <section className="you__section" aria-labelledby="you-feedback">
        <h2 id="you-feedback" className="t-eyebrow">{t('you.feedback')}</h2>
        <Switch
          checked={vibration && canVibrate}
          onChange={(v) => void actions.saveSettings({ ...data.settings, vibration: v })}
          label={t('you.vibration')}
          description={canVibrate ? undefined : t('you.vibrationUnsupported')}
          stateLabel={t(vibration && canVibrate ? 'common.on' : 'common.off')}
        />
        <Switch
          checked={sound}
          onChange={(v) => void actions.saveSettings({ ...data.settings, sound: v })}
          label={t('you.sound')}
          stateLabel={t(sound ? 'common.on' : 'common.off')}
        />
      </section>

      <DataSection />

      <section className="you__section" aria-labelledby="you-about">
        <h2 id="you-about" className="t-eyebrow">{t('you.about')}</h2>
        <ul className="list">
          <li>
            <button type="button" className="list__row" onClick={() => navigate('welcome')}>
              <span className="list__main">{t('you.replayWelcome')}</span>
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
            </button>
          </li>
        </ul>
        <h3 className="you__label">{t('you.safety')}</h3>
        <p className="t-caption muted">{t('you.safetyText')}</p>
        <p className="t-caption faint">{t('you.offline')} · {t('you.version', { v: APP_VERSION })}</p>
      </section>
    </div>
  );
}

/** Toggles `item` and keeps the canonical order of `all`. */
function toggle<T extends string>(all: readonly T[], selected: readonly T[], item: T): T[] {
  const next = selected.includes(item) ? selected.filter((x) => x !== item) : [...selected, item];
  return all.filter((x) => next.includes(x));
}

function NameField({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const { actions } = useStore();
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);
  const commit = async () => {
    const clean = name.trim();
    if (clean === profile.name) return;
    if (await actions.saveProfile({ ...profile, name: clean })) setSaved(true);
  };
  return (
    <form className="field you__item" onSubmit={(e) => { e.preventDefault(); void commit(); }}>
      <label className="you__label" htmlFor="you-name">{t('you.name')} <span className="faint">· {t('common.optional')}</span></label>
      <input
        id="you-name"
        className="input"
        value={name}
        maxLength={40}
        autoComplete="given-name"
        enterKeyHint="done"
        onChange={(e) => { setName(e.target.value); setSaved(false); }}
        onBlur={() => void commit()}
      />
      <p className="t-caption faint" role="status">{saved ? t('common.saved') : ''}</p>
    </form>
  );
}

/** Self-reported STRICT max (guardrail 6): assisted reps never count here. */
function MaxField() {
  const { t } = useI18n();
  const { actions } = useStore();
  const history = useHistory();
  const current = useMemo(() => workingMax(history), [history]);
  const [value, setValue] = useState(current?.value ?? 0);
  const [saved, setSaved] = useState(false);
  const saveMax = async () => {
    const entry = { ...makeStamp(new Date(), currentTimeZone()), value, source: 'self' as const };
    if (await actions.addMaxEntry(entry)) setSaved(true);
  };
  return (
    <div className="you__item">
      <h3 className="you__label">{t('you.max')}</h3>
      {current && <p className="t-caption muted num" data-testid="max-current">{t('you.maxCurrent', { n: current.value, source: t(`source.${current.source}`) })}</p>}
      <Stepper
        value={value}
        onChange={(v) => { setValue(v); setSaved(false); }}
        min={0}
        max={100}
        size="md"
        label={t('you.max')}
        decreaseLabel={t('workout.less')}
        increaseLabel={t('workout.more')}
        unit={t('setup.max.unit')}
      />
      <Button variant="secondary" block disabled={saved || value === current?.value} onClick={() => void saveMax()}>
        {saved ? t('common.saved') : t('you.maxSave')}
      </Button>
      <p className="t-caption muted">{t('you.maxHelp')}</p>
    </div>
  );
}

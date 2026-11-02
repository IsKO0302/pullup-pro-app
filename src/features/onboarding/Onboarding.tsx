import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { currentTimeZone, todayLocal } from '../../app/clock';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { makeStamp } from '../../domain/time';
import { DAYS_PER_WEEK, EQUIPMENT, SESSION_MINUTES, type Equipment, type Profile, type SessionMinutes } from '../../domain/types';
import { Button, Chip, ChoiceGroup, IconButton, Stepper, cx } from '../../ui';
import { RhythmSplit } from '../common/RhythmSplit';
import { WelcomeScreen } from './WelcomeScreen';
import './onboarding.css';

type Go = (patch: Partial<Profile>) => Promise<boolean>;

/** Resumable first-launch flow: the current step is stored in profile.onboarding. */
export function Onboarding({ profile }: { profile: Profile }) {
  const { actions } = useStore();
  const go: Go = (patch) => actions.saveProfile({ ...profile, ...patch });
  switch (profile.onboarding) {
    case 'welcome':
      return <WelcomeScreen onContinue={() => void go({ onboarding: 'setup1' })} />;
    case 'setup1':
      return <SetupMax go={go} />;
    case 'setup2':
      return <SetupEquipment profile={profile} go={go} />;
    default:
      return <SetupRhythm profile={profile} go={go} />;
  }
}

function SetupFrame(props: {
  step: 1 | 2 | 3;
  title: string;
  help?: string;
  onBack?: () => void;
  onSkip: () => void;
  primary: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [props.step]);
  return (
    <main className="setup">
      <div className="setup__top">
        {props.onBack ? (
          <IconButton label={t('common.back')} onClick={props.onBack}>
            <ArrowLeft size={22} strokeWidth={1.5} aria-hidden />
          </IconButton>
        ) : (
          <span />
        )}
        <span className="t-caption setup__step">{t('setup.step', { n: props.step, total: 3 })}</span>
        <Button variant="ghost" onClick={props.onSkip}>{t('common.skip')}</Button>
      </div>
      <div className="setup__dots" aria-hidden>
        {[1, 2, 3].map((i) => <span key={i} className={cx('setup__dot', i <= props.step && 'is-on')} />)}
      </div>
      <section className="setup__body">
        <h1 className="t-h2 setup__title" tabIndex={-1} ref={titleRef}>{props.title}</h1>
        {props.help && <p className="setup__help">{props.help}</p>}
        {props.children}
      </section>
      <div className="setup__foot">
        {props.primary}
        {props.hint && <p className="t-caption setup__hint">{props.hint}</p>}
      </div>
    </main>
  );
}

function SetupMax({ go }: { go: Go }) {
  const { t } = useI18n();
  const { data, actions } = useStore();
  const previous = [...data.maxEntries].reverse().find((e) => e.source === 'setup');
  const [value, setValue] = useState(previous?.value ?? 0);
  const next = async () => {
    const entry = { ...makeStamp(new Date(), currentTimeZone()), value, source: 'setup' as const };
    const ok = await actions.saveMaxEntries([...data.maxEntries.filter((e) => e.source !== 'setup'), entry]);
    if (ok) await go({ onboarding: 'setup2' });
  };
  return (
    <SetupFrame
      step={1}
      title={t('setup.max.title')}
      help={t('setup.max.help')}
      onSkip={() => void go({ onboarding: 'setup2' })}
      hint={t('setup.defaults')}
      primary={<Button variant="primary" size="xl" block onClick={() => void next()}>{t('common.next')}</Button>}
    >
      <div className="setup__control">
        <Stepper
          value={value}
          onChange={setValue}
          min={0}
          max={30}
          label={t('setup.max.unit')}
          decreaseLabel={t('workout.less')}
          increaseLabel={t('workout.more')}
          unit={t('setup.max.unit')}
        />
        <p className="setup__note" aria-live="polite">{value === 0 ? t('setup.max.zero') : ''}</p>
      </div>
    </SetupFrame>
  );
}

const EXTRAS: readonly Equipment[] = ['dipBars', 'bands', 'rings', 'box'];

function SetupEquipment({ profile, go }: { profile: Profile; go: Go }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Equipment[]>(profile.equipment);
  const toggle = (e: Equipment) => setSelected((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));
  const nothingElse = !selected.some((e) => EXTRAS.includes(e));
  const ordered = EQUIPMENT.filter((e) => selected.includes(e));
  return (
    <SetupFrame
      step={2}
      title={t('setup.equipment.title')}
      help={t('setup.equipment.help')}
      onBack={() => void go({ onboarding: 'setup1' })}
      onSkip={() => void go({ onboarding: 'setup3' })}
      primary={<Button variant="primary" size="xl" block onClick={() => void go({ equipment: ordered, onboarding: 'setup3' })}>{t('common.next')}</Button>}
    >
      <div className="setup__control">
        <div className="chips" role="group" aria-label={t('setup.equipment.title')}>
          {EQUIPMENT.map((e) => (
            <Chip key={e} selected={selected.includes(e)} onToggle={() => toggle(e)}>{t(`equipment.${e}`)}</Chip>
          ))}
          <Chip selected={nothingElse} onToggle={() => setSelected((cur) => cur.filter((x) => x === 'bar'))}>
            {t('equipment.nothingElse')}
          </Chip>
        </div>
        <p className="setup__note" aria-live="polite">{selected.includes('bar') ? '' : t('setup.equipment.noBar')}</p>
      </div>
    </SetupFrame>
  );
}

function SetupRhythm({ profile, go }: { profile: Profile; go: Go }) {
  const { t } = useI18n();
  const [days, setDays] = useState(profile.daysPerWeek);
  const [minutes, setMinutes] = useState<SessionMinutes>(profile.sessionMinutes);
  const [name, setName] = useState(profile.name);
  const finish = async (patch: Partial<Profile>) => {
    const ok = await go({ ...patch, startDate: todayLocal(), onboarding: 'done' });
    if (ok) navigate('today', { replace: true });
  };
  return (
    <SetupFrame
      step={3}
      title={t('setup.rhythm.title')}
      onBack={() => void go({ onboarding: 'setup2' })}
      onSkip={() => void finish({})}
      primary={
        <Button variant="primary" size="xl" block glow onClick={() => void finish({ daysPerWeek: days, sessionMinutes: minutes, name: name.trim() })}>
          {t('setup.finish')}
        </Button>
      }
    >
      <div className="setup__group setup__days">
        <p className="setup__label">{t('setup.rhythm.days')}</p>
        <ChoiceGroup label={t('setup.rhythm.days')} grid value={days} onChange={setDays} options={DAYS_PER_WEEK.map((n) => ({ value: n, label: String(n) }))} />
        <RhythmSplit days={days} className="setup__split" />
      </div>
      <div className="setup__group setup__minutes">
        <p className="setup__label">{t('setup.rhythm.length')}</p>
        <ChoiceGroup label={t('setup.rhythm.length')} grid value={minutes} onChange={setMinutes} options={SESSION_MINUTES.map((n) => ({ value: n, label: t('common.min', { n }) }))} />
      </div>
      <label className="field setup__group">
        <span className="setup__label">{t('setup.rhythm.name')} <span className="faint">· {t('common.optional')}</span></span>
        <input
          className="input"
          value={name}
          maxLength={40}
          autoComplete="given-name"
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
    </SetupFrame>
  );
}

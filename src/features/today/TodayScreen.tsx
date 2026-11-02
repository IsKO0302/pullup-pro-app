import { CircleAlert, Info } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { currentTimeZone, useToday } from '../../app/clock';
import { useHistory } from '../../app/history';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { isTraining } from '../../domain/history';
import { planDay } from '../../domain/plan';
import { nextScheduled, scheduledType } from '../../domain/schedule';
import { totalsOf } from '../../domain/stats';
import { addDays, makeStamp } from '../../domain/time';
import type { Profile, Workout } from '../../domain/types';
import { trainedOn, weekStrip } from '../../domain/week';
import { Banner, Button } from '../../ui';
import { muscleList, typeDescription, typeLabel, useExerciseText } from '../common/labels';
import { useStartWorkout } from '../workout/start';
import { RestSheet } from './RestSheet';
import { WeekStrip } from './WeekStrip';
import './today.css';

export function greetingKey(hour: number): 'greet.morning' | 'greet.afternoon' | 'greet.evening' {
  if (hour >= 5 && hour < 12) return 'greet.morning';
  if (hour >= 12 && hour < 18) return 'greet.afternoon';
  return 'greet.evening';
}

const NOTE_ICON = <Info size={18} strokeWidth={1.5} aria-hidden />;

function Note({ icon = NOTE_ICON, children }: { icon?: ReactNode; children: ReactNode }) {
  return <p className="today__note">{icon}<span>{children}</span></p>;
}

export function TodayScreen() {
  const { data } = useStore();
  const profile = data.profile;
  if (!profile) return null;
  return <Today profile={profile} />;
}

function Today({ profile }: { profile: Profile }) {
  const { t, tp, date, upper } = useI18n();
  const { data, actions } = useStore();
  const history = useHistory();
  const today = useToday();
  const start = useStartWorkout();
  const text = useExerciseText();
  const [restOpen, setRestOpen] = useState(false);

  const plan = useMemo(() => planDay(profile, history, today), [profile, history, today]);
  const strip = useMemo(() => weekStrip(profile, history, today), [profile, history, today]);
  const active = data.active;
  const trained = trainedOn(history, today);
  const recovery = data.recoveryDays.find((r) => r.localDate === today) ?? null;
  const restDay = scheduledType(profile.daysPerWeek, today) === null;

  const greeting = t(greetingKey(new Date().getHours()));
  const top = (
    <p className="t-caption muted today__top">
      {date(today, { weekday: 'long', day: 'numeric', month: 'long' })} · {profile.name ? t('greet.withName', { greeting, name: profile.name }) : greeting}
    </p>
  );

  const go = (variant: 'planned' | 'short' | 'light' | 'maxTest' | 'early') => () => {
    const w = variant === 'planned' ? plan : planDay(profile, history, today, { variant });
    void start(w, variant);
  };

  const markRest = async (reason: Parameters<typeof actions.saveRecoveryDay>[0]['reason']) => {
    const stamp = makeStamp(new Date(), currentTimeZone());
    if (await actions.saveRecoveryDay({ ...stamp, localDate: today, reason })) setRestOpen(false);
  };

  let card: ReactNode;
  let primary: ReactNode;
  let secondary: ReactNode = null;

  if (trained) {
    const done = data.workouts.filter((w) => w.localDate === today && (isTraining(w) || w.type === 'recovery'));
    const totals = done.map(totalsOf);
    const sets = totals.reduce((n, x) => n + x.setsDone, 0);
    const reps = totals.reduce((n, x) => n + x.reps, 0);
    const minutes = Math.max(1, Math.round(done.reduce((n, w) => n + w.durationSec, 0) / 60));
    const tomorrow = addDays(today, 1);
    const next = scheduledType(profile.daysPerWeek, tomorrow) ? planDay(profile, history, tomorrow) : null;
    card = (
      <section className="card today__card today__card--done" aria-labelledby="today-title">
        <p className="t-eyebrow">{t('today.doneTitle')}</p>
        <h1 id="today-title" className="t-h2 today__title">{upper(typeLabel(t, done[0]!))}</h1>
        <p className="today__result num">{[tp('plural.sets', sets), reps > 0 ? tp('plural.reps', reps) : null, tp('plural.minutes', minutes)].filter(Boolean).join(' · ')}</p>
        <p className="muted">{next ? t('today.tomorrow', { name: typeLabel(t, next) }) : t('today.tomorrowRest')}</p>
      </section>
    );
    primary = active
      ? <Button variant="primary" size="xl" block onClick={() => navigate('workout')}>{t('today.continueAction')}</Button>
      : <Button variant="secondary" size="xl" block onClick={go('light')}>{t('today.trainMore')}</Button>;
    if (!active) secondary = <p className="t-caption muted today__hint">{t('today.trainMoreHint')}</p>;
  } else if (recovery) {
    card = (
      <section className="card today__card" aria-labelledby="today-title">
        <p className="t-eyebrow">{t('today.label')}</p>
        <h1 id="today-title" className="t-h2 today__title">{t('today.recoveryTitle')}</h1>
        <p className="muted">{t('today.recoveryText')}</p>
        {recovery.reason && <p className="today__tag">{t(`reason.${recovery.reason}`)}</p>}
      </section>
    );
    primary = <Button variant="secondary" size="xl" block onClick={go('light')}>{t('today.lightMobility')}</Button>;
    secondary = (
      <div className="today__links">
        <Button variant="link" onClick={() => void actions.removeRecoveryDay(today)}>{t('today.recoveryUndo')}</Button>
      </div>
    );
  } else if (restDay) {
    const next = nextScheduled(profile.daysPerWeek, today);
    card = (
      <section className="card today__card" aria-labelledby="today-title">
        <p className="t-eyebrow">{t('today.label')}</p>
        <h1 id="today-title" className="t-h2 today__title">{t('today.restPlannedTitle')}</h1>
        <p className="muted">{t('today.restPlannedText')}</p>
      </section>
    );
    primary = <Button variant="secondary" size="xl" block onClick={go('light')}>{t('today.lightMobility')}</Button>;
    secondary = next && (
      <div className="today__links">
        <Button variant="link" onClick={go('early')}>{t('today.trainAnyway', { name: typeLabel(t, { type: next.type }) })}</Button>
      </div>
    );
  } else {
    card = <WorkoutCard plan={plan} names={plan.exercises.map((e) => text(e.exerciseId).name)} />;
    primary = active
      ? <Button variant="primary" size="xl" block onClick={() => navigate('workout')}>{t('today.continueAction')}</Button>
      : <Button variant="primary" size="xl" block glow onClick={go('planned')} data-testid="start">{t('today.start')}</Button>;
    secondary = !active && (
      <div className="today__links">
        <Button variant="link" onClick={go('short')}>{t('today.short')}</Button>
        <Button variant="link" onClick={() => setRestOpen(true)}>{t('today.restInstead')}</Button>
      </div>
    );
  }

  return (
    <div className="screen-pad today">
      {top}
      {plan.flags.maxTestSuggested && !trained && !recovery && !active && (
        <Banner
          title={t('today.maxTestSuggest')}
          action={<Button variant="secondary" onClick={go('maxTest')}>{t('today.maxTestAction')}</Button>}
        />
      )}
      {card}
      <div className="today__actions">
        {primary}
        {active ? (
          <Banner
            title={t('today.continueTitle')}
            text={t('today.continueText', { name: typeLabel(t, active.plan), i: Math.min(active.exIndex + 1, active.log.length), n: active.log.length })}
          />
        ) : secondary}
      </div>
      <WeekStrip cells={strip} />
      <RestSheet open={restOpen} onClose={() => setRestOpen(false)} onConfirm={(r) => void markRest(r)} />
    </div>
  );
}

function WorkoutCard({ plan: w, names }: { plan: Workout; names: string[] }) {
  const { t, upper, lang } = useI18n();
  const shown = names.slice(0, names.length > 5 ? 4 : 5);
  return (
    <section className="card today__card" aria-labelledby="today-title">
      <p className="t-eyebrow">{t('today.label')}</p>
      <h1 id="today-title" className="t-h2 today__title">{upper(typeLabel(t, w))}</h1>
      <p className="muted">{typeDescription(t, w)}</p>
      <ul className="today__list">
        {shown.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}
        {names.length > shown.length && <li className="muted">{t('today.more', { n: names.length - shown.length })}</li>}
      </ul>
      <p className="today__meta num">
        {t('common.approxMin', { n: w.estimatedMinutes })} · {t('today.focus', { muscles: muscleList(t, w.muscles, lang) })}
      </p>
      {(w.flags.lighterWeek || w.flags.returnAfterBreak || w.flags.painRecently || w.flags.noPullEquipment) && (
        <div className="today__notes">
          {w.flags.lighterWeek && <Note>{t('today.lighterWeek')}</Note>}
          {w.flags.returnAfterBreak && <Note>{t('today.returnBreak')}</Note>}
          {w.flags.painRecently && <Note icon={<CircleAlert size={18} strokeWidth={1.5} aria-hidden />}>{t('today.painNote')}</Note>}
          {w.flags.noPullEquipment && <Note>{t('today.noPullEquipment')}</Note>}
        </div>
      )}
    </section>
  );
}

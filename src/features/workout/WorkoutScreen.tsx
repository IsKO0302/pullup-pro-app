import { Info, Pause, Repeat, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTick } from '../../app/clock';
import { useHistory } from '../../app/history';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { EXERCISE_TEXT } from '../../data/exercises';
import { buildSession } from '../../domain/plan';
import {
  adjustRest, completeSet, currentExercise, doneSetCount, endRest, finishSession, hasStarted, holdElapsedSec, isFinished,
  pause, progressOf, replacePlan, restLeftSec, resume, skipSet, startHold, stopHold, swapExercise, swapOptions, toggleWarmup,
} from '../../domain/session';
import { restThoughtId, thoughtById } from '../../domain/thoughts';
import type { ActiveSession, Profile } from '../../domain/types';
import { Button, IconButton, ProgressBar, Ring, Sheet, Stepper, Switch } from '../../ui';
import { clock, typeLabel, useExerciseText } from '../common/labels';
import { softTone, unlockAudio, useWakeLock, vibrate } from './feedback';
import { HowToSheet } from './HowToSheet';
import './workout.css';

const WARMUP = [1, 2, 3, 4, 5] as const;
type SheetName = 'howto' | 'swap' | 'exit' | 'finish' | 'discard' | null;

export function WorkoutScreen() {
  const { data } = useStore();
  const finishing = useRef(false);
  const active = data.active;
  useEffect(() => {
    if (!active && !finishing.current) navigate('today', { replace: true });
  }, [active]);
  if (!active || !data.profile) return null;
  return <Workout key={active.id} initial={active} profile={data.profile} finishing={finishing} />;
}

function Workout({ initial, profile, finishing }: { initial: ActiveSession; profile: Profile; finishing: MutableRefObject<boolean> }) {
  const { t, tp, lang, num } = useI18n();
  const { data, actions } = useStore();
  const history = useHistory();
  const text = useExerciseText();
  const [session, setSession] = useState(initial);
  const ref = useRef(initial);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'error'>('idle');
  const [announce, setAnnounce] = useState('');
  const [draft, setDraft] = useState<{ key: string; value: number } | null>(null);
  const { sound, vibration } = data.settings;
  useWakeLock(true);

  /** Every change is applied locally at once and persisted right away (state survives a reload). */
  const update = useCallback((fn: (s: ActiveSession) => ActiveSession): ActiveSession => {
    const cur = ref.current;
    const next = fn(cur);
    if (next !== cur) {
      ref.current = next;
      setSession(next);
      void actions.saveActive(next);
    }
    return next;
  }, [actions]);

  const finish = useCallback(async (s: ActiveSession) => {
    finishing.current = true;
    setSaving('saving');
    const w = finishSession(endRest(stopHold(s)), new Date());
    if (await actions.completeWorkout(w)) {
      navigate(`done/${encodeURIComponent(w.id)}`, { replace: true });
    } else {
      finishing.current = false;
      setSaving('error');
    }
  }, [actions, finishing]);

  const ex = currentExercise(session);
  const resting = session.phase === 'rest';
  const paused = session.pausedAtUtc !== null;
  const holdRunning = session.holdStartedAtUtc !== null;
  const now = new Date(useTick(250, (resting || holdRunning) && !paused));
  const left = restLeftSec(session, now);
  const lastLeft = useRef(left);

  // Rest over: one soft signal (if enabled), then straight to the next set.
  useEffect(() => {
    const was = lastLeft.current;
    lastLeft.current = left;
    if (!resting || paused) return;
    if (left === 10 && was > 10) setAnnounce(t('workout.restLeft', { n: 10 }));
    if (left > 0) return;
    if (was > 0) {
      if (vibration) vibrate([120, 80, 120]);
      if (sound) softTone();
    }
    const next = update(endRest);
    const nx = currentExercise(next);
    if (nx) setAnnounce(t('workout.restOver', { next: t('workout.next', { name: EXERCISE_TEXT[lang][nx.exerciseId].name, i: next.setIndex + 1, n: nx.plannedSets }) }));
  }, [left, resting, paused, sound, vibration, update, t, lang]);

  const pointerKey = ex ? `${session.exIndex}:${session.setIndex}:${ex.exerciseId}` : 'end';
  const value = draft && draft.key === pointerKey ? draft.value : ex?.target ?? 0;
  const setValue = (v: number) => setDraft({ key: pointerKey, value: v });
  const options = useMemo(() => swapOptions(session, profile.equipment), [session, profile.equipment]);

  if (saving !== 'idle' || isFinished(session)) {
    return (
      <div className="workout workout--center">
        {saving === 'error'
          ? <Button variant="primary" size="xl" block onClick={() => void finish(ref.current)}>{t('common.retry')}</Button>
          : <p className="muted" role="status">{t('workout.saving')}</p>}
      </div>
    );
  }
  if (!ex) return null;

  const name = text(ex.exerciseId).name;
  const seconds = ex.unit === 'seconds';
  const isTest = ex.role === 'test';
  const preStart = !hasStarted(session) && !resting;
  const training = session.plan.type !== 'light' && session.plan.type !== 'recovery';
  const lastOverall = session.exIndex === session.log.length - 1 && session.setIndex === ex.plannedSets - 1;
  const elapsedHold = holdElapsedSec(session, now);
  // Rest time is where the thoughts live: a different short one for every rest of this session.
  const restThought = resting ? thoughtById(restThoughtId(session.id, session.restCount - 1)) : null;

  const onSetDone = () => {
    if (sound) unlockAudio();
    const actual = seconds && holdRunning ? holdElapsedSec(ref.current, new Date()) : value;
    const next = update((s) => completeSet(s, actual, new Date()));
    if (vibration) vibrate(25);
    if (isFinished(next)) void finish(next);
    else if (next.phase === 'rest') setAnnounce(t('workout.restStarted', { time: tp('plural.seconds', next.restTotalSec) }));
  };
  const onSkip = () => {
    const next = update((s) => skipSet(s, new Date()));
    if (isFinished(next)) {
      if (doneSetCount(next) > 0) void finish(next);
      else setSheet('exit');
    }
  };
  const onFeelingOff = (on: boolean) => {
    // Same session type as started (the rotation already decided it), rebuilt lighter or back to normal.
    const plan = buildSession(profile, history, session.localDate, session.plan.type, { variant: session.variant, feelingOff: on });
    update((s) => replacePlan(s, plan));
  };

  return (
    <main className="workout">
      <p className="visually-hidden" aria-live="polite">{announce}</p>
      <header className="workout__top">
        <IconButton label={t('workout.exit')} onClick={() => setSheet('exit')}><X size={22} strokeWidth={1.5} aria-hidden /></IconButton>
        <p className="workout__count t-caption num">{t('workout.exercise', { i: session.exIndex + 1, n: session.log.length })}</p>
        <IconButton label={t('workout.pause')} onClick={() => update((s) => pause(s, new Date()))}><Pause size={22} strokeWidth={1.5} aria-hidden /></IconButton>
      </header>
      <ProgressBar value={progressOf(session)} label={t('workout.progress')} />

      {resting ? (
        <div className="workout__body rest">
          <h1 className="t-eyebrow">{t('workout.rest')}</h1>
          <Ring progress={session.restTotalSec > 0 ? left / session.restTotalSec : 0} label={t('workout.restLeft', { n: left })}>
            <span className="t-numeral num" aria-hidden>{clock(left)}</span>
          </Ring>
          <div className="rest__controls">
            {/* The accessible name starts with the visible text (WCAG 2.5.3), then says what it does. */}
            <Button aria-label={`${t('workout.restMinus')} (${t('workout.restMinusLabel')})`} onClick={() => update((s) => adjustRest(s, -15, new Date()))}>{t('workout.restMinus')}</Button>
            <Button aria-label={`${t('workout.restPlus')} (${t('workout.restPlusLabel')})`} onClick={() => update((s) => adjustRest(s, 15, new Date()))}>{t('workout.restPlus')}</Button>
            <Button variant="ghost" className="rest__skip" onClick={() => update(endRest)}>{t('workout.restSkip')}</Button>
          </div>
          <p className="rest__next">{t('workout.next', { name, i: session.setIndex + 1, n: ex.plannedSets })}</p>
          {restThought && <p className="rest__thought" data-thought-id={restThought.id}>{restThought.text[lang]}</p>}
        </div>
      ) : (
        <div className="workout__body">
          {preStart && training && (
            <div className="workout__prestart">
              <details className="warmup">
                <summary>
                  <span>{t('workout.warmup')}</span>
                  <span className="t-caption muted num">{t('common.fraction', { a: session.warmupDone.length, b: WARMUP.length })}</span>
                </summary>
                <ul>
                  {WARMUP.map((i) => (
                    <li key={i}>
                      <label>
                        <input type="checkbox" checked={session.warmupDone.includes(i)} onChange={() => update((s) => toggleWarmup(s, i))} />
                        <span>{t(`workout.warmup.${i}`)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
              {session.plan.type !== 'maxTest' && (
                <Switch
                  checked={session.feelingOff}
                  onChange={onFeelingOff}
                  label={t('workout.lighter')}
                  description={session.feelingOff ? t('workout.lighterOn') : undefined}
                  stateLabel={session.feelingOff ? t('common.on') : t('common.off')}
                />
              )}
            </div>
          )}

          <div className="workout__head">
            <p className="t-eyebrow num">
              {t('workout.set', { i: session.setIndex + 1, n: ex.plannedSets })}
              {lastOverall && ` · ${t('workout.lastSet')}`}
              {ex.swappedFrom && ` · ${t('workout.swapped')}`}
            </p>
            <h1 className="t-h1 workout__name">{name}</h1>
            <Button variant="link" icon={<Info size={18} strokeWidth={1.5} aria-hidden />} onClick={() => setSheet('howto')}>{t('workout.howTo')}</Button>
          </div>

          <p className="workout__target num">
            {isTest ? t('workout.testTarget') : seconds ? t('workout.targetSec', { n: ex.target }) : t('workout.targetReps', { n: ex.target })}
          </p>
          {isTest && <p className="t-caption muted workout__hint">{t('workout.testHint')}</p>}

          {seconds && holdRunning ? (
            <div className="hold" role="timer" aria-label={t('workout.secondsHeld')}>
              <output className={`stepper__value num${elapsedHold >= ex.target ? ' is-reached' : ''}`}>{elapsedHold}</output>
              <span className="stepper__unit">{t('workout.secondsHeld')}</span>
            </div>
          ) : (
            <Stepper
              value={value}
              onChange={setValue}
              min={0}
              max={seconds ? 600 : Math.max(50, ex.target * 3)}
              step={seconds ? 5 : 1}
              label={seconds ? t('workout.secondsHeld') : t('workout.repsDone')}
              decreaseLabel={seconds ? t('workout.lessSec') : t('workout.less')}
              increaseLabel={seconds ? t('workout.moreSec') : t('workout.more')}
              unit={seconds ? t('workout.secondsHeld') : t('workout.repsDone')}
              format={num}
            />
          )}

          <div className="workout__actions">
            {seconds && (holdRunning
              ? <Button block onClick={() => { setValue(holdElapsedSec(ref.current, new Date())); update(stopHold); }}>{t('workout.timerStop')}</Button>
              : <Button block onClick={() => update((s) => startHold(s, new Date()))}>{t('workout.timerStart')}</Button>)}
            <Button variant="primary" size="xl" block onClick={onSetDone} data-testid="set-done">{t('workout.setDone')}</Button>
            <div className="workout__secondary">
              <Button variant="ghost" onClick={onSkip}>{t('workout.skipSet')}</Button>
              {ex.sets.length === 0 && (
                <Button variant="ghost" icon={<Repeat size={18} strokeWidth={1.5} aria-hidden />} onClick={() => setSheet('swap')}>{t('workout.swap')}</Button>
              )}
            </div>
            {seconds && !holdRunning && <p className="t-caption muted workout__hint">{t('workout.timerHint')}</p>}
          </div>
        </div>
      )}

      {paused && (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="paused-title">
          <div className="pause-overlay__inner">
            <p id="paused-title" className="t-h1">{t('workout.paused')}</p>
            <p className="muted">{typeLabel(t, session.plan)}</p>
            <Button variant="primary" size="xl" block autoFocus onClick={() => update((s) => resume(s, new Date()))}>{t('workout.resume')}</Button>
          </div>
        </div>
      )}

      <HowToSheet id={ex.exerciseId} open={sheet === 'howto'} onClose={() => setSheet(null)} />

      <Sheet open={sheet === 'swap'} onClose={() => setSheet(null)} title={t('workout.swapTitle')} closeLabel={t('common.close')}>
        {options.length === 0 ? <p className="muted">{t('workout.swapNone')}</p> : (
          <div className="list">
            {options.map((id) => {
              const x = text(id);
              return (
                <button key={id} type="button" className="list__row" onClick={() => { update((s) => swapExercise(s, id)); setSheet(null); }}>
                  <span className="list__main">
                    <span>{x.name}</span>
                    {x.safety && <span className="list__sub">{t('workout.optional')} · {x.safety}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'exit'} onClose={() => setSheet(null)} title={t('workout.exitTitle')} closeLabel={t('common.close')}>
        <p className="muted">{t('workout.exitText')}</p>
        <div className="sheet__actions">
          <Button variant="primary" block onClick={() => navigate('today')}>{t('workout.exitSave')}</Button>
          {doneSetCount(session) > 0 && <Button block onClick={() => setSheet('finish')}>{t('workout.exitFinish')}</Button>}
          <Button variant="danger" block onClick={() => setSheet('discard')}>{t('workout.exitDiscard')}</Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'finish'} onClose={() => setSheet(null)} title={t('workout.finishTitle')} closeLabel={t('common.close')}>
        <p className="muted">{t('workout.finishText')}</p>
        <div className="sheet__actions">
          <Button variant="primary" block onClick={() => { setSheet(null); void finish(ref.current); }}>{t('workout.finishConfirm')}</Button>
          <Button block onClick={() => setSheet(null)}>{t('common.cancel')}</Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'discard'} onClose={() => setSheet(null)} title={t('workout.discardTitle')} closeLabel={t('common.close')}>
        <p className="muted">{t('workout.discardText')}</p>
        <div className="sheet__actions">
          <Button variant="danger-solid" block onClick={() => { finishing.current = true; void actions.saveActive(null).then(() => navigate('today', { replace: true })); }}>
            {t('workout.discardConfirm')}
          </Button>
          <Button block onClick={() => setSheet(null)}>{t('common.cancel')}</Button>
        </div>
      </Sheet>
    </main>
  );
}

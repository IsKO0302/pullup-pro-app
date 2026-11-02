import { Check } from 'lucide-react';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useToday } from '../../app/clock';
import { useHistory } from '../../app/history';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { byStart } from '../../domain/history';
import { muscleUpPath, pullupPath } from '../../domain/paths';
import { bestSets, maxSeries, milestones, progressTotals, rhythmWeeks } from '../../domain/progress';
import { totalsOf } from '../../domain/stats';
import type { CompletedWorkout, Profile } from '../../domain/types';
import { Button, EmptyState, cx } from '../../ui';
import { typeLabel, useExerciseText } from '../common/labels';
import { HistoryDetail } from './HistoryDetail';
import { MaxChart } from './MaxChart';
import { PathTrack } from './PathTrack';
import { RhythmGrid } from './RhythmGrid';
import './progress.css';

const PAGE = 20;
/** Remembered while the app is open, so "back" from a workout lands where you were. */
const memory = { shown: PAGE, scrollY: 0, restore: false };

export default function ProgressPage({ id }: { id?: string }) {
  const { data } = useStore();
  if (!data.profile) return null;
  if (id) return <HistoryDetail key={id} id={id} />;
  return <Progress profile={data.profile} />;
}

function Progress({ profile }: { profile: Profile }) {
  const { t, tp, num, date } = useI18n();
  const { data } = useStore();
  const history = useHistory();
  const today = useToday();
  const text = useExerciseText();
  const [shown, setShown] = useState(memory.shown);
  const [allBest, setAllBest] = useState(false);

  const totals = useMemo(() => progressTotals(history), [history]);
  const points = useMemo(() => maxSeries(history.workouts), [history.workouts]);
  const weeks = useMemo(() => rhythmWeeks(profile, history, today), [profile, history, today]);
  const best = useMemo(() => bestSets(history.workouts), [history.workouts]);
  const marks = useMemo(() => milestones(profile, history, today), [profile, history, today]);
  const pullup = useMemo(() => pullupPath(history), [history]);
  const muscleup = useMemo(() => muscleUpPath(history, profile.equipment), [history, profile.equipment]);
  const list = useMemo(() => [...data.workouts].sort(byStart).reverse(), [data.workouts]);

  useLayoutEffect(() => {
    if (memory.restore) window.scrollTo(0, memory.scrollY);
    memory.restore = false;
  }, []);

  const open = (w: CompletedWorkout) => {
    memory.scrollY = window.scrollY;
    memory.shown = shown;
    memory.restore = true;
    navigate(`progress/${encodeURIComponent(w.id)}`);
  };
  const empty = data.workouts.length === 0;
  const fullDate = (d: string) => date(d, { day: 'numeric', month: 'short', year: 'numeric' });
  const value = (unit: 'reps' | 'seconds', v: number) => (unit === 'seconds' ? t('common.sec', { n: v }) : num(v));

  return (
    <div className="screen-pad progress-page">
      <h1 className="t-h1">{t('progress.title')}</h1>

      <dl className="stat-grid stat-grid--3">
        <div className="stat-grid__item">
          <dt className="t-caption muted">{t('progress.workouts')}</dt>
          <dd className="num">{num(totals.workouts)}</dd>
        </div>
        <div className="stat-grid__item">
          <dt className="t-caption muted">{t('progress.pullups')}</dt>
          <dd className="num">{num(totals.pullups)}<span className="t-caption muted stat-grid__sub">{t('progress.pullupsCaption')}</span></dd>
        </div>
        <div className="stat-grid__item">
          <dt className="t-caption muted">{t('progress.max')}</dt>
          <dd className="num">{totals.max ? num(totals.max.value) : t('done.none')}<span className="t-caption muted stat-grid__sub">{t('progress.maxCaption')}</span></dd>
        </div>
      </dl>

      {empty && (
        <EmptyState
          title={t('progress.emptyTitle')}
          text={t('progress.empty')}
          action={<Button variant="secondary" onClick={() => navigate('today')}>{t('progress.goToday')}</Button>}
        />
      )}

      {!empty && (
        <section className="progress__section" aria-labelledby="chart-title">
          <h2 id="chart-title" className="t-eyebrow">{t('progress.chart')}</h2>
          <p className="t-caption muted progress__caption">{t('progress.chartCaption')}</p>
          <MaxChart points={points} />
        </section>
      )}

      {!empty && (
        <section className="progress__section" aria-labelledby="rhythm-title">
          <h2 id="rhythm-title" className="t-eyebrow">{t('progress.rhythm')}</h2>
          <p className="t-caption muted progress__caption">{t('progress.rhythmCaption')}</p>
          <RhythmGrid weeks={weeks} />
        </section>
      )}

      {best.length > 0 && (
        <section className="progress__section" aria-labelledby="best-title">
          <h2 id="best-title" className="t-eyebrow">{t('progress.records')}</h2>
          <p className="t-caption muted progress__caption">{t('progress.recordsCaption')}</p>
          <ul className="best">
            {(allBest ? best : best.slice(0, 6)).map((r) => (
              <li key={r.exerciseId} className="best__row">
                <span className="best__name">{text(r.exerciseId).name}</span>
                <span className="best__value num">{value(r.unit, r.value)}</span>
                <span className="t-caption muted best__date">{fullDate(r.localDate)}</span>
              </li>
            ))}
          </ul>
          {best.length > 6 && !allBest && <Button variant="link" onClick={() => setAllBest(true)}>{t('progress.showMore')}</Button>}
        </section>
      )}

      <section className="progress__section" aria-labelledby="path-title">
        <h2 id="path-title" className="t-eyebrow">{t('progress.path')}</h2>
        <PathTrack kind="pullup" state={pullup} />
        <PathTrack kind="muscleup" state={muscleup} />
        <p className="t-caption muted">{t('path.disclaimer')}</p>
      </section>

      <section className="progress__section" aria-labelledby="milestones-title">
        <h2 id="milestones-title" className="t-eyebrow">{t('progress.milestones')}</h2>
        <ul className="milestones">
          {marks.map((m) => (
            <li key={m.id} className={cx('milestone', m.reachedOn ? 'is-reached' : 'is-locked')}>
              <span className="milestone__mark" aria-hidden>{m.reachedOn && <Check size={12} strokeWidth={2.5} />}</span>
              <span className="milestone__body">
                <span className="milestone__name">{t(`milestone.${m.id}`)}</span>
                <span className="t-caption muted">
                  {m.reachedOn ? t('milestone.reached', { date: fullDate(m.reachedOn) }) : <><span className="visually-hidden">{t('milestone.locked')}. </span>{t(`milestone.${m.id}.how`)}</>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="progress__section" aria-labelledby="history-title">
        <h2 id="history-title" className="t-eyebrow">{t('progress.history')}</h2>
        {list.length === 0 ? (
          <div className="card card--flat">
            <p className="progress__empty-title">{t('progress.historyEmptyTitle')}</p>
            <p className="muted progress__empty-line">{t('progress.historyEmpty')}</p>
          </div>
        ) : (
          <ul className="journal">
            {list.slice(0, shown).map((w) => {
              const x = totalsOf(w);
              const meta = [
                tp('plural.sets', x.setsDone),
                x.reps > 0 ? tp('plural.reps', x.reps) : null,
                tp('plural.minutes', Math.max(1, Math.round(w.durationSec / 60))),
                w.mood ? t(`mood.${w.mood}`) : null,
                w.flags.feelingOff || w.flags.lighterWeek ? t('history.lighter') : null,
                w.finishedEarly ? t('history.early') : null,
              ].filter(Boolean).join(' · ');
              return (
                <li key={w.id}>
                  <button type="button" className="journal__row" onClick={() => open(w)}>
                    <span className="t-caption muted journal__date">{date(w.localDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {typeLabel(t, w)}</span>
                    {w.note && <span className="quote journal__note">{w.note}</span>}
                    <span className="t-caption muted num">{meta}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {list.length > shown && <Button variant="secondary" block onClick={() => setShown(shown + PAGE)}>{t('progress.showMore')}</Button>}
      </section>
    </div>
  );
}

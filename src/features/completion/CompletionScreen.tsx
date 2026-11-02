import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { recordsOf, totalsOf } from '../../domain/stats';
import type { CompletedWorkout, Mood } from '../../domain/types';
import { Button, Chip } from '../../ui';
import { durationText, typeLabel, useExerciseText } from '../common/labels';
import './completion.css';

const MOODS: readonly Mood[] = [1, 2, 3, 4, 5];

export function CompletionScreen({ id }: { id: string }) {
  const { data } = useStore();
  const w = data.workouts.find((x) => x.id === id) ?? null;
  useEffect(() => {
    if (!w) navigate('today', { replace: true });
  }, [w]);
  if (!w) return null;
  return <Completion key={w.id} workout={w} />;
}

/** Quiet and real: only numbers that were logged, records only when there was a previous best. */
function Completion({ workout: w }: { workout: CompletedWorkout }) {
  const { t, num, upper } = useI18n();
  const { data, actions } = useStore();
  const text = useExerciseText();
  const [note, setNote] = useState(w.note);
  const totals = useMemo(() => totalsOf(w), [w]);
  const records = useMemo(() => recordsOf(w, data.workouts, data.maxEntries), [w, data.workouts, data.maxEntries]);

  const saveNote = async () => {
    const clean = note.trim();
    if (clean !== w.note) await actions.updateWorkout({ ...w, note: clean });
  };
  const setMood = (m: Mood) => void actions.updateWorkout({ ...w, mood: w.mood === m ? null : m });
  const done = async () => {
    await saveNote();
    navigate('today', { replace: true });
  };

  const stats: { label: string; value: string; sub?: string }[] = [
    { label: t('done.duration'), value: durationText(t, w.durationSec) },
    { label: t('done.sets'), value: totals.setsDone === totals.setsPlanned ? num(totals.setsDone) : t('common.fraction', { a: totals.setsDone, b: totals.setsPlanned }) },
    { label: t('done.reps'), value: totals.reps > 0 ? num(totals.reps) : t('done.none') },
    {
      label: t('done.pullups'),
      value: totals.pullups > 0 ? num(totals.pullups) : t('done.none'),
      sub: totals.bestStrictSet > 0 ? t('done.pullupsBest', { n: totals.bestStrictSet }) : undefined,
    },
  ];
  if (totals.seconds > 0) stats.push({ label: t('done.secondsTotal'), value: t('common.sec', { n: totals.seconds }) });

  return (
    <div className="screen-pad done">
      <header className="done__head">
        <p className="t-eyebrow">{upper(typeLabel(t, w))}</p>
        <h1 className="t-h1">{t('done.title')}</h1>
        {w.finishedEarly && <p className="muted">{t('done.early')}</p>}
      </header>

      <dl className="done__stats">
        {stats.map((s) => (
          <div key={s.label} className="done__stat">
            <dt className="t-caption muted">{s.label}</dt>
            <dd className="num">{s.value}{s.sub && <span className="t-caption muted done__sub">{s.sub}</span>}</dd>
          </div>
        ))}
      </dl>

      {records.length > 0 && (
        <section className="done__records" aria-labelledby="records-title">
          <h2 id="records-title" className="t-eyebrow">{t('done.records')}</h2>
          <ul>
            {records.map((r) => (
              <li key={r.exerciseId}>
                <span>{t('done.record', { exercise: text(r.exerciseId).name, value: r.unit === 'seconds' ? t('common.sec', { n: r.value }) : num(r.value) })}</span>
                <span className="t-caption muted"> · {t('done.recordPrev', { prev: r.unit === 'seconds' ? t('common.sec', { n: r.previous }) : num(r.previous) })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <fieldset className="done__mood">
        <legend className="t-eyebrow">{t('done.mood')}</legend>
        <div className="chips">
          {MOODS.map((m) => <Chip key={m} selected={w.mood === m} onToggle={() => setMood(m)}>{t(`mood.${m}`)}</Chip>)}
        </div>
      </fieldset>

      <label className="field">
        <span className="field__label">{t('done.note')}</span>
        <input
          className="input"
          type="text"
          maxLength={140}
          value={note}
          placeholder={t('done.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => void saveNote()}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </label>

      <div className="done__actions">
        <Button variant="primary" size="xl" block onClick={() => void done()}>{t('done.finish')}</Button>
      </div>
    </div>
  );
}

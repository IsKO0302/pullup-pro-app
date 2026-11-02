import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { recordsOf } from '../../domain/stats';
import { completionThoughtId, thoughtById } from '../../domain/thoughts';
import type { CompletedWorkout, Mood } from '../../domain/types';
import { Button, Chip } from '../../ui';
import { typeLabel, useExerciseText } from '../common/labels';
import { WorkoutStats } from '../common/WorkoutStats';
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
  const { t, num, upper, lang } = useI18n();
  const { data, actions } = useStore();
  const text = useExerciseText();
  const [note, setNote] = useState(w.note);
  const records = useMemo(() => recordsOf(w, data.workouts, data.maxEntries), [w, data.workouts, data.maxEntries]);
  const thought = thoughtById(completionThoughtId(w.id));

  const saveNote = async () => {
    const clean = note.trim();
    if (clean !== w.note) await actions.updateWorkout({ ...w, note: clean });
  };
  const setMood = (m: Mood) => void actions.updateWorkout({ ...w, mood: w.mood === m ? null : m });
  const sharePoster = async (thoughtId: string) => {
    await saveNote();
    navigate(`poster/${encodeURIComponent(thoughtId)}/${encodeURIComponent(w.id)}`);
  };
  const done = async () => {
    await saveNote();
    navigate('today', { replace: true });
  };

  return (
    <div className="screen-pad done">
      <header className="done__head">
        <p className="t-eyebrow">{upper(typeLabel(t, w))}</p>
        <h1 className="t-h1">{t('done.title')}</h1>
        {w.finishedEarly && <p className="muted">{t('done.early')}</p>}
      </header>

      <WorkoutStats workout={w} />

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

      {thought && (
        <figure className="done__thought" data-thought-id={thought.id}>
          <blockquote>{thought.text[lang]}</blockquote>
          <figcaption className="originals">{t('thoughts.originals')}</figcaption>
        </figure>
      )}

      <div className="done__actions">
        <Button variant="primary" size="xl" block onClick={() => void done()}>{t('done.finish')}</Button>
        {thought && <Button variant="secondary" block onClick={() => void sharePoster(thought.id)}>{t('done.share')}</Button>}
      </div>
    </div>
  );
}

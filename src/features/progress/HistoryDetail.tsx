import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { Button, EmptyState, Sheet } from '../../ui';
import { typeLabel, useExerciseText } from '../common/labels';
import { WorkoutStats } from '../common/WorkoutStats';

function Back() {
  const { t } = useI18n();
  return (
    <Button variant="link" className="back-link" icon={<ArrowLeft size={18} strokeWidth={1.5} aria-hidden />} onClick={() => navigate('progress')}>
      {t('common.back')}
    </Button>
  );
}

/** One workout from the journal: the note first, then the sets. Deleting needs one confirmation. */
export function HistoryDetail({ id }: { id: string }) {
  const { t, num, date, upper } = useI18n();
  const { data, actions } = useStore();
  const text = useExerciseText();
  const [confirm, setConfirm] = useState(false);
  const w = data.workouts.find((x) => x.id === id);

  if (!w) {
    return (
      <div className="screen-pad progress-page">
        <Back />
        <EmptyState title={t('history.title')} text={t('history.notFound')} />
      </div>
    );
  }

  const flags = [w.flags.feelingOff || w.flags.lighterWeek ? t('history.lighter') : null, w.finishedEarly ? t('history.early') : null].filter(Boolean);
  const remove = async () => {
    if (await actions.deleteWorkout(w.id)) navigate('progress', { replace: true });
  };

  return (
    <div className="screen-pad progress-page history">
      <Back />
      <header className="history__head">
        <p className="t-eyebrow">{upper(date(w.localDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
        <h1 className="t-h1">{typeLabel(t, w)}</h1>
        {flags.length > 0 && <p className="t-caption muted">{flags.join(' · ')}</p>}
      </header>

      <section aria-label={t('history.note')}>
        {w.note ? <p className="quote quote--md history__note">{w.note}</p> : <p className="muted">{t('history.noNote')}</p>}
        {w.mood && <p className="t-caption muted">{t('history.mood', { mood: t(`mood.${w.mood}`) })}</p>}
      </section>

      <WorkoutStats workout={w} />

      <section className="progress__section" aria-labelledby="ex-title">
        <h2 id="ex-title" className="t-eyebrow">{t('history.exercises')}</h2>
        <ul className="history__exercises">
          {w.exercises.map((ex, i) => {
            const unit = (v: number) => (ex.unit === 'seconds' ? t('common.sec', { n: v }) : num(v));
            return (
              <li key={`${ex.exerciseId}-${i}`} className="history__exercise">
                <span className="history__name">
                  {text(ex.exerciseId).name}
                  {ex.swappedFrom && <span className="t-caption muted"> · {t('workout.swapped')}</span>}
                </span>
                <span className="num history__sets">
                  {ex.sets.map((s, j) => (
                    <span key={j} className={s.status === 'skipped' ? 'history__set is-skipped' : 'history__set'}>
                      {s.status === 'skipped' ? t('history.skipped') : unit(s.actual)}
                    </span>
                  ))}
                </span>
                <span className="t-caption muted">
                  {ex.role === 'test' ? t('workout.testTarget') : ex.unit === 'seconds' ? t('history.targetSec', { n: ex.target }) : t('history.target', { n: ex.target })}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Button variant="danger" block onClick={() => setConfirm(true)}>{t('history.delete')}</Button>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t('history.deleteTitle')} closeLabel={t('common.close')}>
        <p className="muted">{t('history.deleteText')}</p>
        <div className="sheet__actions">
          <Button variant="danger-solid" block onClick={() => void remove()}>{t('common.delete')}</Button>
          <Button block onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
        </div>
      </Sheet>
    </div>
  );
}

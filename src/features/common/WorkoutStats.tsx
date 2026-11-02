import { useI18n } from '../../app/i18n';
import { totalsOf } from '../../domain/stats';
import type { CompletedWorkout } from '../../domain/types';
import { durationText } from './labels';
import './common.css';

/** Real numbers of one workout: duration, sets, reps, pull-ups (best strict set), hold time. */
export function WorkoutStats({ workout: w }: { workout: CompletedWorkout }) {
  const { t, num } = useI18n();
  const totals = totalsOf(w);
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
    <dl className="stat-grid">
      {stats.map((s) => (
        <div key={s.label} className="stat-grid__item">
          <dt className="t-caption muted">{s.label}</dt>
          <dd className="num">{s.value}{s.sub && <span className="t-caption muted stat-grid__sub">{s.sub}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

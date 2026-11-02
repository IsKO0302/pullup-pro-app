import { useI18n } from '../../app/i18n';
import { rhythmSummary, type RhythmDayState, type RhythmWeek } from '../../domain/progress';
import { cx } from '../../ui';

const LEGEND: readonly RhythmDayState[] = ['done', 'recovery', 'rest', 'missed'];

/** 12 weeks × 7 days of quiet dots (same shapes as the TODAY week strip). No streaks. */
export function RhythmGrid({ weeks }: { weeks: readonly RhythmWeek[] }) {
  const { t, date } = useI18n();
  const summary = rhythmSummary(weeks);
  const short = (d: string) => date(d, { day: 'numeric', month: 'short' });
  const firstShown = weeks.find((w) => w.status !== 'none') ?? weeks[weeks.length - 1]!;
  return (
    <div className="rhythm">
      <div className="rhythm__grid">
        <ol className="rhythm__names" aria-hidden>
          {weeks[0]!.days.map((d) => <li key={d.date}>{date(d.date, { weekday: 'narrow' })}</li>)}
        </ol>
        <ol className="rhythm__weeks">
          {weeks.map((w) => {
            const counts = [
              t('progress.rhythmWeek', { done: w.done, planned: w.planned }),
              w.recoveryPlanned > 0 ? t('progress.rhythmRecovery', { done: w.recoveryDone, planned: w.recoveryPlanned }) : null,
              w.restChosen > 0 ? t('progress.rhythmRest', { n: w.restChosen }) : null,
            ].filter(Boolean).join(' · ');
            const label = w.status === 'none'
              ? `${t('progress.weekOf', { date: short(w.start) })}: —`
              : `${t('progress.weekOf', { date: short(w.start) })}${w.status === 'current' ? ` (${t('progress.thisWeek')})` : ''}: ${counts}`;
            return (
              <li key={w.start} className={cx('rhythm__week', w.status === 'current' && 'is-current')} aria-label={label} title={label} data-status={w.status}>
                {w.days.map((d) => <span key={d.date} className={cx('week__dot', `week__dot--${d.state === 'today' ? 'planned' : d.state}`)} aria-hidden />)}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="rhythm__axis t-caption muted" aria-hidden>
        <span>{short(firstShown.start)}</span>
        <span>{t('progress.thisWeek')}</span>
      </div>
      {summary.weeks > 0 && <p className="rhythm__summary num">{t('progress.rhythmSummary', { n: summary.onPlan, m: summary.weeks })}</p>}
      <ul className="rhythm__legend t-caption muted">
        {LEGEND.map((s) => (
          <li key={s}><span className={cx('week__dot', `week__dot--${s}`)} aria-hidden />{t(`day.${s as 'done'}`)}</li>
        ))}
      </ul>
    </div>
  );
}

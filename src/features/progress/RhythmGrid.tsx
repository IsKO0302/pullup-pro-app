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
            const counts = w.recovery > 0
              ? t('progress.rhythmWeekRecovery', { done: w.done, planned: w.planned, r: w.recovery })
              : t('progress.rhythmWeek', { done: w.done, planned: w.planned });
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

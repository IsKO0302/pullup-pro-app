import { useI18n } from '../../app/i18n';
import type { DayCell } from '../../domain/week';
import { cx } from '../../ui';

/** Seven dots, Monday first. Shape + label carry the meaning, not colour alone. No streaks. */
export function WeekStrip({ cells }: { cells: readonly DayCell[] }) {
  const { t, date } = useI18n();
  return (
    <section className="week" aria-labelledby="week-title">
      <h2 id="week-title" className="t-eyebrow">{t('today.week')}</h2>
      <ol className="week__days">
        {cells.map((c) => {
          const label = t('day.label', { day: date(c.date, { weekday: 'long' }), state: t(`day.${c.state}`) });
          return (
            <li key={c.date} className={cx('week__day', c.isToday && 'is-today')} aria-label={label} title={label} data-state={c.state}>
              <span className={cx('week__dot', `week__dot--${c.state}`)} aria-hidden />
              <span className="week__name" aria-hidden>{date(c.date, { weekday: 'narrow' })}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

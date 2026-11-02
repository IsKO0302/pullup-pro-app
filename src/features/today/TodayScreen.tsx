import { useI18n } from '../../app/i18n';
import { useToday } from '../../app/clock';
import { useStore } from '../../app/store';

export function greetingKey(hour: number): 'greet.morning' | 'greet.afternoon' | 'greet.evening' {
  if (hour >= 5 && hour < 12) return 'greet.morning';
  if (hour >= 12 && hour < 18) return 'greet.afternoon';
  return 'greet.evening';
}

/** Phase 2 placeholder; the full TODAY screen arrives with the engine (phase 3/4). */
export function TodayScreen() {
  const { t, date } = useI18n();
  const { data } = useStore();
  const today = useToday();
  const greeting = t(greetingKey(new Date().getHours()));
  const name = data.profile?.name;
  return (
    <div className="screen-pad">
      <p className="t-caption muted">
        {date(today, { weekday: 'long', day: 'numeric', month: 'long' })} · {name ? t('greet.withName', { greeting, name }) : greeting}
      </p>
      <h1 className="t-h1">{t('today.label')}</h1>
    </div>
  );
}

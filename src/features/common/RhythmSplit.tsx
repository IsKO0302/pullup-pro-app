import { useI18n } from '../../app/i18n';
import { weekTargets } from '../../domain/schedule';
import { cx } from '../../ui';

/** "4 training sessions + 1 recovery day": what an active-days setting means (D54). */
export function RhythmSplit({ days, className }: { days: number; className?: string }) {
  const { t, tp } = useI18n();
  const { training, recovery } = weekTargets(days);
  const sessions = tp('plural.trainingSessions', training);
  return (
    <p className={cx('t-caption muted', className)} aria-live="polite" data-testid="rhythm-split">
      {recovery > 0 ? t('setup.rhythm.split', { training: sessions, recovery: tp('plural.recoveryDays', recovery) }) : sessions}
    </p>
  );
}

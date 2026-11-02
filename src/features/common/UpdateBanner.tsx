import { RefreshCw } from 'lucide-react';
import { useI18n } from '../../app/i18n';
import { applyUpdate, useUpdateReady } from '../../app/pwa';
import { useStore } from '../../app/store';
import { Banner, Button } from '../../ui';

/**
 * A downloaded new version. Never shown during a workout: with an active
 * session TODAY shows nothing and YOU explains that the update waits.
 */
export function UpdateBanner({ explainWait = false }: { explainWait?: boolean }) {
  const { t } = useI18n();
  const { data } = useStore();
  const ready = useUpdateReady();
  if (!ready) return null;
  if (data.active) return explainWait ? <p className="t-caption muted" data-testid="update-waits">{t('you.updateBlocked')}</p> : null;
  return (
    <Banner
      stack
      role="status"
      testId="update-ready"
      icon={<RefreshCw size={20} strokeWidth={1.5} />}
      title={t('you.updateTitle')}
      text={t('you.updateText')}
      action={<div className="banner__actions"><Button variant="secondary" onClick={() => void applyUpdate(data.active)}>{t('you.updateAction')}</Button></div>}
    />
  );
}

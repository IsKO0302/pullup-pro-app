import { Archive } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../app/i18n';
import { useStore } from '../../app/store';
import { backupReminderDue } from '../../domain/backup';
import { Banner, Button } from '../../ui';
import { downloadExport } from './exportData';

/** "Back up your data" — about every 30 days, on TODAY and YOU only, dismissible. */
export function BackupReminder() {
  const { t } = useI18n();
  const { data, actions } = useStore();
  const [done, setDone] = useState(false);
  const due = backupReminderDue(data.meta, data.workouts[0]?.completedAtUtc ?? null, new Date());
  if (done) return <p className="t-caption muted" role="status">{t('you.exportDone')}</p>;
  if (!due) return null;
  const exportNow = async () => {
    const at = downloadExport(data);
    if (await actions.saveMeta({ lastExportAtUtc: at })) setDone(true);
  };
  return (
    <Banner
      stack
      testId="backup-reminder"
      icon={<Archive size={20} strokeWidth={1.5} />}
      title={t('today.backupTitle')}
      text={t('today.backupText')}
      action={
        <div className="banner__actions">
          <Button variant="secondary" onClick={() => void exportNow()}>{t('today.backupAction')}</Button>
          <Button variant="ghost" onClick={() => void actions.saveMeta({ reminderDismissedAtUtc: new Date().toISOString() })}>{t('common.later')}</Button>
        </div>
      }
    />
  );
}

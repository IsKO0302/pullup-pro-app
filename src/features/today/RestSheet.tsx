import { useState } from 'react';
import { useI18n } from '../../app/i18n';
import { RECOVERY_REASONS, type RecoveryReason } from '../../domain/types';
import { Button, Chip, Sheet } from '../../ui';

/** "Rest today instead": one calm sheet, optional reason, no penalty. */
export function RestSheet({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: RecoveryReason | null) => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState<RecoveryReason | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title={t('today.restTitle')} closeLabel={t('common.close')}>
      <p className="muted">{t('today.restText')}</p>
      <fieldset className="rest-sheet__reasons">
        <legend className="t-caption muted">{t('today.recoveryReason')}</legend>
        <div className="chips">
          {RECOVERY_REASONS.map((r) => (
            <Chip key={r} selected={reason === r} onToggle={() => setReason(reason === r ? null : r)}>{t(`reason.${r}`)}</Chip>
          ))}
        </div>
      </fieldset>
      <Button variant="primary" block onClick={() => onConfirm(reason)}>{t('today.restConfirm')}</Button>
    </Sheet>
  );
}

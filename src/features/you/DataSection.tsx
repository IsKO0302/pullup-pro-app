import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { checkPersistence, requestPersistence } from '../../storage/persist';
import { parseSnapshot, replaceWith, resetData } from '../../storage/importFile';
import type { SnapshotInfo } from '../../storage/repo';
import { Button, Sheet } from '../../ui';
import { BackupReminder } from '../common/BackupReminder';
import { downloadExport } from '../common/exportData';
import ImportSheet from './ImportSheet';

type Status = { tone: 'ok' | 'error'; text: string } | null;

/** YOU → Data: export, import, snapshots, storage protection, reset (double confirmation). */
export function DataSection() {
  const { t, tp, locale } = useI18n();
  const { data, actions } = useStore();
  const [status, setStatus] = useState<Status>(null);
  const [file, setFile] = useState<File | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [restoring, setRestoring] = useState<SnapshotInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const when = (atUtc: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(atUtc));

  const refresh = useCallback(() => {
    void actions.listSnapshots().then(setSnapshots);
  }, [actions]);
  useEffect(() => { refresh(); }, [refresh]);

  // Keep the shown protection status honest: the browser may grant it later (e.g. after installing).
  const persist = data.meta.persist;
  useEffect(() => {
    void checkPersistence().then((now) => {
      if (now === 'granted' && persist !== 'granted') void actions.saveMeta({ persist: 'granted' });
      if (now === 'unsupported' && persist !== 'unsupported') void actions.saveMeta({ persist: 'unsupported' });
    });
  }, [persist, actions]);

  const exportNow = async () => {
    try {
      const at = downloadExport(data);
      if (await actions.saveMeta({ lastExportAtUtc: at })) setStatus({ tone: 'ok', text: t('you.exportDone') });
    } catch (err) {
      setStatus({ tone: 'error', text: t('you.exportError', { detail: err instanceof Error ? err.message : String(err) }) });
    }
  };

  const reset = async () => {
    setBusy(true);
    const res = await actions.applyData('preReset', resetData);
    setBusy(false);
    setResetStep(0);
    if (res.ok) navigate('today', { replace: true });
    else setStatus({ tone: 'error', text: t('you.resetError') });
  };

  const restore = async (info: SnapshotInfo) => {
    setBusy(true);
    const snapshot = await actions.getSnapshot(info.id);
    const parsed = snapshot ? parseSnapshot(snapshot) : null;
    const res = parsed?.ok ? await actions.applyData('preRestore', (current) => replaceWith(current, parsed.file.data)) : null;
    setBusy(false);
    setRestoring(null);
    setStatus(res?.ok ? { tone: 'ok', text: t('you.restoreDone') } : { tone: 'error', text: t('you.restoreError') });
    refresh();
  };

  const persistText = persist === 'granted' ? t('you.persistGranted')
    : persist === 'denied' ? t('you.persistDenied')
      : persist === 'unsupported' ? t('you.persistUnsupported') : t('you.persistUnknown');

  return (
    <section className="you__section" aria-labelledby="you-data">
      <h2 id="you-data" className="t-eyebrow">{t('you.data')}</h2>
      <BackupReminder />

      <p className="t-caption muted" data-testid="persist-status">
        {persistText}
        {persist === 'denied' && (
          <>
            {' '}
            <Button variant="link" onClick={() => void requestPersistence().then((p) => actions.saveMeta({ persist: p }))}>{t('you.persistAsk')}</Button>
          </>
        )}
      </p>

      <div className="you__item">
        <Button variant="secondary" block onClick={() => void exportNow()}>{t('you.export')}</Button>
        <p className="t-caption muted">{t('you.exportHelp')}</p>
        <p className="t-caption faint" data-testid="last-export">
          {data.meta.lastExportAtUtc ? t('you.lastExport', { date: when(data.meta.lastExportAtUtc) }) : t('you.noExport')}
        </p>
      </div>

      <div className="you__item">
        <Button variant="secondary" block onClick={() => input.current?.click()}>{t('you.import')}</Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="import-input"
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            e.target.value = '';
            setStatus(null);
            setFile(chosen);
          }}
        />
        <p className="t-caption muted">{t('you.importHelp')}</p>
      </div>

      {status && (
        <p className={status.tone === 'error' ? 'you__status you__status--error' : 'you__status'} role={status.tone === 'error' ? 'alert' : 'status'} data-testid="data-status">
          {status.text}
        </p>
      )}

      {snapshots.length > 0 && (
        <div className="you__item">
          <h3 className="you__label">{t('you.snapshots')}</h3>
          <p className="t-caption muted">{t('you.snapshotsHelp')}</p>
          <ul className="list" data-testid="snapshots">
            {snapshots.map((s) => (
              <li key={s.id} className="list__row">
                <span className="list__main list__sub">
                  {t('you.snapshot', { reason: t(`snapshot.${s.reason}`), date: when(s.atUtc), workouts: tp('plural.workouts', s.workouts) })}
                </span>
                <Button variant="ghost" onClick={() => setRestoring(s)}>{t('you.snapshotRestore')}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="you__item">
        <Button variant="danger" block onClick={() => setResetStep(1)}>{t('you.reset')}</Button>
        <p className="t-caption muted">{t('you.resetHelp')}</p>
      </div>

      {file && (
        <ImportSheet
          file={file}
          onClose={() => setFile(null)}
          onDone={(workouts) => {
            setFile(null);
            setStatus({ tone: 'ok', text: t('you.importDone', { workouts: tp('plural.workouts', workouts) }) });
            refresh();
          }}
        />
      )}

      <Sheet open={resetStep === 1} onClose={() => setResetStep(0)} title={t('you.reset1Title')} closeLabel={t('common.close')}>
        <p className="muted">{t('you.reset1Text')}</p>
        <div className="sheet__actions">
          <Button variant="secondary" block onClick={() => void exportNow()}>{t('you.export')}</Button>
          <Button variant="danger" block onClick={() => setResetStep(2)}>{t('you.reset1Confirm')}</Button>
          <Button variant="ghost" block onClick={() => setResetStep(0)}>{t('common.cancel')}</Button>
        </div>
      </Sheet>
      <Sheet open={resetStep === 2} onClose={() => setResetStep(0)} title={t('you.reset2Title')} closeLabel={t('common.close')}>
        <p className="muted">{t('you.reset2Text', { workouts: tp('plural.workouts', data.workouts.length) })}</p>
        <div className="sheet__actions">
          <Button variant="danger-solid" block disabled={busy} onClick={() => void reset()}>{t('you.reset2Confirm')}</Button>
          <Button variant="ghost" block onClick={() => setResetStep(0)}>{t('common.cancel')}</Button>
        </div>
      </Sheet>
      <Sheet open={restoring !== null} onClose={() => setRestoring(null)} title={t('you.restoreTitle')} closeLabel={t('common.close')}>
        {restoring && (
          <p className="muted">
            {t('you.snapshot', { reason: t(`snapshot.${restoring.reason}`), date: when(restoring.atUtc), workouts: tp('plural.workouts', restoring.workouts) })}
          </p>
        )}
        <p className="muted">{t('you.restoreText')}</p>
        <div className="sheet__actions">
          <Button variant="primary" block disabled={busy} onClick={() => restoring && void restore(restoring)}>{t('you.snapshotRestore')}</Button>
          <Button variant="ghost" block onClick={() => setRestoring(null)}>{t('common.cancel')}</Button>
        </div>
      </Sheet>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useI18n } from '../../app/i18n';
import { useStore } from '../../app/store';
import type { ExportFile } from '../../storage/exportFile';
import { mergeInto, newWorkoutsIn, parseExport, replaceWith, type ImportErrorCode, type ImportMode } from '../../storage/importFile';
import { Button, Sheet } from '../../ui';

type State =
  | { kind: 'reading' }
  | { kind: 'error'; code: ImportErrorCode | 'write'; detail: string }
  | { kind: 'ready'; file: ExportFile }
  | { kind: 'saving'; file: ExportFile };

/**
 * Import flow: read → validate (nothing written) → preview with counts →
 * merge or replace. The store snapshots the current data first, in the same
 * transaction. Any failure leaves the data exactly as it was.
 */
export default function ImportSheet({ file, onClose, onDone }: { file: File; onClose: () => void; onDone: (workouts: number) => void }) {
  const { t, tp, date } = useI18n();
  const { data, actions } = useStore();
  const [state, setState] = useState<State>({ kind: 'reading' });

  useEffect(() => {
    let alive = true;
    file.text().then(
      (raw) => {
        if (!alive) return;
        const res = parseExport(raw);
        setState(res.ok ? { kind: 'ready', file: res.file } : { kind: 'error', code: res.code, detail: res.detail });
      },
      () => { if (alive) setState({ kind: 'error', code: 'notJson', detail: '' }); },
    );
    return () => { alive = false; };
  }, [file]);

  const hasData = data.workouts.length > 0 || data.profile?.onboarding === 'done';

  const apply = async (f: ExportFile, mode: ImportMode) => {
    setState({ kind: 'saving', file: f });
    const res = await actions.applyData('preImport', (current) => (mode === 'merge' ? mergeInto(current, f.data) : replaceWith(current, f.data)));
    if (res.ok) onDone(res.data.workouts.length);
    else setState({ kind: 'error', code: 'write', detail: res.detail });
  };

  let body;
  if (state.kind === 'reading') {
    body = <p className="muted" role="status">{t('you.importReading')}</p>;
  } else if (state.kind === 'error') {
    body = (
      <>
        <p role="alert" data-testid="import-error">
          {t('you.importError', { reason: state.code === 'invalid' ? t('importError.invalid', { detail: state.detail }) : t(`importError.${state.code}`) })}
        </p>
        <div className="sheet__actions">
          <Button variant="secondary" block onClick={onClose}>{t('common.close')}</Button>
        </div>
      </>
    );
  } else {
    const f = state.file;
    const s = f.summary;
    const busy = state.kind === 'saving';
    body = (
      <>
        <p data-testid="import-preview">
          {t('you.importPreview', {
            workouts: tp('plural.workouts', s.workouts),
            notes: tp('plural.notes', s.notes),
            favorites: tp('plural.favorites', s.favorites),
            date: date(f.exportedLocalDate, { day: 'numeric', month: 'long', year: 'numeric' }),
          })}
        </p>
        {hasData ? (
          <div className="you__choices">
            <div className="you__choice">
              <Button variant="primary" block disabled={busy} onClick={() => void apply(f, 'merge')}>{t('you.importMerge')}</Button>
              <p className="t-caption muted">{t('you.importMergeHelp', { workouts: tp('plural.workouts', newWorkoutsIn(data, f.data)) })}</p>
            </div>
            <div className="you__choice">
              <Button variant="secondary" block disabled={busy} onClick={() => void apply(f, 'replace')}>{t('you.importReplace')}</Button>
              <p className="t-caption muted">{t('you.importReplaceHelp')}</p>
            </div>
            <p className="t-caption faint">{t('you.restoreText')}</p>
          </div>
        ) : (
          <div className="sheet__actions">
            <Button variant="primary" block disabled={busy} onClick={() => void apply(f, 'replace')}>{t('you.importRestore')}</Button>
          </div>
        )}
      </>
    );
  }

  return (
    <Sheet open onClose={onClose} title={state.kind === 'error' ? t('you.import') : t('you.importTitle')} closeLabel={t('common.close')}>
      {body}
    </Sheet>
  );
}

import { ArrowRight } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { currentTimeZone } from '../../app/clock';
import { storeLang } from '../../app/config';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { LANGUAGE_NAMES, LANGUAGE_PICKER_LABEL } from '../../data/i18n';
import { localDateOf } from '../../domain/time';
import { LANGS, type Lang, type Profile } from '../../domain/types';
import type { SnapshotInfo } from '../../storage/repo';
import { Button } from '../../ui';
import './onboarding.css';

// Only loaded when someone restores data on a fresh start.
const ImportSheet = lazy(() => import('../you/ImportSheet'));

export function newProfile(lang: Lang, now: Date): Profile {
  return {
    name: '',
    lang,
    equipment: ['bar'],
    daysPerWeek: 4,
    sessionMinutes: 30,
    goals: [],
    startDate: localDateOf(now, currentTimeZone()),
    createdAtUtc: now.toISOString(),
    onboarding: 'welcome',
  };
}

/** Language-neutral first screen: three text options, no flags. Quiet ways back to existing data below. */
export function LanguageScreen() {
  const { actions } = useStore();
  const pick = (lang: Lang) => {
    storeLang(lang);
    void actions.saveProfile(newProfile(lang, new Date()));
  };
  return (
    <main className="lang">
      <p className="t-eyebrow lang__brand">PULLUP PRO</p>
      <h1 className="lang__title" id="lang-title">{LANGUAGE_PICKER_LABEL}</h1>
      <div className="lang__options" role="group" aria-labelledby="lang-title">
        {LANGS.map((l) => (
          <button key={l} type="button" lang={l} className="lang__option" onClick={() => pick(l)}>
            <span>{LANGUAGE_NAMES[l]}</span>
            <ArrowRight size={20} strokeWidth={1.5} aria-hidden />
          </button>
        ))}
      </div>
      <RestoreLinks />
    </main>
  );
}

/** New phone: restore from a file. Right after a reset: undo it from the automatic snapshot. */
function RestoreLinks() {
  const { t, date } = useI18n();
  const { actions } = useStore();
  const [undo, setUndo] = useState<SnapshotInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void actions.listSnapshots().then((list) => {
      if (alive) setUndo(list[0]?.reason === 'preReset' ? list[0] : null);
    });
    return () => { alive = false; };
  }, [actions]);

  const undoReset = async (info: SnapshotInfo) => {
    const [{ parseSnapshot, replaceWith }, snapshot] = await Promise.all([import('../../storage/importFile'), actions.getSnapshot(info.id)]);
    const parsed = snapshot ? parseSnapshot(snapshot) : null;
    const res = parsed?.ok ? await actions.applyData('preRestore', (current) => replaceWith(current, parsed.file.data)) : null;
    if (res?.ok) navigate('today', { replace: true });
    else setFailed(true);
  };

  return (
    <div className="lang__restore">
      {undo && (
        <Button variant="link" onClick={() => void undoReset(undo)}>
          {t('you.undoReset', { date: date(localDateOf(new Date(undo.atUtc), currentTimeZone()), { day: 'numeric', month: 'long' }) })}
        </Button>
      )}
      <Button variant="link" onClick={() => input.current?.click()}>{t('you.restoreFromFile')}</Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="restore-input"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      {failed && <p className="t-caption" role="alert">{t('you.restoreError')}</p>}
      {file && (
        <Suspense fallback={null}>
          <ImportSheet file={file} onClose={() => setFile(null)} onDone={() => navigate('today', { replace: true })} />
        </Suspense>
      )}
    </div>
  );
}

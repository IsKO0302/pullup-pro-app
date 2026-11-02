import { useI18n } from '../../app/i18n';
import { EXERCISES } from '../../data/exercises';
import type { ExerciseId } from '../../domain/types';
import { Sheet } from '../../ui';
import { useExerciseText } from '../common/labels';

/** 3 cues + 1 common mistake + easier/harder + safety. General guidance only (D15). */
export function HowToSheet({ id, open, onClose }: { id: ExerciseId; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const text = useExerciseText();
  const x = text(id);
  const def = EXERCISES[id];
  const names = (ids: readonly ExerciseId[]) => (ids.length ? ids.map((i) => text(i).name).join(' · ') : t('howto.none'));
  return (
    <Sheet open={open} onClose={onClose} title={t('howto.title', { name: x.name })} closeLabel={t('common.close')}>
      <div className="howto">
        <h3 className="t-eyebrow">{t('howto.cues')}</h3>
        <ol className="howto__cues">{x.cues.map((c) => <li key={c}>{c}</li>)}</ol>
        <h3 className="t-eyebrow">{t('howto.mistake')}</h3>
        <p>{x.mistake}</p>
        <div className="howto__pair">
          <div><h3 className="t-eyebrow">{t('howto.easier')}</h3><p>{names(def.easier)}</p></div>
          <div><h3 className="t-eyebrow">{t('howto.harder')}</h3><p>{names(def.harder)}</p></div>
        </div>
        {x.safety && (<><h3 className="t-eyebrow">{t('howto.safety')}</h3><p>{x.safety}</p></>)}
        <p className="t-caption muted howto__general">{t('howto.general')} {t('safety.short')}</p>
      </div>
    </Sheet>
  );
}

import { useI18n } from '../../app/i18n';
import type { PathState } from '../../domain/paths';
import { cx } from '../../ui';

const STAGES = [1, 2, 3, 4, 5, 6] as const;

/** Six stages in a row; the current one is marked by shape and text, not colour alone. */
export function PathTrack({ kind, state }: { kind: 'pullup' | 'muscleup'; state: PathState }) {
  const { t } = useI18n();
  const name = (i: number) => t(`path.${kind}.${i as 1}`);
  const titleId = `path-${kind}`;
  return (
    <div className="path" aria-labelledby={titleId}>
      <div className="path__head">
        <h3 id={titleId} className="path__title">{t(`path.${kind}`)}</h3>
        <span className="t-caption muted num">{t('path.stageOf', { i: state.stage, n: STAGES.length })}</span>
      </div>
      <ol className="path__stages">
        {STAGES.map((i) => {
          const done = state.complete || i < state.stage;
          const current = !state.complete && i === state.stage;
          return (
            <li key={i} className={cx('path__stage', done && 'is-done', current && 'is-current')} aria-current={current ? 'step' : undefined}>
              <span className="visually-hidden">{name(i)}</span>
            </li>
          );
        })}
      </ol>
      <p className="path__current">{t('path.current', { name: name(state.stage) })}</p>
      <p className="muted path__next">{state.complete ? t(`path.${kind}.complete`) : t(`path.${kind}.next.${state.stage as 1}`)}</p>
    </div>
  );
}

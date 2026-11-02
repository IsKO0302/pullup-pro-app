import { ArrowLeft, Download, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { totalsOf } from '../../domain/stats';
import { thoughtById } from '../../domain/thoughts';
import type { CompletedWorkout, Thought } from '../../domain/types';
import { Button, ChoiceGroup, EmptyState, Switch } from '../../ui';
import { drawPoster, ensureFonts, posterFileName, toPngBlob, type PosterSpec } from './draw';
import { FRAMES, POSTER_FORMATS, POSTER_STYLES, type FitResult, type PosterFormat, type PosterStyle } from './layout';
import './poster.css';

/** Last choices, kept while the app is open. */
const memory: { style: PosterStyle; format: PosterFormat } = { style: 'pureBlack', format: '9:16' };

type Status = 'idle' | 'preparing' | 'saved' | 'shared' | 'error';

function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' });
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function PosterPage({ thoughtId, workoutId }: { thoughtId?: string; workoutId?: string }) {
  const { t } = useI18n();
  const { data } = useStore();
  const thought = thoughtById(thoughtId);
  const workout = workoutId ? data.workouts.find((w) => w.id === workoutId) ?? null : null;
  const back = () => navigate(workoutId ? `done/${encodeURIComponent(workoutId)}` : thought ? `thoughts/${encodeURIComponent(thought.id)}` : 'thoughts', { replace: true });
  if (!thought) {
    return (
      <div className="screen-pad poster-page">
        <BackLink onClick={back} />
        <EmptyState title={t('poster.title')} text={t('thoughts.notFound')} />
      </div>
    );
  }
  return <Poster thought={thought} workout={workout} onBack={back} />;
}

function BackLink({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return <Button variant="link" className="back-link" icon={<ArrowLeft size={18} strokeWidth={1.5} aria-hidden />} onClick={onClick}>{t('common.back')}</Button>;
}

function Poster({ thought, workout, onBack }: { thought: Thought; workout: CompletedWorkout | null; onBack: () => void }) {
  const { t, tp, lang, date, upper } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<PosterStyle>(memory.style);
  const [format, setFormat] = useState<PosterFormat>(memory.format);
  const [withResult, setWithResult] = useState(true);
  const [fit, setFit] = useState<FitResult | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const share = useMemo(canShareFiles, []);

  // Only real numbers: the date and what was actually logged.
  const caption = useMemo(() => {
    if (!workout || !withResult) return null;
    const x = totalsOf(workout);
    const result = x.pullups > 0 ? tp('plural.pullups', x.pullups) : x.reps > 0 ? tp('plural.reps', x.reps) : tp('plural.minutes', Math.max(1, Math.round(workout.durationSec / 60)));
    return upper(`${date(workout.localDate, { day: 'numeric', month: 'long', year: 'numeric' })} · ${result}`);
  }, [workout, withResult, tp, date, upper]);

  const spec: PosterSpec = useMemo(() => ({
    text: thought.text[lang], lang, reflection: thought.format === 'reflection', style, format, mark: 'PULLUP PRO', caption,
  }), [thought, lang, style, format, caption]);

  useEffect(() => {
    let cancelled = false;
    setFit(null);
    ensureFonts(spec)
      .then(() => {
        if (!cancelled && canvas.current) setFit(drawPoster(canvas.current, spec));
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [spec]);

  const chooseStyle = (s: PosterStyle) => {
    setStyle(s);
    memory.style = s;
    setStatus('idle');
  };
  const chooseFormat = (f: PosterFormat) => {
    setFormat(f);
    memory.format = f;
    setStatus('idle');
  };

  const exportImage = async () => {
    const el = canvas.current;
    if (!el || !fit) return;
    setStatus('preparing');
    try {
      const blob = await toPngBlob(el);
      const name = posterFileName(thought.id, style, format);
      if (share) {
        try {
          await navigator.share({ files: [new File([blob], name, { type: 'image/png' })] });
          setStatus('shared');
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            setStatus('idle');
            return;
          }
          // Sharing failed for another reason: fall back to saving the file.
        }
      }
      download(blob, name);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const f = FRAMES[format];
  const message = status === 'preparing' ? t('poster.preparing') : status === 'saved' ? t('poster.ready') : status === 'shared' ? t('poster.shared') : status === 'error' ? t('poster.error') : '';

  return (
    <div className="screen-pad poster-page">
      <BackLink onClick={onBack} />
      <h1 className="visually-hidden">{t('poster.title')}</h1>
      <div className="poster-page__stage">
        <canvas
          ref={canvas}
          className="poster-page__canvas"
          style={{ aspectRatio: `${f.w} / ${f.h}` }}
          role="img"
          aria-label={`${t('poster.preview')}: ${thought.text[lang]}`}
          data-ready={fit ? 'true' : 'false'}
          data-overflow={fit ? String(fit.overflow) : undefined}
          data-font-size={fit?.fontSize}
          data-lines={fit?.lines.length}
          data-width={fit ? Math.ceil(fit.width) : undefined}
          data-style={style}
          data-format={format}
          data-caption={caption ?? ''}
        />
      </div>
      <div className="poster-page__controls">
        <ChoiceGroup
          label={t('poster.style')}
          options={POSTER_STYLES.map((s) => ({ value: s, label: t(`poster.${s}`) }))}
          value={style}
          onChange={chooseStyle}
        />
        <ChoiceGroup
          label={t('poster.format')}
          options={POSTER_FORMATS.map((x) => ({ value: x, label: t(x === '9:16' ? 'poster.formatStory' : 'poster.formatPost') }))}
          value={format}
          onChange={chooseFormat}
        />
        {workout && (
          <Switch checked={withResult} onChange={setWithResult} label={t('poster.withResult')} stateLabel={withResult ? t('common.on') : t('common.off')} />
        )}
      </div>
      <div className="poster-page__actions">
        <Button
          variant="primary"
          size="xl"
          block
          disabled={!fit || status === 'preparing'}
          icon={share ? <Share2 size={20} strokeWidth={1.75} aria-hidden /> : <Download size={20} strokeWidth={1.75} aria-hidden />}
          onClick={() => void exportImage()}
        >
          {share ? t('poster.share') : t('poster.download')}
        </Button>
        <p className={`t-caption poster-page__status${status === 'error' ? ' is-error' : ''}`} role="status">{message}</p>
      </div>
    </div>
  );
}

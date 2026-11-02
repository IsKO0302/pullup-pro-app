import { ArrowLeft, Heart, Image, Share2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { pushRecent, thoughtById, toggleFavorite } from '../../domain/thoughts';
import type { Thought } from '../../domain/types';
import { Button, EmptyState, IconButton } from '../../ui';
import { useThoughtOfDay } from './daily';

function Back() {
  const { t } = useI18n();
  return (
    <Button variant="link" className="back-link" icon={<ArrowLeft size={18} strokeWidth={1.5} aria-hidden />} onClick={() => navigate('thoughts')}>
      {t('common.back')}
    </Button>
  );
}

const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const canCopy = () => typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';

export function ThoughtDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const thought = thoughtById(id);
  if (!thought) {
    return (
      <div className="screen-pad thought-detail">
        <Back />
        <EmptyState title={t('thoughts.title')} text={t('thoughts.notFound')} />
      </div>
    );
  }
  return <Detail thought={thought} />;
}

function Detail({ thought }: { thought: Thought }) {
  const { t, lang } = useI18n();
  const { data, actions } = useStore();
  const daily = useThoughtOfDay();
  const [toast, setToast] = useState<string | null>(null);
  const recent = useRef(data.recent);
  recent.current = data.recent;
  const favorite = data.favorites.includes(thought.id);
  const text = thought.text[lang];

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [thought.id]);
  // Opening a thought adds it to "Recently viewed" (newest first, no duplicates).
  useEffect(() => {
    void actions.saveRecent(pushRecent(recent.current, thought.id, new Date().toISOString()));
  }, [thought.id, actions]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const share = async () => {
    const body = `${text}\n\n${t('thoughts.originals')}`;
    if (canShare()) {
      try {
        await navigator.share({ text: body });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return; // the user closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(body);
      setToast(t('thoughts.copied'));
    } catch {
      setToast(t('thoughts.copyFailed'));
    }
  };

  return (
    <div className="screen-pad thought-detail">
      <Back />
      <article className="thought-detail__body" aria-labelledby="thought-text">
        <p className="t-eyebrow">
          {daily.id === thought.id ? `${t('thoughts.ofDay')} · ` : ''}{t(`category.${thought.category}`)}
        </p>
        <blockquote id="thought-text" className={`thought-detail__text thought-detail__text--${thought.format}`} data-thought-id={thought.id}>
          {text}
        </blockquote>
        <p className="originals">{t('thoughts.originals')}</p>
      </article>
      <div className="thought-detail__actions">
        <IconButton
          label={t('thoughts.favorite')}
          aria-pressed={favorite}
          className="thought-detail__fav"
          onClick={() => void actions.saveFavorites(toggleFavorite(data.favorites, thought.id))}
        >
          <Heart size={22} strokeWidth={1.5} fill={favorite ? 'currentColor' : 'none'} aria-hidden />
        </IconButton>
        <Button icon={<Image size={18} strokeWidth={1.5} aria-hidden />} onClick={() => navigate(`poster/${encodeURIComponent(thought.id)}`)}>
          {t('thoughts.makePoster')}
        </Button>
        {(canShare() || canCopy()) && (
          <Button icon={<Share2 size={18} strokeWidth={1.5} aria-hidden />} onClick={() => void share()}>{t('thoughts.share')}</Button>
        )}
      </div>
      {toast && <p className="toast toast--info" role="status">{toast}</p>}
    </div>
  );
}

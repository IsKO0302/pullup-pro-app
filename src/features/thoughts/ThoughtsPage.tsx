import { Clock, Heart } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useToday } from '../../app/clock';
import { useI18n } from '../../app/i18n';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { resolveThoughts, thoughtsIn } from '../../domain/thoughts';
import { THOUGHT_CATEGORIES, type Thought, type ThoughtCategory } from '../../domain/types';
import { Button, ChoiceGroup, EmptyState } from '../../ui';
import { useThoughtOfDay } from './daily';
import { ThoughtDetail } from './ThoughtDetail';
import './thoughts.css';

type Tab = 'all' | 'favorites' | 'recent';
const TABS: readonly Tab[] = ['all', 'favorites', 'recent'];

/** Remembered while the app is open, so "back" from a thought lands where you were. */
const memory: { tab: Tab; topic: ThoughtCategory | null; scrollY: number; restore: boolean } = { tab: 'all', topic: null, scrollY: 0, restore: false };

export default function ThoughtsPage({ id }: { id?: string }) {
  if (id) return <ThoughtDetail key={id} id={id} />;
  return <Thoughts />;
}

function Thoughts() {
  const { t, tp, lang, date } = useI18n();
  const { data } = useStore();
  const today = useToday();
  const daily = useThoughtOfDay();
  const [tab, setTab] = useState<Tab>(memory.tab);
  const [topic, setTopic] = useState<ThoughtCategory | null>(memory.topic);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useLayoutEffect(() => {
    if (memory.restore) window.scrollTo(0, memory.scrollY);
    memory.restore = false;
  }, []);

  const favorites = useMemo(() => new Set(data.favorites), [data.favorites]);
  const list: readonly Thought[] = useMemo(() => {
    if (tab === 'favorites') return resolveThoughts(data.favorites);
    if (tab === 'recent') return resolveThoughts(data.recent.map((r) => r.id));
    return thoughtsIn(topic);
  }, [tab, topic, data.favorites, data.recent]);

  const choose = (next: Tab) => {
    setTab(next);
    memory.tab = next;
  };
  const chooseTopic = (next: ThoughtCategory | 'any') => {
    const value = next === 'any' ? null : next;
    setTopic(value);
    memory.topic = value;
  };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === 'ArrowRight' ? (i + 1) % TABS.length
      : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length
        : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    choose(TABS[to]!);
    tabRefs.current[to]?.focus();
  };
  const open = (thought: Thought) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    memory.scrollY = window.scrollY;
    memory.restore = true;
    navigate(`thoughts/${encodeURIComponent(thought.id)}`);
  };

  const topics = [{ value: 'any' as const, label: t('thoughts.allTopics') }, ...THOUGHT_CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`) }))];
  const empty = list.length === 0;

  return (
    <div className="screen-pad thoughts">
      <h1 className="t-h1">{t('thoughts.title')}</h1>

      <a className="thought-hero" href={`#/thoughts/${encodeURIComponent(daily.id)}`} onClick={open(daily)} data-thought-id={daily.id} data-testid="thought-of-day">
        <span className="thought-hero__top">
          <span className="t-eyebrow">{t('thoughts.ofDay')}</span>
          <span className="t-caption muted">{date(today, { day: 'numeric', month: 'long' })}</span>
        </span>
        <span className="thought-hero__text">{daily.text[lang]}</span>
        <span className="originals">{t('thoughts.originals')}</span>
      </a>

      <div className="tabs" role="tablist" aria-label={t('thoughts.tabs')}>
        {TABS.map((key, i) => (
          <button
            key={key}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            id={`thoughts-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="thoughts-panel"
            tabIndex={tab === key ? 0 : -1}
            className="tabs__tab"
            onClick={() => choose(key)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t(`thoughts.${key}`)}
          </button>
        ))}
      </div>

      <div className="thoughts__panel" role="tabpanel" id="thoughts-panel" aria-labelledby={`thoughts-tab-${tab}`}>
        {tab === 'all' && (
          <div className="thoughts__topics">
            <ChoiceGroup label={t('thoughts.categories')} options={topics} value={topic ?? 'any'} onChange={chooseTopic} />
          </div>
        )}
        {tab === 'all' && <p className="t-caption muted thoughts__count num">{tp('plural.thoughts', list.length)}</p>}

        {empty ? (
          <EmptyState
            icon={tab === 'favorites' ? <Heart size={28} strokeWidth={1.25} /> : <Clock size={28} strokeWidth={1.25} />}
            title={t(tab === 'favorites' ? 'thoughts.favoritesEmptyTitle' : 'thoughts.recentEmptyTitle')}
            text={t(tab === 'favorites' ? 'thoughts.favoritesEmpty' : 'thoughts.recentEmpty')}
            action={<Button variant="secondary" onClick={() => choose('all')}>{t('thoughts.browseAll')}</Button>}
          />
        ) : (
          <ul className="thought-list">
            {list.map((th) => (
              <li key={th.id}>
                <a className={`thought-item thought-item--${th.format}`} href={`#/thoughts/${encodeURIComponent(th.id)}`} onClick={open(th)} data-thought-id={th.id}>
                  <span className="thought-item__text">{th.text[lang]}</span>
                  <span className="thought-item__meta">
                    <span>{t(`category.${th.category}`)}</span>
                    <span aria-hidden>·</span>
                    <span className="originals">{t('thoughts.originals')}</span>
                    {favorites.has(th.id) && (
                      <Heart className="thought-item__fav" size={14} strokeWidth={1.5} fill="currentColor" role="img" aria-label={t('thoughts.inFavorites')} />
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

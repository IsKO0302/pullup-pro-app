import { Activity, Quote, Sun, User } from 'lucide-react';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { CompletionScreen } from '../features/completion/CompletionScreen';
import { Onboarding } from '../features/onboarding/Onboarding';
import { LanguageScreen } from '../features/onboarding/LanguageScreen';
import { WelcomeScreen } from '../features/onboarding/WelcomeScreen';
import { TodayScreen } from '../features/today/TodayScreen';
import { WorkoutScreen } from '../features/workout/WorkoutScreen';
import { BottomNav, Skeleton, type NavItem } from '../ui';
import { useI18n } from './i18n';
import { navigate } from './router';
import { useStore } from './store';

// Charts and history are code-split: TODAY and the workout stay in the first bundle.
const ProgressPage = lazy(() => import('../features/progress/ProgressPage'));
const ThoughtsPage = lazy(() => import('../features/thoughts/ThoughtsPage'));
const PosterPage = lazy(() => import('../features/poster/PosterPage'));
const YouScreen = lazy(() => import('../features/you/YouScreen'));

const TABS = ['today', 'progress', 'thoughts', 'you'] as const;
type Tab = (typeof TABS)[number];
const isTab = (p: string | undefined): p is Tab => TABS.includes(p as Tab);

export function Shell({ route }: { route: string[] }) {
  const { data } = useStore();
  const { t } = useI18n();
  const profile = data.profile;
  const [page] = route;
  const tab: Tab = isTab(page) ? page : 'today';

  useEffect(() => {
    const name = page === 'workout' ? t('workout.progress') : page === 'done' ? t('done.title') : page === 'poster' ? t('poster.title') : t(`nav.${tab}`);
    document.title = profile?.onboarding === 'done' ? `${name} · PULLUP PRO` : 'PULLUP PRO';
  }, [t, tab, page, profile?.onboarding]);

  if (!profile) return <LanguageScreen />;
  if (page === 'welcome') return <WelcomeScreen onContinue={() => navigate('you', { replace: true })} />;
  if (profile.onboarding !== 'done') return <Onboarding profile={profile} />;
  // Full-screen moments: no bottom navigation.
  if (page === 'workout') return <div className="app"><WorkoutScreen /></div>;
  if (page === 'done' && route[1]) return <div className="app"><main><CompletionScreen id={route[1]} /></main></div>;
  if (page === 'poster') {
    return (
      <div className="app">
        <main>
          <Suspense fallback={<div className="screen-pad"><Skeleton height={320} /></div>}>
            <PosterPage thoughtId={route[1]} workoutId={route[2]} />
          </Suspense>
        </main>
      </div>
    );
  }

  const icon = (node: ReactNode) => node;
  const items: NavItem[] = [
    { key: 'today', label: t('nav.today'), href: '#/today', icon: icon(<Sun size={22} strokeWidth={1.5} aria-hidden />) },
    { key: 'progress', label: t('nav.progress'), href: '#/progress', icon: icon(<Activity size={22} strokeWidth={1.5} aria-hidden />) },
    { key: 'thoughts', label: t('nav.thoughts'), href: '#/thoughts', icon: icon(<Quote size={22} strokeWidth={1.5} aria-hidden />) },
    { key: 'you', label: t('nav.you'), href: '#/you', icon: icon(<User size={22} strokeWidth={1.5} aria-hidden />) },
  ];
  let screen: ReactNode;
  switch (tab) {
    case 'you':
      screen = (
        <Suspense fallback={<div className="screen-pad"><Skeleton height={32} width="50%" /></div>}>
          <YouScreen />
        </Suspense>
      );
      break;
    case 'progress':
      screen = (
        <Suspense fallback={<div className="screen-pad"><Skeleton height={32} width="50%" /></div>}>
          <ProgressPage id={route[1]} />
        </Suspense>
      );
      break;
    case 'thoughts':
      screen = (
        <Suspense fallback={<div className="screen-pad"><Skeleton height={32} width="50%" /></div>}>
          <ThoughtsPage id={route[1]} />
        </Suspense>
      );
      break;
    default:
      screen = <TodayScreen />;
  }
  return (
    <div className="app app--nav">
      <main key={tab}>{screen}</main>
      <BottomNav items={items} activeKey={tab} label={t('nav.label')} />
    </div>
  );
}

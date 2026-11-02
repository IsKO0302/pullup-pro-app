import { Activity, Quote, Sun, User } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Onboarding } from '../features/onboarding/Onboarding';
import { LanguageScreen } from '../features/onboarding/LanguageScreen';
import { WelcomeScreen } from '../features/onboarding/WelcomeScreen';
import { TodayScreen } from '../features/today/TodayScreen';
import { YouScreen } from '../features/you/YouScreen';
import { BottomNav, type NavItem } from '../ui';
import { useI18n } from './i18n';
import { navigate } from './router';
import { useStore } from './store';

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
    document.title = profile?.onboarding === 'done' ? `${t(`nav.${tab}`)} · PULLUP PRO` : 'PULLUP PRO';
  }, [t, tab, profile?.onboarding]);

  if (!profile) return <LanguageScreen />;
  if (page === 'welcome') return <WelcomeScreen onContinue={() => navigate('you', { replace: true })} />;
  if (profile.onboarding !== 'done') return <Onboarding profile={profile} />;

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
      screen = <YouScreen />;
      break;
    case 'progress':
    case 'thoughts':
      screen = <div className="screen-pad"><h1 className="t-h1">{t(`nav.${tab}`)}</h1></div>;
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

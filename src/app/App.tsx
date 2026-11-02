import { lazy, Suspense } from 'react';
import { Button } from '../ui';
import { DB_NAME, guessLang, readStoredLang } from './config';
import { ErrorBoundary } from './ErrorBoundary';
import { I18nProvider, useI18n } from './i18n';
import { useRoute } from './router';
import { Shell } from './Shell';
import { StoreProvider, useStore } from './store';

const Styleguide = import.meta.env.DEV ? lazy(() => import('./dev/Styleguide')) : null;
const Glyphs = import.meta.env.DEV ? lazy(() => import('./dev/Glyphs')) : null;

export function App() {
  const route = useRoute();
  const [page] = route;
  if (page === 'styleguide' && Styleguide) return <Suspense><Styleguide /></Suspense>;
  if (page === 'glyphs' && Glyphs) return <Suspense><Glyphs /></Suspense>;
  return (
    <StoreProvider dbName={DB_NAME}>
      <Root route={route} />
    </StoreProvider>
  );
}

function Root({ route }: { route: string[] }) {
  const { status, data } = useStore();
  const lang = data.profile?.lang ?? readStoredLang() ?? guessLang();
  return (
    <I18nProvider lang={lang}>
      {status.kind === 'loading' && <Splash />}
      {status.kind === 'error' && <StorageErrorScreen detail={status.detail} />}
      {status.kind === 'ready' && (
        <ErrorBoundary fallback={(reset) => <CrashScreen reset={reset} />}>
          <Shell route={route} />
        </ErrorBoundary>
      )}
      <SaveErrorToast />
    </I18nProvider>
  );
}

function Splash() {
  return (
    <div className="splash" aria-busy="true">
      <span className="t-eyebrow">PULLUP PRO</span>
    </div>
  );
}

function StorageErrorScreen({ detail }: { detail: string }) {
  const { t } = useI18n();
  return (
    <main className="screen-pad fatal" role="alert">
      <h1 className="t-h2">{t('error.storageTitle')}</h1>
      <p className="muted">{t('error.storageText', { detail })}</p>
      <Button variant="primary" onClick={() => window.location.reload()}>{t('common.retry')}</Button>
    </main>
  );
}

function CrashScreen({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <main className="screen-pad fatal" role="alert">
      <h1 className="t-h2">{t('error.title')}</h1>
      <p className="muted">{t('error.text')}</p>
      <Button variant="primary" onClick={() => window.location.reload()}>{t('error.reload')}</Button>
      <Button variant="ghost" onClick={reset}>{t('common.retry')}</Button>
    </main>
  );
}

function SaveErrorToast() {
  const { saveError, dismissSaveError } = useStore();
  const { t } = useI18n();
  if (!saveError) return null;
  return (
    <div className="toast" role="alert">
      <p>{t('error.save', { detail: saveError })}</p>
      <Button variant="ghost" onClick={dismissSaveError}>{t('common.close')}</Button>
    </div>
  );
}

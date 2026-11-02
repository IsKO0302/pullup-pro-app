import { lazy, Suspense } from 'react';
import { useRoute } from './router';

const Styleguide = import.meta.env.DEV ? lazy(() => import('./dev/Styleguide')) : null;
const Glyphs = import.meta.env.DEV ? lazy(() => import('./dev/Glyphs')) : null;

export function App() {
  const [page] = useRoute();
  if (page === 'styleguide' && Styleguide) return <Suspense><Styleguide /></Suspense>;
  if (page === 'glyphs' && Glyphs) return <Suspense><Glyphs /></Suspense>;
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <h1 className="t-h1 upper">PULLUP PRO</h1>
        <p className="muted">YOU VS. YOU.</p>
      </div>
    </main>
  );
}

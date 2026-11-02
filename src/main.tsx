import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts (offline): Inter Tight (UI, numerals) and Cormorant Garamond
// (thoughts, welcome, posters). Only Latin, Latin-Extended (Turkish) and Cyrillic.
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-ext-500.css';
import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-ext-600.css';
import '@fontsource/cormorant-garamond/cyrillic-600.css';
import './ui/tokens.css';
import './ui/base.css';
import './ui/components.css';
import './app/app.css';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

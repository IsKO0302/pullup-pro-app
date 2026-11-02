import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { createI18n, type I18n } from '../data/i18n/core';
import type { Lang } from '../domain/types';
import { storeLang } from './config';

const I18nContext = createContext<I18n>(createI18n('en'));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => createI18n(lang), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
    storeLang(lang);
  }, [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}

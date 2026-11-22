import { useSyncExternalStore } from 'react';
import { format, LOCALES, localize, type GameState, type Locale, type Text } from '@happy-voyage/shared';

export const LOCALE_KEY = 'happy-voyage-locale';
const listeners = new Set<() => void>();

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (LOCALES.some((locale) => locale.id === saved)) return saved as Locale;
  } catch {}
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let current: Locale = initialLocale();
applyDocumentLanguage(current);

function applyDocumentLanguage(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : 'en';
  document.title = locale === 'zh' ? '欢乐大航海：七海霸权' : 'Happy Voyage: Seven Seas Domination';
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try { localStorage.setItem(LOCALE_KEY, locale); } catch {}
  applyDocumentLanguage(locale);
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

/** Pick the current language's template and fill `{name}` placeholders. */
export function pick(locale: Locale, en: string, zh: string, params?: Record<string, string | number>): string {
  return format(locale === 'zh' ? zh : en, params);
}

/** `t(en, zh, params)` for inline UI text, `l(text)` for messages the game wrote. The app root re-renders on change. */
export function useT() {
  const locale = current;
  return {
    locale,
    t: (en: string, zh: string, params?: Record<string, string | number>) => pick(locale, en, zh, params),
    l: (text: Text, state?: Pick<GameState, 'players' | 'map'> | null) => localize(locale, text, state),
  };
}

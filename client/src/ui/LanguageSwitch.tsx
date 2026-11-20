import { LOCALES } from '@happy-voyage/shared';
import { setLocale, useT } from '../i18n';

/** Language setting: every screen follows it, and the choice is remembered on this device. */
export function LanguageSwitch() {
  const { t, locale } = useT();
  return (
    <div className="choices language" role="group" aria-label={t('Language', '语言')}>
      <span>{t('Language', '语言')}</span>
      {LOCALES.map((option) => (
        <button
          key={option.id}
          lang={option.id === 'zh' ? 'zh-Hans' : 'en'}
          className={locale === option.id ? 'chip selected' : 'chip'}
          aria-pressed={locale === option.id}
          onClick={() => setLocale(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

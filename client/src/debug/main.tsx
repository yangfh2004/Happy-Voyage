import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createDefaultMap, type Locale } from '@happy-voyage/shared';
import { LOCALE_KEY, setLocale, useLocale, useT } from '../i18n';
import { isScenario, scenarioGroups, scenarioName, type Scenario } from './scenarios';
import '../styles.css';
import './debug.css';

const map = createDefaultMap();

function DebugPage() {
  const locale = useLocale();
  const { t } = useT();
  const [scene, setScene] = useState<Scenario | null>(null);
  const [reload, resetScene] = useState(0);
  const title = t('Window Tester', '页面测试');
  useEffect(() => { document.title = title; }, [title]);

  const languages: readonly [Locale, string][] = [['en', t('English', '英文')], ['zh', t('Chinese', '中文')]];
  const label = scene && scenarioName(scene, locale, map);

  return (
    <main className="window-tester">
      <header className="window-tester-bar">
        {scene && <button onClick={() => setScene(null)}>{t('All windows', '所有页面')}</button>}
        <h1>{label || title}</h1>
        <div className="window-tester-controls">
          {scene && <button onClick={() => resetScene((n) => n + 1)}>{t('Reset', '重置')}</button>}
          {languages.map(([id, name]) => (
            <button className={locale === id ? 'primary' : ''} key={id} aria-pressed={locale === id} onClick={() => setLocale(id)}>{name}</button>
          ))}
        </div>
      </header>
      {scene ? (
        // A fresh frame resets the game and leaves these controls usable even during modal dialogs.
        <iframe key={`${scene}:${reload}`} title={label || title} src={`?preview=${scene}`} />
      ) : (
        <div className="window-tester-list">
          <p>{t('Choose a window to open a playable example. Reset it at any time.', '选择一个页面即可开始测试，随时可以重置。')}</p>
          {scenarioGroups.map(({ title: [en, zh], scenes }) => (
            <section key={en}>
              <h2>{t(en, zh)}</h2>
              <div className="window-tester-grid">
                {scenes.map((id) => (
                  <button key={id} onClick={() => setScene(id)}>{scenarioName(id, locale, map)}</button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

// The launcher and the game frame each have their own React tree and controller.
window.addEventListener('storage', (event) => {
  if (event.key === LOCALE_KEY && (event.newValue === 'en' || event.newValue === 'zh')) {
    setLocale(event.newValue);
  }
});

const root = createRoot(document.getElementById('root')!);
const preview = new URLSearchParams(window.location.search).get('preview');
if (isScenario(preview)) {
  void import('./preview').then(({ Preview, preparePreview }) => {
    preparePreview(preview);
    root.render(<StrictMode><Preview scene={preview} /></StrictMode>);
  });
} else {
  root.render(<StrictMode><DebugPage /></StrictMode>);
}

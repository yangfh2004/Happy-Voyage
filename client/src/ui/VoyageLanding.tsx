import { useT } from '../i18n';
import { LanguageSwitch } from './LanguageSwitch';
import './VoyageLanding.css';

export function VoyageLanding({ onStart, onOnline }: { onStart: () => void; onOnline: () => void }) {
  const { t } = useT();
  return (
    <main className="voyage-cover" aria-labelledby="voyage-title">
      <header className="voyage-cover-header"><LanguageSwitch /></header>
      <section className="voyage-cover-copy">
        <span className="voyage-cover-mark" aria-hidden="true">✦</span>
        <p className="voyage-cover-kicker">{t('Seven Seas Domination', '七海霸权')}</p>
        <h1 id="voyage-title">{t('Happy Voyage', '欢乐大航海')}</h1>
        <p className="voyage-cover-deck">{t('Spin the compass. Chart a course through the islands. Build a fleet and outmaneuver your rivals.', '转动罗盘，探索岛屿，组建舰队，战胜对手。')}</p>
        <div className="voyage-cover-actions">
          <button className="voyage-start" onClick={onStart}>{t('New voyage', '开始航程')} <span aria-hidden="true">→</span></button>
          <button onClick={onOnline}>{t('Host online room', '创建在线房间')}</button>
        </div>
      </section>
    </main>
  );
}

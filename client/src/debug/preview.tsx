import { useEffect } from 'react';
import { App } from '../App';
import { gameController } from '../game/GameController';
import { scenarioOptions, stageScenario, type Scenario } from './scenarios';
import 'dialog-polyfill/dist/dialog-polyfill.css';
import { STRATEGIES, strategyText, type StrategyId } from '@happy-voyage/shared';
import { StrategyArt } from '../ui/StrategyArt';
import { useLocale, useT } from '../i18n';

export function preparePreview(scene: Scenario): void {
  if (scene !== 'landing' && scene !== 'strategyGallery') stageScenario(gameController.beginGame(scenarioOptions(scene)), scene);
}

export function Preview({ scene }: { scene: Scenario }) {
  useEffect(() => {
    const anchor = scene === 'colonyMarket' ? '#ship-market-title' : scene === 'strategies' ? '.strategy-cards summary' : null;
    if (anchor) document.querySelector(anchor)?.scrollIntoView({ block: 'start' });
  }, [scene]);

  return scene === 'strategyGallery' ? <StrategyGallery /> : <App initialTutorialDismissed={scene !== 'landing' || undefined} expandStrategies={scene === 'strategies' || scene === 'battle'} />;
}

function StrategyGallery() {
  useLocale();
  const { t, locale } = useT();
  return <main className="strategy-gallery">
    <header><p>HAPPY VOYAGE</p><h1>{t('The art of strategy', '七海谋略')}</h1><p>{t('20 cards. A sea of possibilities.', '20张谋略卡，纵横七海。')}</p></header>
    <div className="strategy-gallery-grid">{(Object.keys(STRATEGIES) as StrategyId[]).map((id, i) => <article className="strategy-card" key={id}>
      <div className="strategy-card-art"><StrategyArt id={id} /><span className="strategy-card-number">{String(i + 1).padStart(2, '0')}</span></div>
      <div className="strategy-card-body"><h3>{strategyText(id, locale).name}</h3><p>{strategyText(id, locale).description}</p></div>
    </article>)}</div>
  </main>;
}

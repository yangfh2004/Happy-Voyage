import { useEffect } from 'react';
import { App } from '../App';
import { gameController } from '../game/GameController';
import { scenarioOptions, stageScenario, type Scenario } from './scenarios';
import 'dialog-polyfill/dist/dialog-polyfill.css';

export function preparePreview(scene: Scenario): void {
  if (scene !== 'landing') stageScenario(gameController.beginGame(scenarioOptions(scene)), scene);
}

export function Preview({ scene }: { scene: Scenario }) {
  useEffect(() => {
    const anchor = scene === 'colonyMarket' ? '#ship-market-title' : scene === 'strategies' ? '.strategy-cards summary' : null;
    if (anchor) document.querySelector(anchor)?.scrollIntoView({ block: 'start' });
  }, [scene]);

  return <App initialTutorialDismissed={scene !== 'landing' || undefined} expandStrategies={scene === 'strategies' || scene === 'battle'} />;
}

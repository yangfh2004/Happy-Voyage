import { useEffect, useRef } from 'react';
import { EVENT_GOLD, type GameConfig } from '@happy-voyage/shared';

export function RulesPanel({ config, onClose }: { config: GameConfig; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); }
    };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); previous?.focus(); };
  }, [onClose]);

  return (
    <div className="rules-backdrop">
      <section className="panel rules" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <div className="rules-heading"><h2 id="rules-title">How to play</h2><button ref={close} onClick={onClose}>Close</button></div>
        <p>Roll two dice and sail <strong>clockwise</strong> by their sum. The arrows show the way.</p>
        <dl>
          <dt>⚑ Royal Harbor</dt><dd>Collect {config.homeSalary}g royal salary when passing or landing here.</dd>
          <dt><svg width="23" height="23" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="22" fill="#e6cb75"/><circle cx="23" cy="23" r="16" fill="#79b956"/><circle cx="19" cy="18" r="8" fill="#4c9f50"/></svg> Islands</dt><dd>Claim neutral islands for the price on the map. Rivals landing on your colonies pay you the listed toll.</dd>
          <dt><span className="rule-icon treasure">$</span> Treasure Shoal</dt><dd>Find +{EVENT_GOLD.treasure.min}–{EVENT_GOLD.treasure.max}g.</dd>
          <dt><span className="rule-icon storm">!</span> Storm Front</dt><dd>Pay {EVENT_GOLD.storm.min}–{EVENT_GOLD.storm.max}g for repairs.</dd>
          <dt><span className="rule-icon treasure">≈</span> Trade Winds</dt><dd>Earn +{EVENT_GOLD.tradeWind.base}g plus {EVENT_GOLD.tradeWind.perColony}g per colony you own.</dd>
        </dl>
        <p><strong>Stay afloat:</strong> below 0 gold means bankruptcy. Your colonies go neutral.</p>
        <p><strong>Win:</strong> claim {config.islandsToWin} islands, be the last navigator afloat, or have the highest net worth after {config.maxRounds} rounds.</p>
        <p>Net worth = gold + the purchase prices of your colonies.</p>
      </section>
    </div>
  );
}

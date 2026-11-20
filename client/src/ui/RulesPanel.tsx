import { useEffect, useRef } from 'react';
import { EVENT_GOLD, SEA_RULES, REPAIR_GOLD_PER_POINT, SEA_HAZARD_DAMAGE, type GameConfig } from '@happy-voyage/shared';

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
        <p>Spin the compass and sail <strong>clockwise</strong> by the number of stops it shows. The arrows show the way.</p>
        <dl>
          <dt>⚑ Ten national home ports</dt><dd>Each navigator starts at their nation’s home port. Collect {config.homeSalary}g when passing or landing on your own port. Other ports charge {SEA_RULES.foreignTax}g, paid to their navigator or to the crown if no active navigator represents that nation.</dd>
          <dt><svg width="23" height="23" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="22" fill="#e6cb75"/><circle cx="23" cy="23" r="16" fill="#79b956"/><circle cx="19" cy="18" r="8" fill="#4c9f50"/></svg> Islands</dt><dd>Claim neutral islands for the price on the map. Rivals landing on your colonies pay you the listed toll.</dd>
          <dt><span className="rule-icon treasure">$</span> Treasure Shoal</dt><dd>Find +{EVENT_GOLD.treasure.min}–{EVENT_GOLD.treasure.max}g.</dd>
          <dt><span className="rule-icon storm">!</span> Storm Front</dt><dd>Pay {EVENT_GOLD.storm.min}–{EVENT_GOLD.storm.max}g for repairs.</dd>
          <dt><span className="rule-icon treasure">≈</span> Trade Winds</dt><dd>Earn +{EVENT_GOLD.tradeWind.base}g plus {EVENT_GOLD.tradeWind.perColony}g per colony you own.</dd>
        </dl>
        <p><strong>Shipyards:</strong> Revisit your colony to build a lumber mill, iron mine, and shipyard. Each round, the mill and mine add materials to the colony's stockpile. Spend those materials at the yard to add a new ship to your fleet; upgrade the yard to unlock bigger ships.</p>
        <p><strong>Repair yards:</strong> Fully repair all ships docked at that colony for free at the owner's turn start. Ships sailing in your fleet are not repaired by yards.</p>
        <p>Storms, pirates, sea monsters, and damaging Bermuda whirlpools also remove up to {SEA_HAZARD_DAMAGE} durability per ship, keeping their gold costs. Durability cannot fall below 0; ships are not sunk. Inspect durability in Fleet.</p>
        <p><strong>Skeleton Island market:</strong> After tribute or scrap trading, buy one of each used ship per visit: Explorer 180g, Cargo Ship 300g, Warship 450g, all at 60% durability. Sell empty ships for half their used purchase price times their remaining durability fraction. Keep at least one ship. Trading is only available on the landing turn.</p>
        <p><strong>Nightless Island:</strong> Build a collection field at your colony, then load its produce using Transfers when you revisit. Land at Nightless Island to sell the cargo or buy goods for your fleet. Scarce goods cost more, demand shifts each round, storms raise prices for repair materials, and trade winds replenish supply.</p>
        <p><strong>Other special islands:</strong> Treasure sells lottery tickets; Mist hosts a simulated Nim duel (take 1–3, last loses); Revival repairs your fleet for {REPAIR_GOLD_PER_POINT}g per missing durability point (partial repairs in fleet order if gold runs short; a sound fleet is free) and blocks the next sea hazard; Wind lets you exchange cheap fleet cargo for higher-value native goods (choose one offer or decline); Dragon Snake offers up to three captains: recruit one or decline. Higher royal ranks unlock better captains. Up to three captains stay aboard, adding home salary or reducing colony tolls and foreign tax. Discounts of the same kind add together, capped at 75%; tax discounts apply after rank benefits. View your captains in Fleet.</p>
        <p><strong>Living seas:</strong> pirates and sea monsters cost gold; Bermuda currents move you or damage your fleet. Bottles and floating cargo reward gold, merchants buy colony goods, and wyverns carry you to a new stop whose effect is resolved. Revival blocks these hazards once.</p>
        <p>Drag to pan; pinch or scroll to zoom. Use Fit chart for the whole route, or Follow ship to return to the active fleet.</p>
        <p><strong>Foreign port taxes:</strong> If you cannot pay the full tax, pay all your gold, then surrender sailing ships cheapest first at their used resale value (including condition). Cargo stays aboard. Ships join the host’s fleet, or are removed by the crown. Excess ship value is not refunded. Losing your last sailing ship or still owing tax means bankruptcy; docked ships cannot pay tax.</p>
        <p><strong>Stay afloat:</strong> below 0 gold means bankruptcy. Your colonies go neutral.</p>
        <p><strong>Win:</strong> claim {config.islandsToWin} islands, be the last navigator afloat, or have the highest net worth after {config.maxRounds} rounds.</p>
        <p>The starting navigator rotates each round. Net worth = gold + 75% of each colony's purchase price, rounded down.</p>
      </section>
    </div>
  );
}

import { colonyProduction, type GameState } from '@happy-voyage/shared';
import { StatTooltip } from './StatTooltip';

export function ColonyGoods({ state, nodeId }: { state: GameState; nodeId: number }) {
  const { specialty } = state.map[nodeId];
  const stored = state.stockpiles[nodeId];
  const rate = colonyProduction(state, nodeId);
  return (
    <>
      <div><StatTooltip stat="storage">{`Stored: ${stored.lumber} lumber · ${stored.iron} iron${specialty ? ` · ${stored.specialties[specialty] ?? 0} ${specialty}` : ''}`}</StatTooltip></div>
      <div><StatTooltip stat="production">{`Per round: +${rate.lumber} lumber · +${rate.iron} iron${specialty ? ` · +${rate.specialty} ${specialty}` : ''}`}</StatTooltip></div>
    </>
  );
}

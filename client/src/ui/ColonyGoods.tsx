import { colonyProduction, type GameState } from '@happy-voyage/shared';

export function ColonyGoods({ state, nodeId }: { state: GameState; nodeId: number }) {
  const { specialty } = state.map[nodeId];
  const stored = state.stockpiles[nodeId];
  const rate = colonyProduction(state, nodeId);
  return (
    <>
      <div>Stored: {stored.lumber} lumber · {stored.iron} iron{specialty && ` · ${stored.specialties[specialty] ?? 0} ${specialty}`}</div>
      <div>Per round: +{rate.lumber} lumber · +{rate.iron} iron{specialty && ` · +${rate.specialty} ${specialty}`}</div>
    </>
  );
}

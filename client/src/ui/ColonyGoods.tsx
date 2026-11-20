import { colonyProduction, goodName, type GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { StatTooltip } from './StatTooltip';

export function ColonyGoods({ state, nodeId }: { state: GameState; nodeId: number }) {
  const { specialty } = state.map[nodeId];
  const stored = state.stockpiles[nodeId];
  const rate = colonyProduction(state, nodeId);
  const { t, locale } = useT();
  const g = (good: Parameters<typeof goodName>[0]) => goodName(good, locale);
  return (
    <>
      <div><StatTooltip stat="storage">{t('Stored:', '库存：')} {stored.lumber} {g('lumber')} · {stored.iron} {g('iron')}{specialty && ` · ${stored.specialties[specialty] ?? 0} ${g(specialty)}`}</StatTooltip></div>
      <div><StatTooltip stat="production">{t('Per round:', '每回合：')} +{rate.lumber} {g('lumber')} · +{rate.iron} {g('iron')}{specialty && ` · +${rate.specialty} ${g(specialty)}`}</StatTooltip></div>
    </>
  );
}

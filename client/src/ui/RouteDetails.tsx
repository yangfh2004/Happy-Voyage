import { buildingName, colonyToll, nationName, nodeName, playerName, type BuildingKind, type GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { gameController } from '../game/GameController';
import { ColonyGoods } from './ColonyGoods';
import { StatTooltip } from './StatTooltip';

/** A readable key for the chart when the canvas labels are too small. */
export function RouteDetails({ state }: { state: GameState }) {
  const { t, locale } = useT();
  const sizes = locale === 'zh' ? ['无', '小型', '中型', '大型'] : ['None', 'Small', 'Medium', 'Large'];
  return (
    <details className="panel route-details">
      <summary>{t('Route details', '航线详情')}</summary>
      <ol className="route-stops">
        {state.map.map((stop) => {
          const owner = state.owners[stop.id];
          const fleets = state.players.filter((player) => !player.bankrupt && gameController.shownPosition(player) === stop.id);
          return (
            <li key={stop.id}>
              <strong>{nodeName(stop, locale)}</strong>
              {stop.kind === 'special' && <div>{locale === 'zh' ? stop.name : stop.chineseName} · {t('Special island', '特殊岛屿')}</div>}
              {stop.kind === 'port' && <div>{t('{nation} home port', '{nation}母港', { nation: nationName(stop.nation ?? '', locale) })} · {(() => { const host = state.players.find((player) => player.homePort === stop.id); return host ? playerName(host, locale) : t('Crown', '王室'); })()}</div>}
              {stop.kind === 'event' && <div>{t('Sea encounter', '海上遭遇')}</div>}
              {stop.kind === 'island' && (
                <div>
                  <StatTooltip stat="price">{t('{g}g', '{g} 金币', { g: stop.price ?? 0 })}</StatTooltip> · <StatTooltip stat="toll">{t('toll {g}g', '过路费 {g} 金币', { g: colonyToll(state, stop.id) })}</StatTooltip>{owner !== null && t(' · Colony of {p}', ' · {p} 的殖民地', { p: playerName(state.players[owner], locale) })}
                  {owner !== null && <ColonyGoods state={state} nodeId={stop.id} />}
                  {Object.entries(state.buildings[stop.id]).map(([kind, level]) => (
                    <div key={kind}>{buildingName(kind as BuildingKind, locale)}{t(': ', '：')}<StatTooltip stat="buildingLevel">{sizes[level]}</StatTooltip></div>
                  ))}
                </div>
              )}
              {fleets.length > 0 && <div>{t('Fleets: {list}', '舰队：{list}', { list: fleets.map((player) => playerName(player, locale)).join(locale === 'zh' ? '、' : ', ') })}</div>}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

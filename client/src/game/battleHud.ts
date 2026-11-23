import { BATTLE_STATS, shipName, type BattleShip, type Locale } from '@happy-voyage/shared';
import { shipStyle } from './battleShipArt';

const classes = {
  'sloop-of-war': ['Sloop of war', '轻型战舰'], 'frigate': ['Frigate', '护卫舰'], 'ship-of-the-line': ['Ship of the line', '战列舰'],
  'fluyt': ['Fluyt', '福禄特商船'], 'merchantman': ['Merchantman', '商船'], 'galleon': ['Galleon', '盖伦船'],
  'caravel': ['Caravel', '卡拉维尔帆船'], 'caravela-redonda': ['Caravela redonda', '横帆卡拉维尔船'], 'carrack': ['Carrack', '卡拉克船'],
} as const;

export function battleClassName(ship: BattleShip, locale: Locale) {
  return classes[shipStyle(ship).variant][locale === 'zh' ? 1 : 0];
}

export function battleSelectionText(ships: BattleShip[], locale: Locale) {
  const zh = locale === 'zh';
  if (!ships.length) return zh ? '点击我方舰船查看详情' : 'Select a friendly ship to inspect';
  if (ships.length > 1) return zh
    ? `已选 ${ships.length} 艘舰船  ·  耐久 ${ships.reduce((n, s) => n + s.durability, 0)}/${ships.reduce((n, s) => n + s.maxDurability, 0)}`
    : `${ships.length} ships selected  ·  Hull ${ships.reduce((n, s) => n + s.durability, 0)}/${ships.reduce((n, s) => n + s.maxDurability, 0)}`;
  const s = ships[0];
  const reload = s.reload > 0 ? `${zh ? '装填' : 'Reload'} ${s.reload.toFixed(1)}s` : zh ? '就绪' : 'Ready';
  return `${shipName(s.name, locale)} · ${battleClassName(s, locale)}\n${zh ? '耐久' : 'Hull'} ${s.durability}/${s.maxDurability} · ${zh ? '火力' : 'Guns'} ${s.firepower} · ${zh ? '射程' : 'Range'} ${BATTLE_STATS[s.type].range} · ${reload}`;
}

export function battleNameVisible(ship: BattleShip, side: BattleShip['side'], selected: Set<number>, ships: BattleShip[]) {
  return ship.side === side || selected.has(ship.id) || ships.some(s => selected.has(s.id) && s.side === side && s.order.type === 'attack' && s.order.targetId === ship.id);
}

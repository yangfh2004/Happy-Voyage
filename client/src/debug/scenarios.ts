import {
  createNationRoster, navigatorForNation, nodeName, SEA_EVENT_NAMES, seaEventName,
  type EngineOptions, type EventKind, type GameEngine, type Locale, type SpecialKind,
} from '@happy-voyage/shared';
import { pick } from '../i18n';

export const specialIslands = ['treasure', 'mist', 'skeleton', 'dragonSnake', 'wind', 'nightless', 'revival'] as const satisfies readonly SpecialKind[];
export const seaEncounters = (Object.keys(SEA_EVENT_NAMES) as EventKind[]).filter((kind) => kind !== 'openSea');
export const gameScenes = ['landing', 'colonyMarket', 'strategies', 'battle', 'battleCommand', 'battleDefense', 'battlePirates', 'defeat', 'victory'] as const;
type GameScene = (typeof gameScenes)[number];
export type Scenario = GameScene | `island-${SpecialKind}` | `sea-${EventKind}`;

const sceneNames: Record<GameScene, readonly [string, string]> = {
  landing: ['Landing page', '游戏首页'],
  colonyMarket: ['Colony ship market', '殖民地船只市场'],
  strategies: ['Strategy cards and targets', '谋略卡与目标'],
  battle: ['Battle decision', '海战决策'],
  battleCommand: ['Command a colony battle', '指挥殖民地海战'],
  battleDefense: ['Defend against an AI fleet', '抵御电脑舰队'],
  battlePirates: ['Command against pirates', '指挥舰队迎战海盗'],
  defeat: ['Fleet defeat', '舰队覆没'],
  victory: ['Seven Seas victory', '七海霸权胜利'],
};

export const scenarioGroups = [
  { title: ['Voyage screens', '航海页面'] as const, scenes: gameScenes },
  { title: ['Special islands', '特殊岛屿'] as const, scenes: specialIslands.map((kind) => `island-${kind}` as const) },
  { title: ['Sea encounters', '海上遭遇'] as const, scenes: seaEncounters.map((kind) => `sea-${kind}` as const) },
] satisfies { title: readonly [string, string]; scenes: readonly Scenario[] }[];

export function isScenario(id: string | null): id is Scenario {
  return scenarioGroups.some(({ scenes }) => scenes.some((scene) => scene === id));
}

export function scenarioName(id: Scenario, locale: Locale, map: GameEngine['state']['map']): string {
  if (id.startsWith('island-')) return nodeName(map.find((node) => node.special === id.slice(7))!, locale);
  if (id.startsWith('sea-')) return seaEventName(id.slice(4) as EventKind, locale);
  return pick(locale, ...sceneNames[id as GameScene]);
}

export function scenarioOptions(id: Scenario): EngineOptions {
  const navigator = navigatorForNation('Spain')!;
  return {
    players: createNationRoster([{ name: navigator.name, nation: 'Spain' }], { totalPlayers: id === 'strategies' ? 3 : 2 }),
    config: { startingGold: 5000, startingStrategies: 0 },
    rng: () => 0.65,
  };
}

/** Stage the approach; let the real landing rules create each offer and fire its events. */
export function stageScenario(engine: GameEngine, id: Exclude<Scenario, 'landing'>): void {
  const { state, currentPlayer: captain } = engine;
  const rival = state.players[1];
  const colonies = state.map.filter((node) => node.kind === 'island');
  const land = (nodeId: number) => {
    captain.position = nodeId;
    state.phase = 'moving';
    engine.resolveLanding();
  };

  if (id === 'battleCommand' || id === 'battleDefense' || id === 'battlePirates') {
    state.config.battleMode = 'realtime';
    // Leave a reserve colony so the battle returns to a continuing voyage.
    state.owners[colonies[1].id] = captain.id;
    state.owners[colonies[2].id] = rival.id;
    if (id === 'battlePirates') {
      const node = state.map.find((n) => n.event === 'openSea')!;
      node.event = 'pirates';
      land(node.id);
    } else {
      const defender = id === 'battleDefense' ? captain : rival;
      const attacker = id === 'battleDefense' ? rival : captain;
      state.currentPlayer = attacker.id;
      attacker.position = colonies[0].id;
      state.owners[colonies[0].id] = defender.id;
      state.phase = 'awaitingToll';
      engine.fight();
    }
  } else if (id.startsWith('island-')) {
    captain.fleet[0].cargo = { Wine: 6 };
    if (id === 'island-revival') captain.fleet[0].durability -= 30;
    land(state.map.find((node) => node.special === id.slice(7))!.id);
  } else if (id.startsWith('sea-')) {
    const node = state.map.find((stop) => stop.event === 'openSea')!;
    // Merchant and wyvern need the real pending state so their buttons work.
    node.event = id.slice(4) as EventKind;
    if (node.event === 'merchant') captain.fleet[0].cargo = { Wine: 6 };
    land(node.id);
  } else if (id === 'colonyMarket') {
    const { id: colony } = colonies[0];
    state.owners[colony] = captain.id;
    state.buildings[colony] = { lumberMill: 1, ironMine: 1, shipyard: 3, collectionField: 1 };
    state.stockpiles[colony] = { lumber: 50, iron: 50, specialties: { Wine: 10 } };
    land(colony);
  } else if (id === 'strategies') {
    captain.strategies = ['navigate', 'plunder', 'revolt', 'scorch', 'escort'];
    state.owners[colonies[0].id] = rival.id;
    state.owners[colonies[1].id] = state.players[2].id;
    state.stockpiles[colonies[0].id].lumber = 5;
    state.stockpiles[colonies[1].id].iron = 5;
  } else if (id === 'battle' || id === 'defeat') {
    const { id: colony } = colonies[0];
    state.owners[colony] = rival.id;
    rival.position = colony;
    if (id === 'defeat') {
      for (const ship of captain.fleet) {
        ship.durability = 1;
        ship.firepower = 1;
      }
    } else {
      captain.strategies = ['inspire', 'mislead', 'betray', 'exemption', 'ambush'];
    }
    land(colony);
    if (id === 'defeat') engine.fight();
  } else if (id === 'victory') {
    for (const colony of colonies.slice(1)) state.owners[colony.id] = captain.id;
    land(colonies[0].id);
  }
}

import { describe, expect, it, vi } from 'vitest';
import { createDefaultMap, GameEngine, type GameEvent } from '@happy-voyage/shared';
import { islandWindowFor } from '../ui/IslandWindow';
import { isScenario, scenarioGroups, scenarioName, scenarioOptions, seaEncounters, specialIslands, stageScenario, type Scenario } from './scenarios';

vi.mock('dialog-polyfill', () => ({ default: { registerDialog: vi.fn() } }));
vi.mock('../game/GameController', () => ({ gameController: {} }));

function open(scene: Exclude<Scenario, 'landing'>) {
  const engine = new GameEngine(scenarioOptions(scene));
  engine.state.config.battleMode = 'auto';
  const events: GameEvent[] = [];
  engine.on((event) => events.push(event));
  engine.start();
  stageScenario(engine, scene);
  return { engine, events, state: engine.state };
}

describe('debug window scenarios', () => {
  it.each(['battleCommand', 'battleDefense', 'battlePirates'] as const)('opens %s directly in command mode', (scene) => {
    const { state } = open(scene);
    expect(state.phase).toBe('awaitingBattle');
    expect(state.pendingBattle!.commanders).toEqual([scene === 'battleDefense' ? 'defender' : 'attacker']);
  });
  it('covers every special island and localizes the launcher labels', () => {
    const map = createDefaultMap();
    expect(new Set(specialIslands)).toEqual(new Set(map.flatMap((node) => node.special ?? [])));
    const scenes = scenarioGroups.flatMap(({ scenes }): readonly Scenario[] => scenes);
    expect(new Set(scenes).size).toBe(scenes.length);
    for (const scene of scenes) {
      expect(isScenario(scene)).toBe(true);
      expect(scenarioName(scene, 'en', map)).not.toMatch(/[\u4e00-\u9fff]/);
      expect(scenarioName(scene, 'zh', map)).toMatch(/[\u4e00-\u9fff]/);
    }
    expect(isScenario('missing')).toBe(false);
  });

  it.each(specialIslands)('opens the real %s island dialog', (kind) => {
    const { state } = open(`island-${kind}`);
    expect(islandWindowFor(state, true)?.island).toBe(kind);
  });

  it('stages a real purchase and sale at the colony ship market', () => {
    const { engine, state } = open('colonyMarket');
    expect(state.phase).toBe('awaitingBuild');
    expect(engine.canBuyUsedShip('explorer')).toBe(true);
    const count = engine.currentPlayer.fleet.length;
    engine.buyUsedShip('explorer');
    expect(engine.currentPlayer.fleet).toHaveLength(count + 1);
    const ship = engine.currentPlayer.fleet.at(-1)!;
    expect(engine.canSellShip(ship.id)).toBe(true);
    engine.sellShip(ship.id);
    expect(engine.currentPlayer.fleet).toHaveLength(count);
  });

  it('has eligible destinations, rival fleets, and rival colonies', () => {
    const { engine, state } = open('strategies');
    expect(state.phase).toBe('awaitingSpin');
    expect(engine.canUseStrategy('navigate', state.players[1].homePort)).toBe(true);
    expect(engine.canUseStrategy('plunder', 1)).toBe(true);
    expect(engine.canUseStrategy('plunder', 2)).toBe(true);
    expect(state.map.filter(({ id }) => engine.canUseStrategy('revolt', id))).toHaveLength(2);
    expect(state.map.filter(({ id }) => engine.canUseStrategy('scorch', id))).toHaveLength(2);
  });

  it('can fight from the battle decision and opens the actual end screens', () => {
    const { engine, state } = open('battle');
    expect(state.phase).toBe('awaitingToll');
    expect(engine.canUseStrategy('ambush')).toBe(true);
    engine.fight();
    expect(state.battles).toHaveLength(1);
    const defeat = open('defeat').state;
    expect(defeat.battles[0].outcome).toBe('defeat');
    expect(defeat.players[0].fleetLost).toBe(true);
    expect(defeat.phase).toBe('gameOver');
    expect(open('victory').state).toMatchObject({ phase: 'gameOver', victory: 'everyContinent', winner: 0 });
  });

  it.each(seaEncounters)('runs the real %s sea encounter', (kind) => {
    const { engine, events, state } = open(`sea-${kind}`);
    if (kind === 'merchant') {
      expect(state.phase).toBe('awaitingMerchant');
      expect(state.pendingMerchant?.quantity).toBeGreaterThan(0);
      engine.acceptMerchant();
    } else if (kind === 'wyvern') {
      expect(state.phase).toBe('awaitingWyvern');
      engine.wyvernFly(state.players[0].homePort);
    } else if (kind === 'treasure') {
      expect(state.map[state.players[0].position].kind).toBe('sea');
      expect(state.phase).toBe('awaitingSalvage');
      engine.salvageWreck();
    }
    expect(events).toContainEqual(expect.objectContaining({ type: 'seaEvent', event: kind }));
  });
});

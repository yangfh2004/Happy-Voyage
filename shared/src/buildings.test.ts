import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, GameEngine } from './engine';
import { BUILDINGS, buildingLevel, colonyToll, nextBuildingCost } from './buildings';
import type { BuildingKind } from './types';

function seeded() {
  let seed = 42;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

function visit(aiDifficulty?: 'easy' | 'normal' | 'hard') {
  const engine = new GameEngine({ players: [
    { name: 'Builder', color: 0, isAI: aiDifficulty !== undefined, aiDifficulty }, { name: 'Rival', color: 1, isAI: true },
  ], rng: seeded() });
  const node = engine.state.map.find((n) => n.kind === 'island')!;
  engine.currentPlayer.position = node.id;
  engine.state.owners[node.id] = 0;
  engine.state.phase = 'moving';
  return { engine, node };
}

describe('colony buildings', () => {
  it('offers an empty colony, builds and upgrades repeatedly, and finishes the visit', () => {
    const { engine, node } = visit();
    const events: string[] = [];
    engine.on((event) => events.push(event.type));
    engine.resolveLanding();
    expect(events).toContain('buildOffered');
    expect(buildingLevel(engine.state, node.id, 'lumberMill')).toBe(0);
    expect(colonyToll(engine.state, node.id)).toBe(node.toll);
    const worth = engine.netWorth(0);
    for (let level = 1; level <= 3; level++) {
      engine.build('lumberMill');
      expect(buildingLevel(engine.state, node.id, 'lumberMill')).toBe(level);
      expect(engine.state.phase).toBe('awaitingBuild');
    }
    expect(engine.currentPlayer.gold).toBe(DEFAULT_CONFIG.startingGold - 360);
    expect(engine.netWorth(0)).toBe(worth - 90);
    expect(colonyToll(engine.state, node.id)).toBe(Math.floor(node.toll! * 1.75));
    expect(nextBuildingCost(engine.state, node.id, 'lumberMill')).toBeNull();
    expect(() => engine.build('lumberMill')).toThrow();
    expect(events.filter((e) => e === 'buildingBuilt')).toHaveLength(3);
    engine.finishBuilding();
    expect(engine.state.currentPlayer).toBe(1);
  });

  it('enforces each building maximum, including the single-level repair yard', () => {
    const { engine, node } = visit();
    engine.resolveLanding();
    engine.currentPlayer.gold = 10000;
    for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
      for (let i = 0; i < BUILDINGS[kind].maxLevel; i++) engine.build(kind);
      expect(engine.canBuild(kind)).toBe(false);
      expect(() => engine.build(kind)).toThrow();
      expect(buildingLevel(engine.state, node.id, kind)).toBe(BUILDINGS[kind].maxLevel);
    }
  });

  it('stocks each colony once per completed round using its building levels and local yields', () => {
    const engine = new GameEngine({
      players: [{ name: 'Builder', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }],
      config: { startingGold: 10_000, maxRounds: 2 },
      rng: seeded(),
    });
    const { state } = engine;
    const [madeira, canaries, neutral] = state.map.filter((node) => node.kind === 'island');
    state.owners[madeira.id] = 0;
    state.owners[canaries.id] = 1;
    const empty = { lumber: 0, iron: 0, specialties: {} };

    function landAtColony(nodeId: number) {
      engine.currentPlayer.position = nodeId;
      state.phase = 'moving';
      engine.resolveLanding();
    }

    landAtColony(madeira.id);
    engine.build('lumberMill');
    engine.build('lumberMill');
    engine.build('ironMine');
    engine.build('collectionField');
    engine.finishBuilding();
    expect(state.stockpiles[madeira.id]).toEqual(empty);
    expect(state.players[0].gold).toBe(10_000 - 320);

    landAtColony(canaries.id);
    engine.build('ironMine');
    engine.build('collectionField');
    engine.build('collectionField');
    engine.finishBuilding();
    expect(state.round).toBe(2);
    expect(state.currentPlayer).toBe(0);
    expect(state.stockpiles[madeira.id]).toEqual({ lumber: 2, iron: 1, specialties: { Wine: 1 } });
    expect(state.stockpiles[canaries.id]).toEqual({ lumber: 0, iron: 2, specialties: { Sugar: 2 } });
    expect(state.players.map(({ gold }) => gold)).toEqual([10_000 - 320 + 80, 10_000 - 260 + 65]);

    landAtColony(madeira.id);
    engine.build('lumberMill');
    engine.finishBuilding();
    expect(state.stockpiles[canaries.id]).toEqual({ lumber: 0, iron: 2, specialties: { Sugar: 2 } });

    landAtColony(canaries.id);
    engine.build('collectionField');
    engine.finishBuilding();
    expect(state.phase).toBe('gameOver');
    expect(state.stockpiles[madeira.id]).toEqual({ lumber: 5, iron: 2, specialties: { Wine: 2 } });
    expect(state.stockpiles[canaries.id]).toEqual({ lumber: 0, iron: 4, specialties: { Sugar: 5 } });
    expect(state.stockpiles[neutral.id]).toEqual(empty);
  });

  it('rejects wrong phases, owners, unknown kinds and insufficient gold without mutation', () => {
    const { engine, node } = visit();
    expect(() => engine.build('lumberMill')).toThrow();
    expect(() => engine.finishBuilding()).toThrow();
    engine.resolveLanding();
    engine.state.owners[node.id] = 1;
    expect(() => engine.build('lumberMill')).toThrow();
    engine.state.owners[node.id] = 0;
    engine.currentPlayer.gold = 59;
    expect(engine.canBuild('lumberMill')).toBe(false);
    expect(() => engine.build('lumberMill')).toThrow();
    expect(() => engine.build('unknown' as BuildingKind)).toThrow();
    expect(engine.currentPlayer.gold).toBe(59);
    expect(engine.state.buildings[node.id]).toEqual({});
  });

  it('charges increased tolls and clears buildings on bankruptcy', () => {
    const { engine, node } = visit();
    engine.resolveLanding();
    engine.build('lumberMill');
    const toll = colonyToll(engine.state, node.id);
    engine.finishBuilding();
    engine.currentPlayer.position = node.id;
    engine.currentPlayer.gold = 1000;
    engine.state.phase = 'moving';
    engine.resolveLanding();
    engine.payToll();
    expect(engine.state.players[1].gold).toBe(1000 - toll);
    const other = engine.state.map.find((n) => n.kind === 'island' && n.id !== node.id)!;
    engine.state.owners[other.id] = 0;
    engine.state.buildings[other.id] = { shipyard: 2 };
    engine.state.stockpiles[other.id] = { lumber: 5, iron: 2, specialties: { Sugar: 1 } };
    engine.state.players[0].position = node.id;
    engine.state.players[0].gold = 0;
    engine.state.currentPlayer = 0;
    engine.state.owners[node.id] = 1;
    engine.state.phase = 'moving';
    engine.resolveLanding();
    engine.payToll();
    expect(engine.state.players[0].bankrupt).toBe(true);
    expect(engine.state.owners[other.id]).toBeNull();
    expect(engine.state.buildings[other.id]).toEqual({});
    expect(engine.state.stockpiles[other.id]).toEqual({ lumber: 0, iron: 0, specialties: {} });
  });

  it.each([400, 1400])('AI finishes with a reserve from %ig', (gold) => {
    const { engine, node } = visit('normal');
    engine.currentPlayer.gold = gold;
    engine.resolveLanding();
    engine.decideForAI();
    expect(engine.state.players[0].gold).toBeGreaterThanOrEqual(400);
    expect(engine.state.phase).toBe('awaitingSpin');
    expect(Object.keys(engine.state.buildings[node.id]).length > 0).toBe(gold > 400);
  });

  it.each(['easy', 'normal', 'hard'] as const)('%s AI develops a newly claimed colony with a full starting fleet', (difficulty) => {
    const { engine, node } = visit(difficulty);
    engine.state.owners[node.id] = null;
    engine.resolveLanding();
    expect(engine.state.owners[node.id]).toBe(0);
    engine.decideForAI();
    expect(engine.state.buildings[node.id]).toMatchObject({ lumberMill: 1, ironMine: 1, collectionField: expect.any(Number) });
    expect(engine.state.players[0].gold).toBeGreaterThanOrEqual({ easy: 450, normal: 400, hard: 650 }[difficulty]);
  });
});

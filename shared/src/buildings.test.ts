import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { BUILDINGS, buildingLevel, colonyToll, nextBuildingCost } from './buildings';
import type { BuildingKind } from './types';

function visit() {
  const engine = new GameEngine({ players: [
    { name: 'Builder', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true },
  ] });
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
    expect(engine.currentPlayer.gold).toBe(800);
    expect(engine.netWorth(0)).toBe(worth - 150);
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

  it('rejects wrong phases, owners, unknown kinds and insufficient gold without mutation', () => {
    const { engine, node } = visit();
    expect(() => engine.build('lumberMill')).toThrow();
    expect(() => engine.finishBuilding()).toThrow();
    engine.resolveLanding();
    engine.state.owners[node.id] = 1;
    expect(() => engine.build('lumberMill')).toThrow();
    engine.state.owners[node.id] = 0;
    engine.currentPlayer.gold = 99;
    expect(engine.canBuild('lumberMill')).toBe(false);
    expect(() => engine.build('lumberMill')).toThrow();
    expect(() => engine.build('unknown' as BuildingKind)).toThrow();
    expect(engine.currentPlayer.gold).toBe(99);
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
    expect(engine.state.players[1].gold).toBe(1000 - toll);
    const other = engine.state.map.find((n) => n.kind === 'island' && n.id !== node.id)!;
    engine.state.owners[other.id] = 0;
    engine.state.buildings[other.id] = { shipyard: 2 };
    engine.state.players[0].position = node.id;
    engine.state.players[0].gold = 0;
    engine.state.currentPlayer = 0;
    engine.state.owners[node.id] = 1;
    engine.state.phase = 'moving';
    engine.resolveLanding();
    expect(engine.state.players[0].bankrupt).toBe(true);
    expect(engine.state.owners[other.id]).toBeNull();
    expect(engine.state.buildings[other.id]).toEqual({});
  });

  it.each([400, 1400])('AI finishes with a reserve from %ig', (gold) => {
    const { engine, node } = visit();
    engine.currentPlayer.gold = gold;
    engine.resolveLanding();
    engine.decideForAI();
    expect(engine.state.players[0].gold).toBeGreaterThanOrEqual(400);
    expect(engine.state.phase).toBe('awaitingSpin');
    expect(Object.keys(engine.state.buildings[node.id]).length > 0).toBe(gold > 400);
  });
});

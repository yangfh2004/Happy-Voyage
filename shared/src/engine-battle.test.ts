import { describe, expect, it } from 'vitest';
import { colonyDefenders } from './combat';
import { GameEngine, SEA_RULES } from './engine';
import type { GameEvent } from './types';

function siege(attackerAI = false, defenderAI = true, mode: 'realtime' | 'auto' = 'realtime') {
  const game = new GameEngine({ players: [{ name: 'Attacker', color: 0, isAI: attackerAI }, { name: 'Defender', color: 1, isAI: defenderAI }],
    rng: () => 0.5, config: { battleMode: mode, startingStrategies: 0 } });
  const node = game.state.map.find((n) => n.kind === 'island')!;
  game.state.owners[node.id] = 1;
  game.currentPlayer.position = node.id;
  game.state.phase = 'awaitingToll';
  return { game, node };
}

describe('real-time engine integration', () => {
  it.each(['auto', 'realtime'] as const)('lets the conqueror develop and dock a garrison immediately in %s mode', (mode) => {
    const { game, node } = siege(false, false, mode);
    const { state, currentPlayer: attacker } = game;
    for (const ship of attacker.fleet) ship.firepower = 1000;
    const defenders = state.players[1].fleet.splice(-1);
    defenders[0].durability = 1;
    defenders[0].firepower = 0;
    state.docks[node.id] = defenders;
    state.buildings[node.id].shipyard = 1;
    state.stockpiles[node.id] = { lumber: 2, iron: 1, specialties: {} };
    const gold = attacker.gold;
    const report = game.fight() ?? game.finishBattle([])!;
    expect(report.outcome).toBe('victory');
    expect(state.currentPlayer).toBe(attacker.id);
    expect(state.phase).toBe('awaitingBuild');
    expect(state.marketStock).toEqual(['explorer', 'cargo', 'warship']);
    expect(attacker.gold).toBe(gold);
    const guard = game.buildShip('explorer');
    game.dockShip(guard.id);
    expect(state.docks[node.id]).toEqual([guard]);
    expect(attacker.fleet).not.toContain(guard);
    game.finishBuilding();
    expect(state.currentPlayer).not.toBe(attacker.id);
    expect(colonyDefenders(state, node.id)).toEqual({ ships: [guard], owner: attacker, fromFleet: false });
  });

  it.each(['auto', 'realtime'] as const)('does not charge double toll for preexisting zero durability under Ambush in %s mode', (mode) => {
    const { game } = siege(false, true, mode);
    const [attacker, defender] = game.state.players;
    attacker.fleet.forEach((s, i) => { s.durability = i < 3 ? 0 : s.maxDurability; s.firepower = 0; });
    attacker.fleet[0].signature = true;
    defender.fleet.forEach((s) => { s.durability = s.maxDurability; s.firepower = 0; });
    game.state.ambush = true;
    const gold = attacker.gold;
    const report = game.fight() ?? game.finishBattle([])!;
    expect(report).toMatchObject({ outcome: 'draw', attackerSunk: [], defenderSunk: [], tollPaid: 0 });
    expect(attacker.gold).toBe(gold);
    expect(attacker.fleet).toHaveLength(8);
    expect(attacker.fleet.slice(0, 3).map((s) => s.durability)).toEqual([0, 0, 0]);
  });

  it.each(['auto', 'realtime'] as const)('returns withdrawing docked defenders to their owner in %s mode', (mode) => {
    const { game, node } = siege(false, true, mode);
    const [attacker, defender] = game.state.players;
    const guards = defender.fleet.splice(1, 2);
    const ids = guards.map((s) => s.id);
    for (const s of guards) { s.durability = 1; s.firepower = 0; }
    for (const s of attacker.fleet) s.firepower = 1000;
    game.state.docks[node.id] = guards;
    const report = game.fight() ?? game.finishBattle([])!;
    expect(report.outcome).toBe('victory');
    expect(game.state.owners[node.id]).toBe(attacker.id);
    expect(game.state.docks[node.id]).toEqual([]);
    const survivors = defender.fleet.filter((s) => ids.includes(s.id));
    expect(survivors).toHaveLength(mode === 'auto' ? 1 : 2);
    expect(survivors.every((s) => s.durability === 1)).toBe(true);
    expect(attacker.fleet.some((s) => survivors.includes(s))).toBe(false);
  });

  it('returns conceding docked defenders to their owner, not the conqueror', () => {
    const { game, node } = siege(true, false);
    const [attacker, defender] = game.state.players;
    const guards = defender.fleet.splice(1, 2);
    const ids = guards.map((s) => s.id);
    guards[0].durability = 60;
    game.state.docks[node.id] = guards;
    game.fight();
    const report = game.finishBattle([{ tick: 0, side: 'defender', cmd: { type: 'retreat' } }])!;
    expect(report.outcome).toBe('victory');
    expect(game.state.owners[node.id]).toBe(attacker.id);
    expect(game.state.docks[node.id]).toEqual([]);
    expect(defender.fleet.filter((s) => ids.includes(s.id))).toHaveLength(2);
    expect(defender.fleet.find((s) => s.id === ids[0])!.durability).toBe(60);
    game.state.currentPlayer = attacker.id;
    attacker.position = node.id;
    game.state.phase = 'awaitingBuild';
    expect(() => game.boardShip(ids[0])).toThrow('Ship not available here');
  });

  it.each([false, true])('settles a human concession as defeat (defending=%s) without removing survivors', (defending) => {
    const { game, node } = siege(defending, !defending);
    const [attacker, defender] = game.state.players;
    attacker.fleet[0].durability = 70;
    defender.fleet[0].durability = 80;
    game.fight();
    const report = game.finishBattle([{ tick: 0, side: defending ? 'defender' : 'attacker', cmd: { type: 'retreat' } }])!;
    expect(report.outcome).toBe(defending ? 'victory' : 'defeat');
    expect(game.state.owners[node.id]).toBe(defending ? attacker.id : defender.id);
    expect(report.tollPaid > 0).toBe(!defending);
    expect(attacker.fleet).toHaveLength(8);
    expect(defender.fleet).toHaveLength(8);
    expect(attacker.fleet[0].durability).toBe(70);
    expect(defender.fleet[0].durability).toBe(80);
    expect(game.state.pendingBattle).toBeNull();
    expect(game.state.phase).not.toBe('awaitingBattle');
  });

  it('defaults to real-time, snapshots ships, emits battleStarted, and suspends AI decisions', () => {
    const { game } = siege();
    const events: GameEvent[] = [];
    game.on((e) => events.push(e));
    expect(game.fight()).toBeNull();
    expect(game.state.phase).toBe('awaitingBattle');
    expect(game.state.pendingBattle).toMatchObject({ kind: 'colony', attacker: 0, defender: 1, commanders: ['attacker'] });
    expect(events.some((e) => e.type === 'battleStarted')).toBe(true);
    expect(game.state.pendingBattle!.setup.attackers[0]).not.toBe(game.currentPlayer.fleet[0]);
    game.decideForAI();
    expect(game.state.phase).toBe('awaitingBattle');
    expect(() => game.fight()).toThrow('Expected phase awaitingToll');
  });

  it('lets the human defender command when attacked by AI and gives hot-seat control to the attacker', () => {
    const { game } = siege(true, false);
    game.fight();
    expect(game.state.pendingBattle!.commanders).toEqual(['defender']);
    const hotseat = siege(false, false).game;
    hotseat.fight();
    expect(hotseat.state.pendingBattle!.commanders).toEqual(['attacker']);
  });

  it.each(['victory', 'defeat', 'draw'] as const)('settles %s through the existing colony settlement', (outcome) => {
    const { game, node } = siege();
    const [attacker, defender] = game.state.players;
    for (const s of attacker.fleet) { s.firepower = outcome === 'victory' ? 1000 : 0; s.durability = outcome === 'defeat' ? 1 : 100; }
    for (const s of defender.fleet) { s.firepower = outcome === 'defeat' ? 1000 : 0; s.durability = outcome === 'victory' ? 1 : 100; }
    game.state.inspired = true;
    game.fight();
    const report = game.finishBattle([])!;
    expect(report.outcome).toBe(outcome);
    expect(game.state.battles).toContain(report);
    expect(game.state.pendingBattle).toBeNull();
    expect(game.state.inspired).toBe(false);
    expect(game.state.ambush).toBe(false);
    expect(game.state.phase).not.toBe('awaitingBattle');
    if (outcome === 'victory') { expect(game.state.owners[node.id]).toBe(0); expect(defender.fleet).toHaveLength(8); }
    if (outcome === 'defeat') { expect(report.tollPaid).toBeGreaterThan(0); expect(attacker.fleet).toHaveLength(8); }
    if (outcome === 'draw') { expect(attacker.position).toBe(attacker.homePort); expect(defender.position).toBe(defender.homePort); }
    expect(() => game.finishBattle([])).toThrow('Expected phase awaitingBattle');
  });

  it('leaves AI vs AI and explicit auto mode on the old resolver', () => {
    for (const game of [siege(true, true).game, siege(false, true, 'auto').game]) {
      expect(game.fight()).not.toBeNull();
      expect(game.state.pendingBattle).toBeNull();
      expect(game.state.battles[0].rounds).toBeLessThanOrEqual(3);
    }
  });

  it.each([true, false])('settles human pirates with the original loot and last-ship rules (win=%s)', (win) => {
    const { game } = siege();
    const player = game.currentPlayer;
    const node = game.state.map.find((n) => n.event === 'openSea')!;
    node.event = 'pirates';
    player.position = node.id;
    player.fleet = [player.fleet[0]];
    player.fleet[0].firepower = win ? 1000 : 0;
    player.fleet[0].durability = win ? 100 : 1;
    const gold = player.gold;
    game.state.phase = 'moving';
    game.resolveLanding();
    expect(game.state.phase).toBe('awaitingBattle');
    expect(game.state.pendingBattle).toMatchObject({ kind: 'pirates', defender: null, commanders: ['attacker'], resumeLanding: false });
    const saved = JSON.parse(JSON.stringify(game.state));
    const restored = siege().game;
    Object.assign(restored.state, saved);
    game.finishBattle([]);
    restored.finishBattle([]);
    expect(restored.state.players[0]).toEqual(player);
    expect(player.gold).toBe(gold + (win ? SEA_RULES.pirateLoot : -SEA_RULES.pirates));
    expect(player.fleet).toHaveLength(1);
    if (!win) expect(player.fleet[0].durability).toBe(1);
    expect(game.state.phase).not.toBe('awaitingBattle');
  });

  it('resumes landing after a roaming pirate encounter instead of ending the turn', () => {
    const { game, node } = siege();
    game.state.roamers = [{ id: 1, kind: 'pirates', node: node.id }];
    game.state.owners[node.id] = null;
    game.currentPlayer.position = node.id;
    game.state.phase = 'awaitingSpin';
    game.spinCompass();
    game.sail();
    const destination = game.currentPlayer.position;
    game.state.roamers = [{ id: 1, kind: 'pirates', node: destination }];
    game.resolveLanding();
    expect(game.state.pendingBattle!.resumeLanding).toBe(true);
    game.finishBattle([{ tick: 0, side: 'attacker', cmd: { type: 'retreat' } }]);
    expect(game.state.pendingBattle).toBeNull();
    expect(game.state.phase).not.toBe('awaitingBattle');
  });
});

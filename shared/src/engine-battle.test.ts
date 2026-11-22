import { describe, expect, it } from 'vitest';
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
    if (outcome === 'victory') { expect(game.state.owners[node.id]).toBe(0); expect(defender.fleet).toHaveLength(0); }
    if (outcome === 'defeat') { expect(report.tollPaid).toBeGreaterThan(0); expect(attacker.fleet).toHaveLength(0); }
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

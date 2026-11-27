import { afterEach, describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { DEFAULT_GAMEPLAY_TUNING, gameplayTuningFields, resolveGameplayTuning, selectGameplayTuning } from './gameplayTuning';

afterEach(() => selectGameplayTuning());

const engine = () => new GameEngine({ players: [{ name: 'Sailor', color: 1, isAI: false }], rng: () => 0.5 });

describe('desktop gameplay tuning', () => {
  it('keeps stock gameplay when the default template or no file is used', () => {
    const stock = engine().state;
    expect(stock.players[0].gold).toBe(3200);
    expect(stock.players[0].fleet.map(({ type }) => type)).toEqual([
      'warship', 'cargo', 'explorer', 'explorer', 'explorer', 'warship', 'warship', 'warship',
    ]);
    expect(resolveGameplayTuning()).toEqual({ rules: DEFAULT_GAMEPLAY_TUNING, warnings: [] });
    const { rules, warnings } = resolveGameplayTuning(JSON.parse(JSON.stringify(DEFAULT_GAMEPLAY_TUNING)));
    expect(warnings).toEqual([]);
    selectGameplayTuning(rules);
    expect(engine().state).toEqual(stock);
  });

  it('validates nested partial values and uses accepted settings in a new voyage', () => {
    const { rules, warnings } = resolveGameplayTuning({
      starting: { gold: 9999, fleet: ['warship', 'warship', 'cargo'], strategies: '3' },
      ships: { warship: { firepower: 45, speed: 0, unknown: true } },
      market: { normalStock: 22 },
      map: { colonyBasePrice: 200 },
      sea: null,
    });
    expect(warnings.sort()).toEqual(['sea', 'ships.warship.speed', 'ships.warship.unknown', 'starting.strategies']);
    selectGameplayTuning(rules);
    const { players, market, map } = engine().state;
    expect(players[0].gold).toBe(9999);
    expect(players[0].strategies).toHaveLength(3);
    expect(players[0].fleet.map(({ type }) => type)).toEqual(['warship', 'warship', 'cargo']);
    expect(players[0].fleet[0]).toMatchObject({ firepower: 45, speed: 4 });
    expect(market.stock.lumber).toBe(22);
    expect(map.find(({ kind }) => kind === 'island')?.price).toBe(200);
    selectGameplayTuning();
    expect(engine().state.players[0].gold).toBe(3200);
  });

  it('rejects unknown keys without changing the prototype and falls back on conflicting settings', () => {
    const { rules, warnings } = resolveGameplayTuning(JSON.parse('{"__proto__":{},"ships":{"maxFleetSize":1},"sea":{"storm":{"min":500}}}'));
    expect(warnings).toEqual(['__proto__', 'ships.maxFleetSize', 'sea.storm']);
    expect(rules).toEqual(DEFAULT_GAMEPLAY_TUNING);
    expect(gameplayTuningFields().length).toBeGreaterThan(100);
  });

  it('keeps older chart spacing overrides without changing the stock chart', () => {
    expect(resolveGameplayTuning().rules.map.targetSeaSpacing).toBe(300);
    for (const targetSeaSpacing of [255, 275, 299]) {
      const { rules, warnings } = resolveGameplayTuning({ map: { targetSeaSpacing } });
      expect(rules.map.targetSeaSpacing).toBe(targetSeaSpacing);
      expect(warnings).toEqual([]);
    }
    selectGameplayTuning(resolveGameplayTuning({ map: { targetSeaSpacing: 255 } }).rules);
    expect(engine().state.map.filter(node => node.kind === 'sea')).toHaveLength(73);
  });

  it('rejects a one-ship capacity even if the starting fleet fits', () => {
    const starting = { fleet: ['warship'] };
    const rejected = resolveGameplayTuning({ starting, ships: { maxFleetSize: 1 } });
    expect(rejected.warnings).toEqual(['ships.maxFleetSize']);
    expect(rejected.rules.ships.maxFleetSize).toBe(DEFAULT_GAMEPLAY_TUNING.ships.maxFleetSize);
    expect(rejected.rules.starting.fleet).toEqual(starting.fleet);
    expect(resolveGameplayTuning({ starting, ships: { maxFleetSize: 2 } }).warnings).toEqual([]);
  });

  it('warns on settings for nonexistent Wind Island rewards and Ensign promotion', () => {
    const { rules, warnings } = resolveGameplayTuning({
      sea: { barterPerColony: 9999 },
      ranks: { ensign: { merit: 50, purse: 9999, salary: 75 } },
    });
    expect(warnings).toEqual(['ranks.ensign.merit', 'ranks.ensign.purse', 'sea.barterPerColony']);
    expect(rules.ranks.ensign.salary).toBe(75);
  });
});

import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { NATIONS, createNationRoster } from './nations';
import { NAVIGATORS, navigatorById, navigatorForNation } from './navigators';
import { SHIP_TYPES } from './ships';

describe('navigators', () => {
  it('gives every nation one navigator with a signature ship', () => {
    expect(NAVIGATORS.map((n) => n.nation).sort()).toEqual(NATIONS.map((n) => n.name).sort());
    expect(new Set(NAVIGATORS.map((n) => n.id)).size).toBe(NAVIGATORS.length);
    expect(navigatorForNation('China')).toMatchObject({ name: 'Zheng He', chineseName: '郑和' });
    for (const name of ['Columbus', 'Juliana', 'Cook', 'Morgan', 'Magellan', 'Zheng He']) {
      expect(NAVIGATORS.some((n) => n.name === name)).toBe(true);
    }
  });

  it('assigns each roster seat its nation navigator and names AI rivals after them', () => {
    const roster = createNationRoster([{ name: 'Me', nation: 'England' }]);
    expect(roster[0]).toMatchObject({ name: 'Me', nation: 'England', navigator: 'cook', isAI: false });
    expect(roster.find((seat) => seat.nation === 'Spain')).toMatchObject({ name: 'Columbus', navigator: 'columbus', isAI: true });
    expect(roster.every((seat) => navigatorById(seat.navigator!)?.nation === seat.nation)).toBe(true);
  });

  it('replaces the starting ship of the flagship type with the signature ship', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Me', nation: 'Korea' }]) });
    for (const player of state.players) {
      const { signatureShip } = navigatorById(player.navigator!)!;
      expect(player.fleet.map((ship) => ship.type)).toEqual(['warship', 'cargo', 'explorer', 'explorer', 'explorer', 'warship', 'warship', 'warship']);
      for (const ship of player.fleet) expect(ship.cargo).toEqual({});
      const flagships = player.fleet.filter((ship) => ship.signature);
      expect(flagships).toHaveLength(1);
      const [flagship] = flagships;
      expect(flagship).toMatchObject({ name: signatureShip.name, type: signatureShip.type });
      const base = SHIP_TYPES[signatureShip.type];
      for (const stat of ['maxDurability', 'firepower', 'cargoCapacity', 'speed', 'crewCapacity'] as const) {
        expect(flagship[stat]).toBe(base[stat] + ((signatureShip.bonus as Record<string, number>)[stat] ?? 0));
      }
      expect(flagship.durability).toBe(flagship.maxDurability);
    }
    expect(state.players[0].fleet.find((ship) => ship.signature)).toMatchObject({ name: 'Turtle Ship', firepower: 38, maxDurability: 150 });
  });

  it('rejects an unknown navigator', () => {
    expect(() => new GameEngine({ players: [{ name: 'X', color: 0, isAI: false, navigator: 'nobody' }] })).toThrow('Unknown navigator: nobody');
  });
});

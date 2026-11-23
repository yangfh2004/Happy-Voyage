import { describe, expect, it } from 'vitest';
import { SHIP_TYPES, type BattleShip } from '@happy-voyage/shared';
import { battleClassName, battleNameVisible, battleSelectionText } from './battleHud';

const ship = (id: number, side: BattleShip['side'] = 'attacker'): BattleShip => ({
  ...SHIP_TYPES.warship, id, name: 'Victory', type: 'warship', durability: 80, cargo: {},
  side, x: 400, y: 450, heading: 0, vx: 0, vy: 0, reload: { port: 0, starboard: 0 }, sunk: false, escaped: false, startedAfloat: true, order: { type: 'free' }, charge: false,
});

describe('nautical battle HUD', () => {
  it('localizes variant names and selected ship combat statistics', () => {
    const s = { ...ship(1), maxDurability: 150, reload: { port: 1.2, starboard: 0 } };
    expect(battleClassName(s, 'en')).toBe('Frigate');
    expect(battleClassName(s, 'zh')).toBe('护卫舰');
    expect(battleSelectionText([s], 'zh')).toContain('射程 640');
    expect(battleSelectionText([s], 'en')).toContain('Reload 1.2s');
    expect(battleSelectionText([s], 'en')).toContain('Starboard Ready');
    expect(battleSelectionText([s], 'zh', true)).toContain('\n左舷 装填 1.2s · 右舷 就绪');
    expect(battleSelectionText([s], 'zh', true).split('\n')).toHaveLength(3);
    expect(battleSelectionText([ship(1)], 'en')).toContain('Ready');
    expect(battleClassName({ ...s, signature: true }, 'zh')).toBe('战列舰');
  });

  it('handles empty and multiple selections without stale individual details', () => {
    expect(battleSelectionText([], 'en')).toContain('Select');
    expect(battleSelectionText([ship(1), ship(2)], 'zh')).toBe('已选 2 艘舰船  ·  耐久 160/240');
    expect(battleSelectionText([ship(1), ship(2)], 'en')).toContain('2 ships selected');
  });

  it('shows friendly names, hides untargeted enemies, and follows attack orders', () => {
    const own = ship(1), enemy = ship(2, 'defender');
    expect(battleNameVisible(own, 'attacker', new Set(), [own, enemy])).toBe(true);
    expect(battleNameVisible(enemy, 'attacker', new Set([1]), [own, enemy])).toBe(false);
    own.order = { type: 'attack', targetId: 2 };
    expect(battleNameVisible(enemy, 'attacker', new Set([1]), [own, enemy])).toBe(true);
    expect(battleNameVisible(enemy, 'attacker', new Set(), [own, enemy])).toBe(false);
    expect(battleNameVisible(own, 'defender', new Set(), [own, enemy])).toBe(false);
  });
});

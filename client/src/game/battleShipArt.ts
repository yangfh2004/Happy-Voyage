import type Phaser from 'phaser';
import type { BattleShip, ShipType } from '@happy-voyage/shared';

const designs = {
  warship: { stern: -78, bow: 92, beam: 38, yards: 57, masts: [-39, 6, 49], ports: [-52, -25, 2, 29, 52] },
  cargo: { stern: -72, bow: 84, beam: 49, yards: 51, masts: [-27, 32], ports: [-38, 33] },
  explorer: { stern: -68, bow: 86, beam: 26, yards: 39, masts: [-24, 35], ports: [-33, 28] },
} satisfies Record<ShipType, unknown>;

export function battleShipTexture(scene: Phaser.Scene, type: ShipType, color: number, pirate = false, signature = false): string {
  const key = `battle-ship-${type}-${color}-${pirate}-${signature}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  const d = designs[type];
  const point = (x: number, y: number) => ({ x: 128 + x, y: 96 + y });
  const hull = [point(d.stern, -d.beam * .7), point(d.stern + 14, -d.beam * .94), point(-25, -d.beam),
    point(30, -d.beam * .88), point(d.bow - 25, -d.beam * .5), point(d.bow, 0),
    point(d.bow - 25, d.beam * .5), point(30, d.beam * .88), point(-25, d.beam),
    point(d.stern + 14, d.beam * .94), point(d.stern, d.beam * .7)];
  g.fillStyle(0x251a16).fillPoints(hull, true);
  const deck = hull.map((p) => ({ x: 128 + (p.x - 128) * .91, y: 96 + (p.y - 96) * .8 }));
  g.fillStyle(0xb18a58).fillPoints(deck, true);
  g.lineStyle(3, signature ? 0xf4cf70 : 0x73492d).strokePoints(hull, true);
  for (let y = -d.beam * .6; y <= d.beam * .6; y += 7) {
    g.lineStyle(1, 0x684a30, .55).lineBetween(128 + d.stern + 9, 96 + y, 128 + d.bow - 39, 96 + y);
    for (let x = d.stern + 23; x < d.bow - 45; x += 31) g.lineBetween(128 + x + (y % 2) * 4, 96 + y, 128 + x + (y % 2) * 4, 100 + y);
  }
  g.fillStyle(0x62442e).fillRoundedRect(128 + d.stern + 8, 96 - d.beam * .53, 24, d.beam * 1.06, 3);
  g.lineStyle(2, signature ? 0xf4cf70 : 0xd2b379).strokeRect(128 + d.stern + 11, 96 - d.beam * .43, 18, d.beam * .86);
  g.fillStyle(0x44382c).fillRect(126, 89, 17, 14);
  g.lineStyle(1, 0xc7aa7a).strokeRect(126, 89, 17, 14);
  for (const x of d.ports) for (const side of [-1, 1]) {
    const y = 96 + side * d.beam * .82;
    g.lineStyle(type === 'warship' ? 5 : 3, 0x23272b).lineBetween(128 + x, y - side * 4, 128 + x, y + side * 9);
    g.lineStyle(1, 0x90938d).lineBetween(129 + x, y, 129 + x, y + side * 7);
  }
  g.lineStyle(3, 0x78502d).lineBetween(128 + d.bow - 15, 96, 128 + d.bow + 19, 96);
  g.lineStyle(1, 0xdfc38e, .8).lineBetween(128 + d.bow + 16, 96, 128 + d.bow - 31, 83).lineBetween(128 + d.bow + 16, 96, 128 + d.bow - 31, 109);
  for (const x of d.masts) {
    const span = d.yards;
    g.lineStyle(1, 0x2c2824, .65).lineBetween(128 + x, 96 - span, 128 + x - 33, 96).lineBetween(128 + x - 33, 96, 128 + x, 96 + span);
    g.fillStyle(0x30241c, .3).fillEllipse(132 + x, 99, 35, span * 1.8);
    g.lineStyle(4, 0x563b27).lineBetween(115 + x, 94 - span, 115 + x, 98 + span);
    const cloth = [point(x - 13, -span * .88), point(x + 7, -span * .94), point(x + 15, -span * .6), point(x + 19, 0),
      point(x + 15, span * .6), point(x + 7, span * .94), point(x - 13, span * .88), point(x - 6, 0)];
    g.fillStyle(pirate ? 0x24232a : color).fillPoints(cloth, true);
    g.lineStyle(1.5, pirate ? 0x8e4342 : 0xe3d7ad, .75).strokePoints(cloth, true);
    g.fillStyle(0xfff1c9, .18).fillPoints([point(x - 11, -span * .83), point(x + 6, -span * .87), point(x + 13, 0), point(x - 5, 0)], true);
    g.lineStyle(1, 0x171e24, .32).lineBetween(133 + x, 96 - span * .8, 140 + x, 96).lineBetween(140 + x, 96, 133 + x, 96 + span * .8);
    g.fillStyle(0xd2ac6e).fillCircle(117 + x, 96, 3);
    if (pirate) g.lineStyle(3, 0xb54037).lineBetween(128 + x, 96 - span * .75, 128 + x, 96 + span * .75);
  }
  g.fillStyle(pirate ? 0xc53c32 : color).fillTriangle(128 + d.stern + 13, 96, 128 + d.stern - 15, 84, 128 + d.stern - 11, 100);
  g.lineStyle(1, signature ? 0xf4cf70 : 0xd7c39b).lineBetween(128 + d.stern + 13, 96, 128 + d.stern - 15, 84);
  g.generateTexture(key, 256, 192);
  g.destroy();
  return key;
}

export function broadsideMuzzles(ship: Pick<BattleShip, 'x' | 'y' | 'heading' | 'type'>, target: { x: number; y: number }) {
  const heading = ship.heading * Math.PI / 180;
  const dx = Math.cos(heading), dy = Math.sin(heading);
  const side = dx * (target.y - ship.y) - dy * (target.x - ship.x) >= 0 ? 1 : -1;
  const d = designs[ship.type];
  const normal = side * (d.beam * .82 + 10) * 132 / 256;
  return d.ports.filter((_, i) => i % 2 === 0).map((port) => ({
    x: ship.x + dx * port * 132 / 256 - dy * normal,
    y: ship.y + dy * port * 132 / 256 + dx * normal,
    dx: -dy * side, dy: dx * side,
  }));
}

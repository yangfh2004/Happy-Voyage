import type Phaser from 'phaser';
import type { EventKind, MapNode, SpecialKind } from '@happy-voyage/shared';
import { islandLandscape } from './islandArt';

const SPECIAL_COLORS: Record<SpecialKind, number> = {
  skeleton: 0x96758c, treasure: 0xe4bc59, mist: 0x9dadd0, revival: 0x75b9a2,
  nightless: 0x7875b3, wind: 0x8fc6ab, dragonSnake: 0xbd8661,
};
const EVENT_COLORS: Record<EventKind, number> = {
  treasure: 0x72bdc2, storm: 0x6e849e, tradeWind: 0x9ac6be, pirates: 0xad756f,
  smallMonster: 0x88ad70, largeMonster: 0x8c79ab, turtle: 0x95ba87, whirlpool: 0x648eb6,
  bottle: 0xa7c4a8, floatingCargo: 0xc0a073, merchant: 0xc4b17e, wyvern: 0xa485b8,
};

export function specialIslandTexture(scene: Phaser.Scene, node: MapNode): string {
  const theme = node.kind === 'special' ? node.special : node.kind === 'event' ? node.event : undefined;
  const key = `stop-${node.kind}-${theme ?? 'unknown'}-${node.id}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  const ink = 0x213f50;
  const sand = node.kind === 'special' ? SPECIAL_COLORS[node.special!] : EVENT_COLORS[node.event!];
  const { coast } = islandLandscape(node);
  const land = (scale: number, color: number, alpha = 1, dy = 0) => {
    const points = coast.map(p => ({ x: 80 + (p.x - 80) * scale, y: 83 + (p.y - 76) * scale * .8 + dy }));
    g.fillStyle(color, alpha).fillPoints(points, true);
    return points;
  };
  land(1.2, 0x9ce5d4, .4, 5);
  const beach = land(1, 0xf5dfab);
  g.lineStyle(2, ink, .65).strokePoints(beach, true);
  land(.84, sand ?? 0x92ab8e, 1, -2);
  g.lineStyle(3, ink, 1);

  const crate = (x: number, y: number, color = 0xb87940) => {
    g.fillStyle(color).fillRoundedRect(x, y, 24, 24, 3);
    g.lineStyle(2, ink).strokeRect(x, y, 24, 24).lineBetween(x, y, x + 24, y + 24).lineBetween(x + 24, y, x, y + 24);
  };
  const coin = (x: number, y: number, silver = false) => {
    g.fillStyle(silver ? 0xb2ced6 : 0xd49a24).fillEllipse(x, y, 18, 10);
    g.fillStyle(silver ? 0xf0faff : 0xffe684).fillEllipse(x, y - 3, 18, 9);
    g.lineStyle(1, ink, .7).strokeEllipse(x, y - 3, 18, 9);
  };
  const skull = (x: number, y: number, size = 1) => {
    g.fillStyle(0xfff1ce).fillCircle(x, y, 21 * size).fillRoundedRect(x - 12 * size, y + 12 * size, 24 * size, 15 * size, 3);
    g.fillStyle(ink).fillCircle(x - 8 * size, y, 6 * size).fillCircle(x + 8 * size, y, 6 * size)
      .fillTriangle(x, y + 6 * size, x - 4 * size, y + 12 * size, x + 4 * size, y + 12 * size);
    for (let i = -1; i <= 1; i++) g.lineStyle(2, ink).lineBetween(x + i * 6 * size, y + 19 * size, x + i * 6 * size, y + 26 * size);
  };
  const sailboat = (color: number) => {
    g.fillStyle(0x764a37).fillPoints([{ x: 40, y: 78 }, { x: 124, y: 78 }, { x: 109, y: 96 }, { x: 57, y: 96 }], true);
    g.lineStyle(4, ink).lineBetween(80, 24, 80, 79);
    g.fillStyle(color).fillTriangle(75, 25, 47, 71, 75, 69);
    g.fillStyle(0xfff2cb).fillTriangle(86, 31, 86, 70, 115, 70);
    g.lineStyle(2, 0xffde81).lineBetween(50, 84, 115, 84);
  };

  if (node.kind === 'special') {
    switch (node.special) {
      case 'skeleton':
        g.lineStyle(7, 0xf6e6c5).lineBetween(49, 85, 110, 43).lineBetween(49, 43, 110, 85);
        g.lineStyle(3, ink).strokeCircle(80, 55, 24);
        skull(80, 54);
        break;
      case 'treasure':
        g.fillStyle(0x74432f).fillRoundedRect(43, 57, 70, 36, 5);
        g.fillStyle(0xa96a38).fillRoundedRect(43, 32, 70, 28, 7);
        g.lineStyle(4, 0xffd772).strokeRoundedRect(43, 32, 70, 60, 5);
        for (let i = 0; i < 3; i++) {
          g.fillStyle(0xd89a20).fillRect(49 + i * 20, 59 - i * 4, 20, 14);
          g.fillStyle(0xffe27c).fillTriangle(49 + i * 20, 59 - i * 4, 58 + i * 20, 49 - i * 4, 69 + i * 20, 59 - i * 4);
        }
        for (const [x, y] of [[119, 105], [119, 97], [111, 88]]) {
          g.fillStyle(0x71889e).fillEllipse(x, y + 4, 34, 20);
          g.lineStyle(3, ink).strokeEllipse(x, y + 4, 34, 20);
          g.fillStyle(0xf2faff).fillEllipse(x, y, 34, 20);
          g.lineStyle(3, ink).strokeEllipse(x, y, 34, 20);
          g.lineStyle(2, 0x92a9bd).strokeEllipse(x, y, 24, 12);
          g.lineStyle(3, 0xffffff).lineBetween(x - 7, y - 4, x + 3, y - 4);
        }
        coin(48, 97);
        g.fillStyle(0xffebac).fillRect(75, 77, 11, 12);
        break;
      case 'mist':
        g.fillStyle(0x5f6989).fillTriangle(42, 86, 74, 27, 111, 86);
        g.fillStyle(0xeee4d1).fillTriangle(67, 42, 74, 27, 86, 49);
        for (let i = 0; i < 5; i++) {
          g.fillStyle(0xe8f5ff, .55 + i * .06).fillEllipse(70 + i % 2 * 24, 46 + i * 13, 113 - i * 7, 18);
          g.lineStyle(2, 0xb9d5e8, .9).lineBetween(26 + i * 4, 50 + i * 13, 120 - i * 3, 50 + i * 13);
        }
        break;
      case 'revival':
        g.fillStyle(0x785845).fillRoundedRect(43, 69, 75, 29, 4);
        g.lineStyle(6, 0xd7b881).lineBetween(50, 56, 50, 100).lineBetween(111, 56, 111, 100);
        g.fillStyle(0xfff1cf).fillRoundedRect(60, 34, 41, 46, 5);
        g.fillStyle(0xd86955).fillRect(75, 42, 11, 30).fillRect(65, 51, 31, 11);
        g.lineStyle(5, ink).lineBetween(117, 43, 101, 61);
        g.fillStyle(0xb6d2d6).fillRoundedRect(110, 35, 22, 12, 3);
        break;
      case 'nightless':
        g.fillStyle(0xfce7a0).fillCircle(116, 32, 17);
        g.fillStyle(0x7875b3).fillCircle(123, 26, 15);
        g.fillStyle(0x66453e).fillRect(46, 61, 70, 37);
        for (let i = 0; i < 5; i++) {
          g.fillStyle(i % 2 ? 0xe9c878 : 0x454872).fillPoints([{ x: 41 + i * 16, y: 62 }, { x: 50 + i * 12, y: 39 }, { x: 62 + i * 12, y: 39 }, { x: 57 + i * 16, y: 62 }], true);
        }
        g.fillStyle(0xffde7b).fillRect(55, 71, 16, 13).fillRect(91, 71, 16, 13);
        crate(38, 87); coin(109, 98);
        break;
      case 'wind':
        crate(51, 73); crate(88, 73, 0xd8b777);
        g.lineStyle(5, 0xfff0c3).lineBetween(41, 47, 111, 47).lineBetween(116, 64, 48, 64);
        g.fillStyle(0xfff0c3).fillTriangle(111, 37, 125, 47, 111, 57).fillTriangle(48, 54, 34, 64, 48, 74);
        g.lineStyle(3, ink).lineBetween(75, 27, 92, 27).lineBetween(78, 18, 102, 18);
        break;
      case 'dragonSnake':
        g.fillStyle(0xf0d7a2).fillRoundedRect(50, 57, 61, 41, 4);
        g.fillStyle(0x974e42).fillTriangle(35, 60, 80, 29, 126, 60);
        g.lineStyle(4, 0xffdc7d).lineBetween(37, 60, 122, 60);
        g.fillStyle(0x422f36).fillRoundedRect(72, 72, 19, 27, 7);
        g.lineStyle(3, ink).lineBetween(116, 61, 116, 85).strokeCircle(124, 81, 9);
        g.fillStyle(0xffd575).fillRect(118, 75, 11, 13);
        g.lineStyle(4, 0x497f67).lineBetween(55, 43, 48, 28).lineBetween(101, 44, 109, 28);
        break;
    }
  } else {
    switch (node.event) {
      case 'treasure':
        g.fillStyle(0x3e98ae, .8).fillEllipse(80, 81, 103, 48);
        coin(61, 81); coin(82, 90, true); coin(100, 76);
        g.fillStyle(0xa4edeb).fillPoints([{ x: 75, y: 35 }, { x: 94, y: 49 }, { x: 79, y: 70 }, { x: 62, y: 49 }], true);
        g.lineStyle(2, 0xf5f9d8).lineBetween(75, 35, 79, 70).strokeCircle(110, 48, 5).strokeCircle(120, 33, 3);
        break;
      case 'storm':
        g.fillStyle(0x3d536d).fillEllipse(80, 48, 87, 35).fillCircle(64, 38, 21).fillCircle(92, 37, 24);
        g.fillStyle(0xffdc68).fillPoints([{ x: 82, y: 51 }, { x: 61, y: 79 }, { x: 79, y: 76 }, { x: 69, y: 103 }, { x: 103, y: 65 }, { x: 85, y: 67 }], true);
        for (let i = 0; i < 3; i++) g.lineStyle(3, 0xd3ecfa).lineBetween(48 + i * 31, 69, 42 + i * 31, 84);
        break;
      case 'tradeWind':
        sailboat(0xb8e7de);
        g.lineStyle(4, 0xfff4cf).lineBetween(26, 38, 56, 38).lineBetween(20, 51, 44, 51);
        g.fillStyle(0xfff4cf).fillTriangle(49, 30, 61, 38, 49, 46);
        break;
      case 'pirates':
        g.lineStyle(5, ink).lineBetween(56, 25, 56, 103);
        g.fillStyle(0x243345).fillPoints([{ x: 58, y: 26 }, { x: 121, y: 34 }, { x: 111, y: 76 }, { x: 58, y: 68 }], true);
        skull(85, 45, .55);
        g.lineStyle(4, 0xd8e5dc).lineBetween(35, 92, 63, 71).lineBetween(39, 70, 63, 94);
        break;
      case 'smallMonster':
        g.lineStyle(13, ink);
        for (let i = 0; i < 3; i++) g.strokeEllipse(50 + i * 23, 78 - i * 4, 29, 29);
        g.lineStyle(8, 0x8cbd6d);
        for (let i = 0; i < 3; i++) g.strokeEllipse(50 + i * 23, 78 - i * 4, 29, 29);
        g.fillStyle(0x86b565).fillEllipse(111, 49, 24, 38);
        g.fillStyle(0xffefb0).fillCircle(116, 42, 5);
        g.fillStyle(ink).fillCircle(117, 42, 2);
        break;
      case 'largeMonster':
        for (let i = 0; i < 5; i++) {
          g.lineStyle(10, 0x604a81).lineBetween(80, 70, 37 + i * 22, 93 - i % 2 * 18);
          g.fillStyle(0xc3a6d3).fillCircle(37 + i * 22, 90 - i % 2 * 18, 5);
        }
        g.fillStyle(0x72558d).fillEllipse(80, 56, 58, 56);
        g.fillStyle(0xffd778).fillEllipse(80, 53, 32, 19);
        g.fillStyle(ink).fillEllipse(80, 53, 7, 17);
        break;
      case 'turtle':
        g.fillStyle(0x83b97c).fillEllipse(80, 37, 22, 27).fillEllipse(47, 61, 33, 16).fillEllipse(114, 61, 33, 16).fillEllipse(54, 89, 29, 15).fillEllipse(106, 89, 29, 15);
        g.fillStyle(0x3d7857).fillEllipse(80, 69, 64, 62);
        g.lineStyle(3, 0xd1d9a0).strokeEllipse(80, 69, 60, 58);
        g.strokePoints([{ x: 80, y: 46 }, { x: 98, y: 58 }, { x: 98, y: 77 }, { x: 80, y: 90 }, { x: 62, y: 77 }, { x: 62, y: 58 }], true);
        g.fillStyle(ink).fillCircle(75, 32, 2).fillCircle(85, 32, 2);
        break;
      case 'whirlpool':
        for (let i = 0; i < 5; i++) g.fillStyle(i % 2 ? 0x7cd9dd : 0x235d85).fillEllipse(80 + i * 2, 73, 110 - i * 20, 71 - i * 13);
        g.lineStyle(3, 0xe3fbef).strokePoints(Array.from({ length: 70 }, (_, i) => {
          const a = i * .22, r = 48 * (1 - i / 74);
          return { x: 80 + Math.cos(a) * r, y: 73 + Math.sin(a) * r * .6 };
        }), false);
        break;
      case 'bottle':
        g.fillStyle(0x95d6c5).fillPoints([{ x: 59, y: 50 }, { x: 84, y: 50 }, { x: 107, y: 94 }, { x: 59, y: 103 }, { x: 46, y: 76 }], true);
        g.lineStyle(3, ink).strokePoints([{ x: 59, y: 50 }, { x: 84, y: 50 }, { x: 107, y: 94 }, { x: 59, y: 103 }, { x: 46, y: 76 }], true);
        g.fillStyle(0x9a663f).fillRect(61, 35, 20, 16);
        g.fillStyle(0xffeac1).fillRoundedRect(60, 64, 29, 23, 4);
        g.lineStyle(2, 0x9a663f).lineBetween(65, 70, 80, 70).lineBetween(68, 77, 84, 77);
        break;
      case 'floatingCargo':
        g.fillStyle(0x436f7d).fillEllipse(80, 95, 110, 15);
        crate(43, 64); crate(92, 66, 0xd5ad68); crate(69, 37, 0xc88d51);
        g.lineStyle(4, 0xf9de9a).lineBetween(35, 100, 121, 100);
        break;
      case 'merchant':
        sailboat(0xd97955);
        crate(100, 86); coin(47, 100);
        break;
      case 'wyvern':
        g.fillStyle(0x746a89).fillTriangle(37, 98, 80, 48, 125, 98);
        g.fillStyle(0x805598).fillPoints([{ x: 80, y: 59 }, { x: 30, y: 27 }, { x: 41, y: 65 }, { x: 66, y: 80 }, { x: 80, y: 65 }, { x: 97, y: 80 }, { x: 123, y: 64 }, { x: 135, y: 27 }], true);
        g.lineStyle(2, 0xd3b8d6).lineBetween(80, 59, 30, 27).lineBetween(80, 59, 135, 27);
        g.fillStyle(0x9e77ad).fillEllipse(80, 62, 20, 55).fillEllipse(80, 36, 29, 20);
        g.fillStyle(0xffe691).fillCircle(87, 33, 4);
        break;
    }
  }
  g.generateTexture(key, 160, 152);
  g.destroy();
  return key;
}

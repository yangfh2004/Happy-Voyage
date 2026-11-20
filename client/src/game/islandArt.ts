import type Phaser from 'phaser';
import type { MapNode } from '@happy-voyage/shared';

export function islandLandscape(node: MapNode) {
  let seed = (node.id + 1) * 2654435761 >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const rocky = node.specialty === 'Silver' || node.specialty === 'Timber';
  const tropical = ['Sugar', 'Cocoa', 'Spices', 'Cotton'].includes(node.specialty ?? '');
  const palette = rocky ? [0xaac6b1, 0x5b8b69, 0x365746, 0x7e8985] : tropical ?
    [0xf6df9e, 0x6da85f, 0x286c50, 0x8a9477] : [0xead4a2, 0x89a86a, 0x3e7352, 0x929385];
  const rx = 45 + random() * 17;
  const ry = 30 + random() * 15;
  const rotation = random() * Math.PI * 2;
  const coast = Array.from({ length: 32 }, (_, i) => {
    const angle = i * Math.PI / 16;
    const radius = .82 + random() * .22 + Math.sin(angle * 3 + rotation) * .12;
    const x = Math.cos(angle) * rx * radius;
    const y = Math.sin(angle) * ry * radius;
    return { x: 80 + x * Math.cos(rotation) - y * Math.sin(rotation), y: 76 + (x * Math.sin(rotation) + y * Math.cos(rotation)) * .78 };
  });
  const terrain = Array.from({ length: 13 + Math.floor(random() * 8) }, () => {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * .52;
    return { x: 80 + Math.cos(angle) * rx * radius, y: 72 + Math.sin(angle) * ry * radius, size: 5 + random() * 8, kind: random() };
  });
  return { coast, terrain, palette, rocky, tropical, river: random() > .5, riverBend: random() * 22 - 11 };
}

export function islandTexture(scene: Phaser.Scene, node: MapNode): string {
  const key = `island-${node.id}-${node.specialty ?? 'neutral'}`;
  if (scene.textures.exists(key)) return key;
  const { coast, terrain, palette, rocky, tropical, river, riverBend } = islandLandscape(node);
  const g = scene.add.graphics();
  const polygon = (scale: number, color: number, alpha = 1, y = 0) => {
    g.fillStyle(color, alpha).fillPoints(coast.map((point) => ({ x: 80 + (point.x - 80) * scale, y: 76 + (point.y - 76) * scale + y })), true);
  };
  polygon(1.2, 0x63c7bf, .24, 5);
  polygon(1.09, 0x8fdbcd, .5, 3);
  polygon(1, 0xb49c6a, 1, 3);
  polygon(1, palette[0]);
  polygon(.82, palette[1], 1, -2);
  polygon(.61, palette[2], .2, -4);
  if (river) {
    const points = [{ x: 74, y: 58 }, { x: 83 + riverBend, y: 70 }, { x: 76 + riverBend, y: 82 }, { x: 87, y: 96 }];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      g.lineStyle(4, 0x307d91, .8).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(1.5, 0x92dfd6, .9).lineBetween(a.x, a.y, b.x, b.y);
    }
  }
  for (const { x, y, size, kind } of terrain.sort((a, b) => a.y - b.y)) {
    g.fillStyle(0x1c4441, .18).fillEllipse(x + 3, y + 3, size * 2, size);
    if ((rocky && kind > .35) || kind > .78) {
      g.fillStyle(palette[3]).fillTriangle(x - size, y + 3, x, y - size * 1.8, x + size, y + 3);
      g.fillStyle(0xc7c8ac).fillTriangle(x - size * .2, y - size * 1.4, x, y - size * 1.8, x + size * .5, y);
    } else if (rocky || kind > .65) {
      g.fillStyle(palette[3]).fillEllipse(x, y, size * 1.7, size);
      g.fillStyle(0xbac0a0).fillEllipse(x - 2, y - 2, size, size * .45);
    } else if (kind < .18) {
      g.fillStyle(palette[2], .6).fillEllipse(x, y, size * 2.5, size * 1.3);
      g.fillStyle(palette[1]).fillEllipse(x - 2, y - 3, size * 2, size);
    } else if (tropical && kind > .32) {
      g.lineStyle(2, 0x8a704b).lineBetween(x, y + 2, x + 2, y - size);
      g.fillStyle(palette[2]).fillEllipse(x, y - size, size * 2, 5).fillEllipse(x + 2, y - size, 6, size * 1.6);
      g.fillStyle(0x9fbd65).fillEllipse(x - 2, y - size - 2, size, 4);
    } else {
      g.fillStyle(palette[2]).fillCircle(x, y - size * .5, size * .7);
      g.fillStyle(palette[1]).fillCircle(x - size * .2, y - size * .8, size * .5);
    }
  }
  g.generateTexture(key, 160, 152);
  g.destroy();
  return key;
}

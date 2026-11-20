import type Phaser from 'phaser';
import { WORLD, successors, type MapNode } from '@happy-voyage/shared';
import { routeEdge } from './routeEdge';

export type SeaMotif = 'rose' | 'whale' | 'serpent' | 'anchor' | 'wreck' | 'gulls' | 'buoy';
export type SeaDecoration = { x: number; y: number; radius: number; motif: SeaMotif; angle: number };

function seaRandom() {
  let seed = 0x5ea1990;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function nauticalLayout(map: MapNode[]): SeaDecoration[] {
  const random = seaRandom();
  const edges = map.flatMap((node) => successors(map, node.id).flatMap((id, i) => {
    const edge = routeEdge(map, node.id, id, i > 0);
    const count = Math.max(1, Math.ceil(edge.length / 12));
    return Array.from({ length: count + 1 }, (_, step) => edge.point(step / count));
  }));
  const decorations: SeaDecoration[] = [];
  const place = (x: number, y: number, radius: number, motif: SeaMotif) => {
    if (x < radius || y < radius || x + radius > WORLD.width || y + radius > WORLD.height) return;
    if (map.some((node) => Math.hypot(x - node.x, y - node.y - 35) < radius + 170)) return;
    if (edges.some((point) => Math.hypot(x - point.x, y - point.y) < radius + 38)) return;
    if (decorations.some((other) => Math.hypot(x - other.x, y - other.y) < radius + other.radius + 35)) return;
    decorations.push({ x, y, radius, motif, angle: motif === 'rose' ? 0 : (random() - .5) * 24 });
  };
  place(WORLD.width * .5, WORLD.height * .5, 260, 'rose');
  const motifs: SeaMotif[] = ['whale', 'anchor', 'gulls', 'wreck', 'serpent', 'buoy'];
  let index = 0;
  for (let y = 180; y < WORLD.height - 150; y += 180) {
    for (let x = 180; x < WORLD.width - 150; x += 180) {
      const motif = motifs[index++ % motifs.length];
      place(x + (random() - .5) * 90, y + (random() - .5) * 90, 120, motif);
    }
  }
  for (let i = 0; i < 600; i++) {
    place(120 + random() * (WORLD.width - 240), 120 + random() * (WORLD.height - 240), 120, motifs[index++ % motifs.length]);
  }
  return decorations;
}

export function seaWaves() {
  const random = seaRandom();
  return Array.from({ length: 110 }, (_, i) => ({
    x: (i % 11 + .2 + random() * .6) * WORLD.width / 11,
    y: (Math.floor(i / 11) + .2 + random() * .6) * WORLD.height / 10,
    scale: .7 + random() * 1.3, alpha: .16 + random() * .2,
    drift: 20 + random() * 35, duration: 3200 + random() * 2800,
  }));
}

export function addNauticalSea(scene: Phaser.Scene, map: MapNode[], reducedMotion: boolean) {
  for (const decoration of nauticalLayout(map)) {
    scene.add.image(decoration.x, decoration.y, nauticalTexture(scene, decoration.motif))
      .setAngle(decoration.angle).setScale(decoration.motif === 'rose' ? 1.7 : 1.65)
      .setAlpha(decoration.motif === 'rose' ? .65 : .55).setDepth(-3);
  }
  for (const crest of seaWaves()) {
    const wave = scene.add.image(crest.x, crest.y, 'wave').setAlpha(crest.alpha).setScale(crest.scale).setDepth(-2);
    if (!reducedMotion) scene.tweens.add({
      targets: wave, x: crest.x + crest.drift, y: crest.y + 8, alpha: .06,
      duration: crest.duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }
}

export function nauticalTexture(scene: Phaser.Scene, motif: SeaMotif) {
  const key = `chart-${motif}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  const ink = 0xd9e8bc;
  g.lineStyle(3, 0x174b60, 1);
  if (motif === 'rose') {
    g.strokeCircle(150, 150, 83).strokeCircle(150, 150, 90);
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const length = i % 4 === 0 ? 125 : i % 2 === 0 ? 80 : 54;
      const x = 150 + Math.sin(angle) * length, y = 150 - Math.cos(angle) * length;
      const dx = Math.cos(angle) * 12, dy = Math.sin(angle) * 12;
      g.fillStyle(i % 2 ? 0x266779 : ink, .8).fillTriangle(150, 150, x, y, 150 + dx, 150 + dy);
      g.lineBetween(150, 150, x, y);
    }
    g.strokeCircle(150, 150, 10);
    g.lineBetween(145, 15, 145, 0).lineBetween(145, 0, 155, 15).lineBetween(155, 15, 155, 0);
    g.generateTexture(key, 300, 300);
  } else {
    if (motif === 'whale') {
      g.fillStyle(ink, .65).fillEllipse(58, 66, 77, 36);
      g.strokeEllipse(58, 66, 77, 36);
      g.fillTriangle(90, 65, 121, 43, 116, 73).fillTriangle(95, 65, 120, 86, 116, 68);
      g.lineBetween(25, 64, 45, 68).strokeCircle(32, 59, 2);
      g.lineBetween(47, 43, 42, 25).lineBetween(42, 25, 30, 19).lineBetween(42, 25, 53, 15);
      g.lineBetween(26, 93, 74, 93).lineBetween(43, 100, 89, 100);
    } else if (motif === 'serpent') {
      for (let i = 0; i < 3; i++) g.strokeEllipse(27 + i * 31, 72 - i * 6, 30, 27);
      g.fillStyle(ink, .8).fillEllipse(104, 46, 19, 34).fillTriangle(99, 34, 114, 31, 112, 46);
      g.lineBetween(14, 90, 108, 90).lineBetween(32, 98, 89, 98);
    } else if (motif === 'anchor') {
      g.strokeCircle(64, 24, 9).lineBetween(64, 34, 64, 100).lineBetween(40, 51, 88, 51);
      g.beginPath().arc(64, 65, 35, 0, Math.PI).strokePath();
      g.lineBetween(29, 65, 24, 77).lineBetween(29, 65, 42, 68).lineBetween(99, 65, 104, 77).lineBetween(99, 65, 86, 68);
    } else if (motif === 'wreck') {
      g.fillStyle(ink, .45).fillTriangle(20, 81, 103, 81, 75, 100);
      g.lineBetween(55, 80, 65, 26).lineBetween(65, 26, 93, 67).lineBetween(93, 67, 58, 64);
      g.lineBetween(17, 104, 109, 104).lineBetween(31, 111, 85, 111);
      for (let i = 0; i < 4; i++) g.lineBetween(35 + i * 14, 83, 39 + i * 14, 93);
    } else if (motif === 'gulls') {
      for (let i = 0; i < 3; i++) {
        const x = 23 + i * 32, y = 58 + (i % 2) * 23;
        g.beginPath().moveTo(x - 16, y - 7).lineTo(x - 6, y - 7).lineTo(x, y).lineTo(x + 7, y - 7).lineTo(x + 18, y - 7).strokePath();
      }
    } else {
      g.strokeEllipse(64, 90, 68, 13).strokeEllipse(64, 99, 95, 16);
      g.fillStyle(ink, .6).fillTriangle(45, 85, 64, 51, 83, 85);
      g.lineBetween(64, 51, 64, 22).lineBetween(64, 22, 84, 33).lineBetween(84, 33, 64, 38);
    }
    g.generateTexture(key, 128, 128);
  }
  g.destroy();
  return key;
}

export function shipTexture(scene: Phaser.Scene, color: number) {
  const key = `fleet-${color}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  g.lineStyle(2, 0xc3f9ed, .5).strokeEllipse(39, 64, 73, 13);
  g.lineStyle(2, 0xc3f9ed, .3).lineBetween(4, 57, 19, 60).lineBetween(0, 65, 16, 67);
  g.fillStyle(0x10364b, .35).fillEllipse(43, 64, 60, 12);
  g.fillStyle(0x3a2526).fillPoints([{ x: 12, y: 49 }, { x: 73, y: 47 }, { x: 63, y: 63 }, { x: 28, y: 65 }], true);
  g.fillStyle(0x9b6039).fillPoints([{ x: 15, y: 50 }, { x: 69, y: 50 }, { x: 60, y: 59 }, { x: 27, y: 61 }], true);
  g.lineStyle(4, color).lineBetween(22, 53, 64, 52);
  g.lineStyle(2, 0xe1be7f).lineBetween(39, 9, 39, 51).lineBetween(59, 26, 59, 50);
  g.fillStyle(0xfff3ca).fillTriangle(36, 13, 17, 44, 36, 42).fillTriangle(42, 13, 43, 43, 62, 42);
  g.fillStyle(0xe1d1a6).fillTriangle(42, 13, 55, 36, 43, 43);
  g.fillStyle(0xffffff).fillTriangle(61, 28, 63, 45, 72, 44);
  g.lineStyle(1, 0x907957).lineBetween(20, 43, 39, 10).lineBetween(39, 10, 67, 48);
  g.fillStyle(color).fillTriangle(40, 7, 61, 10, 40, 18);
  g.lineStyle(1, 0xfff5cf, .8).lineBetween(40, 7, 61, 10);
  g.fillStyle(0xffdda0).fillCircle(32, 57, 1.5).fillCircle(43, 56, 1.5).fillCircle(54, 55, 1.5);
  g.generateTexture(key, 80, 76);
  g.destroy();
  return key;
}

import type Phaser from 'phaser';
import type { MapNode } from '@happy-voyage/shared';

export const PORT_FLAGS: Record<string, [number, number, number]> = {
  Spain: [0xc62632, 0xf6c945, 0xc62632], Netherlands: [0xc62632, 0xffffff, 0x23478e],
  England: [0xffffff, 0xc62632, 0xffffff], Portugal: [0x147549, 0xc62632, 0xc62632],
  China: [0xc62632, 0xc62632, 0xc62632], France: [0x23478e, 0xffffff, 0xc62632],
  Japan: [0xffffff, 0xffffff, 0xffffff], Germany: [0x202020, 0xc62632, 0xf6c945],
  Italy: [0x147549, 0xffffff, 0xc62632], Korea: [0xffffff, 0xffffff, 0xffffff],
};

export function harbourLandscape(node: MapNode) {
  let seed = Math.imul(node.id + 17, 2654435761) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const mirrored = random() > .5;
  const point = (x: number, y: number) => ({ x: mirrored ? 160 - x : x, y });
  const coast = [[20, 60], [27, 43], [43, 35], [50, 22], [79, 24], [97, 31], [119, 34], [137, 52], [141, 72], [130, 88], [119, 86], [114, 73], [100, 69], [87, 72], [75, 79], [64, 93], [51, 107], [33, 100], [23, 85]]
    .map(([x, y]) => point(x + random() * 5 - 2.5, y + random() * 5 - 2.5));
  const houses = [[41, 49], [63, 45], [87, 47], [108, 55], [36, 69], [58, 68], [82, 66]].map(([x, y]) => ({
    x: x + random() * 5 - 2.5, y: y + random() * 5 - 2.5, width: 15 + random() * 6, height: 10 + random() * 5,
    roof: [0xb95740, 0xa84838, 0xcd704a][Math.floor(random() * 3)],
  }));
  return { coast, houses, point };
}

export function harbourTexture(scene: Phaser.Scene, node: MapNode): string {
  const key = `harbour-${node.id}-${node.nation ?? 'neutral'}`;
  if (scene.textures.exists(key)) return key;
  const { coast, houses, point } = harbourLandscape(node);
  const g = scene.add.graphics(), ink = 0x344b4c;
  const polygon = (points: number[][], color: number, alpha = 1) => g.fillStyle(color, alpha).fillPoints(points.map(([x, y]) => point(x, y)), true);
  const line = (x: number, y: number, ex: number, ey: number, width: number, color: number, alpha = 1) => {
    const a = point(x, y), b = point(ex, ey);
    g.lineStyle(width, color, alpha).lineBetween(a.x, a.y, b.x, b.y);
  };
  const rect = (x: number, y: number, w: number, h: number, color: number) => polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color);
  for (const [scale, color, alpha, dy] of [[1.15, 0x8de0d5, .35, 4], [1.06, 0xc5e9cb, .7, 2], [1, 0xb7a075, 1, 3], [1, 0xebd6a0, 1, 0], [.84, 0x819971, 1, -3]]) {
    g.fillStyle(color, alpha).fillPoints(coast.map(p => ({ x: 80 + (p.x - 80) * scale, y: 76 + (p.y - 76) * scale + dy })), true);
  }
  g.lineStyle(1.5, 0x866d50, .7).strokePoints(coast, true);
  g.fillStyle(0x378f9f, .5).fillEllipse(point(104, 98).x, 98, 56, 30);
  line(55, 92, 77, 72, 9, ink);
  line(77, 72, 113, 72, 9, ink);
  line(55, 90, 77, 70, 7, 0xbcc2ad);
  line(77, 70, 113, 70, 7, 0xbcc2ad);
  for (let x = 77; x < 114; x += 7) line(x, 67, x, 73, 1, 0x7e8b83);
  for (let x = 70; x <= 106; x += 18) {
    polygon([[x - 3, 80], [x + 2, 77], [x + 17, 98], [x + 12, 102]], 0x624b37);
    polygon([[x - 3, 78], [x + 2, 75], [x + 17, 96], [x + 12, 100]], 0xb89560);
    for (let y = 0; y < 19; y += 4) line(x - 1 + y * .7, 79 + y, x + 4 + y * .7, 76 + y, 1, 0x6c543a);
    for (const [dx, dy] of [[-3, 77], [15, 98]]) {
      const p = point(x + dx, dy);
      g.fillStyle(0x634a31).fillCircle(p.x, p.y, 2);
    }
  }
  line(120, 86, 139, 108, 8, 0x5b716b);
  line(139, 108, 119, 116, 8, 0x5b716b);
  line(120, 84, 139, 106, 6, 0xc4c8af);
  line(139, 106, 119, 114, 6, 0xc4c8af);
  for (const { x, y, width: w, height: h, roof } of houses.sort((a, b) => a.y - b.y)) {
    polygon([[x - 3, y + 2], [x + w + 5, y + 3], [x + w + 9, y + 8], [x + 1, y + 7]], 0x344b4c, .22);
    rect(x, y - h, w, h, 0xe4d5ac);
    polygon([[x + w, y - h], [x + w + 5, y - h - 4], [x + w + 5, y - 4], [x + w, y]], 0xa39b7c);
    polygon([[x - 3, y - h], [x + w / 2, y - h - 10], [x + w + 4, y - h], [x + w / 2, y - h + 2]], roof);
    polygon([[x + w / 2, y - h - 10], [x + w + 5, y - h - 5], [x + w + 4, y - h]], 0x803f34);
    line(x - 3, y - h, x + w + 4, y - h, 1, 0x693e32);
    rect(x + 3, y - 7, 4, 7, 0x655d4a);
    rect(x + w - 6, y - h + 3, 3, 4, 0x477582);
    rect(x + 4, y - h - 7, 3, 6, 0xb9ac8a);
  }
  const tower = point(132, 100);
  g.fillStyle(ink, .25).fillEllipse(tower.x + 3, 104, 19, 8);
  polygon([[126, 100], [129, 74], [136, 74], [139, 100]], 0xf1e6c6);
  polygon([[133, 74], [136, 74], [139, 100], [134, 100]], 0xa9b3a5);
  rect(128, 80, 9, 4, 0xba5945);
  rect(127, 71, 11, 7, 0x405a64);
  rect(130, 72, 5, 4, 0xffdd8a);
  polygon([[125, 71], [132, 65], [140, 71]], 0x9d4c3d);
  for (const [x, y] of [[91, 105], [111, 100], [124, 91]]) {
    const p = point(x, y);
    g.fillStyle(0xb9e9dc, .5).fillEllipse(p.x, p.y + 2, 17, 8);
    polygon([[x - 7, y - 2], [x + 8, y - 2], [x + 4, y + 4], [x - 4, y + 4]], 0x674a38);
    line(x - 4, y, x + 5, y, 2, 0xe4ce92);
    line(x, y - 7, x, y + 1, 1, 0x4d5145);
    polygon([[x + 1, y - 7], [x + 1, y - 1], [x + 6, y - 1]], 0xf4e7bd);
  }
  const pole = point(38, 58);
  g.lineStyle(2, 0x4c554b).lineBetween(pole.x, 13, pole.x, pole.y);
  const nation = node.nation ?? '', colors = PORT_FLAGS[nation] ?? [0xf4ead1, 0xf4ead1, 0xf4ead1];
  const flagX = pole.x + 1, flagY = 14, vertical = ['Portugal', 'France', 'Italy'].includes(nation);
  colors.forEach((color, i) => g.fillStyle(color).fillRect(flagX + (vertical ? i * 8 : 0), flagY + (vertical ? 0 : i * 5), vertical ? 8 : 24, vertical ? 15 : 5));
  if (nation === 'England') g.fillStyle(0xc62632).fillRect(flagX + 10, flagY, 4, 15);
  if (nation === 'Japan' || nation === 'Korea') {
    g.fillStyle(0xc62632).fillCircle(flagX + 12, flagY + 7, 4);
    if (nation === 'Korea') g.fillStyle(0x23478e).fillCircle(flagX + 12, flagY + 9, 2.5);
  }
  if (nation === 'China') g.fillStyle(0xf6c945).fillCircle(flagX + 5, flagY + 5, 2.5);
  g.lineStyle(1, ink).strokeRect(flagX, flagY, 24, 15);
  g.generateTexture(key, 160, 152);
  g.destroy();
  return key;
}

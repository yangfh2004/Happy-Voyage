import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const CJK = /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/g;

/** Code points mapped by a TrueType font's cmap (formats 4 and 12). */
function cmap(font: Buffer): Set<number> {
  const tables = font.readUInt16BE(4);
  let offset = 0;
  for (let i = 0; i < tables; i++) {
    const record = 12 + i * 16;
    if (font.toString('latin1', record, record + 4) === 'cmap') offset = font.readUInt32BE(record + 8);
  }
  const points = new Set<number>();
  for (let i = 0; i < font.readUInt16BE(offset + 2); i++) {
    const sub = offset + font.readUInt32BE(offset + 4 + i * 8 + 4);
    const format = font.readUInt16BE(sub);
    if (format === 4) {
      const segs = font.readUInt16BE(sub + 6) / 2;
      for (let s = 0; s < segs; s++) {
        const end = font.readUInt16BE(sub + 14 + s * 2);
        const start = font.readUInt16BE(sub + 16 + segs * 2 + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) points.add(c);
      }
    } else if (format === 12) {
      for (let g = 0; g < font.readUInt32BE(sub + 12); g++) {
        const group = sub + 16 + g * 12;
        for (let c = font.readUInt32BE(group); c <= font.readUInt32BE(group + 4); c++) points.add(c);
      }
    }
  }
  return points;
}

describe('bundled Chinese font', () => {
  it('has a glyph for every Chinese character the game shows', () => {
    const covered = cmap(readFileSync(resolve(root, 'client/src/assets/sea-names.ttf')));
    const files = ['client/src', 'shared/src'].flatMap((dir) =>
      readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f)).map((f) => `${dir}/${f}`));
    files.push('client/index.html');
    const missing = new Set<string>();
    for (const file of files) {
      for (const char of readFileSync(resolve(root, file), 'utf8').match(CJK) ?? []) {
        if (!covered.has(char.codePointAt(0)!)) missing.add(char);
      }
    }
    expect([...missing].join(''), 'run tools/subset-cjk-font.py').toBe('');
  });
});

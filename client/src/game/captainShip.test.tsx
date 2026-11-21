import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { captainShipTexture, sailingStepDuration } from './captainShip';

vi.mock('./nauticalArt', () => ({ shipTexture: () => 'hull' }));
afterEach(() => vi.unstubAllGlobals());

describe('captain ships', () => {
  it.each([[200, false, 480], [200, true, 140], [70, false, 168], [70, true, 49], [0, false, 0], [0, true, 0]] as const)('paces step %s for AI=%s at %s ms', (step, ai, expected) => {
    expect(sailingStepDuration(step, ai)).toBe(expected);
  });

  it('composites the same captain portrait over the enlarged coloured ship and caches it', async () => {
    let source = '';
    vi.stubGlobal('Image', class {
      onload = () => {};
      set src(value: string) { source = value; this.onload(); }
    });
    const drawImage = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const cache = new Set<string>();
    const addCanvas = vi.fn((key: string) => cache.add(key));
    const scene = { textures: { exists: (key: string) => cache.has(key), get: () => ({ getSourceImage: () => 'hull-image' }), addCanvas } } as unknown as Phaser.Scene;
    const key = await captainShipTexture(scene, 'columbus', 0xff0000);
    expect(decodeURIComponent(source)).toContain('Columbus portrait');
    expect(decodeURIComponent(source)).toContain('#ff0000');
    expect(canvas).toMatchObject({ width: 112, height: 124 });
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.calls[1].slice(1)).toEqual([28, 0, 56, 56]);
    expect(await captainShipTexture(scene, 'columbus', 0xff0000)).toBe(key);
    expect(addCanvas).toHaveBeenCalledOnce();
  });

  it('reports a portrait decode error without caching a broken texture', async () => {
    vi.stubGlobal('Image', class {
      onerror = () => {};
      set src(_value: string) { this.onerror(); }
    });
    const scene = { textures: { exists: () => false } } as unknown as Phaser.Scene;
    await expect(captainShipTexture(scene, 'columbus', 0)).rejects.toThrow('Could not render captain portrait');
  });
});

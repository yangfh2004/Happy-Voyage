import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { NATIONS } from './nations';
import { createDefaultMap } from './map';
import { localize, nodeName, playerName, shipName, tx, ref, LOCALES } from './i18n';

const CJK = /[\u3400-\u9fff]/;

describe('i18n', () => {
  it('fills placeholders with names in the reader’s language', () => {
    const map = createDefaultMap();
    const island = map.find((node) => node.name === 'Cuba')!;
    const text = tx('{p} plants the flag on {n}!', '{p} 在{n}插上了旗帜！', { p: ref.player(0), n: ref.node(island.id) });
    const state = { map, players: [{ name: 'Columbus', navigator: 'columbus' }] } as never;
    expect(localize('en', text, state)).toBe('Columbus plants the flag on Cuba!');
    expect(localize('zh', text, state)).toBe('哥伦布 在古巴插上了旗帜！');
  });

  it('names every map stop in Chinese', () => {
    for (const node of createDefaultMap()) expect(nodeName(node, 'zh'), node.name).toMatch(CJK);
  });

  it('keeps names people typed and translates built ships', () => {
    expect(playerName({ name: 'Ada', navigator: 'columbus' }, 'zh')).toBe('Ada');
    expect(shipName('Cargo Ship 7', 'zh')).toBe('货船 7');
    expect(LOCALES.map((locale) => locale.id)).toEqual(['en', 'zh']);
  });

  it('writes every engine log line in both languages', () => {
    let seed = 7;
    const engine = new GameEngine({
      players: NATIONS.slice(0, 4).map((nation, color) => ({ name: nation.name, nation: nation.name, color, isAI: true })),
      config: { maxRounds: 40 }, rng: () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
    });
    for (let step = 0; step < 6000 && engine.state.phase !== 'gameOver'; step++) {
      if (engine.state.phase === 'awaitingSpin') engine.decideForAI();
      if (engine.state.phase === 'awaitingSpin') { engine.spinCompass(); engine.sail(); }
      else if (engine.state.phase === 'moving') engine.resolveLanding();
      else engine.decideForAI();
    }
    expect(engine.state.log.length).toBeGreaterThan(100);
    const texts = engine.state.logText ?? [];
    expect(texts.length).toBe(engine.state.log.length);
    texts.forEach((text, index) => {
      expect(localize('en', text, engine.state)).toBe(engine.state.log[index]);
      const zh = localize('zh', text, engine.state);
      expect(zh, zh).not.toMatch(/\{\w+\}|undefined/);
      expect(zh, zh).toMatch(CJK);
    });
  });
});

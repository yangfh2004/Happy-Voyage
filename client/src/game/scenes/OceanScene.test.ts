import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {}, Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) } } }));
vi.mock('../EventBus', () => ({ EventBus: { emit: vi.fn() } }));
vi.mock('../GameController', () => ({ gameController: { timings: { step: 200 } } }));
vi.mock('../landingEffects', () => ({ playLanding: vi.fn(), reducedLandingMotion: vi.fn(() => false) }));

import { OceanScene } from './OceanScene';
import { EventBus } from '../EventBus';
import { gameController } from '../GameController';
import { routeEdge } from '../routeEdge';
import { createDefaultMap, createNationRoster, GameEngine, WORLD, type GameEvent, type GameState, type MapNode, type WindDirection } from '@happy-voyage/shared';
import { setLocale } from '../../i18n';
import { playLanding, reducedLandingMotion } from '../landingEffects';
import { shipBounds, type MooredBerth } from '../shipBerths';

type Move = { playerId: number; path: number[]; id: number };
type SceneHarness = {
  animateMove(move: Move): void;
  updatePacing(): void;
  cancelMove(): void;
  syncFromState(): void;
  syncRoamers(state: GameState | null): void;
  update(): void;
  drawLandingTarget(): void;
  drawRoute(direction?: WindDirection): void;
  fitChart(): void;
  tokenPosition(playerId: number, nodeId: number): [number, number];
  stopLabel(node: MapNode, state: GameState | null): string;
  drawStops(): void;
  relabel(state: GameState | null): void;
  onEngineEvent(event: GameEvent): void;
};

let scene: SceneHarness;
let completions: (() => void)[];
let tweens: { stop: ReturnType<typeof vi.fn>; setTimeScale: ReturnType<typeof vi.fn> }[];
let ship: { setFlipX: ReturnType<typeof vi.fn>; setPosition: ReturnType<typeof vi.fn>; setScale: ReturnType<typeof vi.fn>; x: number };

beforeEach(() => {
  vi.clearAllMocks();
  gameController.timings.step = 200;
  vi.mocked(reducedLandingMotion).mockReturnValue(false);
  Object.assign(gameController, { state: null });
  completions = [];
  tweens = [];
  ship = { x: 0, setFlipX: vi.fn(), setPosition: vi.fn(), setScale: vi.fn() };
  scene = Object.assign(new OceanScene(), {
    following: false,
    ships: new Map([[0, ship]]),
    marker: { clear: vi.fn() },
    tweens: { addCounter: (options: { onComplete(): void }) => {
      completions.push(options.onComplete);
      const tween = { stop: vi.fn(), setTimeScale: vi.fn() };
      tweens.push(tween);
      return tween;
    } },
  }) as unknown as SceneHarness;
});

afterEach(() => setLocale('en'));

describe('map label language and themed stop hover', () => {
  it('draws distinct localized roaming tokens, moves them with state, and clears stale tokens', () => {
    const image = vi.fn((_x: number, _y: number, _texture: string) => ({ setScale: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() }));
    const text = vi.fn((_x: number, _y: number, _label: string) => ({ setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() }));
    Object.assign(scene, { add: { image, text }, textures: { exists: () => true } });
    const { state } = new GameEngine({ players: [{ name: 'Captain', color: 0, isAI: false }] });
    state.roamers = [{ id: 0, kind: 'pirates', node: 1 }, { id: 1, kind: 'smallMonster', node: 2 }];
    scene.syncRoamers(state);
    expect(image).toHaveBeenCalledTimes(2);
    expect(image.mock.calls[0][2]).not.toBe(image.mock.calls[1][2]);
    expect(text.mock.calls.map((call) => call[2])).toEqual(['⚑ Pirates', 'M Small sea monster']);
    const previous = image.mock.results.map(({ value }) => value);
    state.roamers[0].node = 3;
    setLocale('zh');
    scene.syncRoamers(state);
    expect(image.mock.calls[2][0]).toBe(state.map[3].x + 48);
    expect(text.mock.calls[2][2]).toContain('海盗');
    previous.forEach((token) => expect(token.destroy).toHaveBeenCalledOnce());
    scene.syncRoamers(null);
    image.mock.results.slice(2).forEach(({ value }) => expect(value.destroy).toHaveBeenCalledOnce());
  });

  it('never renders CJK in English labels for any default stop, with and without game state', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]) });
    setLocale('en');
    for (const node of createDefaultMap()) {
      expect(scene.stopLabel(node, null)).not.toMatch(/[\u3400-\u9fff]/);
      expect(scene.stopLabel(node, state)).not.toMatch(/[\u3400-\u9fff]/);
    }
    setLocale('zh');
    for (const node of createDefaultMap()) expect(scene.stopLabel(node, null)).toMatch(/[\u3400-\u9fff]/);
  });

  it.each(['en', 'zh'] as const)('keeps themed islands hoverable with a localised tooltip in %s and dismisses stale language', locale => {
    setLocale(locale);
    const node = { ...createDefaultMap().find(node => node.special === 'skeleton')!, id: 0 };
    const handlers = new Map<string, (pointer: { wasTouch: boolean }) => void>();
    const text = () => ({ setOrigin: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setInteractive: vi.fn().mockReturnThis(), setScale: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setText: vi.fn(), destroy: vi.fn(), on: vi.fn().mockReturnThis(), displayWidth: 150, displayHeight: 50 });
    const label = text(), tooltip = text();
    const addText = vi.fn().mockReturnValueOnce(label).mockReturnValue(tooltip);
    const zone = { setInteractive: vi.fn().mockReturnThis(), on: vi.fn((event: string, handler: (pointer: { wasTouch: boolean }) => void) => { handlers.set(event, handler); return zone; }) };
    const image = vi.fn();
    const addZone = vi.fn(() => zone);
    Object.assign(scene, { map: [node], add: { image, text: addText, zone: addZone }, textures: { exists: () => true }, labels: { add: vi.fn() }, cameras: { main: { zoom: 1, worldView: { x: 0, y: 0, width: WORLD.width, height: WORLD.height } } } });
    scene.drawStops();
    scene.relabel(null);
    expect(image).toHaveBeenCalledWith(node.x, node.y, 'stop-special-skeleton-0');
    expect(addZone).toHaveBeenCalledWith(node.x, node.y, 140, 110);
    handlers.get('pointerover')!({ wasTouch: false });
    const content = addText.mock.calls[1][2];
    if (locale === 'en') {
      expect(content).toContain('Skeleton Island');
      expect(content).not.toMatch(/[\u3400-\u9fff]/);
    } else expect(content).toContain('骷髅岛');
    scene.relabel(null);
    expect(tooltip.destroy).not.toHaveBeenCalled();
    setLocale(locale === 'en' ? 'zh' : 'en');
    scene.relabel(null);
    expect(tooltip.destroy).toHaveBeenCalledOnce();
    handlers.get('pointerout')!({ wasTouch: false });
    expect(tooltip.destroy).toHaveBeenCalledOnce();
  });
});

describe('shared stop ship berths', () => {
  it.each([1, 2, 3, 4])('keeps %s ships clear of each other and the name/price label at maximum scale and bob angle', (count) => {
    const node = { ...createDefaultMap()[0], x: 600, y: 400 };
    const label = { left: node.x - 77, right: node.x + 77, top: node.y + 31, bottom: node.y + 110 };
    Object.assign(scene, { map: [node], stopLabels: new Map([[0, { getBounds: () => label }]]) });
    const players = Array.from({ length: count }, (_, id) => ({ id, position: 0 }));
    Object.assign(gameController, { state: { players } });
    const positions: [number, number][] = [];
    const bounds = players.map(({ id }) => {
      const [x, y] = scene.tokenPosition(id, 0);
      positions.push([x, y]);
      expect(Math.hypot(x - node.x, y - node.y)).toBeLessThanOrEqual(110);
      const berth = (scene as unknown as { berths: Map<number, MooredBerth> }).berths.get(id)!;
      return shipBounds(x, y, berth.scale);
    });
    const overlaps = (a: typeof label, b: typeof label) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (const [i, ship] of bounds.entries()) {
      expect(overlaps(ship, label)).toBe(false);
      for (const other of bounds.slice(i + 1)) expect(overlaps(ship, other)).toBe(false);
    }
    Object.assign(gameController, { state: { players: [...players].reverse() } });
    players.forEach(({ id }, i) => expect(scene.tokenPosition(id, 0)).toEqual(positions[i]));
  });

  it('provides a berth before state is available and while sailing through an unoccupied stop', () => {
    Object.assign(scene, { map: [{ ...createDefaultMap()[0], x: 100, y: 200 }] });
    const berth = scene.tokenPosition(3, 0);
    expect(Math.hypot(berth[0] - 100, berth[1] - 200)).toBeLessThanOrEqual(100);
    Object.assign(gameController, { state: { players: [{ id: 1, position: 1 }] } });
    expect(scene.tokenPosition(3, 0)).toEqual(berth);
  });

  it('applies the crowded-stop scale to all of that stop\'s sprites', () => {
    const players = Array.from({ length: 4 }, (_, id) => ({ id, position: 11, fleet: [] }));
    const sprites = players.map(() => ({ setScale: vi.fn() }));
    Object.assign(scene, { map: createDefaultMap(), ships: new Map(sprites.map((sprite, id) => [id, sprite])) });
    Object.assign(gameController, { state: { players } });
    scene.tokenPosition(0, 11);
    const scale = sprites[0].setScale.mock.calls[0][0];
    expect(scale).toBeLessThan(.8);
    expect(scale).toBeGreaterThanOrEqual(.8 * .75);
    for (const sprite of sprites) expect(sprite.setScale).toHaveBeenCalledWith(scale);
  });
});

describe('moored reflows', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([false, true])('repositions a forced reflow without teleporting during animation (reduced motion: %s)', reduced => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) });
    const tween = { stop: vi.fn() }, add = vi.fn((_options: unknown) => tween);
    const label = { left: 500, right: 700, top: 200, bottom: 400 };
    ship.setPosition.mockReturnThis();
    Object.assign(ship, { x: 600, y: 320, setAlpha: vi.fn() });
    Object.assign(scene, {
      map: [{ ...createDefaultMap()[0], x: 600, y: 500 }],
      berths: new Map([[0, { x: 600, y: 320, scale: 1, nodeId: 0 }]]),
      stopLabels: new Map([[0, { getBounds: () => label, setText: vi.fn() }]]),
      tweens: { add }, flags: { clear: vi.fn() },
    });
    Object.assign(gameController, { state: {
      round: 1, market: { stock: {}, repairDemandThroughRound: 0 }, owners: [],
      players: [{ id: 0, color: 0xe85d4a, position: 0, fleet: [] }], currentPlayer: 0, phase: 'gameOver',
    } });
    const [x, y] = scene.tokenPosition(0, 0);
    if (reduced) {
      expect(add).not.toHaveBeenCalled();
      expect(ship.setPosition).toHaveBeenCalledWith(x, y);
    } else {
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ targets: ship, x, y, duration: 300 }));
      expect(ship.setPosition).not.toHaveBeenCalled();
      scene.syncFromState();
      expect(add).toHaveBeenCalledOnce();
      expect(ship.setPosition).not.toHaveBeenCalled();
      const options = add.mock.calls[0][0] as unknown as { onComplete(): void };
      options.onComplete();
      scene.syncFromState();
      expect(ship.setPosition).toHaveBeenCalledWith(x, y);
    }
  });
});

describe('fork routes', () => {
  function routeGraphics() {
    return { clear: vi.fn(), lineStyle: vi.fn().mockReturnThis(), strokeCircle: vi.fn().mockReturnThis(), lineBetween: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(), fillTriangle: vi.fn().mockReturnThis() };
  }

  it('dashes main-course edges and curved shortcuts, including their outlines, but preserves arrows', () => {
    const route = routeGraphics(), map = createDefaultMap();
    Object.assign(scene, { map, route });
    scene.drawRoute();
    for (const call of route.lineBetween.mock.calls) {
      const [x, y, ex, ey] = call as number[];
      expect(Math.hypot(ex - x, ey - y)).toBeLessThan(25);
    }
    expect(route.lineStyle).toHaveBeenCalledWith(4, 0xffffff, .7);
    expect(route.lineStyle).toHaveBeenCalledWith(7, 0xffd369, 1);
    expect(route.fillTriangle.mock.calls.length).toBeGreaterThan(map.length);
  });

  it('draws bold dashed gold shortcuts and highlights the wind-selected exit', () => {
    const route = routeGraphics();
    const map = [
      { id: 0, x: 0, y: 0, next: [1, 2] },
      { id: 1, x: 200, y: 0 },
      { id: 2, x: 0, y: 200 },
    ];
    Object.assign(scene, { map, route });
    scene.drawRoute('S');
    expect(route.strokeCircle).toHaveBeenCalledWith(0, 0, 34);
    expect(route.lineStyle).toHaveBeenCalledWith(7, 0xffd369, 1);
    const edge = routeEdge(map as MapNode[], 0, 2, true);
    const dash = edge.point(16 / 124 / 6);
    expect(route.lineBetween).toHaveBeenCalledWith(expect.closeTo(0), 38, expect.closeTo(dash.x), expect.closeTo(dash.y));
    expect(route.lineStyle).toHaveBeenCalledWith(12, 0x7ffff0, 1);
    const highlight = edge.point(1 / 40);
    expect(route.lineBetween).toHaveBeenCalledWith(expect.closeTo(0), 38, expect.closeTo(highlight.x), expect.closeTo(highlight.y));
    expect(route.fillStyle).toHaveBeenCalledWith(0x7ffff0, 1);
    route.lineBetween.mockClear();
    Object.assign(gameController, { state: { wind: { direction: 'S', turnsLeft: 2 } } });
    scene.onEngineEvent({ type: 'windChanged', direction: 'E', turnsLeft: 3 });
    expect(route.clear).toHaveBeenCalledTimes(2);
    expect(route.lineBetween).toHaveBeenCalledWith(38, 0, 162, 0);
    expect(route.lineStyle.mock.calls.filter(([width]) => width === 12)).toHaveLength(2);
  });

  it('clears an empty map and tolerates a route layer not created yet', () => {
    scene.drawRoute('N');
    const route = routeGraphics();
    Object.assign(scene, { map: [], route });
    scene.drawRoute('N');
    expect(route.clear).toHaveBeenCalledOnce();
    expect(route.lineBetween).not.toHaveBeenCalled();
  });
});

describe('fit chart', () => {
  it.each([[1400, 800], [500, 900]])('centres the whole sea with balanced margins in a %s by %s panel', (width, height) => {
    const camera = { width, height, setSize: vi.fn(), setZoom: vi.fn(), setBounds: vi.fn(), centerOn: vi.fn() };
    Object.assign(scene, { cameras: { main: camera }, game: { canvas: { parentElement: { clientWidth: width, clientHeight: height } } } });
    scene.fitChart();
    const zoom = Math.min(width / WORLD.width, height / WORLD.height);
    const padX = (width / zoom - WORLD.width) / 2;
    const padY = (height / zoom - WORLD.height) / 2;
    expect(camera.setZoom).toHaveBeenCalledWith(zoom);
    expect(camera.setBounds).toHaveBeenCalledWith(-padX, -padY, WORLD.width + 2 * padX, WORLD.height + 2 * padY);
    expect(camera.centerOn).toHaveBeenCalledWith(WORLD.width / 2, WORLD.height / 2);
  });
});

describe('landing highlight', () => {
  it('frames long desktop previews, then follows the active fleet again', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]) });
    const camera = { width: 1100, height: 700, zoom: .8, worldView: { x: 0, y: 0 }, setZoom: vi.fn().mockReturnThis(), centerOn: vi.fn().mockReturnThis() };
    const graphics = { clear: vi.fn(), lineStyle: vi.fn().mockReturnThis(), strokeCircle: vi.fn().mockReturnThis() };
    const badge = { setFontSize: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis() };
    Object.assign(gameController, { state, landingTarget: { nodeId: 34, playerId: 0, steps: 2, preview: true } });
    Object.assign(scene, { scale: { width: 1100 }, landingMarker: graphics, landingBadge: badge, cameras: { main: camera }, time: { now: 0 }, game: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } } });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    scene.drawLandingTarget();
    expect(camera.setZoom.mock.calls[0][0]).toBeGreaterThanOrEqual(Math.min(1100 / WORLD.width, 700 / WORLD.height));
    const from = state.map[state.players[0].position];
    expect(camera.centerOn).toHaveBeenCalledWith((from.x + state.map[34].x) / 2, (from.y + state.map[34].y) / 2);
    Object.assign(gameController, { landingTarget: null });
    scene.drawLandingTarget();
    expect(camera.setZoom).toHaveBeenLastCalledWith(.95);
    expect(camera.centerOn).toHaveBeenLastCalledWith(from.x, from.y);
    vi.unstubAllGlobals();
  });

  it('draws a large layered glow and badge, projects the target and clears after arrival', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]) });
    const node = state.map[5];
    const graphics = { clear: vi.fn(), lineStyle: vi.fn().mockReturnThis(), strokeCircle: vi.fn().mockReturnThis() };
    const badge = { setFontSize: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis() };
    Object.assign(gameController, { state, landingTarget: { nodeId: node.id, playerId: 0, steps: null, preview: true } });
    Object.assign(scene, { landingMarker: graphics, landingBadge: badge, time: { now: 0 }, cameras: { main: { worldView: { x: 0, y: 0 }, zoom: .5, height: 600 } }, game: { canvas: { getBoundingClientRect: () => ({ left: 10, top: 20 }) } } });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    scene.drawLandingTarget();
    expect(graphics.strokeCircle).toHaveBeenCalledWith(node.x, node.y, 62);
    expect(graphics.lineStyle).toHaveBeenCalledWith(32, expect.any(Number), .12);
    expect(badge.setFontSize).toHaveBeenCalledWith(34);
    expect(EventBus.emit).toHaveBeenCalledWith('chart-focus', { x: Math.round(10 + node.x / 2), y: Math.round(20 + node.y / 2), bottom: node.y / 2 > 300 });
    Object.assign(gameController, { landingTarget: null });
    scene.drawLandingTarget();
    expect(graphics.clear).toHaveBeenCalledTimes(2);
    expect(badge.setVisible).toHaveBeenLastCalledWith(false);
    vi.unstubAllGlobals();
  });
});

describe('pinch zoom', () => {
  it('clamps zoom between the complete organic sea and close detail', () => {
    const a = { isDown: true, x: 100, y: 100 };
    const b = { isDown: true, x: 200, y: 100 };
    const camera = { width: 1100, height: 700, zoom: .8, setZoom: vi.fn((value: number) => { camera.zoom = value; }) };
    Object.assign(scene, { input: { pointer1: a, pointer2: b }, cameras: { main: camera } });
    scene.update();
    b.x = 101;
    scene.update();
    expect(camera.zoom).toBe(Math.min(1100 / WORLD.width, 700 / WORLD.height));
    b.x = 2000;
    scene.update();
    expect(camera.zoom).toBe(2);
  });

  it('uses the current two-finger distance once per frame without compounding ratios', () => {
    const a = { isDown: true, x: 100, y: 100 };
    const b = { isDown: true, x: 200, y: 100 };
    const camera = { zoom: 0.5, setZoom: vi.fn((value: number) => { camera.zoom = value; }) };
    Object.assign(scene, { input: { pointer1: a, pointer2: b }, cameras: { main: camera } });
    scene.update();
    a.x = 50;
    b.x = 250;
    scene.update();
    expect(camera.zoom).toBe(1);
    scene.update();
    expect(camera.zoom).toBe(1);
    b.isDown = false;
    scene.update();
    b.isDown = true;
    scene.update();
    b.x = 350;
    scene.update();
    expect(camera.zoom).toBe(1.5);
  });

  it('ignores absent touches and coincident fingers', () => {
    const a = { isDown: false, x: 100, y: 100 };
    const b = { isDown: true, x: 100, y: 100 };
    const camera = { zoom: 1, setZoom: vi.fn() };
    Object.assign(scene, { input: { pointer1: a, pointer2: b }, cameras: { main: camera } });
    scene.update();
    a.isDown = true;
    scene.update();
    expect(camera.setZoom).not.toHaveBeenCalled();
  });
});

describe('colony ownership', () => {
  function graphics() {
    return { clear: vi.fn(), lineStyle: vi.fn().mockReturnThis(), strokeCircle: vi.fn().mockReturnThis(), lineBetween: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(), fillTriangle: vi.fn().mockReturnThis() };
  }

  it('draws contrasting owner rings and flags for claimed colonies only', () => {
    const flags = graphics();
    Object.assign(scene, { flags });
    Object.assign(ship, { setAlpha: vi.fn() });
    Object.assign(gameController, { state: {
      round: 1, market: { stock: {}, repairDemandThroughRound: 0 },
      owners: [null, 0], players: [{ id: 0, color: 0xe85d4a, position: 1 }], currentPlayer: 0, phase: 'gameOver',
    } });
    scene.syncFromState();
    expect(flags.strokeCircle).toHaveBeenCalledTimes(2);
    expect(flags.lineStyle).toHaveBeenCalledWith(10, 0x06283d, 1);
    expect(flags.lineStyle).toHaveBeenCalledWith(6, 0xe85d4a, 1);
    expect(flags.fillTriangle).toHaveBeenCalledOnce();
  });

  it.each([null, { owners: [], players: [], phase: 'gameOver' }])('clears ownership without drawing when there are no colonies (%j)', (state) => {
    const flags = graphics();
    Object.assign(scene, { flags, ships: new Map() });
    Object.assign(gameController, { state });
    scene.syncFromState();
    expect(flags.clear).toHaveBeenCalledOnce();
    expect(flags.strokeCircle).not.toHaveBeenCalled();
  });
});

describe('fleet cleanup', () => {
  it('kills rocking tweens before destroying ships and does not repeat cleanup', () => {
    const destroy = vi.fn();
    const sprite = { destroy };
    const killTweensOf = vi.fn();
    Object.assign(scene, {
      ships: new Map([[0, sprite]]), flags: { clear: vi.fn() },
      tweens: { killTweensOf },
    });
    scene.syncFromState();
    scene.syncFromState();
    expect(killTweensOf).toHaveBeenCalledOnce();
    expect(killTweensOf).toHaveBeenCalledWith(sprite);
    expect(destroy).toHaveBeenCalledOnce();
    expect(killTweensOf.mock.invocationCallOrder[0]).toBeLessThan(destroy.mock.invocationCallOrder[0]);
  });
});

describe('movement pacing', () => {
  it('decelerates only the final step and starts landing effects without delaying move completion', () => {
    const options: { ease: string; onComplete(): void }[] = [];
    Object.assign(scene, { tweens: { addCounter: (option: typeof options[number]) => { options.push(option); return { setTimeScale: vi.fn(), stop: vi.fn() }; } } });
    scene.animateMove({ playerId: 0, path: [1, 2], id: 40 });
    expect(options[0].ease).toBe('Sine.easeInOut');
    options[0].onComplete();
    expect(playLanding).not.toHaveBeenCalled();
    expect(options[1].ease).toBe('Cubic.easeOut');
    options[1].onComplete();
    expect(playLanding).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 40);
  });

  it('keeps ordinary approach pacing with reduced motion', () => {
    vi.mocked(reducedLandingMotion).mockReturnValue(true);
    const addCounter = vi.fn(() => ({ setTimeScale: vi.fn() }));
    Object.assign(scene, { tweens: { addCounter } });
    scene.animateMove({ playerId: 0, path: [1], id: 41 });
    expect(addCounter).toHaveBeenCalledWith(expect.objectContaining({ ease: 'Sine.easeInOut' }));
  });
  it('retimes active and subsequent steps, resolving exactly once', () => {
    scene.animateMove({ playerId: 0, path: [1, 2], id: 7 });
    expect(tweens[0].setTimeScale).toHaveBeenLastCalledWith(200 / 480);
    gameController.timings.step = 70;
    scene.updatePacing();
    expect(tweens[0].setTimeScale).toHaveBeenLastCalledWith(200 / 168);
    completions[0]();
    expect(tweens[1].setTimeScale).toHaveBeenLastCalledWith(200 / 168);
    completions[1]();
    completions[1]();
    expect(EventBus.emit).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 7);
  });

  it('jumps to destination when switching an active move to Instant', async () => {
    scene.animateMove({ playerId: 0, path: [1, 2, 3], id: 8 });
    gameController.timings.step = 0;
    scene.updatePacing();
    scene.updatePacing();
    expect(tweens[0].stop).toHaveBeenCalledOnce();
    await Promise.resolve();
    completions[0]();
    expect(ship.setPosition).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 8);
  });

  it('completes an empty Instant path without creating a tween', async () => {
    gameController.timings.step = 0;
    scene.animateMove({ playerId: 0, path: [], id: 9 });
    await Promise.resolve();
    expect(tweens).toHaveLength(0);
    expect(EventBus.emit).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 9);
  });

  it('cancels obsolete queued completions when replacing a move', async () => {
    gameController.timings.step = 0;
    scene.animateMove({ playerId: 0, path: [1], id: 10 });
    scene.animateMove({ playerId: 0, path: [2], id: 11 });
    await Promise.resolve();
    expect(EventBus.emit).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 11);
  });

  it('cancels an active tween without resolving its old landing', () => {
    scene.animateMove({ playerId: 0, path: [1], id: 12 });
    scene.cancelMove();
    completions[0]();
    expect(tweens[0].stop).toHaveBeenCalledOnce();
    expect(EventBus.emit).not.toHaveBeenCalled();
  });

  it('follows a relocated ship when an Instant move finishes', async () => {
    const camera = { centerOn: vi.fn() };
    Object.assign(scene, { following: true, cameras: { main: camera } });
    gameController.timings.step = 0;
    scene.animateMove({ playerId: 0, path: [69], id: 13 });
    await Promise.resolve();
    expect(camera.centerOn).toHaveBeenCalledWith(...ship.setPosition.mock.calls[0]);
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 13);
  });
});

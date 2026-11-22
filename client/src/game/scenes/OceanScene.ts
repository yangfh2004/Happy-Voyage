import Phaser from 'phaser';
import { windExit, successors, atmosphere, buildingDescription, buildingName, chartIdentity, colonyToll, createDefaultMap, nodeName, seaEventName, WORLD, type BuildingKind, type GameEvent, type GameState, type MapNode, type WindDirection } from '@happy-voyage/shared';
import { getLocale, pick, subscribeLocale } from '../../i18n';
import { readPreference } from '../../ui/accessibilityPreferences';

const REGIONS = [['ATLANTIC OCEAN', '大西洋'], ['THE AMERICAS', '美洲'], ['AFRICA · INDIAN OCEAN', '非洲 · 印度洋'], ['ASIAN SEAS', '亚洲海域']];
const GOLD_REASONS_ZH: Record<string, string> = { salary: '薪俸', promotion: '晋升', royal: '赏赐', colony: '殖民地', captain: '船长', lottery: '彩票', buried: '宝藏', foreign: '税金', merchant: '商船', pirate: '海盗', pirates: '海盗', revival: '修理', scrap: '废料', ship: '船只', storm: '风暴', trade: '交易', treasure: '宝藏', toll: '过路费', tax: '税金', market: '市场', build: '建设' };
import { EventBus } from '../EventBus';
import { gameController } from '../GameController';
import { sfx } from '../sfx';
import { CHART_DEPTH, drawAtmosphere } from '../atmosphereArt';
import { landingTarget, sailingRoute, type MovePath, type NavigatePreview } from '../landingTarget';
import { routeEdge } from '../routeEdge';
import { islandTexture } from '../islandArt';
import { bindStopHelp, stopHelpPosition } from '../stopHelp';
import { addNauticalSea, shipTexture } from '../nauticalArt';
import { captainShipTexture, sailingStepDuration } from '../captainShip';
import { occupiedShipPlacements, type MooredBerth } from '../shipBerths';
import { specialIslandTexture } from '../specialIslandArt';
import { playLanding, reducedLandingMotion } from '../landingEffects';
import { harbourTexture } from '../harbourArt';

const HOP_HEIGHT = 10;
const SPECIAL_HELP: Record<string, [string, string]> = {
  skeleton: ['Trade used ships after tribute or scrap trading.', '缴纳贡金或交易废料后买卖二手船。'],
  treasure: ['Buy lottery numbers and match the draw to win gold.', '购买彩票号码，匹配开奖赢取金币。'],
  mist: ['Duel a hermit to learn a strategy card.', '与隐士对决，学习谋略卡。'],
  revival: ['Pay for fleet repairs and block the next sea hazard.', '付费修理舰队，并抵挡下一次海上灾难。'],
  nightless: ['Buy and sell cargo at changing market prices.', '按变化的市场价格买卖货物。'],
  wind: ['Exchange fleet cargo for more valuable native goods.', '用船上货物交换更有价值的当地特产。'],
  dragonSnake: ['Recruit a captain for royal benefits and discounts.', '招募船长，获得王室福利和折扣。'],
};

/**
 * The sea: animated ocean, the route between stops, colony flags and the
 * fleets. Reads game state from the controller and never changes it; it only
 * reports when a move animation finishes.
 */
export class OceanScene extends Phaser.Scene {
  private map: MapNode[] = createDefaultMap();
  private following = true;
  private pinch: { distance: number; zoom: number } | null = null;
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private berths = new Map<number, MooredBerth>();
  private berthTweens = new Map<number, Phaser.Tweens.Tween>();
  private landingEffects = new Map<number, { stop(): void }>();
  private colorBlind = false;
  private ocean!: Phaser.GameObjects.Graphics;
  private route?: Phaser.GameObjects.Graphics;
  private atmosphereLayer?: Phaser.GameObjects.Graphics;
  private colonyBadges = new Map<number, Phaser.GameObjects.Text>();
  private shipBadges = new Map<number, Phaser.GameObjects.Text>();
  private roamerBadges = new Map<number, Phaser.GameObjects.Text>();
  private roamerTokens: Phaser.GameObjects.Image[] = [];
  private flags!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Layer;
  private stopLabels = new Map<number, Phaser.GameObjects.Text>();
  private regionLabels: Phaser.GameObjects.Text[] = [];
  /** Fleets whose move is being shown; their sprites are not snapped to the state position. */
  private sailing = new Set<number>();
  private islands = new Map<number, Phaser.GameObjects.Image>();
  private goldPopups = new Map<Phaser.GameObjects.Text, { x: number; y: number; lane: number }>();
  private movement: (MovePath & { id: number; index: number }) | null = null;
  private moveTween: Phaser.Tweens.Tween | null = null;
  private landingMarker?: Phaser.GameObjects.Graphics;
  private landingBadge?: Phaser.GameObjects.Text;
  private navigatePreview: NavigatePreview | null = null;
  private framedTarget: string | null = null;
  private stopTooltip: Phaser.GameObjects.Text | null = null;
  private labelLocale = getLocale();

  constructor() {
    super('Ocean');
  }

  create() {
    this.input.addPointer(1);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    const fit = () => this.fitChart();
    fit();
    this.following = true;
    this.cameras.main.setZoom(0.8);
    const zoom = (factor: number) => {
      this.following = false;
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, this.minimumZoom(), 2));
    };
    this.input.on('wheel', (_p: unknown, _o: unknown, _x: number, dy: number) => { zoom(dy > 0 ? 0.9 : 1.1); });
    this.input.on('pointerdown', () => {
      this.stopTooltip?.destroy();
      this.stopTooltip = null;
      this.updatePinch();
    });
    this.input.on('pointerup', () => { this.pinch = null; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      this.following = false;
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        return;
      } else {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });
    const onFit = () => fit();
    const onFollow = () => { this.following = true; this.cameras.main.useBounds = true; this.cameras.main.setZoom(0.95); this.syncFromState(); };
    const onResize = () => { if (this.following) onFollow(); else fit(); };
    this.scale.on('resize', onResize);
    EventBus.on('fit-chart', onFit);
    EventBus.on('follow-ship', onFollow);
    this.colorBlind = readPreference('color-blind');
    this.drawOcean();
    this.route = this.add.graphics();
    this.drawRoute();
    this.labels = this.add.layer().setDepth(CHART_DEPTH.labels);
    this.drawStops();
    this.atmosphereLayer = this.add.graphics().setDepth(CHART_DEPTH.atmosphere);
    // Flags and the turn ring sit above the fleets so a moored ship never hides who owns an island.
    this.flags = this.add.graphics().setDepth(11);
    this.marker = this.add.graphics().setDepth(12);
    this.landingMarker = this.add.graphics().setDepth(13);
    this.landingBadge = this.add.text(0, 0, '', { fontFamily: '"Sea Names", system-ui, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#fff8d8', backgroundColor: '#092f46', padding: { x: 7, y: 3 } }).setOrigin(0.5).setDepth(14).setVisible(false);

    const syncLabels = () => {
      const showLabels = getComputedStyle(this.scale.parent).getPropertyValue('--chart-labels').trim() !== 'hidden';
      this.labels.setVisible(showLabels);
    };
    syncLabels();
    this.scale.on(Phaser.Scale.Events.RESIZE, syncLabels);
    const onState = () => this.syncFromState();
    const onMove = (move: { playerId: number; path: number[]; id: number }) => this.animateMove(move);
    const onPacing = () => this.updatePacing();
    const onCancel = () => this.cancelMove();
    const onEngine = (event: GameEvent) => this.onEngineEvent(event);
    const onPalette = (enabled: boolean) => {
      this.colorBlind = enabled;
      this.drawOceanBackground();
      gameController.state?.players.forEach((player) => {
        this.applyCaptain(player.id, player.navigator, chartIdentity(player, enabled).color);
      });
      this.syncFromState();
    };
    EventBus.on('state-changed', onState);
    EventBus.on('animate-move', onMove);
    const onGold = (event: Extract<GameEvent, { type: 'goldChanged' }>) => this.showGold(event);
    EventBus.on('gold-changed', onGold);
    EventBus.on('pacing-changed', onPacing);
    EventBus.on('cancel-move', onCancel);
    EventBus.on('engine-event', onEngine);
    EventBus.on('palette-changed', onPalette);
    const onPreview = (preview: NavigatePreview | null) => { this.navigatePreview = preview; };
    EventBus.on('navigate-preview', onPreview);
    const unsubscribeLocale = subscribeLocale(() => this.relabel(gameController.state));
    const cleanup = () => {
      unsubscribeLocale();
      this.scale.off('resize', onResize);
      EventBus.off('fit-chart', onFit);
      EventBus.off('follow-ship', onFollow);
      this.goldPopups.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, syncLabels);
      this.cancelMove();
      EventBus.off('state-changed', onState);
      EventBus.off('animate-move', onMove);
      EventBus.off('gold-changed', onGold);
      EventBus.off('pacing-changed', onPacing);
      EventBus.off('cancel-move', onCancel);
      EventBus.off('engine-event', onEngine);
      EventBus.off('palette-changed', onPalette);
      EventBus.off('navigate-preview', onPreview);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    this.syncFromState();
    gameController.resumeMovement();
  }

  update() {
    this.updatePinch();
    this.drawLandingTarget();
    if (this.atmosphereLayer) drawAtmosphere(this.atmosphereLayer, gameController.state, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : this.time.now);
    this.shipBadges.forEach((badge, id) => {
      const ship = this.ships.get(id)!;
      badge.setPosition(ship.x + 12, ship.y - 13);
    });
  }

  private drawLandingTarget() {
    if (!this.landingMarker || !this.landingBadge) return;
    this.landingMarker.clear();
    const state = gameController.state;
    const target = gameController.landingTarget ?? landingTarget(state, null, this.navigatePreview);
    if (state && this.scale) {
      const camera = this.cameras.main;
      const key = target ? `${target.playerId}:${target.nodeId}` : null;
      if (target && key !== this.framedTarget) {
        const from = state.map[state.players[target.playerId].position];
        const to = state.map[target.nodeId];
        this.following = false;
        camera.setZoom(Phaser.Math.Clamp(Math.min(.95, (camera.width - 80) / (Math.abs(to.x - from.x) + 140), (camera.height - 80) / (Math.abs(to.y - from.y) + 140)), this.minimumZoom(), .95));
        camera.centerOn((from.x + to.x) / 2, (from.y + to.y) / 2);
      } else if (!target && this.framedTarget) {
        const node = state.map[state.players[state.currentPlayer].position];
        this.following = true;
        camera.setZoom(.95).centerOn(node.x, node.y);
      }
      this.framedTarget = key;
    }
    const focus = state && this.map[target?.nodeId ?? state.pendingClaim ?? state.players[state.currentPlayer].position];
    if (focus) {
      const camera = this.cameras.main;
      const rect = this.game.canvas.getBoundingClientRect();
      const point = { x: (focus.x - camera.worldView.x) * camera.zoom, y: (focus.y - camera.worldView.y) * camera.zoom };
      EventBus.emit('chart-focus', { x: Math.round(rect.left + point.x), y: Math.round(rect.top + point.y), bottom: point.y > camera.height / 2 });
    } else EventBus.emit('chart-focus', null);
    if (!state || !target) { this.landingBadge.setVisible(false); return; }
    const node = state.map.find((stop) => stop.id === target.nodeId)!;
    const { color } = chartIdentity(state.players[target.playerId], this.colorBlind);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pulse = reduced ? 0 : (Math.sin(this.time.now / 180) + 1) / 2;
    if (!target.preview) {
      const route = sailingRoute(state, this.movement);
      for (let i = 0; i < route.length - 1; i++) {
        const a = state.map[route[i]];
        const b = state.map[route[i + 1]];
        const count = Math.ceil(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 18);
        for (let j = 0; j < count; j++) this.landingMarker.fillStyle(color, .5).fillCircle(a.x + (b.x - a.x) * j / count, a.y + (b.y - a.y) * j / count, 4);
      }
    }
    const radius = 62 + pulse * 10;
    this.landingMarker.lineStyle(32, color, .12).strokeCircle(node.x, node.y, radius);
    this.landingMarker.lineStyle(23, color, .2).strokeCircle(node.x, node.y, radius);
    this.landingMarker.lineStyle(15, 0xffffff, .95).strokeCircle(node.x, node.y, radius);
    this.landingMarker.lineStyle(10, color, 1).strokeCircle(node.x, node.y, radius);
    this.landingBadge.setFontSize(Math.max(34, 16 / this.cameras.main.zoom)).setText(target.preview ? pick(getLocale(), 'Preview', '预览') : String(target.steps)).setPosition(node.x + 55, node.y - 64).setVisible(true);
  }

  private updatePinch() {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    if (!a.isDown || !b.isDown) { this.pinch = null; return; }
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance === 0) return;
    const camera = this.cameras.main;
    if (!this.pinch) this.pinch = { distance, zoom: camera.zoom };
    this.following = false;
    camera.setZoom(Phaser.Math.Clamp(this.pinch.zoom * distance / this.pinch.distance, this.minimumZoom(), 2));
  }

  private minimumZoom() {
    const camera = this.cameras.main;
    return camera.width && camera.height ? Math.min(camera.width / WORLD.width, camera.height / WORLD.height) : .16;
  }

  private fitChart() {
    const camera = this.cameras.main;
    camera.setSize(this.game.canvas.parentElement!.clientWidth, this.game.canvas.parentElement!.clientHeight);
    const zoom = Math.min(camera.width / WORLD.width, camera.height / WORLD.height);
    const padX = Math.max(0, (camera.width / zoom - WORLD.width) / 2);
    const padY = Math.max(0, (camera.height / zoom - WORLD.height) / 2);
    camera.setZoom(zoom);
    camera.setBounds(-padX, -padY, WORLD.width + padX * 2, WORLD.height + padY * 2);
    camera.useBounds = true;
    camera.centerOn(WORLD.width / 2, WORLD.height / 2);
    this.following = false;
  }

  private drawOcean() {
    this.ocean = this.add.graphics().setDepth(-5);
    this.drawOceanBackground();
    this.regionLabels = REGIONS.map(([en, zh], i) =>
      this.add.text(WORLD.width / 2, WORLD.height * (.23 + i * .18), getLocale() === 'zh' ? zh : en, { fontFamily: '"Sea Names", Georgia, serif', fontSize: '32px', color: '#b8dfdd' }).setOrigin(0.5).setAlpha(0.4));

    addNauticalSea(this, this.map, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  private drawOceanBackground() {
    const [top, bottom] = this.colorBlind ? [0x315574, 0x17273e] : [0x2b9fa8, 0x124c77];
    this.ocean.clear();
    this.ocean.fillStyle(top);
    this.ocean.fillGradientStyle(top, top, bottom, bottom, 1);
    this.ocean.fillRect(-WORLD.width * 4, 0, WORLD.width * 9, WORLD.height);
    this.ocean.fillStyle(top).fillRect(-WORLD.width * 4, -WORLD.height * 4, WORLD.width * 9, WORLD.height * 4);
    this.ocean.fillStyle(bottom).fillRect(-WORLD.width * 4, WORLD.height, WORLD.width * 9, WORLD.height * 4);
  }

  private syncBadge(badges: Map<number, Phaser.GameObjects.Text>, id: number, label: string | null, x: number, y: number, depth: number) {
    const previous = badges.get(id);
    if (label === null) {
      previous?.destroy();
      badges.delete(id);
    } else if (previous) {
      previous.setText(label).setPosition(x, y);
    } else {
      const badge = this.add.text(x, y, label, {
        fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: '17px',
        color: '#ffffff', backgroundColor: '#142235', padding: { x: 4, y: 0 },
      }).setOrigin(0.5).setDepth(depth);
      badges.set(id, badge);
    }
  }

  private drawRoute(direction: WindDirection | undefined = gameController.state?.wind?.direction) {
    const g = this.route;
    if (!g) return;
    g.clear();
    this.map.forEach((node) => {
      const exits = successors(this.map, node.id);
      const fork = exits.length > 1;
      const chosen = fork && direction ? windExit(this.map, node.id, direction) : undefined;
      if (fork) {
        const radius = node.kind === 'island' ? 68 : 34;
        g.lineStyle(11, 0x06283d, 1).strokeCircle(node.x, node.y, radius);
        g.lineStyle(6, 0xffd369, 1).strokeCircle(node.x, node.y, radius);
      }
      for (const [index, id] of exits.entries()) {
        const shortcut = index > 0;
        const selected = id === chosen;
        const { point, length, inset, curved } = routeEdge(this.map, node.id, id, shortcut);
        const line = (from: number, to: number) => {
          const segments = curved ? Math.max(1, Math.ceil((to - from) * 40)) : 1;
          for (let i = 0; i < segments; i++) {
            const a = point(from + (to - from) * i / segments);
            const b = point(from + (to - from) * (i + 1) / segments);
            g.lineBetween(a.x, a.y, b.x, b.y);
          }
        };
        const dashed = () => {
          const span = length - 2 * inset;
          for (let distance = 0; distance < span; distance += 25) line(distance / span, Math.min(distance + 16, span) / span);
        };
        if (selected) {
          g.lineStyle(18, 0x06283d, 1);
          line(0, 1);
          g.lineStyle(12, 0x7ffff0, 1);
          line(0, 1);
        }
        if (shortcut) {
          if (!selected) {
            g.lineStyle(13, 0x06283d, .8);
            dashed();
          }
          g.lineStyle(7, 0xffd369, 1);
          dashed();
        } else if (!selected) {
          g.lineStyle(7, 0x06283d, .4);
          dashed();
          g.lineStyle(4, 0xffffff, .7);
          dashed();
        }
        const { x, y } = point(.62);
        const ahead = point(.63);
        const behind = point(.61);
        const angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const size = shortcut || selected ? 16 : 9;
        g.fillStyle(0x06283d, 1).fillTriangle(x + 5 * dx, y + 5 * dy, x - (size + 4) * dx + (size + 2) * dy, y - (size + 4) * dy - (size + 2) * dx, x - (size + 4) * dx - (size + 2) * dy, y - (size + 4) * dy + (size + 2) * dx);
        g.fillStyle(selected ? 0x7ffff0 : shortcut ? 0xffd369 : 0xffffff, shortcut || selected ? 1 : .65).fillTriangle(x, y, x - size * dx + size * .65 * dy, y - size * dy - size * .65 * dx, x - size * dx - size * .65 * dy, y - size * dy + size * .65 * dx);
      }
    });
  }

  private drawStops() {
    for (const node of this.map) {
      if (node.kind === 'island') {
        this.islands.set(node.id, this.add.image(node.x, node.y, islandTexture(this, node)));
      } else if (node.kind === 'port') {
        this.islands.set(node.id, this.add.image(node.x, node.y, harbourTexture(this, node)));
      } else {
        this.add.image(node.x, node.y, specialIslandTexture(this, node));
      }

      const text = this.add
        .text(0, 0, this.stopLabel(node, null), {
          fontFamily: '"Sea Names", Georgia, serif',
          fontSize: '19px',
          wordWrap: { width: 146 },
          color: '#ffffff',
          align: 'center',
          stroke: '#06283d',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      text.setPosition(node.x, node.y + (node.kind === 'island' || node.kind === 'port' ? 63 : 55)).setOrigin(0.5, 0);
      this.labels.add(text);
      this.stopLabels.set(node.id, text);
      text.setInteractive({ useHandCursor: true });
      const showTooltip = () => {
        const locale = getLocale();
        const help = node.event === 'openSea' ? ['A random sea encounter is guaranteed here.', '海上遭遇：每次停靠都会发生。'] as [string, string] : SPECIAL_HELP[node.special ?? ''];
        const buildings = gameController.state?.buildings[node.id] ?? {};
        const lines = Object.entries(buildings).filter(([, level]) => level > 0).map(([kind]) => `${buildingName(kind as BuildingKind, locale)}: ${buildingDescription(kind as BuildingKind, locale)}`);
        if (help) lines.unshift(pick(locale, ...help));
        if (!lines.length) return;
        this.stopTooltip?.destroy();
        this.stopTooltip = this.add.text(node.x, node.y - 80, `${nodeName(node, locale)}\n${lines.join('\n')}`, { fontFamily: '"Sea Names", sans-serif', fontSize: '15px', color: '#fff6dc', backgroundColor: '#092f46', padding: { x: 12, y: 9 }, wordWrap: { width: 240 } }).setOrigin(.5, 1).setDepth(40).setScale(1 / this.cameras.main.zoom);
        const camera = this.cameras.main;
        const position = stopHelpPosition(this.stopTooltip, { width: this.stopTooltip.displayWidth, height: this.stopTooltip.displayHeight }, camera.worldView, 8 / camera.zoom);
        this.stopTooltip.setPosition(position.x, position.y);
      };
      const hideTooltip = () => { this.stopTooltip?.destroy(); this.stopTooltip = null; };
      bindStopHelp(text, showTooltip, hideTooltip);
      bindStopHelp(this.add.zone(node.x, node.y, 140, 110).setInteractive({ useHandCursor: true }), showTooltip, hideTooltip);
    }
  }

  private stopLabel(node: MapNode, state: GameState | null): string {
    const zh = getLocale() === 'zh';
    const name = nodeName(node, getLocale());
    if (node.kind === 'island') {
      const toll = state ? colonyToll(state, node.id) : node.toll;
      return zh ? `${name}\n${node.price}金 · 过路${toll}金` : `${name}\n${node.price}g · ${toll}g`;
    }
    return name;
  }

  private relabel(state: GameState | null) {
    const locale = getLocale();
    if (locale !== this.labelLocale) {
      this.stopTooltip?.destroy();
      this.stopTooltip = null;
      this.labelLocale = locale;
    }
    this.stopLabels.forEach((text, id) => text.setText(this.stopLabel(this.map[id], state)));
    this.regionLabels.forEach((text, i) => text.setText(REGIONS[i][getLocale() === 'zh' ? 1 : 0]));
  }

  private syncRoamers(state: GameState | null) {
    this.roamerBadges.forEach((badge) => badge.destroy());
    this.roamerBadges.clear();
    this.roamerTokens.forEach((token) => token.destroy());
    this.roamerTokens = [];
    for (const roamer of state?.roamers ?? []) {
      const node = state!.map[roamer.node];
      const texture = roamer.kind === 'pirates' ? shipTexture(this, 0x292332) : specialIslandTexture(this, { ...node, kind: 'event', event: 'smallMonster' });
      this.roamerTokens.push(this.add.image(node.x + 48, node.y - 27, texture).setScale(roamer.kind === 'pirates' ? 0.65 : 0.4).setDepth(15));
      const label = `${roamer.kind === 'pirates' ? '⚑' : 'M'} ${seaEventName(roamer.kind, getLocale())}`;
      const badge = this.add.text(node.x - 45, node.y + 38, label, { fontFamily: '"Sea Names", sans-serif', fontSize: '15px', color: roamer.kind === 'pirates' ? '#ffe3bd' : '#c7f9b5', backgroundColor: '#203c4d', padding: { x: 5, y: 3 } }).setDepth(15);
      this.roamerBadges.set(roamer.id, badge);
    }
  }

  private syncFromState() {
    const state = gameController.state;
    this.drawRoute();
    this.relabel(state);
    this.flags.clear();
    this.marker.clear();
    this.syncRoamers(state);
    if (!state) {
      this.landingEffects.forEach(effect => effect.stop());
      this.landingEffects.clear();
      for (const badges of [this.colonyBadges, this.shipBadges]) {
        badges.forEach((badge) => badge.destroy());
        badges.clear();
      }
      this.ships.forEach((ship) => {
        this.tweens.killTweensOf(ship);
        ship.destroy();
      });
      this.ships.clear();
      this.berths.clear();
      this.berthTweens.clear();
      this.sailing.clear();
      return;
    }

    // Colony flags in the owner's colour.
    state.owners.forEach((owner, nodeId) => {
      if (owner === null) {
        this.syncBadge(this.colonyBadges, nodeId, null, 0, 0, 0);
        return;
      }
      const node = this.map[nodeId];
      const { color, badge } = chartIdentity(state.players[owner], this.colorBlind);
      this.flags.lineStyle(10, 0x06283d, 1).strokeCircle(node.x, node.y, 28);
      this.flags.lineStyle(6, color, 1).strokeCircle(node.x, node.y, 28);
      this.flags.lineStyle(2, 0x3e2723).lineBetween(node.x + 10, node.y - 6, node.x + 10, node.y - 30);
      this.flags.fillStyle(color).fillTriangle(node.x + 10, node.y - 30, node.x + 10, node.y - 18, node.x + 26, node.y - 24);
      this.syncBadge(this.colonyBadges, nodeId, badge, node.x + 21, node.y - 27, 13);
    });

    // Fleets.
    for (const player of state.players) {
      const { color, badge } = chartIdentity(player, this.colorBlind);
      let ship = this.ships.get(player.id);
      if (!ship) {
        ship = this.add.image(0, 0, shipTexture(this, color)).setDepth(10);
        ship.setScale(0.8 + Math.min(0.15, Math.max(0, ...player.fleet.map(vessel => vessel.cargoCapacity)) / 1000));
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.tweens.add({ targets: ship, angle: { from: -5, to: 5 }, duration: 1500 + player.id * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.ships.set(player.id, ship);
        this.applyCaptain(player.id, player.navigator, color);
      }
      ship.setAlpha(player.bankrupt ? 0.25 : 1);
      if (!this.sailing.has(player.id)) {
        const [x, y] = this.tokenPosition(player.id, player.position);
        if (!this.berthTweens.has(player.id)) ship.setPosition(x, y);
      }
      this.syncBadge(this.shipBadges, player.id, player.bankrupt ? null : badge, ship.x + 12, ship.y - 13, 14);
      if (atmosphere(state).phase === 'night' && !player.bankrupt) {
        this.flags.fillStyle(0xffdc7d, 0.14).fillCircle(ship.x, ship.y, 22);
        this.flags.fillStyle(0xffef9d, 0.85).fillCircle(ship.x, ship.y + 6, 3);
      }
    }

    // Ring under the fleet whose turn it is.
    const current = this.ships.get(state.currentPlayer);
    if (current && this.following && this.sailing.size === 0) this.cameras.main.centerOn(current.x, current.y);
    if (current && state.phase !== 'gameOver' && this.sailing.size === 0) {
      this.marker.lineStyle(3, 0xffffff, 0.9).strokeCircle(current.x, current.y + 2, 20);
    }
  }

  private cancelMove() {
    this.moveTween?.stop();
    this.moveTween = null;
    this.movement = null;
    this.sailing.clear();
  }

  private animateMove(move: { playerId: number; path: number[]; id: number }) {
    this.cancelMove();
    this.landingEffects.get(move.playerId)?.stop();
    this.berthTweens.get(move.playerId)?.stop();
    this.berthTweens.delete(move.playerId);
    if (this.cameras?.main) this.following = true;
    this.movement = { ...move, index: 0 };
    this.sailing.add(move.playerId);
    this.marker.clear();
    this.nextStep();
  }

  private updatePacing() {
    if (!this.movement) return;
    if (gameController.timings.step === 0) {
      this.moveTween?.stop();
      this.moveTween = null;
      const move = this.movement;
      queueMicrotask(() => {
        if (this.movement === move) this.finishMove();
      });
    } else {
      this.moveTween?.setTimeScale(200 / this.stepDuration());
    }
  }

  private nextStep() {
    const move = this.movement;
    if (!move) return;
    if (gameController.timings.step === 0 || move.index >= move.path.length) {
      this.updatePacing();
      if (gameController.timings.step !== 0) this.finishMove();
      return;
    }
    const ship = this.ships.get(move.playerId);
    if (!ship) { this.finishMove(); return; }
    const [x, y] = this.tokenPosition(move.playerId, move.path[move.index++]);
    if (this.following) this.cameras.main.pan(x, y, this.stepDuration());
    this.moveTween = this.hop(ship, x, y, () => {
      if (this.movement !== move) return;
      this.moveTween = null;
      sfx.step();
      this.nextStep();
    }, move.index === move.path.length && !reducedLandingMotion());
    this.updatePacing();
  }

  private finishMove() {
    const move = this.movement;
    if (!move) return;
    const destination = move.path[move.path.length - 1];
    if (destination !== undefined) {
      const [x, y] = this.tokenPosition(move.playerId, destination);
      this.ships.get(move.playerId)?.setPosition(x, y);
      if (this.following) this.cameras.main.centerOn(x, y);
      const ship = this.ships.get(move.playerId);
      if (ship && gameController.timings.step > 0) {
        this.landingEffects.get(move.playerId)?.stop();
        const effect = playLanding(this, ship, () => this.landingEffects.delete(move.playerId));
        if (effect) this.landingEffects.set(move.playerId, effect);
      }
    }
    this.cancelMove();
    EventBus.emit('move-complete', move.id);
  }

  private stepDuration() {
    const player = gameController.state?.players.find(player => player.id === this.movement?.playerId);
    return sailingStepDuration(gameController.timings.step, player?.isAI ?? false);
  }

  private applyCaptain(id: number, navigator: string | undefined, color: number) {
    const ship = this.ships.get(id);
    if (!ship) return;
    ship.setTexture(shipTexture(this, color));
    void captainShipTexture(this, navigator ?? 'columbus', color).then(key => {
      const player = gameController.state?.players.find(player => player.id === id);
      if (player && this.ships.get(id) === ship && chartIdentity(player, this.colorBlind).color === color) ship.setTexture(key);
    }).catch(() => {});
  }

  /** One step along the route: a little arc, like a ship riding a swell. */
  private hop(ship: Phaser.GameObjects.Image, x: number, y: number, onComplete: () => void, landing = false): Phaser.Tweens.Tween {
    const fromX = ship.x;
    const fromY = ship.y;
    return this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 200,
      ease: landing ? 'Cubic.easeOut' : 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        ship.setPosition(fromX + (x - fromX) * t, fromY + (y - fromY) * t - Math.sin(Math.PI * t) * (landing ? 2 : HOP_HEIGHT));
      },
      onComplete,
    });
  }

  // --- board effects for engine events --------------------------------------

  private onEngineEvent(event: GameEvent) {
    const state = gameController.state;
    if (!state) return;
    switch (event.type) {
      case 'windChanged':
        this.drawRoute(event.direction);
        break;
      case 'seaEvent': {
        const ship = this.ships.get(event.playerId);
        if (event.event === 'largeMonster') this.cameras.main.shake(450, 0.009);
        else if (event.event === 'smallMonster') this.cameras.main.shake(180, 0.003);
        else if (event.event === 'turtle') this.cameras.main.shake(350, 0.006);
        if (ship && event.event === 'whirlpool') {
          const swirl = this.add.text(ship.x, ship.y, '◎', { fontSize: '64px', color: '#a1efff' }).setOrigin(0.5).setDepth(30);
          this.tweens.add({ targets: swirl, angle: 360, scale: 2, alpha: 0, duration: 900, onComplete: () => swirl.destroy() });
        }
        if (ship && (event.gold ?? 0) > 0) this.coinBurst(ship.x, ship.y + 30, ship.x, ship.y, 6);
        break;
      }
      case 'tollPaid': {
        const payer = this.ships.get(event.from);
        const island = this.map[state.players[event.from].position];
        if (!payer) break;
        this.coinBurst(payer.x, payer.y, island.x, island.y, 6, () => this.bounce(island.id));
        break;
      }
      case 'claimed': {
        const node = this.map[event.nodeId];
        const { color } = chartIdentity(state.players[event.playerId], this.colorBlind);
        this.bounce(node.id);
        this.confetti(node.x, node.y, color);
        break;
      }
      case 'goldChanged': {
        // The amounts themselves are shown by showGold; this adds the jingle of coins or the jolt of a storm.
        const ship = this.ships.get(event.playerId);
        if (!ship) break;
        if (event.reason === 'royal salary') {
          const home = this.map[state.players[event.playerId].homePort];
          this.coinBurst(home.x, home.y, ship.x, ship.y, 4);
        } else if (event.reason === 'treasure' || event.reason === 'trade') this.coinBurst(ship.x, ship.y + 20, ship.x, ship.y, 4);
        else if (event.reason === 'storm repairs') this.cameras.main.shake(250, 0.004);
        break;
      }
    }
  }

  /** Coins arcing from one point to another; `onArrive` runs when the first lands. */
  private coinBurst(fromX: number, fromY: number, toX: number, toY: number, count: number, onArrive?: () => void) {
    for (let i = 0; i < count; i++) {
      const coin = this.add.image(fromX, fromY, 'coin').setDepth(25);
      const lift = 50 + Math.random() * 30;
      const spread = (Math.random() - 0.5) * 30;
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * 60,
        duration: 450,
        ease: 'Quad.easeIn',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          coin.setPosition(fromX + (toX - fromX) * t + spread * Math.sin(Math.PI * t), fromY + (toY - fromY) * t - Math.sin(Math.PI * t) * lift);
        },
        onComplete: () => {
          coin.destroy();
          if (i === 0) onArrive?.();
        },
      });
    }
  }

  private bounce(nodeId: number) {
    const island = this.islands.get(nodeId);
    if (!island) return;
    this.tweens.add({ targets: island, scale: island.scaleX * 1.3, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  private confetti(x: number, y: number, color: number) {
    const colors = [color, 0xffd54f, 0xffffff];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const bit = this.add.rectangle(x, y, 6, 4, colors[i % colors.length]).setDepth(25);
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * Phaser.Math.Between(40, 70),
        y: y + Math.sin(angle) * Phaser.Math.Between(30, 60),
        angle: Phaser.Math.Between(-360, 360),
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => bit.destroy(),
      });
    }
  }

  private tokenPosition(playerId: number, nodeId: number): [number, number] {
    const players = (gameController.state?.players ?? []).filter(player => player.id !== playerId).map(player => ({
      id: player.id, position: this.sailing.has(player.id) ? this.berths.get(player.id)?.nodeId ?? player.position : player.position,
    }));
    const occupants = [...players, { id: playerId, position: nodeId }];
    const labels = new Map([...this.stopLabels].map(([id, text]) => {
      const bounds = text.getBounds();
      return [id, { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }] as const;
    }));
    const placements = occupiedShipPlacements(this.map, occupants, labels, this.berths);
    const previous = this.berths;
    this.berths = new Map([...placements].map(([id, berth]) => [id, { ...berth, nodeId: occupants.find(player => player.id === id)!.position }]));
    for (const [id, berth] of placements) {
      const player = gameController.state?.players.find(player => player.id === id);
      const scale = player ? 0.8 + Math.min(0.15, Math.max(0, ...(player.fleet ?? []).map(vessel => vessel.cargoCapacity)) / 1000) : .95;
      const ship = this.ships.get(id), old = previous.get(id);
      if (!ship) continue;
      if (old?.nodeId === this.berths.get(id)!.nodeId && (old.x !== berth.x || old.y !== berth.y || old.scale !== berth.scale) && !this.sailing.has(id)) {
        this.berthTweens.get(id)?.stop();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.berthTweens.delete(id);
          ship.setPosition(berth.x, berth.y).setScale(scale * berth.scale);
        } else {
          const tween = this.tweens.add({ targets: ship, x: berth.x, y: berth.y, scaleX: scale * berth.scale, scaleY: scale * berth.scale, duration: 300, ease: 'Sine.easeOut', onComplete: () => {
            if (this.berthTweens.get(id) === tween) this.berthTweens.delete(id);
          } });
          this.berthTweens.set(id, tween);
        }
      } else if (!this.berthTweens.has(id)) ship.setScale(scale * berth.scale);
    }
    const berth = placements.get(playerId);
    return berth ? [berth.x, berth.y] : [this.map[nodeId]?.x ?? 0, this.map[nodeId]?.y ?? 0];
  }

  private showGold({ playerId, delta, reason }: Extract<GameEvent, { type: 'goldChanged' }>) {
    const ship = this.ships.get(playerId);
    if (!ship) return;
    const englishReason = reason.startsWith('royal') ? 'salary' : reason.split(' ')[0];
    const shortReason = getLocale() === 'zh' ? GOLD_REASONS_ZH[englishReason.toLowerCase()] ?? '' : englishReason;
    const angle = Math.atan2(ship.y - WORLD.height / 2 - 10, ship.x - WORLD.width / 2);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nearby = [...this.goldPopups.values()].filter((other) => Math.hypot(other.x - ship.x, other.y - ship.y) < 90);
    let lane = 0;
    while (nearby.some((other) => other.lane === lane)) lane += 1;
    const offset = Math.ceil(lane / 2) * (lane % 2 === 1 ? 110 : -110);
    const popup = this.add.text(0, 0, `${delta < 0 ? '−' : '+'}${Math.abs(delta)}${getLocale() === 'zh' ? '金' : 'g'}${shortReason ? `\n${shortReason}` : ''}`, {
      fontFamily: '"Sea Names", system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: delta < 0 ? (this.colorBlind ? '#ffd18a' : '#ff9c9c') : (this.colorBlind ? '#a9deff' : '#9dffb0'),
      align: 'center', stroke: '#06283d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(CHART_DEPTH.popup);
    const distance = 32 + Math.abs(dx) * popup.width / 2 + Math.abs(dy) * popup.height / 2;
    const clampX = (x: number) => Phaser.Math.Clamp(x, popup.width / 2 + 8, WORLD.width - popup.width / 2 - 8);
    const clampY = (y: number) => Phaser.Math.Clamp(y, popup.height / 2 + 8, WORLD.height - popup.height / 2 - 8);
    popup.setPosition(clampX(ship.x + dx * distance - dy * offset), clampY(ship.y + dy * distance + dx * offset));
    this.goldPopups.set(popup, { x: ship.x, y: ship.y, lane });
    this.tweens.add({
      targets: popup, x: clampX(popup.x + dx * 48), y: clampY(popup.y + dy * 48), alpha: 0, duration: 1800,
      onComplete: () => { this.goldPopups.delete(popup); popup.destroy(); },
    });
  }
}

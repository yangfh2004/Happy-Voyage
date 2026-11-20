import Phaser from 'phaser';
import { createDefaultMap, WORLD, type GameEvent, type MapNode } from '@happy-voyage/shared';
import { EventBus } from '../EventBus';
import { gameController } from '../GameController';
import { sfx } from '../sfx';

const HOP_HEIGHT = 10;
const EVENT_SYMBOL: Record<string, string> = { treasure: '$', storm: '!', tradeWind: '≈' };

/** Small offsets so several fleets on one stop don't overlap. */
const TOKEN_OFFSETS = [
  [-14, -16],
  [14, -16],
  [-14, 12],
  [14, 12],
];

/**
 * The sea: animated ocean, the route between stops, colony flags and the
 * fleets. Reads game state from the controller and never changes it; it only
 * reports when a move animation finishes.
 */
export class OceanScene extends Phaser.Scene {
  private map: MapNode[] = createDefaultMap().map((node) => ({
    ...node,
    x: WORLD.width / 2 + (node.x - WORLD.width / 2) * 0.9,
    y: WORLD.height / 2 + 10 + (node.y - WORLD.height / 2 - 10) * 0.9,
  }));
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private flags!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Layer;
  /** Fleets whose move is being shown; their sprites are not snapped to the state position. */
  private sailing = new Set<number>();
  private islands = new Map<number, Phaser.GameObjects.Image>();
  private goldPopups = new Map<Phaser.GameObjects.Text, { x: number; y: number; lane: number }>();
  private movement: { playerId: number; path: number[]; id: number; index: number } | null = null;
  private moveTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('Ocean');
  }

  create() {
    this.drawOcean();
    this.drawRoute();
    this.labels = this.add.layer();
    this.drawStops();
    // Flags and the turn ring sit above the fleets so a moored ship never hides who owns an island.
    this.flags = this.add.graphics().setDepth(11);
    this.marker = this.add.graphics().setDepth(12);

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
    EventBus.on('state-changed', onState);
    EventBus.on('animate-move', onMove);
    const onGold = (event: Extract<GameEvent, { type: 'goldChanged' }>) => this.showGold(event);
    EventBus.on('gold-changed', onGold);
    EventBus.on('pacing-changed', onPacing);
    EventBus.on('cancel-move', onCancel);
    EventBus.on('engine-event', onEngine);
    const cleanup = () => {
      this.goldPopups.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, syncLabels);
      this.cancelMove();
      EventBus.off('state-changed', onState);
      EventBus.off('animate-move', onMove);
      EventBus.off('gold-changed', onGold);
      EventBus.off('pacing-changed', onPacing);
      EventBus.off('cancel-move', onCancel);
      EventBus.off('engine-event', onEngine);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    this.syncFromState();
  }

  private drawOcean() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1e88c7, 0x1e88c7, 0x0a3d62, 0x0a3d62, 1);
    bg.fillRect(0, 0, WORLD.width, WORLD.height);

    // Drifting wave crests.
    for (let i = 0; i < 45; i++) {
      const wave = this.add
        .image(Phaser.Math.Between(0, WORLD.width), Phaser.Math.Between(0, WORLD.height), 'wave')
        .setAlpha(Phaser.Math.FloatBetween(0.3, 0.8))
        .setScale(Phaser.Math.FloatBetween(0.6, 1.2));
      this.tweens.add({
        targets: wave,
        x: wave.x + Phaser.Math.Between(20, 50),
        alpha: 0.1,
        duration: Phaser.Math.Between(2500, 5000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawRoute() {
    const g = this.add.graphics();
    g.lineStyle(4, 0xffffff, 0.25);
    this.map.forEach((node, i) => {
      const next = this.map[(i + 1) % this.map.length];
      g.lineBetween(node.x, node.y, next.x, next.y);
      const angle = Math.atan2(next.y - node.y, next.x - node.x);
      const x = (node.x + next.x) / 2;
      const y = (node.y + next.y) / 2;
      g.lineStyle(2, 0xffffff, 0.65);
      for (const side of [-1, 1]) {
        g.lineBetween(x, y, x - 9 * Math.cos(angle) + side * 5 * Math.sin(angle), y - 9 * Math.sin(angle) - side * 5 * Math.cos(angle));
      }
      g.lineStyle(4, 0xffffff, 0.25);
    });
  }

  private drawStops() {
    for (const node of this.map) {
      if (node.kind === 'island') {
        this.islands.set(node.id, this.add.image(node.x, node.y, 'island'));
      } else if (node.kind === 'port') {
        const g = this.add.graphics();
        g.fillStyle(0x8d6e63).fillRoundedRect(node.x - 26, node.y - 22, 52, 44, 8);
        g.fillStyle(0xffd54f).fillRect(node.x - 16, node.y - 12, 32, 24);
        g.fillStyle(0x6d4c41).fillRect(node.x - 5, node.y - 2, 10, 14);
        g.fillStyle(0xd32f2f).fillTriangle(node.x, node.y - 40, node.x, node.y - 26, node.x + 14, node.y - 33);
        g.lineStyle(2, 0x3e2723).lineBetween(node.x, node.y - 40, node.x, node.y - 22);
      } else {
        const g = this.add.graphics();
        g.fillStyle(node.event === 'storm' ? 0x37474f : 0xffb300, 0.95).fillCircle(node.x, node.y, 18);
        g.lineStyle(2, 0xffffff, 0.8).strokeCircle(node.x, node.y, 18);
        this.add
          .text(node.x, node.y, EVENT_SYMBOL[node.event ?? ''] ?? '?', { fontSize: '20px', fontStyle: 'bold', color: '#fff' })
          .setOrigin(0.5);
      }

      const angle = Math.atan2(node.y - WORLD.height / 2 - 10, node.x - WORLD.width / 2);
      const label = node.kind === 'island' ? `${node.name}\n${node.price}g · toll ${node.toll}g` : node.name;
      const text = this.add
        .text(0, 0, label, {
          fontFamily: 'Georgia, serif',
          fontSize: '13px',
          color: '#ffffff',
          align: 'center',
          stroke: '#06283d',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const distance = 36 + Math.abs(dx) * text.width / 2 + Math.abs(dy) * text.height / 2;
      text.setPosition(node.x + dx * distance, node.y + dy * distance);
      this.labels.add(text);
    }
  }

  private syncFromState() {
    const state = gameController.state;
    this.flags.clear();
    this.marker.clear();
    if (!state) {
      this.ships.forEach((ship) => ship.destroy());
      this.ships.clear();
      this.sailing.clear();
      return;
    }

    // Colony flags in the owner's colour.
    state.owners.forEach((owner, nodeId) => {
      if (owner === null) return;
      const node = this.map[nodeId];
      const color = state.players[owner].color;
      this.flags.lineStyle(5, color, 1).strokeCircle(node.x, node.y, 27);
      this.flags.lineStyle(2, 0x3e2723).lineBetween(node.x + 10, node.y - 6, node.x + 10, node.y - 30);
      this.flags.fillStyle(color).fillTriangle(node.x + 10, node.y - 30, node.x + 10, node.y - 18, node.x + 26, node.y - 24);
    });

    // Fleets.
    for (const player of state.players) {
      let ship = this.ships.get(player.id);
      if (!ship) {
        ship = this.add.image(0, 0, 'ship').setTint(player.color).setDepth(10);
        this.ships.set(player.id, ship);
      }
      ship.setAlpha(player.bankrupt ? 0.25 : 1);
      if (!this.sailing.has(player.id)) {
        const [x, y] = this.tokenPosition(player.id, player.position);
        ship.setPosition(x, y);
      }
    }

    // Ring under the fleet whose turn it is.
    const current = this.ships.get(state.currentPlayer);
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
      this.moveTween?.setTimeScale(200 / gameController.timings.step);
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
    this.moveTween = this.hop(ship, x, y, () => {
      if (this.movement !== move) return;
      this.moveTween = null;
      sfx.step();
      this.nextStep();
    });
    this.updatePacing();
  }

  private finishMove() {
    const move = this.movement;
    if (!move) return;
    const destination = move.path[move.path.length - 1];
    if (destination !== undefined) {
      const [x, y] = this.tokenPosition(move.playerId, destination);
      this.ships.get(move.playerId)?.setPosition(x, y);
    }
    this.cancelMove();
    EventBus.emit('move-complete', move.id);
  }

  /** One step along the route: a little arc, like a ship riding a swell. */
  private hop(ship: Phaser.GameObjects.Image, x: number, y: number, onComplete: () => void): Phaser.Tweens.Tween {
    const fromX = ship.x;
    const fromY = ship.y;
    ship.setFlipX(x < fromX);
    return this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 200,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        ship.setPosition(fromX + (x - fromX) * t, fromY + (y - fromY) * t - Math.sin(Math.PI * t) * HOP_HEIGHT);
      },
      onComplete,
    });
  }

  // --- board effects for engine events --------------------------------------

  private onEngineEvent(event: GameEvent) {
    const state = gameController.state;
    if (!state) return;
    switch (event.type) {
      case 'tollPaid': {
        const payer = this.ships.get(event.from);
        const island = this.map[state.players[event.from].position];
        if (!payer) break;
        this.coinBurst(payer.x, payer.y, island.x, island.y, 6, () => this.bounce(island.id));
        break;
      }
      case 'claimed': {
        const node = this.map[event.nodeId];
        const color = state.players[event.playerId].color;
        this.bounce(node.id);
        this.confetti(node.x, node.y, color);
        break;
      }
      case 'goldChanged': {
        // The amounts themselves are shown by showGold; this adds the jingle of coins or the jolt of a storm.
        const ship = this.ships.get(event.playerId);
        if (!ship) break;
        if (event.reason === 'royal salary') {
          const home = this.map[0];
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
    this.tweens.add({ targets: island, scale: 1.3, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
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
    const node = this.map[nodeId];
    const [dx, dy] = TOKEN_OFFSETS[playerId % TOKEN_OFFSETS.length];
    return [node.x + dx, node.y + dy];
  }

  private showGold({ playerId, delta, reason }: Extract<GameEvent, { type: 'goldChanged' }>) {
    const ship = this.ships.get(playerId);
    if (!ship) return;
    const shortReason = reason.startsWith('royal') ? 'salary' : reason.split(' ')[0];
    const angle = Math.atan2(ship.y - WORLD.height / 2 - 10, ship.x - WORLD.width / 2);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nearby = [...this.goldPopups.values()].filter((other) => Math.hypot(other.x - ship.x, other.y - ship.y) < 90);
    let lane = 0;
    while (nearby.some((other) => other.lane === lane)) lane += 1;
    const offset = Math.ceil(lane / 2) * (lane % 2 === 1 ? 110 : -110);
    const popup = this.add.text(0, 0, `${delta < 0 ? '−' : '+'}${Math.abs(delta)}g\n${shortReason}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: delta < 0 ? '#ff9c9c' : '#9dffb0', align: 'center', stroke: '#06283d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);
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

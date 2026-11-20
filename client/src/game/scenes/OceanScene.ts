import Phaser from 'phaser';
import { createDefaultMap, WORLD, type MapNode, type GameEvent } from '@happy-voyage/shared';
import { EventBus } from '../EventBus';
import { gameController } from '../GameController';

const EVENT_SYMBOL: Record<string, string> = { treasure: '$', storm: '!', tradeWind: '≈', pirates: '⚔', seaMonster: 'M', whirlpool: '◎', bottle: '?', floatingCargo: '▣', merchant: '¤', wyvern: 'W' };
const SPECIAL_SYMBOL: Record<string, string> = { skeleton: '☠', treasure: '◆', mist: '☁', revival: '✚', nightless: '☾', wind: '≋', dragonSnake: '♜' };
const PORT_FLAGS: Record<string, [number, number, number]> = {
  Spain: [0xc62632, 0xf6c945, 0xc62632], Netherlands: [0xc62632, 0xffffff, 0x23478e],
  England: [0xffffff, 0xc62632, 0xffffff], Portugal: [0x147549, 0xc62632, 0xc62632],
  China: [0xc62632, 0xc62632, 0xc62632], France: [0x23478e, 0xffffff, 0xc62632],
  Japan: [0xffffff, 0xffffff, 0xffffff], Germany: [0x202020, 0xc62632, 0xf6c945],
  Italy: [0x147549, 0xffffff, 0xc62632], Korea: [0xffffff, 0xffffff, 0xffffff],
};

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
  private map: MapNode[] = createDefaultMap();
  private following = true;
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private flags!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Layer;
  private animatingPlayer: number | null = null;
  private goldPopups = new Map<Phaser.GameObjects.Text, { x: number; y: number; lane: number }>();
  private movement: { playerId: number; path: number[]; id: number; index: number } | null = null;
  private moveTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('Ocean');
  }

  create() {
    this.input.addPointer(1);
    const fit = () => {
      const camera = this.cameras.main;
      camera.setSize(this.game.canvas.parentElement!.clientWidth, this.game.canvas.parentElement!.clientHeight);
      camera.setZoom(Math.min(camera.width / WORLD.width, camera.height / WORLD.height));
      camera.centerOn(WORLD.width / 2, WORLD.height / 2);
      this.following = false;
    };
    fit();
    this.following = this.scale.width < 700;
    if (this.following) this.cameras.main.setZoom(0.95);
    const zoom = (factor: number) => this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, 0.16, 2));
    this.input.on('wheel', (_p: unknown, _o: unknown, _x: number, dy: number) => { zoom(dy > 0 ? 0.9 : 1.1); });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      this.following = false;
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        const now = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        const before = Phaser.Math.Distance.Between(a.prevPosition.x, a.prevPosition.y, b.prevPosition.x, b.prevPosition.y);
        if (before > 0) zoom(now / before);
      } else {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });
    const onFit = () => fit();
    const onFollow = () => { this.following = true; this.cameras.main.setZoom(0.95); this.syncFromState(); };
    const onResize = () => { if (this.scale.width >= 700) fit(); else onFollow(); };
    this.scale.on('resize', onResize);
    EventBus.on('fit-chart', onFit);
    EventBus.on('follow-ship', onFollow);
    this.drawOcean();
    this.drawRoute();
    this.flags = this.add.graphics().setDepth(5);
    this.labels = this.add.layer();
    this.drawStops();
    this.marker = this.add.graphics();

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
    EventBus.on('state-changed', onState);
    EventBus.on('animate-move', onMove);
    const onGold = (event: Extract<GameEvent, { type: 'goldChanged' }>) => this.showGold(event);
    EventBus.on('gold-changed', onGold);
    EventBus.on('pacing-changed', onPacing);
    EventBus.on('cancel-move', onCancel);
    const cleanup = () => {
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
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    this.syncFromState();
  }

  private drawOcean() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1e88c7, 0x1e88c7, 0x0a3d62, 0x0a3d62, 1);
    bg.fillRect(0, 0, WORLD.width, WORLD.height);
    ['ATLANTIC OCEAN', 'THE AMERICAS', 'AFRICA · INDIAN OCEAN', 'ASIAN SEAS'].forEach((name, i) => {
      this.add.text(WORLD.width / 2, 24 + i * 280, name, { fontFamily: 'Georgia', fontSize: '24px', color: '#b8dfdd' }).setOrigin(0.5).setAlpha(0.4);
    });

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
        this.add.image(node.x, node.y, 'island').setScale(1.2);
      } else if (node.kind === 'port') {
        const g = this.add.graphics();
        const flag = this.add.graphics({ x: 50, y: 27 });
        const nation = node.nation ?? '';
        const stripes = PORT_FLAGS[nation] ?? [0xffffff, 0xffffff, 0xffffff];
        const vertical = ['Portugal', 'France', 'Italy'].includes(nation);
        stripes.forEach((color, i) => {
          flag.fillStyle(color).fillRect(node.x - 21 + (vertical ? i * 14 : 0), node.y - 55 + (vertical ? 0 : i * 8), vertical ? 14 : 42, vertical ? 24 : 8);
        });
        if (nation === 'England') flag.fillStyle(0xc62632).fillRect(node.x - 4, node.y - 55, 8, 24);
        if (nation === 'Japan' || nation === 'Korea') {
          flag.fillStyle(0xc62632).fillCircle(node.x, node.y - 43, 7);
          if (nation === 'Korea') flag.fillStyle(0x23478e).fillCircle(node.x, node.y - 40, 4);
        }
        if (nation === 'China') flag.fillStyle(0xf6c945).fillCircle(node.x - 11, node.y - 48, 4);
        flag.lineStyle(1, 0x06283d).strokeRect(node.x - 21, node.y - 55, 42, 24);
        g.fillStyle(0x8d6e63).fillRoundedRect(node.x - 26, node.y - 22, 52, 44, 8);
        g.fillStyle(0xffd54f).fillRect(node.x - 16, node.y - 12, 32, 24);
        g.fillStyle(0x6d4c41).fillRect(node.x - 5, node.y - 2, 10, 14);
        flag.lineStyle(2, 0x3e2723).lineBetween(node.x - 21, node.y - 55, node.x - 21, node.y - 22);
      } else if (node.kind === 'special') {
        const colors = [0x9c4778, 0xe2b634, 0x8074ae, 0x38a58c, 0x494c9d, 0x41a9bf, 0xc65d42];
        const index = Object.keys(SPECIAL_SYMBOL).indexOf(node.special ?? '');
        this.add.graphics().fillStyle(colors[index] ?? 0xffffff).fillCircle(node.x, node.y, 28).lineStyle(3, 0xffedbe).strokeCircle(node.x, node.y, 28);
        this.add.text(node.x, node.y, SPECIAL_SYMBOL[node.special ?? ''] ?? '★', { fontSize: '26px' }).setOrigin(0.5);
      } else {
        const g = this.add.graphics();
        g.fillStyle(node.event === 'storm' ? 0x37474f : 0xffb300, 0.95).fillCircle(node.x, node.y, 23);
        g.lineStyle(2, 0xffffff, 0.8).strokeCircle(node.x, node.y, 23);
        this.add
          .text(node.x, node.y, EVENT_SYMBOL[node.event ?? ''] ?? '?', { fontSize: '20px', fontStyle: 'bold', color: '#fff' })
          .setOrigin(0.5);
      }

      const label = node.kind === 'island' ? `${node.name}\n${node.price}g · ${node.toll}g` : `${node.name}${node.chineseName ? `\n${node.chineseName}` : ''}`;
      const text = this.add
        .text(0, 0, label, {
          fontFamily: 'Georgia, "Sea Names", serif',
          fontSize: '19px',
          wordWrap: { width: 146 },
          color: '#ffffff',
          align: 'center',
          stroke: '#06283d',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      text.setPosition(node.x, node.y + 35).setOrigin(0.5, 0);
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
      return;
    }

    // Colony flags in the owner's colour.
    state.owners.forEach((owner, nodeId) => {
      if (owner === null) return;
      const node = this.map[nodeId];
      const color = state.players[owner].color;
      this.flags.lineStyle(10, 0x06283d, 1).strokeCircle(node.x, node.y, 28);
      this.flags.lineStyle(6, color, 1).strokeCircle(node.x, node.y, 28);
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
      if (this.animatingPlayer !== player.id) {
        const [x, y] = this.tokenPosition(player.id, player.position);
        ship.setPosition(x, y);
      }
    }

    // Ring under the fleet whose turn it is.
    const current = this.ships.get(state.currentPlayer);
    if (current && this.following && this.animatingPlayer === null) this.cameras.main.centerOn(current.x, current.y);
    if (current && state.phase !== 'gameOver') {
      this.marker.lineStyle(3, 0xffffff, 0.9).strokeCircle(current.x, current.y + 2, 20);
    }
  }

  private cancelMove() {
    this.moveTween?.stop();
    this.moveTween = null;
    this.movement = null;
    this.animatingPlayer = null;
  }

  private animateMove(move: { playerId: number; path: number[]; id: number }) {
    this.cancelMove();
    this.movement = { ...move, index: 0 };
    this.animatingPlayer = move.playerId;
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
    if (this.following) this.cameras.main.pan(x, y, gameController.timings.step);
    ship.setFlipX(x < ship.x);
    this.moveTween = this.tweens.add({
      targets: ship, x, y, duration: 200, ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.movement !== move) return;
        this.moveTween = null;
        this.nextStep();
      },
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
      if (this.following) this.cameras.main.centerOn(x, y);
    }
    this.cancelMove();
    EventBus.emit('move-complete', move.id);
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

import Phaser from 'phaser';
import { createDefaultMap, WORLD, type MapNode } from '@happy-voyage/shared';
import { EventBus } from '../EventBus';
import { gameController } from '../GameController';

const STEP_MS = 200;
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
  private map: MapNode[] = createDefaultMap();
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private flags!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Graphics;
  private animatingPlayer: number | null = null;

  constructor() {
    super('Ocean');
  }

  create() {
    this.drawOcean();
    this.drawRoute();
    this.flags = this.add.graphics();
    this.drawStops();
    this.marker = this.add.graphics();

    const onState = () => this.syncFromState();
    const onMove = (move: { playerId: number; path: number[] }) => void this.animateMove(move);
    EventBus.on('state-changed', onState);
    EventBus.on('animate-move', onMove);
    const cleanup = () => {
      EventBus.off('state-changed', onState);
      EventBus.off('animate-move', onMove);
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
    });
  }

  private drawStops() {
    const cy = WORLD.height / 2;
    for (const node of this.map) {
      if (node.kind === 'island') {
        this.add.image(node.x, node.y, 'island');
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

      const below = node.y >= cy;
      const label = node.kind === 'island' ? `${node.name}\n${node.price}g · toll ${node.toll}g` : node.name;
      this.add
        .text(node.x, node.y + (below ? 30 : -30), label, {
          fontFamily: 'Georgia, serif',
          fontSize: '13px',
          color: '#ffffff',
          align: 'center',
          stroke: '#06283d',
          strokeThickness: 4,
        })
        .setOrigin(0.5, below ? 0 : 1);
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
      if (this.animatingPlayer !== player.id) {
        const [x, y] = this.tokenPosition(player.id, player.position);
        ship.setPosition(x, y);
      }
    }

    // Ring under the fleet whose turn it is.
    const current = this.ships.get(state.currentPlayer);
    if (current && state.phase !== 'gameOver') {
      this.marker.lineStyle(3, 0xffffff, 0.9).strokeCircle(current.x, current.y + 2, 20);
    }
  }

  private async animateMove({ playerId, path }: { playerId: number; path: number[] }) {
    const ship = this.ships.get(playerId);
    if (!ship) return;
    this.animatingPlayer = playerId;
    this.marker.clear();
    for (const nodeId of path) {
      const [x, y] = this.tokenPosition(playerId, nodeId);
      ship.setFlipX(x < ship.x);
      await new Promise<void>((resolve) =>
        this.tweens.add({ targets: ship, x, y, duration: STEP_MS, ease: 'Sine.easeInOut', onComplete: () => resolve() }),
      );
    }
    this.animatingPlayer = null;
    EventBus.emit('move-complete');
  }

  private tokenPosition(playerId: number, nodeId: number): [number, number] {
    const node = this.map[nodeId];
    const [dx, dy] = TOKEN_OFFSETS[playerId % TOKEN_OFFSETS.length];
    return [node.x + dx, node.y + dy];
  }
}

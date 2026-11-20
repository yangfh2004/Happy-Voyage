import type Phaser from 'phaser';
import { atmosphere, WORLD, type GameState } from '@happy-voyage/shared';

export const CHART_DEPTH = { atmosphere: 20, labels: 40, popup: 50 } as const;

export function drawAtmosphere(g: Phaser.GameObjects.Graphics, state: GameState | null, time: number) {
  const { phase, weather } = atmosphere(state);
  g.clear();
  const tint = { dawn: [0xffc571, 0.13], day: [0xffffff, 0], dusk: [0xca718e, 0.2], night: [0x10265b, 0.4] }[phase];
  g.fillStyle(tint[0], tint[1]).fillRect(0, 0, WORLD.width, WORLD.height);
  if (weather === 'storm') g.fillStyle(0x233c66, 0.3).fillRect(0, 0, WORLD.width, WORLD.height);
  if (weather === 'clouds' || weather === 'rain' || weather === 'storm' || weather === 'fog') {
    for (let i = 0; i < 8; i++) {
      const x = (i * 337 + 80) % WORLD.width;
      const y = (i * 193 + 70) % WORLD.height;
      g.fillStyle(0xe5ffff, weather === 'fog' ? 0.18 : 0.11);
      g.fillEllipse(x, y, weather === 'fog' ? 1100 : 330, weather === 'fog' ? 150 : 85);
      g.fillEllipse(x + 60, y - 25, 210, 95);
    }
  }
  for (let i = 0; i < 64; i++) {
    const x = (i * 137 + 17) % WORLD.width;
    const y = (i * 223 + 31) % WORLD.height;
    if (weather === 'rain' || weather === 'storm') {
      const dropY = (y + time * 0.25) % WORLD.height;
      g.lineStyle(2, 0xd6f6ff, 0.5).lineBetween(x, dropY, x - 8, dropY + 24);
    } else {
      g.fillStyle(phase === 'night' ? 0xfff5ad : 0xe9fffa, 0.35 + 0.2 * Math.sin(time / 1000 + i));
      g.fillCircle(x, y, phase === 'night' ? 2 : 1.5);
    }
  }
}

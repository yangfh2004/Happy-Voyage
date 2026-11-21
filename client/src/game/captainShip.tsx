import type Phaser from 'phaser';
import { renderToStaticMarkup } from 'react-dom/server';
import { NavigatorPortrait } from '../ui/NavigatorPortrait';
import { shipTexture } from './nauticalArt';

export { sailingStepDuration } from '@happy-voyage/shared';

export async function captainShipTexture(scene: Phaser.Scene, navigator: string, color: number): Promise<string> {
  const key = `captain-fleet-${navigator}-${color}`;
  if (scene.textures.exists(key)) return key;
  const svg = renderToStaticMarkup(<NavigatorPortrait navigator={navigator} color={color} size={56} />);
  const portrait = new Image();
  await new Promise<void>((resolve, reject) => {
    portrait.onload = () => resolve();
    portrait.onerror = () => reject(new Error('Could not render captain portrait'));
    portrait.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
  });
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = 112; canvas.height = 124;
    const context = canvas.getContext('2d')!;
    context.drawImage(scene.textures.get(shipTexture(scene, color)).getSourceImage() as HTMLCanvasElement, 0, 22, 112, 106);
    context.drawImage(portrait, 28, 0, 56, 56);
    scene.textures.addCanvas(key, canvas);
  }
  return key;
}

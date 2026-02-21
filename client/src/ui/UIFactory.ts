import Phaser from 'phaser';
import { Decorative } from './designTokens';

/**
 * Draw a gold divider line using the Decorative.divider design token.
 * Returns the Graphics object so it can be tracked for cleanup.
 */
export function drawGoldDivider(
  scene: Phaser.Scene,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  alpha: number = Decorative.divider.alpha,
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.lineStyle(Decorative.divider.thickness, Decorative.divider.color, alpha);
  gfx.lineBetween(x1, y1, x2, y2);
  return gfx;
}

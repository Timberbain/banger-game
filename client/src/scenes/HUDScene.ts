import Phaser from 'phaser';

/**
 * HUDScene - Overlay scene for in-game HUD elements.
 * Launched alongside GameScene (not started) so it renders on top.
 * Stub for now -- full implementation in Plan 03.
 */
export class HUDScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HUDScene' });
  }

  create() {
    // Transparent background so GameScene shows through
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
  }

  update() {
    // Will be populated in Plan 03
  }
}

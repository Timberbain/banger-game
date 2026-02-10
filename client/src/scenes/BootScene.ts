import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Only load tileset image (maps loaded dynamically in GameScene)
    this.load.image('tiles', 'tilesets/placeholder.png');
  }

  create() {
    // Simple loading/title screen
    this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);

    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      'BANGER',
      { fontSize: '48px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold' }
    ).setOrigin(0.5);

    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 20,
      'Connecting...',
      { fontSize: '16px', color: '#aaaaaa', fontFamily: 'Arial' }
    ).setOrigin(0.5);

    // Transition to GameScene after brief delay
    this.time.delayedCall(500, () => {
      this.scene.start('GameScene');
    });
  }
}

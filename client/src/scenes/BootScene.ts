import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load tileset image
    this.load.image('tiles', 'tilesets/placeholder.png');

    // Load tilemap JSON
    this.load.tilemapTiledJSON('test_arena', 'maps/test_arena.json');
  }

  create() {
    // Create tilemap from JSON
    const map = this.make.tilemap({ key: 'test_arena' });

    // Add tileset to the map
    const tileset = map.addTilesetImage('placeholder', 'tiles');

    if (!tileset) {
      console.error('Failed to load tileset');
      return;
    }

    // Create layers
    const groundLayer = map.createLayer('Ground', tileset, 0, 0);
    const wallsLayer = map.createLayer('Walls', tileset, 0, 0);

    if (!groundLayer || !wallsLayer) {
      console.error('Failed to create layers');
      return;
    }

    // Set collision for wall tiles (all non-empty tiles in the Walls layer)
    wallsLayer.setCollisionByExclusion([-1, 0]);

    // Add title text
    const titleText = this.add.text(
      this.cameras.main.centerX,
      20,
      'Banger - Test Arena',
      {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial',
      }
    );
    titleText.setOrigin(0.5, 0);

    // Add connection status text
    const statusText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Loading...',
      {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'Arial',
      }
    );
    statusText.setOrigin(0.5);

    console.log('BootScene loaded, map rendered');

    // Transition to GameScene after a brief delay
    this.time.delayedCall(500, () => {
      this.scene.start('GameScene');
    });
  }
}

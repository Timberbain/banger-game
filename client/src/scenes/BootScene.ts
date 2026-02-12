import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Character spritesheets (32x32 frames, 26 frames each in horizontal strip)
    this.load.spritesheet('paran', 'sprites/paran.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('faran', 'sprites/faran.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('baran', 'sprites/baran.png', { frameWidth: 32, frameHeight: 32 });

    // Projectile spritesheet (8x8 frames, 3 frames: paran=0, faran=1, baran=2)
    this.load.spritesheet('projectiles', 'sprites/projectiles.png', { frameWidth: 8, frameHeight: 8 });

    // Particle texture for runtime tinting
    this.load.image('particle', 'sprites/particle.png');

    // Note: Tileset images are loaded per-map in GameScene after receiving mapName from server
  }

  create() {
    // Initialize AudioManager and generate all SFX from jsfxr
    // Audio context will be unlocked by user clicks in LobbyScene
    const audioManager = new AudioManager();
    audioManager.init();
    this.registry.set('audioManager', audioManager);

    // Create character animations for all 3 roles
    const roles = ['paran', 'faran', 'baran'];
    for (const role of roles) {
      // Walk Down: frames 0-3
      this.anims.create({
        key: `${role}-walk-down`,
        frames: this.anims.generateFrameNumbers(role, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });

      // Walk Up: frames 4-7
      this.anims.create({
        key: `${role}-walk-up`,
        frames: this.anims.generateFrameNumbers(role, { start: 4, end: 7 }),
        frameRate: 8,
        repeat: -1,
      });

      // Walk Right: frames 8-11
      this.anims.create({
        key: `${role}-walk-right`,
        frames: this.anims.generateFrameNumbers(role, { start: 8, end: 11 }),
        frameRate: 8,
        repeat: -1,
      });

      // Walk Left: frames 12-15
      this.anims.create({
        key: `${role}-walk-left`,
        frames: this.anims.generateFrameNumbers(role, { start: 12, end: 15 }),
        frameRate: 8,
        repeat: -1,
      });

      // Idle: frames 16-17
      this.anims.create({
        key: `${role}-idle`,
        frames: this.anims.generateFrameNumbers(role, { start: 16, end: 17 }),
        frameRate: 4,
        repeat: -1,
      });

      // Shoot: frames 18-19
      this.anims.create({
        key: `${role}-shoot`,
        frames: this.anims.generateFrameNumbers(role, { start: 18, end: 19 }),
        frameRate: 10,
        repeat: 0,
      });

      // Death: frames 20-25
      this.anims.create({
        key: `${role}-death`,
        frames: this.anims.generateFrameNumbers(role, { start: 20, end: 25 }),
        frameRate: 10,
        repeat: 0,
      });
    }

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
      'Loading...',
      { fontSize: '16px', color: '#aaaaaa', fontFamily: 'Arial' }
    ).setOrigin(0.5);

    // Transition to LobbyScene after brief delay
    this.time.delayedCall(500, () => {
      this.scene.start('LobbyScene');
    });
  }
}

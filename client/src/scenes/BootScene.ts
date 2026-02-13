import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { Colors, TextStyle, Decorative } from '../ui/designTokens';

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

    // Splash/background images
    this.load.image('splash-bg', 'images/splash-bg.png');
    this.load.image('city-bg', 'images/city.png');
    this.load.image('victory-guardian', 'images/victory-guardian-splash.png');
    this.load.image('victory-paran', 'images/victory-paran-splash.png');

    // Note: Tileset images are loaded per-map in GameScene after receiving mapName from server
  }

  create() {
    // Initialize AudioManager and generate all SFX from jsfxr
    // Audio context will be unlocked by user click on "Click to Start" below
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

    // --- Solarpunk Title Screen ---

    // Splash background image (hedge maze with golden temple)
    const splashBg = this.add.image(400, 300, 'splash-bg');
    splashBg.setDisplaySize(800, 600);

    // Dark overlay so text is readable
    this.add.rectangle(400, 300, 800, 600, Colors.bg.deepNum, 0.55);

    // Decorative golden sparkles
    const sparkleGfx = this.add.graphics();
    sparkleGfx.fillStyle(Decorative.solarDots.color, Decorative.solarDots.alphaMax);
    for (let i = 0; i < 30; i++) {
      const sx = Phaser.Math.Between(40, 760);
      const sy = Phaser.Math.Between(40, 560);
      const sr = Phaser.Math.FloatBetween(Decorative.solarDots.radiusMin, Decorative.solarDots.radiusMax);
      sparkleGfx.fillCircle(sx, sy, sr);
    }

    // Vine-like decorative lines
    const vineGfx = this.add.graphics();
    vineGfx.lineStyle(Decorative.vine.thickness, Decorative.vine.color, Decorative.vine.alpha);
    // Left vine
    vineGfx.beginPath();
    vineGfx.moveTo(50, 100);
    vineGfx.lineTo(60, 200);
    vineGfx.lineTo(45, 300);
    vineGfx.lineTo(65, 400);
    vineGfx.lineTo(50, 500);
    vineGfx.strokePath();
    // Right vine
    vineGfx.beginPath();
    vineGfx.moveTo(750, 100);
    vineGfx.lineTo(740, 200);
    vineGfx.lineTo(755, 300);
    vineGfx.lineTo(735, 400);
    vineGfx.lineTo(750, 500);
    vineGfx.strokePath();

    // BANGER title -- large, golden, with green stroke
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 60,
      'BANGER',
      {
        ...TextStyle.hero,
        fontFamily: 'monospace',
      }
    ).setOrigin(0.5);

    // Subtitle
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Asymmetric Arena Combat',
      {
        fontSize: '18px',
        color: Colors.text.primary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5);

    // Click to Start text (ensures audio context unlock via user interaction)
    const clickText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 80,
      'Click to Start',
      {
        fontSize: '22px',
        color: Colors.accent.vine,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      }
    ).setOrigin(0.5);

    // Pulsing alpha animation on click text
    this.tweens.add({
      targets: clickText,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Wait for user click to transition (unlocks audio context)
    this.input.once('pointerdown', () => {
      this.scene.start('LobbyScene');
    });
  }
}

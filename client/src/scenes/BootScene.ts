import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { Colors, TextStyle, Decorative } from '../ui/designTokens';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Character spritesheets (64x64 frames, 36 frames each in horizontal strip)
    this.load.spritesheet('paran', 'sprites/paran.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('faran', 'sprites/faran.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('baran', 'sprites/baran.png', { frameWidth: 64, frameHeight: 64 });

    // Projectile spritesheet (16x16 frames, 3 frames: paran=0, faran=1, baran=2)
    this.load.spritesheet('projectiles', 'sprites/projectiles.png', { frameWidth: 16, frameHeight: 16 });

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

    // Create character animations for all 3 roles (36-frame layout per character)
    const roles = ['paran', 'faran', 'baran'];
    for (const role of roles) {
      // Walk Down: frames 0-5 (6 frames)
      this.anims.create({
        key: `${role}-walk-down`,
        frames: this.anims.generateFrameNumbers(role, { start: 0, end: 5 }),
        frameRate: 10,
        repeat: -1,
      });

      // Walk Up: frames 6-11 (6 frames)
      this.anims.create({
        key: `${role}-walk-up`,
        frames: this.anims.generateFrameNumbers(role, { start: 6, end: 11 }),
        frameRate: 10,
        repeat: -1,
      });

      // Walk Right: frames 12-17 (6 frames)
      this.anims.create({
        key: `${role}-walk-right`,
        frames: this.anims.generateFrameNumbers(role, { start: 12, end: 17 }),
        frameRate: 10,
        repeat: -1,
      });

      // Walk Left: frames 18-23 (6 frames)
      this.anims.create({
        key: `${role}-walk-left`,
        frames: this.anims.generateFrameNumbers(role, { start: 18, end: 23 }),
        frameRate: 10,
        repeat: -1,
      });

      // Idle: frames 24-26 (3 frames, slow breathing cycle)
      this.anims.create({
        key: `${role}-idle`,
        frames: this.anims.generateFrameNumbers(role, { start: 24, end: 26 }),
        frameRate: 3,
        repeat: -1,
      });

      // Shoot: frames 27-29 (3 frames)
      this.anims.create({
        key: `${role}-shoot`,
        frames: this.anims.generateFrameNumbers(role, { start: 27, end: 29 }),
        frameRate: 10,
        repeat: 0,
      });

      // Death: frames 30-35 (6 frames)
      this.anims.create({
        key: `${role}-death`,
        frames: this.anims.generateFrameNumbers(role, { start: 30, end: 35 }),
        frameRate: 10,
        repeat: 0,
      });
    }

    // --- Solarpunk Title Screen ---

    // Splash background image (hedge maze with golden temple)
    const splashBg = this.add.image(640, 360, 'splash-bg');
    splashBg.setDisplaySize(1280, 720);

    // Dark overlay so text is readable
    this.add.rectangle(640, 360, 1280, 720, Colors.bg.deepNum, 0.55);

    // Decorative golden sparkles
    const sparkleGfx = this.add.graphics();
    sparkleGfx.fillStyle(Decorative.solarDots.color, Decorative.solarDots.alphaMax);
    for (let i = 0; i < 30; i++) {
      const sx = Phaser.Math.Between(60, 1220);
      const sy = Phaser.Math.Between(50, 670);
      const sr = Phaser.Math.FloatBetween(Decorative.solarDots.radiusMin, Decorative.solarDots.radiusMax);
      sparkleGfx.fillCircle(sx, sy, sr);
    }

    // Vine-like decorative lines
    const vineGfx = this.add.graphics();
    vineGfx.lineStyle(Decorative.vine.thickness, Decorative.vine.color, Decorative.vine.alpha);
    // Left vine
    vineGfx.beginPath();
    vineGfx.moveTo(80, 120);
    vineGfx.lineTo(96, 240);
    vineGfx.lineTo(72, 360);
    vineGfx.lineTo(104, 480);
    vineGfx.lineTo(80, 600);
    vineGfx.strokePath();
    // Right vine
    vineGfx.beginPath();
    vineGfx.moveTo(1200, 120);
    vineGfx.lineTo(1184, 240);
    vineGfx.lineTo(1208, 360);
    vineGfx.lineTo(1176, 480);
    vineGfx.lineTo(1200, 600);
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

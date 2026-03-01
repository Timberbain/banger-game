import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { Colors, TextStyle, Type, Decorative } from '../ui/designTokens';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Paran spritesheet (32x32 frames, 4x3 grid, hand-drawn pac-man)
    this.load.spritesheet('paran', 'sprites/paran.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('faran', 'sprites/faran.png', {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet('baran', 'sprites/baran.png', {
      frameWidth: 64,
      frameHeight: 64,
    });

    // Projectile spritesheet (16x16 frames, 3 frames: paran=0, faran=1, baran=2)
    this.load.spritesheet('projectiles', 'sprites/projectiles.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // Particle texture for runtime tinting
    this.load.image('particle', 'sprites/particle.png');

    // Splash/background images
    this.load.image('splash-bg', 'images/splash-bg.png');
    this.load.image('city-bg', 'images/city.png');
    this.load.image('victory-guardian', 'images/victory-guardian-splash.png');
    this.load.image('victory-paran', 'images/victory-paran-splash.png');

    // Character portraits (200x200 pixel art for character select panels)
    this.load.image('portrait-paran', 'images/paran.png');
    this.load.image('portrait-faran', 'images/faran.png');
    this.load.image('portrait-baran', 'images/baran.png');

    // Powerup potion sprites (16x16 pixel art icons)
    // Color mapping: Red=Speed, Blue=Invincibility, Green=Projectile
    this.load.image('potion_speed', 'icons/potion-red.png');
    this.load.image('potion_invincibility', 'icons/potion-blue.png');
    this.load.image('potion_projectile', 'icons/potion-green.png');

    // HUD icon assets (32x32 PNGs)
    this.load.image('icon_heart_full', 'icons/heart-full.png');
    this.load.image('icon_heart_empty', 'icons/heart-empty.png');
    this.load.image('icon_timer', 'icons/timer.png');
    this.load.image('icon_skull', 'icons/skull.png');
    this.load.image('icon_gravestone', 'icons/gravestone.png');
    this.load.image('potion_green', 'icons/potion-green.png');

    // Preload unified tileset (tilemaps loaded dynamically in GameScene for fresh data)
    this.load.image('tileset_unified', 'tilesets/arena_unified.png');
  }

  create() {
    // Initialize AudioManager and generate all SFX from jsfxr
    // Audio context will be unlocked by user click on "Click to Start" below
    const audioManager = new AudioManager();
    audioManager.init();
    audioManager.registerWAV('powerup_pickup', 'soundeffects/powerup_1.wav');

    // Hurt variants (player damage + Paran wall collision)
    audioManager.registerWAV('hurt_1', 'soundeffects/hurt_1.wav');
    audioManager.registerWAV('hurt_2', 'soundeffects/hurt_2.wav');
    audioManager.registerWAV('hurt_3', 'soundeffects/hurt_3.wav');
    audioManager.registerWAV('hurt_4', 'soundeffects/hurt_4.wav');

    // Guardian fire variants
    audioManager.registerWAV('laser_1', 'soundeffects/laser_1.wav');
    audioManager.registerWAV('laser_4', 'soundeffects/laser_4.wav');
    audioManager.registerWAV('laser_5', 'soundeffects/laser_5.wav');

    // Paran power shot (weapon powerup)
    audioManager.registerWAV('earthquake', 'soundeffects/earthquake.wav');
    audioManager.registerWAV('lightning', 'soundeffects/lightning.wav');

    // Player killed
    audioManager.registerWAV('disappear', 'soundeffects/disappear.wav');

    // Menu navigation
    audioManager.registerWAV('select_1', 'soundeffects/select_1.wav');
    audioManager.registerWAV('select_2', 'soundeffects/select_2.wav');

    // Defeat sting
    audioManager.registerWAV('lose_1', 'soundeffects/lose_1.wav');

    // Firework SFX (victory screen)
    audioManager.registerWAV('fire_1', 'soundeffects/fire_1.wav');
    audioManager.registerWAV('fire_2', 'soundeffects/fire_2.wav');
    audioManager.registerWAV('fire_3', 'soundeffects/fire_3.wav');

    this.registry.set('audioManager', audioManager);

    // Paran animations (32x32 grid spritesheet, direction via sprite transform)
    this.anims.create({
      key: 'paran-walk',
      frames: [
        { key: 'paran', frame: 0 },
        { key: 'paran', frame: 1 },
        { key: 'paran', frame: 2 },
        { key: 'paran', frame: 3 },
        { key: 'paran', frame: 2 },
        { key: 'paran', frame: 1 },
      ],
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'paran-idle',
      frames: [
        { key: 'paran', frame: 0 },
        { key: 'paran', frame: 3 },
      ],
      frameRate: 3,
      repeat: -1,
    });
    this.anims.create({
      key: 'paran-shoot',
      frames: [
        { key: 'paran', frame: 5 },
        { key: 'paran', frame: 9 },
        { key: 'paran', frame: 5 },
      ],
      frameRate: 3,
      repeat: 0,
    });
    this.anims.create({
      key: 'paran-death',
      frames: [
        { key: 'paran', frame: 5 },
        { key: 'paran', frame: 6 },
        { key: 'paran', frame: 7 },
        { key: 'paran', frame: 8 },
        { key: 'paran', frame: 9 },
        { key: 'paran', frame: 10 },
      ],
      frameRate: 8,
      repeat: 0,
    });

    // Guardian animations (64x64 horizontal strip, 36 frames each)
    const guardianRoles = ['faran', 'baran'];
    for (const role of guardianRoles) {
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
    this.add.rectangle(640, 360, 1280, 720, Colors.bg.deepNum, Colors.bg.overlayAlpha);

    // Decorative golden sparkles
    // const sparkleGfx = this.add.graphics();
    // sparkleGfx.fillStyle(Decorative.solarDots.color, Decorative.solarDots.alphaMax);
    // for (let i = 0; i < 30; i++) {
    //   const sx = Phaser.Math.Between(60, 1220);
    //   const sy = Phaser.Math.Between(50, 670);
    //   const sr = Phaser.Math.FloatBetween(Decorative.solarDots.radiusMin, Decorative.solarDots.radiusMax);
    //   sparkleGfx.fillCircle(sx, sy, sr);
    // }

    // Vine-like decorative lines
    // const vineGfx = this.add.graphics();
    // vineGfx.lineStyle(
    //   Decorative.vine.thickness,
    //   Decorative.vine.color,
    //   Decorative.vine.alpha,
    // );
    // // Left vine
    // vineGfx.beginPath();
    // vineGfx.moveTo(80, 120);
    // vineGfx.lineTo(96, 240);
    // vineGfx.lineTo(72, 360);
    // vineGfx.lineTo(104, 480);
    // vineGfx.lineTo(80, 600);
    // vineGfx.strokePath();
    // // Right vine
    // vineGfx.beginPath();
    // vineGfx.moveTo(1200, 120);
    // vineGfx.lineTo(1184, 240);
    // vineGfx.lineTo(1208, 360);
    // vineGfx.lineTo(1176, 480);
    // vineGfx.lineTo(1200, 600);
    // vineGfx.strokePath();

    // BANGER title -- large, golden, with green stroke
    this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY - 60, 'BANGER', {
        ...TextStyle.hero,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY, 'Unfair by Design', {
        fontSize: '18px',
        color: Colors.text.primary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Click to Start text (ensures audio context unlock via user interaction)
    const clickText = this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY + 80, 'Click to Start', {
        fontSize: '22px',
        color: Colors.accent.vine,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // Pulsing alpha animation on click text
    this.tweens.add({
      targets: clickText,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Copyright label (brass nameplate)
    this.add
      .text(this.cameras.main.centerX, 705, '\u00A9 2026 Timberbain', {
        ...Type.small,
        color: Colors.gold.dark,
      })
      .setOrigin(0.5);

    // Wait for user click to transition (unlocks audio context)
    this.input.once('pointerdown', () => {
      this.scene.start('LobbyScene');
    });
  }
}

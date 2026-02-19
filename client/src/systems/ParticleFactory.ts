import Phaser from 'phaser';

/**
 * Centralized particle effect presets for all game events.
 * All effects use the 'particle' texture (8x8 white circle) tinted at runtime.
 *
 * Uses Phaser 3.60+ particle API: scene.add.particles(x, y, 'particle', config)
 * with emitting: false + explode() for one-shot bursts.
 */
export class ParticleFactory {
  private scene: Phaser.Scene;
  private activeTrails: Set<Phaser.GameObjects.Particles.ParticleEmitter> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Damage impact burst at hit location.
   * 8 particles, speed 50-150, lifespan 300ms, scale 1->0, gravity 100.
   */
  hitBurst(x: number, y: number, tint: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 150 },
      lifespan: 300,
      scale: { start: 1, end: 0 },
      gravityY: 100,
      tint: tint,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(8);
    this.scene.time.delayedCall(500, () => {
      emitter.destroy();
    });
  }

  /**
   * Player death explosion in player's color.
   * 20 particles, speed 80-250, lifespan 600ms, scale 1.5->0, gravity 200, full 360 angle.
   */
  deathExplosion(x: number, y: number, playerColor: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 80, max: 250 },
      lifespan: 600,
      scale: { start: 1.5, end: 0 },
      gravityY: 200,
      angle: { min: 0, max: 360 },
      tint: playerColor,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(20);
    this.scene.time.delayedCall(800, () => {
      emitter.destroy();
    });
  }

  /**
   * Paran wall collision dust particles.
   * 6 particles, gray dust, speed 30-80, lifespan 200ms, scale 0.5->0.
   */
  wallImpact(x: number, y: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 30, max: 80 },
      lifespan: 200,
      scale: { start: 0.5, end: 0 },
      tint: 0x888888,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(6);
    this.scene.time.delayedCall(400, () => {
      emitter.destroy();
    });
  }

  /**
   * Projectile hitting a wall -- small spark/dust.
   * 4 particles, speed 30-60, lifespan 150ms, scale 0.3->0.
   */
  projectileImpact(x: number, y: number, tint: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 30, max: 60 },
      lifespan: 150,
      scale: { start: 0.3, end: 0 },
      tint: tint,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(4);
    this.scene.time.delayedCall(300, () => {
      emitter.destroy();
    });
  }

  /**
   * Projectile trail -- continuous emitter that follows a target sprite.
   * Returns the emitter; caller must destroy when projectile is removed.
   * Tint should be set by caller via the returned emitter config.
   */
  createTrail(
    followTarget: Phaser.GameObjects.Sprite,
    tint: number,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, 'particle', {
      frequency: 30,
      lifespan: 200,
      speed: 0,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: tint,
      follow: followTarget,
      emitting: true,
    });
    emitter.setDepth(4); // Below projectile sprite (depth 5)
    this.activeTrails.add(emitter);
    return emitter;
  }

  /**
   * Remove a trail emitter from tracking and destroy it.
   */
  destroyTrail(emitter: Phaser.GameObjects.Particles.ParticleEmitter): void {
    this.activeTrails.delete(emitter);
    emitter.destroy();
  }

  /**
   * Paran high speed effect -- speed lines behind the player.
   * 5 gold particles emitted opposite to direction of movement.
   * Called per-frame when velocity exceeds threshold (rate-limited by caller).
   */
  speedLines(x: number, y: number, angle: number): void {
    // Emit particles in opposite direction of movement
    const oppositeAngleDeg = Phaser.Math.RadToDeg(angle) + 180;
    const emitter = this.scene.add.particles(x, y, 'particle', {
      angle: { min: oppositeAngleDeg - 20, max: oppositeAngleDeg + 20 },
      speed: { min: 120, max: 250 },
      lifespan: 250,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: 0xffd700, // Paran gold
      emitting: false,
    });
    emitter.setDepth(9); // Below player sprites
    emitter.explode(5);
    this.scene.time.delayedCall(300, () => {
      emitter.destroy();
    });
  }

  /**
   * Victory celebration burst.
   * 30 particles, speed 100-300, lifespan 1000ms, scale 2->0, full angle, gravity 150.
   */
  victoryBurst(x: number, y: number, color: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 300 },
      lifespan: 1000,
      scale: { start: 2, end: 0 },
      angle: { min: 0, max: 360 },
      gravityY: 150,
      tint: color,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(30);
    this.scene.time.delayedCall(1200, () => {
      emitter.destroy();
    });
  }

  /**
   * Speed buff aura -- red particles matching speed potion color.
   * Returns the emitter; caller must destroy when buff expires.
   */
  speedAura(followTarget: Phaser.GameObjects.Sprite): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, 'particle', {
      frequency: 25,
      lifespan: 600,
      speed: { min: 30, max: 80 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: 0xcc3333,
      angle: { min: 0, max: 360 },
      follow: followTarget,
      emitting: true,
    });
    emitter.setDepth(9);
    this.activeTrails.add(emitter);
    return emitter;
  }

  /**
   * Invincibility buff aura -- blue particles matching invincibility potion color.
   * Returns the emitter; caller must destroy when buff expires.
   */
  invincibilityAura(
    followTarget: Phaser.GameObjects.Sprite,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, 'particle', {
      frequency: 20,
      lifespan: 700,
      speed: { min: 30, max: 60 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: 0x4488ff,
      angle: { min: 0, max: 360 },
      follow: followTarget,
      emitting: true,
    });
    emitter.setDepth(9);
    this.activeTrails.add(emitter);
    return emitter;
  }

  /**
   * Projectile buff aura -- green particles matching projectile potion color.
   * Returns the emitter; caller must destroy when buff expires.
   */
  projectileAura(
    followTarget: Phaser.GameObjects.Sprite,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, 'particle', {
      frequency: 20,
      lifespan: 600,
      speed: { min: 25, max: 60 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: 0x44cc66,
      gravityY: 30,
      angle: { min: 0, max: 360 },
      follow: followTarget,
      emitting: true,
    });
    emitter.setDepth(9);
    this.activeTrails.add(emitter);
    return emitter;
  }

  /**
   * Idle particle aura for ground powerup sprites.
   * Gentle radial glow that makes pickups visible on the arena floor.
   * Returns the emitter; caller must destroy via destroyTrail() when powerup is collected/despawned.
   */
  createPowerupIdleAura(
    followTarget: Phaser.GameObjects.Sprite,
    tint: number,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, 'particle', {
      frequency: 80,
      lifespan: 800,
      speed: { min: 5, max: 20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.5, end: 0 },
      tint: tint,
      angle: { min: 0, max: 360 },
      follow: followTarget,
      emitting: true,
    });
    emitter.setDepth(7); // Below the powerup sprite at 8
    this.activeTrails.add(emitter);
    return emitter;
  }

  /**
   * Clean up all active trail emitters.
   */
  destroy(): void {
    for (const trail of this.activeTrails) {
      trail.destroy();
    }
    this.activeTrails.clear();
  }
}

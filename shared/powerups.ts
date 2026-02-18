/**
 * Powerup type definitions, constants, and buff configurations
 * Shared between server and client for consistent powerup handling
 */

export enum PowerupType {
  SPEED = 0,
  INVINCIBILITY = 1,
  PROJECTILE = 2,
}

/** Display names for each powerup type */
export const POWERUP_NAMES: Record<number, string> = {
  [PowerupType.SPEED]: 'Speed Boost',
  [PowerupType.INVINCIBILITY]: 'Invincibility',
  [PowerupType.PROJECTILE]: 'Power Shot',
};

/** All powerup system constants */
export const POWERUP_CONFIG = {
  /** Maximum powerups on the map at once */
  maxOnMap: 2,
  /** Minimum spawn interval (ms) */
  spawnIntervalMin: 8000,
  /** Maximum spawn interval (ms) */
  spawnIntervalMax: 12000,
  /** Delay before first spawn in a stage (ms) */
  firstSpawnDelay: 12000,
  /** Time before uncollected powerup despawns (ms) */
  despawnTime: 15000,
  /** Time before despawn to start blinking warning (ms) */
  despawnWarningTime: 4000,
  /** Collection radius (slightly larger than playerRadius for generous pickup) */
  collectionRadius: 14,
  /** Minimum distance from alive players for spawn (~5 tiles) */
  minSpawnDistance: 160,

  // Buff durations
  /** Speed buff duration (ms) */
  speedDuration: 22500,
  /** Invincibility buff duration (ms) */
  invincibilityDuration: 12500,
  /** Projectile buff duration (ms) */
  projectileDuration: 27500,

  // Buff multipliers
  /** Speed multiplier during speed buff (+50%) */
  speedMultiplier: 1.5,
  /** Guardian projectile hitbox scale during projectile buff */
  guardianHitboxScale: 2,
  /** Guardian projectile speed scale during projectile buff */
  guardianSpeedScale: 2,
  /** Paran beam hitbox scale during projectile buff */
  paranBeamHitboxScale: 5,
  /** Paran beam cooldown multiplier (2x longer cooldown) */
  paranBeamCooldownMultiplier: 2,
} as const;

/** Maps PowerupType to buff duration for cleaner lookup */
export const BUFF_DURATIONS: Record<number, number> = {
  [PowerupType.SPEED]: POWERUP_CONFIG.speedDuration,
  [PowerupType.INVINCIBILITY]: POWERUP_CONFIG.invincibilityDuration,
  [PowerupType.PROJECTILE]: POWERUP_CONFIG.projectileDuration,
};

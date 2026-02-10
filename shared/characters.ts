/**
 * Character archetypes and combat constants
 * Defines stats for faran, baran (guardians), and paran (force)
 */

export interface CharacterStats {
  maxHealth: number;
  acceleration: number;
  maxVelocity: number;
  drag: number;
  damage: number;
  fireRate: number; // ms between shots
  projectileSpeed: number;
}

export const CHARACTERS: Record<string, CharacterStats> = {
  faran: {
    maxHealth: 50,
    acceleration: 800,
    maxVelocity: 220,
    drag: 0.88,
    damage: 10,
    fireRate: 200, // 5 shots/sec
    projectileSpeed: 300,
  },
  baran: {
    maxHealth: 50,
    acceleration: 800,
    maxVelocity: 220,
    drag: 0.88,
    damage: 10,
    fireRate: 200, // 5 shots/sec
    projectileSpeed: 300,
  },
  paran: {
    maxHealth: 150,
    acceleration: 300,
    maxVelocity: 300,
    drag: 0.95,
    damage: 40,
    fireRate: 1000, // 1 shot/sec
    projectileSpeed: 400,
  },
};

export const COMBAT = {
  playerRadius: 12,
  projectileRadius: 4,
  projectileLifetime: 2000, // ms
};

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
    acceleration: 3000,
    maxVelocity: 110,
    drag: 0,
    damage: 10,
    fireRate: 200, // 5 shots/sec
    projectileSpeed: 400,
  },
  baran: {
    maxHealth: 50,
    acceleration: 3000,
    maxVelocity: 110,
    drag: 0,
    damage: 10,
    fireRate: 200, // 5 shots/sec
    projectileSpeed: 400,
  },
  paran: {
    maxHealth: 150,
    acceleration: 20,
    maxVelocity: 400,
    drag: 0.95,
    damage: 40,
    fireRate: 1000, // 1 shot/sec
    projectileSpeed: 400,
  },
};

/** Display metadata for character selection panels */
export const CHARACTER_DISPLAY: Record<string, { tagline: string; ability: string; risk: string }> =
  {
    paran: {
      tagline: 'solo predator',
      ability: 'Contact kill',
      risk: 'precision + timing',
    },
    faran: {
      tagline: 'sharpshooter',
      ability: 'Rapid fire',
      risk: '+ teamwork',
    },
    baran: {
      tagline: 'heavy hitter',
      ability: 'Rapid fire',
      risk: '+ teamwork',
    },
  };

export const COMBAT = {
  playerRadius: 12,
  projectileRadius: 4,
  projectileLifetime: 2000, // ms
};

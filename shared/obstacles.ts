/**
 * Obstacle tile ID constants and tier HP mappings
 * Shared between server and client for consistent obstacle handling
 */

/** Tile IDs used in Tiled map JSON wall layer data */
export const OBSTACLE_TILES = {
  WALL: 5,    // Indestructible wall (row 1, col 0 in composite tileset)
  HEAVY: 6,   // Heavy destructible obstacle, 5 HP (row 1, col 1)
  MEDIUM: 7,  // Medium destructible obstacle, 3 HP (row 1, col 2)
  LIGHT: 8,   // Light destructible obstacle, 2 HP (row 1, col 3)
} as const;

/** Maps destructible tile IDs to their starting HP values */
export const OBSTACLE_TIER_HP: Record<number, number> = {
  [OBSTACLE_TILES.HEAVY]: 5,
  [OBSTACLE_TILES.MEDIUM]: 3,
  [OBSTACLE_TILES.LIGHT]: 2,
};

/** Sets for fast tile classification lookups */
export const OBSTACLE_TILE_IDS = {
  indestructible: new Set<number>([OBSTACLE_TILES.WALL]),
  destructible: new Set<number>([OBSTACLE_TILES.HEAVY, OBSTACLE_TILES.MEDIUM, OBSTACLE_TILES.LIGHT]),
};

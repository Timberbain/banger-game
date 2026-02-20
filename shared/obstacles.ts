/**
 * Obstacle tile ID constants and tier HP mappings
 * Delegates to tileRegistry for all tile classification.
 * Shared between server and client for consistent obstacle handling.
 */

import {
  TILE_RANGES,
  ROCK_TIER_MAP,
  getIndestructibleTileIds,
  getDestructibleTileIds,
} from './tileRegistry';

/** All rock canopy tile IDs (289-296) */
export const ROCK_IDS = Array.from(
  { length: TILE_RANGES.ROCK_CANOPY.max - TILE_RANGES.ROCK_CANOPY.min + 1 },
  (_, i) => TILE_RANGES.ROCK_CANOPY.min + i,
);

/** Maps destructible tile IDs to their starting HP values */
export const OBSTACLE_TIER_HP: Record<number, number> = {};
for (const [id, info] of Object.entries(ROCK_TIER_MAP)) {
  OBSTACLE_TIER_HP[Number(id)] = info.hp;
}

/** Sets for fast tile classification lookups (derived from registry) */
export const OBSTACLE_TILE_IDS = {
  get indestructible(): Set<number> {
    return getIndestructibleTileIds();
  },
  get destructible(): Set<number> {
    return getDestructibleTileIds();
  },
};

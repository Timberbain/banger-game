/**
 * TypeScript port of the Python auto-tile algorithm from generate-arenas.py.
 * Resolves wall sentinels (-1) into proper tileset sprite indices using 8-neighbor rules.
 * Supports themed wall offsets for the unified tileset.
 */

import { TILE_RANGES } from '../../../shared/tileRegistry';
import { isWallSentinel, sentinelToThemeOffset } from './EditorState';

export interface AutoTileRule {
  ruleId: number;
  spriteIndex: number;
  neighbors: Record<string, boolean>;
}

/** All rock canopy IDs (289-296) */
const OBSTACLE_IDS = new Set<number>();
for (let id = TILE_RANGES.ROCK_CANOPY.min; id <= TILE_RANGES.ROCK_CANOPY.max; id++) {
  OBSTACLE_IDS.add(id);
}

/** Check if a tile is solid (any wall sentinel or rock canopy) for neighbor checks */
export function isSolid(tileId: number): boolean {
  return tileId < 0 || OBSTACLE_IDS.has(tileId);
}

/** Cardinal and diagonal direction offsets [dx, dy] */
export const DIR_OFFSETS: Record<string, [number, number]> = {
  N: [0, -1],
  NE: [1, -1],
  E: [1, 0],
  SE: [1, 1],
  S: [0, 1],
  SW: [-1, 1],
  W: [-1, 0],
  NW: [-1, -1],
};

/** Get 8-neighbor solid state. Out-of-bounds = true (solid). */
export function getNeighborState(
  data: number[],
  w: number,
  h: number,
  x: number,
  y: number,
): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const [dir, [dx, dy]] of Object.entries(DIR_OFFSETS)) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
      state[dir] = true;
    } else {
      state[dir] = isSolid(data[ny * w + nx]);
    }
  }
  return state;
}

/**
 * Two-pass auto-tile resolution.
 * Pass 1: Compute all resolutions from original neighbor state.
 * Pass 2: Apply all at once (avoids order-dependent issues).
 * Processes all wall sentinel tiles (< 0). Derives theme offset per-cell from sentinel value.
 *
 * @param themeOffset - Fallback offset (ignored when sentinel provides per-cell theme)
 */
export function resolveAutoTile(
  data: number[],
  w: number,
  h: number,
  rules: AutoTileRule[],
  themeOffset = 0,
): number[] {
  const resolutions = new Map<number, number>();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const cellValue = data[idx];
      if (!isWallSentinel(cellValue)) continue;

      // Derive theme offset from the sentinel value itself
      const cellThemeOffset = sentinelToThemeOffset(cellValue);

      const neighbors = getNeighborState(data, w, h, x, y);
      let resolved = 1 + cellThemeOffset; // default: isolated_single (spriteIndex 0)

      for (const rule of rules) {
        let match = true;
        for (const [dir, expected] of Object.entries(rule.neighbors)) {
          if (neighbors[dir] !== expected) {
            match = false;
            break;
          }
        }
        if (match) {
          resolved = rule.spriteIndex + 1 + cellThemeOffset;
          break;
        }
      }

      resolutions.set(idx, resolved);
    }
  }

  const result = [...data];
  for (const [idx, tileId] of resolutions) {
    result[idx] = tileId;
  }
  return result;
}

/** Fetch auto-tile rules from the reference JSON */
export async function loadAutoTileRules(): Promise<AutoTileRule[]> {
  const resp = await fetch('/data/tileset_reference.json');
  if (!resp.ok) throw new Error(`Failed to load tileset_reference.json: ${resp.status}`);
  const json = await resp.json();
  return json.autoTileRules as AutoTileRule[];
}

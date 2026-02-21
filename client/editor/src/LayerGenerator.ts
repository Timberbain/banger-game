/**
 * Generates 3 Tiled-format layers from the logical editor grid.
 * Ground (terrain + deco), WallFronts (front faces), Walls (auto-tiled + obstacles).
 * Supports themed wall and floor tiles via the unified tileset.
 */

import { resolveAutoTile, type AutoTileRule } from './AutoTiler';
import {
  WALL_FRONT_OFFSET,
  getFloorIds,
  getDecoIds,
  isWallCanopy,
  type WallTheme,
} from '../../../shared/tileRegistry';

/** mulberry32 seeded PRNG -- returns floats in [0, 1) */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Copy grid and resolve wall sentinels to themed auto-tile IDs (per-cell theme from sentinel) */
export function generateWallsLayer(
  logicalGrid: number[],
  w: number,
  h: number,
  rules: AutoTileRule[],
): number[] {
  return resolveAutoTile([...logicalGrid], w, h, rules, 0);
}

/** Generate front faces: wall canopy at y -> front at y+1 if empty (rocks are full single-tile sprites, no fronts) */
export function generateWallFrontsLayer(wallsData: number[], w: number, h: number): number[] {
  const fronts = new Array<number>(w * h).fill(0);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tileId = wallsData[y * w + x];
      if (tileId === 0) continue;

      if (!isWallCanopy(tileId)) continue;

      if (y + 1 >= h) continue;
      const belowIdx = (y + 1) * w + x;
      if (wallsData[belowIdx] !== 0) continue;

      fronts[belowIdx] = tileId + WALL_FRONT_OFFSET;
    }
  }

  return fronts;
}

/** Weighted random ground with seeded RNG + overrides */
export function generateGroundLayer(
  w: number,
  h: number,
  seed: number,
  theme: WallTheme = 'hedge',
  overrides?: Map<number, number>,
): number[] {
  const rng = mulberry32(seed);
  const data = new Array<number>(w * h);
  const groundIds = getFloorIds(theme);
  const decoIds = getDecoIds(theme);

  for (let i = 0; i < data.length; i++) {
    const r = rng();
    if (r < 0.6) data[i] = groundIds[0];
    else if (r < 0.8) data[i] = groundIds[1];
    else if (r < 0.9) data[i] = groundIds[2];
    else if (r < 0.95) data[i] = groundIds[3];
    else data[i] = decoIds[Math.floor(rng() * decoIds.length)];
  }

  if (overrides) {
    for (const [idx, tileId] of overrides) {
      if (idx >= 0 && idx < data.length) data[idx] = tileId;
    }
  }

  return data;
}

/** Generate decorations layer from sparse overrides → flat array */
export function generateDecorationsLayer(
  w: number,
  h: number,
  decorationOverrides?: Map<number, number>,
): number[] {
  const data = new Array<number>(w * h).fill(0);
  if (decorationOverrides) {
    for (const [idx, tileId] of decorationOverrides) {
      if (idx >= 0 && idx < data.length) data[idx] = tileId;
    }
  }
  return data;
}

/** Generate all 4 layers. Ground terrain shows through transparent sprite parts. */
export function generateAllLayers(
  logicalGrid: number[],
  w: number,
  h: number,
  rules: AutoTileRule[],
  groundSeed: number,
  theme: WallTheme = 'hedge',
  groundOverrides?: Map<number, number>,
  decorationOverrides?: Map<number, number>,
): { ground: number[]; decorations: number[]; wallFronts: number[]; walls: number[] } {
  const walls = generateWallsLayer(logicalGrid, w, h, rules);
  const wallFronts = generateWallFrontsLayer(walls, w, h);
  const ground = generateGroundLayer(w, h, groundSeed, theme, groundOverrides);
  const decorations = generateDecorationsLayer(w, h, decorationOverrides);

  return { ground, decorations, wallFronts, walls };
}

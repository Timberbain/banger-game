/**
 * Central tile property registry - single source of truth for all tile behavior.
 * Replaces per-tileset collision JSON files with computed collision shapes.
 * Shared between server, client, and map editor.
 */

// ============================================================
// Tile ID Layout (unified tileset: 256px wide, 8 cols x 44 rows)
// ============================================================
//
// Rows  0-5:  Hedge canopy       IDs   1- 48
// Rows  6-11: Hedge front        IDs  49- 96
// Rows 12-17: Brick canopy       IDs  97-144
// Rows 18-23: Brick front        IDs 145-192
// Rows 24-29: Wood canopy        IDs 193-240
// Rows 30-35: Wood front         IDs 241-288
// Row  36:    Rock full sprites    IDs 289-296
// Row  37:    (empty/reserved)    IDs 297-304
// Row  38:    Hedge floor+deco    IDs 305-312
// Row  39:    Brick floor+deco    IDs 313-320
// Row  40:    Wood floor+deco     IDs 321-328
// Row  41:    Plain color+empty   IDs 329-336
// Rows 42-43: Extra floors        IDs 337-352

export type WallTheme = 'hedge' | 'brick' | 'wood';

export type TileCategory =
  | 'wall_canopy'
  | 'wall_front'
  | 'rock_canopy'
  | 'rock_front'
  | 'floor'
  | 'deco'
  | 'plain'
  | 'empty';

export interface CollisionShape {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileProperties {
  category: TileCategory;
  solid: boolean;
  destructible: boolean;
  hp: number;
  collisionShape: CollisionShape;
  theme?: WallTheme;
}

// ============================================================
// Constants
// ============================================================

export const WALL_THEME_OFFSET: Record<WallTheme, number> = {
  hedge: 0,
  brick: 96,
  wood: 192,
};

export const WALL_FRONT_OFFSET = 48;
export const ROCK_FRONT_OFFSET = 8;

export const TILES_PER_THEME = 48;
export const TILESET_COLUMNS = 8;
export const TILESET_ROWS = 44;
export const TOTAL_TILES = TILESET_COLUMNS * TILESET_ROWS; // 352

/** Tile ID ranges (all 1-based, matching Tiled firstgid=1) */
export const TILE_RANGES = {
  HEDGE_CANOPY: { min: 1, max: 48 },
  HEDGE_FRONT: { min: 49, max: 96 },
  BRICK_CANOPY: { min: 97, max: 144 },
  BRICK_FRONT: { min: 145, max: 192 },
  WOOD_CANOPY: { min: 193, max: 240 },
  WOOD_FRONT: { min: 241, max: 288 },
  ROCK_CANOPY: { min: 289, max: 296 },
  ROCK_FRONT: { min: 297, max: 304 },
  HEDGE_FLOOR: { min: 305, max: 308 },
  HEDGE_DECO: { min: 309, max: 312 },
  BRICK_FLOOR: { min: 313, max: 316 },
  BRICK_DECO: { min: 317, max: 320 },
  WOOD_FLOOR: { min: 321, max: 324 },
  WOOD_DECO: { min: 325, max: 328 },
  PLAIN_COLOR: { min: 329, max: 334 },
  EXTRA_FLOOR: { min: 337, max: 352 },
} as const;

/** Rock tile ID → obstacle tier HP mapping */
export const ROCK_TIER_MAP: Record<number, { tier: string; hp: number }> = {
  289: { tier: 'heavy', hp: 5 },
  290: { tier: 'heavy', hp: 5 },
  291: { tier: 'heavy', hp: 5 },
  292: { tier: 'medium', hp: 3 },
  293: { tier: 'medium', hp: 3 },
  294: { tier: 'medium', hp: 3 },
  295: { tier: 'light', hp: 2 },
  296: { tier: 'light', hp: 2 },
};

// ============================================================
// Collision shape definitions
// ============================================================

const FULL_TILE: CollisionShape = { x: 0, y: 0, w: 32, h: 32 };
const CANOPY_SHAPE: CollisionShape = { x: 0, y: 12, w: 32, h: 20 };

/**
 * Sprite indices (0-based within a 48-sprite theme block) that have their
 * top edge exposed (N=false in autotile rules). These get the shorter
 * canopy collision shape so entities can visually overlap the top portion.
 *
 * Derived from tileset_reference.json autotile rules where N is false.
 */
const CANOPY_SPRITE_INDICES = new Set([
  0, // isolated_single
  1, // end_cap_west
  2, // top_edge_se_inner
  3, // top_right_corner_sw_inner
  4, // top_left_corner_se_inner
  5, // top_edge_both_inners
  6, // top_edge_sw_inner
  7, // end_cap_east
  8, // top_left_corner
  9, // top_edge_no_inners
  15, // top_right_corner
  31, // end_cap_north
  41, // horizontal_straight
]);

function getWallCollisionShape(tileId: number, themeMin: number): CollisionShape {
  const spriteIndex = tileId - themeMin; // 0-based within theme
  return CANOPY_SPRITE_INDICES.has(spriteIndex) ? CANOPY_SHAPE : FULL_TILE;
}

// ============================================================
// Registry builder
// ============================================================

let cachedRegistry: Map<number, TileProperties> | null = null;

export function buildTileRegistry(): Map<number, TileProperties> {
  if (cachedRegistry) return cachedRegistry;

  const registry = new Map<number, TileProperties>();

  const themes: WallTheme[] = ['hedge', 'brick', 'wood'];

  for (const theme of themes) {
    const offset = WALL_THEME_OFFSET[theme];
    const canopyMin = 1 + offset;
    const canopyMax = 48 + offset;
    const frontMin = 49 + offset;
    const frontMax = 96 + offset;

    // Wall canopy tiles (solid, indestructible)
    for (let id = canopyMin; id <= canopyMax; id++) {
      registry.set(id, {
        category: 'wall_canopy',
        solid: true,
        destructible: false,
        hp: 0,
        collisionShape: getWallCollisionShape(id, canopyMin),
        theme,
      });
    }

    // Wall front face tiles (visual only, not solid)
    for (let id = frontMin; id <= frontMax; id++) {
      registry.set(id, {
        category: 'wall_front',
        solid: false,
        destructible: false,
        hp: 0,
        collisionShape: FULL_TILE,
        theme,
      });
    }
  }

  // Rock tiles (solid, destructible, full 32x32 sprites)
  for (let id = TILE_RANGES.ROCK_CANOPY.min; id <= TILE_RANGES.ROCK_CANOPY.max; id++) {
    const rockInfo = ROCK_TIER_MAP[id];
    registry.set(id, {
      category: 'rock_canopy',
      solid: true,
      destructible: true,
      hp: rockInfo?.hp ?? 3,
      collisionShape: FULL_TILE,
    });
  }

  // Rock front tiles (visual only)
  for (let id = TILE_RANGES.ROCK_FRONT.min; id <= TILE_RANGES.ROCK_FRONT.max; id++) {
    registry.set(id, {
      category: 'rock_front',
      solid: false,
      destructible: false,
      hp: 0,
      collisionShape: FULL_TILE,
    });
  }

  // Floor tiles per theme
  const floorRanges: {
    theme: WallTheme;
    floor: { min: number; max: number };
    deco: { min: number; max: number };
  }[] = [
    { theme: 'hedge', floor: TILE_RANGES.HEDGE_FLOOR, deco: TILE_RANGES.HEDGE_DECO },
    { theme: 'brick', floor: TILE_RANGES.BRICK_FLOOR, deco: TILE_RANGES.BRICK_DECO },
    { theme: 'wood', floor: TILE_RANGES.WOOD_FLOOR, deco: TILE_RANGES.WOOD_DECO },
  ];

  for (const { theme, floor, deco } of floorRanges) {
    for (let id = floor.min; id <= floor.max; id++) {
      registry.set(id, {
        category: 'floor',
        solid: false,
        destructible: false,
        hp: 0,
        collisionShape: FULL_TILE,
        theme,
      });
    }
    for (let id = deco.min; id <= deco.max; id++) {
      registry.set(id, {
        category: 'deco',
        solid: false,
        destructible: false,
        hp: 0,
        collisionShape: FULL_TILE,
        theme,
      });
    }
  }

  // Plain color tiles
  for (let id = TILE_RANGES.PLAIN_COLOR.min; id <= TILE_RANGES.PLAIN_COLOR.max; id++) {
    registry.set(id, {
      category: 'plain',
      solid: false,
      destructible: false,
      hp: 0,
      collisionShape: FULL_TILE,
    });
  }

  // Extra floor tiles
  for (let id = TILE_RANGES.EXTRA_FLOOR.min; id <= TILE_RANGES.EXTRA_FLOOR.max; id++) {
    registry.set(id, {
      category: 'floor',
      solid: false,
      destructible: false,
      hp: 0,
      collisionShape: FULL_TILE,
    });
  }

  cachedRegistry = registry;
  return registry;
}

// ============================================================
// Helper functions
// ============================================================

export function isTileSolid(tileId: number): boolean {
  const props = buildTileRegistry().get(tileId);
  return props?.solid ?? false;
}

export function isTileDestructible(tileId: number): boolean {
  const props = buildTileRegistry().get(tileId);
  return props?.destructible ?? false;
}

export function getTileHP(tileId: number): number {
  const props = buildTileRegistry().get(tileId);
  return props?.hp ?? 0;
}

export function getTileCollisionShape(tileId: number): CollisionShape {
  const props = buildTileRegistry().get(tileId);
  return props?.collisionShape ?? FULL_TILE;
}

/** Get collision shapes as a Record<string, CollisionShape> keyed by tile ID string.
 *  This is the format expected by CollisionGrid constructor. */
export function getCollisionShapes(): Record<string, CollisionShape> {
  const registry = buildTileRegistry();
  const shapes: Record<string, CollisionShape> = {};
  registry.forEach((props, id) => {
    if (props.solid) {
      shapes[String(id)] = props.collisionShape;
    }
  });
  return shapes;
}

let cachedIndestructible: Set<number> | null = null;
let cachedDestructible: Set<number> | null = null;

/** Get all indestructible tile IDs as a Set (cached after first call) */
export function getIndestructibleTileIds(): Set<number> {
  if (cachedIndestructible) return cachedIndestructible;
  const registry = buildTileRegistry();
  const ids = new Set<number>();
  registry.forEach((props, id) => {
    if (props.solid && !props.destructible) {
      ids.add(id);
    }
  });
  cachedIndestructible = ids;
  return ids;
}

/** Get all destructible tile IDs as a Set (cached after first call) */
export function getDestructibleTileIds(): Set<number> {
  if (cachedDestructible) return cachedDestructible;
  const registry = buildTileRegistry();
  const ids = new Set<number>();
  registry.forEach((props, id) => {
    if (props.destructible) {
      ids.add(id);
    }
  });
  cachedDestructible = ids;
  return ids;
}

// ============================================================
// Theme helpers
// ============================================================

/** Get the canopy tile ID for a wall at a given sprite index (0-47) in a theme */
export function themedCanopyId(spriteIndex: number, theme: WallTheme): number {
  return spriteIndex + 1 + WALL_THEME_OFFSET[theme];
}

/** Get floor tile IDs for a given theme */
export function getFloorIds(theme: WallTheme): number[] {
  switch (theme) {
    case 'hedge':
      return [305, 306, 307, 308];
    case 'brick':
      return [313, 314, 315, 316];
    case 'wood':
      return [321, 322, 323, 324];
  }
}

/** Get decoration tile IDs for a given theme */
export function getDecoIds(theme: WallTheme): number[] {
  switch (theme) {
    case 'hedge':
      return [309, 310, 311, 312];
    case 'brick':
      return [317, 318, 319, 320];
    case 'wood':
      return [325, 326, 327, 328];
  }
}

/** Detect wall theme from a canopy tile ID */
export function detectThemeFromTileId(tileId: number): WallTheme | null {
  if (tileId >= 1 && tileId <= 48) return 'hedge';
  if (tileId >= 97 && tileId <= 144) return 'brick';
  if (tileId >= 193 && tileId <= 240) return 'wood';
  return null;
}

/** Check if a tile ID is a wall canopy (any theme) */
export function isWallCanopy(tileId: number): boolean {
  return (
    (tileId >= 1 && tileId <= 48) ||
    (tileId >= 97 && tileId <= 144) ||
    (tileId >= 193 && tileId <= 240)
  );
}

/** Check if a tile ID is a rock canopy */
export function isRockCanopy(tileId: number): boolean {
  return tileId >= 289 && tileId <= 296;
}

/** Check if tile ID is any solid canopy (wall or rock) */
export function isSolidCanopy(tileId: number): boolean {
  return isWallCanopy(tileId) || isRockCanopy(tileId);
}

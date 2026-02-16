/**
 * Shared collision grid and AABB-vs-tile collision resolution
 * Pure TypeScript -- no Phaser or server dependencies
 * Used by both server (authoritative) and client (prediction)
 */

/** Small offset to prevent exact tile-boundary positions from mapping back into solid tiles via Math.floor */
const COLLISION_EPSILON = 0.001;

/** Sub-tile collision rectangle: defines the collision-active region within a tile */
export interface CollisionRect {
  x: number; // Horizontal offset within tile (pixels, 0-31)
  y: number; // Vertical offset within tile (pixels, 0-31)
  w: number; // Width of collision rect (pixels, 1-32)
  h: number; // Height of collision rect (pixels, 1-32)
}

/** Information about a single tile in the collision grid */
export interface TileInfo {
  solid: boolean;
  destructible: boolean;
  tileId: number;
  collisionRect: CollisionRect;
}

/** Minimal entity interface for collision resolution */
export interface CollidableEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  role?: string;
}

/** Result of collision resolution */
export interface CollisionResult {
  hitX: boolean;
  hitY: boolean;
  hitTiles: { tileX: number; tileY: number }[];
}

/**
 * 2D grid built from Tiled JSON wall layer data.
 * Provides fast tile lookups and world-to-tile coordinate conversion.
 */
export class CollisionGrid {
  public readonly width: number;
  public readonly height: number;
  public readonly tileSize: number;

  private grid: TileInfo[][];

  constructor(
    wallLayerData: number[],
    mapWidth: number,
    mapHeight: number,
    tileSize: number,
    destructibleTileIds: Set<number>,
    indestructibleTileIds: Set<number>,
    collisionShapes?: Record<string, { x: number; y: number; w: number; h: number }>,
  ) {
    this.width = mapWidth;
    this.height = mapHeight;
    this.tileSize = tileSize;

    const fullTile: CollisionRect = { x: 0, y: 0, w: tileSize, h: tileSize };

    // Build 2D grid from flat wall layer data
    this.grid = [];
    for (let row = 0; row < mapHeight; row++) {
      this.grid[row] = [];
      for (let col = 0; col < mapWidth; col++) {
        const tileId = wallLayerData[row * mapWidth + col];
        const isDestructible = destructibleTileIds.has(tileId);
        const isIndestructible = indestructibleTileIds.has(tileId);
        const isSolid = isDestructible || isIndestructible;

        // Determine collision sub-rect: use shapes data if available, else full tile
        let collisionRect: CollisionRect = fullTile;
        if (isSolid && collisionShapes) {
          const shape = collisionShapes[String(tileId)];
          if (shape) {
            collisionRect = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
          }
        }

        this.grid[row][col] = {
          solid: isSolid,
          destructible: isDestructible,
          tileId,
          collisionRect,
        };
      }
    }
  }

  /** Returns true if tile is solid or out of bounds */
  isSolid(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return true; // Out of bounds treated as solid
    }
    return this.grid[tileY][tileX].solid;
  }

  /** Returns tile info or null for out-of-bounds */
  getTileInfo(tileX: number, tileY: number): TileInfo | null {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return null;
    }
    return this.grid[tileY][tileX];
  }

  /** Marks a tile as non-solid and non-destructible (for destruction) */
  clearTile(tileX: number, tileY: number): void {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return;
    }
    this.grid[tileY][tileX] = {
      solid: false,
      destructible: false,
      tileId: 0,
      collisionRect: { x: 0, y: 0, w: this.tileSize, h: this.tileSize },
    };
  }

  /** Converts pixel coordinates to tile coordinates */
  worldToTile(worldX: number, worldY: number): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor(worldX / this.tileSize),
      tileY: Math.floor(worldY / this.tileSize),
    };
  }

  /** Returns true if a world-space point falls inside a solid tile's collision sub-rect */
  isPointInSolidRect(worldX: number, worldY: number): boolean {
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);

    // Out of bounds = solid (full tile, point is always "inside")
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return true;
    }

    const info = this.grid[tileY][tileX];
    if (!info.solid) return false;

    const rect = info.collisionRect;
    const localX = worldX - tileX * this.tileSize;
    const localY = worldY - tileY * this.tileSize;

    return (
      localX >= rect.x && localX < rect.x + rect.w && localY >= rect.y && localY < rect.y + rect.h
    );
  }
}

/**
 * AABB-vs-tile collision resolution with axis-separated approach.
 *
 * Resolves X axis first (using prevY for stability), then Y axis (using resolved X).
 * Mutates entity.x and entity.y in place when pushing out of solid tiles.
 *
 * @param entity - The entity to resolve collisions for (mutated in place)
 * @param radius - The entity's collision radius (AABB half-extent)
 * @param grid - The collision grid to check against
 * @param prevX - Entity's X position before movement
 * @param prevY - Entity's Y position before movement
 * @returns Hit flags and list of tile coordinates that were hit
 */
export function resolveCollisions(
  entity: CollidableEntity,
  radius: number,
  grid: CollisionGrid,
  prevX: number,
  prevY: number,
): CollisionResult {
  let hitX = false;
  let hitY = false;
  const hitTiles: { tileX: number; tileY: number }[] = [];
  const tileSize = grid.tileSize;

  // --- Resolve X axis first (use prevY for stability) ---
  {
    const left = entity.x - radius;
    const right = entity.x + radius;
    const top = prevY - radius;
    const bottom = prevY + radius;

    const tileLeft = Math.floor(left / tileSize);
    const tileRight = Math.floor((right - COLLISION_EPSILON) / tileSize);
    const tileTop = Math.floor(top / tileSize);
    const tileBottom = Math.floor((bottom - COLLISION_EPSILON) / tileSize);

    for (let ty = tileTop; ty <= tileBottom; ty++) {
      for (let tx = tileLeft; tx <= tileRight; tx++) {
        if (grid.isSolid(tx, ty)) {
          // Get sub-rect collision bounds (OOB tiles get full-tile rect)
          const info = grid.getTileInfo(tx, ty);
          const rect = info?.collisionRect || { x: 0, y: 0, w: tileSize, h: tileSize };

          // Sub-rect world bounds
          const rectLeft = tx * tileSize + rect.x;
          const rectRight = tx * tileSize + rect.x + rect.w;
          const rectTop = ty * tileSize + rect.y;
          const rectBottom = ty * tileSize + rect.y + rect.h;

          // Narrow phase: entity AABB vs sub-rect AABB
          // For X pass, use prevY for vertical extent (axis separation)
          const eLeft = entity.x - radius;
          const eRight = entity.x + radius;
          const eTop = prevY - radius;
          const eBottom = prevY + radius;

          if (eRight > rectLeft && eLeft < rectRight && eBottom > rectTop && eTop < rectBottom) {
            hitX = true;
            hitTiles.push({ tileX: tx, tileY: ty });

            if (entity.x > prevX) {
              entity.x = rectLeft - radius - COLLISION_EPSILON;
            } else if (entity.x < prevX) {
              entity.x = rectRight + radius;
            }
          }
        }
      }
    }
  }

  // --- Resolve Y axis (use resolved X) ---
  {
    const left = entity.x - radius;
    const right = entity.x + radius;
    const top = entity.y - radius;
    const bottom = entity.y + radius;

    const tileLeft = Math.floor(left / tileSize);
    const tileRight = Math.floor((right - COLLISION_EPSILON) / tileSize);
    const tileTop = Math.floor(top / tileSize);
    const tileBottom = Math.floor((bottom - COLLISION_EPSILON) / tileSize);

    for (let ty = tileTop; ty <= tileBottom; ty++) {
      for (let tx = tileLeft; tx <= tileRight; tx++) {
        if (grid.isSolid(tx, ty)) {
          // Get sub-rect collision bounds (OOB tiles get full-tile rect)
          const info = grid.getTileInfo(tx, ty);
          const rect = info?.collisionRect || { x: 0, y: 0, w: tileSize, h: tileSize };

          // Sub-rect world bounds
          const rectLeft = tx * tileSize + rect.x;
          const rectRight = tx * tileSize + rect.x + rect.w;
          const rectTop = ty * tileSize + rect.y;
          const rectBottom = ty * tileSize + rect.y + rect.h;

          // For Y pass, use resolved entity.x for horizontal extent
          const eLeft = entity.x - radius;
          const eRight = entity.x + radius;
          const eTop = entity.y - radius;
          const eBottom = entity.y + radius;

          if (eRight > rectLeft && eLeft < rectRight && eBottom > rectTop && eTop < rectBottom) {
            hitY = true;
            hitTiles.push({ tileX: tx, tileY: ty });

            if (entity.y > prevY) {
              entity.y = rectTop - radius - COLLISION_EPSILON;
            } else if (entity.y < prevY) {
              entity.y = rectBottom + radius;
            }
          }
        }
      }
    }
  }

  return { hitX, hitY, hitTiles };
}

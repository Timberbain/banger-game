/**
 * Shared collision grid and AABB-vs-tile collision resolution
 * Pure TypeScript -- no Phaser or server dependencies
 * Used by both server (authoritative) and client (prediction)
 */

/** Information about a single tile in the collision grid */
export interface TileInfo {
  solid: boolean;
  destructible: boolean;
  tileId: number;
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
    indestructibleTileIds: Set<number>
  ) {
    this.width = mapWidth;
    this.height = mapHeight;
    this.tileSize = tileSize;

    // Build 2D grid from flat wall layer data
    this.grid = [];
    for (let row = 0; row < mapHeight; row++) {
      this.grid[row] = [];
      for (let col = 0; col < mapWidth; col++) {
        const tileId = wallLayerData[row * mapWidth + col];
        const isDestructible = destructibleTileIds.has(tileId);
        const isIndestructible = indestructibleTileIds.has(tileId);
        this.grid[row][col] = {
          solid: isDestructible || isIndestructible,
          destructible: isDestructible,
          tileId,
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
    };
  }

  /** Converts pixel coordinates to tile coordinates */
  worldToTile(worldX: number, worldY: number): { tileX: number; tileY: number } {
    return {
      tileX: Math.floor(worldX / this.tileSize),
      tileY: Math.floor(worldY / this.tileSize),
    };
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
  prevY: number
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
    const tileRight = Math.floor(right / tileSize);
    const tileTop = Math.floor(top / tileSize);
    const tileBottom = Math.floor(bottom / tileSize);

    for (let ty = tileTop; ty <= tileBottom; ty++) {
      for (let tx = tileLeft; tx <= tileRight; tx++) {
        if (grid.isSolid(tx, ty)) {
          hitX = true;
          hitTiles.push({ tileX: tx, tileY: ty });

          // Push entity out based on movement direction
          if (entity.x > prevX) {
            // Moving right: push left edge of tile
            entity.x = tx * tileSize - radius;
          } else if (entity.x < prevX) {
            // Moving left: push to right edge of tile
            entity.x = (tx + 1) * tileSize + radius;
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
    const tileRight = Math.floor(right / tileSize);
    const tileTop = Math.floor(top / tileSize);
    const tileBottom = Math.floor(bottom / tileSize);

    for (let ty = tileTop; ty <= tileBottom; ty++) {
      for (let tx = tileLeft; tx <= tileRight; tx++) {
        if (grid.isSolid(tx, ty)) {
          hitY = true;
          hitTiles.push({ tileX: tx, tileY: ty });

          // Push entity out based on movement direction
          if (entity.y > prevY) {
            // Moving down: push to top edge of tile
            entity.y = ty * tileSize - radius;
          } else if (entity.y < prevY) {
            // Moving up: push to bottom edge of tile
            entity.y = (ty + 1) * tileSize + radius;
          }
        }
      }
    }
  }

  return { hitX, hitY, hitTiles };
}

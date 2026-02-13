/**
 * Map metadata registry
 * Shared between client and server for consistent map loading and spawn points
 */

export interface MapMetadata {
  name: string;
  displayName: string;
  file: string;         // Path relative to client public dir
  tileset: string;      // Tileset key name (matches Tiled tileset name)
  width: number;        // Arena width in pixels (50 tiles * 32px = 1600)
  height: number;       // Arena height in pixels (38 tiles * 32px = 1216)
  spawnPoints: {
    paran: { x: number; y: number };
    guardians: [{ x: number; y: number }, { x: number; y: number }];
  };
}

export const MAPS: MapMetadata[] = [
  {
    name: "hedge_garden",
    displayName: "Hedge Garden",
    file: "maps/hedge_garden.json",
    tileset: "arena_hedge",
    width: 1600,   // 50 * 32
    height: 1216,  // 38 * 32
    spawnPoints: {
      paran: { x: 800, y: 608 },
      guardians: [{ x: 200, y: 200 }, { x: 1400, y: 1016 }]
    }
  },
  {
    name: "brick_fortress",
    displayName: "Brick Fortress",
    file: "maps/brick_fortress.json",
    tileset: "arena_brick",
    width: 1600,
    height: 1216,
    spawnPoints: {
      paran: { x: 800, y: 608 },
      guardians: [{ x: 200, y: 200 }, { x: 1400, y: 1016 }]
    }
  },
  {
    name: "timber_yard",
    displayName: "Timber Yard",
    file: "maps/timber_yard.json",
    tileset: "arena_wood",
    width: 1600,
    height: 1216,
    spawnPoints: {
      paran: { x: 800, y: 608 },
      guardians: [{ x: 200, y: 200 }, { x: 1400, y: 1016 }]
    }
  }
];

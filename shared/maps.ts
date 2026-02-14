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
      paran: { x: 800, y: 480 },       // tile (25, 15) - center of large open area
      guardians: [
        { x: 512, y: 96 },             // faran: tile (16, 3) - open corridor north
        { x: 960, y: 736 }             // baran: tile (30, 23) - open area south-east
      ]
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
      paran: { x: 768, y: 384 },       // tile (24, 12) - open corridor above central chamber
      guardians: [
        { x: 288, y: 96 },             // faran: tile (9, 3) - inside top-left room
        { x: 1088, y: 640 }            // baran: tile (34, 20) - open corridor near bottom-right room
      ]
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
      paran: { x: 640, y: 384 },       // tile (20, 12) - open area left of vertical spine gap
      guardians: [
        { x: 128, y: 96 },             // faran: tile (4, 3) - open corner top-left
        { x: 1216, y: 640 }            // baran: tile (38, 20) - open area right of horizontal spine
      ]
    }
  }
];

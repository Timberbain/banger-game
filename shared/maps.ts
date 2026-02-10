/**
 * Map metadata registry
 * Shared between client and server for consistent map loading and spawn points
 */

export interface MapMetadata {
  name: string;
  displayName: string;
  file: string;         // Path relative to client public dir
  tileset: string;      // Tileset key name
  width: number;        // Arena width in pixels
  height: number;       // Arena height in pixels
  spawnPoints: {
    paran: { x: number; y: number };
    guardians: [{ x: number; y: number }, { x: number; y: number }];
  };
}

export const MAPS: MapMetadata[] = [
  {
    name: "test_arena",
    displayName: "Test Arena",
    file: "maps/test_arena.json",
    tileset: "tiles",
    width: 800,
    height: 608,
    spawnPoints: {
      paran: { x: 400, y: 304 },
      guardians: [{ x: 150, y: 150 }, { x: 650, y: 460 }]
    }
  },
  {
    name: "corridor_chaos",
    displayName: "Corridor Chaos",
    file: "maps/corridor_chaos.json",
    tileset: "tiles",
    width: 800,
    height: 608,
    spawnPoints: {
      paran: { x: 400, y: 304 },
      guardians: [{ x: 100, y: 100 }, { x: 700, y: 500 }]
    }
  },
  {
    name: "cross_fire",
    displayName: "Cross Fire",
    file: "maps/cross_fire.json",
    tileset: "tiles",
    width: 800,
    height: 608,
    spawnPoints: {
      paran: { x: 400, y: 304 },
      guardians: [{ x: 100, y: 500 }, { x: 700, y: 100 }]
    }
  },
  {
    name: "pillars",
    displayName: "Pillars",
    file: "maps/pillars.json",
    tileset: "tiles",
    width: 800,
    height: 608,
    spawnPoints: {
      paran: { x: 400, y: 304 },
      guardians: [{ x: 130, y: 304 }, { x: 670, y: 304 }]
    }
  }
];

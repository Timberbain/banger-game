/**
 * Import existing Tiled JSON maps back into the logical editor grid.
 * Reverse-engineers wall sentinels and rock obstacle IDs from the Walls layer.
 * Supports the unified tileset with themed wall canopy ranges.
 */

import {
  EditorState,
  TILE_WALL_HEDGE,
  TILE_WALL_BRICK,
  TILE_WALL_WOOD,
  TILE_EMPTY,
  type Theme,
} from './EditorState';
import {
  TILE_RANGES,
  isWallCanopy,
  isRockCanopy,
  detectThemeFromTileId,
} from '../../../shared/tileRegistry';

/** All rock canopy IDs (289-296) */
const OBSTACLE_IDS = new Set<number>();
for (let id = TILE_RANGES.ROCK_CANOPY.min; id <= TILE_RANGES.ROCK_CANOPY.max; id++) {
  OBSTACLE_IDS.add(id);
}

interface TiledProperty {
  name: string;
  type: string;
  value: string;
}

interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  layers: Array<{ name: string; data: number[] }>;
  tilesets: Array<{ name: string; image: string }>;
  properties?: TiledProperty[];
}

/** Detect theme from wall canopy tile IDs in the Walls layer */
function detectTheme(map: TiledMap): Theme {
  const wallsLayer = map.layers.find((l) => l.name === 'Walls');
  if (wallsLayer) {
    for (const tileId of wallsLayer.data) {
      const theme = detectThemeFromTileId(tileId);
      if (theme) return theme;
    }
  }
  // Fallback: check tileset name for legacy maps
  const name = map.tilesets[0]?.name || '';
  if (name.includes('brick')) return 'brick';
  if (name.includes('wood')) return 'wood';
  return 'hedge';
}

/** Import a Tiled JSON map into the editor state */
export function importTiledMap(state: EditorState, mapJson: TiledMap, name?: string): void {
  const { width, height, layers } = mapJson;

  const wallsLayer = layers.find((l) => l.name === 'Walls');
  const groundLayer = layers.find((l) => l.name === 'Ground');

  if (!wallsLayer) {
    throw new Error('Map JSON missing Walls layer');
  }

  state.width = width;
  state.height = height;
  state.logicalGrid = new Array(width * height).fill(TILE_EMPTY);
  state.groundOverrides = new Map();
  state.spawnPoints = { paran: null, guardian1: null, guardian2: null };
  state.theme = detectTheme(mapJson);

  // Reverse-engineer logical grid from Walls layer with per-theme sentinels
  for (let i = 0; i < wallsLayer.data.length; i++) {
    const tile = wallsLayer.data[i];
    if (isWallCanopy(tile)) {
      // Map canopy ID to the correct theme sentinel
      const theme = detectThemeFromTileId(tile);
      if (theme === 'brick') {
        state.logicalGrid[i] = TILE_WALL_BRICK;
      } else if (theme === 'wood') {
        state.logicalGrid[i] = TILE_WALL_WOOD;
      } else {
        state.logicalGrid[i] = TILE_WALL_HEDGE;
      }
    } else if (OBSTACLE_IDS.has(tile)) {
      // Rock obstacle IDs pass through as-is
      state.logicalGrid[i] = tile;
    }
    // 0 (empty) stays as TILE_EMPTY
  }

  // Store ground overrides for ALL cells (not just empty ones)
  if (groundLayer) {
    for (let i = 0; i < groundLayer.data.length; i++) {
      const gt = groundLayer.data[i];
      if (gt > 0) {
        state.groundOverrides.set(i, gt);
      }
    }
  }

  // Restore metadata from Tiled properties (embedded by editor export)
  if (mapJson.properties) {
    const props = new Map(mapJson.properties.map((p) => [p.name, p.value]));
    const tileSize = mapJson.tilewidth || 32;

    if (props.has('mapName')) state.mapName = props.get('mapName')!;
    if (props.has('displayName')) state.displayName = props.get('displayName')!;

    // Restore spawn points from pixel coords back to tile coords
    const spawnRaw = props.get('spawnPoints');
    if (spawnRaw) {
      try {
        const spawnData = JSON.parse(spawnRaw);
        if (spawnData.paran) {
          state.spawnPoints.paran = {
            x: Math.floor(spawnData.paran.x / tileSize),
            y: Math.floor(spawnData.paran.y / tileSize),
          };
        }
        if (spawnData.guardians?.[0]) {
          state.spawnPoints.guardian1 = {
            x: Math.floor(spawnData.guardians[0].x / tileSize),
            y: Math.floor(spawnData.guardians[0].y / tileSize),
          };
        }
        if (spawnData.guardians?.[1]) {
          state.spawnPoints.guardian2 = {
            x: Math.floor(spawnData.guardians[1].x / tileSize),
            y: Math.floor(spawnData.guardians[1].y / tileSize),
          };
        }
      } catch {
        // Ignore malformed spawnPoints
      }
    }
  } else if (name) {
    // Fallback: derive names from filename if no properties
    state.mapName = name;
    state.displayName = name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  state.notify();
}

/** Fetch and import one of the built-in maps */
export async function loadBuiltinMap(state: EditorState, mapName: string): Promise<void> {
  const resp = await fetch(`/maps/${mapName}.json`);
  if (!resp.ok) throw new Error(`Failed to load map: ${mapName}`);
  const mapJson = await resp.json();
  importTiledMap(state, mapJson, mapName);
}

/** Import from a user-uploaded File */
export async function importFromFile(state: EditorState, file: File): Promise<void> {
  const text = await file.text();
  const mapJson = JSON.parse(text);
  const name = file.name.replace(/\.json$/, '');
  importTiledMap(state, mapJson, name);
}

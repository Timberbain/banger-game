/**
 * Export editor state to Tiled-compatible JSON with embedded map metadata.
 * Uses the unified tileset (arena_unified.png, 352 tiles).
 */

import {
  EditorState,
  TILE_WALL_HEDGE,
  TILE_WALL_BRICK,
  TILE_WALL_WOOD,
  isWallSentinel,
  sentinelToTheme,
} from './EditorState';
import { generateAllLayers } from './LayerGenerator';
import { type AutoTileRule } from './AutoTiler';
import { TOTAL_TILES, type CollisionShape } from '../../../shared/tileRegistry';

const TILE = 32;

/** Detect dominant wall theme from sentinel counts in the logical grid */
function detectDominantTheme(state: EditorState): string {
  const counts: Record<string, number> = { hedge: 0, brick: 0, wood: 0 };
  for (const val of state.logicalGrid) {
    if (isWallSentinel(val)) {
      counts[sentinelToTheme(val)]++;
    }
  }
  let best = 'hedge';
  let max = 0;
  for (const [theme, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = theme;
    }
  }
  return best;
}

/** Serialize collision overrides for Tiled custom property */
function serializeCollisionOverrides(
  overrides: Map<string, CollisionShape>,
): Record<string, CollisionShape> | undefined {
  if (overrides.size === 0) return undefined;
  const obj: Record<string, CollisionShape> = {};
  for (const [k, v] of overrides) {
    obj[k] = v;
  }
  return obj;
}

/** Generate a full Tiled JSON map from the current editor state */
export function exportTiledJSON(state: EditorState, rules: AutoTileRule[]): object {
  const { width, height, groundSeed, groundOverrides } = state;
  const theme = detectDominantTheme(state);
  const layers = generateAllLayers(
    state.logicalGrid,
    width,
    height,
    rules,
    groundSeed,
    theme as 'hedge' | 'brick' | 'wood',
    groundOverrides,
    state.decorationOverrides,
  );

  const collisionOverrides = serializeCollisionOverrides(state.collisionOverrides);

  const properties: Array<{ name: string; type: string; value: string }> = [];

  // Embed map metadata so JSON is the single source of truth
  properties.push({ name: 'mapName', type: 'string', value: state.mapName });
  properties.push({ name: 'displayName', type: 'string', value: state.displayName });
  properties.push({ name: 'wallTheme', type: 'string', value: theme });

  // Spawn points as pixel coords (tile center)
  const spawnData = {
    paran: state.spawnPoints.paran
      ? {
          x: state.spawnPoints.paran.x * TILE + TILE / 2,
          y: state.spawnPoints.paran.y * TILE + TILE / 2,
        }
      : null,
    guardians: [
      state.spawnPoints.guardian1
        ? {
            x: state.spawnPoints.guardian1.x * TILE + TILE / 2,
            y: state.spawnPoints.guardian1.y * TILE + TILE / 2,
          }
        : null,
      state.spawnPoints.guardian2
        ? {
            x: state.spawnPoints.guardian2.x * TILE + TILE / 2,
            y: state.spawnPoints.guardian2.y * TILE + TILE / 2,
          }
        : null,
    ],
  };
  properties.push({ name: 'spawnPoints', type: 'string', value: JSON.stringify(spawnData) });

  if (collisionOverrides) {
    properties.push({
      name: 'collisionOverrides',
      type: 'string',
      value: JSON.stringify(collisionOverrides),
    });
  }

  return {
    compressionlevel: -1,
    width,
    height,
    tilewidth: TILE,
    tileheight: TILE,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    type: 'map',
    version: '1.10',
    infinite: false,
    nextlayerid: 5,
    nextobjectid: 1,
    properties,
    tilesets: [
      {
        firstgid: 1,
        columns: 8,
        image: '../tilesets/arena_unified.png',
        imagewidth: 272,
        imageheight: 1564,
        margin: 1,
        name: 'arena_unified',
        spacing: 2,
        tilecount: TOTAL_TILES,
        tilewidth: TILE,
        tileheight: TILE,
      },
    ],
    layers: [
      {
        data: layers.ground,
        height,
        id: 1,
        name: 'Ground',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        width,
        x: 0,
        y: 0,
      },
      {
        data: layers.decorations,
        height,
        id: 4,
        name: 'Decorations',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        width,
        x: 0,
        y: 0,
      },
      {
        data: layers.wallFronts,
        height,
        id: 2,
        name: 'WallFronts',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        width,
        x: 0,
        y: 0,
      },
      {
        data: layers.walls,
        height,
        id: 3,
        name: 'Walls',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        width,
        x: 0,
        y: 0,
      },
    ],
  };
}

/** Download a JSON file to the user's computer */
export function downloadJSON(data: object, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

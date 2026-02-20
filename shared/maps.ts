/**
 * Map metadata types and parser.
 * Metadata is embedded in Tiled JSON map files as custom properties.
 * Server discovers maps from filesystem; client derives metadata from Phaser tilemap.
 */

import type { WallTheme } from './tileRegistry';

export interface MapMetadata {
  name: string;
  displayName: string;
  file: string; // Path relative to client public dir
  wallTheme: WallTheme; // Wall art theme (hedge/brick/wood)
  width: number; // Arena width in pixels
  height: number; // Arena height in pixels
  spawnPoints: {
    paran: { x: number; y: number };
    guardians: [{ x: number; y: number }, { x: number; y: number }];
  };
}

/**
 * Parse MapMetadata from a Tiled JSON object.
 * Reads embedded properties (mapName, displayName, wallTheme, spawnPoints).
 * Returns null if spawnPoints property is missing (map not playable).
 */
export function parseMapMetadata(mapJson: any, fileName: string): MapMetadata | null {
  const props = new Map<string, string>();
  if (Array.isArray(mapJson.properties)) {
    for (const p of mapJson.properties) {
      props.set(p.name, p.value);
    }
  }

  // Derive dimensions from tile grid
  const width = mapJson.width * (mapJson.tilewidth || 32);
  const height = mapJson.height * (mapJson.tileheight || 32);

  // Parse spawn points — required for a playable map
  const spawnRaw = props.get('spawnPoints');
  if (!spawnRaw) return null;

  let spawnData: any;
  try {
    spawnData = JSON.parse(spawnRaw);
  } catch {
    return null;
  }

  if (!spawnData.paran || !spawnData.guardians?.[0] || !spawnData.guardians?.[1]) {
    return null;
  }

  const baseName = fileName.replace(/\.json$/, '');

  return {
    name: props.get('mapName') || baseName,
    displayName:
      props.get('displayName') ||
      baseName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    file: `maps/${fileName}`,
    wallTheme: (props.get('wallTheme') as WallTheme) || 'hedge',
    width,
    height,
    spawnPoints: {
      paran: { x: spawnData.paran.x, y: spawnData.paran.y },
      guardians: [
        { x: spawnData.guardians[0].x, y: spawnData.guardians[0].y },
        { x: spawnData.guardians[1].x, y: spawnData.guardians[1].y },
      ],
    },
  };
}

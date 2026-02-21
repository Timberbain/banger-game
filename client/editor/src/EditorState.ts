/**
 * Central editor state: logical grid, spawns, metadata.
 * Single source of truth for the arena being edited.
 */

import { TILE_RANGES, getDecorationIds, type CollisionShape } from '../../../shared/tileRegistry';

export type Theme = 'hedge' | 'brick' | 'wood';

export type Tool =
  | 'wall-hedge'
  | 'wall-brick'
  | 'wall-wood'
  | 'heavy'
  | 'medium'
  | 'light'
  | 'eraser'
  | 'ground'
  | 'decoration'
  | 'spawn-paran'
  | 'spawn-guardian1'
  | 'spawn-guardian2'
  | 'select';

export interface SpawnPoints {
  paran: { x: number; y: number } | null;
  guardian1: { x: number; y: number } | null;
  guardian2: { x: number; y: number } | null;
}

/** Tile value constants in the logical grid */
export const TILE_EMPTY = 0;
export const TILE_WALL_HEDGE = -1; // Sentinel for hedge walls
export const TILE_WALL_BRICK = -2; // Sentinel for brick walls
export const TILE_WALL_WOOD = -3; // Sentinel for wood walls
/** @deprecated Use TILE_WALL_HEDGE instead. Kept for backward compat. */
export const TILE_WALL = TILE_WALL_HEDGE;

/** Check if a logical grid value is a wall sentinel (any theme) */
export function isWallSentinel(value: number): boolean {
  return value === TILE_WALL_HEDGE || value === TILE_WALL_BRICK || value === TILE_WALL_WOOD;
}

/** Map wall sentinel to theme offset for auto-tiling (0=hedge, 96=brick, 192=wood) */
export function sentinelToThemeOffset(sentinel: number): number {
  switch (sentinel) {
    case TILE_WALL_BRICK:
      return 96;
    case TILE_WALL_WOOD:
      return 192;
    default:
      return 0; // hedge
  }
}

/** Map wall sentinel to theme name */
export function sentinelToTheme(sentinel: number): Theme {
  switch (sentinel) {
    case TILE_WALL_BRICK:
      return 'brick';
    case TILE_WALL_WOOD:
      return 'wood';
    default:
      return 'hedge';
  }
}

/** Default rock IDs for each obstacle tier (first variant of each tier) */
export const ROCK_HEAVY = 289; // IDs 289-291 = heavy (5HP)
export const ROCK_MEDIUM = 292; // IDs 292-294 = medium (3HP)
export const ROCK_LIGHT = 295; // IDs 295-296 = light (2HP)

const TOOL_TO_TILE: Record<string, number> = {
  'wall-hedge': TILE_WALL_HEDGE,
  'wall-brick': TILE_WALL_BRICK,
  'wall-wood': TILE_WALL_WOOD,
  heavy: ROCK_HEAVY,
  medium: ROCK_MEDIUM,
  light: ROCK_LIGHT,
  eraser: TILE_EMPTY,
};

export type ChangeListener = () => void;

export class EditorState {
  width: number;
  height: number;
  logicalGrid: number[];
  groundOverrides: Map<number, number>;
  decorationOverrides: Map<number, number>;
  collisionOverrides: Map<string, CollisionShape>;
  theme: Theme = 'hedge';
  mapName = 'custom_arena';
  displayName = 'Custom Arena';
  spawnPoints: SpawnPoints = { paran: null, guardian1: null, guardian2: null };
  groundSeed = 42;
  currentTool: Tool = 'wall-hedge';
  selectedGroundTile = 305;
  selectedDecorationTile = 353;
  scatterMode = false;
  mirrorX = false;
  mirrorY = false;
  selection: { x1: number; y1: number; x2: number; y2: number } | null = null;

  private listeners: ChangeListener[] = [];

  constructor(width = 50, height = 38) {
    this.width = width;
    this.height = height;
    this.logicalGrid = new Array(width * height).fill(TILE_EMPTY);
    this.groundOverrides = new Map();
    this.decorationOverrides = new Map();
    this.collisionOverrides = new Map();
    this.prefillGreenGround();
    this.fillPerimeter();
  }

  onChange(fn: ChangeListener): void {
    this.listeners.push(fn);
  }

  notify(): void {
    for (const fn of this.listeners) fn();
  }

  /** Pre-fill all cells with plain green solid ground (tile 333) */
  private prefillGreenGround(): void {
    const PLAIN_GREEN = 333;
    for (let i = 0; i < this.width * this.height; i++) {
      this.groundOverrides.set(i, PLAIN_GREEN);
    }
  }

  /** Fill all border cells with walls */
  fillPerimeter(sentinel = TILE_WALL_HEDGE): void {
    for (let x = 0; x < this.width; x++) {
      this.logicalGrid[x] = sentinel; // top row
      this.logicalGrid[(this.height - 1) * this.width + x] = sentinel; // bottom row
    }
    for (let y = 0; y < this.height; y++) {
      this.logicalGrid[y * this.width] = sentinel; // left col
      this.logicalGrid[y * this.width + (this.width - 1)] = sentinel; // right col
    }
  }

  /** Set a tile in the logical grid at (x, y) */
  setTile(x: number, y: number, value: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.logicalGrid[y * this.width + x] = value;
  }

  /** Get a tile from the logical grid */
  getTile(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TILE_WALL;
    return this.logicalGrid[y * this.width + x];
  }

  /** Apply the current tool at tile position (x, y) */
  applyTool(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

    const tool = this.currentTool;

    if (tool.startsWith('spawn-')) {
      return this.placeSpawn(x, y, tool);
    }

    if (tool === 'ground') {
      const idx = y * this.width + x;
      this.groundOverrides.set(idx, this.selectedGroundTile);
      return true;
    }

    if (tool === 'decoration') {
      const idx = y * this.width + x;
      if (this.scatterMode) {
        // Scatter mode: skip ~40% of placements for natural sparse scatter
        if (Math.random() < 0.4) return false;
        const decoIds = getDecorationIds();
        this.decorationOverrides.set(idx, decoIds[Math.floor(Math.random() * decoIds.length)]);
      } else {
        this.decorationOverrides.set(idx, this.selectedDecorationTile);
      }
      return true;
    }

    if (tool === 'eraser') {
      const idx = y * this.width + x;
      this.decorationOverrides.delete(idx);
    }

    const tileValue = TOOL_TO_TILE[tool];
    if (tileValue === undefined) return false;

    const idx = y * this.width + x;
    if (this.logicalGrid[idx] === tileValue) return false;
    this.logicalGrid[idx] = tileValue;
    return true;
  }

  /** Apply tool at (x,y) plus all mirror positions. Returns true if any tile changed. */
  applyToolMirrored(x: number, y: number): boolean {
    let changed = this.applyTool(x, y);

    if (this.mirrorX) {
      const mx = this.width - 1 - x;
      changed = this.applyToolAt(mx, y, this.mirrorSpawnTool('x')) || changed;
    }
    if (this.mirrorY) {
      const my = this.height - 1 - y;
      changed = this.applyToolAt(x, my, this.mirrorSpawnTool('y')) || changed;
    }
    if (this.mirrorX && this.mirrorY) {
      const mx = this.width - 1 - x;
      const my = this.height - 1 - y;
      changed = this.applyToolAt(mx, my, this.mirrorSpawnTool('xy')) || changed;
    }
    return changed;
  }

  /** Get the tool to use at a mirror position (swaps guardian spawns) */
  private mirrorSpawnTool(_axis: string): Tool {
    const tool = this.currentTool;
    if (tool === 'spawn-guardian1') return 'spawn-guardian2';
    if (tool === 'spawn-guardian2') return 'spawn-guardian1';
    return tool; // paran mirrors to itself, all others unchanged
  }

  /** Apply a specific tool at (x,y) — used by mirror to apply different spawn tools */
  private applyToolAt(x: number, y: number, tool: Tool): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

    if (tool.startsWith('spawn-')) {
      const key =
        tool === 'spawn-paran' ? 'paran' : tool === 'spawn-guardian1' ? 'guardian1' : 'guardian2';
      this.spawnPoints[key] = { x, y };
      return true;
    }

    if (tool === 'ground') {
      const idx = y * this.width + x;
      this.groundOverrides.set(idx, this.selectedGroundTile);
      return true;
    }

    if (tool === 'decoration') {
      const idx = y * this.width + x;
      if (this.scatterMode) {
        if (Math.random() < 0.4) return false;
        const decoIds = getDecorationIds();
        this.decorationOverrides.set(idx, decoIds[Math.floor(Math.random() * decoIds.length)]);
      } else {
        this.decorationOverrides.set(idx, this.selectedDecorationTile);
      }
      return true;
    }

    if (tool === 'eraser') {
      const idx = y * this.width + x;
      this.decorationOverrides.delete(idx);
    }

    const tileValue = TOOL_TO_TILE[tool];
    if (tileValue === undefined) return false;
    const idx = y * this.width + x;
    if (this.logicalGrid[idx] === tileValue) return false;
    this.logicalGrid[idx] = tileValue;
    return true;
  }

  /** Place a spawn point, removing any previous one for that role */
  private placeSpawn(x: number, y: number, tool: Tool): boolean {
    const key =
      tool === 'spawn-paran' ? 'paran' : tool === 'spawn-guardian1' ? 'guardian1' : 'guardian2';
    this.spawnPoints[key] = { x, y };
    return true;
  }

  /** Set the ground override for a tile */
  setGroundOverride(x: number, y: number, groundTileId: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.groundOverrides.set(y * this.width + x, groundTileId);
  }

  /** Reset to a new empty arena */
  reset(width = 50, height = 38): void {
    this.width = width;
    this.height = height;
    this.logicalGrid = new Array(width * height).fill(TILE_EMPTY);
    this.groundOverrides = new Map();
    this.decorationOverrides = new Map();
    this.collisionOverrides = new Map();
    this.prefillGreenGround();
    this.spawnPoints = { paran: null, guardian1: null, guardian2: null };
    this.mapName = 'custom_arena';
    this.displayName = 'Custom Arena';
    this.groundSeed = Math.floor(Math.random() * 10000);
    this.fillPerimeter();
    this.notify();
  }

  /** Deep clone the mutable state for undo snapshots */
  snapshot(): {
    grid: number[];
    overrides: Map<number, number>;
    decorationOverrides: Map<number, number>;
    spawns: SpawnPoints;
    collisionOverrides: Map<string, CollisionShape>;
  } {
    const clonedCollision = new Map<string, CollisionShape>();
    for (const [k, v] of this.collisionOverrides) {
      clonedCollision.set(k, { ...v });
    }
    return {
      grid: [...this.logicalGrid],
      overrides: new Map(this.groundOverrides),
      decorationOverrides: new Map(this.decorationOverrides),
      spawns: {
        paran: this.spawnPoints.paran ? { ...this.spawnPoints.paran } : null,
        guardian1: this.spawnPoints.guardian1 ? { ...this.spawnPoints.guardian1 } : null,
        guardian2: this.spawnPoints.guardian2 ? { ...this.spawnPoints.guardian2 } : null,
      },
      collisionOverrides: clonedCollision,
    };
  }

  /** Restore from a snapshot */
  restore(snap: {
    grid: number[];
    overrides: Map<number, number>;
    decorationOverrides?: Map<number, number>;
    spawns: SpawnPoints;
    collisionOverrides?: Map<string, CollisionShape>;
  }): void {
    this.logicalGrid = [...snap.grid];
    this.groundOverrides = new Map(snap.overrides);
    this.decorationOverrides = new Map(snap.decorationOverrides || []);
    this.spawnPoints = {
      paran: snap.spawns.paran ? { ...snap.spawns.paran } : null,
      guardian1: snap.spawns.guardian1 ? { ...snap.spawns.guardian1 } : null,
      guardian2: snap.spawns.guardian2 ? { ...snap.spawns.guardian2 } : null,
    };
    if (snap.collisionOverrides) {
      const cloned = new Map<string, CollisionShape>();
      for (const [k, v] of snap.collisionOverrides) {
        cloned.set(k, { ...v });
      }
      this.collisionOverrides = cloned;
    }
    this.notify();
  }

  /** Get mirrored cursor positions for rendering ghost previews */
  getMirrorPositions(x: number, y: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    if (this.mirrorX) positions.push({ x: this.width - 1 - x, y });
    if (this.mirrorY) positions.push({ x, y: this.height - 1 - y });
    if (this.mirrorX && this.mirrorY)
      positions.push({ x: this.width - 1 - x, y: this.height - 1 - y });
    return positions;
  }

  /** Check if a tile value is solid (any wall sentinel or rock canopy 289-296) */
  static isSolid(tileId: number): boolean {
    return (
      tileId < 0 || (tileId >= TILE_RANGES.ROCK_CANOPY.min && tileId <= TILE_RANGES.ROCK_CANOPY.max)
    );
  }
}

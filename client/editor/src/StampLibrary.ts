/**
 * Built-in and custom stamp definitions for quick placement.
 * Stamps are ClipboardData objects that can be pasted via the Phase 2 paste system.
 */

import { type ClipboardData } from './Clipboard';
import { TILE_WALL_HEDGE, TILE_EMPTY } from './EditorState';

const W = TILE_WALL_HEDGE; // shorthand for wall sentinel
const E = TILE_EMPTY;
const H = 289; // heavy rock
const M = 292; // medium rock

export interface Stamp {
  name: string;
  data: ClipboardData;
  builtIn: boolean;
}

const BUILT_IN_STAMPS: Stamp[] = [
  {
    name: '3x3 Pillar',
    builtIn: true,
    data: {
      width: 3,
      height: 3,
      tiles: [M, M, M, M, H, M, M, M, M],
      groundOverrides: new Map(),
      decorationOverrides: new Map(),
    },
  },
  {
    name: 'L-Corner',
    builtIn: true,
    data: {
      width: 3,
      height: 3,
      tiles: [W, E, E, W, E, E, W, W, W],
      groundOverrides: new Map(),
      decorationOverrides: new Map(),
    },
  },
  {
    name: 'T-Junction',
    builtIn: true,
    data: {
      width: 3,
      height: 4,
      tiles: [W, E, W, W, E, W, W, E, W, W, W, W],
      groundOverrides: new Map(),
      decorationOverrides: new Map(),
    },
  },
  {
    name: 'Corridor',
    builtIn: true,
    data: {
      width: 2,
      height: 5,
      tiles: [W, W, E, E, E, E, E, E, W, W],
      groundOverrides: new Map(),
      decorationOverrides: new Map(),
    },
  },
  {
    name: '5x5 Room',
    builtIn: true,
    data: {
      width: 5,
      height: 5,
      tiles: [W, W, E, W, W, W, E, E, E, W, W, E, E, E, W, W, E, E, E, W, W, W, W, W, W],
      groundOverrides: new Map(),
      decorationOverrides: new Map(),
    },
  },
];

const STORAGE_KEY = 'banger-editor-stamps';

/** Load custom stamps from localStorage */
function loadCustomStamps(): Stamp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      name: string;
      data: {
        width: number;
        height: number;
        tiles: number[];
        groundOverrides?: [number, number][];
        decorationOverrides?: [number, number][];
      };
    }>;
    return parsed.map((s) => ({
      name: s.name,
      builtIn: false,
      data: {
        width: s.data.width,
        height: s.data.height,
        tiles: s.data.tiles,
        groundOverrides: new Map(s.data.groundOverrides || []),
        decorationOverrides: new Map(s.data.decorationOverrides || []),
      },
    }));
  } catch {
    return [];
  }
}

/** Save custom stamps to localStorage */
function saveCustomStamps(stamps: Stamp[]): void {
  const serializable = stamps.map((s) => ({
    name: s.name,
    data: {
      width: s.data.width,
      height: s.data.height,
      tiles: s.data.tiles,
      groundOverrides: Array.from(s.data.groundOverrides.entries()),
      decorationOverrides: Array.from(s.data.decorationOverrides.entries()),
    },
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

export class StampLibrary {
  private stamps: Stamp[] = [];

  constructor() {
    this.stamps = [...BUILT_IN_STAMPS, ...loadCustomStamps()];
  }

  getAll(): Stamp[] {
    return this.stamps;
  }

  addCustom(name: string, data: ClipboardData): void {
    this.stamps.push({ name, builtIn: false, data });
    saveCustomStamps(this.stamps.filter((s) => !s.builtIn));
  }

  removeCustom(index: number): void {
    const stamp = this.stamps[index];
    if (stamp && !stamp.builtIn) {
      this.stamps.splice(index, 1);
      saveCustomStamps(this.stamps.filter((s) => !s.builtIn));
    }
  }
}

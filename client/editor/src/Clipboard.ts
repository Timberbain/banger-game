/**
 * Clipboard data structure and transform operations for copy/paste.
 */

import { EditorState, TILE_EMPTY } from './EditorState';

export interface ClipboardData {
  width: number;
  height: number;
  tiles: number[];
  groundOverrides: Map<number, number>;
}

/** Rotate clipboard 90 degrees clockwise */
export function rotateClipboard90CW(clip: ClipboardData): ClipboardData {
  const newW = clip.height;
  const newH = clip.width;
  const tiles = new Array(newW * newH);
  const groundOverrides = new Map<number, number>();

  for (let y = 0; y < clip.height; y++) {
    for (let x = 0; x < clip.width; x++) {
      const srcIdx = y * clip.width + x;
      const newX = clip.height - 1 - y;
      const newY = x;
      const dstIdx = newY * newW + newX;
      tiles[dstIdx] = clip.tiles[srcIdx];
      const ground = clip.groundOverrides.get(srcIdx);
      if (ground !== undefined) groundOverrides.set(dstIdx, ground);
    }
  }

  return { width: newW, height: newH, tiles, groundOverrides };
}

/** Flip clipboard horizontally */
export function flipClipboardH(clip: ClipboardData): ClipboardData {
  const tiles = new Array(clip.width * clip.height);
  const groundOverrides = new Map<number, number>();

  for (let y = 0; y < clip.height; y++) {
    for (let x = 0; x < clip.width; x++) {
      const srcIdx = y * clip.width + x;
      const newX = clip.width - 1 - x;
      const dstIdx = y * clip.width + newX;
      tiles[dstIdx] = clip.tiles[srcIdx];
      const ground = clip.groundOverrides.get(srcIdx);
      if (ground !== undefined) groundOverrides.set(dstIdx, ground);
    }
  }

  return { width: clip.width, height: clip.height, tiles, groundOverrides };
}

/** Paste clipboard data onto state at origin position */
export function pasteClipboard(
  state: EditorState,
  clip: ClipboardData,
  originX: number,
  originY: number,
): void {
  for (let y = 0; y < clip.height; y++) {
    for (let x = 0; x < clip.width; x++) {
      const tx = originX + x;
      const ty = originY + y;
      if (tx < 0 || tx >= state.width || ty < 0 || ty >= state.height) continue;

      const srcIdx = y * clip.width + x;
      const tileVal = clip.tiles[srcIdx];
      if (tileVal !== TILE_EMPTY) {
        state.setTile(tx, ty, tileVal);
      }

      const ground = clip.groundOverrides.get(srcIdx);
      if (ground !== undefined) {
        state.setGroundOverride(tx, ty, ground);
      }
    }
  }
}

/** Copy a region from state into clipboard data */
export function copyRegion(
  state: EditorState,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): ClipboardData {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const tiles = new Array(w * h);
  const groundOverrides = new Map<number, number>();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (minY + y) * state.width + (minX + x);
      tiles[y * w + x] = state.logicalGrid[srcIdx];
      const ground = state.groundOverrides.get(srcIdx);
      if (ground !== undefined) groundOverrides.set(y * w + x, ground);
    }
  }

  return { width: w, height: h, tiles, groundOverrides };
}

/** Clear a region in state (set all tiles to empty) */
export function clearRegion(
  state: EditorState,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      state.setTile(x, y, TILE_EMPTY);
    }
  }
}

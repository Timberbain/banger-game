/**
 * Arena validation: connectivity, spawn clearance, perimeter integrity.
 * Runs after every edit (debounced).
 */

import { EditorState, TILE_EMPTY } from './EditorState';

export interface ValidationResult {
  perimeter: boolean;
  connectivity: boolean;
  spawns: { placed: number; total: 3; clearance: boolean };
  unreachableCells: Set<number>;
}

/** Check all border cells are solid */
function validatePerimeter(state: EditorState): boolean {
  const { width, height, logicalGrid } = state;
  for (let x = 0; x < width; x++) {
    if (!EditorState.isSolid(logicalGrid[x])) return false;
    if (!EditorState.isSolid(logicalGrid[(height - 1) * width + x])) return false;
  }
  for (let y = 0; y < height; y++) {
    if (!EditorState.isSolid(logicalGrid[y * width])) return false;
    if (!EditorState.isSolid(logicalGrid[y * width + (width - 1)])) return false;
  }
  return true;
}

/** BFS flood fill from first empty cell, return set of reached indices */
function floodFill(state: EditorState): { reached: Set<number>; totalOpen: number } {
  const { width, height, logicalGrid } = state;
  const reached = new Set<number>();
  let totalOpen = 0;
  let start = -1;

  for (let i = 0; i < logicalGrid.length; i++) {
    if (logicalGrid[i] === TILE_EMPTY) {
      totalOpen++;
      if (start === -1) start = i;
    }
  }

  if (start === -1) return { reached, totalOpen: 0 };

  const queue = [start];
  reached.add(start);

  while (queue.length > 0) {
    const idx = queue.shift()!;
    const x = idx % width;
    const y = Math.floor(idx / width);

    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nidx = ny * width + nx;
      if (!reached.has(nidx) && logicalGrid[nidx] === TILE_EMPTY) {
        reached.add(nidx);
        queue.push(nidx);
      }
    }
  }

  return { reached, totalOpen };
}

/** Check 3x3 clearance around a spawn tile */
function checkSpawnClearance(state: EditorState, sx: number, sy: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tile = state.getTile(sx + dx, sy + dy);
      if (EditorState.isSolid(tile)) return false;
    }
  }
  return true;
}

/** Run all validations and return results */
export function validate(state: EditorState): ValidationResult {
  const perimeter = validatePerimeter(state);

  const { reached, totalOpen } = floodFill(state);
  const connectivity = reached.size === totalOpen;

  // Find unreachable empty cells
  const unreachableCells = new Set<number>();
  if (!connectivity) {
    const { logicalGrid } = state;
    for (let i = 0; i < logicalGrid.length; i++) {
      if (logicalGrid[i] === TILE_EMPTY && !reached.has(i)) {
        unreachableCells.add(i);
      }
    }
  }

  const { spawnPoints } = state;
  let placed = 0;
  let allClear = true;
  if (spawnPoints.paran) {
    placed++;
    if (!checkSpawnClearance(state, spawnPoints.paran.x, spawnPoints.paran.y)) allClear = false;
  }
  if (spawnPoints.guardian1) {
    placed++;
    if (!checkSpawnClearance(state, spawnPoints.guardian1.x, spawnPoints.guardian1.y))
      allClear = false;
  }
  if (spawnPoints.guardian2) {
    placed++;
    if (!checkSpawnClearance(state, spawnPoints.guardian2.x, spawnPoints.guardian2.y))
      allClear = false;
  }

  return {
    perimeter,
    connectivity,
    spawns: { placed, total: 3, clearance: allClear },
    unreachableCells,
  };
}

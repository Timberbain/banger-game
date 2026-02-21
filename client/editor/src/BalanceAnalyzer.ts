/**
 * Balance analysis functions for arena overlays.
 * All functions operate on the logical grid and are pure/cacheable.
 */

import { EditorState } from './EditorState';

export interface SpawnDistances {
  paran: number;
  guardian1: number;
  guardian2: number;
}

/**
 * BFS flood fill from each spawn point.
 * Returns tile index → distances from each spawn.
 */
export function computeSpawnDistances(
  grid: number[],
  width: number,
  height: number,
  spawns: {
    paran: { x: number; y: number } | null;
    guardian1: { x: number; y: number } | null;
    guardian2: { x: number; y: number } | null;
  },
): Map<number, SpawnDistances> {
  const result = new Map<number, SpawnDistances>();

  function bfs(start: { x: number; y: number } | null): Int32Array {
    const dist = new Int32Array(width * height).fill(-1);
    if (!start) return dist;

    const queue: number[] = [];
    const startIdx = start.y * width + start.x;
    dist[startIdx] = 0;
    queue.push(startIdx);

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const x = idx % width;
      const y = Math.floor(idx / width);
      const d = dist[idx];

      const neighbors = [
        { nx: x - 1, ny: y },
        { nx: x + 1, ny: y },
        { nx: x, ny: y - 1 },
        { nx: x, ny: y + 1 },
      ];

      for (const { nx, ny } of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (dist[nIdx] !== -1) continue;
        if (EditorState.isSolid(grid[nIdx])) continue;
        dist[nIdx] = d + 1;
        queue.push(nIdx);
      }
    }

    return dist;
  }

  const paranDist = bfs(spawns.paran);
  const g1Dist = bfs(spawns.guardian1);
  const g2Dist = bfs(spawns.guardian2);

  for (let i = 0; i < width * height; i++) {
    if (EditorState.isSolid(grid[i])) continue;
    const p = paranDist[i] === -1 ? 999 : paranDist[i];
    const g1 = g1Dist[i] === -1 ? 999 : g1Dist[i];
    const g2 = g2Dist[i] === -1 ? 999 : g2Dist[i];
    result.set(i, { paran: p, guardian1: g1, guardian2: g2 });
  }

  return result;
}

/**
 * For each open tile, count solid tiles within Manhattan distance 3.
 * Returns Float32Array normalized to [0,1] where 1 = maximum cover.
 */
export function computeCoverDensity(grid: number[], width: number, height: number): Float32Array {
  const result = new Float32Array(width * height).fill(-1);
  const radius = 3;
  // Max possible neighbors in Manhattan distance 3: (2*3+1)^2 area minus 4 corners ≈ 24
  // Actually: sum of (2*k+1) for k=0..3 = 1+3+5+7 ... nope, it's the diamond shape
  // Manhattan dist <= 3: count = 1 + 4*1 + 4*2 + 4*3 = 25 tiles total, minus center = 24 neighbors
  const maxNeighbors = 24;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (EditorState.isSolid(grid[idx])) continue;

      let solidCount = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (Math.abs(dx) + Math.abs(dy) > radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            solidCount++; // Out of bounds counts as solid
            continue;
          }
          if (EditorState.isSolid(grid[ny * width + nx])) solidCount++;
        }
      }

      result[idx] = solidCount / maxNeighbors;
    }
  }

  return result;
}

/**
 * Bresenham raycast from spawn in 360 directions (every 1 degree).
 * Returns Set of tile indices with unobstructed line-of-sight.
 */
export function computeSightlines(
  grid: number[],
  width: number,
  height: number,
  spawnX: number,
  spawnY: number,
): Set<number> {
  const visible = new Set<number>();
  visible.add(spawnY * width + spawnX);

  for (let angle = 0; angle < 360; angle++) {
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    // Walk along ray
    let fx = spawnX + 0.5;
    let fy = spawnY + 0.5;
    const maxDist = Math.max(width, height);

    for (let step = 0; step < maxDist; step++) {
      fx += dx;
      fy += dy;
      const tx = Math.floor(fx);
      const ty = Math.floor(fy);

      if (tx < 0 || tx >= width || ty < 0 || ty >= height) break;

      const idx = ty * width + tx;
      if (EditorState.isSolid(grid[idx])) break;
      visible.add(idx);
    }
  }

  return visible;
}

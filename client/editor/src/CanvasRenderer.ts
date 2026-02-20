/**
 * Renders the arena tile map on an HTML Canvas with zoom, pan, grid overlays,
 * collision visualization, spawn markers, and cursor preview.
 */

import { TilesetAtlas } from './TilesetAtlas';
import {
  isWallCanopy,
  isRockCanopy,
  getTileCollisionShape,
  type CollisionShape,
} from '../../../shared/tileRegistry';

export interface SpawnOverlay {
  x: number;
  y: number;
  role: string;
  color: string;
}

export interface RenderOverlays {
  spawns: SpawnOverlay[];
  invalidCells: Set<number>;
  cursor: { x: number; y: number; tool: string } | null;
}

export interface MapLayers {
  ground: number[];
  wallFronts: number[];
  walls: number[];
}

/** Fallback fill color when no bitmap is available */
function fallbackColor(tileId: number, layerHint: 'ground' | 'wall'): string {
  if (layerHint === 'ground') {
    const greens = ['#2D5A27', '#3A6B34', '#346330', '#2F5E2B'];
    return greens[tileId % greens.length];
  }
  // Wall canopy (any theme)
  if (isWallCanopy(tileId)) return '#1A3A1A';
  // Rock canopy (heavy=dark, medium=mid, light=light)
  if (tileId >= 289 && tileId <= 291) return '#3B2716'; // heavy
  if (tileId >= 292 && tileId <= 294) return '#5C3A1E'; // medium
  if (tileId >= 295 && tileId <= 296) return '#A08060'; // light
  return '#1A3A1A';
}

export class CanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly atlas: TilesetAtlas;
  readonly TILE_SIZE = 32;

  zoom = 1.0;
  panX = 0;
  panY = 0;
  showGrid = true;
  showCollision = false;
  collisionOverrides: Map<string, CollisionShape> = new Map();

  constructor(canvas: HTMLCanvasElement, atlas: TilesetAtlas) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.atlas = atlas;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = false;
  }

  setZoom(z: number): void {
    this.zoom = Math.max(0.25, Math.min(4.0, z));
  }

  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  screenToTile(sx: number, sy: number): { x: number; y: number } {
    const worldX = (sx - this.panX) / this.zoom;
    const worldY = (sy - this.panY) / this.zoom;
    return {
      x: Math.floor(worldX / this.TILE_SIZE),
      y: Math.floor(worldY / this.TILE_SIZE),
    };
  }

  render(layers: MapLayers, w: number, h: number, overlays: RenderOverlays): void {
    const { ctx, canvas, zoom, panX, panY, TILE_SIZE } = this;

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0A140D';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera transform
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, panX, panY);
    ctx.imageSmoothingEnabled = false;

    // Frustum culling: visible tile range
    const vpLeft = -panX / zoom;
    const vpTop = -panY / zoom;
    const vpRight = (canvas.width - panX) / zoom;
    const vpBottom = (canvas.height - panY) / zoom;

    const tileMinX = Math.max(0, Math.floor(vpLeft / TILE_SIZE));
    const tileMinY = Math.max(0, Math.floor(vpTop / TILE_SIZE));
    const tileMaxX = Math.min(w - 1, Math.floor(vpRight / TILE_SIZE));
    const tileMaxY = Math.min(h - 1, Math.floor(vpBottom / TILE_SIZE));

    // Layer rendering helper
    const drawLayer = (data: number[], layerHint: 'ground' | 'wall') => {
      for (let ty = tileMinY; ty <= tileMaxY; ty++) {
        for (let tx = tileMinX; tx <= tileMaxX; tx++) {
          const tileId = data[ty * w + tx];
          if (tileId <= 0) continue;

          const px = tx * TILE_SIZE;
          const py = ty * TILE_SIZE;
          const bitmap = this.atlas.getTile(tileId);
          if (bitmap) {
            ctx.drawImage(bitmap, px, py, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = fallbackColor(tileId, layerHint);
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    };

    // Render layers bottom-to-top
    drawLayer(layers.ground, 'ground');
    drawLayer(layers.wallFronts, 'wall');
    drawLayer(layers.walls, 'wall');

    // Grid overlay
    if (this.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (let tx = tileMinX; tx <= tileMaxX + 1; tx++) {
        const px = tx * TILE_SIZE;
        ctx.moveTo(px, tileMinY * TILE_SIZE);
        ctx.lineTo(px, (tileMaxY + 1) * TILE_SIZE);
      }
      for (let ty = tileMinY; ty <= tileMaxY + 1; ty++) {
        const py = ty * TILE_SIZE;
        ctx.moveTo(tileMinX * TILE_SIZE, py);
        ctx.lineTo((tileMaxX + 1) * TILE_SIZE, py);
      }
      ctx.stroke();
    }

    // Collision overlay with actual bounding boxes
    if (this.showCollision) {
      ctx.fillStyle = 'rgba(255, 40, 40, 0.35)';
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.6)';
      ctx.lineWidth = 1 / zoom;
      for (let ty = tileMinY; ty <= tileMaxY; ty++) {
        for (let tx = tileMinX; tx <= tileMaxX; tx++) {
          const tileId = layers.walls[ty * w + tx];
          if (isWallCanopy(tileId) || isRockCanopy(tileId)) {
            // Check for per-tile collision override, fall back to registry default
            const key = String(tileId);
            const shape = this.collisionOverrides.get(key) || getTileCollisionShape(tileId);
            const px = tx * TILE_SIZE + shape.x;
            const py = ty * TILE_SIZE + shape.y;
            ctx.fillRect(px, py, shape.w, shape.h);
            ctx.strokeRect(px, py, shape.w, shape.h);
          }
        }
      }
    }

    // Spawn markers
    if (overlays.spawns.length > 0) {
      const halfTile = TILE_SIZE / 2;
      const radius = TILE_SIZE * 0.4;
      ctx.font = `bold ${Math.round(10 / zoom)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const spawn of overlays.spawns) {
        const cx = spawn.x * TILE_SIZE + halfTile;
        const cy = spawn.y * TILE_SIZE + halfTile;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = spawn.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(spawn.role, cx, cy);
      }
    }

    // Validation highlights (unreachable cells)
    if (overlays.invalidCells.size > 0) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.25)';
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = 2 / zoom;

      for (const cellIndex of overlays.invalidCells) {
        const tx = cellIndex % w;
        const ty = Math.floor(cellIndex / w);
        if (tx >= tileMinX && tx <= tileMaxX && ty >= tileMinY && ty <= tileMaxY) {
          ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          ctx.strokeRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        }
      }
    }

    // Cursor preview (ghost tile)
    if (overlays.cursor) {
      const { x: curX, y: curY, tool } = overlays.cursor;
      if (curX >= 0 && curX < w && curY >= 0 && curY < h) {
        const px = curX * TILE_SIZE;
        const py = curY * TILE_SIZE;

        ctx.globalAlpha = 0.45;
        ctx.fillStyle = tool === 'eraser' ? 'rgba(255, 60, 60, 0.5)' : 'rgba(100, 200, 255, 0.5)';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = tool === 'eraser' ? '#FF4444' : '#66CCFF';
        ctx.lineWidth = 1.5 / zoom;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    ctx.restore();
  }
}

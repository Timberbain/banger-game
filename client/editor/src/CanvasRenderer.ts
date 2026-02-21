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
  mirrorX?: boolean;
  mirrorY?: boolean;
  mirrorCursors?: { x: number; y: number }[];
  selection?: { x1: number; y1: number; x2: number; y2: number } | null;
  pastePreview?: {
    tiles: number[];
    groundOverrides: Map<number, number>;
    width: number;
    height: number;
    originX: number;
    originY: number;
  } | null;
  distances?: Map<number, { paran: number; guardian1: number; guardian2: number }>;
  coverDensity?: Float32Array;
  sightlines?: Set<number>;
  sightlineColor?: string;
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

    // Mirror axis guide lines
    if (overlays.mirrorX || overlays.mirrorY) {
      ctx.save();
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
      ctx.lineWidth = 2 / zoom;

      if (overlays.mirrorX) {
        const mx = (w / 2) * TILE_SIZE;
        ctx.beginPath();
        ctx.moveTo(mx, 0);
        ctx.lineTo(mx, h * TILE_SIZE);
        ctx.stroke();
      }
      if (overlays.mirrorY) {
        const my = (h / 2) * TILE_SIZE;
        ctx.beginPath();
        ctx.moveTo(0, my);
        ctx.lineTo(w * TILE_SIZE, my);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
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

    // Mirror cursor ghosts (dimmer than primary cursor)
    if (overlays.mirrorCursors && overlays.mirrorCursors.length > 0 && overlays.cursor) {
      const tool = overlays.cursor.tool;
      for (const mc of overlays.mirrorCursors) {
        if (mc.x >= 0 && mc.x < w && mc.y >= 0 && mc.y < h) {
          const px = mc.x * TILE_SIZE;
          const py = mc.y * TILE_SIZE;

          ctx.globalAlpha = 0.25;
          ctx.fillStyle = tool === 'eraser' ? 'rgba(255, 60, 60, 0.5)' : 'rgba(100, 200, 255, 0.5)';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.globalAlpha = 0.5;

          ctx.strokeStyle = tool === 'eraser' ? '#FF4444' : '#66CCFF';
          ctx.lineWidth = 1 / zoom;
          ctx.setLineDash([3 / zoom, 3 / zoom]);
          ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1.0;
        }
      }
    }

    // Selection rectangle
    if (overlays.selection) {
      const { x1, y1, x2, y2 } = overlays.selection;
      const sx = Math.min(x1, x2) * TILE_SIZE;
      const sy = Math.min(y1, y2) * TILE_SIZE;
      const sw = (Math.abs(x2 - x1) + 1) * TILE_SIZE;
      const sh = (Math.abs(y2 - y1) + 1) * TILE_SIZE;

      ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
      ctx.fillRect(sx, sy, sw, sh);

      ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);
    }

    // Paste preview
    if (overlays.pastePreview) {
      const { tiles, width: pw, height: ph, originX, originY } = overlays.pastePreview;
      ctx.globalAlpha = 0.5;
      for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
          const tileVal = tiles[py * pw + px];
          if (tileVal === 0) continue;
          const drawX = (originX + px) * TILE_SIZE;
          const drawY = (originY + py) * TILE_SIZE;
          if (tileVal < 0) {
            // Wall sentinel — draw colored block
            ctx.fillStyle = tileVal === -1 ? '#556b2f' : tileVal === -2 ? '#8b5c3a' : '#6b4226';
          } else {
            ctx.fillStyle = '#6688AA';
          }
          ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
        }
      }
      ctx.globalAlpha = 1.0;
      // Outline
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(originX * TILE_SIZE, originY * TILE_SIZE, pw * TILE_SIZE, ph * TILE_SIZE);
    }

    // Balance analysis: distance overlay
    if (overlays.distances) {
      for (let ty = tileMinY; ty <= tileMaxY; ty++) {
        for (let tx = tileMinX; tx <= tileMaxX; tx++) {
          const idx = ty * w + tx;
          const d = overlays.distances.get(idx);
          if (d === undefined) continue;
          const minDist = Math.min(d.paran, d.guardian1, d.guardian2);
          const maxDist = 80;
          const t = Math.min(minDist / maxDist, 1.0);
          // Blue (close) → Red (far)
          const r = Math.floor(t * 255);
          const b = Math.floor((1 - t) * 255);
          ctx.fillStyle = `rgba(${r}, 40, ${b}, 0.3)`;
          ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Balance analysis: cover density overlay
    if (overlays.coverDensity) {
      for (let ty = tileMinY; ty <= tileMaxY; ty++) {
        for (let tx = tileMinX; tx <= tileMaxX; tx++) {
          const idx = ty * w + tx;
          const density = overlays.coverDensity[idx];
          if (density === undefined || density < 0) continue;
          // Green (high cover) → Red (no cover)
          const r = Math.floor((1 - density) * 200);
          const g = Math.floor(density * 200);
          ctx.fillStyle = `rgba(${r}, ${g}, 40, 0.3)`;
          ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Balance analysis: sightline overlay
    if (overlays.sightlines) {
      const sColor = overlays.sightlineColor || '#FFCC00';
      for (let ty = tileMinY; ty <= tileMaxY; ty++) {
        for (let tx = tileMinX; tx <= tileMaxX; tx++) {
          const idx = ty * w + tx;
          if (overlays.sightlines.has(idx)) {
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = sColor;
            ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.globalAlpha = 1.0;
          } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    ctx.restore();
  }
}

/**
 * Collision bounding box editor panel.
 * Right-click a solid tile on the canvas to open the editor.
 * Provides a 128x128 canvas preview (4x zoom of 32x32 tile),
 * drag-to-draw bounding box, and number inputs for x/y/w/h.
 */

import { EditorState } from '../EditorState';
import { TilesetAtlas } from '../TilesetAtlas';
import { getTileCollisionShape, type CollisionShape } from '../../../../shared/tileRegistry';

const PREVIEW_SIZE = 128;
const TILE_SIZE = 32;
const SCALE = PREVIEW_SIZE / TILE_SIZE; // 4x

export class CollisionEditor {
  private state: EditorState;
  private atlas: TilesetAtlas;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private section: HTMLElement;
  private tileIdLabel: HTMLElement;
  private inputX: HTMLInputElement;
  private inputY: HTMLInputElement;
  private inputW: HTMLInputElement;
  private inputH: HTMLInputElement;

  private currentTileId = 0;
  private currentKey = ''; // tileId string key for collisionOverrides
  private shape: CollisionShape = { x: 0, y: 0, w: 32, h: 32 };
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  private onChange: () => void;

  constructor(state: EditorState, atlas: TilesetAtlas, onChange: () => void) {
    this.state = state;
    this.atlas = atlas;
    this.onChange = onChange;

    this.section = document.getElementById('collision-editor-section')!;
    this.canvas = document.getElementById('collision-preview') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.tileIdLabel = document.getElementById('col-tile-id')!;
    this.inputX = document.getElementById('col-x') as HTMLInputElement;
    this.inputY = document.getElementById('col-y') as HTMLInputElement;
    this.inputW = document.getElementById('col-w') as HTMLInputElement;
    this.inputH = document.getElementById('col-h') as HTMLInputElement;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Number inputs
    for (const input of [this.inputX, this.inputY, this.inputW, this.inputH]) {
      input.addEventListener('input', () => this.onInputChange());
    }

    // Reset button
    document.getElementById('col-reset')!.addEventListener('click', () => {
      this.shape = { ...getTileCollisionShape(this.currentTileId) };
      this.state.collisionOverrides.delete(this.currentKey);
      this.syncInputs();
      this.drawPreview();
      this.onChange();
    });

    // Canvas drag interaction
    this.canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.onCanvasMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.onCanvasMouseUp());
  }

  /** Open the editor for a specific tile ID (from resolved walls layer) */
  open(tileId: number): void {
    if (tileId <= 0) {
      this.close();
      return;
    }

    this.currentTileId = tileId;
    this.currentKey = String(tileId);
    this.tileIdLabel.textContent = `Tile #${tileId}`;

    // Load existing override or default
    const override = this.state.collisionOverrides.get(this.currentKey);
    if (override) {
      this.shape = { ...override };
    } else {
      this.shape = { ...getTileCollisionShape(tileId) };
    }

    this.syncInputs();
    this.drawPreview();
    this.section.classList.remove('hidden');
  }

  close(): void {
    this.section.classList.add('hidden');
  }

  isOpen(): boolean {
    return !this.section.classList.contains('hidden');
  }

  private onInputChange(): void {
    this.shape.x = this.clamp(Number(this.inputX.value), 0, TILE_SIZE);
    this.shape.y = this.clamp(Number(this.inputY.value), 0, TILE_SIZE);
    this.shape.w = this.clamp(Number(this.inputW.value), 0, TILE_SIZE - this.shape.x);
    this.shape.h = this.clamp(Number(this.inputH.value), 0, TILE_SIZE - this.shape.y);
    this.applyOverride();
    this.drawPreview();
  }

  private onCanvasMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    const rect = this.canvas.getBoundingClientRect();
    this.dragStartX = Math.floor(((e.clientX - rect.left) / rect.width) * TILE_SIZE);
    this.dragStartY = Math.floor(((e.clientY - rect.top) / rect.height) * TILE_SIZE);
  }

  private onCanvasMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = Math.floor(((e.clientX - rect.left) / rect.width) * TILE_SIZE);
    const my = Math.floor(((e.clientY - rect.top) / rect.height) * TILE_SIZE);

    const x1 = this.clamp(Math.min(this.dragStartX, mx), 0, TILE_SIZE);
    const y1 = this.clamp(Math.min(this.dragStartY, my), 0, TILE_SIZE);
    const x2 = this.clamp(Math.max(this.dragStartX, mx), 0, TILE_SIZE);
    const y2 = this.clamp(Math.max(this.dragStartY, my), 0, TILE_SIZE);

    this.shape = {
      x: x1,
      y: y1,
      w: Math.max(1, x2 - x1),
      h: Math.max(1, y2 - y1),
    };

    this.syncInputs();
    this.drawPreview();
  }

  private onCanvasMouseUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.applyOverride();
    }
  }

  private applyOverride(): void {
    const defaultShape = getTileCollisionShape(this.currentTileId);
    // Only store override if different from default
    if (
      this.shape.x === defaultShape.x &&
      this.shape.y === defaultShape.y &&
      this.shape.w === defaultShape.w &&
      this.shape.h === defaultShape.h
    ) {
      this.state.collisionOverrides.delete(this.currentKey);
    } else {
      this.state.collisionOverrides.set(this.currentKey, { ...this.shape });
    }
    this.onChange();
  }

  private syncInputs(): void {
    this.inputX.value = String(this.shape.x);
    this.inputY.value = String(this.shape.y);
    this.inputW.value = String(this.shape.w);
    this.inputH.value = String(this.shape.h);
  }

  private drawPreview(): void {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;

    // Clear
    ctx.fillStyle = '#0A140D';
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Draw checkerboard background to show transparency
    const checkSize = 8;
    for (let cy = 0; cy < PREVIEW_SIZE; cy += checkSize) {
      for (let cx = 0; cx < PREVIEW_SIZE; cx += checkSize) {
        const isLight = (cx / checkSize + cy / checkSize) % 2 === 0;
        ctx.fillStyle = isLight ? '#1a2a1a' : '#142014';
        ctx.fillRect(cx, cy, checkSize, checkSize);
      }
    }

    // Draw tile sprite at 4x zoom
    const bitmap = this.atlas.getTile(this.currentTileId);
    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    }

    // Draw collision rect overlay
    ctx.fillStyle = 'rgba(255, 40, 40, 0.3)';
    ctx.fillRect(
      this.shape.x * SCALE,
      this.shape.y * SCALE,
      this.shape.w * SCALE,
      this.shape.h * SCALE,
    );
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.shape.x * SCALE,
      this.shape.y * SCALE,
      this.shape.w * SCALE,
      this.shape.h * SCALE,
    );
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }
}

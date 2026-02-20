/**
 * Tile palette UI: tool selection + ground sub-palette with visual previews.
 * Ground tiles are theme-aware and include plain colors + extra floors.
 */

import { EditorState, type Tool } from '../EditorState';
import { TilesetAtlas } from '../TilesetAtlas';
import {
  getFloorIds,
  getDecoIds,
  TILE_RANGES,
  type WallTheme,
} from '../../../../shared/tileRegistry';

const ALL_THEMES: WallTheme[] = ['hedge', 'brick', 'wood'];

/** Build ground tile IDs from ALL themes (mixed walls = all grounds available) */
function getGroundTileIds(): number[] {
  const ids: number[] = [];

  // All theme-specific floors + decos
  for (const theme of ALL_THEMES) {
    ids.push(...getFloorIds(theme));
    ids.push(...getDecoIds(theme));
  }

  // Plain color tiles (329-334)
  for (let id = TILE_RANGES.PLAIN_COLOR.min; id <= TILE_RANGES.PLAIN_COLOR.max; id++) {
    ids.push(id);
  }

  // Extra floor tiles (337-352)
  for (let id = TILE_RANGES.EXTRA_FLOOR.min; id <= TILE_RANGES.EXTRA_FLOOR.max; id++) {
    ids.push(id);
  }

  return ids;
}

export class TilePalette {
  private state: EditorState;
  private atlas: TilesetAtlas;

  constructor(state: EditorState, atlas: TilesetAtlas) {
    this.state = state;
    this.atlas = atlas;
    this.bindToolButtons();
    this.buildGroundPalette();
  }

  private bindToolButtons(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.palette-btn[data-tool]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool as Tool;
        this.state.currentTool = tool;
        this.updateActiveButton();
        this.updateStatusTool();
      });
    });
  }

  updateActiveButton(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.palette-btn[data-tool]');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === this.state.currentTool);
    });
  }

  private updateStatusTool(): void {
    const toolNames: Record<string, string> = {
      'wall-hedge': 'Hedge Wall',
      'wall-brick': 'Brick Wall',
      'wall-wood': 'Wood Wall',
      heavy: 'Heavy Obstacle',
      medium: 'Medium Obstacle',
      light: 'Light Obstacle',
      eraser: 'Eraser',
      ground: 'Ground',
      'spawn-paran': 'Paran Spawn',
      'spawn-guardian1': 'Guardian 1 Spawn',
      'spawn-guardian2': 'Guardian 2 Spawn',
    };
    document.getElementById('status-tool')!.textContent =
      `Tool: ${toolNames[this.state.currentTool] || this.state.currentTool}`;
  }

  buildGroundPalette(): void {
    const container = document.getElementById('ground-palette')!;
    container.innerHTML = '';

    const tileIds = getGroundTileIds();

    for (const tileId of tileIds) {
      const btn = document.createElement('button');
      btn.className = 'ground-btn';
      btn.title = `Ground tile ${tileId}`;
      btn.dataset.groundId = String(tileId);

      // Draw tile preview on a small canvas
      const preview = document.createElement('canvas');
      preview.width = 32;
      preview.height = 32;
      const ctx = preview.getContext('2d')!;

      const bitmap = this.atlas.getTile(tileId);
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, 32, 32);
      } else {
        // Fallback color
        ctx.fillStyle = '#3a5a2a';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(tileId), 16, 20);
      }

      btn.style.backgroundImage = `url(${preview.toDataURL()})`;

      if (tileId === this.state.selectedGroundTile) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        this.state.currentTool = 'ground';
        this.state.selectedGroundTile = tileId;
        container.querySelectorAll('.ground-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateActiveButton();
        this.updateStatusTool();
      });

      container.appendChild(btn);
    }
  }
}

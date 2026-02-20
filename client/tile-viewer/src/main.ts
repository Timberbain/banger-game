import {
  buildTileRegistry,
  TILESET_COLUMNS,
  TILESET_ROWS,
  TILE_RANGES,
} from '../../../shared/tileRegistry';

// ============================================================
// Constants
// ============================================================

const TILE_SIZE = 32;

// ============================================================
// DOM refs
// ============================================================

const viewport = document.getElementById('viewport')!;
const canvas = document.getElementById('viewer-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const gridCheckbox = document.getElementById('chk-grid') as HTMLInputElement;
const collisionCheckbox = document.getElementById('chk-collision') as HTMLInputElement;

const infoTileId = document.getElementById('info-tile-id')!;
const infoTilePos = document.getElementById('info-tile-pos')!;
const infoTileRange = document.getElementById('info-tile-range')!;
const infoTileHeader = document.querySelector(
  '#info-panel .info-section:nth-child(2) .info-header',
)!;

const infoCategory = document.getElementById('info-category')!;
const infoSolid = document.getElementById('info-solid')!;
const infoDestructible = document.getElementById('info-destructible')!;
const infoHp = document.getElementById('info-hp')!;
const infoCollision = document.getElementById('info-collision')!;
const infoTheme = document.getElementById('info-theme')!;

const btnFit = document.getElementById('btn-fit') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const selRange = document.getElementById('sel-range') as HTMLSelectElement;
const btnCopyTile = document.getElementById('btn-copy-tile') as HTMLButtonElement;

const statusTile = document.getElementById('status-tile')!;
const statusZoom = document.getElementById('status-zoom')!;

// ============================================================
// State
// ============================================================

const registry = buildTileRegistry();
let tilesetImg: HTMLImageElement | null = null;
let hoverCol = -1;
let hoverRow = -1;
let bgColor: string | null = null; // null = transparent/checkerboard

let zoom = 1.0;
let panX = 0;
let panY = 0;

let isPanning = false;
let panStartX = 0;
let panStartY = 0;

let spaceDown = false;
let pinnedCol = -1;
let pinnedRow = -1;

// ============================================================
// Zoom / pan helpers
// ============================================================

function setZoom(z: number): void {
  zoom = Math.max(0.25, Math.min(4.0, z));
}

function updateZoomStatus(): void {
  statusZoom.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
}

function screenToTile(sx: number, sy: number): { col: number; row: number } {
  const worldX = (sx - panX) / zoom;
  const worldY = (sy - panY) / zoom;
  return {
    col: Math.floor(worldX / TILE_SIZE),
    row: Math.floor(worldY / TILE_SIZE),
  };
}

function fitToView(): void {
  const tilesetW = TILESET_COLUMNS * TILE_SIZE;
  const tilesetH = TILESET_ROWS * TILE_SIZE;
  const margin = 20;
  const fitZoom = Math.min(
    (canvas.width - margin * 2) / tilesetW,
    (canvas.height - margin * 2) / tilesetH,
  );
  setZoom(fitZoom);
  panX = (canvas.width - tilesetW * zoom) / 2;
  panY = (canvas.height - tilesetH * zoom) / 2;
  updateZoomStatus();
  render();
}

function resetZoom(): void {
  zoom = 1.0;
  panX = 0;
  panY = 0;
  updateZoomStatus();
  render();
}

function zoomTowardCenter(factor: number): void {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const oldZoom = zoom;
  setZoom(oldZoom * factor);
  panX = cx - (cx - panX) * (zoom / oldZoom);
  panY = cy - (cy - panY) * (zoom / oldZoom);
  updateZoomStatus();
  render();
}

// ============================================================
// Pin helpers
// ============================================================

function isPinned(): boolean {
  return pinnedCol >= 0 && pinnedRow >= 0;
}

function unpinTile(): void {
  pinnedCol = -1;
  pinnedRow = -1;
  infoTileHeader.textContent = 'Tile';
  infoTileHeader.classList.remove('pinned');
  // Refresh info to show hovered tile if any
  if (hoverCol >= 0 && hoverCol < TILESET_COLUMNS && hoverRow >= 0 && hoverRow < TILESET_ROWS) {
    updateTileInfo(hoverCol, hoverRow);
  } else {
    clearTileInfo();
  }
  updateCopyButton();
  render();
}

function pinTile(col: number, row: number): void {
  pinnedCol = col;
  pinnedRow = row;
  infoTileHeader.textContent = 'Tile (pinned)';
  infoTileHeader.classList.add('pinned');
  updateTileInfo(col, row);
  updateCopyButton();
  render();
}

function updateCopyButton(): void {
  const hasTarget =
    isPinned() ||
    (hoverCol >= 0 && hoverCol < TILESET_COLUMNS && hoverRow >= 0 && hoverRow < TILESET_ROWS);
  btnCopyTile.disabled = !hasTarget;
}

// ============================================================
// Range jump
// ============================================================

function jumpToRange(rangeName: string): void {
  const range = TILE_RANGES[rangeName as keyof typeof TILE_RANGES];
  if (!range) return;

  const startRow = Math.floor((range.min - 1) / TILESET_COLUMNS);
  const endRow = Math.floor((range.max - 1) / TILESET_COLUMNS);
  const y1 = startRow * TILE_SIZE;
  const y2 = (endRow + 1) * TILE_SIZE;
  const x1 = 0;
  const x2 = TILESET_COLUMNS * TILE_SIZE;
  const regionW = x2 - x1;
  const regionH = y2 - y1;

  const margin = 40;
  const fitZoom = Math.min(
    (canvas.width - margin * 2) / regionW,
    (canvas.height - margin * 2) / regionH,
  );
  setZoom(fitZoom);

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  panX = canvas.width / 2 - centerX * zoom;
  panY = canvas.height / 2 - centerY * zoom;

  updateZoomStatus();
  render();
}

// ============================================================
// Canvas resize
// ============================================================

function resizeCanvas(): void {
  const rect = viewport.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  render();
}

// ============================================================
// Range name lookup
// ============================================================

function getRangeName(tileId: number): string {
  for (const [name, range] of Object.entries(TILE_RANGES)) {
    if (tileId >= range.min && tileId <= range.max) {
      return `${name} (${range.min}-${range.max})`;
    }
  }
  return '--';
}

// ============================================================
// Tileset loading
// ============================================================

function loadTileset(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = '../tilesets/arena_unified.png';
  });
}

// ============================================================
// Rendering
// ============================================================

function render(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fill background at identity transform (covers full canvas)
  if (bgColor === null) {
    const checkSize = 8;
    for (let y = 0; y < canvas.height; y += checkSize) {
      for (let x = 0; x < canvas.width; x += checkSize) {
        ctx.fillStyle = (x / checkSize + y / checkSize) % 2 === 0 ? '#555' : '#888';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Apply zoom + pan transform for tileset content
  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, panX, panY);

  // Draw the entire tileset image
  if (tilesetImg) {
    ctx.drawImage(tilesetImg, 0, 0);
  }

  // Collision overlay
  if (collisionCheckbox.checked) {
    registry.forEach((props, tileId) => {
      if (!props.solid) return;
      const index = tileId - 1;
      const col = index % TILESET_COLUMNS;
      const row = Math.floor(index / TILESET_COLUMNS);
      const shape = props.collisionShape;
      ctx.fillStyle = 'rgba(204, 51, 51, 0.3)';
      ctx.fillRect(col * TILE_SIZE + shape.x, row * TILE_SIZE + shape.y, shape.w, shape.h);
    });
  }

  // Grid overlay
  if (gridCheckbox.checked) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1 / zoom;
    const tilesetW = TILESET_COLUMNS * TILE_SIZE;
    const tilesetH = TILESET_ROWS * TILE_SIZE;
    for (let col = 0; col <= TILESET_COLUMNS; col++) {
      ctx.beginPath();
      ctx.moveTo(col * TILE_SIZE + 0.5 / zoom, 0);
      ctx.lineTo(col * TILE_SIZE + 0.5 / zoom, tilesetH);
      ctx.stroke();
    }
    for (let row = 0; row <= TILESET_ROWS; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * TILE_SIZE + 0.5 / zoom);
      ctx.lineTo(tilesetW, row * TILE_SIZE + 0.5 / zoom);
      ctx.stroke();
    }
  }

  // Pinned tile highlight (dashed gold-gleam border)
  if (isPinned()) {
    ctx.strokeStyle = '#f2da78';
    ctx.lineWidth = 3 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeRect(
      pinnedCol * TILE_SIZE + 1,
      pinnedRow * TILE_SIZE + 1,
      TILE_SIZE - 2,
      TILE_SIZE - 2,
    );
    ctx.setLineDash([]);
  }

  // Hover highlight
  if (hoverCol >= 0 && hoverCol < TILESET_COLUMNS && hoverRow >= 0 && hoverRow < TILESET_ROWS) {
    // Gold border
    ctx.strokeStyle = '#d4a84a';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(
      hoverCol * TILE_SIZE + 1,
      hoverRow * TILE_SIZE + 1,
      TILE_SIZE - 2,
      TILE_SIZE - 2,
    );

    // Collision shape fill for solid tiles
    const tileId = hoverRow * TILESET_COLUMNS + hoverCol + 1;
    const props = registry.get(tileId);
    if (props?.solid) {
      const shape = props.collisionShape;
      ctx.fillStyle = 'rgba(212, 168, 74, 0.25)';
      ctx.fillRect(
        hoverCol * TILE_SIZE + shape.x,
        hoverRow * TILE_SIZE + shape.y,
        shape.w,
        shape.h,
      );
    }
  }

  ctx.restore();
}

// ============================================================
// Info panel updates
// ============================================================

function setBoolClass(el: HTMLElement, value: boolean): void {
  el.textContent = String(value);
  el.className = value ? 'val-true' : 'val-false';
}

function updateTileInfo(col: number, row: number): void {
  const tileId = row * TILESET_COLUMNS + col + 1;

  infoTileId.textContent = String(tileId);
  infoTilePos.textContent = `col ${col}, row ${row}`;
  infoTileRange.textContent = getRangeName(tileId);

  const props = registry.get(tileId);
  if (props) {
    infoCategory.textContent = props.category;
    setBoolClass(infoSolid, props.solid);
    setBoolClass(infoDestructible, props.destructible);
    infoHp.textContent = props.hp > 0 ? String(props.hp) : '--';
    const s = props.collisionShape;
    infoCollision.textContent = `${s.x},${s.y} ${s.w}x${s.h}`;
    infoTheme.textContent = props.theme ?? '--';
  } else {
    infoCategory.textContent = '--';
    infoSolid.textContent = '--';
    infoSolid.className = '';
    infoDestructible.textContent = '--';
    infoDestructible.className = '';
    infoHp.textContent = '--';
    infoCollision.textContent = '--';
    infoTheme.textContent = '--';
  }

  statusTile.textContent = `Tile ${tileId} — col ${col}, row ${row} — ${getRangeName(tileId)}`;
}

function clearTileInfo(): void {
  infoTileId.textContent = '--';
  infoTilePos.textContent = '--';
  infoTileRange.textContent = '--';
  infoCategory.textContent = '--';
  infoSolid.textContent = '--';
  infoSolid.className = '';
  infoDestructible.textContent = '--';
  infoDestructible.className = '';
  infoHp.textContent = '--';
  infoCollision.textContent = '--';
  infoTheme.textContent = '--';
  statusTile.textContent = 'Hover over a tile';
}

// ============================================================
// Copy tile info
// ============================================================

function copyTileInfo(): void {
  const col = isPinned() ? pinnedCol : hoverCol;
  const row = isPinned() ? pinnedRow : hoverRow;
  if (col < 0 || col >= TILESET_COLUMNS || row < 0 || row >= TILESET_ROWS) return;

  const tileId = row * TILESET_COLUMNS + col + 1;
  const text = `Tile ${tileId} (col ${col}, row ${row})`;
  navigator.clipboard.writeText(text).then(() => {
    btnCopyTile.textContent = 'Copied!';
    btnCopyTile.classList.add('copied');
    setTimeout(() => {
      btnCopyTile.textContent = 'Copy';
      btnCopyTile.classList.remove('copied');
    }, 1500);
  });
}

// ============================================================
// Event handlers
// ============================================================

// Wheel zoom (zoom towards cursor)
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const oldZoom = zoom;
    const delta = e.deltaY > 0 ? 0.97 : 1.03;
    setZoom(oldZoom * delta);

    panX = sx - (sx - panX) * (zoom / oldZoom);
    panY = sy - (sy - panY) * (zoom / oldZoom);

    updateZoomStatus();
    render();
  },
  { passive: false },
);

// Mouse down: middle-mouse pan, space+left pan, or left-click pin
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 1) {
    // Middle-mouse pan
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    e.preventDefault();
  } else if (e.button === 0 && spaceDown) {
    // Space + left-drag pan
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  } else if (e.button === 0 && !spaceDown) {
    // Left-click: pin/unpin tile
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { col, row } = screenToTile(sx, sy);

    if (col >= 0 && col < TILESET_COLUMNS && row >= 0 && row < TILESET_ROWS) {
      if (isPinned() && pinnedCol === col && pinnedRow === row) {
        unpinTile();
      } else {
        pinTile(col, row);
      }
    }
  }
});

// Global mousemove for panning
window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  panX += e.clientX - panStartX;
  panY += e.clientY - panStartY;
  panStartX = e.clientX;
  panStartY = e.clientY;
  render();
});

// Global mouseup to end panning
window.addEventListener('mouseup', (e) => {
  if (e.button === 1 && isPanning) {
    isPanning = false;
  } else if (e.button === 0 && isPanning) {
    isPanning = false;
    canvas.style.cursor = spaceDown ? 'grab' : '';
  }
});

// Tile hover (updates highlight always; info panel only when unpinned)
canvas.addEventListener('mousemove', (e) => {
  if (isPanning) return;
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const { col, row } = screenToTile(sx, sy);

  if (col !== hoverCol || row !== hoverRow) {
    hoverCol = col;
    hoverRow = row;

    if (!isPinned()) {
      if (col >= 0 && col < TILESET_COLUMNS && row >= 0 && row < TILESET_ROWS) {
        updateTileInfo(col, row);
      } else {
        clearTileInfo();
      }
      updateCopyButton();
    }

    render();
  }
});

canvas.addEventListener('mouseleave', () => {
  hoverCol = -1;
  hoverRow = -1;
  if (!isPinned()) {
    clearTileInfo();
    updateCopyButton();
  }
  render();
});

gridCheckbox.addEventListener('change', () => {
  render();
});

collisionCheckbox.addEventListener('change', () => {
  render();
});

// ============================================================
// Keyboard handler
// ============================================================

window.addEventListener('keydown', (e) => {
  // Don't intercept keys when typing in inputs/selects
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement ||
    e.target instanceof HTMLTextAreaElement
  ) {
    return;
  }

  switch (e.key) {
    case ' ':
      if (!e.repeat) {
        spaceDown = true;
        canvas.style.cursor = 'grab';
      }
      e.preventDefault();
      break;
    case '+':
    case '=':
      zoomTowardCenter(1.15);
      e.preventDefault();
      break;
    case '-':
      zoomTowardCenter(1 / 1.15);
      e.preventDefault();
      break;
    case 'f':
    case 'F':
      fitToView();
      e.preventDefault();
      break;
    case '0':
      resetZoom();
      e.preventDefault();
      break;
    case 'Escape':
      if (isPinned()) {
        unpinTile();
        e.preventDefault();
      }
      break;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    spaceDown = false;
    if (!isPanning) {
      canvas.style.cursor = '';
    }
  }
});

// ============================================================
// Toolbar button handlers
// ============================================================

btnFit.addEventListener('click', fitToView);
btnReset.addEventListener('click', resetZoom);
btnCopyTile.addEventListener('click', copyTileInfo);

selRange.addEventListener('change', () => {
  const val = selRange.value;
  if (val) {
    jumpToRange(val);
    selRange.value = ''; // Reset to placeholder
  }
});

// ============================================================
// Background swatch handlers
// ============================================================

const swatchButtons = document.querySelectorAll<HTMLButtonElement>('.color-swatch');
swatchButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    swatchButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const val = btn.dataset.bg!;
    bgColor = val === 'none' ? null : val;
    render();
  });
});

// ============================================================
// Populate range dropdown
// ============================================================

function populateRangeDropdown(): void {
  for (const [name, range] of Object.entries(TILE_RANGES)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${range.min}-${range.max})`;
    selRange.appendChild(opt);
  }
}

// ============================================================
// Init
// ============================================================

async function init(): Promise<void> {
  tilesetImg = await loadTileset();
  populateRangeDropdown();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

init();

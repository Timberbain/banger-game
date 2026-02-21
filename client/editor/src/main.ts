/**
 * Arena Editor -- Main bootstrap
 * Initializes canvas, loads unified tileset, wires UI components, starts render loop.
 */

import { EditorState, type Tool } from './EditorState';
import { HistoryManager } from './HistoryManager';
import { TilesetAtlas } from './TilesetAtlas';
import { CanvasRenderer, type SpawnOverlay } from './CanvasRenderer';
import { loadAutoTileRules, type AutoTileRule } from './AutoTiler';
import { generateAllLayers } from './LayerGenerator';
import { validate, type ValidationResult } from './Validator';
import { Toolbar } from './ui/Toolbar';
import { TilePalette } from './ui/TilePalette';
import { PropertyPanel } from './ui/PropertyPanel';
import { StatusBar } from './ui/StatusBar';
import { CollisionEditor } from './ui/CollisionEditor';
import {
  type ClipboardData,
  copyRegion,
  clearRegion,
  pasteClipboard,
  rotateClipboard90CW,
  flipClipboardH,
} from './Clipboard';
import { StampLibrary } from './StampLibrary';
import {
  computeSpawnDistances,
  computeCoverDensity,
  computeSightlines,
  type SpawnDistances,
} from './BalanceAnalyzer';

// --- State ---

const state = new EditorState();
const history = new HistoryManager(state);
const atlas = new TilesetAtlas();
const statusBar = new StatusBar();

let canvas: HTMLCanvasElement;
let renderer: CanvasRenderer;
let toolbar: Toolbar;
let palette: TilePalette;
let propPanel: PropertyPanel;
let collisionEditor: CollisionEditor;
let rules: AutoTileRule[] = [];

// Cached layer data for rendering
let layers = { ground: [] as number[], wallFronts: [] as number[], walls: [] as number[] };
let validationResult: ValidationResult = {
  perimeter: false,
  connectivity: false,
  spawns: { placed: 0, total: 3, clearance: false },
  unreachableCells: new Set(),
};

// --- Layer regeneration (debounced) ---

let regenerateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRegenerate(): void {
  if (regenerateTimer) clearTimeout(regenerateTimer);
  regenerateTimer = setTimeout(() => {
    if (rules.length === 0) return;
    layers = generateAllLayers(
      state.logicalGrid,
      state.width,
      state.height,
      rules,
      state.groundSeed,
      state.theme,
      state.groundOverrides,
    );
    validationResult = validate(state);
    propPanel.update();
    propPanel.updateValidation(validationResult);
    invalidateAnalysis();
  }, 16);
}

// --- Mouse interaction ---

let isPainting = false;
let isPanning = false;
let isSelecting = false;
let lastPanX = 0;
let lastPanY = 0;
let cursorTile: { x: number; y: number } | null = null;
let shiftDragStart: { x: number; y: number } | null = null;

// Clipboard & paste mode
let clipboard: ClipboardData | null = null;
let pasteMode = false;
let pasteClip: ClipboardData | null = null;

// Stamp library
const stampLibrary = new StampLibrary();

// Balance analysis overlays
let showDistances = false;
let showCover = false;
let showSightlines = false;
let sightlineSpawn: 'paran' | 'guardian1' | 'guardian2' = 'paran';

// Cached analysis data (invalidated on grid change)
let cachedDistances: Map<number, SpawnDistances> | null = null;
let cachedCover: Float32Array | null = null;
let cachedSightlines: Set<number> | null = null;
let analysisGridVersion = 0;
let lastAnalysisVersion = -1;

function invalidateAnalysis(): void {
  analysisGridVersion++;
}

function recomputeAnalysisIfNeeded(): void {
  if (lastAnalysisVersion === analysisGridVersion) return;
  lastAnalysisVersion = analysisGridVersion;

  if (showDistances) {
    cachedDistances = computeSpawnDistances(
      state.logicalGrid,
      state.width,
      state.height,
      state.spawnPoints,
    );
  } else {
    cachedDistances = null;
  }

  if (showCover) {
    cachedCover = computeCoverDensity(state.logicalGrid, state.width, state.height);
  } else {
    cachedCover = null;
  }

  if (showSightlines) {
    const spawn = state.spawnPoints[sightlineSpawn];
    if (spawn) {
      cachedSightlines = computeSightlines(
        state.logicalGrid,
        state.width,
        state.height,
        spawn.x,
        spawn.y,
      );
    } else {
      cachedSightlines = null;
    }
  } else {
    cachedSightlines = null;
  }
}

function updateOverlayButtons(): void {
  const btnDist = document.getElementById('btn-distances');
  const btnCover = document.getElementById('btn-cover');
  const btnSight = document.getElementById('btn-sightlines');

  if (btnDist) {
    btnDist.classList.toggle('active-distances', showDistances);
  }
  if (btnCover) {
    btnCover.classList.toggle('active-cover', showCover);
  }
  if (btnSight) {
    btnSight.classList.remove('active-sightlines', 'sightline-g1', 'sightline-g2');
    if (showSightlines) {
      btnSight.classList.add('active-sightlines');
      if (sightlineSpawn === 'guardian1') btnSight.classList.add('sightline-g1');
      if (sightlineSpawn === 'guardian2') btnSight.classList.add('sightline-g2');
    }
  }
}

function buildStampGrid(): void {
  const grid = document.getElementById('stamp-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const stamps = stampLibrary.getAll();
  stamps.forEach((stamp, idx) => {
    const btn = document.createElement('button');
    btn.className = 'stamp-btn';
    btn.textContent = stamp.name;
    btn.title = `${stamp.data.width}x${stamp.data.height}`;
    btn.addEventListener('click', () => {
      enterPasteMode({
        ...stamp.data,
        tiles: [...stamp.data.tiles],
        groundOverrides: new Map(stamp.data.groundOverrides),
      });
    });
    if (!stamp.builtIn) {
      const del = document.createElement('button');
      del.className = 'stamp-delete';
      del.textContent = '\u00D7';
      del.title = 'Delete stamp';
      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        stampLibrary.removeCustom(idx);
        buildStampGrid();
      });
      btn.appendChild(del);
    }
    grid.appendChild(btn);
  });
}

function updateSaveStampButton(): void {
  const btn = document.getElementById('btn-save-stamp') as HTMLButtonElement;
  if (btn) btn.disabled = !state.selection;
}

function handleMouseDown(e: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Middle-click or Ctrl+click: start panning
  if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
    isPanning = true;
    lastPanX = e.clientX;
    lastPanY = e.clientY;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }

  if (e.button !== 0) return;

  const tile = renderer.screenToTile(sx, sy);

  // Paste mode: click commits paste
  if (pasteMode && pasteClip) {
    history.push();
    pasteClipboard(state, pasteClip, tile.x, tile.y);
    pasteMode = false;
    pasteClip = null;
    scheduleRegenerate();
    updateStatusTool();
    return;
  }

  // Select tool: start selection drag
  if (state.currentTool === 'select') {
    isSelecting = true;
    state.selection = { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y };
    return;
  }

  // Shift+click: start rect drag
  if (e.shiftKey) {
    shiftDragStart = tile;
    history.push();
    return;
  }

  // Normal click: paint single tile
  history.push();
  isPainting = true;
  if (state.applyToolMirrored(tile.x, tile.y)) {
    scheduleRegenerate();
  }
}

function handleMouseMove(e: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  if (isPanning) {
    renderer.pan(e.clientX - lastPanX, e.clientY - lastPanY);
    lastPanX = e.clientX;
    lastPanY = e.clientY;
    return;
  }

  const tile = renderer.screenToTile(sx, sy);
  cursorTile = tile;
  statusBar.updateTile(tile.x, tile.y);

  // Selection drag
  if (isSelecting && state.selection) {
    state.selection.x2 = tile.x;
    state.selection.y2 = tile.y;
    return;
  }

  if (isPainting) {
    if (state.applyToolMirrored(tile.x, tile.y)) {
      scheduleRegenerate();
    }
  }
}

function handleMouseUp(e: MouseEvent): void {
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = 'crosshair';
    return;
  }

  // Complete selection drag
  if (isSelecting) {
    isSelecting = false;
    return;
  }

  // Complete shift-drag rect fill
  if (shiftDragStart && e.button === 0) {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const end = renderer.screenToTile(sx, sy);

    const x1 = Math.min(shiftDragStart.x, end.x);
    const y1 = Math.min(shiftDragStart.y, end.y);
    const x2 = Math.max(shiftDragStart.x, end.x);
    const y2 = Math.max(shiftDragStart.y, end.y);

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        state.applyToolMirrored(x, y);
      }
    }
    shiftDragStart = null;
    scheduleRegenerate();
  }

  isPainting = false;
}

function handleWheel(e: WheelEvent): void {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  const oldZoom = renderer.zoom;
  const delta = e.deltaY > 0 ? 0.97 : 1.03;
  renderer.setZoom(oldZoom * delta);

  // Zoom towards cursor
  const newZoom = renderer.zoom;
  renderer.panX = sx - (sx - renderer.panX) * (newZoom / oldZoom);
  renderer.panY = sy - (sy - renderer.panY) * (newZoom / oldZoom);

  statusBar.updateZoom(renderer.zoom);
}

function handleMouseLeave(): void {
  cursorTile = null;
  isPainting = false;
  statusBar.clearTile();
}

// --- Keyboard shortcuts ---

const TOOL_HOTKEYS: Record<string, Tool> = {
  w: 'wall-hedge',
  b: 'wall-brick',
  d: 'wall-wood',
  h: 'heavy',
  m: 'medium',
  l: 'light',
  e: 'eraser',
  g: 'ground',
  '1': 'spawn-paran',
  '2': 'spawn-guardian1',
  '3': 'spawn-guardian2',
  s: 'select',
};

const TOOL_NAMES: Record<string, string> = {
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
  select: 'Select',
};

function updateStatusTool(): void {
  const label = pasteMode ? 'Paste Mode' : TOOL_NAMES[state.currentTool] || state.currentTool;
  document.getElementById('status-tool')!.textContent = `Tool: ${label}`;
}

/** Enter paste mode with given clipboard data */
export function enterPasteMode(clip: ClipboardData): void {
  pasteMode = true;
  pasteClip = clip;
  state.selection = null;
  updateStatusTool();
}

function handleKeyDown(e: KeyboardEvent): void {
  // Don't intercept when typing in inputs
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  // Undo / Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      history.redo();
    } else {
      history.undo();
    }
    scheduleRegenerate();
    return;
  }

  // Save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    toolbar.saveToLocalStorage();
    return;
  }

  // Copy
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    if (state.selection) {
      e.preventDefault();
      const { x1, y1, x2, y2 } = state.selection;
      clipboard = copyRegion(state, x1, y1, x2, y2);
    }
    return;
  }

  // Cut
  if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
    if (state.selection) {
      e.preventDefault();
      const { x1, y1, x2, y2 } = state.selection;
      clipboard = copyRegion(state, x1, y1, x2, y2);
      history.push();
      clearRegion(state, x1, y1, x2, y2);
      state.selection = null;
      scheduleRegenerate();
    }
    return;
  }

  // Paste
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    if (clipboard) {
      e.preventDefault();
      enterPasteMode({
        ...clipboard,
        tiles: [...clipboard.tiles],
        groundOverrides: new Map(clipboard.groundOverrides),
      });
    }
    return;
  }

  // New
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    history.push();
    state.reset();
    history.clear();
    onLoad();
    return;
  }

  // Escape: cancel paste mode or clear selection
  if (e.key === 'Escape') {
    if (pasteMode) {
      pasteMode = false;
      pasteClip = null;
      updateStatusTool();
      return;
    }
    if (state.selection) {
      state.selection = null;
      return;
    }
    return;
  }

  // Paste mode keys
  if (pasteMode && pasteClip) {
    if (e.key.toLowerCase() === 'r') {
      pasteClip = rotateClipboard90CW(pasteClip);
      return;
    }
    if (e.key.toLowerCase() === 'f') {
      pasteClip = flipClipboardH(pasteClip);
      return;
    }
  }

  // Mirror toggles
  if (e.key.toLowerCase() === 'x' && !e.ctrlKey && !e.metaKey) {
    state.mirrorX = !state.mirrorX;
    syncMirrorUI();
    return;
  }
  if (e.key.toLowerCase() === 'y' && !e.ctrlKey && !e.metaKey) {
    state.mirrorY = !state.mirrorY;
    syncMirrorUI();
    return;
  }

  // Tool hotkeys
  const tool = TOOL_HOTKEYS[e.key.toLowerCase()];
  if (tool) {
    state.currentTool = tool;
    if (pasteMode && tool !== 'select') {
      pasteMode = false;
      pasteClip = null;
    }
    state.selection = null;
    palette.updateActiveButton();
    updateStatusTool();
  }
}

// --- Mirror UI sync ---

function syncMirrorUI(): void {
  const chkX = document.getElementById('chk-mirror-x') as HTMLInputElement;
  const chkY = document.getElementById('chk-mirror-y') as HTMLInputElement;
  if (chkX) chkX.checked = state.mirrorX;
  if (chkY) chkY.checked = state.mirrorY;
  const mirrorStatus = [];
  if (state.mirrorX) mirrorStatus.push('X');
  if (state.mirrorY) mirrorStatus.push('Y');
  const el = document.getElementById('status-mirror');
  if (el) el.textContent = mirrorStatus.length ? `Mirror: ${mirrorStatus.join('+')}` : '';
}

// --- Render loop ---

function renderLoop(): void {
  const viewport = document.getElementById('viewport')!;
  renderer.resize(viewport.clientWidth, viewport.clientHeight);

  updateSaveStampButton();
  recomputeAnalysisIfNeeded();

  // Build spawn overlays
  const spawns: SpawnOverlay[] = [];
  if (state.spawnPoints.paran) {
    spawns.push({ ...state.spawnPoints.paran, role: 'P', color: '#FFCC00' });
  }
  if (state.spawnPoints.guardian1) {
    spawns.push({ ...state.spawnPoints.guardian1, role: 'G1', color: '#FF4444' });
  }
  if (state.spawnPoints.guardian2) {
    spawns.push({ ...state.spawnPoints.guardian2, role: 'G2', color: '#44CC66' });
  }

  renderer.render(layers, state.width, state.height, {
    spawns,
    invalidCells: validationResult.unreachableCells,
    cursor: cursorTile && !pasteMode ? { ...cursorTile, tool: state.currentTool } : null,
    mirrorX: state.mirrorX,
    mirrorY: state.mirrorY,
    mirrorCursors:
      cursorTile && !pasteMode ? state.getMirrorPositions(cursorTile.x, cursorTile.y) : [],
    selection: state.selection,
    pastePreview:
      pasteMode && pasteClip && cursorTile
        ? {
            tiles: pasteClip.tiles,
            groundOverrides: pasteClip.groundOverrides,
            width: pasteClip.width,
            height: pasteClip.height,
            originX: cursorTile.x,
            originY: cursorTile.y,
          }
        : null,
    distances: cachedDistances || undefined,
    coverDensity: cachedCover || undefined,
    sightlines: cachedSightlines || undefined,
    sightlineColor:
      sightlineSpawn === 'paran'
        ? '#FFCC00'
        : sightlineSpawn === 'guardian1'
          ? '#FF4444'
          : '#44CC66',
  });

  requestAnimationFrame(renderLoop);
}

// --- After load/reset callback ---

async function onLoad(): Promise<void> {
  palette.buildGroundPalette();
  toolbar.syncThemeSelect();
  scheduleRegenerate();
}

// --- Auto-save ---

setInterval(() => {
  toolbar.saveToLocalStorage();
}, 30000);

window.addEventListener('beforeunload', () => {
  toolbar.saveToLocalStorage();
});

// --- Init ---

async function init(): Promise<void> {
  canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
  renderer = new CanvasRenderer(canvas, atlas);

  // Load unified tileset + auto-tile rules (single load, no theme param)
  const [loadedRules] = await Promise.all([loadAutoTileRules(), atlas.load()]);
  rules = loadedRules;

  // Init UI
  toolbar = new Toolbar(state, history, renderer, onLoad);
  toolbar.setRules(rules);
  palette = new TilePalette(state, atlas);
  propPanel = new PropertyPanel(state);
  collisionEditor = new CollisionEditor(state, atlas, () => {
    renderer.collisionOverrides = state.collisionOverrides;
    scheduleRegenerate();
  });

  // Try restore WIP
  if (toolbar.restoreFromLocalStorage()) {
    palette.buildGroundPalette();
    renderer.collisionOverrides = state.collisionOverrides;
  }

  // Wire overlay buttons
  const btnDist = document.getElementById('btn-distances');
  const btnCover = document.getElementById('btn-cover');
  const btnSight = document.getElementById('btn-sightlines');

  if (btnDist) {
    btnDist.addEventListener('click', () => {
      showDistances = !showDistances;
      invalidateAnalysis();
      updateOverlayButtons();
    });
  }
  if (btnCover) {
    btnCover.addEventListener('click', () => {
      showCover = !showCover;
      invalidateAnalysis();
      updateOverlayButtons();
    });
  }
  if (btnSight) {
    btnSight.addEventListener('click', () => {
      if (!showSightlines) {
        showSightlines = true;
        sightlineSpawn = 'paran';
      } else {
        // Cycle through spawns, then turn off
        if (sightlineSpawn === 'paran') sightlineSpawn = 'guardian1';
        else if (sightlineSpawn === 'guardian1') sightlineSpawn = 'guardian2';
        else {
          showSightlines = false;
        }
      }
      invalidateAnalysis();
      updateOverlayButtons();
    });
  }

  // Build stamp grid
  buildStampGrid();

  // Wire save-stamp button
  const btnSaveStamp = document.getElementById('btn-save-stamp');
  if (btnSaveStamp) {
    btnSaveStamp.addEventListener('click', () => {
      if (!state.selection) return;
      const name = prompt('Stamp name:');
      if (!name) return;
      const { x1, y1, x2, y2 } = state.selection;
      const clip = copyRegion(state, x1, y1, x2, y2);
      stampLibrary.addCustom(name, clip);
      buildStampGrid();
    });
  }

  // Wire mirror checkboxes
  const chkMirrorX = document.getElementById('chk-mirror-x') as HTMLInputElement;
  const chkMirrorY = document.getElementById('chk-mirror-y') as HTMLInputElement;
  if (chkMirrorX)
    chkMirrorX.addEventListener('change', () => {
      state.mirrorX = chkMirrorX.checked;
      syncMirrorUI();
    });
  if (chkMirrorY)
    chkMirrorY.addEventListener('change', () => {
      state.mirrorY = chkMirrorY.checked;
      syncMirrorUI();
    });

  // Wire state change listener
  state.onChange(scheduleRegenerate);

  // Wire canvas events
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Right-click opens collision editor for the clicked solid tile
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const tile = renderer.screenToTile(sx, sy);
    if (tile.x >= 0 && tile.x < state.width && tile.y >= 0 && tile.y < state.height) {
      const wallTileId = layers.walls[tile.y * state.width + tile.x];
      if (wallTileId > 0) {
        collisionEditor.open(wallTileId);
      } else {
        collisionEditor.close();
      }
    }
  });

  // Wire keyboard
  document.addEventListener('keydown', handleKeyDown);

  // Initial layer generation + validation
  scheduleRegenerate();

  // Center view
  const viewport = document.getElementById('viewport')!;
  renderer.panX = (viewport.clientWidth - state.width * 32 * renderer.zoom) / 2;
  renderer.panY = (viewport.clientHeight - state.height * 32 * renderer.zoom) / 2;

  // Start render loop
  requestAnimationFrame(renderLoop);
}

init().catch(console.error);

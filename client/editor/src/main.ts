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
  }, 16);
}

// --- Mouse interaction ---

let isPainting = false;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;
let cursorTile: { x: number; y: number } | null = null;
let shiftDragStart: { x: number; y: number } | null = null;

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

  // Shift+click: start rect drag
  if (e.shiftKey) {
    shiftDragStart = tile;
    history.push();
    return;
  }

  // Normal click: paint single tile
  history.push();
  isPainting = true;
  if (state.applyTool(tile.x, tile.y)) {
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

  if (isPainting) {
    if (state.applyTool(tile.x, tile.y)) {
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
        state.applyTool(x, y);
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
};

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

  // New
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    history.push();
    state.reset();
    history.clear();
    onLoad();
    return;
  }

  // Tool hotkeys
  const tool = TOOL_HOTKEYS[e.key.toLowerCase()];
  if (tool) {
    state.currentTool = tool;
    palette.updateActiveButton();
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
    document.getElementById('status-tool')!.textContent = `Tool: ${toolNames[tool] || tool}`;
  }
}

// --- Render loop ---

function renderLoop(): void {
  const viewport = document.getElementById('viewport')!;
  renderer.resize(viewport.clientWidth, viewport.clientHeight);

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
    cursor: cursorTile ? { ...cursorTile, tool: state.currentTool } : null,
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

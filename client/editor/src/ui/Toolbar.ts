/**
 * Toolbar UI: New, Load, Save, Export, Theme, Undo/Redo, Grid/Collision toggles
 */

import { EditorState } from '../EditorState';
import { HistoryManager } from '../HistoryManager';
import { CanvasRenderer } from '../CanvasRenderer';
import { exportTiledJSON, downloadJSON } from '../TiledExporter';
import { loadBuiltinMap, importFromFile } from '../MapImporter';
import { type AutoTileRule } from '../AutoTiler';

export class Toolbar {
  private state: EditorState;
  private history: HistoryManager;
  private renderer: CanvasRenderer;
  private rules: AutoTileRule[] = [];
  private onLoadCallback: () => void;

  constructor(
    state: EditorState,
    history: HistoryManager,
    renderer: CanvasRenderer,
    onLoad: () => void,
  ) {
    this.state = state;
    this.history = history;
    this.renderer = renderer;
    this.onLoadCallback = onLoad;
    this.bindEvents();
  }

  setRules(rules: AutoTileRule[]): void {
    this.rules = rules;
  }

  private bindEvents(): void {
    // New
    document.getElementById('btn-new')!.addEventListener('click', () => {
      this.history.push();
      this.state.reset();
      this.history.clear();
      this.onLoadCallback();
    });

    // Load dropdown
    const loadBtn = document.getElementById('btn-load')!;
    const dropdown = document.getElementById('load-dropdown')!;
    loadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      if (!dropdown.classList.contains('hidden')) {
        const rect = loadBtn.getBoundingClientRect();
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = rect.bottom + 4 + 'px';
      }
    });
    document.addEventListener('click', () => dropdown.classList.add('hidden'));

    // Built-in map buttons
    dropdown.querySelectorAll('[data-map]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const mapName = (btn as HTMLElement).dataset.map!;
        this.history.push();
        await loadBuiltinMap(this.state, mapName);
        this.history.clear();
        this.onLoadCallback();
        dropdown.classList.add('hidden');
      });
    });

    // Upload
    const uploadBtn = document.getElementById('btn-upload')!;
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      this.history.push();
      await importFromFile(this.state, file);
      this.history.clear();
      this.onLoadCallback();
      fileInput.value = '';
      dropdown.classList.add('hidden');
    });

    // Save WIP
    document.getElementById('btn-save')!.addEventListener('click', () => {
      this.saveToLocalStorage();
    });

    // Export
    document.getElementById('btn-export')!.addEventListener('click', () => {
      if (this.rules.length === 0) return;
      const json = exportTiledJSON(this.state, this.rules);
      downloadJSON(json, `${this.state.mapName}.json`);
    });

    // Undo/Redo
    document.getElementById('btn-undo')!.addEventListener('click', () => this.history.undo());
    document.getElementById('btn-redo')!.addEventListener('click', () => this.history.redo());

    // Grid toggle
    (document.getElementById('chk-grid') as HTMLInputElement).addEventListener('change', (e) => {
      this.renderer.showGrid = (e.target as HTMLInputElement).checked;
    });

    // Collision toggle
    (document.getElementById('chk-collision') as HTMLInputElement).addEventListener(
      'change',
      (e) => {
        this.renderer.showCollision = (e.target as HTMLInputElement).checked;
      },
    );
  }

  /** Save current state to localStorage */
  saveToLocalStorage(): void {
    const collisionArr: Array<[string, { x: number; y: number; w: number; h: number }]> = [];
    for (const [k, v] of this.state.collisionOverrides) {
      collisionArr.push([k, v]);
    }
    const data = {
      width: this.state.width,
      height: this.state.height,
      grid: this.state.logicalGrid,
      overrides: Array.from(this.state.groundOverrides.entries()),
      collisionOverrides: collisionArr,
      spawns: this.state.spawnPoints,
      theme: this.state.theme,
      mapName: this.state.mapName,
      displayName: this.state.displayName,
      groundSeed: this.state.groundSeed,
    };
    localStorage.setItem('banger-editor-wip', JSON.stringify(data));
  }

  /** Restore state from localStorage, returns true if restored */
  restoreFromLocalStorage(): boolean {
    const raw = localStorage.getItem('banger-editor-wip');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.state.width = data.width;
      this.state.height = data.height;
      this.state.logicalGrid = data.grid;
      this.state.groundOverrides = new Map(data.overrides);
      this.state.spawnPoints = data.spawns;
      this.state.theme = data.theme;
      this.state.mapName = data.mapName;
      this.state.displayName = data.displayName;
      this.state.groundSeed = data.groundSeed;
      if (data.collisionOverrides) {
        this.state.collisionOverrides = new Map(data.collisionOverrides);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** No-op: theme dropdown removed (mixed wall themes) */
  syncThemeSelect(): void {
    // Theme is now per-tile via wall sentinels, no global dropdown to sync
  }
}

/**
 * Snapshot-based undo/redo stack for the editor.
 * Stores deep copies of logical grid, ground overrides, and spawn points.
 */

import { EditorState, SpawnPoints } from './EditorState';
import { type CollisionShape } from '../../../shared/tileRegistry';

interface Snapshot {
  grid: number[];
  overrides: Map<number, number>;
  spawns: SpawnPoints;
  collisionOverrides: Map<string, CollisionShape>;
}

const MAX_HISTORY = 100;

export class HistoryManager {
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private state: EditorState;

  constructor(state: EditorState) {
    this.state = state;
  }

  /** Save current state before a mutation */
  push(): void {
    this.undoStack.push(this.state.snapshot());
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /** Undo last action */
  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(this.state.snapshot());
    const snap = this.undoStack.pop()!;
    this.state.restore(snap);
    return true;
  }

  /** Redo last undone action */
  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(this.state.snapshot());
    const snap = this.redoStack.pop()!;
    this.state.restore(snap);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Clear all history (e.g., on new/load) */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

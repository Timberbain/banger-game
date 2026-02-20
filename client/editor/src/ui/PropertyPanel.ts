/**
 * Property panel UI: arena metadata, spawn display, validation status
 */

import { EditorState } from '../EditorState';
import { type ValidationResult } from '../Validator';

export class PropertyPanel {
  private state: EditorState;

  constructor(state: EditorState) {
    this.state = state;
    this.bindInputs();
  }

  private bindInputs(): void {
    const nameInput = document.getElementById('prop-name') as HTMLInputElement;
    const displayInput = document.getElementById('prop-display') as HTMLInputElement;

    nameInput.addEventListener('input', () => {
      this.state.mapName = nameInput.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      nameInput.value = this.state.mapName;
    });

    displayInput.addEventListener('input', () => {
      this.state.displayName = displayInput.value;
    });
  }

  /** Update all property displays from current state */
  update(): void {
    document.getElementById('prop-size')!.textContent =
      `${this.state.width} x ${this.state.height}`;

    (document.getElementById('prop-name') as HTMLInputElement).value = this.state.mapName;
    (document.getElementById('prop-display') as HTMLInputElement).value = this.state.displayName;

    const { spawnPoints } = this.state;
    document.getElementById('spawn-paran')!.textContent = spawnPoints.paran
      ? `(${spawnPoints.paran.x}, ${spawnPoints.paran.y})`
      : '--';
    document.getElementById('spawn-guardian1')!.textContent = spawnPoints.guardian1
      ? `(${spawnPoints.guardian1.x}, ${spawnPoints.guardian1.y})`
      : '--';
    document.getElementById('spawn-guardian2')!.textContent = spawnPoints.guardian2
      ? `(${spawnPoints.guardian2.x}, ${spawnPoints.guardian2.y})`
      : '--';
  }

  /** Update validation display */
  updateValidation(result: ValidationResult): void {
    this.setValidationItem('val-perimeter', result.perimeter, 'Perimeter');
    this.setValidationItem('val-connectivity', result.connectivity, 'Connectivity');

    const spawnsEl = document.getElementById('val-spawns')!;
    const allOk = result.spawns.placed === 3 && result.spawns.clearance;
    spawnsEl.className = `validation-item ${allOk ? 'val-pass' : 'val-fail'}`;
    spawnsEl.innerHTML = `<span class="val-icon">${allOk ? '\u2713' : '\u2717'}</span> Spawns: ${result.spawns.placed}/3`;

    // Status bar summary
    const allPass = result.perimeter && result.connectivity && allOk;
    document.getElementById('status-validation')!.textContent = allPass
      ? 'All checks pass'
      : 'Validation issues';
  }

  private setValidationItem(id: string, pass: boolean, label: string): void {
    const el = document.getElementById(id)!;
    el.className = `validation-item ${pass ? 'val-pass' : 'val-fail'}`;
    el.innerHTML = `<span class="val-icon">${pass ? '\u2713' : '\u2717'}</span> ${label}`;
  }
}

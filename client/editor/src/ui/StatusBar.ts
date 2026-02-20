/**
 * Status bar UI: cursor position, zoom level, active tool
 */

export class StatusBar {
  updateTile(x: number, y: number): void {
    document.getElementById('status-tile')!.textContent = `Tile: (${x}, ${y})`;
  }

  clearTile(): void {
    document.getElementById('status-tile')!.textContent = 'Tile: --';
  }

  updateZoom(zoom: number): void {
    document.getElementById('status-zoom')!.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
  }
}

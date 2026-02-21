/**
 * TilesetAtlas -- Loads and slices the unified tileset PNG into individual
 * ImageBitmaps for efficient tile-by-tile rendering on an HTML Canvas.
 *
 * The unified tileset is 256x1472 pixels (8 columns x 46 rows of 32x32 tiles,
 * 368 tiles total). Tile IDs are 1-based in the map data, so tile ID N maps to
 * internal array index N-1. Tile ID 0 means "empty / no tile".
 *
 * Tileset lives at /tilesets/arena_unified.png.
 */

const COLS = 8;
const ROWS = 46;
const TILE_PX = 32;
const TOTAL_TILES = COLS * ROWS; // 368

export class TilesetAtlas {
  /** Indexed by tile ID minus one. tiles[0] = tile ID 1, etc. */
  tiles: ImageBitmap[] = [];

  /** True once load() has completed successfully. */
  loaded = false;

  /**
   * Fetch the unified tileset and slice it into 368 individual ImageBitmaps.
   */
  async load(): Promise<void> {
    const url = '/tilesets/arena_unified.png';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch tileset: ${url} (${response.status})`);
    }

    const blob = await response.blob();
    const source = await createImageBitmap(blob);

    // Slice the composite image into individual 32x32 tiles.
    const promises: Promise<ImageBitmap>[] = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      const sx = (i % COLS) * TILE_PX;
      const sy = Math.floor(i / COLS) * TILE_PX;
      promises.push(createImageBitmap(source, sx, sy, TILE_PX, TILE_PX));
    }

    this.tiles = await Promise.all(promises);
    this.loaded = true;
  }

  /**
   * Retrieve the ImageBitmap for a given 1-based tile ID.
   *
   * @returns The bitmap, or null if the ID is out of range, zero, or the
   *          atlas has not been loaded yet.
   */
  getTile(tileId: number): ImageBitmap | null {
    if (!this.loaded || tileId < 1 || tileId > this.tiles.length) {
      return null;
    }
    return this.tiles[tileId - 1] ?? null;
  }
}

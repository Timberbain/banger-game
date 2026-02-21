#!/usr/bin/env python3
"""
Append 12 decoration tiles from assets/tilesets/decorations.png
to client/public/tilesets/arena_unified.png.

Source decorations.png: 72x71, 4x3 grid of small pixel art tiles.
Each tile is extracted, centered in 16x16, upscaled 2x (nearest-neighbor) to 32x32.
Appended as rows 44-45 (tile IDs 353-364) in the unified tileset.
"""

from PIL import Image
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

DECORATIONS_SRC = os.path.join(PROJECT_ROOT, "assets", "tilesets", "decorations.png")
TILESET_PATH = os.path.join(PROJECT_ROOT, "client", "public", "tilesets", "arena_unified.png")

TILE_SIZE = 32  # Output tile size
COLS = 4
ROWS = 3


def extract_decoration_tiles():
    """Extract 12 tiles from the decorations spritesheet."""
    src = Image.open(DECORATIONS_SRC).convert("RGBA")
    w, h = src.size

    cell_w = w / COLS
    cell_h = h / ROWS

    tiles = []
    for row in range(ROWS):
        for col in range(COLS):
            # Crop the cell
            x0 = int(col * cell_w)
            y0 = int(row * cell_h)
            x1 = int((col + 1) * cell_w)
            y1 = int((row + 1) * cell_h)
            cell = src.crop((x0, y0, x1, y1))

            # Find bounding box of non-transparent content
            bbox = cell.getbbox()
            if bbox:
                content = cell.crop(bbox)
            else:
                content = cell

            # Center in 16x16 canvas (clamp oversized content)
            cw = min(content.width, 16)
            ch = min(content.height, 16)
            if content.width > 16 or content.height > 16:
                content = content.resize((cw, ch), Image.NEAREST)

            canvas = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
            cx = (16 - content.width) // 2
            cy = (16 - content.height) // 2
            canvas.paste(content, (cx, cy))

            # Scale 2x to 32x32 (nearest-neighbor for pixel art)
            tile = canvas.resize((TILE_SIZE, TILE_SIZE), Image.NEAREST)
            tiles.append(tile)

    return tiles


def append_to_tileset(tiles):
    """Append decoration tiles to arena_unified.png as rows 44-45."""
    tileset = Image.open(TILESET_PATH).convert("RGBA")
    orig_w, orig_h = tileset.size

    # 12 tiles = row 44 (8 tiles) + row 45 (4 tiles + 4 empty)
    new_rows = 2
    new_h = orig_h + new_rows * TILE_SIZE

    new_tileset = Image.new("RGBA", (orig_w, new_h), (0, 0, 0, 0))
    new_tileset.paste(tileset, (0, 0))

    # Place 12 tiles into rows 44-45
    for i, tile in enumerate(tiles):
        row = i // 8
        col = i % 8
        x = col * TILE_SIZE
        y = orig_h + row * TILE_SIZE
        new_tileset.paste(tile, (x, y))

    new_tileset.save(TILESET_PATH)
    print(f"Updated {TILESET_PATH}")
    print(f"  Original: {orig_w}x{orig_h}")
    print(f"  New:      {orig_w}x{new_h}")
    print(f"  Added {len(tiles)} decoration tiles in rows {orig_h // TILE_SIZE}-{orig_h // TILE_SIZE + new_rows - 1}")
    print(f"  Tile IDs: {orig_h // TILE_SIZE * 8 + 1}-{orig_h // TILE_SIZE * 8 + len(tiles)}")


if __name__ == "__main__":
    tiles = extract_decoration_tiles()
    append_to_tileset(tiles)

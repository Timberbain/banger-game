#!/usr/bin/env python3
"""
Extrude tiles in a tileset PNG to prevent tile-seam bleeding.

Adds 1px extrusion around each tile by duplicating the outermost pixel
row/column outward. This prevents sub-pixel rendering gaps (white lines)
that appear when the camera is at non-integer positions.

Input:  client/public/tilesets/arena_unified.png (256x1472, 8x46 @ 32px, margin=0, spacing=0)
Output: same path, overwritten (272x1564, 8x46 @ 32px, margin=1, spacing=2)
"""

from PIL import Image
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
TILESET_PATH = os.path.join(PROJECT_ROOT, "client", "public", "tilesets", "arena_unified.png")

TILE = 32
COLS = 8
ROWS = 46
EXTRUDE = 1  # pixels of extrusion per side


def extrude_tileset():
    src = Image.open(TILESET_PATH).convert("RGBA")

    expected_w = COLS * TILE
    expected_h = ROWS * TILE
    if src.size != (expected_w, expected_h):
        print(f"WARNING: Expected {expected_w}x{expected_h}, got {src.size[0]}x{src.size[1]}")

    # New tile stride = TILE + 2 * EXTRUDE
    stride = TILE + 2 * EXTRUDE  # 34
    new_w = EXTRUDE + COLS * stride - EXTRUDE  # margin + cols*stride - one trailing extrude overlap
    new_h = EXTRUDE + ROWS * stride - EXTRUDE
    # Simplifies to: COLS * stride + EXTRUDE... wait let me think carefully.
    # Layout: margin=1, spacing=2 between tiles.
    # Tile at (col, row) starts at (1 + col*34, 1 + row*34).
    # Last tile right edge: 1 + (COLS-1)*34 + 32 = 1 + 7*34 + 32 = 1 + 238 + 32 = 271.
    # Plus 1px right extrusion = 272.
    new_w = EXTRUDE + (COLS - 1) * stride + TILE + EXTRUDE
    new_h = EXTRUDE + (ROWS - 1) * stride + TILE + EXTRUDE

    dst = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))

    for row in range(ROWS):
        for col in range(COLS):
            # Source tile position
            sx = col * TILE
            sy = row * TILE
            tile = src.crop((sx, sy, sx + TILE, sy + TILE))

            # Destination tile position (inside the extrusion border)
            dx = EXTRUDE + col * stride
            dy = EXTRUDE + row * stride

            # Paste the tile itself
            dst.paste(tile, (dx, dy))

            # Extrude edges by duplicating outermost pixel rows/columns

            # Top edge: duplicate top row upward
            top_row = tile.crop((0, 0, TILE, 1))
            dst.paste(top_row, (dx, dy - EXTRUDE))

            # Bottom edge: duplicate bottom row downward
            bottom_row = tile.crop((0, TILE - 1, TILE, TILE))
            dst.paste(bottom_row, (dx, dy + TILE))

            # Left edge: duplicate left column leftward
            left_col = tile.crop((0, 0, 1, TILE))
            dst.paste(left_col, (dx - EXTRUDE, dy))

            # Right edge: duplicate right column rightward
            right_col = tile.crop((TILE - 1, 0, TILE, TILE))
            dst.paste(right_col, (dx + TILE, dy))

            # Corners: duplicate corner pixels
            # Top-left
            tl = tile.getpixel((0, 0))
            dst.putpixel((dx - EXTRUDE, dy - EXTRUDE), tl)

            # Top-right
            tr = tile.getpixel((TILE - 1, 0))
            dst.putpixel((dx + TILE, dy - EXTRUDE), tr)

            # Bottom-left
            bl = tile.getpixel((0, TILE - 1))
            dst.putpixel((dx - EXTRUDE, dy + TILE), bl)

            # Bottom-right
            br = tile.getpixel((TILE - 1, TILE - 1))
            dst.putpixel((dx + TILE, dy + TILE), br)

    dst.save(TILESET_PATH)
    print(f"Extruded tileset saved: {new_w}x{new_h} ({TILESET_PATH})")


if __name__ == "__main__":
    extrude_tileset()

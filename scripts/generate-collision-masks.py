#!/usr/bin/env python3
"""
Generate per-tile collision rectangle JSON sidecar files from composite tileset PNGs.

For each tileset, scans every 32x32 tile to compute the tightest bounding box of
opaque pixels (alpha > 0) using PIL's getbbox() on the isolated alpha channel.
Outputs a JSON file mapping tile IDs to {x, y, w, h} collision rectangles.

Composite tileset layout: 256x448 = 8 columns x 14 rows of 32x32 tiles.
Tile IDs 1-112 (firstgid=1).

Usage:
    python3 scripts/generate-collision-masks.py
"""

from PIL import Image
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
TILESETS_DIR = os.path.join(PROJECT_ROOT, "client", "public", "tilesets")

TILE_SIZE = 32
COLUMNS = 8
ROWS = 14

# Manual overrides: tile_id (int) -> {x, y, w, h}
# After visual inspection, specific tiles can be overridden here if the
# auto-derived bounding box produces poor collision behavior.
# Example: MANUAL_OVERRIDES = { 1: {"x": 2, "y": 2, "w": 28, "h": 28} }
MANUAL_OVERRIDES = {}

# Tileset name -> input PNG filename
TILESETS = {
    "arena_hedge": "arena_hedge.png",
    "arena_brick": "arena_brick.png",
    "arena_wood": "arena_wood.png",
}


def compute_collision_rects(tileset_path):
    """
    Compute collision rectangles for all tiles in a composite tileset.

    For each 32x32 tile:
    1. Extract the tile region from the composite PNG
    2. Isolate the alpha channel via img.split()[3]
    3. Call alpha.getbbox() -> (left, upper, right, lower) or None
    4. If bbox exists: store {x: left, y: upper, w: right-left, h: lower-upper}
    5. If bbox is None (fully transparent): skip (not solid)

    Returns dict mapping string tile IDs to {x, y, w, h} collision rects.
    """
    img = Image.open(tileset_path).convert("RGBA")
    rects = {}

    for row in range(ROWS):
        for col in range(COLUMNS):
            tile_id = row * COLUMNS + col + 1  # firstgid=1
            x0 = col * TILE_SIZE
            y0 = row * TILE_SIZE
            tile_img = img.crop((x0, y0, x0 + TILE_SIZE, y0 + TILE_SIZE))

            # Isolate alpha channel for accurate bounding box
            # (getbbox on full RGBA would include color channel nonzero values)
            alpha = tile_img.split()[3]
            bbox = alpha.getbbox()  # (left, upper, right, lower) or None

            if bbox is None:
                # Fully transparent tile -- not solid, skip
                continue

            left, upper, right, lower = bbox

            # Check for manual override
            if tile_id in MANUAL_OVERRIDES:
                rects[str(tile_id)] = MANUAL_OVERRIDES[tile_id]
            else:
                rects[str(tile_id)] = {
                    "x": left,
                    "y": upper,
                    "w": right - left,
                    "h": lower - upper,
                }

    return rects


def print_summary(name, rects):
    """Print summary statistics for a tileset's collision rects."""
    full_area = TILE_SIZE * TILE_SIZE
    sub_rect_count = 0
    full_tile_count = 0
    total_coverage = 0.0

    for tile_id_str, rect in rects.items():
        if tile_id_str == "_default":
            continue
        area = rect["w"] * rect["h"]
        coverage = area / full_area
        total_coverage += coverage
        if rect["x"] == 0 and rect["y"] == 0 and rect["w"] == TILE_SIZE and rect["h"] == TILE_SIZE:
            full_tile_count += 1
        else:
            sub_rect_count += 1

    tile_count = sub_rect_count + full_tile_count
    avg_coverage = (total_coverage / tile_count * 100) if tile_count > 0 else 0

    print(f"  {name}:")
    print(f"    Total tiles with opaque pixels: {tile_count}")
    print(f"    Sub-rect (smaller than full tile): {sub_rect_count}")
    print(f"    Full-tile (32x32): {full_tile_count}")
    print(f"    Average coverage: {avg_coverage:.1f}%")


def main():
    print("Generating collision mask sidecar JSONs...")
    print()

    for name, png_file in TILESETS.items():
        tileset_path = os.path.join(TILESETS_DIR, png_file)

        if not os.path.exists(tileset_path):
            print(f"  WARNING: {tileset_path} not found, skipping")
            continue

        rects = compute_collision_rects(tileset_path)

        # Always include a _default entry as fallback (full-tile)
        rects["_default"] = {"x": 0, "y": 0, "w": TILE_SIZE, "h": TILE_SIZE}

        # Write JSON sidecar
        output_path = os.path.join(TILESETS_DIR, f"{name}_collision.json")
        with open(output_path, "w") as f:
            json.dump(rects, f, indent=2)

        print(f"  Created {output_path}")
        print_summary(name, rects)
        print()

    print("Collision mask generation complete.")


if __name__ == "__main__":
    main()

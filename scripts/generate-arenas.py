#!/usr/bin/env python3
"""
Generate composite tileset PNGs and arena map JSONs for 3 themed arenas.

Produces:
  - 3 composite tilesets (128x96, 4x3 grid of 32x32 tiles)
  - 3 map JSONs (50x38 tiles = 1600x1216 px)

Composite tileset layout (firstgid=1):
  Row 0 (IDs 1-4): Ground tile variants
  Row 1 (IDs 5-8): Wall (5), Heavy obstacle (6), Medium obstacle (7), Light obstacle (8)
  Row 2 (IDs 9-12): Decoration variants (non-solid)

Arena themes:
  - Hedge Garden: open corridors, scattered hedge clusters, Paran-favoring
  - Brick Fortress: chambered rooms, narrow doorways, Guardian-favoring
  - Timber Yard: symmetric cross/X pattern, balanced
"""

from PIL import Image
import json
import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ASSETS_DIR = os.path.join(PROJECT_ROOT, "assets", "tilesets")
TILESETS_DIR = os.path.join(PROJECT_ROOT, "client", "public", "tilesets")
MAPS_DIR = os.path.join(PROJECT_ROOT, "client", "public", "maps")

os.makedirs(TILESETS_DIR, exist_ok=True)
os.makedirs(MAPS_DIR, exist_ok=True)

TILE = 32
MAP_W = 50
MAP_H = 38

# Tile IDs in map data (firstgid=1, 0=empty)
GROUND_IDS = [1, 2, 3, 4]
WALL_ID = 5
HEAVY_ID = 6
MEDIUM_ID = 7
LIGHT_ID = 8
DECO_IDS = [9, 10, 11, 12]

# ============================================================
# Tile extraction helpers
# ============================================================

def extract_tile(img, col, row):
    """Extract a 32x32 tile from a grid-based tileset image."""
    tile = img.crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE))
    if tile.mode != "RGBA":
        tile = tile.convert("RGBA")
    return tile


def load_source_tilesets():
    """Load all source tileset images."""
    ground = Image.open(os.path.join(ASSETS_DIR, "32x32 topdown tileset Spreadsheet V1-1.png"))
    hedge = Image.open(os.path.join(ASSETS_DIR, "hedge_tileset.png"))
    brick = Image.open(os.path.join(ASSETS_DIR, "brick_tileset.png"))
    wood = Image.open(os.path.join(ASSETS_DIR, "wood_tileset.png"))
    return ground, hedge, brick, wood


# ============================================================
# Composite tileset generation
# ============================================================

def create_composite_tileset(ground_tiles, wall_obstacle_tiles, deco_tiles, output_path, theme_name):
    """
    Create a 128x96 composite tileset (4 cols x 3 rows of 32x32 tiles).
    ground_tiles: list of 4 PIL Image tiles
    wall_obstacle_tiles: list of 4 PIL Image tiles [wall, heavy, medium, light]
    deco_tiles: list of 4 PIL Image tiles
    """
    img = Image.new("RGBA", (4 * TILE, 3 * TILE), (0, 0, 0, 0))

    # Row 0: ground (IDs 1-4)
    for i, tile in enumerate(ground_tiles[:4]):
        img.paste(tile, (i * TILE, 0))

    # Row 1: wall + obstacles (IDs 5-8)
    for i, tile in enumerate(wall_obstacle_tiles[:4]):
        img.paste(tile, (i * TILE, TILE))

    # Row 2: decoration (IDs 9-12)
    for i, tile in enumerate(deco_tiles[:4]):
        img.paste(tile, (i * TILE, 2 * TILE))

    img.save(output_path)
    print(f"  Created {output_path} ({img.size[0]}x{img.size[1]}, {theme_name} theme)")


def generate_composite_tilesets(ground_img, hedge_img, brick_img, wood_img):
    """Generate all 3 composite tilesets by extracting tiles from source images."""

    # --- Hedge Garden ---
    # Ground: grass/earth tones from ground tileset rows 0-1 (cols 0-3 are earthy greens)
    hedge_ground = [
        extract_tile(ground_img, 0, 0),   # Green-grey grass
        extract_tile(ground_img, 1, 0),   # Slightly different grass
        extract_tile(ground_img, 0, 1),   # Grass variant 3
        extract_tile(ground_img, 3, 1),   # Earthy grass variant
    ]
    # Wall + obstacles from hedge_tileset.png (128x192, 4x6 grid)
    # Visual inspection: row 0 has dense hedge tops, row 1-2 has hedge walls, row 3-5 has variations
    hedge_walls = [
        extract_tile(hedge_img, 0, 0),    # Dense hedge wall
        extract_tile(hedge_img, 1, 0),    # Heavy: full hedge block
        extract_tile(hedge_img, 2, 0),    # Medium: partial hedge
        extract_tile(hedge_img, 3, 0),    # Light: thin hedge
    ]
    # Decorations from hedge tileset - pick visually distinct decorative tiles
    hedge_deco = [
        extract_tile(hedge_img, 0, 4),    # Ground with grass detail
        extract_tile(hedge_img, 1, 4),    # Floor detail variant
        extract_tile(hedge_img, 2, 4),    # Another decoration
        extract_tile(hedge_img, 3, 4),    # Grass tuft detail
    ]

    create_composite_tileset(
        hedge_ground, hedge_walls, hedge_deco,
        os.path.join(TILESETS_DIR, "arena_hedge.png"), "hedge"
    )

    # --- Brick Fortress ---
    # Ground: stone/cobblestone tones from ground tileset (darker greys/blues)
    brick_ground = [
        extract_tile(ground_img, 6, 2),   # Stone grey
        extract_tile(ground_img, 6, 3),   # Darker stone
        extract_tile(ground_img, 7, 2),   # Stone variant
        extract_tile(ground_img, 7, 3),   # Stone variant 2
    ]
    # Wall + obstacles from brick_tileset.png
    brick_walls = [
        extract_tile(brick_img, 0, 0),    # Solid brick wall
        extract_tile(brick_img, 1, 0),    # Heavy: full brick block
        extract_tile(brick_img, 2, 0),    # Medium: cracked brick
        extract_tile(brick_img, 3, 0),    # Light: damaged brick
    ]
    # Decorations from brick tileset
    brick_deco = [
        extract_tile(brick_img, 0, 4),    # Stone floor detail
        extract_tile(brick_img, 1, 4),    # Floor variant
        extract_tile(brick_img, 2, 4),    # Crack detail
        extract_tile(brick_img, 3, 4),    # Another decoration
    ]

    create_composite_tileset(
        brick_ground, brick_walls, brick_deco,
        os.path.join(TILESETS_DIR, "arena_brick.png"), "brick"
    )

    # --- Timber Yard ---
    # Ground: dirt/wood-floor tones from ground tileset (brown/earth rows)
    wood_ground = [
        extract_tile(ground_img, 2, 0),   # Earth/dirt
        extract_tile(ground_img, 3, 0),   # Dirt variant
        extract_tile(ground_img, 4, 0),   # Brown earth
        extract_tile(ground_img, 5, 0),   # Earth variant
    ]
    # Wall + obstacles from wood_tileset.png
    wood_walls = [
        extract_tile(wood_img, 0, 0),     # Solid wood wall
        extract_tile(wood_img, 1, 0),     # Heavy: thick timber
        extract_tile(wood_img, 2, 0),     # Medium: wooden barrier
        extract_tile(wood_img, 3, 0),     # Light: thin planks
    ]
    # Decorations from wood tileset
    wood_deco = [
        extract_tile(wood_img, 0, 4),     # Floor detail
        extract_tile(wood_img, 1, 4),     # Wood shavings
        extract_tile(wood_img, 2, 4),     # Bark detail
        extract_tile(wood_img, 3, 4),     # Another decoration
    ]

    create_composite_tileset(
        wood_ground, wood_walls, wood_deco,
        os.path.join(TILESETS_DIR, "arena_wood.png"), "wood"
    )


# ============================================================
# Map generation helpers
# ============================================================

def make_ground_layer(width, height, seed=42):
    """Generate ground layer with weighted random distribution of ground tile IDs + decorations."""
    rng = random.Random(seed)
    data = []
    for _ in range(width * height):
        r = rng.random()
        if r < 0.60:
            data.append(GROUND_IDS[0])   # 60% primary
        elif r < 0.80:
            data.append(GROUND_IDS[1])   # 20% secondary
        elif r < 0.90:
            data.append(GROUND_IDS[2])   # 10% tertiary
        elif r < 0.95:
            data.append(GROUND_IDS[3])   # 5% quaternary
        else:
            data.append(rng.choice(DECO_IDS))  # 5% decoration
    return data


def make_walls_layer(width, height, layout_fn):
    """Generate walls layer: perimeter walls + interior layout from layout function."""
    data = [0] * (width * height)

    # Perimeter walls
    for x in range(width):
        data[0 * width + x] = WALL_ID             # Top row
        data[(height - 1) * width + x] = WALL_ID  # Bottom row
    for y in range(height):
        data[y * width + 0] = WALL_ID             # Left col
        data[y * width + (width - 1)] = WALL_ID   # Right col

    # Interior layout from theme-specific function
    layout_fn(data, width, height)

    return data


def set_tile(data, w, x, y, tile_id):
    """Set a tile at (x, y) in a flat data array of width w, bounds-checked."""
    if 0 <= x < w and 0 <= y < (len(data) // w):
        data[y * w + x] = tile_id


def fill_rect(data, w, h, x1, y1, x2, y2, tile_id):
    """Fill a rectangle (inclusive) with tile_id, clamped to bounds."""
    for y in range(max(0, y1), min(h, y2 + 1)):
        for x in range(max(0, x1), min(w, x2 + 1)):
            data[y * w + x] = tile_id


def fill_hline(data, w, h, x1, x2, y, tile_id):
    """Fill a horizontal line from x1 to x2 at row y."""
    fill_rect(data, w, h, x1, y, x2, y, tile_id)


def fill_vline(data, w, h, x, y1, y2, tile_id):
    """Fill a vertical line from y1 to y2 at col x."""
    fill_rect(data, w, h, x, y1, x, y2, tile_id)


# ============================================================
# Theme-specific map layouts
# ============================================================

def layout_hedge_garden(data, w, h):
    """
    Hedge Garden: Open garden with scattered hedge clusters, 2 long corridors,
    large central clearing, obstacle clusters in corners. Favors Paran speed runs.

    Key features:
    - North-south corridor along left third
    - East-west corridor along middle
    - Large open center
    - Hedge clusters in 4 corners
    - Scattered light obstacles at corridor entrances
    """
    # North-South corridor walls (left third, col 12-13)
    fill_vline(data, w, h, 12, 2, 14, WALL_ID)
    fill_vline(data, w, h, 13, 2, 14, WALL_ID)
    fill_vline(data, w, h, 12, 23, 35, WALL_ID)
    fill_vline(data, w, h, 13, 23, 35, WALL_ID)
    # Gap at center for N-S corridor passage (rows 15-22)

    # East-West corridor walls (middle, rows 17-18)
    fill_hline(data, w, h, 2, 18, 17, WALL_ID)
    fill_hline(data, w, h, 2, 18, 18, WALL_ID)
    fill_hline(data, w, h, 30, 47, 17, WALL_ID)
    fill_hline(data, w, h, 30, 47, 18, WALL_ID)
    # Gap at center columns 19-29 for E-W corridor passage

    # Corner hedge clusters - top-left
    fill_rect(data, w, h, 3, 3, 6, 6, HEAVY_ID)
    fill_rect(data, w, h, 3, 8, 5, 10, MEDIUM_ID)
    fill_rect(data, w, h, 8, 3, 10, 5, MEDIUM_ID)

    # Corner hedge clusters - top-right
    fill_rect(data, w, h, 43, 3, 46, 6, HEAVY_ID)
    fill_rect(data, w, h, 43, 8, 45, 10, MEDIUM_ID)
    fill_rect(data, w, h, 39, 3, 41, 5, MEDIUM_ID)

    # Corner hedge clusters - bottom-left
    fill_rect(data, w, h, 3, 31, 6, 34, HEAVY_ID)
    fill_rect(data, w, h, 3, 27, 5, 29, MEDIUM_ID)
    fill_rect(data, w, h, 8, 32, 10, 34, MEDIUM_ID)

    # Corner hedge clusters - bottom-right
    fill_rect(data, w, h, 43, 31, 46, 34, HEAVY_ID)
    fill_rect(data, w, h, 43, 27, 45, 29, MEDIUM_ID)
    fill_rect(data, w, h, 39, 32, 41, 34, MEDIUM_ID)

    # Scattered light obstacles at corridor entrances
    set_tile(data, w, 11, 15, LIGHT_ID)
    set_tile(data, w, 14, 15, LIGHT_ID)
    set_tile(data, w, 11, 22, LIGHT_ID)
    set_tile(data, w, 14, 22, LIGHT_ID)
    set_tile(data, w, 19, 16, LIGHT_ID)
    set_tile(data, w, 29, 16, LIGHT_ID)
    set_tile(data, w, 19, 19, LIGHT_ID)
    set_tile(data, w, 29, 19, LIGHT_ID)

    # Small wall segments to create interesting angles (right third)
    fill_rect(data, w, h, 35, 8, 37, 8, WALL_ID)
    fill_rect(data, w, h, 35, 29, 37, 29, WALL_ID)

    # Medium obstacles near center for some cover
    fill_rect(data, w, h, 22, 10, 23, 11, MEDIUM_ID)
    fill_rect(data, w, h, 26, 10, 27, 11, MEDIUM_ID)
    fill_rect(data, w, h, 22, 26, 23, 27, MEDIUM_ID)
    fill_rect(data, w, h, 26, 26, 27, 27, MEDIUM_ID)

    # Light obstacles scattered in open areas for minor cover
    set_tile(data, w, 17, 7, LIGHT_ID)
    set_tile(data, w, 32, 7, LIGHT_ID)
    set_tile(data, w, 17, 30, LIGHT_ID)
    set_tile(data, w, 32, 30, LIGHT_ID)
    set_tile(data, w, 24, 19, LIGHT_ID)


def layout_brick_fortress(data, w, h):
    """
    Brick Fortress: Fortress layout with thick wall segments forming rooms/chambers,
    narrow doorways between areas, more walls than open space. Favors guardian positioning.

    Key features:
    - 4 corner rooms with 2-tile doorways
    - Central chamber with 4 entrances
    - Thick wall segments (2-3 tiles wide)
    - Heavy obstacles guarding doorways
    - Multiple corridors between rooms
    """
    # Central chamber walls (rectangle from ~18-31 x 14-23)
    # Top wall of central chamber
    fill_hline(data, w, h, 18, 31, 14, WALL_ID)
    fill_hline(data, w, h, 18, 31, 15, WALL_ID)
    # Bottom wall of central chamber
    fill_hline(data, w, h, 18, 31, 22, WALL_ID)
    fill_hline(data, w, h, 18, 31, 23, WALL_ID)
    # Left wall of central chamber
    fill_vline(data, w, h, 18, 14, 23, WALL_ID)
    fill_vline(data, w, h, 19, 14, 23, WALL_ID)
    # Right wall of central chamber
    fill_vline(data, w, h, 30, 14, 23, WALL_ID)
    fill_vline(data, w, h, 31, 14, 23, WALL_ID)

    # Doorways in central chamber (2-tile gaps)
    # North entrance
    fill_rect(data, w, h, 23, 14, 26, 15, 0)
    # South entrance
    fill_rect(data, w, h, 23, 22, 26, 23, 0)
    # West entrance
    fill_rect(data, w, h, 18, 18, 19, 19, 0)
    # East entrance
    fill_rect(data, w, h, 30, 18, 31, 19, 0)

    # Top-left room
    fill_hline(data, w, h, 2, 14, 10, WALL_ID)
    fill_hline(data, w, h, 2, 14, 11, WALL_ID)
    fill_vline(data, w, h, 14, 2, 11, WALL_ID)
    fill_vline(data, w, h, 15, 2, 11, WALL_ID)
    # Doorway south
    fill_rect(data, w, h, 7, 10, 9, 11, 0)
    # Doorway east
    fill_rect(data, w, h, 14, 5, 15, 7, 0)

    # Top-right room
    fill_hline(data, w, h, 35, 47, 10, WALL_ID)
    fill_hline(data, w, h, 35, 47, 11, WALL_ID)
    fill_vline(data, w, h, 34, 2, 11, WALL_ID)
    fill_vline(data, w, h, 35, 2, 11, WALL_ID)
    # Doorway south
    fill_rect(data, w, h, 40, 10, 42, 11, 0)
    # Doorway west
    fill_rect(data, w, h, 34, 5, 35, 7, 0)

    # Bottom-left room
    fill_hline(data, w, h, 2, 14, 26, WALL_ID)
    fill_hline(data, w, h, 2, 14, 27, WALL_ID)
    fill_vline(data, w, h, 14, 26, 35, WALL_ID)
    fill_vline(data, w, h, 15, 26, 35, WALL_ID)
    # Doorway north
    fill_rect(data, w, h, 7, 26, 9, 27, 0)
    # Doorway east
    fill_rect(data, w, h, 14, 30, 15, 32, 0)

    # Bottom-right room
    fill_hline(data, w, h, 35, 47, 26, WALL_ID)
    fill_hline(data, w, h, 35, 47, 27, WALL_ID)
    fill_vline(data, w, h, 34, 26, 35, WALL_ID)
    fill_vline(data, w, h, 35, 26, 35, WALL_ID)
    # Doorway north
    fill_rect(data, w, h, 40, 26, 42, 27, 0)
    # Doorway west
    fill_rect(data, w, h, 34, 30, 35, 32, 0)

    # Heavy obstacles at doorways of central chamber
    set_tile(data, w, 22, 13, HEAVY_ID)
    set_tile(data, w, 27, 13, HEAVY_ID)
    set_tile(data, w, 22, 24, HEAVY_ID)
    set_tile(data, w, 27, 24, HEAVY_ID)
    set_tile(data, w, 17, 17, HEAVY_ID)
    set_tile(data, w, 17, 20, HEAVY_ID)
    set_tile(data, w, 32, 17, HEAVY_ID)
    set_tile(data, w, 32, 20, HEAVY_ID)

    # Medium obstacles inside rooms for cover
    # Top-left room
    fill_rect(data, w, h, 5, 4, 6, 5, MEDIUM_ID)
    fill_rect(data, w, h, 10, 7, 11, 8, MEDIUM_ID)

    # Top-right room
    fill_rect(data, w, h, 43, 4, 44, 5, MEDIUM_ID)
    fill_rect(data, w, h, 38, 7, 39, 8, MEDIUM_ID)

    # Bottom-left room
    fill_rect(data, w, h, 5, 32, 6, 33, MEDIUM_ID)
    fill_rect(data, w, h, 10, 29, 11, 30, MEDIUM_ID)

    # Bottom-right room
    fill_rect(data, w, h, 43, 32, 44, 33, MEDIUM_ID)
    fill_rect(data, w, h, 38, 29, 39, 30, MEDIUM_ID)

    # Light obstacles in corridor transitions
    set_tile(data, w, 16, 6, LIGHT_ID)
    set_tile(data, w, 33, 6, LIGHT_ID)
    set_tile(data, w, 16, 31, LIGHT_ID)
    set_tile(data, w, 33, 31, LIGHT_ID)

    # Small wall stubs in corridors for tactical cover
    fill_rect(data, w, h, 24, 3, 25, 5, WALL_ID)
    fill_rect(data, w, h, 24, 32, 25, 34, WALL_ID)

    # Light obstacles inside central chamber
    set_tile(data, w, 23, 17, LIGHT_ID)
    set_tile(data, w, 26, 17, LIGHT_ID)
    set_tile(data, w, 23, 20, LIGHT_ID)
    set_tile(data, w, 26, 20, LIGHT_ID)


def layout_timber_yard(data, w, h):
    """
    Timber Yard: Symmetric arena with wooden barriers in cross/X pattern,
    medium-width paths, balanced mix of open and closed areas.

    Key features:
    - Central X/cross pattern of walls
    - 4 symmetric quadrants
    - Medium-width paths (3-4 tiles)
    - Balanced obstacle placement
    - Destructible barriers at key intersections
    """
    cx, cy = w // 2, h // 2  # 25, 19

    # Vertical spine (center column, with gaps)
    fill_vline(data, w, h, cx - 1, 2, 7, WALL_ID)
    fill_vline(data, w, h, cx, 2, 7, WALL_ID)
    fill_vline(data, w, h, cx - 1, 12, 16, WALL_ID)
    fill_vline(data, w, h, cx, 12, 16, WALL_ID)
    fill_vline(data, w, h, cx - 1, 21, 25, WALL_ID)
    fill_vline(data, w, h, cx, 21, 25, WALL_ID)
    fill_vline(data, w, h, cx - 1, 30, 35, WALL_ID)
    fill_vline(data, w, h, cx, 30, 35, WALL_ID)

    # Horizontal spine (center row, with gaps)
    fill_hline(data, w, h, 2, 8, cy - 1, WALL_ID)
    fill_hline(data, w, h, 2, 8, cy, WALL_ID)
    fill_hline(data, w, h, 13, 20, cy - 1, WALL_ID)
    fill_hline(data, w, h, 13, 20, cy, WALL_ID)
    fill_hline(data, w, h, 29, 36, cy - 1, WALL_ID)
    fill_hline(data, w, h, 29, 36, cy, WALL_ID)
    fill_hline(data, w, h, 41, 47, cy - 1, WALL_ID)
    fill_hline(data, w, h, 41, 47, cy, WALL_ID)

    # Diagonal wall segments (top-left to center)
    for i in range(6):
        set_tile(data, w, 6 + i, 5 + i, WALL_ID)
        set_tile(data, w, 7 + i, 5 + i, WALL_ID)

    # Diagonal wall segments (top-right to center)
    for i in range(6):
        set_tile(data, w, 42 - i, 5 + i, WALL_ID)
        set_tile(data, w, 41 - i, 5 + i, WALL_ID)

    # Diagonal wall segments (bottom-left to center)
    for i in range(6):
        set_tile(data, w, 6 + i, 32 - i, WALL_ID)
        set_tile(data, w, 7 + i, 32 - i, WALL_ID)

    # Diagonal wall segments (bottom-right to center)
    for i in range(6):
        set_tile(data, w, 42 - i, 32 - i, WALL_ID)
        set_tile(data, w, 41 - i, 32 - i, WALL_ID)

    # Heavy obstacles near center (4 pillars around center)
    fill_rect(data, w, h, cx - 4, cy - 4, cx - 3, cy - 3, HEAVY_ID)
    fill_rect(data, w, h, cx + 2, cy - 4, cx + 3, cy - 3, HEAVY_ID)
    fill_rect(data, w, h, cx - 4, cy + 2, cx - 3, cy + 3, HEAVY_ID)
    fill_rect(data, w, h, cx + 2, cy + 2, cx + 3, cy + 3, HEAVY_ID)

    # Medium obstacles at quadrant interiors
    # Top-left quadrant
    fill_rect(data, w, h, 5, 5, 6, 6, MEDIUM_ID)
    fill_rect(data, w, h, 4, 13, 5, 14, MEDIUM_ID)

    # Top-right quadrant
    fill_rect(data, w, h, 43, 5, 44, 6, MEDIUM_ID)
    fill_rect(data, w, h, 44, 13, 45, 14, MEDIUM_ID)

    # Bottom-left quadrant
    fill_rect(data, w, h, 5, 31, 6, 32, MEDIUM_ID)
    fill_rect(data, w, h, 4, 23, 5, 24, MEDIUM_ID)

    # Bottom-right quadrant
    fill_rect(data, w, h, 43, 31, 44, 32, MEDIUM_ID)
    fill_rect(data, w, h, 44, 23, 45, 24, MEDIUM_ID)

    # Light obstacles at corridor gap entrances
    set_tile(data, w, cx - 2, 8, LIGHT_ID)
    set_tile(data, w, cx + 1, 8, LIGHT_ID)
    set_tile(data, w, cx - 2, 29, LIGHT_ID)
    set_tile(data, w, cx + 1, 29, LIGHT_ID)
    set_tile(data, w, 9, cy - 2, LIGHT_ID)
    set_tile(data, w, 9, cy + 1, LIGHT_ID)
    set_tile(data, w, 40, cy - 2, LIGHT_ID)
    set_tile(data, w, 40, cy + 1, LIGHT_ID)

    # Destructible barriers at spine gaps (can be broken through)
    set_tile(data, w, cx - 1, 8, MEDIUM_ID)
    set_tile(data, w, cx, 8, MEDIUM_ID)
    set_tile(data, w, cx - 1, 29, MEDIUM_ID)
    set_tile(data, w, cx, 29, MEDIUM_ID)
    set_tile(data, w, 9, cy - 1, MEDIUM_ID)
    set_tile(data, w, 9, cy, MEDIUM_ID)
    set_tile(data, w, 40, cy - 1, MEDIUM_ID)
    set_tile(data, w, 40, cy, MEDIUM_ID)

    # Light obstacles in open quadrant areas for minor cover
    set_tile(data, w, 15, 6, LIGHT_ID)
    set_tile(data, w, 34, 6, LIGHT_ID)
    set_tile(data, w, 15, 31, LIGHT_ID)
    set_tile(data, w, 34, 31, LIGHT_ID)


# ============================================================
# Map JSON generation
# ============================================================

def generate_map_json(theme_name, tileset_name, tileset_image, layout_fn, output_path, seed=42):
    """Generate a Tiled-compatible map JSON file."""
    ground_data = make_ground_layer(MAP_W, MAP_H, seed=seed)
    walls_data = make_walls_layer(MAP_W, MAP_H, layout_fn)

    # Apply ground data: where walls exist, set ground to primary (tile 1) for clean look under walls
    for i in range(len(walls_data)):
        if walls_data[i] != 0:
            ground_data[i] = GROUND_IDS[0]

    map_json = {
        "compressionlevel": -1,
        "width": MAP_W,
        "height": MAP_H,
        "tilewidth": TILE,
        "tileheight": TILE,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.10.2",
        "type": "map",
        "version": "1.10",
        "infinite": False,
        "nextlayerid": 3,
        "nextobjectid": 1,
        "properties": [
            {
                "name": "tileMapping",
                "type": "string",
                "value": "1-4=ground, 5=wall, 6=heavy_obstacle, 7=medium_obstacle, 8=light_obstacle, 9-12=decoration"
            }
        ],
        "tilesets": [
            {
                "firstgid": 1,
                "columns": 4,
                "image": f"../tilesets/{tileset_image}",
                "imagewidth": 128,
                "imageheight": 96,
                "margin": 0,
                "name": tileset_name,
                "spacing": 0,
                "tilecount": 12,
                "tilewidth": TILE,
                "tileheight": TILE
            }
        ],
        "layers": [
            {
                "data": ground_data,
                "height": MAP_H,
                "id": 1,
                "name": "Ground",
                "opacity": 1,
                "type": "tilelayer",
                "visible": True,
                "width": MAP_W,
                "x": 0,
                "y": 0
            },
            {
                "data": walls_data,
                "height": MAP_H,
                "id": 2,
                "name": "Walls",
                "opacity": 1,
                "type": "tilelayer",
                "visible": True,
                "width": MAP_W,
                "x": 0,
                "y": 0
            }
        ]
    }

    with open(output_path, "w") as f:
        json.dump(map_json, f, indent=2)

    # Count tiles for stats
    wall_count = sum(1 for t in walls_data if t == WALL_ID)
    obstacle_count = sum(1 for t in walls_data if t in (HEAVY_ID, MEDIUM_ID, LIGHT_ID))
    empty_count = sum(1 for t in walls_data if t == 0)
    print(f"  Created {output_path} ({MAP_W}x{MAP_H}, walls={wall_count}, obstacles={obstacle_count}, open={empty_count})")


def verify_no_sealed_rooms(data, w, h):
    """
    Verify all open spaces are reachable from each other using flood fill.
    Returns True if no sealed rooms, False otherwise.
    """
    # Find first open cell
    start = None
    for i in range(len(data)):
        if data[i] == 0:
            start = i
            break

    if start is None:
        return True  # No open cells at all

    # BFS flood fill from start
    visited = set()
    queue = [start]
    visited.add(start)

    while queue:
        idx = queue.pop(0)
        x = idx % w
        y = idx // w

        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if nidx not in visited and data[nidx] == 0:
                    visited.add(nidx)
                    queue.append(nidx)

    # Check if all open cells were reached
    total_open = sum(1 for t in data if t == 0)
    if len(visited) == total_open:
        return True
    else:
        print(f"  WARNING: Sealed room detected! Reachable: {len(visited)}, Total open: {total_open}")
        return False


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    print("Generating arena assets...")
    print()

    print("[1/2] Loading source tilesets...")
    ground_img, hedge_img, brick_img, wood_img = load_source_tilesets()
    print(f"  Ground: {ground_img.size}, Hedge: {hedge_img.size}, Brick: {brick_img.size}, Wood: {wood_img.size}")

    print()
    print("[2/2] Generating composite tilesets + map JSONs...")
    print()

    # Generate composite tilesets
    print("  --- Composite Tilesets ---")
    generate_composite_tilesets(ground_img, hedge_img, brick_img, wood_img)
    print()

    # Generate map JSONs
    print("  --- Map JSONs ---")
    generate_map_json(
        "hedge_garden", "arena_hedge", "arena_hedge.png",
        layout_hedge_garden,
        os.path.join(MAPS_DIR, "hedge_garden.json"),
        seed=100
    )
    generate_map_json(
        "brick_fortress", "arena_brick", "arena_brick.png",
        layout_brick_fortress,
        os.path.join(MAPS_DIR, "brick_fortress.json"),
        seed=200
    )
    generate_map_json(
        "timber_yard", "arena_wood", "arena_wood.png",
        layout_timber_yard,
        os.path.join(MAPS_DIR, "timber_yard.json"),
        seed=300
    )
    print()

    # Verify no sealed rooms
    print("  --- Verifying map connectivity ---")
    for map_name in ["hedge_garden", "brick_fortress", "timber_yard"]:
        path = os.path.join(MAPS_DIR, f"{map_name}.json")
        with open(path) as f:
            d = json.load(f)
        walls = d["layers"][1]["data"]
        ok = verify_no_sealed_rooms(walls, MAP_W, MAP_H)
        print(f"  {map_name}: {'PASS - all areas reachable' if ok else 'FAIL - sealed rooms found'}")

    print()
    print("All arena assets generated successfully!")

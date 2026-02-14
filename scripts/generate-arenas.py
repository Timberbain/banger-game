#!/usr/bin/env python3
"""
Generate composite tileset PNGs and arena map JSONs for 3 themed arenas.

Produces:
  - 3 composite tilesets (256x448, 8x14 grid of 32x32 tiles)
  - 3 map JSONs (50x38 tiles, 3 layers: Ground, WallFronts, Walls)

Composite tileset layout (firstgid=1):
  Rows 0-5 (IDs 1-48): Wall canopy auto-tiles (collision, indestructible)
  Rows 6-11 (IDs 49-96): Wall front face auto-tiles (visual only)
  Row 12 (IDs 97-104): Ground (97-100), Obstacle canopy (101-103), empty (104)
  Row 13 (IDs 105-112): Decoration (105-108), Obstacle front (109-111), empty (112)

Auto-tiling:
  Uses 8-neighbor rules from tileset_reference.json applied to 16x32 reference
  tilesets. Each 16x32 sprite is split into canopy (top 16px) and front face
  (bottom 16px), both upscaled 2x to 32x32.

Pseudo-3D depth:
  3 tile layers render bottom-to-top: Ground -> WallFronts -> Walls.
  Front face tiles are placed one row below the wall, creating a south-facing
  pseudo-3D effect. Canopies naturally occlude front faces from the row above.

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
WALLS_DIR = os.path.join(ASSETS_DIR, "walls")
TILESETS_DIR = os.path.join(PROJECT_ROOT, "client", "public", "tilesets")
MAPS_DIR = os.path.join(PROJECT_ROOT, "client", "public", "maps")

os.makedirs(TILESETS_DIR, exist_ok=True)
os.makedirs(MAPS_DIR, exist_ok=True)

TILE = 32
TILE_HALF = 16
MAP_W = 50
MAP_H = 38

# Layout sentinel: walls are marked with this during layout, then auto-tiled
WALL_ID = -1  # Sentinel resolved to auto-tile IDs 1-48 after layout

# Final tile IDs in map data (firstgid=1, 0=empty)
GROUND_IDS = [97, 98, 99, 100]
HEAVY_ID = 101
MEDIUM_ID = 102
LIGHT_ID = 103
DECO_IDS = [105, 106, 107, 108]

# Obstacle canopy set for neighbor detection during auto-tiling
OBSTACLE_IDS = {HEAVY_ID, MEDIUM_ID, LIGHT_ID}

# Front face offsets
WALL_FRONT_OFFSET = 48    # wall front ID = canopy ID + 48
OBSTACLE_FRONT_OFFSET = 8  # obstacle front ID = canopy ID + 8

# ============================================================
# Tile extraction helpers
# ============================================================

def extract_tile_32(img, col, row):
    """Extract a 32x32 tile from a grid-based tileset image."""
    tile = img.crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE))
    return tile.convert("RGBA")


def extract_sprite_16x32(img, index):
    """Extract a 16x32 sprite from the reference tileset by sprite index (0-47)."""
    col = index % 8
    row = index // 8
    x = col * TILE_HALF
    y = row * TILE
    return img.crop((x, y, x + TILE_HALF, y + TILE)).convert("RGBA")


def split_sprite(sprite):
    """Split a 16x32 sprite into canopy (top 16x16) and front face (bottom 16x16)."""
    canopy = sprite.crop((0, 0, TILE_HALF, TILE_HALF))
    front = sprite.crop((0, TILE_HALF, TILE_HALF, TILE))
    return canopy, front


def upscale_2x(img):
    """Upscale image 2x using nearest neighbor (crisp pixel art)."""
    return img.resize((img.width * 2, img.height * 2), Image.NEAREST)


def apply_opacity(img, factor):
    """Multiply alpha channel by factor (0.0-1.0)."""
    if factor >= 1.0:
        return img.copy()
    result = img.copy()
    r, g, b, a = result.split()
    a = a.point(lambda x: int(x * factor))
    return Image.merge("RGBA", (r, g, b, a))


# ============================================================
# Source loading
# ============================================================

def load_source_images():
    """Load ground atlas and reference wall tilesets."""
    ground = Image.open(os.path.join(ASSETS_DIR, "32x32 topdown tileset Spreadsheet V1-1.png"))
    hedge = Image.open(os.path.join(WALLS_DIR, "hedge_tileset.png"))
    brick = Image.open(os.path.join(WALLS_DIR, "brick_tileset.png"))
    wood = Image.open(os.path.join(WALLS_DIR, "wood_tileset.png"))
    return ground, hedge, brick, wood


def load_autotile_rules():
    """Load auto-tile rules from reference JSON."""
    ref_path = os.path.join(WALLS_DIR, "tileset_reference.json")
    with open(ref_path) as f:
        ref = json.load(f)
    return ref["autoTileRules"]


# ============================================================
# Composite tileset generation
# ============================================================

def create_composite_tileset(ref_img, ground_tiles, deco_tiles, output_path, theme_name):
    """
    Create a 256x448 composite tileset (8 cols x 14 rows of 32x32 tiles).

    ref_img: 128x192 reference tileset (8 cols x 6 rows of 16x32 sprites)
    ground_tiles: list of 4 PIL Image tiles (32x32)
    deco_tiles: list of 4 PIL Image tiles (32x32)
    """
    composite = Image.new("RGBA", (8 * TILE, 14 * TILE), (0, 0, 0, 0))

    # Extract all 48 sprites, split into canopy+front, upscale to 32x32
    canopies = []
    fronts = []
    for i in range(48):
        sprite = extract_sprite_16x32(ref_img, i)
        canopy, front = split_sprite(sprite)
        canopies.append(upscale_2x(canopy))
        fronts.append(upscale_2x(front))

    # Rows 0-5: canopy auto-tiles (IDs 1-48)
    for i in range(48):
        col = i % 8
        row = i // 8
        composite.paste(canopies[i], (col * TILE, row * TILE))

    # Rows 6-11: front face auto-tiles (IDs 49-96)
    for i in range(48):
        col = i % 8
        row = 6 + i // 8
        composite.paste(fronts[i], (col * TILE, row * TILE))

    # Row 12, cols 0-3: ground tiles (IDs 97-100)
    for i, tile in enumerate(ground_tiles[:4]):
        composite.paste(tile, (i * TILE, 12 * TILE))

    # Row 12, cols 4-6: obstacle canopies (IDs 101-103) Heavy/Medium/Light
    # Use isolated_single sprite (index 0) canopy with opacity tinting
    obstacle_canopy = canopies[0]
    for j, opacity in enumerate([1.0, 0.8, 0.6]):
        tinted = apply_opacity(obstacle_canopy, opacity)
        composite.paste(tinted, ((4 + j) * TILE, 12 * TILE))

    # Row 13, cols 0-3: decoration tiles (IDs 105-108)
    for i, tile in enumerate(deco_tiles[:4]):
        composite.paste(tile, (i * TILE, 13 * TILE))

    # Row 13, cols 4-6: obstacle front faces (IDs 109-111) Heavy/Medium/Light
    obstacle_front = fronts[0]
    for j, opacity in enumerate([1.0, 0.8, 0.6]):
        tinted = apply_opacity(obstacle_front, opacity)
        composite.paste(tinted, ((4 + j) * TILE, 13 * TILE))

    composite.save(output_path)
    print(f"  Created {output_path} ({composite.size[0]}x{composite.size[1]}, {theme_name} theme)")


def generate_all_tilesets(ground_img, hedge_img, brick_img, wood_img):
    """Generate all 3 composite tilesets."""

    themes = {
        'hedge': {
            'ref': hedge_img,
            'ground': [(0, 0), (1, 0), (0, 1), (3, 1)],
            'deco': [(4, 0), (5, 0), (4, 1), (5, 1)],
            'output': 'arena_hedge.png',
        },
        'brick': {
            'ref': brick_img,
            'ground': [(6, 2), (6, 3), (7, 2), (7, 3)],
            'deco': [(5, 2), (5, 3), (4, 2), (4, 3)],
            'output': 'arena_brick.png',
        },
        'wood': {
            'ref': wood_img,
            'ground': [(2, 0), (3, 0), (4, 0), (5, 0)],
            'deco': [(6, 0), (7, 0), (6, 1), (7, 1)],
            'output': 'arena_wood.png',
        },
    }

    for theme_name, cfg in themes.items():
        ground_tiles = [extract_tile_32(ground_img, c, r) for c, r in cfg['ground']]
        deco_tiles = [extract_tile_32(ground_img, c, r) for c, r in cfg['deco']]
        create_composite_tileset(
            cfg['ref'], ground_tiles, deco_tiles,
            os.path.join(TILESETS_DIR, cfg['output']),
            theme_name
        )


# ============================================================
# Auto-tiling algorithm
# ============================================================

def is_solid(tile_id):
    """Check if a tile is solid (wall sentinel or obstacle) for auto-tile neighbor checks."""
    return tile_id == WALL_ID or tile_id in OBSTACLE_IDS


DIR_OFFSETS = {
    'N': (0, -1), 'NE': (1, -1), 'E': (1, 0), 'SE': (1, 1),
    'S': (0, 1), 'SW': (-1, 1), 'W': (-1, 0), 'NW': (-1, -1)
}


def get_neighbor_state(data, w, h, x, y):
    """Get 8-neighbor state. Out-of-bounds = present (solid)."""
    neighbors = {}
    for dir_name, (dx, dy) in DIR_OFFSETS.items():
        nx, ny = x + dx, y + dy
        if nx < 0 or nx >= w or ny < 0 or ny >= h:
            neighbors[dir_name] = True  # out of bounds = present
        else:
            neighbors[dir_name] = is_solid(data[ny * w + nx])
    return neighbors


def resolve_autotile(data, w, h, rules):
    """
    Two-pass auto-tiling: compute all tile resolutions from original neighbor state,
    then apply. This avoids order-dependent issues from raster scan.
    """
    resolutions = {}  # (x, y) -> canopy_id

    for y in range(h):
        for x in range(w):
            if data[y * w + x] != WALL_ID:
                continue

            neighbors = get_neighbor_state(data, w, h, x, y)

            # Evaluate rules in order, first match wins
            canopy_id = 1  # default: isolated_single (sprite 0 -> ID 1)
            for rule in rules:
                rule_match = True
                for dir_name, required in rule['neighbors'].items():
                    if neighbors.get(dir_name) != required:
                        rule_match = False
                        break
                if rule_match:
                    canopy_id = rule['spriteIndex'] + 1  # firstgid=1
                    break

            resolutions[(x, y)] = canopy_id

    # Apply all at once
    for (x, y), canopy_id in resolutions.items():
        data[y * w + x] = canopy_id


def generate_front_faces(walls_data, w, h):
    """
    Generate WallFronts layer from Walls layer.
    For each solid tile, place front face at (x, y+1) if y+1 is empty.
    """
    fronts_data = [0] * (w * h)

    for y in range(h):
        for x in range(w):
            tile = walls_data[y * w + x]
            if tile == 0:
                continue

            # Check if row below is empty and within bounds
            if y + 1 >= h:
                continue
            below = walls_data[(y + 1) * w + x]
            if below != 0:
                continue  # occluded by canopy below

            # Determine front face ID
            if 1 <= tile <= 48:
                # Wall auto-tile -> front face
                fronts_data[(y + 1) * w + x] = tile + WALL_FRONT_OFFSET
            elif tile in OBSTACLE_IDS:
                # Obstacle -> front face
                fronts_data[(y + 1) * w + x] = tile + OBSTACLE_FRONT_OFFSET

    return fronts_data


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
    """
    # North-South corridor walls (left third, col 12-13)
    fill_vline(data, w, h, 12, 2, 14, WALL_ID)
    fill_vline(data, w, h, 13, 2, 14, WALL_ID)
    fill_vline(data, w, h, 12, 23, 35, WALL_ID)
    fill_vline(data, w, h, 13, 23, 35, WALL_ID)

    # East-West corridor walls (middle, rows 17-18)
    fill_hline(data, w, h, 2, 18, 17, WALL_ID)
    fill_hline(data, w, h, 2, 18, 18, WALL_ID)
    fill_hline(data, w, h, 30, 47, 17, WALL_ID)
    fill_hline(data, w, h, 30, 47, 18, WALL_ID)

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
    """
    # Central chamber walls (rectangle from ~18-31 x 14-23)
    fill_hline(data, w, h, 18, 31, 14, WALL_ID)
    fill_hline(data, w, h, 18, 31, 15, WALL_ID)
    fill_hline(data, w, h, 18, 31, 22, WALL_ID)
    fill_hline(data, w, h, 18, 31, 23, WALL_ID)
    fill_vline(data, w, h, 18, 14, 23, WALL_ID)
    fill_vline(data, w, h, 19, 14, 23, WALL_ID)
    fill_vline(data, w, h, 30, 14, 23, WALL_ID)
    fill_vline(data, w, h, 31, 14, 23, WALL_ID)

    # Doorways in central chamber (2-tile gaps)
    fill_rect(data, w, h, 23, 14, 26, 15, 0)
    fill_rect(data, w, h, 23, 22, 26, 23, 0)
    fill_rect(data, w, h, 18, 18, 19, 19, 0)
    fill_rect(data, w, h, 30, 18, 31, 19, 0)

    # Top-left room
    fill_hline(data, w, h, 2, 14, 10, WALL_ID)
    fill_hline(data, w, h, 2, 14, 11, WALL_ID)
    fill_vline(data, w, h, 14, 2, 11, WALL_ID)
    fill_vline(data, w, h, 15, 2, 11, WALL_ID)
    fill_rect(data, w, h, 7, 10, 9, 11, 0)
    fill_rect(data, w, h, 14, 5, 15, 7, 0)

    # Top-right room
    fill_hline(data, w, h, 35, 47, 10, WALL_ID)
    fill_hline(data, w, h, 35, 47, 11, WALL_ID)
    fill_vline(data, w, h, 34, 2, 11, WALL_ID)
    fill_vline(data, w, h, 35, 2, 11, WALL_ID)
    fill_rect(data, w, h, 40, 10, 42, 11, 0)
    fill_rect(data, w, h, 34, 5, 35, 7, 0)

    # Bottom-left room
    fill_hline(data, w, h, 2, 14, 26, WALL_ID)
    fill_hline(data, w, h, 2, 14, 27, WALL_ID)
    fill_vline(data, w, h, 14, 26, 35, WALL_ID)
    fill_vline(data, w, h, 15, 26, 35, WALL_ID)
    fill_rect(data, w, h, 7, 26, 9, 27, 0)
    fill_rect(data, w, h, 14, 30, 15, 32, 0)

    # Bottom-right room
    fill_hline(data, w, h, 35, 47, 26, WALL_ID)
    fill_hline(data, w, h, 35, 47, 27, WALL_ID)
    fill_vline(data, w, h, 34, 26, 35, WALL_ID)
    fill_vline(data, w, h, 35, 26, 35, WALL_ID)
    fill_rect(data, w, h, 40, 26, 42, 27, 0)
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
    fill_rect(data, w, h, 5, 4, 6, 5, MEDIUM_ID)
    fill_rect(data, w, h, 10, 7, 11, 8, MEDIUM_ID)
    fill_rect(data, w, h, 43, 4, 44, 5, MEDIUM_ID)
    fill_rect(data, w, h, 38, 7, 39, 8, MEDIUM_ID)
    fill_rect(data, w, h, 5, 32, 6, 33, MEDIUM_ID)
    fill_rect(data, w, h, 10, 29, 11, 30, MEDIUM_ID)
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
    fill_rect(data, w, h, 5, 5, 6, 6, MEDIUM_ID)
    fill_rect(data, w, h, 4, 13, 5, 14, MEDIUM_ID)
    fill_rect(data, w, h, 43, 5, 44, 6, MEDIUM_ID)
    fill_rect(data, w, h, 44, 13, 45, 14, MEDIUM_ID)
    fill_rect(data, w, h, 5, 31, 6, 32, MEDIUM_ID)
    fill_rect(data, w, h, 4, 23, 5, 24, MEDIUM_ID)
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

def generate_map_json(theme_name, tileset_name, tileset_image, layout_fn, output_path, rules, seed=42):
    """Generate a 3-layer Tiled-compatible map JSON file."""
    # Generate raw walls layer (with sentinels for walls, direct IDs for obstacles)
    walls_data = make_walls_layer(MAP_W, MAP_H, layout_fn)

    # Auto-tile: resolve wall sentinels (-1) to canopy IDs (1-48)
    resolve_autotile(walls_data, MAP_W, MAP_H, rules)

    # Generate front faces layer from resolved walls
    fronts_data = generate_front_faces(walls_data, MAP_W, MAP_H)

    # Generate ground layer
    ground_data = make_ground_layer(MAP_W, MAP_H, seed=seed)

    # Under walls and front faces, use primary ground tile for clean look
    for i in range(len(walls_data)):
        if walls_data[i] != 0:
            ground_data[i] = GROUND_IDS[0]
    for i in range(len(fronts_data)):
        if fronts_data[i] != 0:
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
        "nextlayerid": 4,
        "nextobjectid": 1,
        "tilesets": [
            {
                "firstgid": 1,
                "columns": 8,
                "image": f"../tilesets/{tileset_image}",
                "imagewidth": 256,
                "imageheight": 448,
                "margin": 0,
                "name": tileset_name,
                "spacing": 0,
                "tilecount": 112,
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
                "data": fronts_data,
                "height": MAP_H,
                "id": 2,
                "name": "WallFronts",
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
                "id": 3,
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
    wall_count = sum(1 for t in walls_data if 1 <= t <= 48)
    obstacle_count = sum(1 for t in walls_data if t in OBSTACLE_IDS)
    front_count = sum(1 for t in fronts_data if t != 0)
    empty_count = sum(1 for t in walls_data if t == 0)
    print(f"  Created {output_path} ({MAP_W}x{MAP_H}, walls={wall_count}, obstacles={obstacle_count}, fronts={front_count}, open={empty_count})")


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
# Spawn validation
# ============================================================

def _is_solid_for_spawn(tile_id):
    """Check if a tile is solid (wall auto-tile 1-48 or obstacle 101-103)."""
    return (1 <= tile_id <= 48) or tile_id in OBSTACLE_IDS


def find_safe_spawn(data, w, h, region, buffer=1):
    """
    Find a spawn-safe coordinate within a region.

    Parameters:
        data: Walls layer tile array (flat, length w*h)
        w, h: map dimensions in tiles
        region: (x1, y1, x2, y2) search area in tile coordinates (inclusive)
        buffer: number of clear tiles required around spawn (default 1)

    Returns pixel coordinates (tileX * 32 + 16, tileY * 32 + 16) centered on tile,
    or None if no safe position found.
    """
    x1, y1, x2, y2 = region
    for ty in range(max(0, y1), min(h, y2 + 1)):
        for tx in range(max(0, x1), min(w, x2 + 1)):
            # Check (2*buffer+1) x (2*buffer+1) area centered on candidate
            clear = True
            for dy in range(-buffer, buffer + 1):
                for dx in range(-buffer, buffer + 1):
                    cx, cy = tx + dx, ty + dy
                    if cx < 0 or cx >= w or cy < 0 or cy >= h:
                        clear = False
                        break
                    if _is_solid_for_spawn(data[cy * w + cx]):
                        clear = False
                        break
                if not clear:
                    break
            if clear:
                return (tx * TILE + TILE // 2, ty * TILE + TILE // 2)
    return None


def validate_spawns():
    """
    Validate spawn positions for all maps. For each map, checks that known
    spawn coordinates land on open ground with 1-tile buffer clearance.

    Also searches each region to confirm safe spawns exist.
    """
    # Per-map spawn points (pixel coords) and their expected tile positions
    map_spawns = {
        "hedge_garden": {
            "paran":  {"px": (800, 480),  "region": (16, 12, 33, 25)},
            "faran":  {"px": (512, 96),   "region": (3, 3, 20, 15)},
            "baran":  {"px": (960, 736),  "region": (30, 23, 46, 34)},
        },
        "brick_fortress": {
            "paran":  {"px": (768, 384),  "region": (16, 12, 33, 25)},
            "faran":  {"px": (288, 96),   "region": (3, 3, 20, 15)},
            "baran":  {"px": (1088, 640), "region": (30, 23, 46, 34)},
        },
        "timber_yard": {
            "paran":  {"px": (640, 384),  "region": (16, 12, 33, 25)},
            "faran":  {"px": (128, 96),   "region": (3, 3, 20, 15)},
            "baran":  {"px": (1216, 640), "region": (30, 23, 46, 34)},
        },
    }

    all_pass = True
    for map_name, roles in map_spawns.items():
        map_path = os.path.join(MAPS_DIR, f"{map_name}.json")
        with open(map_path) as f:
            d = json.load(f)
        walls = d["layers"][2]["data"]
        w = d["width"]
        h = d["height"]

        for role, cfg in roles.items():
            px, py = cfg["px"]
            tx, ty = px // TILE, py // TILE

            # Check the tile and its 1-tile buffer neighborhood
            clear = True
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    cx, cy = tx + dx, ty + dy
                    if cx < 0 or cx >= w or cy < 0 or cy >= h:
                        clear = False
                        break
                    if _is_solid_for_spawn(walls[cy * w + cx]):
                        clear = False
                        break
                if not clear:
                    break

            if clear:
                print(f"  {map_name} {role}: ({px},{py}) tile({tx},{ty}) PASS")
            else:
                print(f"  {map_name} {role}: ({px},{py}) tile({tx},{ty}) FAIL - solid tile in buffer zone")
                all_pass = False

            # Also verify a safe spawn exists in the region via search
            found = find_safe_spawn(walls, w, h, cfg["region"], buffer=1)
            if found is None:
                print(f"    WARNING: No safe spawn found in region {cfg['region']} for {map_name} {role}")
                all_pass = False

    if not all_pass:
        raise RuntimeError("Spawn validation failed! Some spawn points are on or adjacent to solid tiles.")
    print("  All 9 spawn points validated successfully.")


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    print("Generating arena assets...")
    print()

    print("[1/3] Loading source images + auto-tile rules...")
    ground_img, hedge_img, brick_img, wood_img = load_source_images()
    rules = load_autotile_rules()
    print(f"  Ground atlas: {ground_img.size}")
    print(f"  Hedge ref: {hedge_img.size}, Brick ref: {brick_img.size}, Wood ref: {wood_img.size}")
    print(f"  Auto-tile rules: {len(rules)} rules loaded")

    print()
    print("[2/3] Generating composite tilesets (256x448, 8x14 grid)...")
    print()
    generate_all_tilesets(ground_img, hedge_img, brick_img, wood_img)

    print()
    print("[3/3] Generating 3-layer map JSONs (Ground + WallFronts + Walls)...")
    print()
    generate_map_json(
        "hedge_garden", "arena_hedge", "arena_hedge.png",
        layout_hedge_garden,
        os.path.join(MAPS_DIR, "hedge_garden.json"),
        rules, seed=100
    )
    generate_map_json(
        "brick_fortress", "arena_brick", "arena_brick.png",
        layout_brick_fortress,
        os.path.join(MAPS_DIR, "brick_fortress.json"),
        rules, seed=200
    )
    generate_map_json(
        "timber_yard", "arena_wood", "arena_wood.png",
        layout_timber_yard,
        os.path.join(MAPS_DIR, "timber_yard.json"),
        rules, seed=300
    )

    print()
    print("  --- Verifying map connectivity ---")
    for map_name in ["hedge_garden", "brick_fortress", "timber_yard"]:
        map_path = os.path.join(MAPS_DIR, f"{map_name}.json")
        with open(map_path) as f:
            d = json.load(f)
        # Walls layer is now the 3rd layer (index 2)
        walls = d["layers"][2]["data"]
        ok = verify_no_sealed_rooms(walls, MAP_W, MAP_H)
        print(f"  {map_name}: {'PASS - all areas reachable' if ok else 'FAIL - sealed rooms found'}")

    print()
    print("  --- Validating spawn positions ---")
    validate_spawns()

    print()
    print("All arena assets generated successfully!")

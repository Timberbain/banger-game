#!/usr/bin/env python3
"""
Generate all pixel art assets for Banger game.
Produces: 3 character spritesheets, 1 projectile spritesheet, 1 particle texture, 4 tilesets.

Uses PIL/Pillow instead of Node canvas (canvas package not installed).
"""

from PIL import Image, ImageDraw
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
SPRITES_DIR = os.path.join(PROJECT_ROOT, "client", "public", "sprites")
TILESETS_DIR = os.path.join(PROJECT_ROOT, "client", "public", "tilesets")

os.makedirs(SPRITES_DIR, exist_ok=True)
os.makedirs(TILESETS_DIR, exist_ok=True)


# ============================================================
# Color palette
# ============================================================
# Paran: yellow + gold accents (Pac-Man look)
PARAN_BODY = (255, 204, 0, 255)      # #ffcc00
PARAN_ACCENT = (255, 215, 0, 255)    # #ffd700
PARAN_DARK = (204, 163, 0, 255)      # darker yellow for shading
PARAN_LIGHT = (255, 230, 100, 255)   # lighter yellow for highlights

# Faran: red + dark red accents (ninja look)
FARAN_BODY = (255, 68, 68, 255)      # #ff4444
FARAN_ACCENT = (204, 51, 51, 255)    # #cc3333
FARAN_DARK = (153, 40, 40, 255)
FARAN_LIGHT = (255, 120, 120, 255)

# Baran: green + bronze accents
BARAN_BODY = (68, 204, 102, 255)     # #44cc66
BARAN_ACCENT = (139, 109, 60, 255)   # #8b6d3c
BARAN_DARK = (40, 150, 70, 255)
BARAN_LIGHT = (120, 230, 140, 255)

TRANSPARENT = (0, 0, 0, 0)
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)
EYE_COLOR = (255, 255, 255, 255)


def draw_pixel(img, x, y, color):
    """Draw a single pixel (safe bounds check)."""
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), color)


def draw_rect(img, x1, y1, x2, y2, color):
    """Draw filled rectangle."""
    draw = ImageDraw.Draw(img)
    draw.rectangle([x1, y1, x2, y2], fill=color)


def create_frame():
    """Create a blank 32x32 RGBA frame."""
    return Image.new("RGBA", (32, 32), TRANSPARENT)


# ============================================================
# PARAN CHARACTER - Large angular/wedge shape (28-30px)
# ============================================================
def draw_paran_base(frame, leg_offset=0):
    """Draw Paran base body - angular/triangular wedge shape."""
    # Body: large angular shape (roughly triangular)
    # Main torso - wide wedge
    draw_rect(frame, 5, 8, 26, 22, PARAN_BODY)
    # Narrower top (head/shoulders)
    draw_rect(frame, 8, 4, 23, 8, PARAN_BODY)
    # Head top
    draw_rect(frame, 10, 2, 21, 4, PARAN_DARK)
    # Golden accent stripe across chest
    draw_rect(frame, 7, 12, 24, 13, PARAN_ACCENT)
    # Eyes
    draw_pixel(frame, 12, 5, EYE_COLOR)
    draw_pixel(frame, 19, 5, EYE_COLOR)
    # Legs (shift based on walk frame)
    draw_rect(frame, 8 + leg_offset, 22, 12 + leg_offset, 28, PARAN_DARK)
    draw_rect(frame, 19 - leg_offset, 22, 23 - leg_offset, 28, PARAN_DARK)
    # Gold trim on sides
    draw_rect(frame, 5, 9, 6, 21, PARAN_ACCENT)
    draw_rect(frame, 25, 9, 26, 21, PARAN_ACCENT)


def generate_paran_frames():
    """Generate all 26 frames for Paran."""
    frames = []

    # Walk Down (frames 0-3): body facing down, legs alternating
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_paran_base(f, offsets[i])
        # Down-facing indicator: golden arrow at bottom
        draw_pixel(f, 15, 27, PARAN_ACCENT)
        draw_pixel(f, 16, 27, PARAN_ACCENT)
        frames.append(f)

    # Walk Up (frames 4-7)
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_paran_base(f, offsets[i])
        # No eyes visible from back, darker head
        draw_rect(f, 10, 2, 21, 5, PARAN_DARK)
        draw_pixel(f, 12, 5, TRANSPARENT)
        draw_pixel(f, 19, 5, TRANSPARENT)
        # Up-facing indicator
        draw_pixel(f, 15, 1, PARAN_ACCENT)
        draw_pixel(f, 16, 1, PARAN_ACCENT)
        frames.append(f)

    # Walk Right (frames 8-11)
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_paran_base(f, offsets[i])
        # Right-facing: move right eye, hide left
        draw_pixel(f, 12, 5, TRANSPARENT)
        draw_pixel(f, 20, 5, EYE_COLOR)
        # Right arrow accent
        draw_pixel(f, 27, 14, PARAN_ACCENT)
        draw_pixel(f, 27, 15, PARAN_ACCENT)
        frames.append(f)

    # Walk Left (frames 12-15): mirror of right
    for i in range(4):
        f = frames[8 + i].transpose(Image.FLIP_LEFT_RIGHT)
        frames.append(f)

    # Idle (frames 16-17): subtle breathing
    f_idle1 = create_frame()
    draw_paran_base(f_idle1, 0)
    frames.append(f_idle1)

    f_idle2 = create_frame()
    # Shift body up 1px for breathing effect
    draw_rect(f_idle2, 5, 7, 26, 21, PARAN_BODY)
    draw_rect(f_idle2, 8, 3, 23, 7, PARAN_BODY)
    draw_rect(f_idle2, 10, 1, 21, 3, PARAN_DARK)
    draw_rect(f_idle2, 7, 11, 24, 12, PARAN_ACCENT)
    draw_pixel(f_idle2, 12, 4, EYE_COLOR)
    draw_pixel(f_idle2, 19, 4, EYE_COLOR)
    draw_rect(f_idle2, 8, 21, 12, 28, PARAN_DARK)
    draw_rect(f_idle2, 19, 21, 23, 28, PARAN_DARK)
    draw_rect(f_idle2, 5, 8, 6, 20, PARAN_ACCENT)
    draw_rect(f_idle2, 25, 8, 26, 20, PARAN_ACCENT)
    frames.append(f_idle2)

    # Shoot (frames 18-19): flash/extension forward
    f_shoot1 = create_frame()
    draw_paran_base(f_shoot1, 0)
    # Flash at front
    draw_rect(f_shoot1, 13, 0, 18, 2, PARAN_ACCENT)
    frames.append(f_shoot1)

    f_shoot2 = create_frame()
    draw_paran_base(f_shoot2, 0)
    # Bigger flash
    draw_rect(f_shoot2, 12, 0, 19, 3, (255, 220, 100, 255))
    frames.append(f_shoot2)

    # Death (frames 20-25): body fragments/fades
    for i in range(6):
        f = create_frame()
        alpha = max(30, 255 - i * 45)
        body_c = (PARAN_BODY[0], PARAN_BODY[1], PARAN_BODY[2], alpha)
        accent_c = (PARAN_ACCENT[0], PARAN_ACCENT[1], PARAN_ACCENT[2], alpha)
        dark_c = (PARAN_DARK[0], PARAN_DARK[1], PARAN_DARK[2], alpha)

        # Fragmenting: spread outward
        spread = i * 2
        # Top fragment
        draw_rect(f, 10 - spread, 2 - min(spread, 2), 21 + spread, 4, dark_c)
        # Body fragments splitting
        if i < 3:
            draw_rect(f, 5 - spread, 8 + spread, 14, 22, body_c)
            draw_rect(f, 17, 8 + spread, 26 + spread, 22, body_c)
            draw_rect(f, 7, 12 + spread, 24, 13 + spread, accent_c)
        else:
            # Scattered pixels
            for px in range(0, 32, 4 + i):
                for py in range(0, 32, 4 + i):
                    draw_pixel(f, px + (i % 3), py + (i % 2), body_c)
        frames.append(f)

    return frames


# ============================================================
# FARAN CHARACTER - Slim vertical shape with pointed top (20-22px)
# ============================================================
def draw_faran_base(frame, leg_offset=0):
    """Draw Faran base body - slim, agile archer."""
    # Pointed head
    draw_pixel(frame, 15, 3, FARAN_BODY)
    draw_pixel(frame, 16, 3, FARAN_BODY)
    draw_rect(frame, 14, 4, 17, 5, FARAN_BODY)
    draw_rect(frame, 13, 5, 18, 7, FARAN_BODY)
    # Eyes
    draw_pixel(frame, 14, 6, EYE_COLOR)
    draw_pixel(frame, 17, 6, EYE_COLOR)
    # Slim torso
    draw_rect(frame, 12, 8, 19, 18, FARAN_BODY)
    # Teal accent belt
    draw_rect(frame, 12, 14, 19, 15, FARAN_ACCENT)
    # Arms (thin)
    draw_rect(frame, 10, 9, 11, 15, FARAN_DARK)
    draw_rect(frame, 20, 9, 21, 15, FARAN_DARK)
    # Legs (thin, tall)
    draw_rect(frame, 12 + leg_offset, 19, 14 + leg_offset, 27, FARAN_DARK)
    draw_rect(frame, 17 - leg_offset, 19, 19 - leg_offset, 27, FARAN_DARK)
    # Teal trim on shoulders
    draw_rect(frame, 11, 8, 12, 9, FARAN_ACCENT)
    draw_rect(frame, 19, 8, 20, 9, FARAN_ACCENT)


def generate_faran_frames():
    """Generate all 26 frames for Faran."""
    frames = []

    # Walk Down (0-3)
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_faran_base(f, offsets[i])
        frames.append(f)

    # Walk Up (4-7)
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_faran_base(f, offsets[i])
        # Back view: hide eyes
        draw_pixel(f, 14, 6, FARAN_DARK)
        draw_pixel(f, 17, 6, FARAN_DARK)
        frames.append(f)

    # Walk Right (8-11)
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_faran_base(f, offsets[i])
        # Side view: one eye
        draw_pixel(f, 14, 6, TRANSPARENT)
        draw_pixel(f, 17, 6, EYE_COLOR)
        frames.append(f)

    # Walk Left (12-15): mirror
    for i in range(4):
        f = frames[8 + i].transpose(Image.FLIP_LEFT_RIGHT)
        frames.append(f)

    # Idle (16-17)
    f1 = create_frame()
    draw_faran_base(f1, 0)
    frames.append(f1)

    f2 = create_frame()
    # Breathing: shift up 1px
    draw_pixel(f2, 15, 2, FARAN_BODY)
    draw_pixel(f2, 16, 2, FARAN_BODY)
    draw_rect(f2, 14, 3, 17, 4, FARAN_BODY)
    draw_rect(f2, 13, 4, 18, 6, FARAN_BODY)
    draw_pixel(f2, 14, 5, EYE_COLOR)
    draw_pixel(f2, 17, 5, EYE_COLOR)
    draw_rect(f2, 12, 7, 19, 17, FARAN_BODY)
    draw_rect(f2, 12, 13, 19, 14, FARAN_ACCENT)
    draw_rect(f2, 10, 8, 11, 14, FARAN_DARK)
    draw_rect(f2, 20, 8, 21, 14, FARAN_DARK)
    draw_rect(f2, 12, 18, 14, 27, FARAN_DARK)
    draw_rect(f2, 17, 18, 19, 27, FARAN_DARK)
    draw_rect(f2, 11, 7, 12, 8, FARAN_ACCENT)
    draw_rect(f2, 19, 7, 20, 8, FARAN_ACCENT)
    frames.append(f2)

    # Shoot (18-19)
    f_s1 = create_frame()
    draw_faran_base(f_s1, 0)
    # Arm extended forward with dart
    draw_rect(f_s1, 15, 0, 16, 3, FARAN_ACCENT)
    frames.append(f_s1)

    f_s2 = create_frame()
    draw_faran_base(f_s2, 0)
    draw_rect(f_s2, 14, 0, 17, 4, (255, 150, 150, 255))
    frames.append(f_s2)

    # Death (20-25)
    for i in range(6):
        f = create_frame()
        alpha = max(30, 255 - i * 45)
        body_c = (FARAN_BODY[0], FARAN_BODY[1], FARAN_BODY[2], alpha)
        accent_c = (FARAN_ACCENT[0], FARAN_ACCENT[1], FARAN_ACCENT[2], alpha)
        dark_c = (FARAN_DARK[0], FARAN_DARK[1], FARAN_DARK[2], alpha)

        spread = i * 2
        if i < 3:
            draw_rect(f, 13 - spread, 5, 18 + spread, 7, body_c)
            draw_rect(f, 12 - spread, 8, 19 + spread, 18, body_c)
            draw_rect(f, 12, 14, 19, 15, accent_c)
        else:
            for px in range(0, 32, 3 + i):
                for py in range(0, 32, 3 + i):
                    draw_pixel(f, px + (i % 3), py, body_c)
        frames.append(f)

    return frames


# ============================================================
# BARAN CHARACTER - Wide squat shape (22-24px wide)
# ============================================================
def draw_baran_base(frame, leg_offset=0):
    """Draw Baran base body - wide, stocky shield bearer."""
    # Wide head
    draw_rect(frame, 10, 5, 21, 9, BARAN_BODY)
    # Eyes
    draw_pixel(frame, 13, 7, EYE_COLOR)
    draw_pixel(frame, 18, 7, EYE_COLOR)
    # Wide stocky torso
    draw_rect(frame, 7, 10, 24, 20, BARAN_BODY)
    # Bronze edges/armor
    draw_rect(frame, 7, 10, 8, 20, BARAN_ACCENT)
    draw_rect(frame, 23, 10, 24, 20, BARAN_ACCENT)
    draw_rect(frame, 9, 10, 22, 11, BARAN_ACCENT)
    # Shield emblem center
    draw_rect(frame, 14, 13, 17, 16, BARAN_ACCENT)
    # Short sturdy legs
    draw_rect(frame, 9 + leg_offset, 21, 13 + leg_offset, 26, BARAN_DARK)
    draw_rect(frame, 18 - leg_offset, 21, 22 - leg_offset, 26, BARAN_DARK)
    # Feet
    draw_rect(frame, 8 + leg_offset, 26, 14 + leg_offset, 28, BARAN_DARK)
    draw_rect(frame, 17 - leg_offset, 26, 23 - leg_offset, 28, BARAN_DARK)


def generate_baran_frames():
    """Generate all 26 frames for Baran."""
    frames = []

    # Walk Down (0-3)
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_baran_base(f, offsets[i])
        frames.append(f)

    # Walk Up (4-7)
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_baran_base(f, offsets[i])
        draw_pixel(f, 13, 7, BARAN_DARK)
        draw_pixel(f, 18, 7, BARAN_DARK)
        frames.append(f)

    # Walk Right (8-11)
    for i in range(4):
        f = create_frame()
        offsets = [0, 1, 0, -1]
        draw_baran_base(f, offsets[i])
        draw_pixel(f, 13, 7, TRANSPARENT)
        draw_pixel(f, 19, 7, EYE_COLOR)
        frames.append(f)

    # Walk Left (12-15): mirror
    for i in range(4):
        f = frames[8 + i].transpose(Image.FLIP_LEFT_RIGHT)
        frames.append(f)

    # Idle (16-17)
    f1 = create_frame()
    draw_baran_base(f1, 0)
    frames.append(f1)

    f2 = create_frame()
    # Breathing: shift up 1px
    draw_rect(f2, 10, 4, 21, 8, BARAN_BODY)
    draw_pixel(f2, 13, 6, EYE_COLOR)
    draw_pixel(f2, 18, 6, EYE_COLOR)
    draw_rect(f2, 7, 9, 24, 19, BARAN_BODY)
    draw_rect(f2, 7, 9, 8, 19, BARAN_ACCENT)
    draw_rect(f2, 23, 9, 24, 19, BARAN_ACCENT)
    draw_rect(f2, 9, 9, 22, 10, BARAN_ACCENT)
    draw_rect(f2, 14, 12, 17, 15, BARAN_ACCENT)
    draw_rect(f2, 9, 20, 13, 26, BARAN_DARK)
    draw_rect(f2, 18, 20, 22, 26, BARAN_DARK)
    draw_rect(f2, 8, 26, 14, 28, BARAN_DARK)
    draw_rect(f2, 17, 26, 23, 28, BARAN_DARK)
    frames.append(f2)

    # Shoot (18-19)
    f_s1 = create_frame()
    draw_baran_base(f_s1, 0)
    draw_rect(f_s1, 14, 2, 17, 5, BARAN_ACCENT)
    frames.append(f_s1)

    f_s2 = create_frame()
    draw_baran_base(f_s2, 0)
    draw_rect(f_s2, 13, 1, 18, 5, (160, 255, 160, 255))
    frames.append(f_s2)

    # Death (20-25)
    for i in range(6):
        f = create_frame()
        alpha = max(30, 255 - i * 45)
        body_c = (BARAN_BODY[0], BARAN_BODY[1], BARAN_BODY[2], alpha)
        accent_c = (BARAN_ACCENT[0], BARAN_ACCENT[1], BARAN_ACCENT[2], alpha)
        dark_c = (BARAN_DARK[0], BARAN_DARK[1], BARAN_DARK[2], alpha)

        spread = i * 2
        if i < 3:
            draw_rect(f, 7 - spread, 10, 24 + spread, 20, body_c)
            draw_rect(f, 10, 5, 21, 9, body_c)
            draw_rect(f, 14, 13, 17, 16, accent_c)
        else:
            for px in range(0, 32, 3 + i):
                for py in range(0, 32, 3 + i):
                    draw_pixel(f, px + (i % 2), py + (i % 3), body_c)
        frames.append(f)

    return frames


def assemble_spritesheet(frames, name):
    """Assemble frames into a horizontal strip spritesheet."""
    count = len(frames)
    sheet = Image.new("RGBA", (count * 32, 32), TRANSPARENT)
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * 32, 0))
    path = os.path.join(SPRITES_DIR, f"{name}.png")
    sheet.save(path)
    print(f"  Created {path} ({count} frames, {count * 32}x32)")


# ============================================================
# PROJECTILE SPRITESHEET - 3 frames at 8x8
# ============================================================
def generate_projectiles():
    """Generate projectile spritesheet: paran(gold diamond), faran(red dart), baran(green bolt)."""
    sheet = Image.new("RGBA", (24, 8), TRANSPARENT)

    # Frame 0: Paran - gold energy blast (diamond/star)
    f0 = Image.new("RGBA", (8, 8), TRANSPARENT)
    # Diamond shape
    draw_pixel(f0, 3, 0, (255, 220, 100, 255))
    draw_pixel(f0, 4, 0, (255, 220, 100, 255))
    draw_pixel(f0, 2, 1, (255, 200, 50, 255))
    draw_rect(f0, 3, 1, 4, 1, (255, 255, 180, 255))
    draw_pixel(f0, 5, 1, (255, 200, 50, 255))
    draw_pixel(f0, 1, 2, (255, 200, 50, 255))
    draw_rect(f0, 2, 2, 5, 2, (255, 240, 120, 255))
    draw_pixel(f0, 6, 2, (255, 200, 50, 255))
    draw_rect(f0, 0, 3, 7, 4, (255, 220, 80, 255))
    draw_rect(f0, 2, 3, 5, 4, (255, 255, 200, 255))
    draw_pixel(f0, 1, 5, (255, 200, 50, 255))
    draw_rect(f0, 2, 5, 5, 5, (255, 240, 120, 255))
    draw_pixel(f0, 6, 5, (255, 200, 50, 255))
    draw_pixel(f0, 2, 6, (255, 200, 50, 255))
    draw_rect(f0, 3, 6, 4, 6, (255, 255, 180, 255))
    draw_pixel(f0, 5, 6, (255, 200, 50, 255))
    draw_pixel(f0, 3, 7, (255, 220, 100, 255))
    draw_pixel(f0, 4, 7, (255, 220, 100, 255))
    sheet.paste(f0, (0, 0))

    # Frame 1: Faran - red dart (thin elongated)
    f1 = Image.new("RGBA", (8, 8), TRANSPARENT)
    # Thin elongated horizontal dart
    draw_rect(f1, 1, 3, 6, 4, (255, 120, 120, 255))
    draw_rect(f1, 2, 2, 5, 5, (255, 68, 68, 200))
    draw_rect(f1, 3, 3, 4, 4, (255, 200, 200, 255))  # bright center
    draw_pixel(f1, 0, 3, (204, 51, 51, 200))  # dark red tip
    draw_pixel(f1, 0, 4, (204, 51, 51, 200))
    draw_pixel(f1, 7, 3, (204, 51, 51, 200))  # dark red tail
    draw_pixel(f1, 7, 4, (204, 51, 51, 200))
    sheet.paste(f1, (8, 0))

    # Frame 2: Baran - green bolt (small square with trail)
    f2 = Image.new("RGBA", (8, 8), TRANSPARENT)
    # Square core
    draw_rect(f2, 2, 2, 5, 5, (68, 204, 102, 255))
    draw_rect(f2, 3, 3, 4, 4, (180, 255, 180, 255))  # bright center
    # Trail marks
    draw_pixel(f2, 1, 3, (68, 204, 102, 150))
    draw_pixel(f2, 1, 4, (68, 204, 102, 150))
    draw_pixel(f2, 0, 3, (68, 204, 102, 80))
    draw_pixel(f2, 0, 4, (68, 204, 102, 80))
    # Bronze edges
    draw_pixel(f2, 2, 2, (139, 109, 60, 255))
    draw_pixel(f2, 5, 2, (139, 109, 60, 255))
    draw_pixel(f2, 2, 5, (139, 109, 60, 255))
    draw_pixel(f2, 5, 5, (139, 109, 60, 255))
    sheet.paste(f2, (16, 0))

    path = os.path.join(SPRITES_DIR, "projectiles.png")
    sheet.save(path)
    print(f"  Created {path} (3 frames, 24x8)")


# ============================================================
# PARTICLE TEXTURE - 8x8 white filled circle
# ============================================================
def generate_particle():
    """Generate 8x8 white circle particle texture."""
    img = Image.new("RGBA", (8, 8), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    draw.ellipse([1, 1, 6, 6], fill=WHITE)
    path = os.path.join(SPRITES_DIR, "particle.png")
    img.save(path)
    print(f"  Created {path} (8x8)")


# ============================================================
# TILESETS - 4 per-map tilesets, 128x64 (4 cols x 2 rows, 8 tiles)
# Tile IDs: 1=floor, 2=ground, 3=wall, 4=heavy, 5=medium, 6=light, 7-8=unused
# ============================================================

def draw_tileset_tile(img, col, row, color, detail_fn=None):
    """Draw a single 32x32 tile at grid position."""
    x0 = col * 32
    y0 = row * 32
    draw_rect(img, x0, y0, x0 + 31, y0 + 31, color)
    if detail_fn:
        detail_fn(img, x0, y0)


def generate_tileset_ruins():
    """Solarpunk Ruins tileset for test_arena."""
    img = Image.new("RGBA", (128, 64), TRANSPARENT)

    # Tile 1 (0,0): Floor - weathered stone with moss
    draw_tileset_tile(img, 0, 0, (160, 155, 140, 255))
    # Add moss spots
    for pos in [(3, 5), (15, 20), (25, 8), (10, 28)]:
        draw_rect(img, pos[0], pos[1], pos[0]+2, pos[1]+1, (80, 120, 60, 255))
    # Stone cracks
    for y in [10, 22]:
        draw_rect(img, 5, y, 12, y, (130, 125, 110, 255))

    # Tile 2 (1,0): Ground - darker stone
    draw_tileset_tile(img, 1, 0, (140, 135, 120, 255))
    # Texture
    for pos in [(35, 3), (48, 15), (55, 25)]:
        draw_pixel(img, pos[0], pos[1], (120, 115, 100, 255))

    # Tile 3 (2,0): Wall - crumbling stone with vines
    draw_tileset_tile(img, 2, 0, (90, 85, 75, 255))
    # Stone blocks outline
    draw_rect(img, 64, 0, 95, 0, (70, 65, 55, 255))
    draw_rect(img, 64, 15, 95, 16, (70, 65, 55, 255))
    draw_rect(img, 64, 31, 95, 31, (70, 65, 55, 255))
    draw_rect(img, 79, 0, 80, 15, (70, 65, 55, 255))
    # Vine
    for y in range(0, 32, 3):
        draw_pixel(img, 68 + (y % 5), y, (50, 100, 40, 255))

    # Tile 4 (3,0): Heavy obstacle - dark stone pillar
    draw_tileset_tile(img, 3, 0, (80, 75, 65, 255))
    draw_rect(img, 98, 2, 125, 29, (60, 55, 45, 255))
    draw_rect(img, 100, 4, 123, 27, (75, 70, 60, 255))
    # Mossy top
    draw_rect(img, 98, 2, 125, 5, (55, 90, 45, 255))

    # Tile 5 (0,1): Medium obstacle - cracked stone
    draw_tileset_tile(img, 0, 1, (120, 110, 95, 255))
    draw_rect(img, 4, 36, 27, 59, (100, 95, 80, 255))
    # Crack line
    for i in range(10):
        draw_pixel(img, 8 + i, 44 + (i % 3), (70, 65, 55, 255))

    # Tile 6 (1,1): Light obstacle - rubble
    draw_tileset_tile(img, 1, 1, (155, 145, 125, 255))
    # Scattered rubble pieces
    draw_rect(img, 36, 38, 42, 42, (110, 105, 90, 255))
    draw_rect(img, 48, 45, 55, 50, (120, 115, 100, 255))
    draw_rect(img, 40, 52, 46, 57, (100, 95, 80, 255))

    # Tiles 7-8 (2,1 and 3,1): Unused / transparent
    draw_tileset_tile(img, 2, 1, (160, 155, 140, 100))
    draw_tileset_tile(img, 3, 1, (160, 155, 140, 100))

    path = os.path.join(TILESETS_DIR, "solarpunk_ruins.png")
    img.save(path)
    print(f"  Created {path}")


def generate_tileset_living():
    """Solarpunk Living tileset for corridor_chaos."""
    img = Image.new("RGBA", (128, 64), TRANSPARENT)

    # Tile 1: Floor - grass/dirt path
    draw_tileset_tile(img, 0, 0, (120, 160, 80, 255))
    # Dirt patches
    for pos in [(5, 10), (20, 22), (12, 4)]:
        draw_rect(img, pos[0], pos[1], pos[0]+4, pos[1]+2, (140, 120, 80, 255))

    # Tile 2: Ground - darker grass
    draw_tileset_tile(img, 1, 0, (90, 130, 60, 255))
    for pos in [(38, 8), (50, 20)]:
        draw_rect(img, pos[0], pos[1], pos[0]+2, pos[1]+3, (70, 110, 45, 255))

    # Tile 3: Wall - thick hedgerow/tree trunk
    draw_tileset_tile(img, 2, 0, (50, 80, 35, 255))
    # Leaf texture
    for y in range(0, 32, 4):
        for x in range(64, 96, 5):
            draw_rect(img, x, y, x+2, y+2, (60, 100, 40, 255))
    # Trunk center
    draw_rect(img, 74, 8, 85, 24, (80, 55, 30, 255))

    # Tile 4: Heavy obstacle - thick logs
    draw_tileset_tile(img, 3, 0, (100, 70, 40, 255))
    draw_rect(img, 100, 4, 124, 12, (85, 60, 35, 255))
    draw_rect(img, 100, 14, 124, 22, (85, 60, 35, 255))
    draw_rect(img, 100, 24, 124, 28, (85, 60, 35, 255))
    # Bark texture
    for y in [6, 16, 26]:
        draw_rect(img, 102, y, 103, y+1, (65, 45, 25, 255))

    # Tile 5: Medium obstacle - woven branches
    draw_tileset_tile(img, 0, 1, (110, 85, 55, 255))
    # Woven pattern
    for i in range(0, 28, 6):
        draw_rect(img, 4 + i, 36, 8 + i, 58, (90, 65, 35, 255))
        draw_rect(img, 2, 38 + i, 28, 40 + i, (95, 70, 40, 255))

    # Tile 6: Light obstacle - thin saplings
    draw_tileset_tile(img, 1, 1, (130, 170, 90, 255))
    # Thin trunks
    draw_rect(img, 40, 34, 41, 60, (90, 65, 35, 255))
    draw_rect(img, 50, 36, 51, 58, (90, 65, 35, 255))
    # Leaves
    draw_rect(img, 37, 34, 44, 38, (70, 120, 50, 255))
    draw_rect(img, 47, 36, 54, 40, (70, 120, 50, 255))

    # Tiles 7-8: Unused
    draw_tileset_tile(img, 2, 1, (120, 160, 80, 100))
    draw_tileset_tile(img, 3, 1, (120, 160, 80, 100))

    path = os.path.join(TILESETS_DIR, "solarpunk_living.png")
    img.save(path)
    print(f"  Created {path}")


def generate_tileset_tech():
    """Solarpunk Tech tileset for cross_fire."""
    img = Image.new("RGBA", (128, 64), TRANSPARENT)

    # Tile 1: Floor - solar panel walkway
    draw_tileset_tile(img, 0, 0, (60, 70, 90, 255))
    # Grid lines
    for x in range(0, 32, 8):
        draw_rect(img, x, 0, x, 31, (80, 90, 110, 255))
    for y in range(0, 32, 8):
        draw_rect(img, 0, y, 31, y, (80, 90, 110, 255))
    # Solar cell highlights
    draw_rect(img, 2, 2, 6, 6, (70, 80, 105, 255))

    # Tile 2: Ground - metallic floor
    draw_tileset_tile(img, 1, 0, (70, 75, 85, 255))
    draw_rect(img, 32, 15, 63, 16, (90, 95, 105, 255))

    # Tile 3: Wall - bio-luminescent crystal
    draw_tileset_tile(img, 2, 0, (30, 50, 80, 255))
    # Crystal formations
    draw_rect(img, 70, 2, 76, 28, (60, 120, 180, 255))
    draw_rect(img, 80, 6, 85, 24, (50, 100, 160, 255))
    draw_rect(img, 88, 4, 92, 26, (60, 120, 180, 255))
    # Glow highlights
    draw_rect(img, 72, 10, 74, 14, (120, 200, 255, 255))
    draw_rect(img, 82, 12, 83, 16, (120, 200, 255, 255))
    draw_rect(img, 89, 8, 91, 12, (120, 200, 255, 255))

    # Tile 4: Heavy obstacle - full crystal
    draw_tileset_tile(img, 3, 0, (35, 55, 85, 255))
    draw_rect(img, 100, 2, 124, 30, (50, 100, 160, 255))
    draw_rect(img, 106, 6, 118, 26, (70, 130, 190, 255))
    draw_rect(img, 110, 10, 114, 22, (120, 200, 255, 255))

    # Tile 5: Medium obstacle - cracked pod
    draw_tileset_tile(img, 0, 1, (45, 65, 90, 255))
    draw_rect(img, 6, 38, 26, 56, (50, 100, 150, 255))
    draw_rect(img, 10, 42, 22, 52, (70, 130, 180, 255))
    # Crack
    for i in range(8):
        draw_pixel(img, 14 + (i % 3), 40 + i, (30, 50, 80, 255))

    # Tile 6: Light obstacle - seed pod
    draw_tileset_tile(img, 1, 1, (50, 70, 95, 255))
    draw_rect(img, 38, 40, 54, 54, (60, 110, 160, 255))
    draw_rect(img, 42, 44, 50, 50, (100, 170, 220, 255))

    # Tiles 7-8: Unused
    draw_tileset_tile(img, 2, 1, (60, 70, 90, 100))
    draw_tileset_tile(img, 3, 1, (60, 70, 90, 100))

    path = os.path.join(TILESETS_DIR, "solarpunk_tech.png")
    img.save(path)
    print(f"  Created {path}")


def generate_tileset_mixed():
    """Solarpunk Mixed tileset for pillars."""
    img = Image.new("RGBA", (128, 64), TRANSPARENT)

    # Tile 1: Floor - cobblestone with grass patches
    draw_tileset_tile(img, 0, 0, (150, 145, 130, 255))
    # Cobblestone pattern
    for y in range(0, 32, 8):
        offset = 4 if (y // 8) % 2 else 0
        for x in range(offset, 32, 8):
            draw_rect(img, x, y, min(x+6, 31), min(y+6, 31), (140, 135, 120, 255))
    # Grass patches
    draw_rect(img, 2, 24, 6, 27, (90, 140, 60, 255))
    draw_rect(img, 20, 4, 24, 8, (90, 140, 60, 255))

    # Tile 2: Ground - cleaner cobblestone
    draw_tileset_tile(img, 1, 0, (140, 135, 120, 255))
    for y in range(0, 32, 8):
        for x in range(32, 64, 10):
            draw_rect(img, x, y, min(x+8, 63), min(y+6, 31), (130, 125, 110, 255))

    # Tile 3: Wall - brick + vine hybrid
    draw_tileset_tile(img, 2, 0, (100, 60, 50, 255))
    # Brick pattern
    for y in range(0, 32, 8):
        offset = 8 if (y // 8) % 2 else 0
        for x in range(64 + offset, 96, 16):
            draw_rect(img, x, y+1, min(x+14, 95), y+6, (110, 70, 55, 255))
    # Vine overlay
    for y in range(0, 32, 2):
        x = 66 + (y * 3) % 20
        if x < 96:
            draw_pixel(img, x, y, (60, 110, 45, 255))

    # Tile 4: Heavy obstacle - generator (overgrown machinery)
    draw_tileset_tile(img, 3, 0, (80, 80, 75, 255))
    draw_rect(img, 100, 4, 124, 28, (65, 65, 60, 255))
    draw_rect(img, 104, 8, 120, 24, (55, 55, 50, 255))
    # Gear/vent detail
    draw_rect(img, 108, 12, 116, 20, (90, 90, 85, 255))
    draw_rect(img, 110, 14, 114, 18, (50, 50, 45, 255))
    # Vines on machinery
    draw_rect(img, 100, 4, 104, 8, (60, 110, 45, 255))
    draw_rect(img, 120, 4, 124, 10, (60, 110, 45, 255))

    # Tile 5: Medium obstacle - console
    draw_tileset_tile(img, 0, 1, (90, 90, 85, 255))
    draw_rect(img, 4, 38, 28, 56, (70, 70, 65, 255))
    # Screen
    draw_rect(img, 8, 40, 24, 48, (40, 80, 60, 255))
    draw_rect(img, 10, 42, 22, 46, (60, 120, 80, 255))
    # Buttons
    draw_rect(img, 10, 50, 12, 52, (200, 50, 50, 255))
    draw_rect(img, 14, 50, 16, 52, (50, 200, 50, 255))

    # Tile 6: Light obstacle - crate
    draw_tileset_tile(img, 1, 1, (140, 120, 80, 255))
    draw_rect(img, 36, 36, 58, 58, (130, 110, 70, 255))
    draw_rect(img, 38, 38, 56, 56, (120, 100, 60, 255))
    # Cross marking
    draw_rect(img, 36, 46, 58, 48, (100, 85, 55, 255))
    draw_rect(img, 46, 36, 48, 58, (100, 85, 55, 255))
    # Moss
    draw_rect(img, 36, 54, 42, 58, (70, 110, 50, 255))

    # Tiles 7-8: Unused
    draw_tileset_tile(img, 2, 1, (150, 145, 130, 100))
    draw_tileset_tile(img, 3, 1, (150, 145, 130, 100))

    path = os.path.join(TILESETS_DIR, "solarpunk_mixed.png")
    img.save(path)
    print(f"  Created {path}")


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("Generating Banger pixel art assets...")
    print()

    print("[1/7] Paran spritesheet (26 frames)")
    paran_frames = generate_paran_frames()
    assemble_spritesheet(paran_frames, "paran")

    print("[2/7] Faran spritesheet (26 frames)")
    faran_frames = generate_faran_frames()
    assemble_spritesheet(faran_frames, "faran")

    print("[3/7] Baran spritesheet (26 frames)")
    baran_frames = generate_baran_frames()
    assemble_spritesheet(baran_frames, "baran")

    print("[4/7] Projectile spritesheet (3 frames)")
    generate_projectiles()

    print("[5/7] Particle texture (8x8)")
    generate_particle()

    print("[6/7] Tilesets (4 maps)")
    generate_tileset_ruins()
    generate_tileset_living()
    generate_tileset_tech()
    generate_tileset_mixed()

    print()
    print("All assets generated successfully!")

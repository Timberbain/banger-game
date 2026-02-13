#!/usr/bin/env python3
"""
Generate all pixel art assets for Banger game (HD / 2x resolution).
Produces: 3 character spritesheets (64x64 frames, 36 frames each),
          1 projectile spritesheet (16x16 frames, 3 frames),
          1 particle texture (16x16),
          4 tilesets (128x64 -- 32x32 tiles, improved art detail).

Characters are 2x resolution with richer detail (shading, limbs, eyes).
Tilesets stay at 1x (camera zoom=2 handles visual upscaling).
"""

from PIL import Image, ImageDraw
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
SPRITES_DIR = os.path.join(PROJECT_ROOT, "client", "public", "sprites")
TILESETS_DIR = os.path.join(PROJECT_ROOT, "client", "public", "tilesets")

os.makedirs(SPRITES_DIR, exist_ok=True)
os.makedirs(TILESETS_DIR, exist_ok=True)

# ============================================================
# Frame size constants
# ============================================================
FRAME_SIZE = 64  # Character frame size (2x)
PROJ_SIZE = 16   # Projectile frame size (2x)
TILE_SIZE = 32   # Tileset tile size (stays 1x)

# ============================================================
# Color palette
# ============================================================
# Paran: yellow + gold accents (Pac-Man look)
PARAN_BODY = (255, 204, 0, 255)        # #ffcc00
PARAN_ACCENT = (255, 215, 0, 255)      # #ffd700
PARAN_DARK = (204, 163, 0, 255)        # darker yellow for shading
PARAN_LIGHT = (255, 230, 100, 255)     # lighter yellow for highlights
PARAN_DEEP = (170, 130, 0, 255)        # deep shadow

# Faran: red + dark red accents (ninja look)
FARAN_BODY = (255, 68, 68, 255)        # #ff4444
FARAN_ACCENT = (204, 51, 51, 255)      # #cc3333
FARAN_DARK = (153, 40, 40, 255)
FARAN_LIGHT = (255, 120, 120, 255)
FARAN_DEEP = (110, 25, 25, 255)        # deep shadow

# Baran: green + bronze accents
BARAN_BODY = (68, 204, 102, 255)       # #44cc66
BARAN_ACCENT = (139, 109, 60, 255)     # #8b6d3c
BARAN_DARK = (40, 150, 70, 255)
BARAN_LIGHT = (120, 230, 140, 255)
BARAN_DEEP = (25, 100, 45, 255)        # deep shadow

TRANSPARENT = (0, 0, 0, 0)
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)
EYE_WHITE = (255, 255, 255, 255)
EYE_PUPIL = (20, 20, 30, 255)
SKIN_TONE = (220, 180, 140, 255)


# ============================================================
# Drawing helpers
# ============================================================
def draw_pixel(img, x, y, color):
    """Draw a single pixel (safe bounds check)."""
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), color)


def draw_rect(img, x1, y1, x2, y2, color):
    """Draw filled rectangle (x2, y2 inclusive)."""
    draw = ImageDraw.Draw(img)
    draw.rectangle([x1, y1, x2, y2], fill=color)


def draw_ellipse(img, x1, y1, x2, y2, color):
    """Draw filled ellipse."""
    draw = ImageDraw.Draw(img)
    draw.ellipse([x1, y1, x2, y2], fill=color)


def draw_line(img, x1, y1, x2, y2, color):
    """Draw a line between two points."""
    draw = ImageDraw.Draw(img)
    draw.line([(x1, y1), (x2, y2)], fill=color, width=1)


def fill_gradient_v(img, x1, y1, x2, y2, color_top, color_bottom):
    """Fill a rectangle with a vertical gradient from color_top to color_bottom."""
    h = y2 - y1
    if h <= 0:
        return
    for dy in range(h + 1):
        t = dy / max(h, 1)
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * t)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * t)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * t)
        a = int(color_top[3] + (color_bottom[3] - color_top[3]) * t)
        draw_rect(img, x1, y1 + dy, x2, y1 + dy, (r, g, b, a))


def create_frame(size=FRAME_SIZE):
    """Create a blank RGBA frame."""
    return Image.new("RGBA", (size, size), TRANSPARENT)


def blend_color(c1, c2, t):
    """Blend two RGBA colors by factor t (0=c1, 1=c2)."""
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))


# ============================================================
# PARAN CHARACTER - Round Pac-Man body, 64x64 frames
# Speed-oriented, gold/yellow, prominent mouth
# ============================================================
def draw_paran_body(frame, y_off=0, mouth_open=False, facing="down"):
    """Draw Paran base body at 64x64 - round Pac-Man shape."""
    cx, cy = 32, 28 + y_off  # center of body

    # Main round body - large ellipse (Pac-Man shape)
    draw_ellipse(frame, 12, 8 + y_off, 52, 48 + y_off, PARAN_BODY)

    # Body shading: highlight on top-left
    draw_ellipse(frame, 16, 10 + y_off, 36, 30 + y_off, PARAN_LIGHT)

    # Body shading: shadow on bottom-right
    draw_ellipse(frame, 30, 32 + y_off, 50, 46 + y_off, PARAN_DARK)

    # Deep shadow at very bottom
    draw_ellipse(frame, 22, 42 + y_off, 42, 48 + y_off, PARAN_DEEP)

    # Gold accent ring/stripe around middle
    draw_rect(frame, 14, 26 + y_off, 50, 28 + y_off, PARAN_ACCENT)
    draw_rect(frame, 16, 29 + y_off, 48, 30 + y_off, PARAN_ACCENT)

    # Eyes (front-facing)
    if facing in ("down", "idle"):
        # Left eye
        draw_rect(frame, 20, 16 + y_off, 26, 22 + y_off, EYE_WHITE)
        draw_rect(frame, 22, 18 + y_off, 25, 21 + y_off, EYE_PUPIL)
        # Right eye
        draw_rect(frame, 36, 16 + y_off, 42, 22 + y_off, EYE_WHITE)
        draw_rect(frame, 38, 18 + y_off, 41, 21 + y_off, EYE_PUPIL)
    elif facing == "up":
        # Back of head - no eyes, darker cap
        draw_ellipse(frame, 18, 8 + y_off, 46, 24 + y_off, PARAN_DARK)
    elif facing == "right":
        # Right-side eye only
        draw_rect(frame, 36, 16 + y_off, 44, 22 + y_off, EYE_WHITE)
        draw_rect(frame, 39, 18 + y_off, 43, 21 + y_off, EYE_PUPIL)
    elif facing == "left":
        # Left-side eye only
        draw_rect(frame, 18, 16 + y_off, 26, 22 + y_off, EYE_WHITE)
        draw_rect(frame, 19, 18 + y_off, 23, 21 + y_off, EYE_PUPIL)

    # Mouth (Pac-Man wedge) - only for down/idle
    if facing == "down" and mouth_open:
        draw_rect(frame, 24, 34 + y_off, 40, 40 + y_off, PARAN_DEEP)
        draw_rect(frame, 26, 36 + y_off, 38, 38 + y_off, (80, 20, 20, 255))
    elif facing == "down":
        # Closed mouth line
        draw_rect(frame, 24, 36 + y_off, 40, 37 + y_off, PARAN_DEEP)


def draw_paran_legs(frame, leg_phase=0, y_off=0):
    """Draw Paran legs with walk animation phase (0-5)."""
    base_y = 46 + y_off
    offsets = [0, 2, 3, 2, 0, -2]  # 6-frame walk cycle leg spread
    off = offsets[leg_phase % 6]

    # Left leg
    draw_rect(frame, 20 - off, base_y, 26 - off, base_y + 10, PARAN_DARK)
    draw_rect(frame, 19 - off, base_y + 10, 27 - off, base_y + 13, PARAN_DEEP)

    # Right leg
    draw_rect(frame, 38 + off, base_y, 44 + off, base_y + 10, PARAN_DARK)
    draw_rect(frame, 37 + off, base_y + 10, 45 + off, base_y + 13, PARAN_DEEP)


def draw_paran_speed_streaks(frame, direction, intensity=1):
    """Draw speed streaks behind Paran for walk frames."""
    streak_color = (255, 230, 100, 120)
    if direction == "down":
        for i in range(intensity * 2):
            y = 4 + i * 3
            draw_rect(frame, 28, y, 36, y, streak_color)
    elif direction == "up":
        for i in range(intensity * 2):
            y = 58 - i * 3
            draw_rect(frame, 28, y, 36, y, streak_color)
    elif direction == "right":
        for i in range(intensity * 2):
            x = 4 + i * 3
            draw_rect(frame, x, 26, x, 34, streak_color)
    elif direction == "left":
        for i in range(intensity * 2):
            x = 58 - i * 3
            draw_rect(frame, x, 26, x, 34, streak_color)


def generate_paran_frames():
    """Generate all 36 frames for Paran at 64x64."""
    frames = []

    # Walk Down: frames 0-5 (6 frames)
    for i in range(6):
        f = create_frame()
        mouth = (i % 3) == 1  # mouth opens on some frames
        draw_paran_body(f, y_off=0, mouth_open=mouth, facing="down")
        draw_paran_legs(f, leg_phase=i)
        if i in (2, 3, 4):
            draw_paran_speed_streaks(f, "down", intensity=1)
        frames.append(f)

    # Walk Up: frames 6-11 (6 frames)
    for i in range(6):
        f = create_frame()
        draw_paran_body(f, y_off=0, facing="up")
        draw_paran_legs(f, leg_phase=i)
        if i in (2, 3, 4):
            draw_paran_speed_streaks(f, "up", intensity=1)
        frames.append(f)

    # Walk Right: frames 12-17 (6 frames)
    for i in range(6):
        f = create_frame()
        draw_paran_body(f, y_off=0, facing="right")
        draw_paran_legs(f, leg_phase=i)
        if i in (2, 3, 4):
            draw_paran_speed_streaks(f, "right", intensity=1)
        frames.append(f)

    # Walk Left: frames 18-23 (6 frames) - mirror of right
    for i in range(6):
        f = frames[12 + i].transpose(Image.FLIP_LEFT_RIGHT)
        frames.append(f)

    # Idle: frames 24-26 (3 frames, breathing/bobbing)
    # Frame 24: neutral
    f = create_frame()
    draw_paran_body(f, y_off=0, facing="idle")
    draw_paran_legs(f, leg_phase=0)
    frames.append(f)

    # Frame 25: body up 1-2px (inhale)
    f = create_frame()
    draw_paran_body(f, y_off=-2, facing="idle")
    draw_paran_legs(f, leg_phase=0, y_off=0)
    frames.append(f)

    # Frame 26: neutral/down (exhale)
    f = create_frame()
    draw_paran_body(f, y_off=1, facing="idle")
    draw_paran_legs(f, leg_phase=0, y_off=1)
    frames.append(f)

    # Shoot: frames 27-29 (3 frames, energy emanation)
    # Frame 27: windup
    f = create_frame()
    draw_paran_body(f, y_off=0, facing="down")
    draw_paran_legs(f, leg_phase=0)
    # Small energy at mouth
    draw_rect(f, 28, 6, 36, 10, PARAN_ACCENT)
    frames.append(f)

    # Frame 28: energy burst
    f = create_frame()
    draw_paran_body(f, y_off=0, facing="down")
    draw_paran_legs(f, leg_phase=0)
    # Big energy flash
    draw_ellipse(f, 22, 0, 42, 12, (255, 240, 150, 255))
    draw_ellipse(f, 26, 2, 38, 8, (255, 255, 220, 255))
    frames.append(f)

    # Frame 29: energy dissipate
    f = create_frame()
    draw_paran_body(f, y_off=0, facing="down")
    draw_paran_legs(f, leg_phase=0)
    draw_ellipse(f, 24, 0, 40, 8, (255, 230, 100, 180))
    frames.append(f)

    # Death: frames 30-35 (6 frames, progressive dissolution)
    for i in range(6):
        f = create_frame()
        alpha = max(30, 255 - i * 45)
        body_c = (PARAN_BODY[0], PARAN_BODY[1], PARAN_BODY[2], alpha)
        accent_c = (PARAN_ACCENT[0], PARAN_ACCENT[1], PARAN_ACCENT[2], alpha)
        dark_c = (PARAN_DARK[0], PARAN_DARK[1], PARAN_DARK[2], alpha)
        light_c = (PARAN_LIGHT[0], PARAN_LIGHT[1], PARAN_LIGHT[2], alpha)

        spread = i * 3
        if i < 3:
            # Body fragmenting outward
            draw_ellipse(f, 12 - spread, 8 + spread, 30, 48, body_c)
            draw_ellipse(f, 34, 8 + spread, 52 + spread, 48, body_c)
            # Accent pieces
            draw_rect(f, 14 - spread, 26, 30, 28, accent_c)
            draw_rect(f, 34, 26, 50 + spread, 28, accent_c)
            # Eyes floating away
            if i < 2:
                draw_rect(f, 20 - spread, 16 - i * 2, 26 - spread, 22 - i * 2, EYE_WHITE)
                draw_rect(f, 36 + spread, 16 - i * 2, 42 + spread, 22 - i * 2, EYE_WHITE)
        else:
            # Scattered pixel dissolution
            step = 3 + i
            for px in range(0, 64, step):
                for py in range(0, 64, step):
                    c = body_c if (px + py) % 2 == 0 else accent_c
                    draw_pixel(f, px + (i % 3), py + (i % 2), c)
                    if (px + py) % 4 == 0:
                        draw_pixel(f, px + 1, py + 1, light_c)
        frames.append(f)

    return frames


# ============================================================
# FARAN CHARACTER - Slim ninja silhouette, 64x64 frames
# Ranged attacker, red/dark red, mask/scarf detail
# ============================================================
def draw_faran_body(frame, y_off=0, facing="down", arm_extend=0):
    """Draw Faran base body at 64x64 - slim ninja."""
    # Head with mask/hood
    # Pointed hood top
    draw_rect(frame, 28, 4 + y_off, 36, 6 + y_off, FARAN_DARK)
    draw_rect(frame, 26, 6 + y_off, 38, 8 + y_off, FARAN_BODY)
    # Head
    draw_rect(frame, 24, 8 + y_off, 40, 16 + y_off, FARAN_BODY)
    # Highlight on head
    draw_rect(frame, 26, 8 + y_off, 34, 12 + y_off, FARAN_LIGHT)

    # Mask/scarf across lower face
    draw_rect(frame, 24, 14 + y_off, 40, 18 + y_off, FARAN_ACCENT)
    draw_rect(frame, 40, 16 + y_off, 46, 20 + y_off, FARAN_ACCENT)  # scarf trail

    # Eyes
    if facing in ("down", "idle"):
        draw_rect(frame, 27, 10 + y_off, 31, 13 + y_off, EYE_WHITE)
        draw_rect(frame, 28, 11 + y_off, 30, 12 + y_off, EYE_PUPIL)
        draw_rect(frame, 33, 10 + y_off, 37, 13 + y_off, EYE_WHITE)
        draw_rect(frame, 34, 11 + y_off, 36, 12 + y_off, EYE_PUPIL)
    elif facing == "up":
        draw_rect(frame, 26, 6 + y_off, 38, 14 + y_off, FARAN_DARK)
    elif facing == "right":
        draw_rect(frame, 34, 10 + y_off, 40, 13 + y_off, EYE_WHITE)
        draw_rect(frame, 36, 11 + y_off, 39, 12 + y_off, EYE_PUPIL)
    elif facing == "left":
        draw_rect(frame, 24, 10 + y_off, 30, 13 + y_off, EYE_WHITE)
        draw_rect(frame, 25, 11 + y_off, 28, 12 + y_off, EYE_PUPIL)

    # Slim torso
    draw_rect(frame, 26, 18 + y_off, 38, 36 + y_off, FARAN_BODY)
    # Torso highlight
    draw_rect(frame, 28, 20 + y_off, 34, 28 + y_off, FARAN_LIGHT)
    # Torso shadow
    draw_rect(frame, 34, 28 + y_off, 38, 36 + y_off, FARAN_DARK)

    # Red energy belt
    draw_rect(frame, 24, 30 + y_off, 40, 32 + y_off, FARAN_ACCENT)
    draw_rect(frame, 30, 32 + y_off, 34, 33 + y_off, (255, 150, 150, 255))  # belt buckle glow

    # Arms (thin, agile)
    left_arm_off = -arm_extend
    right_arm_off = arm_extend
    # Left arm
    draw_rect(frame, 20 + left_arm_off, 20 + y_off, 25 + left_arm_off, 32 + y_off, FARAN_DARK)
    draw_rect(frame, 21 + left_arm_off, 21 + y_off, 24 + left_arm_off, 28 + y_off, FARAN_BODY)
    # Right arm
    draw_rect(frame, 39 + right_arm_off, 20 + y_off, 44 + right_arm_off, 32 + y_off, FARAN_DARK)
    draw_rect(frame, 40 + right_arm_off, 21 + y_off, 43 + right_arm_off, 28 + y_off, FARAN_BODY)

    # Red energy accents on shoulders
    draw_rect(frame, 22 + left_arm_off, 18 + y_off, 26, 20 + y_off, FARAN_ACCENT)
    draw_rect(frame, 38, 18 + y_off, 42 + right_arm_off, 20 + y_off, FARAN_ACCENT)


def draw_faran_legs(frame, leg_phase=0, y_off=0):
    """Draw Faran legs - thin and tall."""
    base_y = 36 + y_off
    offsets = [0, 2, 4, 2, 0, -2]
    off = offsets[leg_phase % 6]

    # Left leg
    draw_rect(frame, 26 - off, base_y, 30 - off, base_y + 16, FARAN_DARK)
    draw_rect(frame, 27 - off, base_y, 29 - off, base_y + 12, FARAN_BODY)
    draw_rect(frame, 25 - off, base_y + 16, 31 - off, base_y + 19, FARAN_DEEP)

    # Right leg
    draw_rect(frame, 34 + off, base_y, 38 + off, base_y + 16, FARAN_DARK)
    draw_rect(frame, 35 + off, base_y, 37 + off, base_y + 12, FARAN_BODY)
    draw_rect(frame, 33 + off, base_y + 16, 39 + off, base_y + 19, FARAN_DEEP)


def generate_faran_frames():
    """Generate all 36 frames for Faran at 64x64."""
    frames = []

    # Walk Down: frames 0-5
    for i in range(6):
        f = create_frame()
        draw_faran_body(f, facing="down")
        draw_faran_legs(f, leg_phase=i)
        frames.append(f)

    # Walk Up: frames 6-11
    for i in range(6):
        f = create_frame()
        draw_faran_body(f, facing="up")
        draw_faran_legs(f, leg_phase=i)
        frames.append(f)

    # Walk Right: frames 12-17
    for i in range(6):
        f = create_frame()
        draw_faran_body(f, facing="right")
        draw_faran_legs(f, leg_phase=i)
        frames.append(f)

    # Walk Left: frames 18-23 - mirror of right
    for i in range(6):
        f = frames[12 + i].transpose(Image.FLIP_LEFT_RIGHT)
        frames.append(f)

    # Idle: frames 24-26 (breathing)
    # Frame 24: neutral
    f = create_frame()
    draw_faran_body(f, facing="idle")
    draw_faran_legs(f, leg_phase=0)
    frames.append(f)

    # Frame 25: up (inhale)
    f = create_frame()
    draw_faran_body(f, y_off=-2, facing="idle")
    draw_faran_legs(f, leg_phase=0, y_off=0)
    frames.append(f)

    # Frame 26: down (exhale)
    f = create_frame()
    draw_faran_body(f, y_off=1, facing="idle")
    draw_faran_legs(f, leg_phase=0, y_off=1)
    frames.append(f)

    # Shoot: frames 27-29 (arm extension / dart throw)
    # Frame 27: windup - arm back
    f = create_frame()
    draw_faran_body(f, facing="down", arm_extend=-3)
    draw_faran_legs(f, leg_phase=0)
    frames.append(f)

    # Frame 28: throw - arm forward with energy
    f = create_frame()
    draw_faran_body(f, facing="down", arm_extend=4)
    draw_faran_legs(f, leg_phase=0)
    # Dart/energy at top
    draw_rect(f, 28, 0, 36, 6, FARAN_ACCENT)
    draw_rect(f, 30, 2, 34, 4, (255, 180, 180, 255))
    frames.append(f)

    # Frame 29: follow through
    f = create_frame()
    draw_faran_body(f, facing="down", arm_extend=2)
    draw_faran_legs(f, leg_phase=0)
    draw_rect(f, 29, 0, 35, 4, (255, 120, 120, 180))
    frames.append(f)

    # Death: frames 30-35 (ninja vanish / smoke dissolution)
    for i in range(6):
        f = create_frame()
        alpha = max(30, 255 - i * 45)
        body_c = (FARAN_BODY[0], FARAN_BODY[1], FARAN_BODY[2], alpha)
        accent_c = (FARAN_ACCENT[0], FARAN_ACCENT[1], FARAN_ACCENT[2], alpha)
        dark_c = (FARAN_DARK[0], FARAN_DARK[1], FARAN_DARK[2], alpha)
        light_c = (FARAN_LIGHT[0], FARAN_LIGHT[1], FARAN_LIGHT[2], alpha)

        spread = i * 3
        if i < 3:
            # Body splitting vertically
            draw_rect(f, 24 - spread, 18, 32 - spread, 36, body_c)
            draw_rect(f, 32 + spread, 18, 40 + spread, 36, body_c)
            # Head fading
            draw_rect(f, 26 - spread, 8 - i, 38 + spread, 16, body_c)
            # Scarf pieces
            draw_rect(f, 24 - spread * 2, 14, 30 - spread, 18, accent_c)
            draw_rect(f, 34 + spread, 14, 40 + spread * 2, 18, accent_c)
            # Eyes
            if i < 2:
                draw_rect(f, 27 - spread, 10, 31 - spread, 13, EYE_WHITE)
                draw_rect(f, 33 + spread, 10, 37 + spread, 13, EYE_WHITE)
        else:
            # Smoke/scatter
            step = 3 + i
            for px in range(0, 64, step):
                for py in range(0, 64, step):
                    c = body_c if (px + py) % 3 == 0 else accent_c
                    draw_pixel(f, px + (i % 3), py + (i % 2), c)
                    if (px + py) % 5 == 0:
                        draw_pixel(f, px + 1, py, dark_c)
        frames.append(f)

    return frames


# ============================================================
# BARAN CHARACTER - Armored wide body, 64x64 frames
# Tank/shield, green with bronze trim, helmet/visor
# ============================================================
def draw_baran_body(frame, y_off=0, facing="down", arm_raise=0):
    """Draw Baran base body at 64x64 - armored tank."""
    # Helmet
    draw_rect(frame, 20, 4 + y_off, 44, 8 + y_off, BARAN_ACCENT)  # bronze helmet top
    draw_rect(frame, 18, 8 + y_off, 46, 18 + y_off, BARAN_BODY)   # head
    # Helmet visor
    draw_rect(frame, 20, 8 + y_off, 44, 10 + y_off, BARAN_ACCENT)
    # Helmet highlight
    draw_rect(frame, 24, 5 + y_off, 36, 7 + y_off, (180, 150, 90, 255))

    # Eyes through visor
    if facing in ("down", "idle"):
        draw_rect(frame, 24, 12 + y_off, 30, 16 + y_off, EYE_WHITE)
        draw_rect(frame, 26, 13 + y_off, 29, 15 + y_off, EYE_PUPIL)
        draw_rect(frame, 34, 12 + y_off, 40, 16 + y_off, EYE_WHITE)
        draw_rect(frame, 36, 13 + y_off, 39, 15 + y_off, EYE_PUPIL)
    elif facing == "up":
        # Back of helmet
        draw_rect(frame, 20, 6 + y_off, 44, 16 + y_off, BARAN_DARK)
        draw_rect(frame, 22, 4 + y_off, 42, 6 + y_off, BARAN_ACCENT)
    elif facing == "right":
        draw_rect(frame, 36, 12 + y_off, 44, 16 + y_off, EYE_WHITE)
        draw_rect(frame, 39, 13 + y_off, 43, 15 + y_off, EYE_PUPIL)
    elif facing == "left":
        draw_rect(frame, 20, 12 + y_off, 28, 16 + y_off, EYE_WHITE)
        draw_rect(frame, 21, 13 + y_off, 25, 15 + y_off, EYE_PUPIL)

    # Wide armored torso
    draw_rect(frame, 14, 18 + y_off, 50, 38 + y_off, BARAN_BODY)
    # Torso highlight
    draw_rect(frame, 18, 20 + y_off, 32, 30 + y_off, BARAN_LIGHT)
    # Torso shadow
    draw_rect(frame, 38, 30 + y_off, 50, 38 + y_off, BARAN_DARK)
    # Deep shadow at bottom
    draw_rect(frame, 16, 36 + y_off, 48, 38 + y_off, BARAN_DEEP)

    # Bronze armor trim edges
    draw_rect(frame, 14, 18 + y_off, 16, 38 + y_off, BARAN_ACCENT)
    draw_rect(frame, 48, 18 + y_off, 50, 38 + y_off, BARAN_ACCENT)
    draw_rect(frame, 16, 18 + y_off, 48, 20 + y_off, BARAN_ACCENT)

    # Shield emblem on chest (bronze diamond)
    draw_rect(frame, 30, 24 + y_off, 34, 24 + y_off, BARAN_ACCENT)
    draw_rect(frame, 29, 25 + y_off, 35, 27 + y_off, BARAN_ACCENT)
    draw_rect(frame, 30, 28 + y_off, 34, 28 + y_off, BARAN_ACCENT)
    # Emblem highlight
    draw_rect(frame, 31, 25 + y_off, 33, 26 + y_off, (200, 170, 100, 255))

    # Arms (wide, armored)
    arm_y = 20 + y_off - arm_raise
    # Left arm
    draw_rect(frame, 6, arm_y, 14, arm_y + 14, BARAN_DARK)
    draw_rect(frame, 8, arm_y + 2, 12, arm_y + 10, BARAN_BODY)
    draw_rect(frame, 6, arm_y, 14, arm_y + 2, BARAN_ACCENT)  # shoulder plate
    # Right arm
    draw_rect(frame, 50, arm_y, 58, arm_y + 14, BARAN_DARK)
    draw_rect(frame, 52, arm_y + 2, 56, arm_y + 10, BARAN_BODY)
    draw_rect(frame, 50, arm_y, 58, arm_y + 2, BARAN_ACCENT)  # shoulder plate


def draw_baran_legs(frame, leg_phase=0, y_off=0):
    """Draw Baran legs - short and sturdy with wide stance."""
    base_y = 38 + y_off
    offsets = [0, 1, 2, 1, 0, -1]
    off = offsets[leg_phase % 6]

    # Left leg (wide)
    draw_rect(frame, 18 - off, base_y, 28 - off, base_y + 14, BARAN_DARK)
    draw_rect(frame, 20 - off, base_y, 26 - off, base_y + 10, BARAN_BODY)
    # Boot
    draw_rect(frame, 16 - off, base_y + 14, 30 - off, base_y + 18, BARAN_DEEP)
    draw_rect(frame, 17 - off, base_y + 14, 29 - off, base_y + 16, BARAN_ACCENT)

    # Right leg (wide)
    draw_rect(frame, 36 + off, base_y, 46 + off, base_y + 14, BARAN_DARK)
    draw_rect(frame, 38 + off, base_y, 44 + off, base_y + 10, BARAN_BODY)
    # Boot
    draw_rect(frame, 34 + off, base_y + 14, 48 + off, base_y + 18, BARAN_DEEP)
    draw_rect(frame, 35 + off, base_y + 14, 47 + off, base_y + 16, BARAN_ACCENT)


def generate_baran_frames():
    """Generate all 36 frames for Baran at 64x64."""
    frames = []

    # Walk Down: frames 0-5
    for i in range(6):
        f = create_frame()
        draw_baran_body(f, facing="down")
        draw_baran_legs(f, leg_phase=i)
        frames.append(f)

    # Walk Up: frames 6-11
    for i in range(6):
        f = create_frame()
        draw_baran_body(f, facing="up")
        draw_baran_legs(f, leg_phase=i)
        frames.append(f)

    # Walk Right: frames 12-17
    for i in range(6):
        f = create_frame()
        draw_baran_body(f, facing="right")
        draw_baran_legs(f, leg_phase=i)
        frames.append(f)

    # Walk Left: frames 18-23 - mirror of right
    for i in range(6):
        f = frames[12 + i].transpose(Image.FLIP_LEFT_RIGHT)
        frames.append(f)

    # Idle: frames 24-26 (breathing)
    f = create_frame()
    draw_baran_body(f, facing="idle")
    draw_baran_legs(f, leg_phase=0)
    frames.append(f)

    f = create_frame()
    draw_baran_body(f, y_off=-2, facing="idle")
    draw_baran_legs(f, leg_phase=0, y_off=0)
    frames.append(f)

    f = create_frame()
    draw_baran_body(f, y_off=1, facing="idle")
    draw_baran_legs(f, leg_phase=0, y_off=1)
    frames.append(f)

    # Shoot: frames 27-29 (arm raise + energy blast)
    # Frame 27: arms raising
    f = create_frame()
    draw_baran_body(f, facing="down", arm_raise=3)
    draw_baran_legs(f, leg_phase=0)
    frames.append(f)

    # Frame 28: energy burst above
    f = create_frame()
    draw_baran_body(f, facing="down", arm_raise=6)
    draw_baran_legs(f, leg_phase=0)
    # Green energy burst
    draw_ellipse(f, 22, 0, 42, 10, (100, 240, 130, 255))
    draw_ellipse(f, 26, 2, 38, 7, (180, 255, 200, 255))
    frames.append(f)

    # Frame 29: energy dissipate
    f = create_frame()
    draw_baran_body(f, facing="down", arm_raise=2)
    draw_baran_legs(f, leg_phase=0)
    draw_ellipse(f, 24, 0, 40, 6, (100, 230, 130, 160))
    frames.append(f)

    # Death: frames 30-35 (armor breaking apart)
    for i in range(6):
        f = create_frame()
        alpha = max(30, 255 - i * 45)
        body_c = (BARAN_BODY[0], BARAN_BODY[1], BARAN_BODY[2], alpha)
        accent_c = (BARAN_ACCENT[0], BARAN_ACCENT[1], BARAN_ACCENT[2], alpha)
        dark_c = (BARAN_DARK[0], BARAN_DARK[1], BARAN_DARK[2], alpha)
        light_c = (BARAN_LIGHT[0], BARAN_LIGHT[1], BARAN_LIGHT[2], alpha)

        spread = i * 3
        if i < 3:
            # Armor pieces breaking apart
            # Left armor chunk
            draw_rect(f, 14 - spread, 18 + spread, 30, 38, body_c)
            draw_rect(f, 14 - spread, 18 + spread, 16 - spread, 38, accent_c)
            # Right armor chunk
            draw_rect(f, 34, 18 + spread, 50 + spread, 38, body_c)
            draw_rect(f, 48 + spread, 18 + spread, 50 + spread, 38, accent_c)
            # Helmet pieces
            draw_rect(f, 20 - spread, 4 - i * 2, 32, 10, accent_c)
            draw_rect(f, 32, 4 - i * 2, 44 + spread, 10, accent_c)
            # Emblem
            if i < 2:
                draw_rect(f, 30, 24 + spread, 34, 28 + spread, accent_c)
        else:
            # Scattered dissolution
            step = 3 + i
            for px in range(0, 64, step):
                for py in range(0, 64, step):
                    c = body_c if (px + py) % 2 == 0 else accent_c
                    draw_pixel(f, px + (i % 2), py + (i % 3), c)
                    if (px * py) % 7 == 0:
                        draw_pixel(f, px + 1, py + 1, dark_c)
        frames.append(f)

    return frames


# ============================================================
# SPRITESHEET ASSEMBLY
# ============================================================
def assemble_spritesheet(frames, name, frame_size=FRAME_SIZE):
    """Assemble frames into a horizontal strip spritesheet."""
    count = len(frames)
    sheet = Image.new("RGBA", (count * frame_size, frame_size), TRANSPARENT)
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * frame_size, 0))
    path = os.path.join(SPRITES_DIR, f"{name}.png")
    sheet.save(path)
    print(f"  Created {path} ({count} frames, {count * frame_size}x{frame_size})")


# ============================================================
# PROJECTILE SPRITESHEET - 3 frames at 16x16
# ============================================================
def generate_projectiles():
    """Generate projectile spritesheet: paran(gold teardrop), faran(red dart), baran(green bolt)."""
    sheet = Image.new("RGBA", (PROJ_SIZE * 3, PROJ_SIZE), TRANSPARENT)

    # Frame 0: Paran - gold energy teardrop
    f0 = Image.new("RGBA", (PROJ_SIZE, PROJ_SIZE), TRANSPARENT)
    # Outer glow
    draw_ellipse(f0, 2, 1, 13, 14, (255, 200, 50, 150))
    # Main teardrop body
    draw_ellipse(f0, 4, 3, 11, 12, (255, 220, 80, 255))
    # Bright core
    draw_ellipse(f0, 5, 5, 10, 10, (255, 240, 150, 255))
    # Hot center
    draw_rect(f0, 6, 6, 9, 9, (255, 255, 220, 255))
    # Directional point at top
    draw_rect(f0, 6, 1, 9, 3, (255, 210, 60, 200))
    draw_rect(f0, 7, 0, 8, 1, (255, 230, 100, 180))
    sheet.paste(f0, (0, 0))

    # Frame 1: Faran - red dart/shuriken
    f1 = Image.new("RGBA", (PROJ_SIZE, PROJ_SIZE), TRANSPARENT)
    # Outer glow
    draw_ellipse(f1, 2, 2, 13, 13, (255, 68, 68, 120))
    # Elongated dart body
    draw_rect(f1, 3, 6, 12, 9, (255, 100, 100, 255))
    draw_rect(f1, 5, 4, 10, 11, (255, 68, 68, 230))
    # Bright core
    draw_rect(f1, 6, 6, 9, 9, (255, 180, 180, 255))
    # Hot center
    draw_rect(f1, 7, 7, 8, 8, (255, 220, 220, 255))
    # Points (cross shape for shuriken feel)
    draw_rect(f1, 7, 1, 8, 4, (204, 51, 51, 200))
    draw_rect(f1, 7, 11, 8, 14, (204, 51, 51, 200))
    draw_rect(f1, 1, 7, 4, 8, (204, 51, 51, 200))
    draw_rect(f1, 11, 7, 14, 8, (204, 51, 51, 200))
    sheet.paste(f1, (PROJ_SIZE, 0))

    # Frame 2: Baran - green energy bolt
    f2 = Image.new("RGBA", (PROJ_SIZE, PROJ_SIZE), TRANSPARENT)
    # Outer glow
    draw_ellipse(f2, 2, 2, 13, 13, (68, 204, 102, 120))
    # Square-ish bolt body
    draw_rect(f2, 4, 4, 11, 11, (68, 204, 102, 255))
    # Inner core
    draw_rect(f2, 5, 5, 10, 10, (120, 230, 140, 255))
    # Bright center
    draw_rect(f2, 6, 6, 9, 9, (180, 255, 200, 255))
    # Hot center
    draw_rect(f2, 7, 7, 8, 8, (220, 255, 230, 255))
    # Bronze corner accents
    draw_rect(f2, 3, 3, 5, 5, (139, 109, 60, 255))
    draw_rect(f2, 10, 3, 12, 5, (139, 109, 60, 255))
    draw_rect(f2, 3, 10, 5, 12, (139, 109, 60, 255))
    draw_rect(f2, 10, 10, 12, 12, (139, 109, 60, 255))
    # Trail hints
    draw_rect(f2, 1, 7, 3, 8, (68, 204, 102, 100))
    draw_rect(f2, 0, 7, 1, 8, (68, 204, 102, 60))
    sheet.paste(f2, (PROJ_SIZE * 2, 0))

    path = os.path.join(SPRITES_DIR, "projectiles.png")
    sheet.save(path)
    print(f"  Created {path} (3 frames, {PROJ_SIZE * 3}x{PROJ_SIZE})")


# ============================================================
# PARTICLE TEXTURE - 16x16 soft circle gradient
# ============================================================
def generate_particle():
    """Generate 16x16 white circle particle with soft gradient edge."""
    img = Image.new("RGBA", (PROJ_SIZE, PROJ_SIZE), TRANSPARENT)
    cx, cy = PROJ_SIZE // 2, PROJ_SIZE // 2
    max_r = PROJ_SIZE // 2

    for y in range(PROJ_SIZE):
        for x in range(PROJ_SIZE):
            dx = x - cx + 0.5
            dy = y - cy + 0.5
            dist = math.sqrt(dx * dx + dy * dy)
            if dist < max_r:
                # Smooth gradient: bright center, fading to transparent edge
                t = dist / max_r
                alpha = int(255 * (1 - t * t))  # quadratic falloff
                brightness = int(255 * (1 - t * 0.3))
                img.putpixel((x, y), (brightness, brightness, brightness, alpha))

    path = os.path.join(SPRITES_DIR, "particle.png")
    img.save(path)
    print(f"  Created {path} ({PROJ_SIZE}x{PROJ_SIZE})")


# ============================================================
# TILESETS - 4 per-map tilesets, 128x64 (4 cols x 2 rows of 32x32 tiles)
# Tile IDs: 1=floor, 2=ground, 3=wall, 4=heavy, 5=medium, 6=light, 7-8=decoration
# Tilesets stay at 1x resolution -- camera zoom=2 handles visual upscaling
# ============================================================

def draw_tileset_tile(img, col, row, color, detail_fn=None):
    """Draw a single 32x32 tile at grid position."""
    x0 = col * TILE_SIZE
    y0 = row * TILE_SIZE
    draw_rect(img, x0, y0, x0 + TILE_SIZE - 1, y0 + TILE_SIZE - 1, color)
    if detail_fn:
        detail_fn(img, x0, y0)


def generate_tileset_ruins():
    """Solarpunk Ruins tileset -- stone, moss, cracks, ancient feel."""
    img = Image.new("RGBA", (128, 64), TRANSPARENT)

    # Tile 1 (0,0): Floor - weathered stone with moss spots
    draw_tileset_tile(img, 0, 0, (160, 155, 140, 255))
    # Stone texture: subtle variation
    for y in range(0, 32, 4):
        for x in range(0, 32, 6):
            c = (155 + (x * y) % 10, 150 + (x + y) % 8, 135 + (x * 3) % 10, 255)
            draw_rect(img, x, y, min(x + 3, 31), min(y + 2, 31), c)
    # Moss spots
    for pos in [(3, 5), (15, 20), (25, 8), (10, 28), (22, 14)]:
        draw_rect(img, pos[0], pos[1], pos[0] + 2, pos[1] + 1, (80, 120, 60, 255))
        draw_pixel(img, pos[0] + 1, pos[1] - 1, (90, 130, 70, 200))
    # Hairline cracks
    for y in [10, 22]:
        for dx in range(8):
            draw_pixel(img, 5 + dx, y + (dx % 2), (130, 125, 110, 255))

    # Tile 2 (1,0): Ground variant - darker stone with dust
    draw_tileset_tile(img, 1, 0, (140, 135, 120, 255))
    # Dust texture
    for y in range(0, 32, 3):
        for x in range(32, 64, 5):
            shade = 120 + ((x + y * 7) % 20)
            draw_pixel(img, x, y, (shade, shade - 5, shade - 15, 255))
    # Pebbles
    draw_rect(img, 35, 3, 37, 4, (120, 115, 100, 255))
    draw_rect(img, 48, 15, 50, 16, (125, 120, 105, 255))
    draw_rect(img, 55, 25, 57, 26, (118, 113, 98, 255))
    draw_pixel(img, 42, 22, (110, 105, 90, 255))

    # Tile 3 (2,0): Wall - crumbling stone blocks with vines
    draw_tileset_tile(img, 2, 0, (90, 85, 75, 255))
    # Stone block outlines
    draw_rect(img, 64, 0, 95, 0, (70, 65, 55, 255))
    draw_rect(img, 64, 15, 95, 16, (70, 65, 55, 255))
    draw_rect(img, 64, 31, 95, 31, (70, 65, 55, 255))
    draw_rect(img, 79, 0, 80, 15, (70, 65, 55, 255))
    draw_rect(img, 72, 16, 73, 31, (70, 65, 55, 255))
    # Block face shading
    draw_rect(img, 65, 1, 78, 14, (95, 90, 80, 255))
    draw_rect(img, 81, 1, 94, 14, (85, 80, 70, 255))
    draw_rect(img, 65, 17, 71, 30, (88, 83, 73, 255))
    # Vines growing over
    for y in range(0, 30, 2):
        vx = 68 + (y * 3) % 8
        draw_pixel(img, vx, y, (50, 100, 40, 255))
        draw_pixel(img, vx + 1, y + 1, (60, 110, 50, 230))
    # Moss on top edge
    draw_rect(img, 64, 0, 68, 1, (55, 95, 40, 255))
    draw_rect(img, 85, 0, 90, 1, (60, 100, 45, 255))

    # Tile 4 (3,0): Heavy obstacle - dark stone pillar with moss cap
    draw_tileset_tile(img, 3, 0, (80, 75, 65, 255))
    # Pillar body
    draw_rect(img, 98, 4, 125, 29, (60, 55, 45, 255))
    # Pillar face highlight
    draw_rect(img, 100, 6, 115, 27, (75, 70, 60, 255))
    draw_rect(img, 102, 8, 110, 20, (82, 77, 67, 255))
    # Pillar shadow right side
    draw_rect(img, 118, 6, 125, 29, (50, 45, 38, 255))
    # Mossy top cap
    draw_rect(img, 96, 2, 127, 5, (55, 90, 45, 255))
    draw_rect(img, 98, 1, 125, 3, (65, 105, 50, 255))
    # Base wear
    draw_rect(img, 98, 28, 125, 30, (50, 45, 38, 255))

    # Tile 5 (0,1): Medium obstacle - cracked stone block
    draw_tileset_tile(img, 0, 1, (120, 110, 95, 255))
    draw_rect(img, 4, 36, 27, 59, (100, 95, 80, 255))
    draw_rect(img, 6, 38, 25, 57, (110, 105, 90, 255))
    # Highlight face
    draw_rect(img, 7, 39, 16, 50, (118, 113, 98, 255))
    # Crack lines
    for i in range(12):
        draw_pixel(img, 8 + i, 44 + (i % 3) - (i // 4), (70, 65, 55, 255))
    for i in range(6):
        draw_pixel(img, 18 + i, 48 + (i % 2), (75, 70, 58, 255))
    # Moss in crack
    draw_pixel(img, 14, 44, (60, 100, 45, 255))
    draw_pixel(img, 15, 45, (55, 95, 40, 255))

    # Tile 6 (1,1): Light obstacle - rubble pile
    draw_tileset_tile(img, 1, 1, (155, 145, 125, 255))
    # Scattered rubble pieces with shading
    draw_rect(img, 36, 38, 42, 42, (110, 105, 90, 255))
    draw_rect(img, 37, 39, 41, 41, (120, 115, 100, 255))
    draw_rect(img, 48, 44, 56, 50, (105, 100, 85, 255))
    draw_rect(img, 49, 45, 55, 49, (115, 110, 95, 255))
    draw_rect(img, 40, 51, 47, 57, (100, 95, 80, 255))
    draw_rect(img, 41, 52, 46, 56, (112, 107, 92, 255))
    # Small pebbles
    draw_pixel(img, 44, 42, (90, 85, 70, 255))
    draw_pixel(img, 53, 52, (95, 90, 75, 255))
    draw_pixel(img, 35, 48, (88, 83, 68, 255))

    # Tile 7 (2,1): Decoration - mossy stone floor
    draw_tileset_tile(img, 2, 1, (150, 148, 135, 255))
    # Moss patches
    draw_rect(img, 66, 36, 72, 40, (75, 115, 55, 255))
    draw_rect(img, 80, 48, 88, 54, (70, 110, 50, 255))
    draw_pixel(img, 74, 44, (80, 120, 60, 200))
    draw_pixel(img, 90, 38, (65, 105, 48, 200))

    # Tile 8 (3,1): Decoration - cracked floor
    draw_tileset_tile(img, 3, 1, (155, 150, 138, 255))
    for i in range(15):
        draw_pixel(img, 100 + i, 40 + (i * 3) % 8, (130, 125, 110, 255))
    for i in range(10):
        draw_pixel(img, 110 + (i % 5), 50 + i, (125, 120, 108, 255))

    path = os.path.join(TILESETS_DIR, "solarpunk_ruins.png")
    img.save(path)
    print(f"  Created {path}")


def generate_tileset_living():
    """Solarpunk Living tileset -- grass, wood, leaves, organic."""
    img = Image.new("RGBA", (128, 64), TRANSPARENT)

    # Tile 1 (0,0): Floor - lush grass with dirt path
    draw_tileset_tile(img, 0, 0, (120, 160, 80, 255))
    # Grass blade texture
    for y in range(0, 32, 3):
        for x in range(0, 32, 4):
            shade = 110 + ((x * 7 + y * 3) % 30)
            g_val = 150 + ((x + y * 5) % 20)
            draw_pixel(img, x, y, (shade, g_val, shade - 30, 255))
    # Dirt path patches
    for pos in [(5, 10), (20, 22), (12, 4)]:
        draw_rect(img, pos[0], pos[1], pos[0] + 4, pos[1] + 2, (140, 120, 80, 255))
        draw_pixel(img, pos[0] + 2, pos[1] + 3, (135, 115, 75, 200))

    # Tile 2 (1,0): Ground - darker wild grass
    draw_tileset_tile(img, 1, 0, (90, 130, 60, 255))
    for y in range(0, 32, 2):
        for x in range(32, 64, 3):
            shade = 80 + ((x + y) % 20)
            draw_pixel(img, x, y, (shade, shade + 40, shade - 20, 255))
    # Tall grass blades
    for pos in [(38, 5), (50, 18), (44, 26)]:
        draw_rect(img, pos[0], pos[1], pos[0], pos[1] + 4, (70, 110, 45, 255))
        draw_pixel(img, pos[0] - 1, pos[1], (80, 120, 55, 200))

    # Tile 3 (2,0): Wall - thick hedgerow/tree trunk
    draw_tileset_tile(img, 2, 0, (50, 80, 35, 255))
    # Dense leaf canopy
    for y in range(0, 32, 3):
        for x in range(64, 96, 4):
            g = 90 + ((x * 3 + y * 7) % 30)
            draw_rect(img, x, y, min(x + 2, 95), min(y + 2, 31), (50, g, 35 + (y % 10), 255))
    # Central trunk
    draw_rect(img, 74, 6, 85, 26, (80, 55, 30, 255))
    draw_rect(img, 76, 8, 83, 24, (90, 65, 38, 255))
    # Bark texture
    for y in range(8, 24, 3):
        draw_pixel(img, 78, y, (70, 48, 25, 255))
        draw_pixel(img, 81, y + 1, (72, 50, 27, 255))
    # Leaf overlap on trunk
    draw_rect(img, 72, 4, 87, 8, (55, 95, 40, 255))

    # Tile 4 (3,0): Heavy obstacle - stacked thick logs
    draw_tileset_tile(img, 3, 0, (100, 70, 40, 255))
    # Three logs stacked
    for log_y, log_shade in [(4, 0), (14, 5), (24, -3)]:
        base_c = (85 + log_shade, 60 + log_shade, 35 + log_shade, 255)
        bark_c = (70 + log_shade, 48 + log_shade, 25 + log_shade, 255)
        highlight_c = (100 + log_shade, 75 + log_shade, 48 + log_shade, 255)
        draw_rect(img, 100, log_y, 124, log_y + 8, base_c)
        draw_rect(img, 101, log_y + 1, 123, log_y + 3, highlight_c)
        draw_rect(img, 101, log_y + 6, 123, log_y + 7, bark_c)
        # End grain circles
        draw_rect(img, 96, log_y + 1, 100, log_y + 7, bark_c)
        draw_rect(img, 97, log_y + 3, 99, log_y + 5, (110, 85, 55, 255))
    # Moss on top log
    draw_rect(img, 102, 3, 108, 4, (65, 105, 45, 255))

    # Tile 5 (0,1): Medium obstacle - woven branch fence
    draw_tileset_tile(img, 0, 1, (110, 85, 55, 255))
    # Vertical stakes
    for stake_x in range(4, 28, 6):
        draw_rect(img, stake_x, 34, stake_x + 1, 60, (90, 65, 35, 255))
        draw_pixel(img, stake_x, 33, (95, 70, 40, 255))
    # Horizontal woven branches
    for braid_y in range(38, 58, 5):
        draw_rect(img, 2, braid_y, 28, braid_y + 2, (95, 70, 40, 255))
        draw_rect(img, 3, braid_y + 1, 27, braid_y + 1, (105, 80, 50, 255))
    # Leaf sprouts
    draw_rect(img, 8, 35, 10, 37, (70, 115, 48, 255))
    draw_rect(img, 20, 36, 22, 38, (65, 110, 45, 255))

    # Tile 6 (1,1): Light obstacle - thin saplings
    draw_tileset_tile(img, 1, 1, (130, 170, 90, 255))
    # Two thin trunks
    draw_rect(img, 40, 36, 41, 60, (90, 65, 35, 255))
    draw_rect(img, 50, 38, 51, 58, (85, 60, 32, 255))
    # Canopy leaves
    draw_ellipse(img, 35, 32, 46, 40, (70, 120, 50, 255))
    draw_ellipse(img, 36, 33, 45, 38, (80, 135, 60, 255))
    draw_ellipse(img, 45, 34, 56, 42, (65, 115, 48, 255))
    draw_ellipse(img, 46, 35, 55, 40, (75, 128, 55, 255))
    # Ground grass
    draw_rect(img, 34, 58, 56, 60, (100, 150, 70, 255))

    # Tile 7 (2,1): Decoration - flower patch
    draw_tileset_tile(img, 2, 1, (115, 158, 78, 255))
    # Flowers
    for fx, fy, fc in [(68, 40, (255, 200, 50, 255)), (78, 46, (255, 100, 100, 255)),
                        (88, 38, (200, 150, 255, 255)), (72, 54, (255, 180, 80, 255))]:
        draw_pixel(img, fx, fy, fc)
        draw_pixel(img, fx - 1, fy, fc)
        draw_pixel(img, fx + 1, fy, fc)
        draw_pixel(img, fx, fy - 1, fc)
        draw_pixel(img, fx, fy + 1, (70, 110, 45, 255))  # stem

    # Tile 8 (3,1): Decoration - mushrooms
    draw_tileset_tile(img, 3, 1, (118, 160, 80, 255))
    # Two mushrooms
    for mx, my in [(104, 48), (118, 44)]:
        draw_rect(img, mx, my + 3, mx + 1, my + 6, (180, 170, 150, 255))  # stem
        draw_rect(img, mx - 2, my, mx + 3, my + 3, (200, 80, 60, 255))  # cap
        draw_pixel(img, mx, my + 1, (255, 255, 200, 255))  # spot

    path = os.path.join(TILESETS_DIR, "solarpunk_living.png")
    img.save(path)
    print(f"  Created {path}")


def generate_tileset_tech():
    """Solarpunk Tech tileset -- solar panels, crystals, circuit lines."""
    img = Image.new("RGBA", (128, 64), TRANSPARENT)

    # Tile 1 (0,0): Floor - solar panel walkway
    draw_tileset_tile(img, 0, 0, (60, 70, 90, 255))
    # Grid lines
    for x in range(0, 32, 8):
        draw_rect(img, x, 0, x, 31, (80, 90, 110, 255))
    for y in range(0, 32, 8):
        draw_rect(img, 0, y, 31, y, (80, 90, 110, 255))
    # Solar cell fill with gradient feel
    for cy in range(0, 32, 8):
        for cx in range(0, 32, 8):
            draw_rect(img, cx + 1, cy + 1, cx + 3, cy + 3, (70, 82, 108, 255))
            draw_rect(img, cx + 4, cy + 4, cx + 6, cy + 6, (55, 65, 85, 255))
    # Subtle reflection
    draw_rect(img, 2, 2, 5, 4, (90, 100, 125, 255))

    # Tile 2 (1,0): Ground - metallic floor plating
    draw_tileset_tile(img, 1, 0, (70, 75, 85, 255))
    # Panel seams
    draw_rect(img, 32, 15, 63, 16, (90, 95, 105, 255))
    draw_rect(img, 47, 0, 48, 31, (88, 93, 103, 255))
    # Rivet dots
    for rx, ry in [(36, 4), (56, 4), (36, 26), (56, 26)]:
        draw_pixel(img, rx, ry, (100, 105, 115, 255))
        draw_pixel(img, rx + 1, ry, (95, 100, 110, 255))
    # Scuff marks
    draw_rect(img, 40, 8, 44, 9, (65, 70, 80, 255))

    # Tile 3 (2,0): Wall - bio-luminescent crystal formation
    draw_tileset_tile(img, 2, 0, (30, 50, 80, 255))
    # Large crystal
    draw_rect(img, 70, 2, 76, 28, (55, 110, 170, 255))
    draw_rect(img, 72, 4, 74, 26, (70, 130, 190, 255))
    draw_rect(img, 73, 10, 73, 18, (120, 200, 255, 255))
    # Medium crystal
    draw_rect(img, 80, 8, 85, 24, (50, 100, 160, 255))
    draw_rect(img, 82, 10, 83, 22, (65, 120, 180, 255))
    draw_rect(img, 82, 14, 83, 16, (110, 190, 245, 255))
    # Small crystal
    draw_rect(img, 88, 6, 92, 26, (55, 110, 170, 255))
    draw_rect(img, 89, 8, 91, 24, (70, 130, 190, 255))
    draw_rect(img, 90, 12, 90, 18, (120, 200, 255, 255))
    # Glow at base
    draw_rect(img, 68, 28, 94, 30, (40, 80, 130, 200))

    # Tile 4 (3,0): Heavy obstacle - full crystal cluster
    draw_tileset_tile(img, 3, 0, (35, 55, 85, 255))
    # Dense crystal mass
    draw_rect(img, 100, 2, 124, 30, (50, 100, 160, 255))
    # Interior gradient
    draw_rect(img, 104, 6, 120, 26, (65, 120, 180, 255))
    draw_rect(img, 108, 10, 116, 22, (80, 140, 200, 255))
    # Core glow
    draw_rect(img, 110, 12, 114, 20, (120, 200, 255, 255))
    draw_rect(img, 111, 14, 113, 18, (180, 230, 255, 255))
    # Facet lines
    draw_line(img, 100, 10, 110, 4, (45, 90, 150, 255))
    draw_line(img, 114, 4, 124, 10, (45, 90, 150, 255))

    # Tile 5 (0,1): Medium obstacle - cracked tech pod
    draw_tileset_tile(img, 0, 1, (45, 65, 90, 255))
    # Pod body
    draw_rect(img, 6, 38, 26, 56, (50, 95, 145, 255))
    draw_rect(img, 8, 40, 24, 54, (60, 110, 165, 255))
    # Inner glow
    draw_rect(img, 10, 42, 22, 52, (70, 130, 180, 255))
    draw_rect(img, 12, 44, 20, 50, (90, 150, 200, 255))
    # Crack
    for i in range(8):
        draw_pixel(img, 14 + (i % 3), 40 + i, (30, 50, 80, 255))
    # Sparks from crack
    draw_pixel(img, 16, 43, (200, 230, 255, 255))
    draw_pixel(img, 14, 46, (180, 220, 255, 200))

    # Tile 6 (1,1): Light obstacle - small seed pod
    draw_tileset_tile(img, 1, 1, (50, 70, 95, 255))
    # Pod
    draw_ellipse(img, 38, 40, 56, 54, (55, 105, 155, 255))
    draw_ellipse(img, 40, 42, 54, 52, (65, 120, 175, 255))
    draw_ellipse(img, 43, 44, 51, 50, (90, 160, 215, 255))
    # Glow core
    draw_rect(img, 45, 46, 49, 48, (130, 200, 240, 255))

    # Tile 7 (2,1): Decoration - circuit floor
    draw_tileset_tile(img, 2, 1, (58, 68, 88, 255))
    # Circuit traces
    draw_rect(img, 66, 44, 90, 44, (80, 130, 180, 200))
    draw_rect(img, 78, 36, 78, 56, (80, 130, 180, 200))
    # Nodes
    draw_rect(img, 77, 43, 79, 45, (120, 200, 255, 255))
    draw_rect(img, 66, 43, 68, 45, (100, 180, 230, 200))
    draw_rect(img, 88, 43, 90, 45, (100, 180, 230, 200))

    # Tile 8 (3,1): Decoration - dimmed panel
    draw_tileset_tile(img, 3, 1, (55, 65, 85, 255))
    draw_rect(img, 100, 36, 122, 58, (48, 58, 78, 255))
    draw_rect(img, 102, 38, 120, 56, (52, 62, 82, 255))
    # Status light
    draw_rect(img, 108, 44, 110, 46, (80, 180, 100, 255))
    draw_rect(img, 114, 44, 116, 46, (180, 80, 80, 200))

    path = os.path.join(TILESETS_DIR, "solarpunk_tech.png")
    img.save(path)
    print(f"  Created {path}")


def generate_tileset_mixed():
    """Solarpunk Mixed tileset -- cobblestone, brick, vine, machinery."""
    img = Image.new("RGBA", (128, 64), TRANSPARENT)

    # Tile 1 (0,0): Floor - cobblestone with grass in cracks
    draw_tileset_tile(img, 0, 0, (150, 145, 130, 255))
    # Cobblestone pattern
    for y in range(0, 32, 8):
        offset = 4 if (y // 8) % 2 else 0
        for x in range(offset, 32, 8):
            stone_shade = 135 + ((x + y) % 12)
            draw_rect(img, x, y, min(x + 6, 31), min(y + 6, 31), (stone_shade, stone_shade - 5, stone_shade - 15, 255))
            # Highlight edge
            draw_rect(img, x, y, min(x + 6, 31), y, (stone_shade + 10, stone_shade + 5, stone_shade - 5, 255))
    # Grass in cracks
    draw_rect(img, 2, 24, 6, 27, (90, 140, 60, 255))
    draw_pixel(img, 3, 23, (100, 150, 70, 200))
    draw_rect(img, 20, 4, 24, 8, (85, 135, 55, 255))
    draw_pixel(img, 22, 3, (95, 145, 65, 200))

    # Tile 2 (1,0): Ground - worn cobblestone
    draw_tileset_tile(img, 1, 0, (140, 135, 120, 255))
    for y in range(0, 32, 8):
        for x in range(32, 64, 10):
            shade = 125 + ((x * y) % 15)
            draw_rect(img, x, y, min(x + 8, 63), min(y + 6, 31), (shade, shade - 5, shade - 15, 255))
            draw_rect(img, x, y, min(x + 8, 63), y, (shade + 8, shade + 3, shade - 7, 255))
    # Worn marks
    draw_rect(img, 42, 14, 52, 15, (120, 115, 100, 255))

    # Tile 3 (2,0): Wall - brick + vine hybrid
    draw_tileset_tile(img, 2, 0, (100, 60, 50, 255))
    # Brick pattern
    for y in range(0, 32, 8):
        offset = 8 if (y // 8) % 2 else 0
        for x in range(64 + offset, 96, 16):
            draw_rect(img, x, y + 1, min(x + 14, 95), y + 6, (115, 72, 58, 255))
            # Mortar shadow
            draw_rect(img, x, y + 6, min(x + 14, 95), y + 7, (80, 48, 38, 255))
            # Brick highlight
            draw_rect(img, x + 1, y + 1, min(x + 5, 95), y + 2, (125, 82, 68, 255))
    # Vine overlay
    for y in range(0, 30, 2):
        vx = 66 + (y * 3) % 20
        if vx < 96:
            draw_pixel(img, vx, y, (55, 110, 42, 255))
            if vx + 1 < 96:
                draw_pixel(img, vx + 1, y + 1, (48, 100, 38, 220))
    # Leaf clusters on vine
    draw_rect(img, 70, 8, 73, 11, (60, 115, 48, 255))
    draw_rect(img, 78, 18, 81, 21, (55, 108, 44, 255))

    # Tile 4 (3,0): Heavy obstacle - overgrown machinery/generator
    draw_tileset_tile(img, 3, 0, (80, 80, 75, 255))
    # Machine body
    draw_rect(img, 100, 4, 124, 28, (62, 62, 58, 255))
    draw_rect(img, 102, 6, 122, 26, (55, 55, 50, 255))
    # Machine face detail
    draw_rect(img, 104, 8, 120, 24, (68, 68, 63, 255))
    # Vent slats
    for vy in range(10, 22, 3):
        draw_rect(img, 106, vy, 118, vy + 1, (50, 50, 45, 255))
    # Gear detail center
    draw_rect(img, 110, 14, 114, 18, (90, 90, 85, 255))
    draw_rect(img, 111, 15, 113, 17, (48, 48, 43, 255))
    # Overgrown vines
    draw_rect(img, 100, 3, 104, 7, (55, 105, 42, 255))
    draw_rect(img, 120, 3, 124, 9, (50, 100, 40, 255))
    draw_rect(img, 98, 26, 102, 30, (48, 95, 38, 255))

    # Tile 5 (0,1): Medium obstacle - console/terminal
    draw_tileset_tile(img, 0, 1, (90, 90, 85, 255))
    # Console body
    draw_rect(img, 4, 38, 28, 56, (70, 70, 65, 255))
    draw_rect(img, 5, 39, 27, 55, (75, 75, 70, 255))
    # Screen
    draw_rect(img, 7, 40, 25, 49, (35, 75, 55, 255))
    draw_rect(img, 8, 41, 24, 48, (50, 110, 75, 255))
    # Screen text lines
    draw_rect(img, 9, 42, 18, 43, (70, 140, 95, 255))
    draw_rect(img, 9, 44, 15, 45, (65, 130, 88, 255))
    draw_rect(img, 9, 46, 20, 47, (60, 125, 82, 255))
    # Buttons
    draw_rect(img, 8, 50, 11, 53, (200, 55, 55, 255))
    draw_pixel(img, 9, 51, (240, 80, 80, 255))
    draw_rect(img, 13, 50, 16, 53, (55, 200, 55, 255))
    draw_pixel(img, 14, 51, (80, 240, 80, 255))
    draw_rect(img, 18, 50, 21, 53, (55, 55, 200, 255))
    draw_pixel(img, 19, 51, (80, 80, 240, 255))

    # Tile 6 (1,1): Light obstacle - supply crate
    draw_tileset_tile(img, 1, 1, (140, 120, 80, 255))
    # Crate body
    draw_rect(img, 36, 36, 58, 58, (128, 108, 68, 255))
    draw_rect(img, 37, 37, 57, 57, (120, 100, 60, 255))
    # Crate highlights
    draw_rect(img, 37, 37, 57, 38, (138, 118, 78, 255))
    draw_rect(img, 37, 37, 38, 57, (135, 115, 75, 255))
    # Cross bracing
    draw_rect(img, 36, 46, 58, 48, (100, 85, 55, 255))
    draw_rect(img, 46, 36, 48, 58, (100, 85, 55, 255))
    # Nail/bolt details
    draw_pixel(img, 38, 38, (90, 80, 50, 255))
    draw_pixel(img, 56, 38, (90, 80, 50, 255))
    draw_pixel(img, 38, 56, (90, 80, 50, 255))
    draw_pixel(img, 56, 56, (90, 80, 50, 255))
    # Moss on bottom corner
    draw_rect(img, 36, 54, 42, 58, (65, 108, 48, 255))
    draw_pixel(img, 43, 56, (70, 112, 50, 200))

    # Tile 7 (2,1): Decoration - overgrown metal grate
    draw_tileset_tile(img, 2, 1, (145, 140, 128, 255))
    # Grate
    for gx in range(64, 96, 6):
        draw_rect(img, gx, 34, gx + 1, 62, (90, 88, 82, 255))
    for gy in range(34, 62, 6):
        draw_rect(img, 64, gy, 95, gy + 1, (90, 88, 82, 255))
    # Moss in grate holes
    draw_rect(img, 68, 40, 70, 42, (70, 115, 50, 200))
    draw_rect(img, 82, 50, 84, 52, (65, 110, 48, 200))

    # Tile 8 (3,1): Decoration - fallen leaves
    draw_tileset_tile(img, 3, 1, (148, 143, 130, 255))
    for lx, ly, lc in [(102, 40, (160, 110, 40, 255)), (115, 48, (140, 90, 30, 255)),
                        (108, 54, (170, 120, 50, 255)), (120, 38, (130, 85, 28, 255))]:
        draw_rect(img, lx, ly, lx + 2, ly + 1, lc)
        draw_pixel(img, lx + 1, ly - 1, (lc[0] + 20, lc[1] + 10, lc[2], 200))

    path = os.path.join(TILESETS_DIR, "solarpunk_mixed.png")
    img.save(path)
    print(f"  Created {path}")


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("Generating Banger pixel art assets (HD / 2x resolution)...")
    print()

    print("[1/7] Paran spritesheet (36 frames @ 64x64)")
    paran_frames = generate_paran_frames()
    assemble_spritesheet(paran_frames, "paran")

    print("[2/7] Faran spritesheet (36 frames @ 64x64)")
    faran_frames = generate_faran_frames()
    assemble_spritesheet(faran_frames, "faran")

    print("[3/7] Baran spritesheet (36 frames @ 64x64)")
    baran_frames = generate_baran_frames()
    assemble_spritesheet(baran_frames, "baran")

    print("[4/7] Projectile spritesheet (3 frames @ 16x16)")
    generate_projectiles()

    print("[5/7] Particle texture (16x16)")
    generate_particle()

    print("[6/7] Tilesets (4 maps @ 128x64, 32x32 tiles)")
    generate_tileset_ruins()
    generate_tileset_living()
    generate_tileset_tech()
    generate_tileset_mixed()

    print()
    print("All assets generated successfully!")

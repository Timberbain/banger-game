# Pixel Art Reference

All game art is procedurally generated via `scripts/generate-assets.py` (Python 3 + PIL/Pillow). No external pixel art assets — purely algorithmic.

---

## Generation Pipeline

### Run

```bash
cd /Users/jonasbrandvik/Projects/banger-game
python3 scripts/generate-assets.py
```

### Output Directories

- Sprites: `client/public/sprites/` (paran.png, faran.png, baran.png, projectiles.png, particle.png)
- Tilesets: `client/public/tilesets/` (solarpunk_ruins.png, solarpunk_living.png, solarpunk_tech.png, solarpunk_mixed.png)

---

## Character Spritesheet Spec

Each character: 832x32px horizontal strip (26 frames at 32x32).

### Frame Layout

| Index | Animation | Notes |
|-------|-----------|-------|
| 0-3 | Walk down | Alternating leg offsets [0, 1, 0, -1] |
| 4-7 | Walk up | Back view, same leg pattern |
| 8-11 | Walk right | Side profile, arm swing |
| 12-15 | Walk left | Mirrored side profile |
| 16-17 | Idle | Subtle breathing (body shift ±1px) |
| 18-19 | Shoot | Flash/recoil + muzzle effect |
| 20-25 | Death | Body fragments splitting, alpha fade |

### Character Body Proportions

**Paran** (28-30px body): Large angular wedge. Wide torso (5,8)→(26,22), narrow shoulders (8,4)→(23,8), head cap (10,2)→(21,4). Golden accent stripes on chest (y=12-13) and sides (x=5-6, x=25-26). Eye pair at y=5.

**Faran** (20-22px body): Slim vertical. Narrow torso (10,6)→(21,22), pointed head (13,2)→(18,6). Belt accent across waist. Thin arms/legs. Pointed helmet silhouette.

**Baran** (22-24px body): Wide squat. Broad torso (7,6)→(24,24), wide head (9,3)→(22,7). Bronze armor edges on outline. Shield emblem in center (3x3 accent at chest). Sturdy legs.

### Color Palettes (5 colors each)

```python
# Paran
BODY    = (255, 204, 0)    # #FFCC00
ACCENT  = (255, 215, 0)    # #FFD700
DARK    = (204, 163, 0)    # #CCA300
LIGHT   = (255, 230, 100)  # #FFE664
OUTLINE = (0, 0, 0)        # #000000

# Faran
BODY    = (255, 68, 68)    # #FF4444
ACCENT  = (204, 51, 51)    # #CC3333
DARK    = (153, 40, 40)    # #992828
LIGHT   = (255, 120, 120)  # #FF7878

# Baran
BODY    = (68, 204, 102)   # #44CC66
ACCENT  = (139, 109, 60)   # #8B6D3C (bronze)
DARK    = (40, 150, 70)    # #287A46 (note: slightly different from #287A46)
LIGHT   = (120, 230, 140)  # #78E68C
```

### Drawing Primitives

```python
def draw_pixel(img, x, y, color):
    """Single pixel with bounds check."""
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), color)

def draw_rect(img, x1, y1, x2, y2, color):
    """Filled rectangle via PIL ImageDraw."""
    ImageDraw.Draw(img).rectangle([x1, y1, x2, y2], fill=color)

def create_frame():
    """Blank 32x32 RGBA frame."""
    return Image.new("RGBA", (32, 32), (0, 0, 0, 0))
```

### Death Animation Technique

6 frames (20-25): body fragments split outward from center. Each fragment is a 4-8px rectangle of BODY color, offset by increasing distance per frame. Alpha decreases: 255 → 200 → 150 → 100 → 50 → 0.

---

## Projectile Spritesheet

24x8px (3 frames at 8x8):

- **Frame 0 (Paran)**: Gold diamond/star shape. Center 4x4 gold body, 1px extensions on cardinal points. Energy blast aesthetic.
- **Frame 1 (Faran)**: Red horizontal dart. Elongated 6x3 body with sharp point. Quick/sharp look.
- **Frame 2 (Baran)**: Green bolt with bronze corners. 5x5 green body, 1px bronze accents at corners. Tech/power aesthetic.

---

## Particle Texture

`particle.png`: 8x8px white filled circle on transparent background. Tinted at runtime via Phaser `setTint()` for all visual effects. The white base allows any color via the expanded accent palette.

---

## Tileset Spec

Each tileset: 128x64px (4 columns x 2 rows = 8 tiles at 32x32).

### Grid Layout

```
[1: Floor] [2: Ground] [3: Wall]   [4: Heavy]
[5: Medium] [6: Light] [7: Empty] [8: Empty]
```

### Technique Per Tile Type

**Floor (ID 1)**: Base material color. Subtle texture via scatter dither (3-5 random darker pixels). Should read as "walkable ground."

**Ground (ID 2)**: Darker floor variant. More texture density. Used for variety in ground layer. Similar material, lower luminance.

**Wall (ID 3)**: Impassable boundary. Strong outline on inside edges. Distinct from floor by >20% luminance difference. 2-3 color layers: base → detail → highlight.

**Heavy Obstacle (ID 4, 5HP)**: Tallest/densest destructible. Full tile coverage. Dark base with contrasting cap/top highlight. Feels massive and solid.

**Medium Obstacle (ID 5, 3HP)**: Mid-size destructible. 70-80% tile coverage. Visible base material underneath. Less imposing than heavy.

**Light Obstacle (ID 6, 2HP)**: Smallest destructible. 50-60% tile coverage. Clearly breakable aesthetic. Paran instant-breaks these.

### Per-Theme Palettes

**Ruins** (test_arena): Gray stone (#948C78 → #524E44) + moss green (#486C34). Mortar lines, vine growth on walls.

**Living** (corridor_chaos): Grass greens (#689444 → #304C20) + brown logs (#5C4024). Leaf textures on hedgerow walls, dirt paths.

**Tech** (cross_fire): Dark blue (#344052 → #1C2E48) + crystal cyan (#40C0C0). Grid lines on floor panels, glow highlights on crystal walls.

**Mixed** (pillars): Cobblestone (#8C8676) + brick (#5C362C) + vine green (#387028). Grass patches through cracks, machinery detail.

### Tileset Art Rules

1. **Edge alignment**: All tiles must connect seamlessly at edges. Wall tiles need clean internal borders.
2. **Color budget**: Max 16 colors per tileset. Count includes transparent.
3. **Dither technique**: Checker pattern for material transitions (stone→moss). Scatter for texture (floor grain). Stripe for linear surfaces (wood grain, brick mortar).
4. **Highlight placement**: Top-left bias for light source consistency across all tilesets.
5. **Outline technique**: 1px black outline on wall tiles' inner edges. Floor tiles have NO outline.

---

## Map Format

All maps: 25x19 tiles = 800x608px. Tiled JSON format.

### Layer Structure

- **Ground** (bottom): Floor tiles only. Covers entire map. No gaps.
- **Walls** (top): Wall + obstacle tiles. ID 0 = empty/transparent.

### Spawn Points

Defined in map JSON custom properties or hardcoded per-map in server:
- Paran: typically center or strategic position
- Guardians: opposite sides or corners

---

## Adding New Assets

### New Character

1. Define 5-color palette: BODY, ACCENT, DARK, LIGHT + BLACK outline
2. Design silhouette at 32x32: must be distinguishable from existing 3 characters
3. Implement all 26 frames following the frame layout above
4. Add to `generate-assets.py` following existing character function pattern
5. Register in `shared/characters.ts` with stats
6. Add animation creation in `BootScene.create()`

### New Tileset

1. Choose 12-16 color palette fitting a new biome theme
2. Implement 8 tiles following the grid layout above
3. Add to `generate-assets.py` following existing tileset function pattern
4. Create Tiled JSON map using the tileset
5. Register in `MAP_TILESET_INFO` in GameScene
6. Add map entry in `shared/maps.ts`

### New Particle Effect

1. Add method to `ParticleFactory` class
2. Use `'particle'` texture key (white 8x8 circle)
3. Set tint via config or role color parameter
4. One-shot: `emitting: false` + `explode(count)` + delayed destroy
5. Continuous: `emitting: true` + `follow: target` — caller destroys

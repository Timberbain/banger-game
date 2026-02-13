# Design Schema — "Golden Afternoon"

**Aesthetic:** 1940s Art-Deco Streamline Moderne + Solarpunk Pixel Art
**Direction:** "Golden afternoon in a thriving garden city" — warm, alive, hopeful
**Source of truth:** `client/src/ui/designTokens.ts`

---

## Color Palette

### Gold — Art Deco Metalwork

| Token | Hex | Numeric | Use |
|-------|-----|---------|-----|
| `gold.dark` | #9E7828 | 0x9E7828 | Active/pressed, aged brass |
| `gold.brass` | #C49432 | 0xC49432 | Trim, borders, secondary accents |
| `gold.primary` | #D4A84A | 0xD4A84A | Titles, headers, main accents |
| `gold.light` | #E8C56A | 0xE8C56A | Hover states, sun rays |
| `gold.gleam` | #F2DA78 | 0xF2DA78 | Sparkle highlights, particle bursts |

### Background — Deep Forest

| Token | Hex | Numeric | Use |
|-------|-----|---------|-----|
| `bg.deep` | #101E14 | 0x101E14 | Scene backgrounds |
| `bg.surface` | #172C1C | 0x172C1C | Panels, cards |
| `bg.elevated` | #203828 | 0x203828 | Hovered panels |
| `bg.overlay` | rgba(0,0,0,0.85) | — | Modals, victory overlay |

### Accent — Solarpunk Spectrum

| Token | Hex | Numeric | Use |
|-------|-----|---------|-----|
| `accent.vine` | #3E7C3A | 0x3E7C3A | CTA buttons, primary interactive |
| `accent.vineHover` | #4E9C46 | 0x4E9C46 | Hover state |
| `accent.solar` | #4A92CC | 0x4A92CC | Info elements, tech UI |
| `accent.leaf` | #6CB84C | 0x6CB84C | Bright highlights, health |
| `accent.sky` | #5CACD2 | 0x5CACD2 | Light accents |
| `accent.earth` | #C4A260 | 0xC4A260 | Sandy warmth, paths |
| `accent.aqua` | #50C8C8 | 0x50C8C8 | Fountain/tech glow |

### Character Identity (stable, never change)

| Token | Hex | Numeric | Character |
|-------|-----|---------|-----------|
| `char.paran` | #FFCC00 | 0xFFCC00 | Paran (The Force) |
| `char.faran` | #FF4444 | 0xFF4444 | Faran (Guardian archer) |
| `char.baran` | #44CC66 | 0x44CC66 | Baran (Guardian shield) |

### Status

| Token | Hex | Use |
|-------|-----|-----|
| `status.success` | #44CC44 | Ready, health, cooldown ready |
| `status.warning` | #CCCC00 | Recharging, low-time |
| `status.danger` | #CC3333 | Low health, defeat |

### Text

| Token | Hex | Use |
|-------|-----|-----|
| `text.primary` | #FFFFFF | Body text, HUD |
| `text.secondary` | #B0AEA0 | Subtitles, muted labels |
| `text.disabled` | #5E5848 | Disabled states |

---

## Typography

### Font Stack

| Role | Font | Fallback |
|------|------|----------|
| Display | Engebrechtre Ex Bd | Georgia, serif |
| Heading | Engebrechtre Bd | Georgia, serif |
| Body/UI | monospace (system) | — |

Font files: `assets/fonts/engebrechtre/` (8 OTF variants). Loaded via CSS `@font-face`.

### Type Scale

| Token | Size | Use |
|-------|------|-----|
| `type.title` | 64px | Game title |
| `type.splash` | 48px | Victory/Defeat, role banner |
| `type.heading` | 28px | Scene section titles |
| `type.subheading` | 22px | Menu buttons, stat headers |
| `type.body` | 16px | Player lists, stats |
| `type.caption` | 14px | Labels, role reminders |
| `type.small` | 12px | Kill feed, ping, detail |

### Text Style Presets

| Preset | Color | Stroke | Thickness | Use |
|--------|-------|--------|-----------|-----|
| `hero` | gold.primary | bg.surface | 6px | Title, scene headers |
| `heroHeading` | gold.primary | bg.surface | 3px | Section headings |
| `splash` | white | #000000 | 6px | Role banner, countdown |
| `hud` | white bold | #000000 | 3px | Timer, health labels |
| `clean` | white | none | 0 | Buttons, body text |
| `muted` | text.secondary | none | 0 | Descriptions |

---

## Pixel Art Constraints

| Rule | Value |
|------|-------|
| Tile/sprite size | 32x32 px |
| Max tileset colors | 16 |
| Max character colors | 5 |
| Outline color | 0x000000 (black) |
| Min text stroke | 2px |
| Dither patterns | checker, stripe, scatter |

**No anti-aliasing** — integer scale rendering, >10% luminance difference between adjacent colors.
**No smooth gradients** — use hard color steps. Gold range is designed for stepped pixel shading.
**Black stroke on ALL text** — 2-8px, non-negotiable over pixel art backgrounds.
**Tint-friendly base textures** — white particle (8x8), tinted at runtime via `setTint()`.
**Dithering over blending** — checkerboard, stripe, or scattered pixels for transitions.

---

## UI Components

### Buttons

**Primary** (Ready, CTA): vine bg (#3E7C3A) → vineHover → active (#306828). Border: 2px gold.brass. Text: white 22px monospace bold. Sharp corners (0 radius).

**Secondary** (Join, Back): elevated bg (#203828) → #2A4C2A. Border: 1px vine. Text: white 16px.

**Accent** (How to Play): solar bg (#4A92CC) → sky (#5CACD2). Border: gold.brass. Blue+gold Art Deco combo.

**Danger** (Cancel): danger bg (#CC3333) → #DD4444. White bold.

**Disabled**: disabled bg (#5E5848). Text: secondary gray. No hover.

### Panels/Cards

BG: `bg.surface` (0x172C1C). Border: 2px `accent.vine`. Selected: 4px `status.success`. Disabled: 0.5 alpha. Padding: 12px.

### Health Bars

BG: 0x3A0808 (deep red). Fill: character role color. Local: 200x16px. Others: 140x12px. Low (<25%): flash 300ms.

### Cooldown Bar

BG: 0x2C2A20. Recharging: warning yellow. Ready: success green. Size: 40x6px.

### Decorative Elements

- **Dividers**: gold.primary @ 0.5 alpha, 2px
- **Vine lines**: accent.vine @ 0.25 alpha, wavy verticals
- **Solar dots**: gold.gleam @ 0.3-0.5 alpha, 1-3px radius scattered
- **Sun rays**: gold.light @ 0.20 alpha, radiating behind titles

---

## Spacing & Layout

### Scale

| Token | Value | Use |
|-------|-------|-----|
| `xs` | 4px | Tight padding |
| `sm` | 8px | Icon margins |
| `md` | 12px | Panel padding |
| `lg` | 24px | Button horizontal, section gaps |
| `xl` | 40px | Between sections |
| `xxl` | 70px | Title to content |

### HUD Positions (800x600 canvas)

| Element | Position | Anchor |
|---------|----------|--------|
| Role reminder | (10, 10) | Top-left |
| Timer | (400, 20) | Top-center |
| Ping | (780, 20) | Top-right |
| Kill feed | (790, 60+) | Top-right stack |
| Cooldown | (400, 538) | Center-bottom |
| Health bars | (*, 575) | Bottom row |

### Scene Conventions

- Title at x=400, centered
- Content stacks vertically from title
- Buttons centered, 70px vertical spacing
- Back buttons at y=500-540
- Room codes at y=40
- Max content width: 640px (80px margins)

---

## Character Design

### Paran — The Force of Nature

- Large angular/wedge shape (28-30px body at 32x32)
- Colors: body #FFCC00, accent #FFD700, dark #CCA300, light #FFE664
- Golden accent stripes on chest and sides
- Eye indicators change per facing direction
- Movement: Pac-Man cardinal (last-key-wins, instant stop, speed redirects)
- Collision penalty: ALL velocity zeroed on wall/obstacle hit

### Faran — Guardian Archer

- Slim vertical shape (20-22px body)
- Colors: body #FF4444, accent #CC3333, dark #992828, light #FF7878
- Pointed helmet, belt accent, thin limbs
- Movement: 8-directional, instant stop on release

### Baran — Guardian Shield Bearer

- Wide squat shape (22-24px body)
- Colors: body #44CC66, accent #8B6D3C (bronze), dark #287A46, light #78E68C
- Wide head, bronze armor edges, shield emblem center
- Movement: 8-directional, instant stop on release

### Spritesheet Frame Layout (26 frames, 32x32 each)

| Frames | Animation | Rate |
|--------|-----------|------|
| 0-3 | Walk down | 8fps |
| 4-7 | Walk up | 8fps |
| 8-11 | Walk right | 8fps |
| 12-15 | Walk left | 8fps |
| 16-17 | Idle | 4fps |
| 18-19 | Shoot | 10fps |
| 20-25 | Death | 10fps |

### Projectiles (8x8 frames)

- Frame 0: Paran gold diamond/star (energy blast)
- Frame 1: Faran red horizontal dart (quick/sharp)
- Frame 2: Baran green bolt with bronze corners

---

## Particle Effects

All effects use `particle.png` (8x8 white circle, tinted at runtime):

| Effect | Particles | Speed | Lifespan | Scale | Tint |
|--------|-----------|-------|----------|-------|------|
| hitBurst | 8 | 50-150 | 300ms | 1→0 | role color |
| deathExplosion | 20 | 80-250 | 600ms | 1.5→0 | player color |
| wallImpact | 6 | 30-80 | 200ms | 0.5→0 | gray #888888 |
| projectileImpact | 4 | 30-60 | 150ms | 0.3→0 | projectile tint |
| speedLines | 5 | 120-250 | 250ms | 0.8→0 | gold #FFD700 |
| victoryBurst | 30 | 100-300 | 1000ms | 2→0 | winner color |
| projectileTrail | continuous | 0 | 200ms | 0.5→0 | projectile tint |

---

## Audio Design

All SFX procedurally generated via **jsfxr** (no pre-recorded assets). Defined in `client/src/config/SoundDefs.ts`.

### Sound Categories

**Per-role combat** (3 roles x 3 types = 9 sounds): `{role}_shoot`, `{role}_hit`, `{role}_death`
**Environment**: `wall_impact`
**UI**: `button_click`, `countdown_beep`, `match_start_fanfare`, `match_end_fanfare`, `ready_chime`
**Music**: `client/public/audio/match_music.mp3`

### Volume Defaults

- SFX: 0.7 (persisted to localStorage)
- Music: 0.4 (persisted to localStorage)

---

## Tileset Design

4 tilesets, each 128x64px (4 columns x 2 rows = 8 tiles at 32x32). Generated by `scripts/generate-assets.py`.

### Tile ID Mapping

| ID | Type | Collision |
|----|------|-----------|
| 1 | Floor | Walkable |
| 2 | Ground (dark variant) | Walkable |
| 3 | Wall | Impassable |
| 4 | Heavy obstacle | Destructible (5HP) |
| 5 | Medium obstacle | Destructible (3HP) |
| 6 | Light obstacle | Destructible (2HP) |

### Map Themes

| Map | Tileset | Theme |
|-----|---------|-------|
| test_arena | solarpunk_ruins | Overgrown temple ruins, warm stone + moss |
| corridor_chaos | solarpunk_living | Dense hedge maze, grass/dirt paths |
| cross_fire | solarpunk_tech | Solar tech facility, crystals + panels |
| pillars | solarpunk_mixed | Reclaimed urban, brick + vines + machinery |

All maps: 25x19 tiles (800x608px), Tiled JSON format, two layers: "Ground" + "Walls".

---

## Reference Images

These establish visual targets — not used in-game, they inform artistic direction.

- **`assets/images/city.png`** — Solarpunk cityscape. Lush green + cream Art Deco buildings + blue solar panels. Informed: green+blue+gold triad, surface.ivory, accent.solar.
- **`assets/images/splash-bg.png`** — Hedge maze → golden temple. Informed: 5-token gold range, hedge greens, accent.earth, accent.aqua.
- **`assets/images/victory-guardian-splash.png`** — Sun-dappled forest panorama. Guardian win background.
- **`assets/images/victory-paran-splash.png`** — Stormy forest with lightning. Paran win background.

### Reference Tilesets (in `assets/tilesets/`)

- `brick_tileset.png` — Stone dungeon: mortar gaps, torch glow technique
- `hedge_tileset.png` — Garden hedge: multi-tone leaf texture, organic edges
- `wood_tileset.png` — Dark wood: grain texture, beam highlights
- `The Ground v2-4 Alpha.png` — Ground textures: dither technique reference
- `32x32 topdown tileset Spreadsheet V1-1.png` — Tile connectivity patterns

# Banger Design System: "Golden Afternoon"

**Date:** 2026-02-13
**Aesthetic:** 1940s Art-Deco Streamline Moderne + Solarpunk Pixel Art
**Direction:** "Golden afternoon in a thriving garden city" — warm, alive, hopeful. Every color feels sun-touched.
**Canvas:** 800x600, Phaser 3, pixelArt: true
**Source of truth:** `client/src/ui/designTokens.ts`

---

## 1. Color Palette

### Gold — Art Deco Metalwork Range

Five gold tones spanning from aged brass to gleaming temple dome. Inspired by the golden architecture in `assets/images/splash-bg.png` (the hedge maze temple with its multi-toned dome and brass columns).

| Token          | Hex       | Numeric    | Use                                                        |
| -------------- | --------- | ---------- | ---------------------------------------------------------- |
| `gold.dark`    | `#9E7828` | `0x9E7828` | Active/pressed states, deep borders, aged brass            |
| `gold.brass`   | `#C49432` | `0xC49432` | Trim, borders, secondary gold accents, button borders      |
| `gold.primary` | `#D4A84A` | `0xD4A84A` | Titles, headers, decorative accents, selected states       |
| `gold.light`   | `#E8C56A` | `0xE8C56A` | Hover states on gold elements, sun ray decorations         |
| `gold.gleam`   | `#F2DA78` | `0xF2DA78` | Sparkle highlights, particle bursts, solar dot decorations |

### Background — Deep Forest at Dusk

Warm dark greens with enough saturation to read as "forest" rather than "black screen." Shifted from pure green hue (H:120) toward warmer teal-green (H:145).

| Token         | Hex                | Numeric    | Use                                           |
| ------------- | ------------------ | ---------- | --------------------------------------------- |
| `bg.deep`     | `#101E14`          | `0x101E14` | Main scene backgrounds, deepest layer         |
| `bg.surface`  | `#172C1C`          | `0x172C1C` | Panel backgrounds, cards, content areas       |
| `bg.elevated` | `#203828`          | `0x203828` | Hovered panels, active cards, raised surfaces |
| `bg.overlay`  | `rgba(0,0,0,0.85)` | —          | Victory overlay, modals, dimming layers       |

### Accent — Solarpunk Spectrum

Six accent colors spanning the full solarpunk world: solar tech blue, living vine green, bright leaf chartreuse, sky azure, sandy earth, and aqua tech glow. The solar blue (`assets/images/city.png` — sky, water, solar panels) and earth tones (`assets/images/splash-bg.png` — sandy hedge maze paths) were previously absent from the palette.

| Token              | Hex       | Numeric    | Use                                                |
| ------------------ | --------- | ---------- | -------------------------------------------------- |
| `accent.vine`      | `#3E7C3A` | `0x3E7C3A` | Primary interactive elements, CTA buttons          |
| `accent.vineHover` | `#4E9C46` | `0x4E9C46` | Hover state for vine elements                      |
| `accent.solar`     | `#4A92CC` | `0x4A92CC` | Info elements, accent buttons, tech UI             |
| `accent.leaf`      | `#6CB84C` | `0x6CB84C` | Bright highlights, fresh/new indicators, health    |
| `accent.sky`       | `#5CACD2` | `0x5CACD2` | Light blue accents, hover state for solar buttons  |
| `accent.earth`     | `#C4A260` | `0xC4A260` | Sandy warmth, path colors, warm UI surfaces        |
| `accent.aqua`      | `#50C8C8` | `0x50C8C8` | Fountain/tech glow, crystal highlights, special FX |

### Surface — Warm Architecture

Cream and stone tones inspired by the solarpunk buildings in `assets/images/city.png` (warm ivory facades with cream-colored domes and pillars).

| Token           | Hex       | Numeric    | Use                                              |
| --------------- | --------- | ---------- | ------------------------------------------------ |
| `surface.ivory` | `#ECE0C2` | `0xECE0C2` | Panel borders, input backgrounds, light surfaces |
| `surface.stone` | `#D8D0BC` | `0xD8D0BC` | Architecture panels, info surfaces, warm cards   |

### Text — Warm Neutrals

Warm-tinted grays that feel organic rather than terminal-cold.

| Token            | Hex       | Use                                   |
| ---------------- | --------- | ------------------------------------- |
| `text.primary`   | `#FFFFFF` | Body text, button labels, HUD values  |
| `text.secondary` | `#B0AEA0` | Descriptions, subtitles, muted labels |
| `text.disabled`  | `#5E5848` | Disabled buttons, unavailable options |

### Status — Semantic Colors

| Token            | Hex       | Numeric    | Use                                   |
| ---------------- | --------- | ---------- | ------------------------------------- |
| `status.success` | `#44CC44` | `0x44CC44` | Ready, health full, cooldown ready    |
| `status.warning` | `#CCCC00` | `0xCCCC00` | Searching, recharging, low-time timer |
| `status.danger`  | `#CC3333` | `0xCC3333` | Errors, low health, defeat, cancel    |

### Character Identity Colors

These are stable role identity colors. They do not change.

| Token        | Hex       | Numeric    | Character         | Sprite                            |
| ------------ | --------- | ---------- | ----------------- | --------------------------------- |
| `char.paran` | `#FFCC00` | `0xFFCC00` | Paran (The Force) | `client/public/sprites/paran.png` |
| `char.faran` | `#FF4444` | `0xFF4444` | Faran (Guardian)  | `client/public/sprites/faran.png` |
| `char.baran` | `#44CC66` | `0x44CC66` | Baran (Guardian)  | `client/public/sprites/baran.png` |

### Contrast Verification

| Foreground                 | Background              | Ratio  | WCAG |
| -------------------------- | ----------------------- | ------ | ---- |
| `gold.primary` (#D4A84A)   | `bg.deep` (#101E14)     | ~6.5:1 | AA   |
| `text.primary` (#FFFFFF)   | `accent.vine` (#3E7C3A) | ~4.6:1 | AA   |
| `text.secondary` (#B0AEA0) | `bg.surface` (#172C1C)  | ~5.5:1 | AA   |
| `gold.gleam` (#F2DA78)     | `bg.deep` (#101E14)     | ~10:1  | AAA  |

---

## 2. Typography

### Font Stack

| Role    | Font               | Fallback       | Use                            |
| ------- | ------------------ | -------------- | ------------------------------ |
| Display | Engebrechtre Ex Bd | Georgia, serif | Game title, victory splash     |
| Heading | Engebrechtre Bd    | Georgia, serif | Section titles, panel headers  |
| Body    | monospace (system) | —              | Stats, descriptions, lists     |
| UI      | monospace (system) | —              | Buttons, countdown, room codes |

Font files: `assets/fonts/engebrechtre/` (8 OTF variants: Rg, Bd, Ex, Ex Bd + italics).
Loaded via CSS `@font-face` in `index.html`, confirmed ready via `document.fonts.ready` in BootScene.

### Type Scale

| Token             | Size | Font               | Use                          |
| ----------------- | ---- | ------------------ | ---------------------------- |
| `type.title`      | 64px | Engebrechtre Ex Bd | Game title                   |
| `type.splash`     | 48px | Engebrechtre Ex Bd | Victory/Defeat, role banner  |
| `type.heading`    | 28px | Engebrechtre Bd    | Scene section titles         |
| `type.subheading` | 22px | Engebrechtre Bd    | Menu buttons, stat headers   |
| `type.body`       | 16px | monospace          | Player lists, stat rows      |
| `type.caption`    | 14px | monospace          | Labels, role reminders       |
| `type.small`      | 12px | monospace          | Kill feed, ping, fine detail |

### Text Style Presets

| Preset        | Color          | Stroke     | Thickness | Use                          |
| ------------- | -------------- | ---------- | --------- | ---------------------------- |
| `hero`        | gold.primary   | bg.surface | 6px       | Title, scene headers         |
| `heroHeading` | gold.primary   | bg.surface | 3px       | Section headings             |
| `splash`      | white          | #000000    | 6px       | Role banner, fight countdown |
| `hud`         | white, bold    | #000000    | 3px       | Timer, health labels, HUD    |
| `clean`       | white          | none       | 0         | Buttons, body text           |
| `muted`       | text.secondary | none       | 0         | Descriptions, subtitles      |

---

## 3. Pixel Art Constraints

These rules apply to all visual elements. The game renders at integer scale with no anti-aliasing.

| Constraint           | Value                    | Rationale                                    |
| -------------------- | ------------------------ | -------------------------------------------- |
| Tile/sprite size     | 32x32 px                 | Standard pixel art game tile                 |
| Max tileset colors   | 16                       | Keeps each map visually cohesive             |
| Max character colors | 5                        | Clear silhouettes at native resolution       |
| Outline color        | `0x000000`               | Defines shape at small sizes                 |
| Min text stroke      | 2px                      | Readability over pixel art backgrounds       |
| Dither patterns      | checker, stripe, scatter | Texture transitions without smooth gradients |

**Rules:**

- **No anti-aliasing.** All sprites render at integer scale. Adjacent colors must differ by >10% luminance to read as distinct pixels.
- **No smooth gradients.** Use hard color steps. The gold range (dark -> brass -> primary -> light -> gleam) is designed for stepped pixel shading, not CSS gradients.
- **Black stroke on ALL text.** Every text element in the game uses 2-6px black stroke. Non-negotiable for readability over busy pixel art backgrounds.
- **Tint-friendly base textures.** The particle texture (`client/public/sprites/particle.png`) is an 8x8 white circle, tinted at runtime via Phaser `setTint()`. The expanded accent palette (leaf, sky, earth, aqua) provides a wider tintable range.
- **Dithering over blending.** Texture transitions use checkerboard dither, horizontal stripe dither, or scattered pixels. Never smooth alpha gradients.

Asset generator: `scripts/generate-assets.py` (Python 3 + PIL/Pillow).

---

## 4. UI Components

### Buttons

**Primary** (Ready, Return to Lobby, Create Room):

- BG: `accent.vine` (#3E7C3A) | Hover: `accent.vineHover` (#4E9C46) | Active: #306828
- Border: 2px `gold.brass` (#C49432) | Text: white, 22px monospace bold
- Padding: 24h x 12v | Corners: sharp (0 radius — Streamline Moderne)

**Secondary** (Join, Back):

- BG: `bg.elevated` (#203828) | Hover: #2A4C2A
- Border: 1px `accent.vine` | Text: white, 16px

**Accent** (How to Play, info actions):

- BG: `accent.solar` (#4A92CC) | Hover: `accent.sky` (#5CACD2)
- Border: `gold.brass` — the signature Art Deco combo of blue + gold trim
- Text: white, 20px

**Danger** (Cancel, Leave):

- BG: `status.danger` (#CC3333) | Hover: #DD4444 | Text: white bold

**Disabled**: BG: `text.disabled` (#5E5848), text: `text.secondary` (#B0AEA0), no hover

### Panels / Cards

- BG: `bg.surface` (0x172C1C)
- Border: 2px `accent.vine` (0x3E7C3A)
- Selected: 4px `status.success` border
- Disabled: opacity 0.5
- Padding: 12px

### HUD Backdrops

Semi-transparent floating panels used for HUD elements rendered over gameplay (timer cluster, minimap, volume controller). Codified in the `HudBackdrop` token in `designTokens.ts`.

- **When to use:** Any floating HUD element that overlays the game arena and needs a readable background
- **Token:** `HudBackdrop` from `client/src/ui/designTokens.ts`
- **Fill:** black (`0x000000`) at 45% alpha
- **Corners:** 6px rounded
- **Border:** 1px `gold.brass` (`0xC49432`) at 60% alpha

```typescript
// Usage with Phaser Graphics:
gfx.fillStyle(HudBackdrop.fill, HudBackdrop.fillAlpha);
gfx.fillRoundedRect(x, y, w, h, HudBackdrop.radius);
gfx.lineStyle(HudBackdrop.borderWidth, HudBackdrop.borderColor, HudBackdrop.borderAlpha);
gfx.strokeRoundedRect(x, y, w, h, HudBackdrop.radius);
```

### Health Bars

- BG: `0x3A0808` (deep warm red) | Fill: character role color
- Local player: 200x16px | Other players: 140x12px
- Low health (<25%): flash at 300ms interval

### Cooldown Bar

- BG: `0x2C2A20` (warm dark gray) | Recharging: `status.warning` | Ready: `status.success`
- Size: 40x6px, centered below arena

### Decorative Elements

- **Horizontal divider**: `gold.primary` @ alpha 0.5, 2px thick
- **Vine lines**: `accent.vine` @ alpha 0.25, wavy verticals on margins
- **Solar dots**: `gold.gleam` @ alpha 0.3-0.5, 1-3px radius scattered across backgrounds
- **Sun rays**: `gold.light` @ alpha 0.20, radiating lines behind titles

### Input Fields

- BG: `bg.surface` | Border: 2px `gold.primary`
- Focus: 2px `gold.light` | Text: white, 32px monospace centered uppercase

---

## 5. Spacing & Layout

### Spacing Scale

| Token       | Value | Use                             |
| ----------- | ----- | ------------------------------- |
| `space.xs`  | 4px   | Tight padding                   |
| `space.sm`  | 8px   | Icon margins                    |
| `space.md`  | 12px  | Panel padding, button vertical  |
| `space.lg`  | 24px  | Button horizontal, section gaps |
| `space.xl`  | 40px  | Between sections                |
| `space.xxl` | 70px  | Title to content                |

### HUD Layout (800x600)

| Element       | Position   | Anchor          |
| ------------- | ---------- | --------------- |
| Role reminder | (10, 10)   | Top-left        |
| Match timer   | (400, 20)  | Top-center      |
| Ping display  | (780, 20)  | Top-right       |
| Kill feed     | (790, 60+) | Top-right stack |
| Cooldown bar  | (400, 538) | Center-bottom   |
| Health bars   | (\*, 575)  | Bottom row      |

### Scene Conventions

- Title always at x=400, centered
- Content stacks vertically from title
- Buttons centered, 70px vertical spacing
- Back buttons at y=500-540
- Room codes at y=40
- Max content width: 640px (80px margins each side)

---

## 6. Asset Reference

### Reference Images (Design Direction)

These images establish the visual target for the solarpunk Art Deco world. They are not used in-game — they inform palette choices and artistic direction.

**`assets/images/city.png`** — Solarpunk cityscape panorama. Lush green vegetation alongside cream-colored Art Deco buildings with blue solar panels. Azure sky with white clouds, blue river with sparkle highlights, airships with solar sails. Establishes: the dominant green+blue+gold triad, building cream tones (informed `surface.ivory`, `surface.stone`), solar panel blue (informed `accent.solar`).

**`assets/images/splash-bg.png`** — Hedge maze leading to a golden Art Deco temple. Multiple green tones from deep shadow (#206010) to bright highlight (#80C848). Sandy earth path (#C0A058), golden temple architecture with gleaming dome, cyan fountain glow. Establishes: the 5-token gold range (dome highlights informed `gold.gleam`, aged columns informed `gold.brass`), hedge greens (informed `accent.vine`, `accent.leaf`), sandy warmth (informed `accent.earth`), fountain glow (informed `accent.aqua`).

**`assets/images/victory-guardian-splash.png`** — Sun-dappled forest panorama with mountains. Rich green gradient from dark pine to bright chartreuse. Warm amber mountain peaks, dramatic cumulus clouds against blue sky. Used as the Victory scene background for Guardian wins. Establishes: the forest green depth range, warm background tone.

**`assets/images/victory-paran-splash.png`** — Stormy forest scene with lightning. Dark, dramatic contrast to the sunlit guardian splash. Same forest composition but under heavy storm clouds. Used as the Victory scene background for Paran wins.

### Reference Tilesets (Pattern Direction)

These tileset images inform the style and technique for the game's procedurally generated tilesets. They demonstrate proper pixel art dithering, edge highlighting, and multi-tone shading.

**`assets/tilesets/brick_tileset.png`** — Stone dungeon tileset. Blue-gray stone (#606878) with mortar lines, cyan torch accents (#40C0C0). Shows: brick pattern layering, mortar gap technique, light source glow on wall tiles.

**`assets/tilesets/hedge_tileset.png`** — Garden hedge tileset. Rich greens (#305828 dark to #68B050 highlight) with dark tree trunks on lighter grass floor. Shows: multi-tone leaf textures, organic edge treatment, trunk/canopy layering.

**`assets/tilesets/wood_tileset.png`** — Dark wood interior tileset. Deep brown-black (#181010) background with warm wood beams (#705830 to #886840). Shows: wood grain texture, dark-to-warm contrast, beam highlight placement.

**`assets/tilesets/The Ground v2-4 Alpha.png`** — Ground texture reference sheet. Comprehensive dithering and texture patterns across stone, dirt, and organic materials. Shows: checkerboard dither technique, scatter pixel density, color transition zones.

**`assets/tilesets/32x32 topdown tileset Spreadsheet V1-1.png`** — 32x32 topdown tile reference. Multi-biome tile variations with walls, floors, and doors. Shows: consistent tile edge alignment, tile connectivity patterns, biome color separation.

### Generated Sprites (In-Game)

All generated by `scripts/generate-assets.py`. Frame layout: horizontal strip, 32x32 per frame.

**`client/public/sprites/paran.png`** — 832x32px (26 frames). Paran character spritesheet. Large angular/wedge shape (28-30px body). Colors: body #FFCC00, accent #FFD700, dark #CCA300, light #FFE664. Frames: walk down (0-3), walk up (4-7), walk right (8-11), walk left (12-15), idle (16-17), shoot (18-19), death (20-25).

**`client/public/sprites/faran.png`** — 832x32px (26 frames). Faran character spritesheet. Slim vertical shape (20-22px body). Colors: body #FF4444, accent #CC3333, dark #992828, light #FF7878. Same frame layout as Paran.

**`client/public/sprites/baran.png`** — 832x32px (26 frames). Baran character spritesheet. Wide squat shape (22-24px body). Colors: body #44CC66, accent #8B6D3C (bronze), dark #287A46, light #78E68C. Same frame layout as Paran.

**`client/public/sprites/projectiles.png`** — 24x8px (3 frames at 8x8). Frame 0: Paran gold diamond/star. Frame 1: Faran red horizontal dart. Frame 2: Baran green bolt with bronze corners.

**`client/public/sprites/particle.png`** — 8x8px. White filled circle. Tinted at runtime for all particle effects (hit bursts, death explosions, speed lines, wall impacts, projectile trails, victory bursts).

### Generated Tilesets (In-Game)

All 128x64px (4 columns x 2 rows = 8 tiles at 32x32). Generated by `scripts/generate-assets.py`.

Tile ID mapping: 1=floor, 2=ground, 3=wall (impassable), 4=heavy obstacle (3HP), 5=medium obstacle (3HP), 6=light obstacle (2HP), 7-8=unused/transparent.

**`client/public/tilesets/solarpunk_ruins.png`** — Map: `test_arena`. Stone ruins with moss. Current palette: gray stone tones (#A0-#60 range) with green moss spots. Used by `client/public/maps/test_arena.json`.

**`client/public/tilesets/solarpunk_living.png`** — Map: `corridor_chaos`. Living hedge maze. Current palette: grass greens (#78A850 range) with brown logs and dirt. Used by `client/public/maps/corridor_chaos.json`.

**`client/public/tilesets/solarpunk_tech.png`** — Map: `cross_fire`. Bio-luminescent tech. Current palette: dark blue (#3C5080 range) with cyan crystal glows. Used by `client/public/maps/cross_fire.json`.

**`client/public/tilesets/solarpunk_mixed.png`** — Map: `pillars`. Overgrown urban hybrid. Current palette: cobblestone gray + brick red + vine green. Used by `client/public/maps/pillars.json`.

### Tilemap Files

All 25x19 tiles (800x608px), Tiled JSON format. Two layers: "Ground" (walkable floor) and "Walls" (collision + obstacles).

| Map            | File                                     | Tileset          | Theme                  |
| -------------- | ---------------------------------------- | ---------------- | ---------------------- |
| Test Arena     | `client/public/maps/test_arena.json`     | solarpunk_ruins  | Overgrown temple ruins |
| Corridor Chaos | `client/public/maps/corridor_chaos.json` | solarpunk_living | Dense hedge maze       |
| Cross Fire     | `client/public/maps/cross_fire.json`     | solarpunk_tech   | Solar tech facility    |
| Pillars        | `client/public/maps/pillars.json`        | solarpunk_mixed  | Reclaimed urban zone   |

### Audio

**`client/public/audio/match_music.mp3`** — Background music during matches.

All SFX are procedurally generated via jsfxr at runtime (defined in `client/src/config/SoundDefs.ts`): shoot, hit, death sounds per role + wall impact, button click, countdown beep, match start/end fanfares, ready chime.

### Fonts

**`assets/fonts/engebrechtre/`** — Engebrechtre Art Deco typeface. 8 OTF variants:

- Regular (Rg), Bold (Bd), Extra Bold (Ex Bd), Extended (Ex)
- Italic variants of each
- Display use: Ex Bd for titles, Bd for headings
- Loaded via CSS @font-face, confirmed via `document.fonts.ready`

---

## 7. Tileset Target Palettes (Not Yet Implemented)

These document the target color palettes for when tilesets are updated to match the new "Golden Afternoon" design system. The current tilesets use flatter, less detailed colors.

### Ruins Target (test_arena)

Warm weathered stone with moss growth and golden inlay details.

| Element         | Color                | Hex     |
| --------------- | -------------------- | ------- |
| Floor base      | Warm weathered stone | #948C78 |
| Floor highlight | Stone light          | #A89E8A |
| Floor moss      | Moss spots           | #486C34 |
| Wall base       | Dark stone           | #524E44 |
| Wall mortar     | Mortar lines         | #3E3A30 |
| Wall vine       | Vine growth          | #306026 |
| Heavy obstacle  | Pillar base          | #443E34 |
| Heavy cap       | Mossy top            | #345828 |
| Gold accent     | Inlay detail         | #C49432 |

### Living Target (corridor_chaos)

Rich hedge greens matching the hedge maze reference (`assets/images/splash-bg.png`).

| Element        | Color           | Hex     |
| -------------- | --------------- | ------- |
| Floor base     | Grass           | #689444 |
| Floor light    | Grass highlight | #80B050 |
| Floor dirt     | Dirt path       | #C4A260 |
| Wall base      | Hedge dark      | #304C20 |
| Wall leaf      | Leaf layer      | #489038 |
| Wall highlight | Leaf highlight  | #68B050 |
| Heavy obstacle | Thick log       | #5C4024 |
| Heavy bark     | Bark texture    | #48321C |
| Path           | Sandy path      | #C0A060 |

### Tech Target (cross_fire)

Solar-punk technology with blue crystal glow and panel grids.

| Element       | Color             | Hex     |
| ------------- | ----------------- | ------- |
| Floor base    | Solar panel       | #344052 |
| Floor grid    | Grid lines        | #485466 |
| Wall base     | Crystal wall      | #1C2E48 |
| Wall crystal  | Crystal formation | #346CA8 |
| Wall glow     | Crystal core      | #6CBCF0 |
| Heavy crystal | Full crystal      | #3E78B4 |
| Accent cyan   | Tech glow         | #40C0C0 |
| Accent gold   | Solar trim        | #D4A84A |

### Mixed Target (pillars)

Warm brick walls with vine overlay and brass machinery details.

| Element      | Color           | Hex     |
| ------------ | --------------- | ------- |
| Floor base   | Cobblestone     | #8C8676 |
| Floor grass  | Grass patches   | #528234 |
| Wall base    | Brick           | #5C362C |
| Wall brick   | Brick face      | #683E32 |
| Wall vine    | Vine overlay    | #387028 |
| Heavy base   | Machinery       | #484844 |
| Heavy vine   | Vine on machine | #387028 |
| Light base   | Crate           | #847048 |
| Brass accent | Machinery trim  | #C49432 |

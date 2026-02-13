---
phase: 07-hd-viewport-camera
plan: 01
subsystem: assets
tags: [PIL, pixel-art, spritesheets, tilesets, 2x-resolution]

# Dependency graph
requires:
  - phase: 06-ux-polish
    provides: "Original 1x asset pipeline and color palette"
provides:
  - "2x character spritesheets (64x64, 36 frames) for paran/faran/baran"
  - "2x projectile spritesheet (16x16, 3 frames)"
  - "2x particle texture (16x16)"
  - "Improved 1x tilesets (128x64, 32x32 tiles)"
  - "FRAME_SIZE = 64 constant in generate-assets.py"
affects: [07-02, 07-03, 07-04, BootScene, GameScene]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "2x character sprites with setDisplaySize(32,32) -- camera zoom=2 renders at full 64x64 detail"
    - "Tilesets stay 1x (32x32 tiles) -- camera zoom handles visual upscaling"
    - "FRAME_SIZE constant for downstream frame size references"

key-files:
  created: []
  modified:
    - "scripts/generate-assets.py"
    - "client/public/sprites/paran.png"
    - "client/public/sprites/faran.png"
    - "client/public/sprites/baran.png"
    - "client/public/sprites/projectiles.png"
    - "client/public/sprites/particle.png"
    - "client/public/tilesets/solarpunk_ruins.png"
    - "client/public/tilesets/solarpunk_living.png"
    - "client/public/tilesets/solarpunk_tech.png"
    - "client/public/tilesets/solarpunk_mixed.png"

key-decisions:
  - "Characters at 64x64 with genuine 2x detail (not naive upscale)"
  - "36 frames per character: 6-frame walks, 3-frame idle/shoot, 6-frame death"
  - "Tilesets stay 128x64 (1x) -- camera zoom=2 cleanly upscales to 64x64 on screen"
  - "Particle texture uses quadratic radial gradient falloff for soft edges"

patterns-established:
  - "FRAME_SIZE = 64 constant for all downstream frame references"
  - "Character identity: Paran=round Pac-Man, Faran=slim ninja, Baran=armored tank"
  - "4 shading tones per character: light, body, dark, deep shadow"

# Metrics
duration: 9min
completed: 2026-02-13
---

# Phase 7 Plan 01: 2x HD Assets Summary

**PIL-generated 2x character spritesheets (64x64, 36 frames) with distinct role silhouettes, 4-tone shading, and 6-frame walk cycles; projectiles/particles at 16x16; tilesets improved at 1x**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-13T19:10:20Z
- **Completed:** 2026-02-13T19:19:19Z
- **Tasks:** 1
- **Files modified:** 10

## Accomplishments
- Rewrote generate-assets.py for 2x character resolution with richer pixel art detail
- Each character has distinct silhouette: Paran (round Pac-Man body), Faran (slim ninja with hood/scarf), Baran (wide armored tank with helmet)
- 36 frames per character with smoother 6-frame walk cycles, 3-frame idle breathing, 3-frame shoot animations
- Projectiles upgraded from 8x8 to 16x16 with glow borders and directional shapes (teardrop/shuriken/bolt)
- Particle texture upgraded from 8x8 solid circle to 16x16 soft radial gradient
- Tilesets improved with more shading gradients and surface textures while staying at 32x32 tiles

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite generate-assets.py for 2x characters and improved tilesets** - `ffe3499` (feat)

## Files Created/Modified
- `scripts/generate-assets.py` - Complete rewrite with 2x character generation, helper functions, FRAME_SIZE constant
- `client/public/sprites/paran.png` - 2304x64 (36 frames at 64x64), round Pac-Man body
- `client/public/sprites/faran.png` - 2304x64 (36 frames at 64x64), slim ninja silhouette
- `client/public/sprites/baran.png` - 2304x64 (36 frames at 64x64), armored tank body
- `client/public/sprites/projectiles.png` - 48x16 (3 frames at 16x16), energy projectiles with glow
- `client/public/sprites/particle.png` - 16x16, soft radial gradient white circle
- `client/public/tilesets/solarpunk_ruins.png` - 128x64, improved stone/moss/crack detail
- `client/public/tilesets/solarpunk_living.png` - 128x64, improved grass/wood/leaf detail
- `client/public/tilesets/solarpunk_tech.png` - 128x64, improved crystal/circuit/panel detail
- `client/public/tilesets/solarpunk_mixed.png` - 128x64, improved cobblestone/brick/vine detail

## Decisions Made
- Used distinct body shapes (ellipse for Paran, rectangles for Faran/Baran) instead of similar blocky forms
- Added deep shadow as 4th shading tone for each character (PARAN_DEEP, FARAN_DEEP, BARAN_DEEP)
- Particle uses quadratic alpha falloff (1 - t^2) for softer edge than linear
- Walk left frames generated via horizontal flip of walk right (same approach as v1.0)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 2x assets ready for BootScene to load with updated frameWidth/frameHeight (64 for characters, 16 for projectiles)
- Tileset PNGs unchanged in grid layout, so map JSONs need no tileset dimension changes (tiles still 32x32)
- BootScene animation registration needs frame range updates (0-5 walk, 24-26 idle, 27-29 shoot, 30-35 death)

## Self-Check: PASSED

All 10 asset files verified present. Commit ffe3499 verified in git log.

---
*Phase: 07-hd-viewport-camera*
*Completed: 2026-02-13*

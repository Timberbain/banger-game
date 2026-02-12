---
phase: 06-ux-polish
plan: 02
subsystem: ui
tags: [pixel-art, spritesheet, phaser-animations, tileset, solarpunk, PIL]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Foundation config (pixelArt, scene stubs, HUDScene)"
  - phase: 04-03
    provides: "Map JSON files and tileset structure"
provides:
  - "3 character spritesheets (paran/faran/baran) with 26 animation frames each"
  - "4 per-map solarpunk tilesets (ruins, living, tech, mixed)"
  - "Projectile spritesheet with role-specific frames"
  - "Particle texture for runtime tinting"
  - "Sprite-based player and projectile rendering with directional walk animations"
  - "Death animation on elimination"
affects: [06-03, 06-04, 06-06, 06-07]

# Tech tracking
tech-stack:
  added: [PIL/Pillow (asset generation only)]
  patterns: [programmatic pixel art generation, per-map dynamic tileset loading, velocity-based animation selection]

key-files:
  created:
    - scripts/generate-assets.py
    - client/public/sprites/paran.png
    - client/public/sprites/faran.png
    - client/public/sprites/baran.png
    - client/public/sprites/projectiles.png
    - client/public/sprites/particle.png
    - client/public/tilesets/solarpunk_ruins.png
    - client/public/tilesets/solarpunk_living.png
    - client/public/tilesets/solarpunk_tech.png
    - client/public/tilesets/solarpunk_mixed.png
  modified:
    - client/src/scenes/BootScene.ts
    - client/src/scenes/GameScene.ts
    - client/public/maps/test_arena.json
    - client/public/maps/corridor_chaos.json
    - client/public/maps/cross_fire.json
    - client/public/maps/pillars.json

key-decisions:
  - "Python PIL for asset generation instead of Node canvas (canvas package not installed)"
  - "Horizontal strip spritesheet layout (26 frames x 32px = 832x32) for Phaser spritesheet loader"
  - "Velocity-based animation selection with 5px/s threshold for idle detection"
  - "Death animation locks out walk/idle animation updates until respawn"
  - "Per-map tileset loaded dynamically via Phaser load queue after receiving mapName from server"
  - "Remote player animation estimated from position delta (px/frame * 60 = rough px/s)"

patterns-established:
  - "MAP_TILESET_INFO lookup: map name -> tileset key/image/name for dynamic loading"
  - "PROJECTILE_FRAME lookup: role -> spritesheet frame index"
  - "playerAnimKeys Map: track current animation per player to avoid restart on same key"
  - "createPlayerSprite/removePlayerSprite: extracted helpers shared by onAdd and reconnect paths"

# Metrics
duration: 8min
completed: 2026-02-12
---

# Phase 6 Plan 2: Pixel Art Assets & Sprite Integration Summary

**Programmatic pixel art spritesheets (3 characters, 4 solarpunk tilesets) with animated sprite rendering replacing all placeholder rectangles**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-12T15:24:46Z
- **Completed:** 2026-02-12T15:33:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Generated 3 character spritesheets with 26 frames each (walk 4-dir, idle, shoot, death) using distinct silhouettes per role
- Created 4 solarpunk-themed tilesets (ruins, living-walls, bio-tech, mixed) matching tile ID layout
- Replaced all Phaser.GameObjects.Rectangle player sprites with animated Phaser.GameObjects.Sprite
- Replaced all Phaser.GameObjects.Arc projectiles with role-specific sprite frames
- Removed floating health bars and name labels per user decision
- Added velocity-based directional walk animation and death animation on elimination

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate pixel art assets** - `14dfa74` (feat)
2. **Task 2: Integrate sprites into BootScene and GameScene** - `2c68012` (feat)

## Files Created/Modified
- `scripts/generate-assets.py` - Python PIL script generating all 10 PNG assets
- `client/public/sprites/paran.png` - Paran spritesheet: angular red/gold wedge, 26 frames
- `client/public/sprites/faran.png` - Faran spritesheet: slim blue/teal archer, 26 frames
- `client/public/sprites/baran.png` - Baran spritesheet: stocky green/bronze shield bearer, 26 frames
- `client/public/sprites/projectiles.png` - 3 projectile sprites (gold diamond, blue dart, green bolt)
- `client/public/sprites/particle.png` - 8x8 white circle for runtime tinting
- `client/public/tilesets/solarpunk_ruins.png` - Ruins tileset for test_arena
- `client/public/tilesets/solarpunk_living.png` - Living walls tileset for corridor_chaos
- `client/public/tilesets/solarpunk_tech.png` - Bio-tech tileset for cross_fire
- `client/public/tilesets/solarpunk_mixed.png` - Mixed aesthetic tileset for pillars
- `client/src/scenes/BootScene.ts` - Spritesheet preloading + animation definitions
- `client/src/scenes/GameScene.ts` - Sprite rendering, animation logic, per-map tileset loading
- `client/public/maps/*.json` - Updated tileset references to per-map PNGs

## Decisions Made
- **Python PIL over Node canvas:** Plan specified canvas package but it was not installed. Used PIL (available via system Python) which produces identical PNG output. No npm dependency added.
- **Horizontal strip layout (832x32):** Phaser spritesheet loader handles flat strips well; simpler than grid layout for 26 frames.
- **5px/s velocity threshold:** Prevents animation flickering near zero velocity (server noise / floating point).
- **Death animation locks animation state:** Once `-death` is playing, `updatePlayerAnimation()` skips to prevent walk animations overriding the death sequence.
- **Position-delta velocity estimation for remotes:** Remote players use interpolation (no velocity data), so we estimate from frame-to-frame position delta * 60fps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used Python PIL instead of Node canvas for asset generation**
- **Found during:** Task 1 (Generate pixel art assets)
- **Issue:** Plan specified `canvas` npm package, but it was not installed and not available at root or server level
- **Fix:** Created `scripts/generate-assets.py` using PIL/Pillow (system Python) instead of `scripts/generate-assets.ts`
- **Files modified:** scripts/generate-assets.py (created)
- **Verification:** All 10 PNG files generated successfully with correct dimensions
- **Committed in:** 14dfa74 (Task 1 commit)

**2. [Rule 1 - Bug] Removed unused CHARACTERS import after health bar removal**
- **Found during:** Task 2 (Sprite integration)
- **Issue:** CHARACTERS was imported only for maxHealth in drawHealthBar(). After removing health bars, the import became unused (would cause lint warnings).
- **Fix:** Removed the import line
- **Files modified:** client/src/scenes/GameScene.ts
- **Verification:** TypeScript compiles clean with no unused import warnings
- **Committed in:** 2c68012 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. Python PIL produces identical PNG output to canvas. No scope creep.

## Issues Encountered
None - plan executed smoothly after the canvas->PIL adaptation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All sprite assets and tilesets in place for particle effects (Plan 03), HUD (Plan 04)
- Animation system established for future animation additions
- Per-map tileset pattern ready for any additional maps

## Self-Check: PASSED

All 10 created files verified on disk. Both commit hashes (14dfa74, 2c68012) found in git log.

---
*Phase: 06-ux-polish*
*Completed: 2026-02-12*

---
phase: 08-arena-overhaul
plan: 01
subsystem: assets
tags: [pil, tileset, tilemap, arena, map-generation, python]

# Dependency graph
requires:
  - phase: 07-hd-viewport-camera
    provides: "Dynamic camera bounds, pixelArt rendering, overview zoom"
provides:
  - "3 composite tileset PNGs (128x96, 12 tiles each)"
  - "3 arena map JSONs (50x38 tiles, 1600x1216px)"
  - "generate-arenas.py asset pipeline script"
affects: [08-02, shared/obstacles.ts, shared/maps.ts, GameScene, GameRoom]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Composite tileset: ground+wall+obstacle+deco in single image per theme"]

key-files:
  created:
    - scripts/generate-arenas.py
    - client/public/tilesets/arena_hedge.png
    - client/public/tilesets/arena_brick.png
    - client/public/tilesets/arena_wood.png
    - client/public/maps/hedge_garden.json
    - client/public/maps/brick_fortress.json
    - client/public/maps/timber_yard.json
  modified: []

key-decisions:
  - "Tile IDs 1-4=ground, 5-8=wall/obstacles, 9-12=deco (shifted from old WALL=3 convention)"
  - "Ground tiles cherry-picked from 32x32 topdown tileset to match each theme palette"
  - "Each arena has distinct gameplay layout, not just tileset reskins"

patterns-established:
  - "Composite tileset pattern: 4x3 grid combining ground + wall/obstacle + decoration rows"
  - "Map JSON includes tileMapping property for human-readable tile ID documentation"

# Metrics
duration: 3min
completed: 2026-02-13
---

# Phase 8 Plan 01: Arena Asset Generation Summary

**PIL-based generator script producing 3 themed composite tilesets (128x96) and 3 distinct 50x38 arena map JSONs with documented tile ID mapping**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T22:18:58Z
- **Completed:** 2026-02-13T22:22:43Z
- **Tasks:** 1
- **Files created:** 7

## Accomplishments
- Created generate-arenas.py that extracts tiles from source art (hedge/brick/wood tilesets + ground atlas) into composite 128x96 PNGs
- Generated 3 arena map JSONs with distinct layouts: hedge_garden (open corridors), brick_fortress (chambered rooms), timber_yard (symmetric cross)
- All maps verified: perimeter walls solid, no sealed rooms (flood fill connectivity check), tileMapping property included
- Tile ID convention: 1-4=ground, 5=wall, 6=heavy, 7=medium, 8=light, 9-12=decoration (firstgid=1)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generate-arenas.py script that produces composite tilesets and map JSONs** - `1c149f7` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `scripts/generate-arenas.py` - Arena asset generation pipeline (composite tilesets + map JSONs)
- `client/public/tilesets/arena_hedge.png` - Hedge theme composite tileset (128x96, 12 tiles)
- `client/public/tilesets/arena_brick.png` - Brick theme composite tileset (128x96, 12 tiles)
- `client/public/tilesets/arena_wood.png` - Wood theme composite tileset (128x96, 12 tiles)
- `client/public/maps/hedge_garden.json` - 50x38 hedge-themed arena (300 walls, 165 obstacles)
- `client/public/maps/brick_fortress.json` - 50x38 brick-themed arena (368 walls, 48 obstacles)
- `client/public/maps/timber_yard.json` - 50x38 wood-themed arena (322 walls, 68 obstacles)

## Decisions Made
- **Tile ID layout (IDs 1-4=ground, 5-8=wall/obstacles):** Ground tiles placed in row 0 for intuitive ordering. This shifts wall/obstacle IDs from the old convention (WALL=3) to new (WALL=5). Plan 02 must update obstacles.ts atomically.
- **Ground tile selection:** Cherry-picked from the 42x12 ground atlas: green-grey tones for hedge, grey-stone for brick, brown-earth for wood.
- **Layout diversity:** Each arena has unique gameplay character -- hedge favors Paran speed (long corridors), brick favors Guardians (chambered rooms with narrow doors), timber is balanced (symmetric cross pattern).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 3 composite tilesets and 3 map JSONs ready for integration
- Plan 02 must update: shared/obstacles.ts (tile IDs 5-8), shared/maps.ts (new map entries), GameScene.ts (tileset loading), GameRoom.ts (map loading)
- Old maps (test_arena, corridor_chaos, cross_fire, pillars) and old tilesets (solarpunk_*) should be replaced in plan 02

## Self-Check: PASSED

All 7 created files verified on disk. Commit `1c149f7` verified in git log.

---
*Phase: 08-arena-overhaul*
*Completed: 2026-02-13*

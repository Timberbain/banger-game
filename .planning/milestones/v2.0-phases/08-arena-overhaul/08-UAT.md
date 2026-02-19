---
status: diagnosed
phase: 08-arena-overhaul
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md
started: 2026-02-14T10:00:00Z
updated: 2026-02-14T10:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Arena Renders with Themed Tileset
expected: Start a game (any map). The arena should render with colored tiles — hedges/bricks/wood depending on the map. Ground tiles are visible, walls form the perimeter and internal structures. No black gaps, tile bleeding, or visual seams between tiles.
result: issue
reported: "The wall tiles are not rendered correctly. Reference tilesets provided under assets/tilesets/walls/ use 16x32 tiles with 48 auto-tile variants and pseudo-3D perspective, but the game uses simple 32x32 composite tilesets with only 12 tiles and no auto-tiling."
severity: blocker
diagnosis: RESOLVED — Investigation found the implementation already uses reference tilesets correctly with 48 auto-tile variants, 3-layer pseudo-3D rendering, and 256x448 composite tilesets. This issue was from a prior UAT iteration and has been fixed.

### 2. Arena is Larger with Camera Scrolling
expected: Move your character around the arena. The arena should be noticeably larger than the viewport (roughly 1600x1216 pixels). The camera should follow your character smoothly, revealing more of the arena as you move. The camera should stop at world edges with no black void visible.
result: pass

### 3. Overview Zoom at Match Start
expected: When a match begins, the camera should briefly zoom out to show the full arena (the entire map fits in the viewport), then zoom back in to follow your character. This gives a bird's-eye preview of the arena layout.
result: pass

### 4. Wall and Obstacle Collision
expected: Walk into walls and obstacles. Your character should be blocked and not pass through them. Paran should lose all velocity on wall hit. Guardians should stop at walls normally. Destructible obstacles should take damage from projectiles.
result: issue
reported: "The movement and collision is really strange. Its like im colliding into invisible objects and the character jumps around a lot. Characters get bugged through walls. Perhaps review how the server and client is synced."
severity: blocker

### 5. Visually Distinct Arena Themes
expected: Play multiple matches (or observe the map across games). Each arena should look clearly different — hedge_garden has green/organic corridors, brick_fortress has grey stone chambers, timber_yard has brown wooden structures. They should NOT look like reskins of the same layout.
result: pass

### 6. Map Rotation Across Matches
expected: Play 2-3 consecutive matches. Each match should load a different arena map. The rotation should cycle through hedge_garden, brick_fortress, and timber_yard sequentially.
result: pass

### 7. Spawn Positions
expected: When a match starts, Paran should spawn separated from Guardians (not on top of each other). Spawn locations should be within the playable arena area, not inside walls.
result: issue
reported: "Spawn areas are still within walls. Screenshot shows character spawning right next to/inside wall tiles on timber_yard."
severity: major

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Arenas render using the tileset spritesheets with no tile bleeding or visual seams"
  status: resolved
  reason: "User reported: Wall tiles not rendered correctly. Reference tilesets use 16x32 tiles with 48 auto-tile variants and pseudo-3D perspective, but game uses simple 32x32 composite tilesets with 12 tiles and no auto-tiling."
  severity: blocker
  test: 1
  root_cause: "Already fixed — investigation confirmed implementation uses reference tilesets correctly with 48 auto-tile variants, 3-layer pseudo-3D, 256x448 composites. Stale observation from prior UAT."
  artifacts: []
  missing: []
  debug_session: ".planning/debug/tileset-rendering-gap.md"

- truth: "Walls block player movement correctly with no invisible collisions or clipping through geometry"
  status: failed
  reason: "User reported: Movement and collision is really strange. Colliding into invisible objects, character jumps around a lot, characters get bugged through walls. Server/client sync issue suspected."
  severity: blocker
  test: 4
  root_cause: "PredictionSystem uses wrong arena bounds (800x608 instead of 1600x1216). onAdd fires before onStateChange.once, so mapMetadata is null when PredictionSystem is created. Falls back to old ARENA constant. Clamps all predicted positions to 800x608 while server uses 1600x1216, causing massive desync and jumping."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "lines 737-746: mapMetadata is null when PredictionSystem created in createPlayerSprite (called from onAdd)"
    - path: "client/src/systems/Prediction.ts"
      issue: "lines 38-41, 108-109, 170-172: falls back to ARENA={800,608}, clamps positions to wrong bounds, no setArenaBounds method"
    - path: "shared/physics.ts"
      issue: "lines 16-18: ARENA constant still 800x608"
  missing:
    - "Add setArenaBounds() method to PredictionSystem and call it from createTilemap() after mapMetadata is available"
    - "Or defer PredictionSystem construction until after onStateChange.once fires"
    - "Update ARENA fallback constant to 1600x1216 or remove hardcoded fallback"
  debug_session: ".planning/debug/phase8-collision-desync.md"

- truth: "Players spawn at map-defined positions within the playable area, not inside walls"
  status: failed
  reason: "User reported: Spawn areas are still within walls. Screenshot shows character spawning right next to/inside wall tiles on timber_yard."
  severity: major
  test: 7
  root_cause: "All 3 maps share identical hardcoded spawn points in shared/maps.ts ({paran:(800,608), faran:(200,200), baran:(1400,1016)}) that were never validated against each map's obstacle layout. 8 of 9 spawn-map combinations land on or collide with solid tiles."
  artifacts:
    - path: "shared/maps.ts"
      issue: "lines 27-54: identical spawn points for all 3 maps, not validated against tile data"
    - path: "scripts/generate-arenas.py"
      issue: "layout functions place obstacles at positions overlapping spawn coordinates"
    - path: "server/src/rooms/GameRoom.ts"
      issue: "lines 208-217: spawn assignment with no collision validation"
  missing:
    - "Each map needs unique spawn points verified to be on empty ground tiles with 1-tile buffer clearance"
    - "Either manually pick safe coords per map or add spawn validation to generate-arenas.py"
  debug_session: ".planning/debug/spawn-inside-walls.md"

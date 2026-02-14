---
phase: 09-multi-stage-rounds
plan: 02
subsystem: client
tags: [phaser, tilemap, camera, scene-overlay, stage-transition, preload]

# Dependency graph
requires:
  - phase: 09-multi-stage-rounds
    plan: 01
    provides: Server stageEnd/stageTransition/stageStart broadcasts, GameState schema stage fields
  - phase: 08-arena-overhaul
    provides: 3 composite tilesets and tilemap JSONs, MAP_TILESET_INFO
provides:
  - StageIntroScene overlay showing stage number, arena name, and score between stages
  - GameScene stage lifecycle handlers (stageEnd, stageTransition, stageStart)
  - Tilemap swap between stages with full visual cleanup (no ghost entities)
  - Camera zoom transitions (DISP-05): zoom out on stage end, overview animation on stage start
  - All 3 tileset images and tilemap JSONs preloaded in BootScene for instant transitions
  - destroyTilemap and cleanupStageVisuals methods for safe stage reset
  - matchState handling for stage_end and stage_transition states
affects: [09-03 HUD round score and victory breakdown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Camera fade callback for async tilemap swap: cam.fade() with progress >= 1 guard"
    - "Phaser overlay scene for between-stage info (StageIntroScene pattern matches VictoryScene)"
    - "BootScene preloads all arena assets upfront for zero-delay stage transitions"
    - "Tilemap destroy sequence: layers first, then tilemap, then clear collision grid"

key-files:
  created:
    - client/src/scenes/StageIntroScene.ts
  modified:
    - client/src/scenes/GameScene.ts
    - client/src/scenes/BootScene.ts
    - client/src/main.ts
    - client/src/systems/Prediction.ts

key-decisions:
  - "Preload all 3 tilesets and tilemaps in BootScene rather than lazy-loading per stage -- eliminates any loading delay during transitions"
  - "Use camera.fade() callback with progress >= 1 for tilemap swap timing -- ensures visual cleanup happens during black screen"
  - "Reuse startMatchOverview() for stage start -- identical overview animation provides consistent experience"
  - "Controls locked from stageEnd through overview completion -- prevents ghost inputs during transitions"
  - "PredictionSystem.setCollisionGrid updated to accept null for clean stage reset"

patterns-established:
  - "Stage visual lifecycle: stageEnd (zoom out) -> stageTransition (fade, cleanup, swap, intro) -> stageStart (fade in, overview)"
  - "cleanupStageVisuals preserves player sprites but resets their visual state (alpha, tint, animation)"

# Metrics
duration: 7min
completed: 2026-02-14
---

# Phase 9 Plan 2: Client Stage Transitions Summary

**Client-side stage transition lifecycle with camera zoom effects, tilemap hot-swap, StageIntroScene overlay, and BootScene asset preloading for zero-delay arena changes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-14T10:42:48Z
- **Completed:** 2026-02-14T10:50:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Preloaded all 3 tileset images and 3 tilemap JSONs in BootScene for instant stage transitions
- Created StageIntroScene overlay displaying stage number, arena name, and current score between stages
- Implemented full stage transition lifecycle in GameScene: camera zoom out on stage end, fade to black with tilemap swap, StageIntroScene overlay, fade in with overview animation on stage start
- Added cleanupStageVisuals method that destroys projectiles, trails, labels but preserves player sprites across stages
- Added destroyTilemap method for safe tilemap destruction including layer cleanup and collision grid reset
- Duplicated all stage message handlers in attachRoomListeners for reconnection support
- Updated initial map loading to use preloaded assets with dynamic fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Preload all tilemaps in BootScene and create StageIntroScene overlay** - `210429d` (feat)
2. **Task 2: Implement stage transition handlers and tilemap swap in GameScene** - `671060c` (feat)

## Files Created/Modified
- `client/src/scenes/StageIntroScene.ts` - New overlay scene showing stage number, arena name, and score between stages
- `client/src/scenes/BootScene.ts` - Preloads all 3 tileset images and 3 tilemap JSONs
- `client/src/main.ts` - Registers StageIntroScene in Phaser scene config
- `client/src/scenes/GameScene.ts` - Stage lifecycle handlers (stageEnd/stageTransition/stageStart), cleanupStageVisuals, destroyTilemap, tilemap swap, preloaded asset usage, matchState handling for stage_end/stage_transition
- `client/src/systems/Prediction.ts` - Updated setCollisionGrid to accept null for stage reset

## Decisions Made
- Preloading all tileset images and tilemap JSONs in BootScene eliminates any loading delay during stage transitions. The tradeoff is slightly longer initial load, but arena assets are small (3 PNGs + 3 JSONs).
- Camera fade callback with `progress >= 1` guard ensures tilemap swap happens during a fully black screen, preventing any visual glitch.
- Reusing `startMatchOverview()` for stage starts provides a consistent cinematic experience (overview zoom -> follow local player).
- Controls are locked from the moment `stageEnd` fires until the overview animation completes after `stageStart`, preventing any ghost input during transitions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated PredictionSystem.setCollisionGrid to accept null**
- **Found during:** Task 2 (destroyTilemap implementation)
- **Issue:** `setCollisionGrid(null)` failed TypeScript type check -- parameter typed as `CollisionGrid` only
- **Fix:** Changed parameter type to `CollisionGrid | null`
- **Files modified:** `client/src/systems/Prediction.ts`
- **Verification:** TypeScript compiles cleanly
- **Committed in:** `671060c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary type fix for stage reset functionality. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Client-side stage transitions are complete and ready for testing with server stage lifecycle
- Plan 09-03 (HUD round score and victory breakdown) can now display stage-specific information using schema fields and stageResults broadcast data
- StageIntroScene overlay is functional and ready for visual polish if needed

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 09-multi-stage-rounds*
*Completed: 2026-02-14*

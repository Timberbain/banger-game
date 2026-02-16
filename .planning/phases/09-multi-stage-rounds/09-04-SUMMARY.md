---
phase: 09-multi-stage-rounds
plan: 04
subsystem: gameplay
tags: [phaser, geometry-mask, iris-wipe, stage-transition, collision-validation, colyseus]

# Dependency graph
requires:
  - phase: 09-02
    provides: "Stage transition message handlers and tilemap swap logic"
provides:
  - "Smooth geometry mask iris wipe for stage transitions (no more camera fade)"
  - "Position update guard during stage transitions (no visible teleportation)"
  - "Server-side delayed resetStage (600ms after broadcast)"
  - "Spawn position collision validation with automatic nudging"
affects: [09-UAT, gameplay-feel, stage-transitions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Geometry mask iris wipe for scene transitions (Phaser createGeometryMask)"
    - "inStageTransition flag to guard Schema position updates during transitions"
    - "Delayed server state reset to prevent client rendering race condition"
    - "Spawn collision validation with AABB tile check and nudge offset search"

key-files:
  modified:
    - "server/src/rooms/GameRoom.ts"
    - "client/src/scenes/GameScene.ts"

key-decisions:
  - "Geometry mask iris wipe replaces camera fade for unified transition effect"
  - "600ms server delay before resetStage ensures client iris fully closes before position updates"
  - "Nested startStage timeout 3400ms maintains ~4s total transition from client perspective"
  - "loadMap called before player reset in resetStage so collision grid is available for spawn validation"
  - "Spawn nudge uses 9-offset search pattern (center + 8 cardinal/diagonal one-tile offsets)"

patterns-established:
  - "Geometry mask iris wipe: invisible circle with createGeometryMask, tween scaleX/Y 0<->1"
  - "inStageTransition guard: set true on stageEnd, false on stageStart, checked in handlePlayerChange"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 9 Plan 4: Iris Wipe Transition and Spawn Validation Summary

**Geometry mask iris wipe replacing camera fade for smooth stage transitions, with server-delayed resetStage and collision-validated spawn positions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T09:56:57Z
- **Completed:** 2026-02-16T10:01:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced janky multi-phase camera transitions (zoom + fade + swap + fade in) with a single continuous iris wipe effect using Phaser geometry masks
- Eliminated visible character teleportation by delaying server resetStage 600ms after broadcast and guarding client position updates with inStageTransition flag
- Added spawn position validation against collision grid with automatic nudge to nearest safe position if blocked
- Reordered resetStage so loadMap runs before player position reset, ensuring collision grid is available for spawn validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side -- delay resetStage and add spawn collision validation** - `f459dd7` (fix)
2. **Task 2: Client-side -- iris wipe transition and position update guard** - `3e2f991` (feat)

## Files Created/Modified
- `server/src/rooms/GameRoom.ts` - Delayed resetStage by 600ms, reordered loadMap before player reset, added spawn collision validation with AABB tile check and nudge
- `client/src/scenes/GameScene.ts` - Geometry mask iris wipe in stageEnd/stageTransition/stageStart handlers (both primary and reconnect paths), inStageTransition position guard in handlePlayerChange

## Decisions Made
- Geometry mask iris wipe chosen over camera fade for unified single-animation transition
- 600ms delay before resetStage (500ms iris close + 100ms buffer) ensures screen is fully obscured
- Nested startStage timeout set to 3400ms so total transition is ~4s from client perspective (600ms + 3400ms)
- loadMap reordered before player reset in resetStage so collision grid exists for spawn validation
- Spawn nudge uses 9-offset pattern: center then 8 cardinal/diagonal offsets at 32px (one tile)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Stage transitions now use smooth iris wipe with no visible teleportation
- Spawn positions validated against collision grid
- Both primary and reconnect handler paths implement identical iris wipe logic
- Ready for UAT verification of the improved transition feel

## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 09-multi-stage-rounds*
*Completed: 2026-02-16*

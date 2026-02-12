---
phase: 06-ux-polish
plan: 08
subsystem: ui, audio
tags: [phaser, collision-detection, hud, sfx, prediction]

# Dependency graph
requires:
  - phase: 06-ux-polish
    provides: Sound effects system, HUD overlay, PredictionSystem collision resolution
  - phase: 05.1-arena-collisions
    provides: CollisionGrid, resolveCollisions with hitX/hitY flags
provides:
  - Collision-based wall impact trigger (replaces velocity-delta heuristic)
  - Cooldown bar repositioned with clear separation from health bar labels
affects: [06-ux-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [read-and-reset flag pattern for cross-system event signaling]

key-files:
  modified:
    - client/src/systems/Prediction.ts
    - client/src/scenes/GameScene.ts
    - client/src/scenes/HUDScene.ts

key-decisions:
  - "hadCollision read-and-reset flag on PredictionSystem for wall impact detection"
  - "Cooldown bar Y=538 (was 553) for 16px gap to player name labels"

patterns-established:
  - "Read-and-reset flag: getHadCollision() returns value then clears, preventing stale triggers"

# Metrics
duration: 2min
completed: 2026-02-12
---

# Phase 06 Plan 08: Gap Closure - Wall Impact + Cooldown Bar Summary

**PredictionSystem collision flag replaces velocity-delta heuristic for wall impact SFX; cooldown bar repositioned 15px higher to clear player names**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-12T17:10:25Z
- **Completed:** 2026-02-12T17:12:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wall impact sound and particles now only trigger on actual tile collisions, not on Paran direction changes or voluntary stops
- PredictionSystem exposes hadCollision flag via read-and-reset getHadCollision() method
- Cooldown bar moved from Y=553 to Y=538, creating 16px clear gap to player name labels
- Removed unused prevPredictionVx/Vy tracking from GameScene (dead code cleanup)

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose collision flag from PredictionSystem and fix wall impact trigger** - `ed59ba7` (fix)
2. **Task 2: Fix cooldown bar overlapping player name labels** - `9fd4b3f` (fix)

## Files Created/Modified
- `client/src/systems/Prediction.ts` - Added hadCollision flag, set on resolveCollisions hit in sendInput() and reconcile(), getHadCollision() read-and-reset method
- `client/src/scenes/GameScene.ts` - Replaced velocity-delta wall impact check with getHadCollision(), removed unused prevPredictionVx/Vy
- `client/src/scenes/HUDScene.ts` - Changed cooldown bar barY from 553 to 538

## Decisions Made
- Used read-and-reset pattern for hadCollision flag: getHadCollision() returns current value and clears to false, ensuring wall impact triggers exactly once per collision event
- Set collision flag in both sendInput() and reconcile() replay paths, so wall impacts detected during server reconciliation also trigger effects
- Cooldown bar Y=538 provides 16px gap to name labels at ~557 (was only 4px gap at Y=553)

## Deviations from Plan

None - plan executed exactly as written (file was Prediction.ts not PredictionSystem.ts but same class).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wall impact effects are now accurate to actual collisions
- HUD layout has proper spacing between all elements
- Both fixes verified via TypeScript compilation

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 06-ux-polish*
*Completed: 2026-02-12*

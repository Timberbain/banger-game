---
phase: 07-hd-viewport-camera
plan: 04
subsystem: client
tags: [phaser, camera, viewport, zoom, spectator, pixel-art]

# Dependency graph
requires:
  - phase: 07-02
    provides: "1280x720 canvas with dynamic arena bounds in PredictionSystem"
provides:
  - "Camera zoom=2 with roundPixels and map-clamped bounds"
  - "Smooth follow with deadzone (40x30) and look-ahead (60px Paran, 30px Guardians)"
  - "Speed zoom-out for Paran (2.0 to 1.85 at max velocity)"
  - "Camera shake on wall impact (80ms) and damage (100ms)"
  - "Match-start overview animation (1.5s arena view then zoom to player)"
  - "Spectator camera with closest-player targeting and Tab cycling"
  - "Sprite display sizing: 32x32 characters, 8x8 projectiles in world space"
affects: [07-05, 07-06, 08-larger-arenas, 09-multi-stage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Camera follow with lerp-based look-ahead using followOffset"
    - "Speed-responsive zoom via frame-by-frame lerp interpolation"
    - "Match-start overview with controlsLocked gate"
    - "Spectator camera uses startFollow for smooth tracking (not centerOn snap)"

key-files:
  created: []
  modified:
    - client/src/scenes/GameScene.ts

key-decisions:
  - "Spectator camera uses startFollow instead of per-frame centerOn for smoother tracking"
  - "Camera shake uses Phaser built-in shake() with subtle intensities (0.003-0.005)"
  - "Look-ahead uses followOffset (SUBTRACTED) with negated direction vectors"
  - "Overview animation triggers on matchState='playing' listener"

patterns-established:
  - "Camera look-ahead: compute target offset from velocity direction, lerp at 0.04 per frame"
  - "Speed zoom: lerp current zoom toward target at 0.03 per frame for smooth transitions"
  - "Controls gating: controlsLocked + overviewActive flags checked before input processing"
  - "Spectator init: closest alive player via Math.hypot, wider deadzone (60x45), no look-ahead"

# Metrics
duration: 3min
completed: 2026-02-13
---

# Phase 7 Plan 4: Camera System Summary

**Zoom=2 camera with lerp-based look-ahead, Paran speed zoom-out, shake on impacts, 1.5s match overview, and closest-player spectator targeting with Tab cycling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T19:21:36Z
- **Completed:** 2026-02-13T19:25:33Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Camera at zoom=2 with roundPixels, bounds clamped to map dimensions (no black void at edges)
- Look-ahead shifts camera 60px (Paran) or 30px (Guardians) in movement direction with 0.04 lerp
- Paran gets speed zoom-out from 2.0 to 1.85 at max velocity, Guardians stay at constant zoom=2
- Camera shake on wall impact (80ms/0.003), damage taken (100ms/0.005), and death (100ms/0.005)
- Match-start overview shows full arena at zoom=1.0 for 1.5s then smooth Sine.easeInOut zoom to player
- Controls locked during overview animation (controlsLocked flag)
- Spectator camera targets closest alive player on death, Tab cycles targets, wider deadzone
- Character sprites sized 32x32, projectile sprites sized 8x8 for correct world-space rendering with 2x textures
- PredictionSystem receives dynamic arena bounds from mapMetadata
- Camera state fully reset in create() for scene reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: Camera setup, sprite sizing, and match-start overview** - `87afd33` (feat)
2. **Task 2: Look-ahead, speed zoom, camera shake, and spectator camera** - `aa5dbd8` (feat)

## Files Created/Modified
- `client/src/scenes/GameScene.ts` - Complete camera system: zoom, follow, look-ahead, speed zoom, shake, overview animation, spectator, sprite display sizing

## Decisions Made
- Spectator camera uses `startFollow` with lerp 0.06 instead of per-frame `centerOn` for smoother tracking without jarring snaps
- Camera shake on both damage and death for the local player only (other players' damage doesn't shake your camera)
- VictoryBurst particle position uses mapMetadata center instead of hardcoded 400,300 (auto-fixed for correctness with dynamic maps)
- Overview animation fires on matchState='playing' Schema listener, integrating cleanly with existing match start flow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed victoryBurst using hardcoded center coordinates**
- **Found during:** Task 1 (Camera setup)
- **Issue:** `particleFactory.victoryBurst(400, 300, ...)` used hardcoded coordinates that won't center correctly on non-800x600 maps
- **Fix:** Changed to `this.mapMetadata.width / 2` and `this.mapMetadata.height / 2` with 400/300 fallback
- **Files modified:** client/src/scenes/GameScene.ts (both main + reconnect handler)
- **Verification:** grep confirms both victoryBurst calls use dynamic coordinates
- **Committed in:** 87afd33 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness with dynamic map sizes. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Camera system complete, ready for HUD viewport-relative positioning (Plan 05)
- Dynamic map bounds flowing through entire pipeline: mapMetadata -> camera bounds -> prediction bounds -> sprite sizing
- All 14 camera decisions from CONTEXT.md implemented

## Self-Check: PASSED

All 1 modified file verified present. Both task commits (87afd33, aa5dbd8) verified in git log.

---
*Phase: 07-hd-viewport-camera*
*Completed: 2026-02-13*

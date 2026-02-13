---
phase: 07-hd-viewport-camera
plan: 02
subsystem: client, shared, server
tags: [phaser, resolution, physics, viewport, pixel-art]

# Dependency graph
requires:
  - phase: 06-ux-polish
    provides: "Existing 800x600 game config, HUD layout, physics system"
provides:
  - "1280x720 canvas with pixelArt and roundPixels"
  - "Dynamic arena bounds in PredictionSystem (constructor param with ARENA fallback)"
  - "Dynamic arena bounds in GameRoom (mapMetadata.width/height for edge clamping)"
  - "Layout constants updated for 1280x720"
affects: [07-03, 07-04, 07-05, 08-larger-arenas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic arena bounds via constructor injection (PredictionSystem)"
    - "Map-metadata-driven physics bounds instead of global constant"

key-files:
  created: []
  modified:
    - client/src/main.ts
    - client/src/ui/designTokens.ts
    - shared/physics.ts
    - client/src/systems/Prediction.ts
    - server/src/rooms/GameRoom.ts

key-decisions:
  - "ARENA constant preserved as fallback default, not removed -- backwards compatible"
  - "PredictionSystem uses optional constructor param with ARENA fallback for gradual migration"
  - "Removed unused arcade physics block from Phaser config (custom shared physics used)"

patterns-established:
  - "Dynamic arena bounds: PredictionSystem accepts map-specific bounds, GameRoom uses mapMetadata"
  - "ARENA constant is default/fallback only -- authoritative bounds come from MapMetadata"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 7 Plan 2: Resolution & Dynamic Bounds Summary

**1280x720 canvas with roundPixels, dynamic arena bounds in PredictionSystem (constructor injection) and GameRoom (mapMetadata), Layout constants updated**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T19:10:28Z
- **Completed:** 2026-02-13T19:12:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Game canvas set to 1280x720 with pixelArt and roundPixels enabled, unused arcade physics removed
- PredictionSystem accepts optional arenaBounds constructor parameter (falls back to ARENA constant)
- GameRoom uses this.mapMetadata.width/height for all edge clamping and projectile bounds checks
- Layout constants (center, margins, HUD positions) updated for 1280x720 viewport
- ARENA constant preserved as documented fallback default

## Task Commits

Each task was committed atomically:

1. **Task 1: Update game config to 1280x720 and Layout constants** - `087cec0` (feat)
2. **Task 2: Make arena bounds dynamic in PredictionSystem and GameRoom** - `fe095c4` (feat)

## Files Created/Modified
- `client/src/main.ts` - Phaser game config: 1280x720, roundPixels, removed arcade physics
- `client/src/ui/designTokens.ts` - Layout constants updated for 1280x720 (canvas, center, margins, HUD)
- `shared/physics.ts` - ARENA constant annotated as default/fallback
- `client/src/systems/Prediction.ts` - arenaBounds property with constructor injection, replaces all ARENA refs
- `server/src/rooms/GameRoom.ts` - Uses mapMetadata.width/height for edge clamping, removed ARENA import

## Decisions Made
- ARENA constant preserved as backwards-compatible fallback (not removed) -- PredictionSystem defaults to it when no bounds passed
- Removed unused arcade physics block from Phaser config since the game uses custom shared physics
- HUD hardcoded positions in scenes left as-is (Plan 05 scope for full viewport-relative conversion)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Canvas at 1280x720 ready for camera zoom setup (Plan 04)
- Dynamic arena bounds ready for UI repositioning (Plan 05) and larger arenas (Phase 8)
- Note: Many scene files still have hardcoded 400/300 and 800/600 positions -- Plan 05 will convert to viewport-relative

## Self-Check: PASSED

All 5 modified files verified present. Both task commits (087cec0, fe095c4) verified in git log.

---
*Phase: 07-hd-viewport-camera*
*Completed: 2026-02-13*

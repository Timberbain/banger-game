---
phase: 07-hd-viewport-camera
plan: 05
subsystem: client
tags: [phaser, HUD, lobby, victory, help, viewport, 1280x720, UI-positioning]

# Dependency graph
requires:
  - phase: 07-hd-viewport-camera-02
    provides: "1280x720 canvas resolution and Layout constants"
  - phase: 07-hd-viewport-camera-03
    provides: "HD character sprites and title screen at 1280x720"
provides:
  - "HUDScene with viewport-relative positioning (this.W/this.H from cameras.main)"
  - "LobbyScene rendering correctly at 1280x720 with centered elements"
  - "VictoryScene overlay rendering at 1280x720 with scaled stats table"
  - "HelpScene panel rendering at 1280x720 with wider role columns"
  - "No hardcoded 800/600/400/300 coordinate values in any UI scene"
affects: [08-larger-arenas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Viewport-relative HUD: this.W = cameras.main.width, this.H = cameras.main.height"
    - "Menu scenes use cameras.main.centerX/centerY/width/height instead of hardcoded values"

key-files:
  created: []
  modified:
    - client/src/scenes/HUDScene.ts
    - client/src/scenes/LobbyScene.ts
    - client/src/scenes/VictoryScene.ts
    - client/src/scenes/HelpScene.ts

key-decisions:
  - "HUD uses percentage-based viewport positioning (W*0.5, H*0.03 etc) for future resolution flexibility"
  - "LobbyScene character panels spaced 240px apart (up from 180) for wider screen"
  - "HelpScene role panels spaced 320px apart with 270x270 size for 1280 width"
  - "Volume controls positioned relative to cx instead of hardcoded 280/350/400/450"

patterns-established:
  - "HUD overlay: W/H member vars set from cameras.main in create(), all elements positioned as percentage"
  - "Menu scenes: const cx = this.cameras.main.centerX pattern for centered elements"

# Metrics
duration: 6min
completed: 2026-02-13
---

# Phase 7 Plan 05: UI Scene 1280x720 Conversion Summary

**Viewport-relative HUD positioning with cameras.main dimensions, all menu scenes (Lobby/Victory/Help) converted from 800x600 to 1280x720 with centered elements and scaled layouts**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-13T19:27:51Z
- **Completed:** 2026-02-13T19:34:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- HUDScene converted to viewport-relative positioning: timer, ping, kill feed, health bars, cooldown, role banner, spectator HUD all use W/H percentages
- LobbyScene updated from 800x600 to 1280x720: backgrounds fill camera dimensions, buttons centered at cx, character panels spaced evenly across wider screen
- VictoryScene updated: splash background fills w*h, stats table columns spread across 1280 width, particle bursts positioned proportionally
- HelpScene updated: role panels spaced 320px for 1280 width, background fills camera dimensions, back button at 640 vertical

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert HUDScene to viewport-relative positioning** - `e81334f` (feat)
2. **Task 2: Update LobbyScene, VictoryScene, HelpScene for 1280x720** - `65bbd86` (feat)

## Files Created/Modified
- `client/src/scenes/HUDScene.ts` - Viewport-relative W/H member vars, all positions use percentages (W*0.5 for center, H*0.95 for health bars, etc.)
- `client/src/scenes/LobbyScene.ts` - cameras.main.centerX/centerY for centering, width/height for backgrounds, character panels at 240px spacing
- `client/src/scenes/VictoryScene.ts` - cx/cy/w/h from cameras.main, stats columns scaled for 1280, particle bursts at proportional positions
- `client/src/scenes/HelpScene.ts` - cx/w/h from cameras.main, role panels at 320px spacing, background fills full canvas

## Decisions Made
- HUD uses percentage-based positioning (e.g., W*0.97 for ping, H*0.95 for health bars) rather than Layout constants for more flexible future resolution changes
- Health bar widths (200px local, 140px other) and cooldown bar (40x6) kept as absolute pixel values since they represent fixed UI widget sizes
- LobbyScene character panels increased spacing from 180 to 240px and panel size from 140x120 to 160x130 for wider screen
- Volume controls use relative positioning (cx-120, cx-50, cx, cx+50) instead of hardcoded x coordinates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All UI scenes render correctly at 1280x720
- HUD viewport-relative pattern ready for future resolution changes or larger arenas (Phase 8)
- Plan 06 (final Phase 7 plan) can proceed -- likely GameScene rendering or integration verification

## Self-Check: PASSED

All 4 modified files verified present. Both task commits (e81334f, 65bbd86) verified in git log.

---
*Phase: 07-hd-viewport-camera*
*Completed: 2026-02-13*

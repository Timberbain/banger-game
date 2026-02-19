---
phase: 07-hd-viewport-camera
plan: 08
subsystem: ui
tags: [phaser, hud, lobby, help-screen, layout, spacing, solarpunk]

# Dependency graph
requires:
  - phase: 07-hd-viewport-camera/05
    provides: "Viewport-relative HUD, Lobby, Help scenes at 1280x720"
provides:
  - "Non-overlapping HUD cooldown/name layout"
  - "Non-overlapping lobby title/panel layout"
  - "Playful help screen with solarpunk tone and no technical stats"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Viewport-relative Y offsets tuned for element separation"

key-files:
  created: []
  modified:
    - "client/src/scenes/HUDScene.ts"
    - "client/src/scenes/LobbyScene.ts"
    - "client/src/scenes/HelpScene.ts"

key-decisions:
  - "Cooldown bar at H*0.89 (Y=641) for 8px gap above name label at H*0.95"
  - "Panel offset increased from titleY+70 to titleY+100 with matching Players section shift"
  - "Help screen stripped of all stats/technical jargon, replaced with playful 1-sentence descriptions"

patterns-established:
  - "Help screen as game-manual tone: taglines + short flavor text, not technical specs"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 7 Plan 8: UI Overlap Fixes & Help Redesign Summary

**HUD cooldown/name gap fix, lobby panel spacing fix, and help screen redesign with playful solarpunk descriptions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T21:20:01Z
- **Completed:** 2026-02-13T21:22:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed HUD cooldown bar overlapping player name label by moving bar from H*0.92 to H*0.89
- Fixed lobby "Select Character" title overlapping character panels by increasing offset from titleY+70 to titleY+100
- Redesigned help screen: removed all stats (HP/Dmg/Fire) and technical jargon (cardinal, 8-directional), replaced with playful taglines and short flavor descriptions

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix HUD cooldown/name overlap and lobby element spacing** - `18c388c` (fix)
2. **Task 2: Redesign help screen with playful solarpunk descriptions** - `8978942` (feat)

## Files Created/Modified
- `client/src/scenes/HUDScene.ts` - Cooldown bar Y position moved from H*0.92 to H*0.89
- `client/src/scenes/LobbyScene.ts` - Panel offset increased to titleY+100, Players section shifted down 30px
- `client/src/scenes/HelpScene.ts` - Complete create() rewrite with playful descriptions, no stats, new title

## Decisions Made
- Cooldown bar at H*0.89 creates ~8px clear gap above name label (was 3px overlap at H*0.92)
- Panel offset of titleY+100 eliminates 9px overlap between title baseline and panel top edges
- Help screen uses tagline + 2-3 flavor sentences per role instead of stats and technical movement descriptions
- Added arena tip flavor line ("The arena is alive -- smash through obstacles or use them as cover!")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three UAT gap closure issues (Test 14, 15, 17) resolved
- Remaining gap closure plan (07-06) covers camera race condition and look-ahead tuning

## Self-Check: PASSED

All files verified present. Both task commits confirmed in git log.

---
*Phase: 07-hd-viewport-camera*
*Completed: 2026-02-13*

---
phase: 06-ux-polish
plan: 03
subsystem: ui, gameplay
tags: [hud, health-bars, match-timer, kill-feed, cooldown, ping, spectator, phaser-overlay-scene]

# Dependency graph
requires:
  - phase: 06-01
    provides: Match timer constant, kill broadcast, ping/pong handler, HUDScene stub
  - phase: 06-02
    provides: Pixel art sprite assets and animation system
provides:
  - Complete HUDScene overlay with health bars, match timer, kill feed, cooldown display, ping indicator
  - Role identity banner and persistent reminder
  - Spectator HUD showing target player info
  - Cross-scene event system (localFired, spectatorChanged, localDied)
  - HUD lifecycle management (launch, stop, reconnect)
affects: [06-06 (help scene may reference HUD layout), 06-07 (final polish may adjust HUD positions)]

# Tech tracking
tech-stack:
  added: []
  patterns: [cross-scene Phaser events for HUD data, overlay scene with transparent background, per-frame health/timer updates]

key-files:
  created: []
  modified:
    - client/src/scenes/HUDScene.ts
    - client/src/scenes/GameScene.ts

key-decisions:
  - "Health bars at bottom with local player centered and larger (200x16px vs 140x12px)"
  - "Role colors: paran=#ff4444, faran=#4488ff, baran=#44cc66 for consistent HUD identity"
  - "Kill feed max 4 entries with 5s fade-out, right-aligned at top-right"
  - "Ping interval every 2s, color-coded green/yellow/red by latency threshold"
  - "FIGHT! text on match start (not 3-2-1 countdown) since match auto-starts on 3 players"
  - "Cross-scene events via Phaser event emitter (not shared state) for decoupled HUD updates"

patterns-established:
  - "Cross-scene events: GameScene emits 'localFired', 'spectatorChanged', 'localDied' for HUDScene consumption"
  - "HUD lifecycle: launch from createPlayerSprite (when role known), stop on matchEnd and returnToLobby, re-launch on reconnect"
  - "Scene reuse: reset ALL member vars in create() including clearing setInterval refs"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 6 Plan 03: HUD Scene Summary

**Full HUD overlay with health bars, match timer, kill feed, cooldown display, ping indicator, role identity banner, spectator HUD, and cross-scene event integration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T15:36:53Z
- **Completed:** 2026-02-12T15:40:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Complete HUDScene with 8 distinct HUD elements: health bars, match timer, kill feed, cooldown bar, ping display, role banner, spectator HUD, and match start text
- Cross-scene event system connecting GameScene fire/death/spectator events to HUDScene displays
- Full HUD lifecycle management: launch when local player detected, stop on match end/lobby return, re-launch on reconnection

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement HUDScene with all HUD elements** - `f332e4a` (feat)
2. **Task 2: Launch HUDScene from GameScene and emit cross-scene events** - `8f4e108` (feat)

## Files Created/Modified
- `client/src/scenes/HUDScene.ts` - Full HUD overlay: health bars at bottom (local highlighted), timer at top center with 30s flash warning, kill feed at top-right, cooldown bar, ping display, role banner with fade, spectator info, match start "FIGHT!" text
- `client/src/scenes/GameScene.ts` - HUD launch from createPlayerSprite, localFired/spectatorChanged/localDied event emissions, HUD stop on match end and lobby return, HUD re-launch on reconnection

## Decisions Made
- Health bars use even spacing across bottom with local player centered and 1.4x larger than others
- Kill feed entries show killer name colored by role with `>` separator and victim name
- Cooldown display is a small 40x6px bar above local health bar area (yellow filling, green when ready)
- Client-side fire tracking approximates server cooldown for immediate visual feedback
- Match start shows "FIGHT!" for 2s then fades (no countdown since match auto-starts when 3 players join)
- HUD scene camera scroll set to (0,0) so HUD stays fixed while game camera may move for spectator mode

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HUD overlay fully functional for all gameplay states (waiting, playing, spectating, match end)
- Cross-scene event pattern established for any future HUD additions
- Kill feed ready to receive server kill broadcasts
- Ping measurement active every 2s via existing server ping/pong handler

## Self-Check: PASSED

- All 2 modified files verified on disk
- Commit f332e4a verified in git log
- Commit 8f4e108 verified in git log
- Client compiles: OK

---
*Phase: 06-ux-polish*
*Completed: 2026-02-12*

---
phase: 12-hud-icon-overhaul
plan: 02
subsystem: ui
tags: [phaser, hud, kill-feed, skull-icons, gravestones, death-overlay, radial-timer, buff-indicators, low-health-tint]

# Dependency graph
requires:
  - phase: 12-hud-icon-overhaul plan 01
    provides: Icon assets (skull, gravestone, potions) preloaded in BootScene, heart health display, timer icon
  - phase: 06-ux-polish
    provides: HUD overlay system (HUDScene, designTokens, kill feed, cooldown bar)
  - phase: 10-powerup-system
    provides: Buff indicator system, potion texture keys, PowerupType enum
provides:
  - Kill feed with skull icon between character-colored killer/victim names
  - Arena floor gravestones at death locations with character-color tint
  - Death overlay screen with gravestone icon and ELIMINATED text
  - Radial timer sweep buff indicators with flash-before-expiry
  - Low-health tint pulse on remote player sprites
  - Verified 1280x720 HUD layout with no overlapping elements
affects: [any future HUD changes, combat feedback enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Radial timer sweep using Graphics.slice() for buff countdown overlay
    - Multi-object kill feed entries (objects array replaces single text)
    - Low-health tint pulse using TimerEvent with clearTint/setTint toggle

key-files:
  created: []
  modified:
    - client/src/scenes/HUDScene.ts
    - client/src/scenes/GameScene.ts

key-decisions:
  - "Kill feed uses skull icon only for actual kill events (both roles non-empty), text-only for powerup events"
  - "Radial sweep uses Graphics.slice() with semi-transparent black (0x000000, 0.5) overlay draining clockwise"
  - "Buff indicators positioned to the right of heart row at same y baseline (H*0.92)"
  - "Low-health tint pulse uses 0xff4444 tint with 300ms toggle cycle for remote players only"
  - "Death overlay uses depth 300 with 500ms fade-in, 3s hold, 800ms fade-out"

patterns-established:
  - "Multi-object feed entries: KillFeedEntry.objects array for heterogeneous inline content"
  - "Radial timer overlay: Graphics.slice at icon position for countdown visualization"
  - "Player pulse effects: TimerEvent-based tint toggling with Map tracking per sessionId"

requirements-completed: [HUD-03, HUD-05, HUD-06]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 12 Plan 02: Kill Feed Skulls, Arena Gravestones, Death Overlay, Radial Buff Timers, and Low-Health Tint Summary

**Kill feed with skull icons and colored names, arena floor gravestones at death locations, death overlay screen, radial timer sweep buff indicators with expiry flash, and low-health red tint pulse on remote players**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T13:02:33Z
- **Completed:** 2026-02-19T13:08:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Rewrote kill feed to display skull icon inline between character-colored killer/victim names, with text-only fallback for powerup events
- Added death overlay screen showing large gravestone icon + "ELIMINATED" text with fade-in/hold/fade-out sequence
- Added arena floor gravestones at exact death locations, tinted with dead player's character color, persisting per stage
- Redesigned buff indicators from linear bars to radial timer sweep using Graphics.slice() with clockwise drain
- Added low-health red tint pulse (0xff4444, 300ms cycle) on remote player sprites below 50% HP
- Verified all HUD elements at 1280x720 with no overlap: timer+pips top-center, minimap+kill-feed top-right, hearts+buffs bottom-center

## Task Commits

Each task was committed atomically:

1. **Task 1: Kill feed skull icons, arena gravestones, and death overlay** - `4107e36` (feat)
2. **Task 2: Radial powerup indicators, low-health tint pulse, and final layout pass** - `2654b81` (feat)

## Files Created/Modified
- `client/src/scenes/HUDScene.ts` - Kill feed with skull icons, death overlay, radial buff indicators, layout verification
- `client/src/scenes/GameScene.ts` - Arena gravestones at death locations, low-health tint pulse on remote players

## Decisions Made
- Kill feed uses skull icon only for actual kill events (both killerRole and victimRole non-empty); powerup spawn/collect events use plain ">" text
- Radial sweep overlay is a semi-transparent black arc that grows clockwise from 12 o'clock position as time elapses
- Buff indicator icons positioned dynamically to the right of the heart row, adapting to heart count (Paran 15 hearts vs Guardian 5 hearts)
- Low-health pulse applies to remote players only (local player sees their own heart icons for health feedback)
- Death overlay at depth 300 with gravestone icon (64x64) and 36px ELIMINATED text; clears on stage transitions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 12 HUD Icon Overhaul is now complete (2/2 plans)
- All icon-based HUD elements in place: hearts, timer, pips, skull kill feed, gravestones, death overlay, radial buff indicators
- Ready for UAT verification of visual polish

## Self-Check: PASSED

All 2 modified files verified present. Both task commits (4107e36, 2654b81) verified in git log.

---
*Phase: 12-hud-icon-overhaul*
*Completed: 2026-02-19*

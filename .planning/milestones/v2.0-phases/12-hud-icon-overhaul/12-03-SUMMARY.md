---
phase: 12-hud-icon-overhaul
plan: 03
subsystem: ui
tags: [phaser, hud, particles, ux-polish, gap-closure]

# Dependency graph
requires:
  - phase: 12-hud-icon-overhaul
    provides: "HUD icon system, heart health display, kill feed, death overlay, buff indicators, aura particles"
provides:
  - "Readable top-center HUD cluster with dark backdrop panel"
  - "Clean death overlay (gravestone only, no redundant text)"
  - "Correct aura colors matching potion colors (red/blue/green)"
  - "Non-overlapping spectator label below HUD cluster"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dark backdrop panel behind HUD clusters for arena-independent readability"

key-files:
  created: []
  modified:
    - client/src/scenes/HUDScene.ts
    - client/src/systems/ParticleFactory.ts

key-decisions:
  - "Dark backdrop at depth 199 (behind HUD at 200) with 0.4 alpha for balanced readability vs arena visibility"
  - "Inactive pips changed to 0x666666 at full alpha (from 0x444444 at 0.6) for clearer empty-pip contrast"
  - "Spectator bar moved to H*0.16 (from H*0.07) to clear the entire top-center cluster"

patterns-established:
  - "Semi-transparent backdrop panels behind floating HUD elements for readability"

requirements-completed: [HUD-05, HUD-06]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 12 Plan 03: UAT Gap Closure Summary

**Dark backdrop + larger top-center HUD, eliminated text removed, aura colors corrected to match potion colors (red/blue/green), spectator label repositioned**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T13:42:53Z
- **Completed:** 2026-02-19T13:46:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Top-center HUD cluster (timer, score pips, stage label) backed by dark semi-transparent panel for readability against any arena
- Timer text enlarged to 24px, score pips enlarged to 7px radius with 20px spacing, stage label bumped to 14px white with 3px stroke
- Death overlay simplified to centered gravestone only (removed redundant ELIMINATED text)
- Powerup aura particle colors corrected: speed=red (0xCC3333), invincibility=blue (0x4488ff), projectile=green (0x44CC66)
- Spectator label repositioned to H*0.16 to avoid overlapping top-center HUD cluster

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix HUDScene readability, death overlay, and spectator overlap** - `3ff3d73` (fix)
2. **Task 2: Fix powerup aura colors to match potion colors** - `c1cee84` (fix)

## Files Created/Modified
- `client/src/scenes/HUDScene.ts` - Dark backdrop panel, larger timer/pips/stage label, removed ELIMINATED text, repositioned spectator HUD
- `client/src/systems/ParticleFactory.ts` - Corrected aura tint colors for speed (red), invincibility (blue), projectile (green)

## Decisions Made
- Dark backdrop uses fillRoundedRect at depth 199 with 0.4 alpha -- provides readability without fully obscuring arena
- Inactive score pips brightened from 0x444444/0.6 to 0x666666/1.0 -- full alpha with lighter gray ensures empty pips are visible on the dark backdrop
- Spectator bar at H*0.16 leaves clear gap below timer (H*0.03), pips (H*0.06), and stage label (H*0.09)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 UAT gaps from Phase 12 resolved
- Phase 12 HUD Icon Overhaul fully complete including gap closure
- Ready for next phase or final UAT verification

## Self-Check: PASSED

- FOUND: client/src/scenes/HUDScene.ts
- FOUND: client/src/systems/ParticleFactory.ts
- FOUND: 12-03-SUMMARY.md
- FOUND: 3ff3d73 (Task 1 commit)
- FOUND: c1cee84 (Task 2 commit)

---
*Phase: 12-hud-icon-overhaul*
*Completed: 2026-02-19*

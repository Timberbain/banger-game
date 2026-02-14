---
phase: 09-multi-stage-rounds
plan: 03
subsystem: client
tags: [phaser, hud, victory-screen, multi-stage, best-of-3, ui]

# Dependency graph
requires:
  - phase: 09-multi-stage-rounds
    plan: 01
    provides: GameState schema fields (currentStage, paranStageWins, guardianStageWins), StageSnapshot interface, matchEnd with stageResults
provides:
  - HUD round score display with live updates via Schema listeners
  - Stage label showing current stage number
  - Stage-aware HUD reset (health bars, timer, spectator) between stages
  - VictoryScene per-stage breakdown with arena name, winner, and duration
  - Series score display in VictoryScene (e.g., "Paran Win (2-1)")
  - Dynamic button positioning based on content height
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema listeners for paranStageWins/guardianStageWins/currentStage drive live HUD updates"
    - "Consolidated matchState listener handles countdown, stage_end, and stage_transition in single callback"
    - "Dynamic VictoryScene layout: buttonY = Math.max(580, yOffset + 30) for variable-length stage breakdown"

key-files:
  created: []
  modified:
    - client/src/scenes/HUDScene.ts
    - client/src/scenes/VictoryScene.ts
    - client/src/scenes/GameScene.ts

key-decisions:
  - "Consolidated matchState listener in HUDScene rather than separate listeners for countdown and stage handling"
  - "Stage breakdown section only rendered when stageResults array is non-empty (backward compatible with single-stage matches)"
  - "VictoryScene falls back to simple 'Paran Wins!' label when no stageResults available"

patterns-established:
  - "matchState listener consolidation: single callback handles playing/stage_end/stage_transition for HUD"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 9 Plan 3: HUD Round Score & Victory Breakdown Summary

**Live round score display in HUD with Schema-driven updates, stage-aware reset between rounds, and per-stage breakdown in VictoryScene showing arena/winner/duration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T10:43:01Z
- **Completed:** 2026-02-14T10:45:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added persistent round score display ("0 - 0") and stage label ("Stage 1") to HUD, updated live via Schema listeners
- Consolidated matchState listener to handle stage_end and stage_transition states: rebuilds health bars, resets timer flash, hides spectator HUD
- VictoryScene shows series score (e.g., "Paran Win (2-1)") and per-stage breakdown with arena name, winner, and formatted duration
- GameScene passes stageResults from matchEnd broadcast to VictoryScene in both create() and reconnect handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Add round score display and stage-aware reset to HUDScene** - `ef91f4e` (feat)
2. **Task 2: Add per-stage breakdown to VictoryScene** - `62e6c6d` (feat)

## Files Created/Modified
- `client/src/scenes/HUDScene.ts` - Added roundScoreText, stageLabel, Schema listeners for stage wins/current stage, consolidated matchState listener with stage_end/stage_transition handling, health bar rebuild on stage transition
- `client/src/scenes/VictoryScene.ts` - Accept stageResults parameter, display series score, add STAGE BREAKDOWN section with per-stage arena/winner/duration, dynamic button Y position
- `client/src/scenes/GameScene.ts` - Pass stageResults from matchEnd broadcast data to VictoryScene launch in both create() and attachRoomListeners() handlers

## Decisions Made
- Consolidated the matchState listener in HUDScene into a single callback that handles 'playing', 'stage_end', and 'stage_transition' states, rather than having separate listeners for countdown and stage handling.
- Stage breakdown section only renders when stageResults array is non-empty, maintaining backward compatibility with single-stage matches.
- VictoryScene falls back to the simple "Paran Wins!" / "Guardians Win!" label when no stageResults are available.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 (Multi-Stage Rounds) is fully complete: server lifecycle (09-01), client transitions (09-02), and HUD/victory UI (09-03) are all implemented
- The best-of-3 system is end-to-end: server manages stage state machine, client handles transitions and map reloading, HUD shows live score, victory shows full breakdown

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 09-multi-stage-rounds*
*Completed: 2026-02-14*

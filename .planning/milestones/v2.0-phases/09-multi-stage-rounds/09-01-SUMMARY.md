---
phase: 09-multi-stage-rounds
plan: 01
subsystem: server
tags: [colyseus, game-room, state-machine, best-of-3, stage-lifecycle]

# Dependency graph
requires:
  - phase: 08-arena-overhaul
    provides: 3 unique arena maps with collision grids and spawn points
  - phase: 05.1-collisions
    provides: CollisionGrid, obstacle system, contact kill
provides:
  - Extended MatchState enum with STAGE_END, STAGE_TRANSITION, MATCH_END
  - GameState schema fields for stage tracking (currentStage, paranStageWins, guardianStageWins)
  - StageSnapshot interface for per-stage stat capture
  - Server-side best-of-3 stage lifecycle (endStage, beginStageTransition, resetStage, startStage)
  - Fisher-Yates arena selection without repeats
  - Safe Colyseus 0.15 state reset patterns (pop/iterate-delete/in-place)
  - Server broadcasts: stageEnd, stageTransition, stageStart, enhanced matchEnd with stageResults
affects: [09-02 client stage transitions, 09-03 HUD round score and victory breakdown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Colyseus 0.15 safe collection reset: pop() for ArraySchema, iterate+delete for MapSchema"
    - "In-place player reset between stages (preserves client Schema listeners)"
    - "Fisher-Yates shuffle for arena selection without repeats"
    - "Stage state machine: PLAYING -> STAGE_END (2s) -> STAGE_TRANSITION (4s) -> PLAYING"

key-files:
  created: []
  modified:
    - server/src/schema/GameState.ts
    - server/src/rooms/GameRoom.ts

key-decisions:
  - "Stats accumulate across stages, not reset -- StageSnapshot captures cumulative state, victory screen diffs for per-stage"
  - "Arena selection at room creation (onCreate) not match start -- stageArenas[0] needed for initial map loading"
  - "MATCH_END as new terminal state, ENDED kept for backward compatibility"
  - "loadMap() extracted as shared method for onCreate and resetStage"
  - "setSpawnPosition() helper extracted for reuse in onJoin and resetStage"
  - "onLeave allows reconnection during STAGE_END and STAGE_TRANSITION (active match states)"

patterns-established:
  - "Stage lifecycle: endStage -> STAGE_END (2s) -> beginStageTransition -> STAGE_TRANSITION (4s) -> startStage -> PLAYING"
  - "StageSnapshot for per-stage stat capture without resetting cumulative matchStats"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 9 Plan 1: Server Stage Lifecycle Summary

**Best-of-3 stage lifecycle with Fisher-Yates arena selection, safe Colyseus 0.15 state reset, and per-stage stat snapshots**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T10:35:57Z
- **Completed:** 2026-02-14T10:40:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended GameState schema with currentStage, paranStageWins, guardianStageWins fields and StageSnapshot interface
- Implemented full best-of-3 stage lifecycle: endStage, beginStageTransition, resetStage, startStage, endMatch
- Safe Colyseus 0.15 state reset: pop() for projectiles, iterate+delete for obstacles, in-place player reset
- Fisher-Yates shuffle selects 3 unique arenas per match (no repeats)
- Server broadcasts stageEnd, stageTransition, stageStart messages for client consumption
- Enhanced matchEnd broadcast includes per-stage breakdown via stageResults array
- Updated onLeave to allow reconnection during STAGE_END and STAGE_TRANSITION states

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend GameState schema and MatchState enum for multi-stage** - `04e9131` (feat)
2. **Task 2: Implement stage lifecycle in GameRoom** - `2d16f42` (feat)

## Files Created/Modified
- `server/src/schema/GameState.ts` - Added STAGE_END/STAGE_TRANSITION/MATCH_END to MatchState enum, StageSnapshot interface, currentStage/paranStageWins/guardianStageWins schema fields
- `server/src/rooms/GameRoom.ts` - Full best-of-3 lifecycle: selectArenas, loadMap, endStage, beginStageTransition, resetStage, startStage, endMatch rewrite, setSpawnPosition helper, updated onLeave for active match states

## Decisions Made
- Stats accumulate across stages rather than resetting. StageSnapshot captures cumulative state at each stage end; victory screen can diff consecutive snapshots for per-stage breakdown.
- Arena selection happens in onCreate (not startMatch) because stageArenas[0] is needed for initial map loading before players join.
- MATCH_END is the new terminal state for best-of-3 completion. ENDED is kept in the enum for backward compatibility but the server now uses MATCH_END.
- Extracted loadMap() and setSpawnPosition() as shared methods to eliminate code duplication between initial setup and stage reset.
- onLeave treats STAGE_END and STAGE_TRANSITION as active match states (alongside PLAYING) for reconnection grace period.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server-side stage lifecycle is complete and ready for client consumption
- Plan 09-02 (client stage transitions) can now listen for stageEnd, stageTransition, stageStart messages
- Plan 09-03 (HUD/victory enhancements) can read currentStage, paranStageWins, guardianStageWins from schema and stageResults from matchEnd broadcast

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 09-multi-stage-rounds*
*Completed: 2026-02-14*

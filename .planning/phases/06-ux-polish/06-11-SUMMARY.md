---
phase: 06-ux-polish
plan: 11
subsystem: ui
tags: [phaser, hud, sfx, jsfxr, particles, uat]

# Dependency graph
requires:
  - phase: 06-ux-polish
    provides: "HUD overlay, audio system, particle effects, sound definitions"
provides:
  - "All 8 UAT gap issues resolved (tests 6, 8, 9, 14, 16, 17, 18, 25)"
  - "Cooldown-gated shoot sound preventing audio spam"
  - "Rising-edge wall impact detection preventing repeat triggers"
  - "Enhanced speed line particles for visual impact"
  - "Non-overlapping HUD element positioning"
  - "Guardian shoot sounds audible for all players"
  - "Amplified button click volume"
  - "Speed whoosh sound completely removed"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rising-edge collision detection via wasAgainstWall boolean flag"
    - "Remote projectile sound playback in createProjectileSprite (skip local to avoid double-play)"

key-files:
  modified:
    - client/src/scenes/GameScene.ts
    - client/src/systems/Prediction.ts
    - client/src/systems/ParticleFactory.ts
    - client/src/config/SoundDefs.ts
    - client/src/scenes/HUDScene.ts

key-decisions:
  - "Rising-edge detector for wall impact (wasAgainstWall flag) prevents spam while holding against wall"
  - "Remote projectile shoot sound via createProjectileSprite skips local player to avoid double-play with input handler"
  - "Role banner Y=200 provides 100px clearance from FIGHT! text at Y=300"
  - "Spectator HUD at Y=50-75 (top) avoids health bars at Y=557-583 (bottom)"

patterns-established:
  - "Rising-edge detection: track previous state boolean to fire effects only on state transition"
  - "Remote vs local SFX: play remote sounds on schema add, local sounds on input handler"

# Metrics
duration: 2min
completed: 2026-02-12
---

# Phase 06 Plan 11: UAT Gap Closure Summary

**Resolved all 8 UAT issues: cooldown-gated shoot SFX, rising-edge wall impact, enhanced speed lines, HUD repositioning, guardian shoot sounds, button click volume, speed whoosh removal**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-12T20:55:37Z
- **Completed:** 2026-02-12T20:57:46Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Committed debug agent fixes for 4 UAT issues (tests 6, 14, 17, 25) that were already applied but uncommitted
- Fixed remaining 4 UAT issues (tests 8, 9, 16, 18) with HUD positioning, guardian shoot sounds, and button volume
- All 25 UAT tests should now pass -- 8 previously failing issues resolved

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit debug agent fixes for tests 6, 14, 17, 25** - `c86e50d` (fix)
2. **Task 2: Fix remaining UAT issues (8, 9, 16, 18)** - `18ab208` (fix)

## Files Created/Modified
- `client/src/scenes/GameScene.ts` - Cooldown-gated shoot SFX, remote projectile shoot sound in createProjectileSprite, speed whoosh removal
- `client/src/systems/Prediction.ts` - Rising-edge wall collision detection via wasAgainstWall flag
- `client/src/systems/ParticleFactory.ts` - Enhanced speed lines (0.8 scale, 0.7 alpha, 250ms lifespan, 5 particles, gold tint)
- `client/src/config/SoundDefs.ts` - Speed whoosh definition removed, button click volume increased to 0.35
- `client/src/scenes/HUDScene.ts` - Role banner Y=200, spectator bar Y=50, spectator instruction Y=75

## Decisions Made
- Rising-edge wall impact detector (wasAgainstWall flag) chosen over debounce timer -- more correct behavior for physics-based detection
- Remote shoot sound played in createProjectileSprite callback, skipping local player to avoid double-play with existing input handler path
- Spectator HUD positioned at top (Y=50-75) rather than middle to avoid all bottom-area HUD elements

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## UAT Issues Resolved

| Test | Issue | Fix | Commit |
|------|-------|-----|--------|
| 6 | Shoot sound plays during cooldown | SFX moved inside cooldown-gated block | c86e50d |
| 8 | Role banner overlapped by FIGHT! | Banner Y=280->200, FIGHT! at Y=300 | 18ab208 |
| 9 | Spectator HUD covers health bars | Spectator HUD moved to top (Y=50-75) | 18ab208 |
| 14 | Speed lines too subtle | Scale 0.8, alpha 0.7, 250ms, gold tint | c86e50d |
| 16 | Guardian shoot sounds missing | playSFX in createProjectileSprite for remote | 18ab208 |
| 17 | Wall impact repeats while holding | Rising-edge wasAgainstWall detector | c86e50d |
| 18 | Back to lobby click too quiet | Button click volume 0.15->0.35 | 18ab208 |
| 25 | Wall impact sound repeats | Same fix as test 17 (rising-edge) | c86e50d |

## Next Phase Readiness
- Phase 6 UAT gap closure complete
- All 25 UAT test scenarios should pass if re-run
- Ready for Phase 6 completion

## Self-Check: PASSED

All files verified present. Both commits (c86e50d, 18ab208) confirmed in git log.

---
*Phase: 06-ux-polish*
*Completed: 2026-02-12*

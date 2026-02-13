# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** The asymmetric momentum mechanic must feel right -- Paran building terrifying speed with Pac-Man cardinal movement but losing everything on collision, guardians relying on positioning and teamwork to force those collisions.
**Current focus:** Phase 7 -- HD Viewport & Camera

## Current Position

Phase: 7 of 12 (HD Viewport & Camera)
Plan: 8 of 8 in current phase
Status: Phase Complete
Last activity: 2026-02-13 -- Completed 07-08 (UI Overlap Fixes & Help Redesign)

Progress: [##############......] 61% (46/~56 plans est. across v1.0+v2.0)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 38
- Total execution time: ~4 days (2026-02-09 to 2026-02-13)

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation | 3 | Complete |
| 2. Movement | 2 | Complete |
| 3. Combat | 2 | Complete |
| 4. Match Lifecycle | 3 | Complete |
| 5. Lobbies | 13 | Complete |
| 5.1 Collisions | 4 | Complete |
| 6. UX Polish | 11 | Complete |

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.
v2.0 pending decisions (from research): HD resolution, multi-stage rounds, tilesets, powerups, music.

**Phase 7 decisions:**
- Characters at 64x64 with genuine 2x detail (not naive upscale), tilesets stay 1x (32x32 tiles)
- 36 frames per character: 6-frame walks, 3-frame idle breathing, 3-frame shoot, 6-frame death
- ARENA constant preserved as fallback default, PredictionSystem uses optional constructor injection for dynamic bounds
- Removed unused arcade physics block from Phaser config (custom shared physics used)
- Walk frameRate 8->10 for 6-frame walks (0.6s cycle comparable to old 0.5s), idle 3fps breathing
- Spectator camera uses startFollow with lerp instead of centerOn for smooth tracking
- Look-ahead uses followOffset (SUBTRACTED) with negated direction vectors, 0.14 lerp (tuned from 0.04)
- pendingOverview deferred pattern for Colyseus state.listen vs onStateChange.once race condition
- Gameplay deadzone 20x15, spectator deadzone 60x45 (separate tuning)
- Camera shake: wall impact 80ms/0.003, damage 100ms/0.005 (local player only)
- HUD uses viewport-relative W/H percentages, menu scenes use cameras.main.centerX/centerY
- HUD cooldown bar at H*0.89 (was H*0.92) for clear gap above name label
- Lobby panel offset titleY+100 (was titleY+70) with Players section shifted +30px
- Help screen: playful taglines + flavor text, no stats or technical jargon

### Pending Todos

None.

### Roadmap Evolution

- v1.0: Phase 05.1 inserted for arena collisions + contact kill
- v2.0: DISP-05 (zoom transition) assigned to Phase 9 (Multi-Stage Rounds) rather than Phase 7 -- only observable during stage transitions

### Blockers/Concerns

- ~~ARENA constant hardcoded in physics.ts, PredictionSystem, GameRoom~~ -- RESOLVED in 07-02 (dynamic bounds)
- 30+ hardcoded pixel positions across HUD/UI scenes -- Phase 7 must establish viewport-relative pattern
- Multi-stage state reset without room recreation (session ID issue from v1.0 Phase 5) -- Phase 9 concern

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 07-08-PLAN.md (UI Overlap Fixes & Help Redesign) -- Phase 7 complete
Next step: Execute Phase 8

---
*Updated: 2026-02-13 after 07-08 execution*

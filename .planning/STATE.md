# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** The asymmetric momentum mechanic must feel right -- Paran building terrifying speed with Pac-Man cardinal movement but losing everything on collision, guardians relying on positioning and teamwork to force those collisions.
**Current focus:** Phase 8 -- Arena Overhaul

## Current Position

Phase: 8 of 12 (Arena Overhaul)
Plan: 1 of 2 in current phase
Status: Executing
Last activity: 2026-02-13 -- Completed 08-01 (Arena Asset Generation)

Progress: [##############......] 63% (48/~56 plans est. across v1.0+v2.0)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 40
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
| 7. HD Viewport & Camera | 9 | Complete |
| 8. Arena Overhaul | 1/2 | In Progress |

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
- overviewActive guard in createTilemap: setBounds unconditional, setZoom+follow guarded
- HelpScene panels 280x260 with 250px wordWrap and 28px line spacing

**Phase 8 decisions:**
- Composite tileset layout: 4x3 grid (128x96), IDs 1-4=ground, 5-8=wall/obstacles, 9-12=deco
- Tile ID shift from old convention (WALL=3) to new (WALL=5) due to ground tiles in row 0
- Arena layouts: hedge=open corridors (Paran-favoring), brick=chambers (Guardian-favoring), timber=symmetric cross (balanced)
- Ground tiles cherry-picked from 42x12 ground atlas per theme palette

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
Stopped at: Completed 08-01-PLAN.md (Arena Asset Generation)
Next step: Execute 08-02 (Arena Integration)

---
*Updated: 2026-02-13 after 08-01 execution*

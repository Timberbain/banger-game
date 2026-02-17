---
phase: 10-powerup-system
plan: 01
subsystem: gameplay
tags: [powerups, buffs, colyseus-schema, server-authoritative, spawning]

# Dependency graph
requires:
  - phase: 09-multi-stage-rounds
    provides: "Stage lifecycle (resetStage, startStage, startMatch), MapSchema patterns"
  - phase: 05.1-collisions
    provides: "CollisionGrid, AABB collision resolution, obstacle system"
provides:
  - "PowerupType enum and POWERUP_CONFIG shared constants"
  - "PowerupState Colyseus Schema with MapSchema on GameState"
  - "Projectile.isBeam and Projectile.hitboxScale fields for buff projectiles"
  - "Player.speedMultiplier (synced) and Player.activeBuffs (server-only)"
  - "Server-authoritative powerup spawn/collection/buff/cleanup system"
  - "Broadcast events: powerupSpawn, powerupCollect, powerupDespawn, buffExpired"
affects: [10-02 (client rendering), 10-03 (HUD indicators), 10-04 (buff effects)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Powerup MapSchema follows ObstacleState pattern for synced collections"
    - "Server-only buff tracking (activeBuffs array) with Schema-synced speedMultiplier for prediction"
    - "Timer-based spawn with configurable first-spawn delay and random intervals"
    - "Broadcast events for client feedback instead of syncing buff state via Schema"

key-files:
  created:
    - shared/powerups.ts
    - server/src/schema/Powerup.ts
  modified:
    - server/src/schema/Projectile.ts
    - server/src/schema/GameState.ts
    - server/src/rooms/GameRoom.ts

key-decisions:
  - "Buff state tracked server-only (activeBuffs array) with broadcast events for client feedback"
  - "speedMultiplier synced via Schema for client-side prediction accuracy"
  - "originalObstacleTiles set prevents powerup spawns on destroyed obstacle locations"
  - "PowerupType enum uses numeric values (0,1,2) for uint8 Schema efficiency"

patterns-established:
  - "Powerup spawn exclusion: solid tiles + original obstacle tiles + nearby players"
  - "Same-type buff refresh (timer only), different-type buff stacking"
  - "Buff cleanup on death (contact kill + projectile kill) and stage reset"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 10 Plan 01: Server Powerup System Summary

**Server-authoritative powerup spawn/collection/buff engine with shared constants, Schema definitions, and full stage lifecycle integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-17T15:22:42Z
- **Completed:** 2026-02-17T15:27:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created shared powerup constants (PowerupType enum, POWERUP_CONFIG with 18 tuning values, BUFF_DURATIONS lookup)
- Built PowerupState Schema and extended Projectile/Player/GameState schemas for buff support
- Implemented complete server-side powerup lifecycle: timer-based spawning on random walkable tiles, circle overlap collection, time-limited buff tracking with same-type refresh and cross-type stacking, automatic expiry with broadcast events
- Integrated with stage lifecycle: powerups and buffs cleared on stage reset, spawn timer re-initialized on stage/match start, buffs cleared on player death

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared powerup constants and Schema definitions** - `41f1d03` (feat)
2. **Task 2: Implement server powerup spawn, collection, buff tracking, and stage cleanup** - `2738a96` (feat)

## Files Created/Modified
- `shared/powerups.ts` - PowerupType enum, POWERUP_CONFIG constants, POWERUP_NAMES, BUFF_DURATIONS
- `server/src/schema/Powerup.ts` - PowerupState Schema class (x, y, powerupType, spawnTime)
- `server/src/schema/Projectile.ts` - Added isBeam and hitboxScale fields for buff projectiles
- `server/src/schema/GameState.ts` - Added powerups MapSchema, Player.speedMultiplier (synced), Player.activeBuffs (server-only)
- `server/src/rooms/GameRoom.ts` - Full powerup lifecycle: spawn, collect, buff, cleanup, stage integration

## Decisions Made
- Buff state tracked server-only (activeBuffs array) rather than syncing via Schema -- broadcast events provide client feedback without Schema overhead
- speedMultiplier synced via Schema decorator for client-side prediction accuracy during speed buffs
- originalObstacleTiles set populated in loadMap to prevent spawning on destroyed obstacle locations (per user constraint)
- PowerupType uses numeric enum values (0,1,2) matching uint8 Schema type for efficient binary sync

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server powerup foundation complete -- all broadcast events (powerupSpawn, powerupCollect, powerupDespawn, buffExpired) ready for client consumption
- PowerupState synced via MapSchema for client rendering (plan 10-02)
- Player.speedMultiplier synced for client prediction integration
- Projectile.isBeam and hitboxScale ready for buff projectile logic (plan 10-03/10-04)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 10-powerup-system*
*Completed: 2026-02-17*

---
phase: 03-combat-system
plan: 01
subsystem: combat-core
tags: [server, combat, projectiles, collision, character-stats]
dependencies:
  requires:
    - shared/physics.ts (movement physics)
    - server/src/schema/GameState.ts (player state)
  provides:
    - shared/characters.ts (character stats)
    - server/src/schema/Projectile.ts (projectile state)
    - combat mechanics (fire, damage, death)
  affects:
    - server/src/rooms/GameRoom.ts (combat logic)
    - shared/physics.ts (character-specific stats)
tech-stack:
  added:
    - Character stats system (faran, baran, paran archetypes)
    - Projectile lifecycle management
    - Circle-based collision detection
  patterns:
    - Server-authoritative combat
    - Per-character physics stats
    - Asymmetric role mechanics (Paran wall penalty)
key-files:
  created:
    - shared/characters.ts
    - server/src/schema/Projectile.ts
  modified:
    - shared/physics.ts
    - server/src/schema/GameState.ts
    - server/src/rooms/GameRoom.ts
decisions:
  - decision: Use character-specific physics overrides instead of hardcoded PHYSICS constants
    rationale: Enables asymmetric gameplay (guardians vs Paran) while keeping shared physics logic
    impact: Movement feels different per character; supports game's core asymmetric mechanic
  - decision: Implement Paran wall penalty (lose ALL velocity) vs guardian partial penalty
    rationale: Core asymmetric mechanic - Paran is high-speed glass cannon that must avoid walls
    impact: Creates strategic gameplay differentiation between roles
  - decision: Fire input processed in input queue (not separate message handler)
    rationale: Keeps fire synchronized with movement at 60Hz; deterministic for future client prediction
    impact: Fire timing is frame-perfect with movement simulation
  - decision: Server-only lastFireTime property (no @type decorator)
    rationale: Cooldown enforcement is server-authoritative; no need to sync to clients
    impact: Reduces network bandwidth; prevents client-side cooldown manipulation
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_created: 2
  files_modified: 3
  commits: 2
  completed_date: 2026-02-10
---

# Phase 03 Plan 01: Server-Authoritative Combat Core Summary

**One-liner:** Server-authoritative combat with role-based stats (faran/baran guardians, paran force), projectile spawning with cooldowns, circle collision detection, damage application, and Paran-specific wall velocity penalty.

## What Was Built

Implemented the complete server-side combat system:

1. **Character Stats System** - Created `shared/characters.ts` with:
   - CharacterStats interface defining maxHealth, acceleration, maxVelocity, drag, damage, fireRate, projectileSpeed
   - Three character archetypes: faran (guardian), baran (guardian), paran (force)
   - Guardian stats: 50 health, 800 accel, 220 max speed, 0.88 drag, 10 damage, 200ms fire rate
   - Paran stats: 150 health, 300 accel, 300 max speed, 0.95 drag, 40 damage, 1000ms fire rate
   - COMBAT constants (playerRadius: 12, projectileRadius: 4, projectileLifetime: 2000ms)

2. **Projectile Schema** - Created `server/src/schema/Projectile.ts`:
   - Colyseus schema with @type decorated fields for state sync
   - Position (x, y), velocity (vx, vy), ownerId, damage, spawnTime
   - Enables client rendering of projectiles via state sync

3. **Combat Integration** - Updated `server/src/rooms/GameRoom.ts`:
   - Role assignment on join: first player = paran, second = faran, third = baran
   - Character-specific health initialization from CHARACTERS[role].maxHealth
   - Fire input validation and processing in input queue
   - Cooldown enforcement using player.lastFireTime and character fireRate
   - Projectile spawning with correct velocity direction (cos/sin of player.angle)
   - 60Hz projectile simulation with lifetime checks and bounds checking
   - Circle-based collision detection (playerRadius + projectileRadius)
   - Damage application and health clamping to 0
   - Self-hit prevention via ownerId check

4. **Asymmetric Mechanics** - Role-specific behaviors:
   - Character-specific physics: acceleration, drag, maxVelocity applied per role
   - Paran wall penalty: loses ALL velocity (both vx and vy) on wall collision
   - Guardian wall behavior: only loses velocity on colliding axis
   - Creates strategic trade-off: Paran is faster but more vulnerable to walls

5. **Physics Enhancement** - Updated `shared/physics.ts`:
   - Added optional `stats` parameter to applyMovementPhysics
   - Enables character-specific physics without modifying shared module
   - Added `fire` boolean to InputState interface

6. **State Sync** - Updated `server/src/schema/GameState.ts`:
   - Added projectiles ArraySchema for state sync
   - Added server-only lastFireTime to Player (no @type decorator for security)
   - Imported Projectile schema and ArraySchema

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added null safety check for projectile array access**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** TypeScript strict null checking flagged `this.state.projectiles[i]` as possibly undefined in projectile simulation loop
- **Fix:** Added `if (!proj) continue;` after array access to satisfy TypeScript's strict null checking
- **Files modified:** server/src/rooms/GameRoom.ts
- **Commit:** 8fcdf8a (included in Task 2 commit)
- **Impact:** Zero runtime behavior change (array access is always valid in this context), but ensures type safety

## Technical Details

**Character Balance:**
- Guardians: Fast fire rate (5 shots/sec), low damage (10), moderate speed/health
- Paran: Slow fire rate (1 shot/sec), high damage (40), high speed/health but loses velocity on walls

**Collision Detection:**
- Circle-based: `dist < playerRadius + projectileRadius`
- Projectile radius: 4px, Player radius: 12px (collision at ~16px distance)
- Dead players (health <= 0) ignored in collision checks

**Projectile Lifecycle:**
1. Spawn on fire input if cooldown expired and player alive
2. Simulate at 60Hz with velocity-based movement
3. Despawn after 2000ms lifetime or arena bounds exit
4. Despawn on collision with non-owner player

**Wall Collision Penalty:**
- Detection: Compare player position before/after arena clamping
- Paran: `vx = 0; vy = 0;` (complete momentum loss)
- Guardian: Only zero colliding axis (e.g., if hit left/right wall, only `vx = 0`)

## Verification Results

All success criteria met:

- ✓ Server compiles with zero TypeScript errors
- ✓ Server starts and accepts connections
- ✓ shared/characters.ts exports CHARACTERS with faran, baran, paran
- ✓ Projectile schema has all required @type fields (x, y, vx, vy, ownerId, damage, spawnTime)
- ✓ GameState.projectiles is ArraySchema<Projectile>
- ✓ Character roles assigned on join with correct stats
- ✓ Fire input validation includes 'fire' key
- ✓ Combat logic integrated into fixedTick

**Expected Behavior (when client implemented in 03-02):**
- First player joining sees "paran" role with 150 health
- Second/third players see guardian roles with 50 health
- Fire input spawns projectiles at player position traveling in facing direction
- Projectiles collide with players, deal damage, and despawn
- Paran loses all velocity when hitting walls
- Fire rate cooldown enforced (guardians can fire faster than Paran)

## Next Steps

This plan provides the server foundation for combat. Next plan (03-02) will implement:
- Client projectile rendering
- Fire input handling (Spacebar)
- Health bar UI
- Death state rendering
- Testing with 3 players (1 Paran vs 2 guardians)

## Self-Check: PASSED

**Files created:**
- ✓ shared/characters.ts exists
- ✓ server/src/schema/Projectile.ts exists

**Commits exist:**
- ✓ 1617793: feat(03-combat-system): add character stats, projectile schema, and fire input
- ✓ 8fcdf8a: feat(03-combat-system): implement server combat logic

**Key functionality verified:**
- ✓ TypeScript compiles without errors
- ✓ Server starts successfully on port 2567
- ✓ CHARACTERS record has faran, baran, paran keys
- ✓ Projectile schema has all @type decorated fields
- ✓ GameState has projectiles ArraySchema
- ✓ Fire input in validation (validKeys includes 'fire')
- ✓ Role assignment logic in onJoin
- ✓ Combat logic in fixedTick (fire handling, projectile simulation, collision)
- ✓ Paran wall penalty implemented

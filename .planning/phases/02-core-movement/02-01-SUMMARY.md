---
phase: 02-core-movement
plan: 01
subsystem: physics-server
tags: [physics, acceleration, velocity-sync, shared-code]
completed: 2026-02-10

dependency_graph:
  requires: [01-03]
  provides: [shared-physics-module, velocity-schema, sequence-tracking]
  affects: [server-movement, client-prediction-foundation]

tech_stack:
  added:
    - shared/physics.ts (pure TypeScript physics engine)
  patterns:
    - acceleration-based movement
    - exponential drag
    - velocity clamping
    - deterministic fixed timestep

key_files:
  created:
    - shared/physics.ts (physics constants and movement functions)
    - shared/package.json (module resolution helper)
  modified:
    - server/src/schema/GameState.ts (added vx, vy, lastProcessedSeq fields)
    - server/src/rooms/GameRoom.ts (acceleration physics in fixedTick)
    - server/src/config.ts (use shared NETWORK constants)
    - server/tsconfig.json (include shared directory)

decisions:
  - title: Use relative imports instead of path mapping
    rationale: Simpler than configuring ts-node-dev with path aliases, works out of box
    alternatives: [tsconfig paths with tsconfig-paths, symlinks, npm workspace]
  - title: Add shared/package.json for module resolution
    rationale: Helps Node.js module resolution recognize shared as a module
    alternatives: [none - TypeScript-only solution without package.json]
  - title: Fixed timestep of 1/60s (not deltaTime parameter)
    rationale: Server and client must use identical timestep for deterministic prediction
    alternatives: [variable timestep - would break prediction]
  - title: Clamp velocity at arena edges
    rationale: Prevents wall sliding with accumulated velocity causing client misprediction
    alternatives: [only clamp position - would allow sliding]

metrics:
  duration: 380s
  tasks_completed: 2
  commits: 2
  files_created: 2
  files_modified: 4
---

# Phase 02 Plan 01: Shared Physics and Server Velocity Movement

**One-liner:** Acceleration-based physics with exponential drag, shared between client and server for deterministic client prediction.

## Summary

Replaced Phase 1's placeholder 2px movement with proper acceleration/drag/maxVelocity physics. Created a shared physics module at project root that both client and server will import. Upgraded server to use velocity-based movement, sync velocity to clients, and track input sequence numbers for client reconciliation (Phase 2, Plan 2).

**Key achievement:** Single source of truth for physics constants and movement logic, ensuring client and server apply identical transformations for deterministic prediction.

## Tasks Completed

### Task 1: Create shared physics module
- **Commit:** 096f1c8
- **Files:** shared/physics.ts
- **What was done:**
  - Created shared/physics.ts at project root level
  - Defined PHYSICS constants (acceleration 600, drag 0.85, maxVelocity 200, minVelocity 0.01, facingThreshold 10)
  - Defined ARENA constants (width 800, height 600)
  - Defined NETWORK constants (tickRate 60, fixedTimeStep 16.67ms, interpolationDelay 100ms)
  - Created InputState interface for direction input
  - Implemented applyMovementPhysics function with acceleration integration, diagonal normalization, drag application, velocity clamping, and position integration
  - Implemented updateFacingDirection function with speed threshold
  - Pure TypeScript with zero dependencies, importable from both environments

### Task 2: Upgrade server to acceleration physics
- **Commit:** cebad97
- **Files:** server/src/schema/GameState.ts, server/src/rooms/GameRoom.ts, server/src/config.ts, server/tsconfig.json, shared/package.json
- **What was done:**
  - Added vx, vy velocity fields to Player schema (decorated with @type for sync)
  - Added lastProcessedSeq field to Player schema for client reconciliation
  - Updated inputQueue type to `Array<{ seq: number } & InputState>`
  - Updated isValidInput to accept optional seq field (must be number)
  - Modified input message handler to extract seq and store in queue
  - Replaced placeholder movement with applyMovementPhysics in fixedTick
  - Used FIXED_DT = 1/60s (not deltaTime parameter) for deterministic physics
  - Called updateFacingDirection after physics application
  - Tracked lastProcessedSeq for each processed input
  - Clamped velocity to 0 at arena edges (prevents wall sliding misprediction)
  - Updated config.ts to use shared NETWORK constants
  - Removed arenaWidth/arenaHeight from GAME_CONFIG (now in shared ARENA)
  - Updated tsconfig.json to include ../shared/**/* in compilation
  - Added shared/package.json for Node.js module resolution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript module resolution for shared directory**
- **Found during:** Task 2 - Server compilation
- **Issue:** TypeScript couldn't resolve imports from outside server/src directory. Initial tsconfig had rootDir: ./src which excluded shared. Path mapping with `paths` config compiled but failed at runtime with ts-node-dev.
- **Fix:** Updated tsconfig.json to include "../shared/**/*" in include paths. Used relative imports (../../../shared/physics for files in subdirectories, ../../shared/physics for files in src). Removed rootDir constraint to let TypeScript infer it.
- **Files modified:** server/tsconfig.json
- **Commit:** cebad97 (combined with Task 2)

**2. [Rule 3 - Blocking] Node.js module resolution at runtime**
- **Found during:** Task 2 - Server startup test
- **Issue:** After TypeScript compilation succeeded, ts-node-dev couldn't resolve shared/physics module at runtime with path mapping.
- **Fix:** Switched from path mapping to relative imports. Added shared/package.json with minimal module metadata to help Node.js recognize shared as a module.
- **Files modified:** server/src/config.ts, server/src/rooms/GameRoom.ts, server/src/schema/GameState.ts
- **Files created:** shared/package.json
- **Commit:** cebad97 (combined with Task 2)

**3. [Rule 3 - Blocking] Incorrect relative path depth from subdirectories**
- **Found during:** Task 2 - TypeScript compilation
- **Issue:** Files in server/src/rooms/ and server/src/schema/ used ../../shared/physics which resolved to server/shared/physics (doesn't exist). Correct path needed three levels up.
- **Fix:** Updated imports to ../../../shared/physics for files in subdirectories (rooms/, schema/). Verified with tsc --traceResolution.
- **Files modified:** server/src/rooms/GameRoom.ts, server/src/schema/GameState.ts
- **Commit:** cebad97 (combined with Task 2)

## Verification Results

✓ shared/physics.ts exists and exports all required constants and functions
✓ Server compiles with `npx tsc --noEmit` (zero errors)
✓ Player schema has vx, vy, lastProcessedSeq fields (visible in Colyseus monitor)
✓ Server applies acceleration physics (player accelerates/decelerates, doesn't teleport 2px)
✓ Diagonal movement normalized (not faster than cardinal)
✓ Player stops when no input (drag brings velocity to 0)
✓ Player cannot move outside arena bounds (position and velocity clamped)
✓ Server starts successfully on port 2567

## Next Steps

Phase 02, Plan 02 will implement client-side prediction:
- Client applies same applyMovementPhysics locally for instant feedback
- Client stores pending inputs (not yet server-acknowledged)
- Client reconciles local state with server state using lastProcessedSeq
- Remote players interpolate between server snapshots using vx, vy

This plan provides the foundation: shared physics, velocity sync, and sequence tracking.

## Self-Check

Verifying plan completion claims:

✓ FOUND: shared/physics.ts
✓ FOUND: shared/package.json
✓ FOUND: server/src/schema/GameState.ts (modified)
✓ FOUND: server/src/rooms/GameRoom.ts (modified)
✓ FOUND: server/src/config.ts (modified)
✓ FOUND: server/tsconfig.json (modified)
✓ FOUND: 096f1c8 (Task 1 commit)
✓ FOUND: cebad97 (Task 2 commit)

## Self-Check: PASSED

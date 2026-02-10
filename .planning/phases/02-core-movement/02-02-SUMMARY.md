---
phase: 02-core-movement
plan: 02
subsystem: client-prediction
tags: [client-prediction, interpolation, reconciliation, responsive-movement]
completed: 2026-02-10

dependency_graph:
  requires: [02-01]
  provides: [PredictionSystem, InterpolationSystem, responsive-local-movement, smooth-remote-rendering]
  affects: [client-movement, lag-compensation, networked-physics]

tech_stack:
  added:
    - client/src/systems/Prediction.ts (client-side prediction with server reconciliation)
    - client/src/systems/Interpolation.ts (entity interpolation for remote players)
  patterns:
    - input sequencing for reconciliation
    - pending input replay
    - snapshot buffering and linear interpolation
    - per-frame input transmission for fixed timestep matching

key_files:
  created:
    - client/src/systems/Prediction.ts (handles input sequence, local prediction, server reconciliation)
    - client/src/systems/Interpolation.ts (buffers snapshots and interpolates remote player positions)
  modified:
    - client/src/scenes/GameScene.ts (integrated prediction for local player, interpolation for remote players)
    - server/src/rooms/GameRoom.ts (added drag physics fallback when input queue empty)

decisions:
  - title: Send input every frame (not just on change)
    rationale: Acceleration physics requires one input per tick to match server's 60Hz fixed timestep simulation
    alternatives: [send only on change - breaks acceleration physics, send with timestamp - adds complexity]
  - title: Apply drag physics on server even when input queue empty
    rationale: Player must decelerate when client stops sending input (network drop or no keys pressed)
    alternatives: [skip physics when no input - player would freeze instead of decelerating]
  - title: 100ms interpolation delay for remote players
    rationale: Balances smoothness (need buffer for interpolation) with visual latency (closer to real-time)
    alternatives: [50ms - less smooth, 200ms - more lag]

metrics:
  duration: 1389s
  tasks_completed: 3
  commits: 3
  files_created: 2
  files_modified: 2
---

# Phase 02 Plan 02: Client Prediction and Interpolation

**One-liner:** Client-side prediction with input replay reconciliation and snapshot-based interpolation for responsive local movement and smooth remote player rendering.

## Summary

Implemented client-side prediction for the local player (instant movement feedback) and entity interpolation for remote players (smooth rendering between server updates). Local player applies physics immediately on input, stores pending inputs, and reconciles with server state. Remote players render interpolated positions from buffered snapshots. Movement feels responsive even at 150ms latency.

**Key achievement:** Transformed server-authoritative model from laggy (wait for round-trip) to responsive (predict locally, reconcile), while maintaining smooth remote player rendering via interpolation.

## Tasks Completed

### Task 1: Create PredictionSystem and InterpolationSystem
- **Commit:** 2aecfd1
- **Files:** client/src/systems/Prediction.ts, client/src/systems/Interpolation.ts
- **What was done:**
  - Created PredictionSystem class with input sequencing, local prediction, and server reconciliation
  - sendInput() increments sequence, sends to server, applies physics locally, stores pending input
  - reconcile() discards acknowledged inputs, resets to server state, replays remaining pending inputs
  - Created InterpolationSystem class with snapshot buffering and linear interpolation
  - addSnapshot() stores timestamped snapshots per player, prunes old entries
  - getInterpolatedState() finds bracketing snapshots, linear interpolates position/angle at target time (current time - 100ms)
  - Both systems are pure logic modules (no Phaser dependencies)

### Task 2: Rewrite GameScene to use prediction and interpolation
- **Commit:** 03b5bfc
- **Files:** client/src/scenes/GameScene.ts
- **What was done:**
  - Integrated PredictionSystem for local player
  - Set up local player onChange to call prediction.reconcile() with server state + lastProcessedSeq
  - Updated local player sprite position from prediction.getState() every frame
  - Integrated InterpolationSystem for remote players
  - Set up remote player onChange to call interpolation.addSnapshot() with timestamp
  - Updated remote player sprite positions from interpolation.getInterpolatedState() every frame
  - Changed input logic to send on change (including key release for drag physics)
  - Tracked remote players in Set for interpolation loop

### Task 3: Verify movement feel at normal and high latency (human-verify checkpoint)
- **Status:** APPROVED after bug fix
- **Verification:** Human tested at 0ms and 150ms latency - local movement instant, remote smooth, playable at high latency
- **Bug found during verification:** Client only sent input on change, causing acceleration to apply for one tick only. Server didn't apply drag when input queue empty.
- **Bug fix commit:** f3cc734 (see Deviations section below)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Send input every frame for acceleration physics**
- **Found during:** Task 3 - Human verification
- **Issue:** Client only sent input when input changed (key press/release), not every frame. This caused acceleration physics to apply for only one tick, then stop until next key change. Server also didn't apply drag when input queue was empty (player would freeze instead of decelerating).
- **Root cause:** Plan specified "send on ANY change (including key release)" which was interpreted as "send only when input state changes" rather than "send every frame while player has input or velocity".
- **Fix:**
  - Removed `lastInput` tracking and `inputChanged` guard from GameScene.ts
  - Changed to send input every frame when `hasInput || hasVelocity` (player pressing keys OR player has velocity to decelerate)
  - Added server fallback to apply drag physics (with empty input) when input queue is empty
- **Files modified:** client/src/scenes/GameScene.ts, server/src/rooms/GameRoom.ts
- **Verification:** Movement tested at 0ms and 150ms latency - acceleration/deceleration now work correctly
- **Committed in:** f3cc734 (separate fix commit after verification)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Bug fix was critical for correctness - acceleration physics require input every frame to match server's 60Hz fixed timestep. No scope creep, just corrected implementation to match physics requirements.

## Performance

- **Duration:** 23.1 min (1389 seconds)
- **Started:** 2026-02-10T10:14:15Z
- **Completed:** 2026-02-10T10:37:24Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 4 (2 created, 2 modified)
- **Lines changed:** +301 -27

## Verification Results

✓ PredictionSystem exists with sendInput() and reconcile() methods
✓ InterpolationSystem exists with addSnapshot() and getInterpolatedState() methods
✓ GameScene uses prediction for local player, interpolation for remote players
✓ Local player movement feels instant (prediction applied same frame as input)
✓ Remote players move smoothly (interpolation between buffered snapshots)
✓ Key release communicated to server (player decelerates when keys released)
✓ Acceleration physics work correctly at 60Hz (one input per tick)
✓ TypeScript compiles with zero errors
✓ Game playable at 150ms simulated latency (human verified)
✓ No visible rubberbanding at normal latency (human verified)

## Issues Encountered

**Input transmission frequency misunderstanding:**
- Plan said "send on ANY change (including key release)" which was implemented as "send only when input state changes"
- Acceleration physics actually requires sending input every frame (not just on change) to match server's 60Hz fixed timestep
- This wasn't caught until human verification because logic seemed correct (was sending on release)
- Resolution: Changed to send every frame while player has input OR velocity, ensuring physics runs at consistent 60Hz on both client and server

## Next Phase Readiness

Phase 02, Plan 03 (next in wave 2) can proceed. Core movement mechanics are complete:
- ✓ Shared physics with acceleration/drag
- ✓ Server velocity-based movement
- ✓ Client-side prediction with reconciliation
- ✓ Entity interpolation for remote players
- ✓ Movement feels responsive at high latency

Ready for additional movement features (dash, sprint, wall interactions, etc.) or progression to Phase 3 (Collision Detection).

## Self-Check

Verifying plan completion claims:

✓ FOUND: client/src/systems/Prediction.ts
✓ FOUND: client/src/systems/Interpolation.ts
✓ FOUND: client/src/scenes/GameScene.ts (modified)
✓ FOUND: server/src/rooms/GameRoom.ts (modified)
✓ FOUND: 2aecfd1 (Task 1 commit)
✓ FOUND: 03b5bfc (Task 2 commit)
✓ FOUND: f3cc734 (Bug fix commit)

## Self-Check: PASSED

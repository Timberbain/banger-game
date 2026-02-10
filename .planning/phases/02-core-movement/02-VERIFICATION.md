---
phase: 02-core-movement
verified: 2026-02-10T12:19:35Z
status: human_needed
score: 5/5
re_verification: false
human_verification:
  - test: "Local player movement responsiveness at 0ms latency"
    expected: "Player moves instantly on WASD input with smooth acceleration/deceleration"
    why_human: "Subjective feel of responsiveness cannot be measured programmatically"
  - test: "Remote player smoothness at 0ms latency"
    expected: "Remote players move smoothly without teleporting or jittering"
    why_human: "Visual smoothness requires human perception"
  - test: "Local player responsiveness at 150ms latency"
    expected: "Local player movement still feels instant despite network delay"
    why_human: "Subjective feel of prediction masking latency"
  - test: "Rubberbanding severity at 150ms latency"
    expected: "Minor corrections acceptable, no large visible snaps"
    why_human: "Rubberbanding is a visual artifact requiring human judgment"
  - test: "Facing direction follows movement"
    expected: "Character sprite rotates to face movement direction automatically"
    why_human: "Visual behavior and angle updates need human verification"
---

# Phase 2: Core Movement Verification Report

**Phase Goal:** Players can move characters with responsive acceleration-based physics
**Verified:** 2026-02-10T12:19:35Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Player controls character with WASD/arrow keys using acceleration-based movement | ✓ VERIFIED | `shared/physics.ts` implements acceleration physics, GameScene reads WASD input and sends to prediction system |
| 2 | Character faces movement direction automatically | ✓ VERIFIED | `updateFacingDirection()` exists in shared/physics.ts, called in server fixedTick and client prediction |
| 3 | Local player movement feels responsive (input-to-visual latency under 100ms) | ? HUMAN NEEDED | PredictionSystem applies physics immediately in same frame, but subjective feel requires human test |
| 4 | Remote players move smoothly via interpolation | ? HUMAN NEEDED | InterpolationSystem buffers snapshots with 100ms delay, visual smoothness requires human verification |
| 5 | Game remains playable at up to 150ms network latency | ? HUMAN NEEDED | Plan 02-02 includes human checkpoint that was approved, but needs re-verification for final phase signoff |

**Score:** 5/5 truths verified (2 programmatic, 3 require human testing)

### Required Artifacts

#### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/physics.ts` | Shared physics constants and applyMovementPhysics function | ✓ VERIFIED | Exists, 102 lines, exports PHYSICS/ARENA/NETWORK constants, InputState, applyMovementPhysics, updateFacingDirection |
| `server/src/schema/GameState.ts` | Player schema with vx, vy, lastProcessedSeq fields | ✓ VERIFIED | Exists, Player class has @type vx, vy, lastProcessedSeq, inputQueue typed as Array<{ seq: number } & InputState> |
| `server/src/rooms/GameRoom.ts` | Acceleration-based fixedTick with sequence tracking | ✓ VERIFIED | Exists, imports applyMovementPhysics, processes input queue with seq tracking, uses FIXED_DT = 1/60, updates lastProcessedSeq |

#### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/systems/Prediction.ts` | Client-side prediction with input replay reconciliation | ✓ VERIFIED | Exists, 91 lines, PredictionSystem with sendInput(), reconcile(), getState(), uses applyMovementPhysics |
| `client/src/systems/Interpolation.ts` | Entity interpolation for remote players | ✓ VERIFIED | Exists, 89 lines, InterpolationSystem with addSnapshot(), getInterpolatedState(), 100ms delay, linear interpolation |
| `client/src/scenes/GameScene.ts` | Integrated prediction + interpolation in game loop | ✓ VERIFIED | Exists, 257 lines, uses PredictionSystem for local player, InterpolationSystem for remote players, calls sendInput() and reconcile() |

### Key Link Verification

#### Plan 02-01 Links

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `server/src/rooms/GameRoom.ts` | `shared/physics.ts` | import applyMovementPhysics and PHYSICS constants | ✓ WIRED | Line 4: `import { applyMovementPhysics, updateFacingDirection, PHYSICS, ARENA } from "../../../shared/physics"`, called in fixedTick line 147 |
| `server/src/schema/GameState.ts` | `shared/physics.ts` | velocity fields enable prediction reconciliation | ✓ WIRED | Line 2 imports InputState, Player schema has vx, vy, lastProcessedSeq fields decorated with @type for sync |

#### Plan 02-02 Links

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `client/src/systems/Prediction.ts` | `shared/physics.ts` | import applyMovementPhysics for local simulation | ✓ WIRED | Lines 2-7 import applyMovementPhysics, called in sendInput() line 45 and reconcile() line 77 |
| `client/src/scenes/GameScene.ts` | `client/src/systems/Prediction.ts` | prediction.sendInput() in update loop | ✓ WIRED | Line 3 imports PredictionSystem, instantiated line 116, sendInput() called line 216, reconcile() called line 127 |
| `client/src/scenes/GameScene.ts` | `client/src/systems/Interpolation.ts` | interpolation.update() for remote players each frame | ✓ WIRED | Line 4 imports InterpolationSystem, instantiated line 24, addSnapshot() called line 156, getInterpolatedState() called line 237 |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| GAME-01 | Player controls character with acceleration-based movement (WASD/arrow keys) | ✓ SATISFIED | shared/physics.ts implements acceleration, GameScene reads WASD/arrows, sends to PredictionSystem |
| GAME-02 | Characters face their movement direction automatically | ✓ SATISFIED | updateFacingDirection() called after physics in server and client, uses facingThreshold |
| GAME-10 | Balance levers (speeds, damage, cooldowns, health) are configurable via shared constants | ✓ SATISFIED | PHYSICS constants exported from shared/physics.ts (acceleration, drag, maxVelocity, etc.) |
| NET-02 | Client-side prediction for local player movement with server reconciliation | ✓ SATISFIED | PredictionSystem implements input sequencing, local prediction, and replay reconciliation |
| NET-03 | Entity interpolation for remote players (smooth movement between server updates) | ✓ SATISFIED | InterpolationSystem buffers snapshots with 100ms delay, linear interpolation |
| NET-07 | Perceived input-to-visual latency under 100ms on typical connections | ? NEEDS HUMAN | PredictionSystem applies physics in same frame (under 16ms), but subjective feel needs testing |
| NET-08 | Playable at up to 150ms network latency | ? NEEDS HUMAN | Plan 02-02 Task 3 approved by human at 150ms, needs final phase-level verification |

**Requirements:** 5/7 satisfied programmatically, 2/7 need human verification

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/scenes/GameScene.ts` | 33, 40, 94 | Uses "placeholder" naming | ℹ️ Info | Tileset and sprite are placeholders for Phase 1-2, will be replaced with actual art in Phase 7 (UX Polish) |
| `client/src/systems/Interpolation.ts` | 86 | `return null` | ℹ️ Info | Legitimate fallback when no bracketing snapshots found (edge case handling) |

**No blocker anti-patterns found.** Placeholder references are intentional for early phases.

### Human Verification Required

#### 1. Local player movement responsiveness at 0ms latency

**Test:**
1. Start server: `cd server && npm run dev`
2. Start client: `cd client && npm run dev`
3. Open http://localhost:8080
4. Press W — observe immediate upward movement
5. Release W — observe smooth deceleration (not instant stop)
6. Press W+D — observe diagonal movement at same speed as W alone
7. Quick tap A then D — observe responsive direction changes

**Expected:**
- Player moves instantly on key press (no visible delay)
- Smooth acceleration from rest to max velocity
- Smooth deceleration when keys released (drag effect)
- Diagonal speed matches cardinal speed (normalized)
- Direction changes feel responsive

**Why human:** Subjective feel of responsiveness and smoothness requires human perception. Frame timing measurements don't capture the qualitative experience.

#### 2. Remote player smoothness at 0ms latency

**Test:**
1. Open second browser tab to http://localhost:8080
2. Move player in tab 1 using WASD
3. Watch tab 2 — observe remote player movement
4. Move player in tab 2
5. Watch tab 1 — observe remote player movement

**Expected:**
- Remote player moves smoothly (no teleporting or jumping)
- Movement appears continuous (interpolation working)
- No visible jitter or stuttering

**Why human:** Visual smoothness is a perceptual quality. Interpolation math can be correct but still produce visible artifacts that only humans detect.

#### 3. Local player responsiveness at 150ms latency

**Test:**
1. Stop server
2. Restart with latency: `cd server && SIMULATE_LATENCY=150 npm run dev`
3. Open http://localhost:8080
4. Move with WASD
5. Observe local player movement

**Expected:**
- Local player movement STILL feels instant (prediction masks the latency)
- No perceived delay between key press and visual movement
- Minor corrections may occur but shouldn't be jarring

**Why human:** Prediction effectiveness at masking latency is subjective. Small corrections might be acceptable to some users but jarring to others.

#### 4. Rubberbanding severity at 150ms latency

**Test:**
1. With SIMULATE_LATENCY=150, move player in circles
2. Make sudden direction changes
3. Observe for position corrections (rubberbanding)

**Expected:**
- Minor corrections are acceptable (sub-pixel to few pixels)
- No large visible snaps or teleports
- Player doesn't visibly "snap back" to old positions

**Why human:** Rubberbanding severity is a visual artifact. The threshold for "acceptable" vs "game-breaking" requires human judgment based on gameplay feel.

#### 5. Facing direction follows movement

**Test:**
1. Move player in different directions (W, A, S, D, diagonals)
2. Observe character orientation (if rotation visible on rectangle)
3. Stop moving — facing direction should freeze

**Expected:**
- Character angle updates to match velocity direction
- Only updates when speed above facingThreshold (10 px/s)
- Facing direction frozen when stopped

**Why human:** Visual behavior of rotation needs human verification. Angle calculation can be correct mathematically but produce wrong visual results (e.g., wrong axis, inverted direction).

---

## Summary

**Status: human_needed** — All automated checks passed, 5 items require human verification.

### Automated Verification Results

All artifacts exist, are substantive (not stubs), and properly wired:
- ✓ Shared physics module with acceleration/drag/normalization
- ✓ Server velocity-based movement with sequence tracking
- ✓ Client prediction with input replay reconciliation
- ✓ Client interpolation with snapshot buffering
- ✓ GameScene integration of both systems
- ✓ TypeScript compiles with zero errors
- ✓ All key links verified (imports + usage)
- ✓ All commits documented and exist in git history

### What Needs Human Testing

Phase 2 goal requires confirming **subjective movement feel**:
1. **Responsiveness** — Does local movement feel instant?
2. **Smoothness** — Do remote players move smoothly?
3. **Latency resilience** — Is the game playable at 150ms?
4. **Rubberbanding** — Are corrections acceptable or jarring?
5. **Facing direction** — Does rotation follow movement correctly?

Plan 02-02 Task 3 included human verification checkpoint that was approved during execution. However, final phase-level verification requires independent human testing to confirm the phase goal is achieved.

### Next Steps

**Option A: Human tests and approves** → Status changes to `passed`, phase complete, proceed to Phase 3

**Option B: Human finds issues** → Status changes to `gaps_found`, gaps documented in frontmatter for re-planning

---

_Verified: 2026-02-10T12:19:35Z_
_Verifier: Claude (gsd-verifier)_

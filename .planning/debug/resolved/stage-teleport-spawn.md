---
status: resolved
trigger: "Characters visibly teleport at the start of a new stage despite inStageTransition guard"
created: 2026-02-14T00:00:00Z
updated: 2026-02-16T21:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - The inStageTransition guard blocks Schema onChange position updates from reaching prediction/interpolation systems, but never backfills those positions when the guard drops. Sprites render at stale (old stage) positions until the first post-transition Schema change arrives.
test: Trace all sprite position update paths and confirm no position sync on guard-drop
expecting: Find that stageStart handler sets inStageTransition=false but never snaps sprites/prediction/interpolation to current server positions
next_action: Return diagnosis

## Symptoms

expected: When new stage starts, characters should appear at their new spawn locations without any visible teleport
actual: Characters appear at their LAST KNOWN position from the previous stage, then visibly teleport to their new spawn location
errors: None (visual bug)
reproduction: Play a best-of-3 match, win/lose first stage, observe character positions during stage transition
started: Since phase 09-04 implementation

## Eliminated

- hypothesis: Server sends positions before client sets inStageTransition flag
  evidence: Server delays resetStage by 600ms (line 820); client sets inStageTransition=true on stageEnd (line 353), which arrives ~2600ms before resetStage runs
  timestamp: 2026-02-16

- hypothesis: handlePlayerChange bypasses the inStageTransition guard
  evidence: Guard at line 1274 early-returns before ALL position update code (both local reconcile and remote interpolation snapshot)
  timestamp: 2026-02-16

- hypothesis: Sprites are updated via a code path other than handlePlayerChange during transition
  evidence: Local sprite update (line 748-754) is inside controlsLocked block (locked during transition). Remote interpolation (line 810-831) runs but only returns stale data since no new snapshots were added.
  timestamp: 2026-02-16

## Evidence

- timestamp: 2026-02-16T00:01:00Z
  checked: Server beginStageTransition timing (GameRoom.ts lines 798-829)
  found: Server broadcasts stageTransition FIRST (line 806), then delays resetStage by 600ms (line 820). Player positions change 600ms AFTER client receives stageTransition message. Client already has inStageTransition=true at this point (set on stageEnd, 2s earlier).
  implication: Server timing is correct -- positions change while guard is active

- timestamp: 2026-02-16T00:02:00Z
  checked: handlePlayerChange guard behavior (GameScene.ts line 1273-1301)
  found: When inStageTransition is true, line 1274 early-returns BEFORE prediction.reconcile() (line 1279) and interpolation.addSnapshot() (line 1295). This means the new spawn positions from resetStage are received by onChange but DISCARDED by the guard.
  implication: Neither prediction system nor interpolation system ever receives the new spawn positions

- timestamp: 2026-02-16T00:03:00Z
  checked: stageStart handler (GameScene.ts lines 423-495)
  found: Line 438 sets inStageTransition=false. No code reads current Schema player.x/player.y to sync prediction or interpolation systems. No code snaps sprite positions to current state.
  implication: After guard drops, all systems still hold stale (old stage) positions

- timestamp: 2026-02-16T00:04:00Z
  checked: What happens after inStageTransition=false in update() loop
  found: |
    LOCAL player: prediction.getState() returns old position (never reconciled with new spawn).
    Sprite renders at old position. First movement input triggers server response, onChange fires,
    reconcile() receives new spawn coords -> sprite JUMPS from old to new position.

    REMOTE players: interpolation.getInterpolatedState() returns last buffered snapshot (old position).
    No new snapshots exist. First server state change after PLAYING starts triggers onChange,
    addSnapshot() is called -> interpolation lerps from old to new -> visible teleport/slide.
  implication: Both local and remote players visibly teleport when first post-transition position update arrives

- timestamp: 2026-02-16T00:05:00Z
  checked: Colyseus 0.15 Schema delta behavior
  found: Colyseus only sends property changes in patches. Player positions set in resetStage() are sent in ONE patch during STAGE_TRANSITION. They are NOT re-sent when matchState changes to PLAYING in startStage() because positions haven't changed since resetStage(). The onChange that carried the new positions was blocked by inStageTransition guard and will NOT fire again.
  implication: There is NO automatic retry or re-delivery of position changes -- the guard creates a permanent data loss

- timestamp: 2026-02-16T00:06:00Z
  checked: PredictionSystem.reset() method (Prediction.ts line 204-207)
  found: A reset(state) method exists that snaps localState and clears pending inputs. It is never called during stage transitions.
  implication: The mechanism to fix the local player already exists but is unused

## Resolution

root_cause: |
  The inStageTransition guard in handlePlayerChange (line 1274) correctly blocks position updates during
  the stage transition to prevent visible teleportation. However, when the guard is dropped in the
  stageStart handler (line 438, inStageTransition = false), the code NEVER backfills the blocked
  positions into the prediction system (local player) or interpolation system (remote players).

  Colyseus Schema onChange only fires when the server sends a new value. The spawn positions were sent
  once during STAGE_TRANSITION (from resetStage), blocked by the guard, and will NOT be re-sent because
  they haven't changed since. This creates a permanent position desync: the server knows players are at
  spawn positions, but the client's rendering systems still have old-stage positions.

  The sprites remain at their old positions until the first post-transition game action causes a new
  position change on the server, at which point they visibly jump to the new location.

fix:
verification:
files_changed: []

---
status: investigating
trigger: "eliminated players lose controller input after stage transition"
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:00:00Z
---

## Current Focus

hypothesis: The client-side `isSpectating` flag is set to true when the local player dies, but `cleanupStageVisuals()` only resets it during `stageTransition` message -- however the `isDead` check in `update()` uses `localPlayer.health <= 0` which remains true until the server's `resetStage()` sets health back. If the health reset arrives AFTER the client has already processed the stageTransition cleanup, `isSpectating` gets re-set to true by the update loop before the new stage begins.
test: Trace the exact timing of isSpectating reset vs health update arrival
expecting: Race condition between cleanup and server state sync
next_action: Confirm root cause by analyzing timing chain

## Symptoms

expected: After a stage ends and new stage begins, all players (including those eliminated in previous stage) should regain full input control
actual: Players eliminated in previous round become permanently unresponsive -- their controls no longer work in subsequent stages
errors: None (silent failure)
reproduction: Play a best-of-3 match, eliminate a player in stage 1, observe they cannot move in stage 2
started: After multi-stage rounds feature was implemented (Phase 9)

## Eliminated

## Evidence

- timestamp: 2026-02-16T00:01:00Z
  checked: GameScene.update() input guard at line 651
  found: Input processing is skipped when `isDead || isSpectating || controlsLocked`. The `isDead` check reads `localPlayer.health <= 0` live from server state. The `isSpectating` flag is a local boolean.
  implication: Two independent guards can block input -- either one alone is sufficient to freeze the player

- timestamp: 2026-02-16T00:02:00Z
  checked: GameScene.update() spectator entry at lines 568-610
  found: When `isDead && !isSpectating && !matchEnded`, `isSpectating` is set to true. This runs EVERY frame as long as health <= 0.
  implication: Even if isSpectating is reset, if health is still 0, the very next frame re-enters spectator mode

- timestamp: 2026-02-16T00:03:00Z
  checked: cleanupStageVisuals() at line 1633-1634
  found: `this.isSpectating = false; this.spectatorTarget = null;` -- resets spectating state
  implication: The cleanup does reset spectating, but timing relative to server health update matters

- timestamp: 2026-02-16T00:04:00Z
  checked: stageTransition message handler (line 385-420) and stageStart handler (line 423-495)
  found: stageTransition calls cleanupStageVisuals() which resets isSpectating. But stageStart only sets controlsLocked=true for the overview, then later sets controlsLocked=false. Neither handler touches isSpectating again.
  implication: isSpectating is only reset once during the transition window

- timestamp: 2026-02-16T00:05:00Z
  checked: Server resetStage() timing at line 836-873
  found: resetStage() resets player.health = stats.maxHealth. But this is called 600ms AFTER the stageTransition broadcast (line 820-828 in beginStageTransition). The stageTransition message triggers cleanupStageVisuals on the client.
  implication: CRITICAL TIMING -- cleanupStageVisuals resets isSpectating, but 600ms later server sets health. During those 600ms, the client update() loop sees health<=0 and RE-SETS isSpectating=true

- timestamp: 2026-02-16T00:06:00Z
  checked: Server beginStageTransition() timing chain
  found: 1) broadcast stageTransition immediately 2) 600ms later: resetStage (health reset) 3) 3400ms after resetStage: startStage (PLAYING state). But client receives stageTransition, calls cleanupStageVisuals (isSpectating=false), then continues running update(). Health is still 0 for ~600ms+ network latency.
  implication: CONFIRMED -- there is a window where isSpectating is reset but health hasn't been updated yet, causing the update loop to re-trigger spectator mode

- timestamp: 2026-02-16T00:07:00Z
  checked: Whether inStageTransition blocks the re-entry
  found: inStageTransition is set to true in stageEnd handler (line 352-353), and cleanupStageVisuals does NOT reset it. It's reset to false in stageStart handler (line 438). The update() main loop does NOT check inStageTransition for the isDead/isSpectating block.
  implication: inStageTransition does NOT prevent the spectator re-entry because the isDead check at line 566-567 runs regardless of inStageTransition

## Resolution

root_cause: Race condition between client-side `isSpectating` reset and server health update. `cleanupStageVisuals()` correctly resets `isSpectating = false` when the `stageTransition` message arrives, but the server delays `resetStage()` (which sets health back to max) by 600ms. During this 600ms window (plus network latency), the client's `update()` loop continues to see `localPlayer.health <= 0` and immediately re-sets `isSpectating = true` on the very next frame. Once `isSpectating` is true, the input guard at line 651 (`!isDead && !isSpectating && !controlsLocked`) blocks all input. When the server finally resets health, `isDead` becomes false, but `isSpectating` remains true forever because the only code that sets `isSpectating = false` is in `cleanupStageVisuals()` which already ran.

fix:
verification:
files_changed: []

---
status: resolved
phase: 09-multi-stage-rounds
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md
started: 2026-02-14T11:00:00Z
updated: 2026-02-16T21:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Best-of-3 Match Structure
expected: A match plays up to 3 stages. The first side to win 2 stages wins the match. If one side wins the first 2 stages, the match ends without a 3rd stage.
result: pass

### 2. Different Arena Each Stage
expected: Each stage loads a visually different arena map. No arena repeats within the same match (e.g., hedge, brick, timber in sequence).
result: pass

### 3. Stage End Camera Zoom
expected: When a stage ends (one side eliminated or timer expires), the camera zooms out to show the full arena before transitioning.
result: issue
reported: "The zooming and transition is a bit janky. Consider using a masked transition mentioning in this repo https://github.com/devshareacademy/phaser-3-typescript-games-and-examples/tree/main/examples/3.80/scene-transition-geometry-mask"
severity: minor

### 4. Stage Intro Overlay
expected: Between stages, an overlay screen appears showing the upcoming stage number (e.g., "Stage 2"), the arena name, and the current series score.
result: pass

### 5. Tilemap Swap Transition
expected: The screen fades to black between stages. When it fades back in, the new arena is loaded with the correct tileset and layout. No visual glitches, tile bleeding, or leftover tiles from the previous stage.
result: issue
reported: "Before transitioning to the new arena, the characters are teleported to the next page starting location - making it look buggy. Also players can end up inside a wall, is the starting location being respected?"
severity: major

### 6. Clean State Reset Between Stages
expected: At the start of each new stage, all players have full health, are positioned at their spawn points, and there are no leftover projectiles or destroyed obstacles from the previous stage.
result: pass

### 7. HUD Round Score Display
expected: A round score (e.g., "0 - 0") is visible in the HUD during gameplay. It updates live when a stage is won (e.g., changes to "1 - 0").
result: pass

### 8. HUD Stage Label
expected: The HUD shows which stage is currently being played (e.g., "Stage 1", "Stage 2", "Stage 3").
result: pass

### 9. Victory Screen Series Score
expected: The victory screen shows the overall series result, e.g., "Paran Win (2-1)" or "Guardians Win (2-0)".
result: pass

### 10. Victory Per-Stage Breakdown
expected: The victory screen includes a stage-by-stage breakdown showing each stage's arena name, which side won that stage, and the stage duration.
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Camera zooms out smoothly on stage end before transitioning"
  status: resolved
  reason: "User reported: The zooming and transition is a bit janky. Consider using a masked transition mentioning in this repo https://github.com/devshareacademy/phaser-3-typescript-games-and-examples/tree/main/examples/3.80/scene-transition-geometry-mask"
  severity: minor
  test: 3
  root_cause: "4 discrete camera animation phases (zoom, fade, swap, fade-in) with timing gaps and hard resets between them. Server uses fixed timeouts (2s+4s) uncoordinated with client animation state, creating dead zones where nothing animates."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "stageEnd/stageTransition/stageStart handlers run 4 separate camera animations with gaps"
    - path: "server/src/rooms/GameRoom.ts"
      issue: "Fixed 2s+4s timeouts uncoordinated with client animation"
  missing:
    - "Replace multi-phase camera transitions with single continuous geometry mask animation (iris wipe)"
    - "Circle mask shrinks to black, tilemap swaps while fully obscured, mask expands to reveal new arena"
  debug_session: ".planning/debug/stage-zoom-janky.md"

- truth: "Screen fades to black between stages with no visual glitches - characters should not be visible moving to new positions before fade"
  status: resolved
  reason: "User reported: Before transitioning to the new arena, the characters are teleported to the next page starting location - making it look buggy. Also players can end up inside a wall, is the starting location being respected?"
  severity: major
  test: 5
  root_cause: "Timing race: server beginStageTransition() sets matchState then immediately calls resetStage() which updates player x/y in-place. Client receives Schema position changes BEFORE the stageTransition message, so sprites teleport visibly before fade starts. Secondary: setSpawnPosition() has no collision validation."
  artifacts:
    - path: "server/src/rooms/GameRoom.ts"
      issue: "beginStageTransition() calls resetStage() synchronously — position updates propagate before client fade (lines 709-733)"
    - path: "client/src/scenes/GameScene.ts"
      issue: "player.onChange() updates sprite positions immediately, no guard for STAGE_TRANSITION state (line 815)"
  missing:
    - "Delay resetStage() call until after client has had time to start fade (~600ms after stageTransition broadcast)"
    - "Or: client-side guard in handlePlayerChange() to skip position updates during STAGE_TRANSITION"
    - "Add spawn collision validation in setSpawnPosition() to prevent spawning inside walls"
  debug_session: ".planning/debug/stage-teleport-spawn.md"

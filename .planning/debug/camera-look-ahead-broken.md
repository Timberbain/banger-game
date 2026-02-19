---
status: diagnosed
trigger: "Camera look-ahead doesn't work at all - should shift in movement direction"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - compound of slow lerps (0.04 offset + 0.08 camera follow) combined with game dynamics (Paran instant stop/wall-reset, frequent direction changes) means look-ahead never visibly accumulates
test: Traced all camera setup paths, verified Phaser followOffset semantics, calculated effective response times
expecting: Effect takes 2-3s of sustained movement to become visible; Paran gameplay rarely sustains direction that long
next_action: Return diagnosis

## Symptoms

expected: Camera subtly shifts in direction of movement (60px Paran, 30px Guardians)
actual: No visible look-ahead effect at all
errors: None
reproduction: Move any character, observe camera stays centered
started: Since implementation

## Eliminated

- hypothesis: followOffset math is inverted (wrong direction)
  evidence: Phaser source confirms followOffset is SUBTRACTED (line 525-526 Camera.js); negating direction vector correctly produces ahead-shift
  timestamp: 2026-02-13

- hypothesis: camera.startFollow never called for local player
  evidence: startMatchOverview() calls startFollow at line 1241 after 1.5s delay; matchState listener triggers it on 'playing' transition
  timestamp: 2026-02-13

- hypothesis: mapMetadata null causes startMatchOverview to early-return
  evidence: In normal flow, matchState='waiting' on first state (listen fires with 'waiting', not 'playing'); mapMetadata set via onStateChange.once before matchState transitions to 'playing'
  timestamp: 2026-02-13

- hypothesis: camera bounds clamp nullifies offset
  evidence: Map 800x608 at zoom 2 gives midpoint range 320-480; player at center (400) has 80px of freedom each direction, enough for 60px look-ahead
  timestamp: 2026-02-13

- hypothesis: setZoom or other camera operations reset followOffset
  evidence: Phaser setZoom only sets zoomX/zoomY; startFollow resets followOffset to (0,0) but only called once in startMatchOverview
  timestamp: 2026-02-13

## Evidence

- timestamp: 2026-02-13
  checked: Phaser Camera.js source (followOffset usage)
  found: followOffset is SUBTRACTED from target position (line 525-526); negative offset shifts camera right
  implication: Look-ahead math is correct -- negating velocity direction for SUBTRACTION produces correct look-ahead

- timestamp: 2026-02-13
  checked: All startFollow calls in GameScene.ts
  found: 4 calls total - line 406 (spectator), 432 (tab cycle), 454 (target removed), 1241 (overview end). Only line 1241 is for local player during normal gameplay
  implication: Camera follow is set up correctly once after overview animation

- timestamp: 2026-02-13
  checked: Phaser startFollow signature and defaults (Camera.js line 682-709)
  found: startFollow(target, roundPixels, lerpX, lerpY, offsetX, offsetY) -- offsetX/Y default to 0, which RESETS followOffset.set(0,0) at line 699
  implication: After startFollow, followOffset starts from (0,0); look-ahead code must rebuild from zero

- timestamp: 2026-02-13
  checked: Phaser deadzone interaction with followOffset (Camera.js preRender lines 528-546)
  found: Deadzone check uses fx=follow.x-followOffset.x against deadzone rectangle. Deadzone centered on midPoint each frame. Camera only scrolls when effective target exits deadzone
  implication: Deadzone 40x30 creates slack that absorbs small offset changes before camera responds

- timestamp: 2026-02-13
  checked: Compound lerp timing calculation
  found: OFFSET_LERP=0.04 reaches 91.5% after 60 frames (1s). Camera follow lerp 0.08 adds additional tracking delay. Effective full response time ~2-3 seconds of sustained movement
  implication: In fast-paced Paran gameplay with frequent direction changes, wall hits (velocity reset to 0), and instant stops, the look-ahead never accumulates enough to be visible

- timestamp: 2026-02-13
  checked: Paran physics dynamics (characters.ts + physics.ts)
  found: Paran acceleration=300, maxVelocity=300, drag=0.95. Instant stop on key release. Velocity zeroed on wall hit. Takes ~1s to reach max speed
  implication: Combined with 2-3s look-ahead settling time, the effect is practically invisible during normal Paran gameplay

## Resolution

root_cause: The look-ahead code is functionally correct but practically invisible due to compounding slow lerp rates. The OFFSET_LERP (0.04/frame) takes ~1.5s to reach 90% of target, and the camera follow lerp (0.08) adds further delay, giving a total ~2-3s settling time. In actual gameplay, Paran changes direction, hits walls (losing ALL velocity), and stops/starts frequently -- the look-ahead offset never accumulates to a visible level before being reset by the next direction change or stop. For Guardians (30px max, half the offset), the effect is even less perceptible. The 40x30 deadzone further absorbs small offset movements.
fix:
verification:
files_changed: []

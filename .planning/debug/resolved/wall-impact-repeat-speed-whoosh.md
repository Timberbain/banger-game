---
status: resolved
trigger: "Wall impact sound/particles repeat continuously when holding into wall; speed whoosh needs removal; speed lines too subtle"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - three issues with clear root causes
test: code analysis complete
expecting: n/a
next_action: apply fixes

## Symptoms

expected: Wall impact sound + dust particles trigger ONCE on initial collision, not every frame while leaning against wall
actual: Wall impact sound and dust particles fire continuously every frame when Paran holds movement into a wall
errors: none (behavioral bug)
reproduction: Play as Paran, hold movement key into any wall -- hear repeating wall_impact sound and see continuous dust particles
started: Since Phase 05.1 (arena collisions implementation)

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-12
  checked: PredictionSystem.sendInput() -- hadCollision flag lifecycle
  found: hadCollision is set to true on EVERY frame that resolveCollisions returns hitX||hitY. The flag is read+cleared by getHadCollision() in GameScene.update(), but it gets set again on the very next sendInput() call.
  implication: The flag is per-frame, not per-collision-event. Holding into a wall = collision detected every frame = flag true every frame.

- timestamp: 2026-02-12
  checked: Physics cycle when pressing into wall
  found: Frame N: player has velocity toward wall -> physics moves player into wall -> resolveCollisions pushes player back + sets hadCollision=true -> Paran wall penalty zeros velocity. Frame N+1: input is still held -> acceleration reapplied -> physics moves player into wall again -> resolveCollisions pushes back again -> hadCollision=true AGAIN.
  implication: This is the classic "acceleration re-enters wall each frame" pattern. The collision resolution correctly pushes back, but the flag fires every frame because new velocity is created each frame by the held input.

- timestamp: 2026-02-12
  checked: PredictionSystem.reconcile() method
  found: reconcile() also sets hadCollision=true during replay. Server reconciliation replays pending inputs and can trigger additional false collision events on frames that aren't even the current frame.
  implication: reconcile can compound the problem -- collision flags from replay leak into the same hadCollision boolean that GameScene reads.

- timestamp: 2026-02-12
  checked: GameScene.ts lines 493-497 (speed whoosh trigger)
  found: Speed whoosh plays when curSpeed > 200, rate-limited to once per second via lastWhooshTime. Uses audioManager.playSFX('speed_whoosh'). SoundDefs.ts line 215 defines the sound; line 317 exports it in SOUND_DEFS.
  implication: Removal requires: (1) delete the trigger block in GameScene, (2) optionally remove SoundDef entry.

- timestamp: 2026-02-12
  checked: GameScene.ts lines 499-506 (speed lines)
  found: Speed lines emit 3 particles every 3 frames (so ~20 bursts/sec at 60fps). Each burst: 3 particles, scale 0.3->0, alpha 0.4->0, lifespan 150ms, white tint. Very small, very transparent, very short-lived.
  implication: The combination of tiny scale (0.3), low alpha (0.4), and extremely short lifespan (150ms) makes them nearly invisible. Needs larger scale, higher alpha, longer lifespan, more particles per burst.

## Resolution

root_cause: |
  THREE ISSUES:

  1. WALL IMPACT REPEAT: PredictionSystem.hadCollision is a simple boolean flag set on every
     resolveCollisions() call that detects overlap. When Paran holds movement into a wall,
     each frame: acceleration -> move into wall -> collision pushes back -> hadCollision=true.
     Next frame: same acceleration -> same collision -> flag true again. The flag only tracks
     "did a collision happen this frame" not "did a NEW collision START." Additionally,
     reconcile() replays can set hadCollision from historical inputs.

  2. SPEED WHOOSH: Triggered at GameScene.ts line 494 when Paran speed > 200, rate-limited
     to once per second. Sound defined in SoundDefs.ts line 215. User wants it fully removed.

  3. SPEED LINES TOO SUBTLE: ParticleFactory.speedLines() uses scale 0.3->0, alpha 0.4->0,
     lifespan 150ms, 3 particles per burst, white tint. All values are too conservative to
     be visible during fast gameplay.

fix: |
  1. Wall impact: Change hadCollision from a per-frame flag to a rising-edge detector.
     Add a wasAgainstWall boolean. Only trigger effects when hadCollision transitions
     from false to true (first frame of contact). While held against wall, suppress.
     Also prevent reconcile() from setting the gameplay-facing hadCollision flag.

  2. Speed whoosh: Remove the trigger block (lines 493-497) and lastWhooshTime field.
     Remove speed_whoosh from SoundDefs.

  3. Speed lines: Increase scale to 0.8->0, alpha to 0.7->0, lifespan to 250ms,
     particles per burst to 5, and use gold tint (0xffd700) to match Paran's color.

verification: |
  - TypeScript compilation: PASS (both client and server, zero errors)
  - Wall impact: hadCollision now uses rising-edge detection (wasAgainstWall guard).
    Holding into wall: frame 1 = hadCollision true (effect plays), frame 2+ = wasAgainstWall is true so hadCollision stays false (effect suppressed).
    Releasing and re-hitting: wasAgainstWall resets to false when no collision detected, so next contact triggers again.
  - Speed whoosh: All references removed (GameScene trigger, lastWhooshTime field, SoundDefs entry)
  - Speed lines: Particles now 5 per burst, scale 0.8, alpha 0.7, lifespan 250ms, gold tint
  - reconcile() no longer sets hadCollision, preventing replay-triggered false positives
files_changed:
  - client/src/systems/Prediction.ts
  - client/src/scenes/GameScene.ts
  - client/src/systems/ParticleFactory.ts
  - client/src/config/SoundDefs.ts

---
status: diagnosed
trigger: "Investigate why no sound plays when guardian characters (Faran/Baran) shoot"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:01:00Z
---

## Current Focus

hypothesis: Shoot sound only plays for local player input; no sound trigger exists for remote players' projectiles
test: Searched entire codebase for _shoot playSFX calls and projectile onAdd handler
expecting: Confirmed - only one shoot sound call exists, in local input handler
next_action: Return diagnosis

## Symptoms

expected: Shoot sound should be audible for all players when any character (including Faran/Baran) fires
actual: No sound plays when guardian characters shoot (for other players)
errors: None (silent failure)
reproduction: Play as any role, observe that remote guardian shooting is silent
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-02-12T00:00:30Z
  checked: SoundDefs.ts - sound definitions for faran_shoot and baran_shoot
  found: Both faran_shoot (line 90) and baran_shoot (line 104) are properly defined and exported in SOUND_DEFS
  implication: Sound definitions are NOT the problem

- timestamp: 2026-02-12T00:00:35Z
  checked: AudioManager.ts - init() and playSFX() methods
  found: init() generates audio for all SOUND_DEFS entries; playSFX() correctly looks up and plays by key
  implication: AudioManager infrastructure is NOT the problem

- timestamp: 2026-02-12T00:00:40Z
  checked: GameScene.ts lines 460-463 - shoot sound trigger
  found: Shoot sound ONLY fires inside local input handler: `if (input.fire && this.audioManager && this.localRole) { this.audioManager.playSFX(...) }`
  implication: Only the local player hears their own shoot - remote players' shots are silent

- timestamp: 2026-02-12T00:00:45Z
  checked: GameScene.ts createProjectileSprite() lines 706-752
  found: Creates sprite, stores velocity, creates trail particles, registers onChange - but NO playSFX call
  implication: When remote projectiles appear via onAdd, no shoot sound is played

- timestamp: 2026-02-12T00:00:50Z
  checked: Full codebase grep for _shoot playSFX calls
  found: Only ONE occurrence: GameScene.ts line 468 inside local input handler
  implication: Confirmed - no remote shoot sound path exists anywhere

## Resolution

root_cause: Shoot sound is only triggered by the local player's fire input (GameScene.ts line 462-463). The `createProjectileSprite` method (called via projectiles.onAdd for ALL projectiles including remote) does not play any shoot sound. Remote players' projectiles appear visually but are completely silent.
fix:
verification:
files_changed: []

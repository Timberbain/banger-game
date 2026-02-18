---
status: resolved
phase: 10-powerup-system
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md
started: 2026-02-17T16:00:00Z
updated: 2026-02-18T16:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Powerup Spawning & Appearance
expected: During a match, potion items appear on the arena floor as small colored sprites (blue/orange/red) with a bobbing animation.
result: issue
reported: "Increase the size 2x. Add particle effects around the potion for better visibility."
severity: minor

### 2. Powerup Collection Feedback
expected: Walking over a powerup collects it — a chime SFX plays, floating text shows the powerup name (e.g. "Speed Boost"), and a colored particle aura appears around the player.
result: issue
reported: "I would like this sound to be played when picking up a powerup assets/soundeffects/powerup_1.wav. Add more particles when powerup is active - it is barely visible."
severity: minor

### 3. Speed Boost Effect
expected: Collecting a blue potion makes the player move noticeably faster. A blue particle aura surrounds the player while the buff is active.
result: issue
reported: "increase the duration 5x"
severity: minor

### 4. Invincibility Effect
expected: Collecting an orange potion makes the player immune to all damage (projectiles pass through, Paran contact kill blocked). A gold/orange aura surrounds the player.
result: pass

### 5. Projectile Buff (Guardian)
expected: A Guardian collecting a red potion fires larger, faster projectiles. A red particle aura surrounds the Guardian.
result: issue
reported: "the particle effect is not showing."
severity: major

### 6. Paran Beam
expected: Paran collecting a red potion fires a large beam projectile that pierces through walls and destroys obstacles. The beam appears gold-glowing and larger than normal projectiles.
result: pass

### 7. HUD Buff Duration Indicators
expected: When a buff is active, a shrinking bar with a potion icon appears in the HUD area (between health and cooldown bars). The bar flashes when the buff is about to expire.
result: pass

### 8. Kill Feed Powerup Messages
expected: The kill feed shows messages when powerups spawn (e.g. "Speed Boost appeared!") and when collected (e.g. "Player collected Speed Boost").
result: pass

### 9. Despawn Blink Warning
expected: If a powerup is not collected, it begins blinking a few seconds before it despawns and then disappears.
result: pass

### 10. Stage Transition Cleanup
expected: Between stages in a best-of-3 match, all powerup sprites, player auras, and HUD buff indicators are cleared. Fresh powerups spawn in the new stage.
result: pass

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Powerup items are clearly visible on the arena floor"
  status: resolved
  reason: "User reported: Increase the size 2x. Add particle effects around the potion for better visibility."
  severity: minor
  test: 1
  root_cause: "setDisplaySize(16, 16) at GameScene.ts:624 — source images are 32x32 but displayed at half size. No idle particle effect exists for ground powerups."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "setDisplaySize(16, 16) too small — change to setDisplaySize(32, 32)"
    - path: "client/src/systems/ParticleFactory.ts"
      issue: "Missing createPowerupIdleAura() method for ground item particle effect"
  missing:
    - "Change setDisplaySize to 32x32 in onAdd handler (line 624) and reconnection handler (line 1921)"
    - "Add ParticleFactory.createPowerupIdleAura() method with color-matched particles"
    - "Track idle emitters in powerupEmitters Map, destroy on collection/despawn"

- truth: "Powerup collection uses provided WAV SFX and buff aura particles are clearly visible"
  status: resolved
  reason: "User reported: I would like this sound to be played when picking up a powerup assets/soundeffects/powerup_1.wav. Add more particles when powerup is active - it is barely visible."
  severity: minor
  test: 2
  root_cause: "Pickup SFX uses jsfxr-generated sound (SoundDefs.ts:290-302) instead of provided WAV file. Buff aura particle settings too sparse: frequency 40-60, alpha 0.5-0.6, scale 0.5-0.8."
  artifacts:
    - path: "client/src/config/SoundDefs.ts"
      issue: "powerup_pickup defined as jsfxr — needs to use WAV file instead"
    - path: "client/src/systems/ParticleFactory.ts"
      issue: "speedAura/invincibilityAura/projectileAura particle frequency, alpha, and scale too low"
  missing:
    - "Copy assets/soundeffects/powerup_1.wav to client/public/soundeffects/"
    - "Preload WAV in BootScene and play via Phaser sound manager or AudioManager"
    - "Increase aura frequency to 80-120, alpha to 0.7-0.8, scale to 0.8-1.2, lifespan to 500-700ms"

- truth: "Speed boost buff duration feels appropriately long for gameplay"
  status: resolved
  reason: "User reported: increase the duration 5x"
  severity: minor
  test: 3
  root_cause: "POWERUP_CONFIG durations too short: speedDuration=4500ms, invincibilityDuration=2500ms, projectileDuration=5500ms in shared/powerups.ts lines 40-44"
  artifacts:
    - path: "shared/powerups.ts"
      issue: "speedDuration: 4500 → 22500, invincibilityDuration: 2500 → 12500, projectileDuration: 5500 → 27500"
  missing:
    - "Multiply all three duration values by 5 in shared/powerups.ts"

- truth: "Red particle aura shows on Guardian when projectile buff is active"
  status: resolved
  reason: "User reported: the particle effect is not showing."
  severity: major
  test: 5
  root_cause: "Code flow is correct (powerupCollect → startBuffAura → projectileAura). Likely runtime issue: data.type may be string '2' instead of number 2 causing switch case miss, or sprite/particleFactory not ready when event fires. Also aura particles inherently too faint (scale 0.5, alpha 0.6) — may render but be invisible."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "startBuffAura switch may fail silently on type mismatch; no defensive Number() cast on data.type"
    - path: "client/src/systems/ParticleFactory.ts"
      issue: "projectileAura particles very faint (scale 0.5, alpha 0.6, lifespan 350ms)"
  missing:
    - "Add Number(data.type) cast in powerupCollect handler to prevent string/number mismatch"
    - "Increase projectileAura particle visibility (covered by gap 2 fix)"

---
status: diagnosed
phase: 12-hud-icon-overhaul
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md
started: 2026-02-19T14:00:00Z
updated: 2026-02-19T14:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Heart Health Display
expected: Health is shown as a row of heart icons at the bottom-center of the screen. Paran has 15 hearts, Guardians have 5 hearts. All filled at full health.
result: pass

### 2. Heart Damage Animation
expected: When taking damage, hearts transition from filled to empty with a visible flash and shrink animation (not an instant swap).
result: pass

### 3. Timer Icon
expected: An hourglass icon appears next to the match timer at the top of the screen. When time runs low, both the icon and text pulse red together.
result: issue
reported: "the elements on the top, such as timer near the end, stage and score tracking dots are really difficult to see"
severity: minor

### 4. Round Score Pips
expected: Round score is shown as colored pip circles (gold for Paran wins, red for Guardian wins, gray for unplayed) instead of text like "0 - 0".
result: pass

### 5. Kill Feed Skull Icons
expected: When a player kills another, the kill feed shows: killer name (colored) + skull icon + victim name (colored). Powerup events show plain text without skull.
result: pass

### 6. Arena Gravestones
expected: When a player dies, a small gravestone icon appears on the arena floor at the death location, tinted with the dead player's character color. Persists for the stage.
result: issue
reported: "remove the ELIMINATED text now that the gravestone is there"
severity: cosmetic

### 7. Death Overlay
expected: When your character is eliminated, a large gravestone icon and "ELIMINATED" text fade in over the screen, hold for a few seconds, then fade out.
result: pass

### 8. Radial Buff Indicators
expected: When holding an active powerup, a potion icon appears near the hearts with a radial sweep countdown (clockwise black overlay draining) showing remaining duration.
result: issue
reported: "The particle effect when a powerup is in effect doesnt have the same color as the potion"
severity: minor

### 9. Low-Health Tint Pulse
expected: Other players (not your own character) pulse red when below 50% HP. Your own character does not pulse (you see hearts instead).
result: pass

### 10. HUD Layout at 1280x720
expected: All HUD elements visible with no overlapping: timer+pips top-center, minimap+kill-feed top-right, hearts+buff-indicators bottom-center. Nothing cut off or mispositioned.
result: issue
reported: "the SPECTATING: Player overlaps the labels at the top"
severity: minor

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Timer, stage label, and score pips are clearly readable at top-center of screen"
  status: failed
  reason: "User reported: the elements on the top, such as timer near the end, stage and score tracking dots are really difficult to see"
  severity: minor
  test: 3
  root_cause: "Top-center HUD elements lack dark backdrop panel, timer is only 20px, pips are 5px radius with 0.6 alpha inactive, stage label uses low-contrast secondary color at 12px"
  artifacts:
    - path: "client/src/scenes/HUDScene.ts"
      issue: "createMatchTimer() line 366: fontSize 20px too small; createRoundScore() line 933: pipRadius 5 too small; line 948: inactive pips 0.6 alpha too faint; line 898: stage label 12px with secondary color"
  missing:
    - "Add semi-transparent dark backdrop panel behind top-center cluster"
    - "Increase timer font to 24px, pip radius to 7px, pip spacing to 20px"
    - "Increase inactive pip alpha to 1.0, stage label to 14px with stronger stroke"

- truth: "Death overlay gravestone communicates elimination without redundant text"
  status: failed
  reason: "User reported: remove the ELIMINATED text now that the gravestone is there"
  severity: cosmetic
  test: 6
  root_cause: "showDeathOverlay() creates both gravestone icon AND ELIMINATED text — text is redundant now that the gravestone icon communicates the death state"
  artifacts:
    - path: "client/src/scenes/HUDScene.ts"
      issue: "Lines 1276-1283: ELIMINATED text creation; line 1285: array includes eliminatedText; lines 1288-1296: tween targets include eliminatedText"
  missing:
    - "Remove ELIMINATED text creation, update deathOverlayObjects array and tween targets to gravestone only"

- truth: "Powerup particle aura color matches the potion color (Red=Speed, Blue=Invincibility, Green=Projectile)"
  status: failed
  reason: "User reported: The particle effect when a powerup is in effect doesnt have the same color as the potion"
  severity: minor
  test: 8
  root_cause: "Aura colors are rotated — Speed uses 0x4488ff (blue) instead of red, Invincibility uses 0xffcc00 (gold) instead of blue, Projectile uses 0xff4422 (orange) instead of green"
  artifacts:
    - path: "client/src/systems/ParticleFactory.ts"
      issue: "speedAura() line 178: 0x4488ff (blue, should be red ~0xCC3333); invincibilityAura() line 199: 0xffcc00 (gold, should be blue ~0x4488ff); projectileAura() line 222: 0xff4422 (orange, should be green ~0x44CC66)"
  missing:
    - "Update speedAura color to red (~0xCC3333), invincibilityAura to blue (~0x4488ff), projectileAura to green (~0x44CC66)"

- truth: "SPECTATING label does not overlap timer, pips, or stage label at top of screen"
  status: failed
  reason: "User reported: the SPECTATING: Player overlaps the labels at the top"
  severity: minor
  test: 10
  root_cause: "Spectator label at Y=H*0.07 (line 768) collides exactly with round score pips at Y=H*0.07 (line 935); instruction text at H*0.1 overlaps stage label at H*0.09"
  artifacts:
    - path: "client/src/scenes/HUDScene.ts"
      issue: "Line 768: spectatorBar Y=H*0.07 overlaps pips; line 777: spectatorInstruction Y=H*0.1 overlaps stage label"
  missing:
    - "Move spectator HUD below top-center cluster to Y >= H*0.15"

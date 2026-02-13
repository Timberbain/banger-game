---
status: diagnosed
phase: 06-ux-polish
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md, 06-06-SUMMARY.md, 06-08-SUMMARY.md, 06-09-SUMMARY.md, 06-10-SUMMARY.md
started: 2026-02-12T18:00:00Z
updated: 2026-02-12T18:25:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Match Timer and Timeout
expected: A 5-minute match timer counts down at the top-center of the HUD. When timer hits 0:00, guardians win automatically. Timer flashes/changes color in the last 30 seconds as a warning.
result: pass

### 2. Kill Feed
expected: When a player kills another (projectile or contact kill), a kill notification appears at the top-right of the screen showing killer name and victim name with role-colored text. Feed shows up to 4 entries and they fade after ~5 seconds.
result: pass

### 3. Character Sprites and Animations
expected: All 3 characters (Paran, Faran, Baran) display as pixel art sprites instead of colored rectangles. Characters animate walk cycles when moving in each direction, show idle animation when still, and play a death animation on elimination.
result: pass

### 4. Solarpunk Tilesets
expected: Each of the 4 maps uses a distinct solarpunk-themed tileset (ruins, living walls, bio-tech, mixed). Walls and obstacles render with the themed tiles instead of generic colors. Maps rotate between matches.
result: pass

### 5. HUD Health Bars
expected: Health bars for all alive players appear at the bottom of the screen. The local player's health bar is centered and larger than others. Health bars decrease when taking damage.
result: pass

### 6. Cooldown Display
expected: A small cooldown bar appears near the health bar area. After firing, the bar depletes and refills as the fire cooldown progresses. When ready to fire again the bar appears full/green.
result: issue
reported: "Shooting sound is playing even though its on cooldown. expected to only play when a projectile is fired"
severity: major

### 7. Ping Indicator
expected: A ping/latency number displays on the HUD (e.g., "32ms"). The color changes based on connection quality (green for good, yellow for moderate, red for poor).
result: pass

### 8. Role Identity Banner
expected: At match start, a role identity banner/text appears showing which character you are playing (e.g., "PARAN" or "FARAN"). The banner fades after a few seconds.
result: issue
reported: "It shows, however it is covered by the Fight! text. Make sure they dont overlap"
severity: minor

### 9. Spectator HUD
expected: When eliminated, the HUD switches to spectator mode showing which player you are currently spectating. Tab key cycles between remaining alive players.
result: issue
reported: "Yes it shows, but the text is covering HUD on the bottom of the screen. Perhaps put the label at the top below the timer."
severity: minor

### 10. Match Start Text
expected: When a match begins (3 players joined), a "FIGHT!" text appears on screen for a couple seconds then fades away.
result: pass

### 11. Damage Flash and Hit Particles
expected: When a player takes damage, their sprite briefly flashes white/red. A burst of particles appears at the hit location.
result: pass

### 12. Death Explosion Particles
expected: When a player dies, a larger particle explosion occurs at their position using their role color.
result: pass

### 13. Projectile Trails
expected: Fired projectiles leave a particle trail behind them as they travel. Trail color matches the firing character's role color.
result: pass

### 14. Paran Speed Lines
expected: When Paran is moving at high speed, speed line particles appear around them to convey velocity.
result: issue
reported: "Yes, but vaguely"
severity: cosmetic

### 15. Victory/Defeat Particles
expected: On match end, particle bursts appear at screen center. Green particles for winning team, red for losing.
result: pass

### 16. Sound Effects - Combat
expected: Each character makes a distinct sound when firing. Hit sounds play on projectile impact. Death sounds play on elimination. Sounds vary by role (Paran/Faran/Baran have different tones).
result: issue
reported: "No sound is playing when guardians shoot. The sound should be audible for all players"
severity: major

### 17. Sound Effects - Movement
expected: Paran hitting a wall plays a wall impact sound. Paran at high speed plays a speed whoosh sound (not spamming, rate-limited).
result: issue
reported: "Remove sound when reaching max speed. When colliding with a wall, the sound and effects repeats if in proximity with the wall and trying to move in the wall. Only play sound and effect when colliding, not when leaning against the wall."
severity: major

### 18. Sound Effects - UI
expected: Button clicks in menus play a click sound. Lobby countdown beeps play. Ready chime on all-ready. Match start/end fanfares play.
result: issue
reported: "Back to lobby button doesnt give away sound."
severity: minor

### 19. Volume Controls
expected: In the lobby/main menu, volume controls (+/- buttons) are visible. Adjusting volume changes sound levels. Volume setting persists across sessions (localStorage).
result: pass

### 20. Help Screen
expected: A "How to Play" button in the lobby opens a help screen showing controls (WASD, Space), role-specific guides for all 3 characters with their stats, and win conditions. A back/close button returns to the lobby.
result: pass

### 21. Boot Screen Click-to-Start
expected: On first load, a boot/title screen appears with the game title and a "Click to Start" prompt. Clicking anywhere advances to the lobby. This also unlocks browser audio context.
result: pass

### 22. Character Sprites in Lobby
expected: In the lobby character selection, animated character sprites (idle pose) are shown instead of colored rectangles. Each character displays their pixel art sprite.
result: pass

### 23. Character Color Identity
expected: Paran is yellow (#ffcc00, Pac-Man identity), Faran is red (#ff4444, ninja identity), Baran is green (#44cc66). These colors are consistent across sprites, particles, HUD, and lobby UI.
result: pass

### 24. Map Design - Paran Viability
expected: All maps have corridors at least 3 tiles wide, allowing Paran to navigate safely with cardinal movement. Interior features use mostly destructible obstacles rather than indestructible walls, so Paran can break through cover.
result: pass

### 25. Wall Impact Effects
expected: When Paran hits a wall, a dust/impact particle effect appears at the collision point along with a wall impact sound. This should ONLY trigger on actual wall collision, not on voluntary direction changes or stops.
result: issue
reported: "When colliding with a wall, the sound and effects repeats if in proximity with the wall and trying to move in the wall. Only play sound and effect when colliding, not when leaning against the wall."
severity: major

## Summary

total: 25
passed: 17
issues: 8
pending: 0
skipped: 0

## Gaps

- truth: "Shooting sound should only play when a projectile is actually fired, not when fire input is pressed during cooldown"
  status: failed
  reason: "User reported: Shooting sound is playing even though its on cooldown. expected to only play when a projectile is fired"
  severity: major
  test: 6
  root_cause: "Shoot SFX triggered on every frame fire key held (line 461), above the cooldown-gated block. Server gates actual projectile creation but client plays sound 60x/sec."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "playSFX call outside cooldown check block"
  missing:
    - "Move playSFX inside the cooldown-gated block"
  debug_session: ".planning/debug/shoot-sound-ignores-cooldown.md"

- truth: "Role identity banner should be visible and not overlapped by FIGHT! text at match start"
  status: failed
  reason: "User reported: It shows, however it is covered by the Fight! text. Make sure they dont overlap"
  severity: minor
  test: 8
  root_cause: "Role banner at Y=280 and FIGHT! at Y=300 are only 20px apart. FIGHT! has depth 400 vs banner depth 300, rendering on top. Both appear in same frame."
  artifacts:
    - path: "client/src/scenes/HUDScene.ts"
      issue: "Role banner Y=280 too close to FIGHT! Y=300"
  missing:
    - "Move role banner higher (e.g., Y=200) or sequence timing so banner fades before FIGHT! appears"
  debug_session: ".planning/debug/hud-text-overlap-positions.md"

- truth: "Spectator HUD label should not cover bottom HUD elements; suggested placement at top below timer"
  status: failed
  reason: "User reported: Yes it shows, but the text is covering HUD on the bottom of the screen. Perhaps put the label at the top below the timer."
  severity: minor
  test: 9
  root_cause: "Spectator bar at Y=540 and instruction at Y=565 overlap health bar labels at Y=557 and bars at Y=575."
  artifacts:
    - path: "client/src/scenes/HUDScene.ts"
      issue: "Spectator elements Y=540-565 in health bar zone Y=557-583"
  missing:
    - "Move spectator elements to top below timer (e.g., Y=50 for bar, Y=75 for instruction)"
  debug_session: ".planning/debug/hud-text-overlap-positions.md"

- truth: "Paran speed lines should be clearly visible and impactful at high velocity"
  status: failed
  reason: "User reported: Yes, but vaguely"
  severity: cosmetic
  test: 14
  root_cause: "ParticleFactory.speedLines() used scale 0.3, alpha 0.4, lifespan 150ms, 3 white particles -- all too conservative."
  artifacts:
    - path: "client/src/systems/ParticleFactory.ts"
      issue: "Speed line particle params too subtle"
  missing:
    - "Increase scale to 0.8, alpha to 0.7, lifespan to 250ms, 5 particles, gold tint"
  debug_session: ".planning/debug/resolved/wall-impact-repeat-speed-whoosh.md"

- truth: "All characters (including guardians) should produce audible shoot sounds for all players"
  status: failed
  reason: "User reported: No sound is playing when guardians shoot. The sound should be audible for all players"
  severity: major
  test: 16
  root_cause: "Shoot sound only triggered by local player input handler. createProjectileSprite (remote projectile onAdd) plays no sound. Guardian shots from other clients are silent."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "createProjectileSprite method missing playSFX call for owner's shoot sound"
  missing:
    - "Add playSFX in createProjectileSprite for remote projectiles (skip for local to avoid double-play)"
  debug_session: ".planning/debug/guardian-shoot-sound-silent.md"

- truth: "Remove speed whoosh sound entirely. Wall impact sound/effect should only play once on initial collision, not repeat when holding movement against a wall."
  status: failed
  reason: "User reported: Remove sound when reaching max speed. When colliding with a wall, the sound and effects repeats if in proximity with the wall and trying to move in the wall. Only play sound and effect when colliding, not when leaning against the wall."
  severity: major
  test: 17
  root_cause: "hadCollision is a simple boolean set every frame during wall contact (accel→move→collide→push back→repeat). Also set in reconcile() leaking historical collisions. Speed whoosh triggers at speed>200 rate-limited 1/sec."
  artifacts:
    - path: "client/src/systems/Prediction.ts"
      issue: "hadCollision fires every frame against wall, also set in reconcile replay"
    - path: "client/src/scenes/GameScene.ts"
      issue: "Speed whoosh trigger block and lastWhooshTime field"
    - path: "client/src/config/SoundDefs.ts"
      issue: "speed_whoosh sound definition to remove"
  missing:
    - "Rising-edge detector with wasAgainstWall boolean"
    - "Remove hadCollision from reconcile()"
    - "Remove speed whoosh trigger, field, and sound definition"
  debug_session: ".planning/debug/resolved/wall-impact-repeat-speed-whoosh.md"

- truth: "Back to lobby button on victory screen should play a click sound"
  status: failed
  reason: "User reported: Back to lobby button doesnt give away sound."
  severity: minor
  test: 18
  root_cause: "Code is correctly wired (VictoryScene.ts:134-135 calls playSFX). Likely jsfxr generated sound is too quiet/short or browser autoplay policy blocked it."
  artifacts:
    - path: "client/src/scenes/VictoryScene.ts"
      issue: "Audio code present but sound may be too quiet"
  missing:
    - "Verify button_click jsfxr params produce audible sound, or increase volume"
  debug_session: ".planning/debug/hud-text-overlap-positions.md"

- truth: "Wall impact sound/effect should only play once on initial collision, not repeat when holding movement against a wall"
  status: failed
  reason: "User reported: When colliding with a wall, the sound and effects repeats if in proximity with the wall and trying to move in the wall. Only play sound and effect when colliding, not when leaning against the wall."
  severity: major
  test: 25
  root_cause: "Same as test 17 - hadCollision fires every frame. Rising-edge detector needed."
  artifacts:
    - path: "client/src/systems/Prediction.ts"
      issue: "hadCollision fires every frame against wall"
  missing:
    - "Same fix as test 17"
  debug_session: ".planning/debug/resolved/wall-impact-repeat-speed-whoosh.md"
  test: 25
  artifacts: []
  missing: []

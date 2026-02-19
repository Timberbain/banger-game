---
status: diagnosed
phase: 07-hd-viewport-camera
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md
started: 2026-02-13T19:40:00Z
updated: 2026-02-13T19:59:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Game Resolution 1280x720
expected: Game window is noticeably wider than before (1280x720 instead of 800x600). The canvas fills without black borders or stretching.
result: pass

### 2. Title Screen at HD
expected: Boot/title screen fills the full 1280x720 canvas. Background, sparkles, vines, and title text are centered and visible with no elements cut off or mispositioned.
result: pass

### 3. Character Art (2x Detail)
expected: Characters show visually richer pixel art than before. Paran has a round Pac-Man body, Faran is slim with a hood/scarf, Baran is wide and armored. Each character has 4-tone shading with visible detail.
result: pass

### 4. Walk Animations
expected: Characters have smooth 6-frame walk cycles when moving in any direction. Animation feels fluid, not choppy.
result: pass

### 5. Idle Breathing Animation
expected: When a character stands still, it plays a subtle breathing animation (slight body movement) instead of being a static image.
result: pass

### 6. Projectile Art
expected: Projectiles are larger than before (16x16 instead of 8x8) with visible glow borders. Each role's projectile has a distinct shape.
result: pass

### 7. Camera Follow
expected: Camera smoothly follows the local player during gameplay. Small movements don't cause constant scrolling (deadzone). No jarring snaps.
result: issue
reported: "There is flakeyness in camera following. Sometimes it follows the players, some times done. For example, I have 3 browsers open, the camera only follows the one that plays Param. Camera doesnt follow faran or baran. After refreshing the browser and create a new match, the camera doesnt follow any character now."
severity: major

### 8. No Black Void at Map Edges
expected: When the player moves to any edge of the map, the camera stops and no black void or out-of-bounds area is visible.
result: pass

### 9. Camera Look-Ahead
expected: Camera subtly shifts in the direction of movement, showing more of the area ahead of the player (more noticeable for Paran at speed).
result: issue
reported: "This doesnt seem to work at all"
severity: major

### 10. Paran Speed Zoom
expected: When Paran reaches high speed, the camera slightly zooms out to show more of the arena. Zooms back in when stopping.
result: pass

### 11. Camera Shake
expected: Camera shakes subtly when the local player takes damage or when Paran hits a wall. The shake is brief and noticeable but not disorienting.
result: pass

### 12. Match Start Overview
expected: When a match starts, the camera briefly shows an overview of the full arena (zoomed out) for about 1.5 seconds, then smoothly zooms in to the player's position. Controls are locked during this animation.
result: issue
reported: "This is very flakey, this happens a few time. But mostly nothing happens. When it doesnt happen, the camera doesnt follow the player. Might be a race condition somewhere."
severity: major

### 13. Spectator Camera
expected: After dying, the camera automatically follows the closest alive player. Pressing Tab cycles between alive players.
result: pass

### 14. HUD Layout at 1280x720
expected: All HUD elements (health bars, cooldown indicator, timer, ping, kill feed, role banner) display at correct positions with no overlap, cutoff, or misalignment at the wider resolution.
result: issue
reported: "player name covers the cooldown bar"
severity: cosmetic

### 15. Lobby Scene at 1280x720
expected: Character selection panels are evenly spaced and centered. Buttons, room code, volume controls, and player list all render correctly at the wider resolution.
result: issue
reported: "Yes, but there is overlapp of elements. Room Code and Select Character text overlap, character panels overlap with Select Character text at the top."
severity: cosmetic

### 16. Victory Screen at 1280x720
expected: Victory overlay displays correctly with stats table columns spread across the wider screen. Particle effects are positioned correctly.
result: pass

### 17. Help Screen at 1280x720
expected: Help screen shows role panels spaced wider across the screen with proper layout. All keybind information is visible and not cramped.
result: issue
reported: "Alot of overlap. use the game-design skill to fix the design of this page - no need to show so much details and stats - only high level description in a playful manner"
severity: major

## Summary

total: 17
passed: 11
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "Camera smoothly follows the local player during gameplay for all roles"
  status: failed
  reason: "User reported: There is flakeyness in camera following. Sometimes it follows the players, some times done. For example, I have 3 browsers open, the camera only follows the one that plays Param. Camera doesnt follow faran or baran. After refreshing the browser and create a new match, the camera doesnt follow any character now."
  severity: major
  test: 7
  root_cause: "mapMetadata race condition: state.listen('matchState') fires BEFORE onStateChange.once() in Colyseus 0.15. The 3rd player to join gets matchState='playing' before mapMetadata is set, so startMatchOverview() early returns via null guard. No fallback camera follow exists anywhere."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "Lines 209-238 (onStateChange.once sets mapMetadata), 241-254 (matchState listener calls startMatchOverview), 1221-1254 (startMatchOverview with null guard)"
  missing:
    - "Defer startMatchOverview() until mapMetadata is available (flag + trigger on tilemap load)"
    - "Add fallback camera follow in update() or createTilemap() if camera._follow is null"
  debug_session: ".planning/debug/camera-follow-flaky.md"

- truth: "Camera subtly shifts in the direction of movement (look-ahead)"
  status: failed
  reason: "User reported: This doesnt seem to work at all"
  severity: major
  test: 9
  root_cause: "OFFSET_LERP=0.04 is too slow (takes ~2.5s to reach target). Combined with camera follow lerp=0.08 and deadzone 40x30, the effect is practically invisible during normal gameplay where direction changes happen every 0.5-2s."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "Lines 572-595 (look-ahead with slow OFFSET_LERP=0.04), line 1241 (camera follow lerp=0.08), line 1242 (deadzone 40,30)"
  missing:
    - "Increase OFFSET_LERP from 0.04 to 0.12-0.15"
    - "Increase camera follow lerp from 0.08 to 0.12-0.15"
    - "Reduce deadzone from 40x30 to 20x15"
  debug_session: ".planning/debug/camera-look-ahead-broken.md"

- truth: "Match start overview shows full arena then zooms to player reliably"
  status: failed
  reason: "User reported: This is very flakey, this happens a few time. But mostly nothing happens. When it doesnt happen, the camera doesnt follow the player. Might be a race condition somewhere."
  severity: major
  test: 12
  root_cause: "Same root cause as test 7: mapMetadata race condition causes startMatchOverview() to silently return for the last player to join. The overview animation is the ONLY code path that sets up camera follow."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "Line 1222 (if !this.mapMetadata return) silently skips overview + camera follow setup"
  missing:
    - "Fix is shared with test 7 -- defer startMatchOverview until mapMetadata available"
  debug_session: ".planning/debug/camera-follow-flaky.md"

- truth: "HUD elements display at correct positions with no overlap"
  status: failed
  reason: "User reported: player name covers the cooldown bar"
  severity: cosmetic
  test: 14
  root_cause: "Cooldown bar at H*0.92 (Y=662) and player name label at Y=666 occupy same vertical range (3px separation). Layout.hud constants exist with correct spacing but HUDScene doesn't use them."
  artifacts:
    - path: "client/src/scenes/HUDScene.ts"
      issue: "Line 242 (healthBar Y=H*0.95), line 268 (name label Y), line 474 (cooldown Y=H*0.92)"
    - path: "client/src/ui/designTokens.ts"
      issue: "Lines 315-322 (Layout.hud constants exist but unused)"
  missing:
    - "Move cooldown bar higher (H*0.895 or ~Y=644) to clear name label"
  debug_session: ".planning/debug/name-covers-cooldown-bar.md"

- truth: "Lobby scene elements render without overlap at 1280x720"
  status: failed
  reason: "User reported: Yes, but there is overlapp of elements. Room Code and Select Character text overlap, character panels overlap with Select Character text at the top."
  severity: cosmetic
  test: 15
  root_cause: "panelY = titleY + 70 creates 9px overlap between title text bottom edge and panel top edge (130px tall panels extend 65px above panelY)."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Line 698 (Room Code Y=45), lines 821-822 (titleY), line 829 (panelY=titleY+70), line 843 (160x130 panels)"
  missing:
    - "Increase panelY offset from titleY+70 to titleY+100-110"
    - "Push Players title and subsequent elements down accordingly"
  debug_session: ".planning/debug/lobby-elements-overlap-1280x720.md"

- truth: "Help screen shows role panels with proper layout and no overlap at 1280x720"
  status: failed
  reason: "User reported: Alot of overlap. use the game-design skill to fix the design of this page - no need to show so much details and stats - only high level description in a playful manner"
  severity: major
  test: 17
  root_cause: "Too many elements crammed into 270x270 panels. Paran has 8 detail lines nearly overflowing panel. Raw HP/Dmg/Fire stats exposed. Technical developer language instead of player-friendly descriptions."
  artifacts:
    - path: "client/src/scenes/HelpScene.ts"
      issue: "Lines 63-169 (role panels with stats at lines 73/89/102, technical descriptions at lines 74-83/90-96/103-109)"
  missing:
    - "Remove all stats lines (HP/Dmg/Fire)"
    - "Replace technical descriptions with 2-3 playful high-level lines per role"
    - "Use game-design skill for solarpunk-appropriate playful copy"
  debug_session: ".planning/debug/help-screen-overlap-redesign.md"

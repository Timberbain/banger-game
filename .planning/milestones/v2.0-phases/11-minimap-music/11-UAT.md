---
status: resolved
phase: 11-minimap-music
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md
started: 2026-02-19T10:00:00Z
updated: 2026-02-19T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Minimap Visibility & Layout
expected: During gameplay, a semi-transparent minimap appears in the top-right corner showing the arena wall layout. Ping and kill feed are positioned below the minimap with no overlap.
result: issue
reported: "Minimap shows as expected. However the text in the kill feed label below can overflow its background color - expected the label background to adjust to the text size."
severity: cosmetic

### 2. Minimap Player Dots
expected: Player positions appear on the minimap as small colored dots that move in real-time. Each role has a distinct color (Paran, Faran, Baran use different colors).
result: pass

### 3. Minimap Toggle (M Key)
expected: Pressing M hides the minimap with a sound effect. Pressing M again shows it. The toggle preference persists across stages within a match.
result: pass

### 4. Minimap During Overview Camera
expected: When the match starts and the overview camera pans across the arena, the minimap is hidden. It reappears once the overview ends and normal gameplay begins.
result: pass

### 5. Lobby Music Loop
expected: When entering the lobby, background music starts playing on loop. If you stay in the lobby, the track loops seamlessly with a brief pause between repetitions.
result: pass

### 6. Volume Sliders
expected: In the lobby, volume controls are displayed as draggable sliders (not +/- buttons). Dragging or clicking the slider changes volume in real-time with audible feedback.
result: pass

### 7. Lobby-to-Stage Music Crossfade
expected: When a match starts and transitions from lobby to gameplay, the lobby music fades out while a stage music track fades in smoothly. No jarring silence gap or abrupt cut.
result: pass

### 8. WAV Sound Effects
expected: During gameplay, sound effects use WAV audio (richer, more realistic sounds) instead of synthesized beeps. Guardian shooting, taking damage, and player death should all sound noticeably different from the old jsfxr tones.
result: issue
reported: "Multiple laser sounds playing simultaneously for guardians - should only play one at a time, randomized per shot. Paran power shot plays shooting SFX during cooldown. Regular shooting sound also slightly desynced from cooldown. Hurt sounds not randomized - should randomize which hurt sound plays."
severity: major

### 9. Inter-Stage Volume Dip
expected: Between stages in a best-of-3 match, the music volume dips noticeably during the stage end and transition screens, then restores to normal volume when the next stage begins.
result: pass

### 10. Victory/Defeat Music
expected: When a match ends, an appropriate result track plays (victory for the winning side, defeat for losers). Firework sound effects play on the victory screen with timed bursts.
result: pass

### 11. Return to Lobby Audio
expected: After the victory screen, when returning to the lobby, the result music fades out smoothly and the lobby music loop resumes. No silence gap or double-playing music.
result: issue
reported: "The lobby music does not start playing when transitioning from victory screen."
severity: major

## Summary

total: 11
passed: 8
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Kill feed label background adjusts to fit text width with no overflow"
  status: resolved
  reason: "User reported: Minimap shows as expected. However the text in the kill feed label below can overflow its background color - expected the label background to adjust to the text size."
  severity: cosmetic
  test: 1
  root_cause: "Kill feed background rectangle hardcoded to 180px width in addKillFeedEntry (HUDScene.ts ~line 523). Text width varies with content but background never resizes."
  artifacts:
    - path: "client/src/scenes/HUDScene.ts"
      issue: "Background rectangle width hardcoded to 180px, never adjusted to text.displayWidth"
  missing:
    - "Measure text.displayWidth after creation and resize background rectangle to match + padding"
  debug_session: ""

- truth: "WAV SFX play correctly: one laser per shot (randomized), shoot SFX only when not on cooldown, hurt sounds randomized"
  status: resolved
  reason: "User reported: Multiple laser sounds playing simultaneously for guardians - should only play one at a time, randomized per shot. Paran power shot plays shooting SFX during cooldown. Regular shooting sound also slightly desynced from cooldown. Hurt sounds not randomized - should randomize which hurt sound plays."
  severity: major
  test: 8
  root_cause: "Dual SFX triggers: input handler (~line 929) plays laser SFX optimistically AND createProjectileSprite (~line 1255) plays again on server confirmation. Both fire same frame. Shoot SFX desynced because client-side cooldown timing doesn't match server. Hurt sounds may already be randomized in code but WAV files may sound too similar."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "Shooting SFX triggered both in input handler and in createProjectileSprite for local player"
    - path: "client/src/scenes/GameScene.ts"
      issue: "Client-side cooldown check allows SFX when server hasn't actually fired"
  missing:
    - "Remove shoot SFX from input handler, move all shooting SFX to createProjectileSprite (server-confirmed)"
    - "Guard local player SFX in createProjectileSprite to play only once per projectile"
    - "Verify hurt_1-4 WAV files are registered and audibly distinct"
  debug_session: ""

- truth: "Lobby music resumes after returning from victory screen"
  status: resolved
  reason: "User reported: The lobby music does not start playing when transitioning from victory screen."
  severity: major
  test: 11
  root_cause: "Race condition: VictoryScene calls fadeOutMusic(500) then immediately calls returnToLobby(). LobbyScene.create() runs while fade is still in progress. isPlayingMusic() returns true (music still fading), so lobby music startup is skipped. By the time fade completes and nulls currentMusic, LobbyScene.create() has already passed."
  artifacts:
    - path: "client/src/scenes/VictoryScene.ts"
      issue: "returnToLobby() called immediately after fadeOutMusic() without waiting for fade completion"
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Music check in create() runs before fade completes"
  missing:
    - "Use fadeOutMusic onComplete callback to delay scene transition until fade finishes"
  debug_session: ""

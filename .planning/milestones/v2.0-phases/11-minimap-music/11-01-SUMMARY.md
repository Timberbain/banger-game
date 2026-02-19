---
phase: 11-minimap-music
plan: 01
subsystem: audio
tags: [audio, wav, mp3, crossfade, sfx, music, audiomanager]

# Dependency graph
requires:
  - phase: 06-ux-polish
    provides: "Base AudioManager with jsfxr SFX, WAV registration, and music playback"
provides:
  - "AudioManager crossfade, fade-out, loop-with-pause, volume dip, WAV randomization methods"
  - "22 WAV SFX files served from client/public/soundeffects/"
  - "6 MP3 music tracks served from client/public/audio/"
  - "17 WAV SFX keys registered in BootScene"
affects: [11-03-integration, game-scenes, stage-transitions, victory-screen]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fadeVolume helper with setInterval for linear volume ramping", "volumeDipFactor pattern for temporary volume reduction with slider awareness"]

key-files:
  created:
    - "client/public/audio/lobby/Pixel Jitter Jive.mp3"
    - "client/public/audio/stage/Forest Deco Run.mp3"
    - "client/public/audio/stage/Art Deco Forest Arena.mp3"
    - "client/public/audio/stage/Per Ropar Glas (Remastered v2).mp3"
    - "client/public/audio/gameover/victory.mp3"
    - "client/public/audio/gameover/defeat.mp3"
    - "client/public/soundeffects/ (16 new WAV files)"
  modified:
    - "client/src/systems/AudioManager.ts"
    - "client/src/scenes/BootScene.ts"

key-decisions:
  - "fadeVolume uses 50ms setInterval steps for smooth linear volume ramping"
  - "volumeDipFactor field integrates with setMusicVolume to respect slider changes during dip"
  - "crossfadeTo respects active volumeDipFactor for target volume calculation"

patterns-established:
  - "Volume dip pattern: dipMusicVolume/restoreMusicVolume with factor stored for setMusicVolume awareness"
  - "Stale guard in playMusicWithPause: ended callback checks currentMusic identity before restarting"

requirements-completed: [AUD-01, AUD-02, AUD-03]

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 11 Plan 01: Audio Infrastructure Summary

**AudioManager extended with 7 new methods (crossfade, fade-out, loop-with-pause, volume dip, WAV randomization) and 28 audio assets (22 WAV + 6 MP3) copied and registered**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-18T21:09:10Z
- **Completed:** 2026-02-18T21:14:10Z
- **Tasks:** 2
- **Files modified:** 24 (2 source files + 22 audio assets)

## Accomplishments
- Extended AudioManager with crossfadeTo, fadeOutMusic, playMusicWithPause, dipMusicVolume, restoreMusicVolume, playRandomWAV, and playMultipleWAV methods
- Copied 6 MP3 music tracks to client/public/audio/ (lobby, stage, gameover subdirectories)
- Copied 16 WAV SFX files to client/public/soundeffects/
- Registered all 17 WAV keys (16 new + 1 existing) in BootScene for use across game scenes

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy audio assets and extend AudioManager** - `2358973` (feat)
2. **Task 2: Register all WAV SFX in BootScene** - `90adb9e` (feat)

## Files Created/Modified
- `client/src/systems/AudioManager.ts` - 7 new public methods + fadeVolume helper + volumeDipFactor field
- `client/src/scenes/BootScene.ts` - 16 new registerWAV calls for all WAV SFX
- `client/public/audio/lobby/Pixel Jitter Jive.mp3` - Lobby background music
- `client/public/audio/stage/Forest Deco Run.mp3` - Stage music track 1
- `client/public/audio/stage/Art Deco Forest Arena.mp3` - Stage music track 2
- `client/public/audio/stage/Per Ropar Glas (Remastered v2).mp3` - Stage music track 3
- `client/public/audio/gameover/victory.mp3` - Victory music sting
- `client/public/audio/gameover/defeat.mp3` - Defeat music sting
- `client/public/soundeffects/` - 16 new WAV files (hurt_1-4, laser_1/4/5, earthquake, lightning, disappear, select_1/2, lose_1, fire_1/2/3)

## Decisions Made
- fadeVolume uses 50ms setInterval steps for smooth linear volume ramping (good balance between smoothness and CPU)
- volumeDipFactor integrates with setMusicVolume so slider changes during a dip still respect the dip factor
- crossfadeTo respects active volumeDipFactor when calculating target volume for new track
- playMusicWithPause uses stale guard (currentMusic identity check) to prevent restarting if track was changed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All audio infrastructure methods ready for Plan 03 (scene integration)
- All 17 WAV SFX keys available for use in GameScene, LobbyScene, VictoryScene, etc.
- Music tracks ready for lobby, stage, and gameover playback with crossfade support
- Plan 02 (minimap) can proceed independently

## Self-Check: PASSED

All key files verified present. Both task commits (2358973, 90adb9e) confirmed in git log.

---
*Phase: 11-minimap-music*
*Completed: 2026-02-18*

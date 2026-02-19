---
phase: 11-minimap-music
plan: 04
subsystem: audio, ui
tags: [sfx, kill-feed, phaser, audio-manager, wav]

# Dependency graph
requires:
  - phase: 11-minimap-music/03
    provides: "WAV SFX integration, stage music crossfade, victory/defeat audio"
provides:
  - "Dynamic-width kill feed backgrounds sized to text content"
  - "Exclusive WAV playback (stopAndPlayWAV) for non-overlapping rapid-fire SFX"
  - "Server-confirmed shoot SFX timing (moved from input handler to projectile creation)"
  - "Lobby music restart after victory screen via fadeOutMusic callback"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "stopAndPlayWAV for exclusive single-instance WAV playback (reuses source element, resets currentTime)"
    - "Server-confirmed SFX: play audio in createProjectileSprite instead of input handler for accurate timing"
    - "fadeOutMusic callback pattern: delay scene transition until audio fade completes"

key-files:
  created: []
  modified:
    - client/src/scenes/HUDScene.ts
    - client/src/scenes/VictoryScene.ts
    - client/src/systems/AudioManager.ts
    - client/src/scenes/GameScene.ts

key-decisions:
  - "Text-first kill feed: create text object before background to measure displayWidth for dynamic sizing"
  - "stopAndPlayWAV reuses source HTMLAudioElement (currentTime=0) instead of cloning for exclusive playback"
  - "All shoot SFX moved to createProjectileSprite (server-confirmed) to eliminate cooldown desync"
  - "fadeOutMusic callback gates returnToLobby so isPlayingMusic() returns false before LobbyScene.create()"

patterns-established:
  - "stopAndPlayWAV/stopAndPlayRandomWAV: use for rapid-fire sounds that must not overlap"
  - "Server-confirmed SFX timing: tie audio to server state changes, not client input predictions"

requirements-completed: [MMAP-01, AUD-01, AUD-02, AUD-03]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 11 Plan 04: UAT Gap Closure Summary

**Dynamic kill feed backgrounds, exclusive laser SFX playback, server-confirmed shoot timing, and lobby music restart via fadeOutMusic callback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T10:09:28Z
- **Completed:** 2026-02-19T10:11:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Kill feed background auto-sizes to text content width with 16px padding (no more overflow)
- Guardian laser SFX plays one sound at a time via stopAndPlayWAV (previous instance stopped before new plays)
- All shoot SFX moved from client-side input handler to server-confirmed projectile creation
- Lobby music properly restarts after victory screen because scene transition waits for fade completion

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix kill feed background overflow and lobby music restart** - `48e2a0c` (fix)
2. **Task 2: Fix overlapping guardian laser SFX** - `ec4e8fe` (fix)

## Files Created/Modified
- `client/src/scenes/HUDScene.ts` - Kill feed background now dynamically sized from text.displayWidth
- `client/src/scenes/VictoryScene.ts` - returnToLobby delayed until fadeOutMusic callback fires
- `client/src/systems/AudioManager.ts` - Added stopAndPlayWAV and stopAndPlayRandomWAV methods
- `client/src/scenes/GameScene.ts` - Removed shoot SFX from input handler, moved to createProjectileSprite with exclusive playback

## Decisions Made
- Text-first kill feed: create text object before background rectangle to measure displayWidth for dynamic sizing
- stopAndPlayWAV reuses the registered HTMLAudioElement (resets currentTime to 0) instead of cloning, ensuring only one instance plays
- All shoot SFX moved from input handler to createProjectileSprite for server-confirmed timing, eliminating desync with server cooldown
- fadeOutMusic callback gates returnToLobby so isPlayingMusic() returns false before LobbyScene.create() runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 UAT gap issues from Phase 11 testing are now closed
- Phase 11 (Minimap & Music) fully complete including gap closure
- Ready for next phase or final UAT retest

## Self-Check: PASSED

- All 4 modified files exist on disk
- Commit `48e2a0c` (Task 1) verified in git log
- Commit `ec4e8fe` (Task 2) verified in git log
- TypeScript compiles without errors

---
*Phase: 11-minimap-music*
*Completed: 2026-02-19*

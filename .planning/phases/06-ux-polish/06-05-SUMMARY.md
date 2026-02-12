---
phase: 06-ux-polish
plan: 05
subsystem: audio, ui
tags: [jsfxr, procedural-sfx, chiptune, audio-manager, volume-controls, web-audio]

# Dependency graph
requires:
  - phase: 06-ux-polish
    provides: jsfxr dependency installed, Phaser config with pixelArt
provides:
  - Procedural chiptune SFX system with 16 sound effects via jsfxr
  - AudioManager singleton persisted across scenes via Phaser registry
  - Per-role combat sounds (shoot, hit, death for paran/faran/baran)
  - Movement sounds (wall impact, speed whoosh)
  - UI sounds (button click, countdown beep, ready chime, match fanfares)
  - Background music playback during matches
  - Volume controls with localStorage persistence
affects: [06-06 (help screen may reference audio controls), 06-07 (any final polish)]

# Tech tracking
tech-stack:
  added: []
  patterns: [jsfxr param objects for SFX generation, AudioManager on Phaser registry, health cache for damage detection]

key-files:
  created:
    - client/src/config/SoundDefs.ts
    - client/src/systems/AudioManager.ts
    - client/src/types/jsfxr.d.ts
    - client/public/audio/match_music.mp3
  modified:
    - client/src/scenes/BootScene.ts
    - client/src/scenes/GameScene.ts
    - client/src/scenes/LobbyScene.ts

key-decisions:
  - "jsfxr param objects (not arrays) for sound definitions -- matches jsfxr Params structure directly"
  - "HTMLAudioElement for music (not Phaser SoundManager) -- data URL compatibility per research pitfall #5"
  - "Health cache map for detecting damage/death via onChange delta comparison"
  - "Speed whoosh rate-limited to once per second to prevent audio spam"
  - "Velocity delta threshold (prevSpeed > 30, curSpeed < 1) for Paran wall impact detection"
  - "Simple +/- buttons for volume controls (not sliders) to minimize UI complexity"

patterns-established:
  - "AudioManager on registry: this.registry.set/get('audioManager') for cross-scene persistence"
  - "Sound key convention: {role}_{event} (e.g., paran_shoot, faran_hit, baran_death)"
  - "Null-safe audio calls: if (this.audioManager) this.audioManager.playSFX(key)"

# Metrics
duration: 5min
completed: 2026-02-12
---

# Phase 6 Plan 05: Audio System Summary

**Procedural chiptune SFX via jsfxr with 16 sound effects (9 combat per-role, 2 movement, 5 UI), AudioManager with volume controls, and full integration into GameScene and LobbyScene**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-12T15:24:34Z
- **Completed:** 2026-02-12T15:30:05Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 16 procedurally generated chiptune SFX covering all game events: per-role shoot/hit/death, wall impact, speed whoosh, button clicks, countdown, ready chime, match fanfares
- AudioManager with jsfxr generation at boot, volume controls persisted to localStorage, music playback
- Full integration: combat sounds on fire/damage/death, movement sounds on Paran wall collision and high speed, UI sounds on all button clicks and lobby events, background music during matches
- Volume controls (+/- buttons with percentage display) in main menu

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SoundDefs and AudioManager** - `7a0949b` (feat)
2. **Task 2: Integrate audio into game scenes** - `4b009a1` (feat)

## Files Created/Modified
- `client/src/config/SoundDefs.ts` - 16 jsfxr parameter objects for all procedural SFX
- `client/src/systems/AudioManager.ts` - Centralized audio with init, playSFX, playMusic, volume persistence
- `client/src/types/jsfxr.d.ts` - TypeScript declarations for jsfxr module
- `client/public/audio/match_music.mp3` - Match background music (copied from assets/soundtrack)
- `client/src/scenes/BootScene.ts` - AudioManager initialization and registry storage
- `client/src/scenes/GameScene.ts` - Combat/movement/match audio triggers with health tracking
- `client/src/scenes/LobbyScene.ts` - UI sounds on buttons, countdown, ready; volume controls

## Decisions Made
- Used jsfxr Params objects (named properties) rather than raw number arrays for readability and maintainability
- Health cache map (`playerHealthCache`) tracks previous health values to detect damage/death deltas from onChange callbacks
- Paran wall impact detected via client-side velocity delta (prevSpeed > 30 and curSpeed < 1) rather than server event
- Speed whoosh rate-limited to once per second via timestamp comparison to prevent audio spam at sustained high speed
- Simple +/- button volume controls chosen over sliders to minimize implementation complexity
- Music file copied to client/public/audio/ since Vite only serves files from public directory

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added jsfxr TypeScript declarations**
- **Found during:** Task 1 (AudioManager creation)
- **Issue:** jsfxr has no @types package; TypeScript cannot find declaration file
- **Fix:** Created `client/src/types/jsfxr.d.ts` with typed exports for sfxr API
- **Files modified:** client/src/types/jsfxr.d.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 7a0949b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor type declaration addition required for TypeScript compatibility. No scope change.

## Issues Encountered
None beyond the jsfxr type declaration documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete audio system ready for all game events
- Volume controls accessible from main menu
- Background music plays during matches
- All sounds can be tuned by adjusting SoundDefs parameter values
- AudioManager available on registry for any scene needing audio

## Self-Check: PASSED

- client/src/config/SoundDefs.ts: FOUND
- client/src/systems/AudioManager.ts: FOUND
- client/src/types/jsfxr.d.ts: FOUND
- client/public/audio/match_music.mp3: FOUND
- Commit 7a0949b: FOUND
- Commit 4b009a1: FOUND
- Client compiles: OK

---
*Phase: 06-ux-polish*
*Completed: 2026-02-12*

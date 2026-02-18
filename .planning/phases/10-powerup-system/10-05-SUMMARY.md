---
phase: 10-powerup-system
plan: 05
subsystem: gameplay, ui, audio
tags: [phaser, particles, wav-audio, powerups, aura, type-coercion]

# Dependency graph
requires:
  - phase: 10-powerup-system (plans 01-04)
    provides: "Server powerup spawning, buff system, client rendering foundation"
provides:
  - "5x longer buff durations for visible gameplay impact"
  - "WAV-based powerup pickup SFX via AudioManager.registerWAV/playWAVSFX"
  - "Enhanced buff aura particle visibility (2x frequency, higher alpha/scale)"
  - "32x32 ground powerup sprites with idle particle aura"
  - "Fixed guardian projectile aura via Number() type coercion"
affects: [future-audio-work, powerup-balance-tuning]

# Tech tracking
tech-stack:
  added: [HTMLAudioElement WAV playback pipeline]
  patterns: [WAV-over-jsfxr priority fallback in playSFX, Number() cast for Colyseus message type fields]

key-files:
  created:
    - client/public/soundeffects/powerup_1.wav
  modified:
    - shared/powerups.ts
    - client/src/systems/AudioManager.ts
    - client/src/systems/ParticleFactory.ts
    - client/src/scenes/BootScene.ts
    - client/src/scenes/GameScene.ts

key-decisions:
  - "WAV sounds take priority over jsfxr in playSFX via wavSounds check-first pattern"
  - "Idle aura tracked in separate powerupIdleEmitters map for independent lifecycle from buff auras"
  - "Number() cast on Colyseus message data.type prevents string/number enum mismatch in switch"

patterns-established:
  - "WAV registration: registerWAV in BootScene after init(), playSFX auto-routes to WAV if key matches"
  - "Idle aura lifecycle: create on onAdd, destroy on onRemove, clear on cleanupStageVisuals"

requirements-completed: [PWR-01, PWR-02, PWR-03, PWR-05]

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 10 Plan 05: Powerup UAT Gap Closure Summary

**32x32 ground powerups with idle particle aura, WAV pickup SFX, 5x buff durations, enhanced aura visibility, and guardian projectile aura type coercion fix**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T16:11:41Z
- **Completed:** 2026-02-18T16:16:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All 4 UAT gaps resolved in a single gap closure plan
- Buff durations multiplied 5x (speed 22.5s, invincibility 12.5s, projectile 27.5s) for meaningful gameplay impact
- WAV audio pipeline added to AudioManager with seamless fallback -- powerup pickup now uses provided WAV file
- All buff aura particles doubled in frequency with higher alpha/scale for clear visibility
- Ground powerup sprites enlarged to 32x32 with color-matched idle particle aura
- Guardian projectile aura rendering fixed via Number() cast on Colyseus message type field

## Task Commits

Each task was committed atomically:

1. **Task 1: Buff durations, WAV audio pipeline, and enhanced particle auras** - `816b51f` (feat)
2. **Task 2: GameScene powerup sprite size, idle aura tracking, and type coercion fix** - `219b3a1` (fix)

## Files Created/Modified
- `shared/powerups.ts` - 5x buff duration values (22500/12500/27500ms)
- `client/src/systems/AudioManager.ts` - WAV playback pipeline (registerWAV, playWAVSFX, playSFX fallback)
- `client/src/systems/ParticleFactory.ts` - Enhanced aura visibility + createPowerupIdleAura method
- `client/src/scenes/BootScene.ts` - WAV registration for powerup_pickup
- `client/src/scenes/GameScene.ts` - 32x32 sprites, idle aura lifecycle, Number() type coercion
- `client/public/soundeffects/powerup_1.wav` - Powerup pickup WAV asset

## Decisions Made
- WAV sounds take priority over jsfxr in playSFX via wavSounds check-first pattern -- allows overriding any jsfxr sound with a WAV by registering the same key
- Idle aura tracked in separate powerupIdleEmitters map for independent lifecycle from buff auras -- cleanup in onRemove and cleanupStageVisuals
- Number() cast on Colyseus message data.type prevents string/number enum mismatch -- Colyseus serializes enum values as strings in broadcast messages, but PowerupType switch cases expect numbers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 UAT gaps from Phase 10 powerup system resolved
- Phase 10 powerup system fully complete with all visual/audio/gameplay polish
- Ready for next phase or comprehensive re-UAT

## Self-Check: PASSED

All 6 modified/created files verified on disk. Both task commits (816b51f, 219b3a1) verified in git log.

---
*Phase: 10-powerup-system*
*Completed: 2026-02-18*

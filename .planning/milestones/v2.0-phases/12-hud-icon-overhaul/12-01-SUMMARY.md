---
phase: 12-hud-icon-overhaul
plan: 01
subsystem: ui
tags: [phaser, hud, icons, health-hearts, timer, round-score-pips, potion-colors]

# Dependency graph
requires:
  - phase: 06-ux-polish
    provides: HUD overlay system (HUDScene, designTokens, health bars, timer, kill feed)
  - phase: 10-powerup-system
    provides: Potion texture keys and buff indicator system
  - phase: 11-minimap-music
    provides: Minimap overlay and cross-scene event pattern
provides:
  - Heart icon health display for local player (10 HP per heart, flash+shrink damage animation)
  - Hourglass timer icon with synchronized low-time pulse
  - Colored pip round score display (replaces text-based score)
  - Updated potion color mapping (Red=Speed, Blue=Invincibility, Green=Projectile)
  - 6 new icon assets in client/public/icons/
affects: [12-hud-icon-overhaul plan 02, any future HUD changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Heart icon row centered at bottom with 10HP-per-heart scaling
    - Graphics-based pip rendering for round score
    - Timer icon + text paired layout with synchronized visibility and tinting

key-files:
  created:
    - client/public/icons/heart-full.png
    - client/public/icons/heart-empty.png
    - client/public/icons/timer.png
    - client/public/icons/skull.png
    - client/public/icons/gravestone.png
    - client/public/icons/potion-green.png
  modified:
    - client/src/scenes/BootScene.ts
    - client/src/scenes/HUDScene.ts

key-decisions:
  - "10 HP per heart icon (Paran=15 hearts, Guardians=5 hearts) for clear visual health feedback"
  - "Local player health only -- removed all non-local health bars from HUD for cleaner display"
  - "Graphics-based pip rendering instead of RenderTexture for round score (simpler, no texture management)"
  - "Potion color mapping: Red=Speed, Blue=Invincibility, Green=Projectile (consistent across all files)"

patterns-established:
  - "Heart icon array pattern: create N images, update by comparing texture key to determine transition direction"
  - "Paired icon+text layout: icon and text share visibility, tint, and alpha state"

requirements-completed: [HUD-01, HUD-02, HUD-04, HUD-06]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 12 Plan 01: Core HUD Icon Replacements Summary

**Heart-based health display with damage animation, hourglass timer icon, colored round score pips, and unified potion color mapping**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T12:55:26Z
- **Completed:** 2026-02-19T12:59:59Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Replaced rectangle health bars with heart icon row (local player only, 10 HP per heart with flash+shrink damage animation)
- Added hourglass icon to timer with synchronized red tint and alpha pulse on low-time warning
- Replaced text-based "0 - 0" round score with colored pip circles (paran gold / guardian red / gray empty)
- Updated potion color mapping consistently: Red=Speed, Blue=Invincibility, Green=Projectile
- Removed HealthBarUI interface, lowHealthFlashTimers, and all non-local player health display code

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy icon assets and update asset preloading + potion color mapping** - `7280ceb` (feat)
2. **Task 2: Replace health bars with heart icons, add timer icon, and implement round score pips** - `5da0fea` (feat)

## Files Created/Modified
- `client/public/icons/heart-full.png` - Full heart icon for health display
- `client/public/icons/heart-empty.png` - Empty heart icon for lost health
- `client/public/icons/timer.png` - Hourglass icon for match timer
- `client/public/icons/skull.png` - Skull icon (preloaded for plan 02)
- `client/public/icons/gravestone.png` - Gravestone icon (preloaded for plan 02)
- `client/public/icons/potion-green.png` - Green potion icon for projectile powerup
- `client/src/scenes/BootScene.ts` - Added 6 icon preloads, updated potion color mapping
- `client/src/scenes/HUDScene.ts` - Heart health display, timer icon, round score pips, removed old health bar code

## Decisions Made
- 10 HP per heart: Paran gets 15 hearts (150 HP), Guardians get 5 hearts (50 HP) -- provides clear at-a-glance health state
- Local player health only: removed all non-local health bars from HUD to reduce visual clutter
- Heart damage animation uses texture key comparison to detect transition direction (full->empty triggers tween)
- Round score uses Graphics.fillCircle for pips rather than Image objects -- simpler for small colored dots
- Separator between paran and guardian pips uses a thin white rectangle at 0.3 alpha

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All icon assets preloaded and available for plan 02 (skull, gravestone already loaded)
- HUDScene ready for kill feed icon enhancements (plan 02)
- Potion color mapping consistent across all scenes

## Self-Check: PASSED

All 9 files verified present. Both task commits (7280ceb, 5da0fea) verified in git log.

---
*Phase: 12-hud-icon-overhaul*
*Completed: 2026-02-19*

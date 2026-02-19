---
phase: 08-arena-overhaul
plan: 04
subsystem: gameplay
tags: [spawns, collision, maps, tiled, python]

# Dependency graph
requires:
  - phase: 08-arena-overhaul (plan 01-02)
    provides: "Generated arena maps with auto-tiled walls and obstacles"
provides:
  - "Per-map validated spawn coordinates in shared/maps.ts"
  - "Automatic spawn validation in generate-arenas.py"
affects: [gameplay, match-lifecycle, server-rooms]

# Tech tracking
tech-stack:
  added: []
  patterns: ["spawn validation via tile buffer check in map generation pipeline"]

key-files:
  created: []
  modified:
    - shared/maps.ts
    - scripts/generate-arenas.py

key-decisions:
  - "Spawn buffer of 1 tile (3x3 clear area) sufficient for player radius clearance"
  - "Spawn regions: paran center (tiles 16-33, 12-25), faran top-left (3-20, 3-15), baran bottom-right (30-46, 23-34)"

patterns-established:
  - "Spawn validation: validate_spawns() runs automatically after map generation to catch regressions"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 8 Plan 4: Spawn Position Fix Summary

**Per-map validated spawn coordinates replacing shared hardcoded positions, with automatic spawn validation in map generation pipeline**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T09:09:58Z
- **Completed:** 2026-02-14T09:11:37Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Replaced shared hardcoded spawn points (800,608 / 200,200 / 1400,1016) with unique per-map coordinates validated against actual tile data
- Added find_safe_spawn() region search and validate_spawns() verification to generate-arenas.py
- All 9 spawn-map combinations verified safe with 1-tile buffer of empty ground
- Confirmed old spawns were BLOCKED on 8 of 9 map-spawn combinations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add spawn validation and update per-map spawns** - `a367139` (feat)

## Files Created/Modified
- `shared/maps.ts` - Updated each map entry with unique validated spawn coordinates (hedge_garden, brick_fortress, timber_yard)
- `scripts/generate-arenas.py` - Added find_safe_spawn(), validate_spawns(), and _is_solid_for_spawn() functions; integrated validation into main pipeline

## Decisions Made
- Spawn coordinates pre-validated against actual generated map data before hardcoding into maps.ts
- 1-tile buffer check ensures player hitbox (radius-based) never overlaps adjacent solid tiles
- Paran spawns center-area, faran top-left quadrant, baran bottom-right quadrant for asymmetric separation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Spawn positions are now safe on all maps; players will never spawn inside walls or obstacles
- The validate_spawns() function will catch regressions if map layouts change in future
- Ready for Phase 9 (Multi-Stage Rounds) or further arena iteration

## Self-Check: PASSED

- FOUND: shared/maps.ts
- FOUND: scripts/generate-arenas.py
- FOUND: 08-04-SUMMARY.md
- FOUND: commit a367139

---
*Phase: 08-arena-overhaul*
*Completed: 2026-02-14*

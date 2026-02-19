---
status: diagnosed
trigger: "players spawn inside walls on new Phase 8 arenas"
created: 2026-02-14T12:00:00Z
updated: 2026-02-14T12:00:00Z
---

## Current Focus

hypothesis: All 3 maps use identical hardcoded spawn points that were chosen without checking the generated layouts - obstacles placed by layout functions overlap spawn coordinates
test: Convert pixel spawn coords to tile coords, check Walls layer tile data at those positions
expecting: Spawn tiles should be empty (0) but may be solid (walls/obstacles)
next_action: Report findings - root cause confirmed

## Symptoms

expected: Players spawn in open ground, free to move immediately
actual: Players spawn inside/overlapping wall and obstacle tiles
errors: N/A - no crash, but players are stuck or immediately colliding
reproduction: Start any match on hedge_garden, brick_fortress, or timber_yard
started: Phase 8 arena introduction

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-14T12:00:00Z
  checked: shared/maps.ts spawn point definitions
  found: All 3 maps use IDENTICAL spawn points - paran(800,608), faran(200,200), baran(1400,1016)
  implication: Spawn points were not tailored to each map's unique layout

- timestamp: 2026-02-14T12:00:01Z
  checked: scripts/generate-arenas.py layout functions
  found: Each layout places obstacles in different positions but spawns are hardcoded in maps.ts
  implication: No coordination between layout generation and spawn placement

- timestamp: 2026-02-14T12:00:02Z
  checked: hedge_garden Walls layer at spawn positions
  found: FARAN(200,200)->tile(6,6)=HEAVY_OBS(101), all 4 AABB tiles are HEAVY. BARAN(1400,1016)->tile(43,31)=HEAVY_OBS(101), all 4 AABB tiles HEAVY. PARAN(800,608)->tile(25,19) center OK but AABB overlaps LIGHT_OBS(103) at tile(24,19)
  implication: Both guardian spawns directly inside heavy obstacle clusters, paran touching light obstacle

- timestamp: 2026-02-14T12:00:03Z
  checked: brick_fortress Walls layer at spawn positions
  found: PARAN center clear. FARAN(6,6) center clear but AABB overlaps MEDIUM_OBS(102) at tiles (5,5) and (6,5). BARAN(43,31) center clear but AABB overlaps MEDIUM_OBS(102) at tiles (43,32) and (44,32)
  implication: Guardian spawn centers shifted 1 tile from obstacles but player radius still overlaps

- timestamp: 2026-02-14T12:00:04Z
  checked: timber_yard Walls layer at spawn positions
  found: PARAN center clear. FARAN(6,6)=MEDIUM_OBS(102) directly, all 4 AABB tiles solid. BARAN(43,31)=MEDIUM_OBS(102) directly, all 4 AABB tiles solid
  implication: Guardian spawns land squarely inside medium obstacle clusters

## Resolution

root_cause: The 3 Phase 8 maps share identical hardcoded spawn points in shared/maps.ts that were not validated against each map's generated layout. The generate-arenas.py script places obstacles (heavy/medium/light) at tile positions that overlap or are adjacent to the spawn coordinates. 8 out of 9 spawn-map combinations have collisions.
fix: (not applied - diagnose only)
verification: (not applicable)
files_changed: []

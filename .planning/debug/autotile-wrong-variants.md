---
status: diagnosed
trigger: "Wall tiles not using correct auto-tile variants. Edge/corner tiles in middle of wall sections, disconnected patterns, mismatched selections."
created: 2026-02-14T00:00:00Z
updated: 2026-02-14T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Rule ordering bug in tileset_reference.json causes ~235 tiles across 3 maps to use wrong sprite variant
test: Traced full auto-tile pipeline; verified with pixel analysis and map data
expecting: N/A - root cause confirmed
next_action: Report findings

## Symptoms

expected: Wall tiles use correct auto-tile variants matching their neighbor configuration (edges on edges, middles in middles, corners on corners)
actual: Edge/corner tiles appearing in middle of wall sections, disconnected patterns on obstacles, mismatched tile selections
errors: Visual only - no runtime errors
reproduction: Load any map - visible in all three themes (hedge, brick, wood)
started: Current state of auto-tile generation

## Eliminated

- hypothesis: Composite tileset generation maps sprites to wrong positions
  evidence: Tile ID N maps to composite position col=(N-1)%8, row=(N-1)//8 which matches Phaser's standard tilemap rendering exactly
  timestamp: 2026-02-14T00:00:20Z

- hypothesis: Client rendering (GameScene.ts) loads tileset incorrectly
  evidence: createTilemap uses standard Phaser tilemap API with firstgid=1, columns=8; no custom tile remapping
  timestamp: 2026-02-14T00:00:20Z

- hypothesis: Sprite labels in tileset_reference.json cause wrong sprite index selection
  evidence: Pixel analysis proved sprite 16 (labeled right_edge) is visually a left edge; sprite 38 (labeled corner) is visually a right edge. But rule constraints correctly map to the visual sprites - labels are wrong, mapping is correct
  timestamp: 2026-02-14T00:00:40Z

- hypothesis: Missing auto-tile rules cause tiles to fall through to default isolated sprite
  evidence: Only 1 tile in brick_fortress falls to default; all other wall tiles match some rule. 18/256 possible states unmatched but only 2 have 2+ cardinal neighbors
  timestamp: 2026-02-14T00:00:50Z

## Evidence

- timestamp: 2026-02-14T00:00:10Z
  checked: generate-arenas.py resolve_autotile function
  found: Uses first-match-wins rule evaluation from tileset_reference.json autoTileRules array
  implication: Rule ordering determines which sprite is selected when multiple rules match

- timestamp: 2026-02-14T00:00:20Z
  checked: All 46 auto-tile rules for subset relationships
  found: Rule 1 (spriteIndex=2, 5 constraints) is a strict subset of Rule 4 (spriteIndex=5, 6 constraints). Rule 1 matches everything Rule 4 matches plus more cases.
  implication: Rule 4 (top_edge_both_inners) is completely shadowed by Rule 1 (top_edge_se_inner) and NEVER executes

- timestamp: 2026-02-14T00:00:30Z
  checked: Pixel difference between sprite 2 and sprite 5
  found: 41 different pixels (8.4%) concentrated in bottom-left of front face. Sprite 2 has visible SW inner corner notch; sprite 5 has smooth edge
  implication: Tiles that should show smooth wall continuation instead show a corner notch artifact

- timestamp: 2026-02-14T00:00:40Z
  checked: Impact across all 3 maps
  found: hedge_garden=79 tiles (26.3%), brick_fortress=84 tiles (22.8%), timber_yard=72 tiles (22.4%)
  implication: ~235 wall tiles total (~470 including front faces) display wrong variant. This affects roughly 23% of all wall tiles.

- timestamp: 2026-02-14T00:00:50Z
  checked: All edge rule categories (top/bottom/left/right) for similar issues
  found: Top edge has shadowing bug. Bottom edge has 2 missing rules for NE-only-inner configurations. Left and right edges are correct.
  implication: Top edge is primary issue; bottom edge has minor gap affecting 1 tile in brick_fortress

## Resolution

root_cause: Rule ordering bug in tileset_reference.json autoTileRules array. Rule 1 (ruleId=1, spriteIndex=2, top_edge_se_inner) has 5 constraints that are a strict subset of Rule 4 (ruleId=4, spriteIndex=5, top_edge_both_inners) which has 6 constraints. Since resolve_autotile() uses first-match-wins, Rule 4 never executes. ~235 wall tiles across all 3 maps (~23% of walls) get sprite 2 (with visible SW corner notch) instead of sprite 5 (smooth both-inners variant).
fix:
verification:
files_changed: []

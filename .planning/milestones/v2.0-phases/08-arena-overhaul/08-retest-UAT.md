---
status: diagnosed
phase: 08-arena-overhaul
source: 08-03-SUMMARY.md, 08-04-SUMMARY.md
started: 2026-02-14T10:30:00Z
updated: 2026-02-14T10:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Wall & Obstacle Collision (Retest)
expected: Walk into walls and obstacles on any arena. Your character should be blocked cleanly — no invisible collisions, no jumping/teleporting, no clipping through walls. Movement should feel smooth with no rubber-banding. This was previously a blocker: collision desync from wrong arena bounds in PredictionSystem.
result: pass

### 2. Spawn Positions (Retest)
expected: Start matches on each arena. Players should spawn in open areas — never inside or adjacent to walls/obstacles. Paran spawns near center, guardians spawn in opposite corners. On timber_yard specifically (where the previous issue was reported), spawns should be clearly in open ground.
result: pass

### 3. Tileset Rendering Quality
expected: Arenas render with themed wall tiles using the reference tilesets (assets/tilesets/walls/). Walls should appear with pseudo-3D perspective and auto-tiling (smooth edges, no disconnected tile patterns). Ground, walls, and decorations form a cohesive visual.
result: issue
reported: "There are still some tiles that arent used correctly. Screenshots show wall sections with wrong auto-tile variants — edge/corner tiles appearing in wall middles, disconnected patterns on obstacles, and mismatched tile selections for adjacent wall configurations."
severity: major

### 4. Client Prediction Across Full Arena
expected: Move rapidly across the full 1600x1216 arena, including edges and corners. Position should stay consistent — no snapping, teleporting, or sudden corrections. The larger arena should feel seamless from edge to edge.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Walls render with correct auto-tile variants — smooth edges, proper corner/edge selection, no disconnected patterns"
  status: failed
  reason: "User reported: Some tiles aren't used correctly. Wall sections show wrong auto-tile variants — edge/corner tiles in wall middles, disconnected patterns on obstacles, mismatched tile selections."
  severity: major
  test: 3
  root_cause: "Rule ordering bug in tileset_reference.json — Rule 1 (5 constraints, no SW) shadows Rule 4 (6 constraints, requires SW:true) due to first-match-wins semantics. ~235 wall tiles across 3 maps (~23%) get wrong variant. Secondary: missing bottom-edge rule for NW-false case."
  artifacts:
    - path: "assets/tilesets/walls/tileset_reference.json"
      issue: "Rule 1 (ruleId=1) is less specific than Rule 4 (ruleId=4) but comes first — strict subset shadowing"
    - path: "scripts/generate-arenas.py"
      issue: "resolve_autotile uses first-match-wins (correct behavior, input data is wrong)"
    - path: "client/public/maps/*.json"
      issue: "Output maps contain wrong tile IDs, need regeneration after rule fix"
  missing:
    - "Add SW:false to Rule 1 in tileset_reference.json to disambiguate from Rule 4"
    - "Add missing bottom-edge rule for NE-only-inner case"
    - "Re-run generate-arenas.py to regenerate all 3 maps"
  debug_session: ".planning/debug/autotile-wrong-variants.md"

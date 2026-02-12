---
status: diagnosed
trigger: "AABB tile collision works on LEFT/TOP but breaks on RIGHT/BOTTOM walls - super speed, jitter, clipping"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Math.floor boundary asymmetry causes right/bottom push-back positions to still overlap the solid tile on the next AABB scan
test: Arithmetic trace of all 4 directions
expecting: Left/top push-back clears the solid tile, right/bottom push-back still overlaps
next_action: Return diagnosis

## Symptoms

expected: Collision resolution works symmetrically - player stops cleanly against walls in all 4 directions
actual: LEFT and TOP walls work correctly; RIGHT and BOTTOM walls cause super speed, jitter, and wall clipping. Pressing up while against right wall causes stuck behavior.
errors: No error messages - behavioral bug
reproduction: Move character into right or bottom wall, then change direction
started: Since collision system was implemented (Phase 05.1)

## Eliminated

## Evidence

- timestamp: 2026-02-12T00:01:00Z
  checked: resolveCollisions push-back for LEFT direction
  found: Push to (tx+1)*tileSize + radius. Entity right edge = (tx+1)*tileSize. Math.floor maps to tile tx+1 (empty). Clean.
  implication: Left collision resolution is correct

- timestamp: 2026-02-12T00:02:00Z
  checked: resolveCollisions push-back for RIGHT direction
  found: Push to tx*tileSize - radius. Entity right edge = tx*tileSize exactly. Math.floor(tx*tileSize/tileSize) = tx (the solid tile). Perpetual re-collision.
  implication: Right collision is broken -- entity AABB still overlaps solid tile after push-back

- timestamp: 2026-02-12T00:03:00Z
  checked: Same analysis for UP (correct) vs DOWN (broken) -- identical asymmetry pattern
  found: UP pushes to (ty+1)*tileSize + radius, bottom edge at ty+1 tile (empty). DOWN pushes to ty*tileSize - radius, bottom edge at ty tile (solid).
  implication: Both right and down suffer the same Math.floor boundary bug

- timestamp: 2026-02-12T00:04:00Z
  checked: What happens on re-collision when entity.x == prevX (no movement in that axis)
  found: Neither entity.x > prevX nor entity.x < prevX is true, so no push-back is applied. hitX=true but position unchanged. Velocity zeroed.
  implication: Explains "stuck" symptom -- entity against right/bottom wall has perpetual hitX/hitY with no escape, zeroing velocity every frame

- timestamp: 2026-02-12T00:05:00Z
  checked: Impact on client prediction reconciliation
  found: Client false-positive collision disagrees with server when positions diverge by floating point epsilon. Reconciliation replays oscillate between collision/no-collision.
  implication: Explains "super speed" and "jitter" -- entity position oscillates during reconciliation replay

## Resolution

root_cause: Math.floor boundary asymmetry in resolveCollisions AABB tile range calculation. After push-back from RIGHT/DOWN solid tiles, the entity edge lands exactly on a tile boundary (e.g., entity.x + radius = tx * tileSize). Math.floor of an exact integer N maps to tile N (the solid tile), not tile N-1 (the empty tile). This causes perpetual re-collision on subsequent frames. For LEFT/UP, the push-back places the entity edge at (tx+1)*tileSize, and Math.floor maps this to tile tx+1 (the empty tile beyond the wall), so no re-collision.

fix:
verification:
files_changed: []

---
status: diagnosed
trigger: "Investigate why the player name covers the cooldown bar in the HUD"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Player name label and cooldown bar occupy the same vertical pixel range
test: Computed exact pixel Y coordinates from code
expecting: Overlap confirmed
next_action: Return diagnosis

## Symptoms

expected: Player name text and cooldown bar are visually separate
actual: Player name text overlaps/covers the cooldown indicator bar
errors: none (visual positioning issue)
reproduction: Start a match, observe HUD bottom area
started: Since HUD conversion to viewport-relative positioning

## Eliminated

## Evidence

- timestamp: 2026-02-13T00:00:30Z
  checked: rebuildHealthBars() lines 242-276
  found: barY = H*0.95 = 684. Local player barH=16. Label at Y = 684 - 8 - 10 = 666, origin(0.5,1) so text bottom=666, text top ~649 (13px font + stroke).
  implication: Name label occupies approximately Y=649 to Y=666

- timestamp: 2026-02-13T00:00:45Z
  checked: createCooldownDisplay() lines 471-485
  found: Cooldown bar at Y = H*0.92 = 662.4, height=6px, centered. Spans Y=659.4 to Y=665.4
  implication: Cooldown bar sits at Y=659-665, directly inside the name label range Y=649-666

- timestamp: 2026-02-13T00:01:00Z
  checked: Layout.hud constants in designTokens.ts lines 315-322
  found: Layout.hud defines cooldown.y=680, healthBarY=695 with 15px gap. But HUDScene.ts does NOT use Layout.hud at all (zero references). Uses H*0.92 and H*0.95 instead.
  implication: Design tokens have correct stacked positions but code ignores them. Using Layout constants would fix the spacing.

## Resolution

root_cause: Cooldown bar (Y=662, H*0.92) sits inside the player name label (Y=649-666) because only 3.6px separates the cooldown bar bottom edge from the name label bottom edge. The cooldown bar center is 4px above the name label bottom. Both elements share the Y=659-665 vertical range. Additionally, HUDScene ignores the Layout.hud constants from designTokens.ts which define properly-spaced positions (cooldown.y=680, healthBarY=695).
fix:
verification:
files_changed: []

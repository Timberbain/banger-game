---
status: investigating
trigger: "match start overview camera animation is still flaky after 07-07 fix"
created: 2026-02-13T22:00:00Z
updated: 2026-02-13T22:10:00Z
---

## Current Focus

hypothesis: createTilemap() clobbers an in-progress overview animation when it runs AFTER startMatchOverview but before the 1.5s delay completes
test: Trace the exact code path when matchState='playing' fires after mapMetadata is set but BEFORE tilemap assets finish loading
expecting: createTilemap sets zoom=2 and starts fallback follow, destroying the overview's zoom=1.0 and centerOn
next_action: Verify the conflict in createTilemap lines 1325-1338 vs active overview

## Symptoms

expected: Match-start overview (zoom out to arena, pause 1.5s, zoom to player) fires reliably every match
actual: Overview sometimes works, sometimes doesn't
errors: None reported
reproduction: Start matches repeatedly - intermittent failure
started: After 07-07 fix was applied (pendingOverview pattern)

## Eliminated

- hypothesis: pendingOverview pattern doesn't fire for 3rd player
  evidence: Code analysis confirms the deferred path works correctly - matchState listen fires before onStateChange.once, pendingOverview is set, createTilemap checks and fires it
  timestamp: 2026-02-13T22:05:00Z

## Evidence

- timestamp: 2026-02-13T22:03:00Z
  checked: Schema field order in GameState.ts
  found: players (MapSchema) is field 0, matchState is field 5 - during initial decode, onAdd fires BEFORE listen("matchState")
  implication: Local player sprite always exists when matchState listener fires on initial state

- timestamp: 2026-02-13T22:05:00Z
  checked: createTilemap() lines 1325-1338
  found: createTilemap unconditionally sets cam.setZoom(2) at line 1328, AND the fallback at line 1332 checks !pendingOverview (false when overview is running directly) and !_follow (true because overview called stopFollow)
  implication: When createTilemap runs DURING an active overview animation, it destroys the animation by resetting zoom and starting follow

- timestamp: 2026-02-13T22:07:00Z
  checked: Timing analysis of Scenario E (1st/2nd player, fast 3rd join)
  found: If matchState='playing' arrives after mapMetadata is set but before asset loading completes, startMatchOverview() runs directly (not deferred). Then createTilemap clobbers it.
  implication: The pendingOverview pattern only protects the case where matchState fires BEFORE mapMetadata. It does NOT protect the case where the overview is already running when createTilemap fires.

## Resolution

root_cause: createTilemap() has two conflicts with an in-progress overview animation - (1) cam.setZoom(2) at line 1328 resets the overview's zoom=1.0, and (2) the fallback follow at lines 1332-1337 kicks in because pendingOverview is false and _follow is null (overview called stopFollow), which starts following the player and undoes the centerOn. This happens when matchState='playing' arrives AFTER mapMetadata is set but BEFORE tilemap assets finish loading - a common timing for the 1st/2nd player when 3 players join from lobby nearly simultaneously.
fix:
verification:
files_changed: []

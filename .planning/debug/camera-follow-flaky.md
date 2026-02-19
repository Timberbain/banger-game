---
status: diagnosed
trigger: "Camera follow only works for Paran, not for Faran or Baran. After refreshing the browser and creating a new match, the camera doesn't follow any character."
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes found
test: Code trace of event ordering in Colyseus 0.15 schema callbacks
expecting: N/A - diagnosis complete
next_action: Return diagnosis

## Symptoms

expected: Camera should follow the local player's sprite regardless of role (paran/faran/baran)
actual: Camera follows Paran but not Faran/Baran. After browser refresh + new match, camera doesn't follow any character.
errors: None reported (silent failure - startMatchOverview returns early)
reproduction: Join as Faran or Baran, start match. Camera stays at overview position.
started: After Phase 7 Plan 04 (camera system commit aa5dbd8)

## Eliminated

- hypothesis: Local sprite doesn't exist when 1500ms delayed callback fires
  evidence: onAdd fires synchronously for existing MapSchema entries when registered, and 1500ms is more than enough time for onAdd to complete. Sprite WILL exist by then for the 1st/2nd players.
  timestamp: 2026-02-13

- hypothesis: Role-specific camera logic excludes guardians
  evidence: startMatchOverview has NO role-specific logic. Look-ahead and zoom in update() apply to all roles (zoom is paran-only but that's zoom, not follow).
  timestamp: 2026-02-13

## Evidence

- timestamp: 2026-02-13
  checked: Server onJoin (GameRoom.ts:171-242) - when matchState transitions
  found: When 3rd player joins, server calls state.players.set() then immediately startMatch() which sets matchState='playing'. Both changes happen in the same tick, so the 3rd client receives matchState='playing' in their INITIAL state patch.
  implication: The 3rd client (who triggers the match) gets matchState='playing' in their very first state sync.

- timestamp: 2026-02-13
  checked: Colyseus 0.15 callback ordering - state.listen() vs onStateChange
  found: In Colyseus 0.15, schema-level callbacks (listen(), onAdd) fire DURING patch processing. onStateChange fires AFTER all schema callbacks complete. This means listen("matchState") fires BEFORE onStateChange.once().
  implication: For the 3rd client, matchState listener fires before onStateChange.once() has set mapMetadata.

- timestamp: 2026-02-13
  checked: startMatchOverview guard (GameScene.ts:1222)
  found: Line 1222: `if (!this.mapMetadata) return;` -- early return when mapMetadata is null
  implication: For the 3rd client, startMatchOverview() silently returns without setting up camera follow. No fallback exists.

- timestamp: 2026-02-13
  checked: All camera.startFollow calls in GameScene.ts
  found: startFollow is ONLY called in: (1) startMatchOverview line 1241, (2) spectator mode lines 406/432/454. There is NO fallback camera follow setup anywhere else.
  implication: If startMatchOverview fails, camera follow is never established for normal gameplay.

- timestamp: 2026-02-13
  checked: Why "Paran works" - player join order correlation
  found: In development with joinOrCreate fallback, first player gets role "paran" (GameRoom.ts:186). In lobby play, first two players are already connected when 3rd joins. The last player to join is always the one affected.
  implication: Paran typically works because the Paran player is usually the 1st to join, not the 3rd. The bug hits whichever player is last to join.

## Resolution

root_cause: TWO RELATED ISSUES causing camera follow failure:

**Issue 1 (Primary): mapMetadata race condition for the match-triggering player**
In Colyseus 0.15, `state.listen("matchState")` fires BEFORE `room.onStateChange.once()` during the initial state sync. For the 3rd player who triggers the match:
- `listen("matchState")` fires with 'playing' -> calls `startMatchOverview()`
- `startMatchOverview()` checks `if (!this.mapMetadata) return` -> mapMetadata is null -> EARLY RETURN
- `onStateChange.once()` fires later -> sets mapMetadata (too late)
- Camera follow is NEVER established because `startMatchOverview` was the only code path that calls `cam.startFollow`.

**Issue 2 (Structural): No fallback camera follow**
`startMatchOverview()` is the SOLE code path that calls `cam.startFollow(localSprite)`. If it fails (mapMetadata null, or sprite null), there is no recovery. The camera stays in its reset state from line 150 (`cam.stopFollow()`).

fix:
verification:
files_changed: []

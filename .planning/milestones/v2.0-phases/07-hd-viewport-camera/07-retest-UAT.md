---
status: diagnosed
phase: 07-hd-viewport-camera
source: 07-07-SUMMARY.md, 07-08-SUMMARY.md
started: 2026-02-13T20:30:00Z
updated: 2026-02-13T20:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Camera Follow (All Roles)
expected: Camera smoothly follows the local player for ALL roles (Paran, Faran, Baran). Test with 3 browsers — each role's camera should follow their character. After refreshing and creating a new match, camera still follows correctly.
result: pass

### 2. Camera Look-Ahead
expected: Camera visibly shifts in the direction of movement, showing more of the area ahead. The effect should be noticeable during normal gameplay — especially for Paran at speed.
result: pass

### 3. Match Start Overview
expected: When a match starts, the camera reliably shows a brief overview of the full arena (zoomed out) then smoothly zooms to the player. This should work consistently for all 3 players, not just the first to join.
result: issue
reported: "This is still flakey"
severity: major

### 4. HUD Cooldown vs Name Label
expected: Player name label and cooldown bar no longer overlap. There should be a clear gap between the cooldown indicator and the player name below it.
result: pass

### 5. Lobby Element Spacing
expected: Room Code text and "Select Character" title no longer overlap. Character selection panels don't overlap with the title text. Players section is properly spaced below panels.
result: pass

### 6. Help Screen Redesign
expected: Help screen shows role descriptions in a playful, high-level manner without raw stats (no HP/Dmg/Fire numbers). Panels have breathing room with no text overlap.
result: issue
reported: "Text is not properly contained within containers. fix spacing of text - avoid having text to close to eachother."
severity: cosmetic

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Match start overview shows full arena then zooms to player reliably"
  status: failed
  reason: "User reported: This is still flakey"
  severity: major
  test: 3
  root_cause: "createTilemap() does not check the overviewActive flag, so when it runs during an in-progress overview animation, it clobbers the animation: (1) cam.setZoom(2) at line 1328 resets the overview's zoom=1.0, (2) fallback follow guard at lines 1332-1337 evaluates true because pendingOverview is false and _follow is null (overview called stopFollow), starting follow and undoing centerOn. This happens when 3rd player joins before tilemap assets finish loading."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "createTilemap() lines 1325-1338 missing overviewActive guard on camera setup"
    - path: "client/src/scenes/GameScene.ts"
      issue: "startMatchOverview() lines 1223-1260 sets overviewActive=true but nothing protects it from createTilemap()"
  missing:
    - "Guard cam.setZoom(2) and fallback follow in createTilemap() with !this.overviewActive"
    - "cam.setBounds() should remain unconditional (overview needs correct bounds)"
  debug_session: ".planning/debug/overview-camera-still-flaky.md"

- truth: "Help screen text properly contained within panel containers with adequate spacing"
  status: failed
  reason: "User reported: Text is not properly contained within containers. fix spacing of text - avoid having text to close to eachother."
  severity: cosmetic
  test: 6
  root_cause: "Four layout issues: (1) sprite Y=rolesY+10 extends 22px above panel top edge, (2) description text has no wordWrap so 3 lines exceed 280px panel width by 40-48px, (3) 22px line spacing with 13px font leaves only 9px visible gap, (4) insufficient top padding inside panels."
  artifacts:
    - path: "client/src/scenes/HelpScene.ts"
      issue: "Line 89 (panel 280x220), 95 (sprite Y too high), 127 (no wordWrap, 22px spacing)"
  missing:
    - "Increase panel height from 220 to 260"
    - "Move sprite down from rolesY+10 to rolesY+45"
    - "Add wordWrap: { width: 250 } to description text"
    - "Increase line spacing from 22px to 28px"
    - "Shift name/tagline/description Y offsets down for more generous spacing"
  debug_session: ".planning/debug/help-text-containment-spacing.md"

---
status: diagnosed
trigger: "Investigate 3 related HUD text overlap/positioning issues in HUDScene.ts"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:05:00Z
---

## Current Focus

hypothesis: All 3 positioning issues confirmed with exact coordinates. VictoryScene audio is NOT broken.
test: Code review of exact Y positions and depth values
expecting: N/A - investigation complete
next_action: Return diagnosis

## Symptoms

expected: Role banner visible before FIGHT! text; spectator label not covering health bars; back to lobby button plays click sound
actual: Role banner covered by FIGHT!; spectator HUD covers health bars; user reports missing click sound on back to lobby
errors: none (visual positioning issues)
reproduction: Start a match, observe overlapping text
started: Since HUD implementation

## Eliminated

- hypothesis: VictoryScene button_click audio is not wired up
  evidence: VictoryScene.ts:132-136 correctly retrieves audioManager from registry and calls playSFX('button_click'). BootScene.ts:27-29 sets audioManager on registry. SoundDefs.ts:233 defines button_click. Code path is fully wired.
  timestamp: 2026-02-12T00:03:00Z

## Evidence

- timestamp: 2026-02-12T00:01:00Z
  checked: HUDScene.ts showRoleBanner() - line 561
  found: roleBanner placed at Y=280 with 48px font, origin(0.5, 0.5), depth=300. Fades after 2s delay + 1s fade (3s total visible).
  implication: Banner center at Y=280, approximate vertical span Y=256 to Y=304

- timestamp: 2026-02-12T00:01:30Z
  checked: HUDScene.ts showMatchStart() - line 665
  found: FIGHT! text placed at Y=300 with 72px font, origin(0.5, 0.5), depth=400. Fades after 1s delay + 1s fade (2s total).
  implication: FIGHT center at Y=300, approximate vertical span Y=264 to Y=336. Depth 400 > depth 300 = FIGHT renders ON TOP of role banner.

- timestamp: 2026-02-12T00:01:45Z
  checked: Timing relationship between roleBanner and FIGHT!
  found: showRoleBanner() called in create() line 150. showMatchStart() triggered by state.listen('matchState') in setupMatchCountdown() line 656. In Colyseus 0.15, state.listen() fires immediately with current value. If matchState is already "playing" when HUDScene creates, FIGHT! appears in the SAME FRAME as the role banner. Even if not yet playing, the transition happens within seconds of HUDScene creation.
  implication: Role banner (3s visible) and FIGHT! (2s visible) are guaranteed to overlap temporally. FIGHT! at depth 400 completely obscures role banner at depth 300. Both are centered at X=400 with only 20px vertical separation (Y=280 vs Y=300).

- timestamp: 2026-02-12T00:02:00Z
  checked: HUDScene.ts createSpectatorHUD() - lines 602, 615
  found: spectatorBar at Y=540 (16px font + 6px padding = ~28px tall, spans Y=526 to Y=554). spectatorInstruction at Y=565 (12px font, spans Y=559 to Y=571). Health bar labels at Y=557 (barY=575 minus barH/2 minus 10). Health bars at Y=575.
  implication: spectatorInstruction (Y=559-571) directly overlaps health bar labels (Y=547-557) and bars (Y=567-583). spectatorBar bottom edge (Y=554) nearly touches labels too.

- timestamp: 2026-02-12T00:03:00Z
  checked: VictoryScene.ts button audio - lines 132-136 + AudioManager.ts + BootScene.ts
  found: Complete audio chain is wired: BootScene creates AudioManager and stores in registry (line 27-29). VictoryScene retrieves it (line 134). playSFX('button_click') calls a valid sound key defined in SoundDefs.ts:233. AudioManager.playSFX() has silent catch for autoplay policy errors.
  implication: Audio code is correct. If user hears no sound, likely causes are: (a) SFX volume set to 0, (b) browser autoplay policy blocking (silently caught), or (c) sound too quiet to notice.

## Resolution

root_cause: 3 positioning issues + 1 audio non-issue identified:
  1. ROLE BANNER / FIGHT OVERLAP: roleBanner at Y=280 depth=300, FIGHT! at Y=300 depth=400. Only 20px apart vertically with FIGHT being 72px font that completely covers the 48px role banner. Both appear simultaneously (or near-simultaneously) because Colyseus listen() fires immediately.
  2. SPECTATOR HUD / HEALTH BAR OVERLAP: spectatorBar at Y=540, spectatorInstruction at Y=565, health bars at Y=575 with labels at Y=557. The spectator text sits directly on top of the health bar region.
  3. VICTORY BUTTON AUDIO: NOT A CODE BUG. The audio is correctly wired at VictoryScene.ts:132-136.
fix:
verification:
files_changed: []

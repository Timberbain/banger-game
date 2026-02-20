---
status: diagnosed
trigger: "S key does not work in HTML room code input in LobbyScene"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:00:00Z
---

## Current Focus

hypothesis: The 05-08 fix uses keyboard.enabled (scene-level) which does NOT disable global KeyboardManager preventDefault. After a game session, WASD captures persist globally, blocking S in the HTML input. The correct fix is disableGlobalCapture()/enableGlobalCapture().
test: Code analysis of Phaser 3.90 KeyboardManager vs KeyboardPlugin
expecting: N/A - code analysis complete
next_action: Return diagnosis

## Symptoms

expected: S key types 's' in the HTML room code input field
actual: S key does nothing in the HTML input; W, A, D reportedly work
errors: None (silent failure)
reproduction: Click "Join Private Room", focus the HTML input, press S key
started: After 05-08 fix was applied

## Eliminated

(none)

## Evidence

- timestamp: 2026-02-11
  checked: LobbyScene.ts showJoinInput() lines 302-311
  found: Fix uses this.input.keyboard.enabled = false/true on focus/blur. This sets the SCENE-LEVEL KeyboardPlugin.enabled property.
  implication: Only prevents KeyboardPlugin.update() from processing events. Does NOT affect global KeyboardManager.

- timestamp: 2026-02-11
  checked: Phaser KeyboardManager.js startListeners() lines 186-204
  found: onKeyDown handler checks _this.enabled (KeyboardManager.enabled) and _this.captures. If key is captured, calls event.preventDefault() REGARDLESS of any scene plugin's enabled state.
  implication: Setting keyboard.enabled=false on the plugin does not stop the global manager from calling preventDefault() on captured keys.

- timestamp: 2026-02-11
  checked: Phaser KeyboardPlugin.js addKey() lines 491-537
  found: addKey() calls this.addCapture(keyCode) which delegates to KeyboardManager.addCapture(), adding to the global captures array.
  implication: GameScene's addKeys('W,A,S,D') adds keyCodes 87,65,83,68 to global captures.

- timestamp: 2026-02-11
  checked: Phaser KeyboardPlugin.js shutdown() lines 880-883
  found: shutdown() calls removeAllKeys(true) with removeCapture=false (default). Captures are NOT removed when a scene shuts down.
  implication: After Game -> Victory -> Lobby transition, WASD + cursor key captures persist in the global KeyboardManager.

- timestamp: 2026-02-11
  checked: Phaser KeyboardPlugin.js disableGlobalCapture() lines 369-374
  found: Sets this.manager.preventDefault = false on the GLOBAL KeyboardManager. This is the correct way to disable key capture for DOM element interaction.
  implication: The fix should use disableGlobalCapture()/enableGlobalCapture() instead of keyboard.enabled.

- timestamp: 2026-02-11
  checked: GameScene.ts lines 89-97
  found: createCursorKeys() captures UP(38),DOWN(40),LEFT(37),RIGHT(39),SPACE(32),SHIFT(16). addKeys('W,A,S,D') captures W(87),A(65),S(83),D(68). addKey(SPACE) and addKey(TAB) also captured.
  implication: After one game session, global captures = [38,40,37,39,32,16,87,65,83,68,9] -- all of these keys will have preventDefault() called in the global handler.

## Resolution

root_cause: The 05-08 fix uses `this.input.keyboard.enabled = false` which only disables the scene-level KeyboardPlugin (preventing it from processing events in update()). It does NOT disable the global KeyboardManager from calling `event.preventDefault()` on captured keys. After playing a game (Game -> Victory -> Lobby flow), GameScene's addKeys('W,A,S,D') and createCursorKeys() add key captures to the global KeyboardManager. These captures persist after GameScene shuts down because shutdown() calls removeAllKeys(destroy=true, removeCapture=false). When the user then enters the "Join Private Room" screen, the global KeyboardManager still calls preventDefault() on S (keyCode 83), preventing the character from being inserted into the HTML input.

fix: N/A (diagnosis only)
verification: N/A
files_changed: []

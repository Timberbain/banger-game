---
status: diagnosed
trigger: "WASD keys don't work in room code HTML input after playing a match"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:00:00Z
---

## Current Focus

hypothesis: Two compounding issues -- (1) persistent WASD captures from GameScene survive scene shutdown, and (2) focus event listener is registered AFTER focus() is called, so disableGlobalCapture() never fires for the auto-focused input
test: Code analysis of LobbyScene showJoinInput(), GameScene key setup, Phaser KeyboardPlugin/KeyboardManager internals
expecting: N/A - code analysis complete
next_action: Return diagnosis

## Symptoms

expected: W, A, S, D keys type characters in the HTML room code input field after returning from a match
actual: W, A, S, D keys do nothing in the HTML input. Other keys work fine. On first load (before any match), WASD keys work fine.
errors: None (silent failure -- browser preventDefault() silently eats the keystrokes)
reproduction: (1) Complete a match (Game -> Victory -> Return to Lobby). (2) Click "Join Private Room". (3) Try typing a code containing W, A, S, or D characters.
started: After 05-12 fix was applied (which added disableGlobalCapture/enableGlobalCapture to focus/blur handlers)

## Eliminated

- hypothesis: "disableGlobalCapture() / enableGlobalCapture() is not being used"
  evidence: The 05-12 fix DID add disableGlobalCapture()/enableGlobalCapture() to the focus/blur handlers (LobbyScene.ts lines 302-313). The methods exist and correctly set manager.preventDefault on the global KeyboardManager (KeyboardPlugin.js lines 369-373).
  timestamp: 2026-02-11

- hypothesis: "this.input.keyboard is null or invalid in LobbyScene after scene restart"
  evidence: KeyboardPlugin.manager is set once during initialization (line 120: this.manager = sceneInputPlugin.manager.keyboard) and references the single global KeyboardManager. The if-guard (line 303: if (this.input.keyboard)) would catch null. Phaser scene restart re-initializes the plugin via the start() method.
  timestamp: 2026-02-11

- hypothesis: "Something re-enables global capture after disableGlobalCapture is called"
  evidence: enableGlobalCapture() is only called in the blur handler (line 311). No other code in LobbyScene calls addCapture or enableGlobalCapture. The ENTER key listener (line 350) uses EventEmitter .once(), not addKey(), so it doesn't trigger addCapture.
  timestamp: 2026-02-11

- hypothesis: "LobbyScene's keyboard operations add new captures"
  evidence: Searched LobbyScene.ts for addKey, addKeys, createCursorKeys, addCapture -- zero matches. LobbyScene does NOT create any key objects that would add captures.
  timestamp: 2026-02-11

## Evidence

- timestamp: 2026-02-11
  checked: LobbyScene.ts showJoinInput() lines 298-307 (focus timing)
  found: Line 298 appends the HTML input to the DOM. Line 299 calls this.htmlInput.focus(). Lines 302-307 register the focus event listener AFTER focus() has already been called. In modern browsers, HTMLElement.focus() fires the focus event synchronously, meaning the event fires before the listener is attached.
  implication: The focus event handler (which calls disableGlobalCapture()) NEVER fires for the initial auto-focus of the HTML input. This is the primary trigger for the bug.

- timestamp: 2026-02-11
  checked: GameScene.ts create() lines 89-97 (key setup)
  found: GameScene registers WASD via addKeys('W,A,S,D') and arrow keys via createCursorKeys(). Both methods internally call addCapture() on the GLOBAL KeyboardManager, adding keyCodes [87,65,83,68,38,40,37,39,32,16] to the global captures array.
  implication: After a game session, these captures persist globally.

- timestamp: 2026-02-11
  checked: Phaser KeyboardPlugin.js shutdown() line 882
  found: shutdown() calls this.removeAllKeys(true) with only the destroy parameter. removeCapture defaults to false. This means captures are NOT removed when GameScene shuts down.
  implication: WASD captures survive GameScene shutdown and persist in the global KeyboardManager.

- timestamp: 2026-02-11
  checked: VictoryScene.ts returnToLobby() lines 128-132
  found: Calls this.scene.stop('VictoryScene'), this.scene.stop('GameScene'), then this.scene.start('LobbyScene'). scene.stop() triggers KeyboardPlugin.shutdown() which does NOT remove captures.
  implication: When returning to lobby, all WASD captures from GameScene remain in the global KeyboardManager.

- timestamp: 2026-02-11
  checked: Phaser KeyboardManager.js startListeners() onKeyDown handler (lines 186-204)
  found: The global onKeyDown handler checks: if (_this.preventDefault && !modified && _this.captures.indexOf(event.keyCode) > -1) { event.preventDefault(); }. This runs on EVERY keystroke regardless of which scene is active.
  implication: After a match, W(87), A(65), S(83), D(68) are in captures[]. If preventDefault is true (which it is by default and never gets set to false due to the race condition), these keys get event.preventDefault() called, preventing the characters from appearing in the HTML input.

- timestamp: 2026-02-11
  checked: Phaser KeyboardManager.js addCapture() line 335
  found: addCapture() sets this.preventDefault = captures.length > 0 after adding captures.
  implication: Even if disableGlobalCapture() were called before GameScene starts, addCapture() would re-enable preventDefault. This is expected behavior -- the important thing is that disableGlobalCapture() should be called WHEN the HTML input is focused, but the race condition prevents this.

- timestamp: 2026-02-11
  checked: Why first load works
  found: On first load (before any match), the global KeyboardManager.captures array is empty []. The onKeyDown handler check _this.captures.indexOf(event.keyCode) > -1 returns false for WASD. So even though preventDefault is true, no keys are actually prevented.
  implication: The focus-listener race condition exists on first load too, but is benign because there are no captures. The bug only manifests after a GameScene session adds captures.

- timestamp: 2026-02-11
  checked: Whether user can work around by clicking away and back on the input
  found: If the user clicks somewhere else (losing focus, triggering blur handler which calls enableGlobalCapture()), then clicks back on the input (triggering focus handler which calls disableGlobalCapture()), the WASD keys would work. But this requires the user to manually blur and re-focus the input, which is not obvious behavior.
  implication: The bug is consistently reproducible on the initial auto-focus but could be worked around (unknowingly) by clicking away and back.

## Resolution

root_cause: |
  Two compounding issues cause WASD keys to not work in the HTML room code input after playing a match:

  **Issue 1: Persistent global key captures from GameScene**
  GameScene.create() calls this.input.keyboard.addKeys('W,A,S,D') and createCursorKeys(), which internally call addCapture() on the global KeyboardManager, adding keyCodes 87(W), 65(A), 83(S), 68(D) plus arrow keys to the global captures array. When GameScene shuts down (via scene.stop()), KeyboardPlugin.shutdown() calls removeAllKeys(true) but with removeCapture=false (the default), so captures persist globally. The same captures survive across the full lifecycle: GameScene -> VictoryScene -> LobbyScene.

  **Issue 2: Race condition in focus event listener registration (the trigger)**
  In LobbyScene.showJoinInput() (lines 298-307):
  - Line 298: document.body.appendChild(this.htmlInput)
  - Line 299: this.htmlInput.focus()  <-- fires focus event SYNCHRONOUSLY
  - Line 302-307: addEventListener('focus', ...) <-- registered AFTER focus already fired

  Because HTMLElement.focus() fires the focus event synchronously in modern browsers, the event fires before the listener is attached. The listener that calls disableGlobalCapture() NEVER executes for the initial auto-focus. Therefore, manager.preventDefault remains true, and the global KeyboardManager's onKeyDown handler calls event.preventDefault() on W, A, S, D keystrokes (since they are in the captures array), silently consuming them before they reach the HTML input.

  **Why it works on first load:** Before any match, the captures array is empty. The onKeyDown handler's check captures.indexOf(event.keyCode) > -1 fails for all keys, so no preventDefault() is called regardless of the disableGlobalCapture() race condition.

  **Key files:**
  - client/src/scenes/LobbyScene.ts: lines 298-307 (race condition in showJoinInput)
  - client/src/scenes/GameScene.ts: lines 89-97 (WASD key capture registration)
  - node_modules/phaser/src/input/keyboard/KeyboardPlugin.js: line 882 (shutdown doesn't remove captures)
  - node_modules/phaser/src/input/keyboard/KeyboardManager.js: lines 200-203 (global preventDefault on captured keys)

fix: N/A (diagnosis only)

verification: N/A

files_changed: []

## Suggested Fix Directions

**Option A (Minimal -- fix the race condition):**
Register the focus/blur event listeners BEFORE calling focus(), or call disableGlobalCapture() directly after focus() instead of relying on the event listener. For example:
```
document.body.appendChild(this.htmlInput);
// Register listeners BEFORE calling focus
this.htmlInput.addEventListener('focus', () => { ... });
this.htmlInput.addEventListener('blur', () => { ... });
// Now focus (listener will fire)
this.htmlInput.focus();
```

**Option B (Belt-and-suspenders -- also clean up captures):**
In addition to fixing the race condition, have GameScene clean up its own captures on shutdown by overriding shutdown/destroy to call removeAllKeys(true, true) (with removeCapture=true), or call clearCaptures() in the scene transition. This prevents stale captures from accumulating.

**Option C (Defense-in-depth -- direct call + listener):**
Call disableGlobalCapture() directly after focus() AND keep the event listener for subsequent focus events:
```
document.body.appendChild(this.htmlInput);
this.htmlInput.addEventListener('focus', () => { ... });
this.htmlInput.addEventListener('blur', () => { ... });
this.htmlInput.focus();
// Ensure global capture is disabled even if listener missed
if (this.input.keyboard) {
  this.input.keyboard.enabled = false;
  this.input.keyboard.disableGlobalCapture();
}
```

**Recommended: Option A or Option B combined.** Fixing the race condition is essential. Cleaning up captures on scene shutdown is good hygiene that prevents this class of bug from recurring.

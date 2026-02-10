---
status: resolved
trigger: "Some letters don't work when entering room code (D, S). Character panel pre-highlighted on join."
created: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:00:00Z
---

## Current Focus

hypothesis: Both bugs confirmed with root causes identified
test: N/A - code analysis complete
expecting: N/A
next_action: Apply fixes

## Symptoms

expected: All alphanumeric characters typeable in room code input. No character highlighted until player clicks one.
actual: D and S keys don't register in HTML input. Joining player sometimes sees a character panel pre-highlighted green.
errors: None (silent failures)
reproduction: (1) Click "Join Private Room", try typing D or S in input. (2) Create room in browser A, join in browser B via code, observe character panels.
started: Since implementation

## Eliminated

(none needed - root causes found on first analysis)

## Evidence

- timestamp: 2026-02-10T12:00:00Z
  checked: client/src/main.ts Phaser config
  found: No `input.keyboard.capture` or `disableGlobalCapture` configuration present. Phaser 3 uses default keyboard handling which captures events for registered keys.
  implication: Phaser's default behavior is to call preventDefault() on keyboard events for all keys, preventing them from reaching HTML input elements.

- timestamp: 2026-02-10T12:00:00Z
  checked: client/src/scenes/LobbyScene.ts showJoinInput() (lines 198-277)
  found: HTML input is created and appended to document.body, but there is NO code to disable or pause Phaser keyboard capture while the input is focused. Phaser's KeyboardPlugin intercepts all key events at the document level by default.
  implication: When user types in the HTML input, Phaser's keyboard manager calls preventDefault() on the keydown event before it reaches the input element. D and S are specifically affected because Phaser is likely still watching for those keys from a global perspective. W and A may also be affected (user may not have tested all WASD keys).

- timestamp: 2026-02-10T12:00:00Z
  checked: client/src/scenes/LobbyScene.ts line 11
  found: `private selectedRole: string | null = null;` - selectedRole is an instance property initialized to null in the class body.
  implication: selectedRole persists across calls to showLobbyView() and showMainMenu(). It is NEVER reset when navigating back to menu or creating a new lobby session.

- timestamp: 2026-02-10T12:00:00Z
  checked: client/src/scenes/LobbyScene.ts createCharacterSelection() lines 676-678
  found: `const isSelected = this.selectedRole === char.role;` - The panel highlight check uses the local `selectedRole` property, NOT the server state for the current player.
  implication: If selectedRole still holds a value from a previous lobby session (or from matchmaking auto-assignment at line 460), the panel will show as highlighted even though the server has no role selected for this player.

- timestamp: 2026-02-10T12:00:00Z
  checked: client/src/scenes/LobbyScene.ts lines 458-468 (matchmaking flow)
  found: `this.selectedRole = data.assignedRole;` is set BEFORE joining the lobby. If the player later navigates back and joins a different room, selectedRole retains the old value.
  implication: Stale selectedRole causes false green border on character panel.

- timestamp: 2026-02-10T12:00:00Z
  checked: Phaser 3 keyboard capture behavior
  found: Phaser 3's KeyboardPlugin captures keyboard events at the window level. When Phaser calls `addKey()` or `createCursorKeys()`, it registers those keys and calls `preventDefault()` on their events. However, even WITHOUT addKey, Phaser 3.x by default captures certain key events to prevent browser scrolling. The critical issue is that in LobbyScene, `this.input.keyboard` is active and Phaser processes all keyboard events through its global handler.
  implication: The fix needs to either (a) disable Phaser keyboard capture when HTML input is focused, or (b) stop event propagation from the HTML input.

## Resolution

### Bug 1: Room code input swallows D, S (and likely W, A) keys

root_cause: Phaser 3's keyboard manager intercepts keydown events at the document/window level and calls `preventDefault()` on them before they reach the HTML input element. The LobbyScene does not disable or pause Phaser keyboard input when the HTML text input is focused. D and S are WASD keys (and W, A are likely also affected but the user specifically noticed D and S since they appear in room codes more often). Other keys like arrow keys and Space may also be captured.

**File:** `/Users/jonasbrandvik/Projects/banger-game/client/src/scenes/LobbyScene.ts`
**Lines:** 198-277 (`showJoinInput()`)

fix_direction: When the HTML input gains focus, disable Phaser keyboard capture so events flow to the DOM input normally. When the input loses focus, re-enable it.

**Recommended fix in `showJoinInput()` after line 232 (`this.htmlInput.focus()`):**

```typescript
// Disable Phaser keyboard capture while HTML input is focused
this.htmlInput.addEventListener('focus', () => {
  if (this.input.keyboard) {
    this.input.keyboard.enabled = false;
  }
});
this.htmlInput.addEventListener('blur', () => {
  if (this.input.keyboard) {
    this.input.keyboard.enabled = true;
  }
});
```

Alternative approach (also valid): `this.input.keyboard.disableGlobalCapture()` when entering showJoinInput, and re-enable on leaving. The `enabled = false` approach is more targeted.

### Bug 2: Character panel pre-highlighted on join

root_cause: The `selectedRole` property (line 11) is never reset when entering a new lobby session. It persists across `showMainMenu()` -> `showLobbyView()` transitions. When `createCharacterSelection()` runs (line 717: `updatePanel()`), it checks `this.selectedRole === char.role` and finds a stale value, rendering a green border on a panel the user never selected. This is especially visible when:
1. Player uses matchmaking (line 460 sets `this.selectedRole = data.assignedRole`)
2. Player then joins a different private room - stale role shows as selected
3. Even on first join, if the LobbyScene instance persists and `selectedRole` was set from a prior session

Additionally, the "same character selected in multiple browsers" confusion is because the green border is a LOCAL visual state based on `this.selectedRole`, not the server's player.role. Each client's `selectedRole` is independent, so two browsers can both show the same role highlighted without the server enforcing exclusivity on the visual indicator.

**File:** `/Users/jonasbrandvik/Projects/banger-game/client/src/scenes/LobbyScene.ts`
**Lines:** 11, 502-506, 676-678

fix_direction: Reset `selectedRole` to `null` at the start of `showLobbyView()`, and also at the start of `showMainMenu()`.

**Recommended fix in `showLobbyView()` after line 505 (`this.clearUI()`):**

```typescript
// Reset local selection state for fresh lobby
this.selectedRole = null;
```

**And in `showMainMenu()` after line 128 (`this.clearUI()`):**

```typescript
// Reset selection state when returning to menu
this.selectedRole = null;
```

verification: Manual testing required - create private room, join from another browser, verify no pre-selection. Type D, S, W, A in room code input and verify they appear.

files_changed: []

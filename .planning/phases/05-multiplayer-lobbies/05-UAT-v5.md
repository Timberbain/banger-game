---
status: diagnosed
phase: 05-multiplayer-lobbies
source: 05-01 through 05-12 SUMMARY.md files (all plans including 4 gap closure rounds)
started: 2026-02-11T15:00:00Z
updated: 2026-02-11T15:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create Private Room with Room Code
expected: From the lobby menu, click "Create Private Room". A lobby view appears with a 6-character room code displayed in yellow at the top. Character selection panels visible below with Paran, Faran, and Baran options.
result: pass

### 2. Join Private Room by Code (including S key)
expected: From a second browser tab, click "Join Private Room". An HTML text input appears. Type a room code — ALL keys including S, D, W, A should work in the input field. After entering the code, you join the same lobby and see the other player listed.
result: pass

### 3. Character Selection with Green Highlight
expected: In the lobby, click on a character panel (e.g., Paran). The selected character immediately gets a green border. If another player already selected that role, it appears grayed out and not selectable.
result: pass

### 4. Ready System & Countdown → All 3 Enter Game
expected: All 3 players select unique roles (1 Paran + 1 Faran + 1 Baran) and click Ready. A 3-second countdown appears. After countdown, ALL 3 players transition to GameScene. Each player's character matches their lobby selection. No player gets kicked out.
result: pass

### 5. Gameplay & Victory Screen → Return to Lobby
expected: Play through a match until one side wins. Victory screen shows stats. Click "Return to Lobby" — you return to the LobbyScene with Create/Join/Find Match buttons.
result: pass

### 6. S Key in Room Code Input After Playing Match
expected: After returning to lobby from a completed match, click "Join Private Room". Type a room code that includes the letter S. The S key should work normally in the text input (not eaten by Phaser).
result: issue
reported: "W A S D keys no longer work for joining a room"
severity: major

### 7. Second Match Controls Work
expected: After returning to lobby from a completed match, create/join a new lobby and start a second match. All players should have working movement and shooting controls. No stale state from the first match.
result: pass

### 8. Matchmaking Queue with Role Highlight
expected: Click "Find Match" from the lobby menu. Select a preferred role. An animated "Searching..." message appears with queue counts. When 3 players queue (1 Paran + 2 Guardians), all are placed into a lobby together. The pre-assigned role is already highlighted with a green border.
result: pass

### 9. Disconnected Player Ghosting
expected: During a match, if a player closes their browser tab, remaining players see that player's sprite become ghosted (30% opacity) with a yellow "DC" label below them. The disconnected player is frozen in place.
result: pass

### 10. Browser Refresh Reconnection (Multi-Tab)
expected: During an active match with 3 tabs, press F5 on one tab. It should show reconnection attempts and eventually reconnect to the match. The other two tabs should NOT be disrupted. Try refreshing a second tab too — each tab should reconnect independently.
result: pass

### 11. Lobby Refresh Reconnection (Multi-Tab)
expected: While in a lobby with 3 tabs, press F5 on one tab. It should reconnect to the lobby (showing attempt progress). Your seat and role should be preserved. Other tabs remain connected.
result: pass

### 12. Server Crash Protection
expected: During gameplay, if a player disconnects or reconnects, the server should NOT crash. Other players remain connected and playing normally.
result: pass

## Summary

total: 12
passed: 11
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "WASD keys work in room code HTML input field after returning from a match"
  status: failed
  reason: "User reported: W A S D keys no longer work for joining a room"
  severity: major
  test: 6
  root_cause: "Race condition: htmlInput.focus() fires synchronously BEFORE addEventListener('focus') is registered, so disableGlobalCapture() never executes on auto-focus. After a match, GameScene's global WASD captures persist (KeyboardPlugin.shutdown doesn't remove captures), and the global KeyboardManager calls preventDefault() on WASD keystrokes before they reach the HTML input."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Lines 298-307: focus() called on line 299 before focus event listener registered on line 302"
    - path: "client/src/scenes/GameScene.ts"
      issue: "Lines 89-97: addKeys('W,A,S,D') adds global captures that persist after scene shutdown"
  missing:
    - "Move addEventListener('focus') and addEventListener('blur') calls to BEFORE htmlInput.focus()"
  debug_session: "server/.planning/debug/wasd-keys-room-input-v5.md"

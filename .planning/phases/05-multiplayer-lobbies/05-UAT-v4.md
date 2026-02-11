---
status: diagnosed
phase: 05-multiplayer-lobbies
source: 05-01 through 05-11 SUMMARY.md files (all plans including gap closures)
started: 2026-02-11T12:00:00Z
updated: 2026-02-11T12:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create Private Room with Room Code
expected: From the lobby menu, click "Create Private Room". A lobby view appears with a 6-character room code displayed in yellow at the top. Character selection panels visible below with Paran, Faran, and Baran options.
result: pass

### 2. Join Private Room by Code
expected: From a second browser tab, click "Join Private Room". An HTML text input appears. Type the room code — all keys including D, S, W, A should work in the input field. After entering the code, you join the same lobby and see the other player listed. No character should be pre-highlighted on join.
result: pass

### 3. Character Selection & Deselection
expected: In the lobby, click on a character panel (e.g., Paran). The selected character immediately gets a green border. Clicking the same character again deselects it (green border removed). If another player already selected that role, it appears grayed out and not selectable.
result: pass

### 4. Ready System & Countdown
expected: All 3 players select unique roles (1 Paran + 1 Faran + 1 Baran) and click Ready. Each player's ready status shows a checkmark in the player list. A 3-second countdown (3, 2, 1) appears when all are ready.
result: pass

### 5. All 3 Players Enter Game with Correct Roles
expected: After the countdown, ALL 3 players transition to the GameScene with consistent status text. Each player's character matches their lobby selection. No player gets kicked out. Controls work for all players.
result: pass

### 6. Victory Screen Returns to Lobby
expected: After a match ends and the victory screen shows stats, clicking "Return to Lobby" takes you back to the LobbyScene with the main menu (Create/Join/Find Match buttons).
result: pass

### 7. Second Match Controls Work
expected: After returning to lobby from a completed match, start a second match. All players should have working controls (movement, shooting) in the second match. No stale state from the first match.
result: issue
reported: "The S button is not working when entering room code, the rest works. Second match controls themselves work fine."
severity: minor

### 8. Matchmaking Queue with Role Highlight
expected: Click "Find Match" from the lobby menu. Select a preferred role. An animated "Searching..." message appears. When 3 players queue (1 Paran + 2 Guardians), all are placed into a lobby together. The pre-assigned role should already be highlighted with a green border.
result: pass

### 9. Disconnected Player Ghosting
expected: During a match, if a player closes their browser tab, remaining players see that player's sprite become ghosted (30% opacity) with a yellow "DC" label below them. The disconnected player is frozen in place.
result: pass

### 10. Browser Refresh Reconnection (Game)
expected: During an active match, press F5 to refresh. The game should show reconnection attempts ("Reconnecting... attempt X/12") and eventually reconnect you to the active match. Other connected players should NOT be disrupted by the reconnecting player.
result: issue
reported: "It is still flakey, worked for 1 browser which reconnected to the game. For the other, when refreshing their browser it tries to reconnects - after 12 seconds it times out and says Session Expires."
severity: major

### 11. Lobby Refresh Reconnection
expected: While in a lobby (before match starts), press F5 to refresh. The game should attempt to reconnect you to the lobby (showing attempt progress). After reconnection, your seat and role should be preserved.
result: issue
reported: "Flakey. Works for some browser. Reconnecting to lobby times out after 12 attempts for others and does not reconnect. When pressing refresh for all 3 browsers open, only one of them seem to reconnect, feels a bit random which manages to do it. Also unable to rejoin lobby from match maker."
severity: major

### 12. Server Crash Protection
expected: If any error occurs during gameplay (e.g., from reconnection), the server should NOT crash and kill all connections. Other players should remain connected and playing normally.
result: pass

## Summary

total: 12
passed: 9
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "S key works in room code HTML input field"
  status: failed
  reason: "User reported: The S button is not working when entering room code, the rest works"
  severity: minor
  test: 7
  root_cause: "Phaser global KeyboardManager.captures persists after GameScene shutdown. The 05-08 fix only disables scene-level KeyboardPlugin (keyboard.enabled=false) which doesn't stop the global KeyboardManager from calling preventDefault() on captured keys. After one game session, WASD+arrow+space+tab keys are permanently captured globally."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Lines 302-311: focus/blur handler uses keyboard.enabled instead of disableGlobalCapture()"
    - path: "client/src/scenes/GameScene.ts"
      issue: "Lines 89-97: addKeys/createCursorKeys add global captures that persist after scene shutdown"
  missing:
    - "Add this.input.keyboard.disableGlobalCapture() on HTML input focus"
    - "Add this.input.keyboard.enableGlobalCapture() on HTML input blur"
  debug_session: ".planning/debug/s-key-room-code-input.md"

- truth: "Browser refresh during active match reliably reconnects the refreshing player"
  status: failed
  reason: "User reported: Flakey, worked for 1 browser which reconnected to the game. For the other, when refreshing it tries to reconnect - after 12 seconds it times out and says Session Expires."
  severity: major
  test: 10
  root_cause: "localStorage key collision: all tabs share a single 'bangerActiveRoom' key. Each tab writes its unique reconnection token to the same key — last writer wins. On F5, all tabs read the same (last-written) token. Only the original owner of that token can reconnect; others' tokens were overwritten and lost."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Line 691: localStorage.setItem('bangerActiveRoom') — shared across all tabs"
    - path: "client/src/scenes/GameScene.ts"
      issue: "Line 125: localStorage.setItem('bangerActiveRoom') — overwrites other tabs' tokens"
  missing:
    - "Replace localStorage with sessionStorage for reconnection tokens (sessionStorage is per-tab, survives F5)"
  debug_session: ".planning/debug/multi-client-reconnect-flaky.md"

- truth: "Lobby refresh reconnection works reliably, preserving seat and role"
  status: failed
  reason: "User reported: Flakey. Works for some browser. Reconnecting to lobby times out after 12 attempts for others. When pressing refresh for all 3 browsers, only one reconnects. Also unable to rejoin lobby from matchmaker."
  severity: major
  test: 11
  root_cause: "Same localStorage key collision as game reconnection: all tabs share 'bangerLobbyRoom' key, last writer wins. Additionally, after failed reconnection the room stays locked/full during grace period (allowReconnection reserves seats), blocking rejoin via matchmaker until grace period expires."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Line 624: localStorage.setItem('bangerLobbyRoom') — shared across all tabs"
  missing:
    - "Replace localStorage with sessionStorage for lobby reconnection tokens"
    - "Reduce LOBBY_RECONNECT_GRACE or have server release seats when client gives up"
  debug_session: ".planning/debug/lobby-multi-reconnect-flaky.md"

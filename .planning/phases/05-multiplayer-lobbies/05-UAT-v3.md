---
status: diagnosed
phase: 05-multiplayer-lobbies
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md, 05-07-SUMMARY.md, 05-08-SUMMARY.md, 05-09-SUMMARY.md
started: 2026-02-11T09:00:00Z
updated: 2026-02-11T09:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create Private Room & Room Code
expected: From the lobby menu, click "Create Private Room". A lobby view appears with a 6-character room code displayed in yellow at the top. The code uses only unambiguous characters (no 0/O/1/I/L).
result: pass

### 2. Join Private Room by Code (with D/S keys)
expected: From a second browser tab, click "Join Private Room". An HTML text input appears. Type the room code — all keys including D, S, W, A should work in the input field. After entering the code, you join the same lobby and see the other player listed. No character should be pre-highlighted on join.
result: pass

### 3. Character Selection & Deselection
expected: In the lobby, click on a character panel (Paran, Faran, or Baran). The selected character gets an immediate green border. Clicking the same character again deselects it (green border removed, role cleared). If another player already selected that role, it appears grayed out and is not selectable.
result: pass

### 4. Ready System & Countdown
expected: After selecting a character, click Ready — it turns green and shows your status as ready in the player list. When all 3 players are ready with valid roles (1 Paran + 1 Faran + 1 Baran), a 3-second countdown appears (3, 2, 1).
result: pass

### 5. All 3 Players Enter Game with Correct Roles
expected: After the countdown, ALL 3 players transition to the GameScene. Each player's character matches what they selected in the lobby. No player gets kicked back to lobby. All players see consistent status text (not "Waiting for players (3/3)" or "Connected: sessionId").
result: issue
reported: "The controls of one of the guardians (Baran) is not responding. This looks like an intermittent failure. Status text is still inconsistent - Paran shows 'Waiting for players... 0/3', Faran shows nothing, Baran shows 'Match started!'."
severity: major

### 6. Find Match (Matchmaking Queue)
expected: Click "Find Match" from the lobby menu. A role selection appears. After selecting a role, an animated "Searching..." message shows. When enough players queue (1 Paran + 2 Guardians), all are placed into a lobby with pre-assigned roles.
result: issue
reported: "When entering the lobby - the pre selected roles are not highlighted with green. The roles are assigned, but I have to click the role to give it a green border."
severity: minor

### 7. Disconnected Player Ghosting
expected: During a match, if a player closes their browser tab, remaining players see that player's sprite become ghosted (30% opacity) with a yellow "DC" label below. The disconnected player is frozen in place (not moving).
result: pass

### 8. Browser Refresh Reconnection (Game)
expected: During an active match, press F5 to refresh. Instead of showing the lobby menu, the game should automatically reconnect you to the active match. The reconnection window is ~12 seconds, so even slow disconnect detection should succeed. You return at your previous position.
result: issue
reported: "It worked for the browser that I closed and then reopened, however for the other ones it didnt reconnect. Instead it says reconnecting and counting, after a while it returns to the lobby."
severity: major

### 9. Victory Screen Returns to Lobby
expected: After a match ends and the victory screen shows stats, clicking "Return to Lobby" takes you back to the LobbyScene with the main menu (Create/Join/Find Match buttons).
result: pass

### 10. Lobby Refresh Reconnection
expected: While in a lobby (before match starts), press F5 to refresh. The game should attempt to reconnect you to the lobby rather than showing the main menu. Your seat and role selection should be preserved.
result: issue
reported: "This only works some times - most of the times it still goes back to the lobby. When it doesnt work, I see a quick flash of yellow text trying to reconnect. Think hard of how to fix this."
severity: major

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "All 3 players enter game with correct roles, responsive controls, and consistent status text"
  status: failed
  reason: "User reported: The controls of one of the guardians (Baran) is not responding. This looks like an intermittent failure. Status text is still inconsistent - Paran shows 'Waiting for players... 0/3', Faran shows nothing, Baran shows 'Match started!'."
  severity: major
  test: 5
  root_cause: "Two bugs: (1) Phaser scene reuse: scene.start() doesn't re-run constructor, so stale prediction/connected/playerSprites persist from previous match. Baran's input goes through stale PredictionSystem. (2) Three competing statusText writers race: initial sync check, listen('matchState') immediate callback, and onAdd player count — all unsynchronized. listen() fires with immediate=true by default, duplicating the initial check. onAdd guard (count < 3) prevents showing 3/3."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "Lines 10-48: member variables only initialized in constructor, not reset in create(). Lines 102-109, 142-148, 203-207: three competing statusText writers"
  missing:
    - "Add init() or reset block at top of create() to reset ALL member variables (room, connected, prediction, playerSprites, remotePlayers, matchEnded, isSpectating etc.)"
    - "Replace three statusText writers with single unified approach: listen('matchState') as sole source of truth, remove initial sync check, onAdd only updates count display"
  debug_session: ".planning/debug/lobby-game-transition-v2.md"

- truth: "Matchmaking pre-assigned roles are visually highlighted with green border when entering lobby"
  status: failed
  reason: "User reported: When entering the lobby - the pre selected roles are not highlighted with green. The roles are assigned, but I have to click the role to give it a green border."
  severity: minor
  test: 6
  root_cause: "showLobbyView() at line 568 unconditionally resets selectedRole to null, clobbering the value set by matchFound handler at line 522. The delayed room.send('selectRole') at line 530 bypasses the client-side selectRole() method which handles UI state (sets selectedRole AND triggers characterPanelUpdaters)."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Line 568: showLobbyView() resets selectedRole=null. Lines 522-531: matchFound sets role then calls showLobbyView (clobbers it), delayed send bypasses selectRole() UI method"
  missing:
    - "After showLobbyView(), call this.selectRole(data.assignedRole) which properly sets selectedRole, sends server message, AND triggers panel updaters"
    - "Remove the manual selectedRole set at line 522 and the delayed room.send at lines 528-531"
  debug_session: ".planning/debug/lobby-char-select-no-highlight.md"

- truth: "Browser refresh reconnects the refreshed player without disrupting other connected players"
  status: failed
  reason: "User reported: It worked for the browser that I closed and then reopened, however for the other ones it didnt reconnect. Instead it says reconnecting and counting, after a while it returns to the lobby."
  severity: major
  test: 8
  root_cause: "GameRoom is missing onUncaughtException handler. In Colyseus 0.15, the framework only wraps setSimulationInterval/clock/onMessage callbacks in try/catch when onUncaughtException is defined. Without it, any unhandled error during reconnection propagates to Node.js event loop, crashing the process. ts-node-dev --respawn silently restarts, terminating ALL WebSocket connections for ALL clients."
  artifacts:
    - path: "server/src/rooms/GameRoom.ts"
      issue: "Class level: missing onUncaughtException handler. Lines 234-249: onLeave reconnection path has no defensive checks. Lines 277-435: fixedTick runs without try/catch wrapper"
  missing:
    - "Add onUncaughtException(err, methodName) handler to GameRoom class to enable Colyseus try/catch wrapping"
    - "Add defensive checks in reconnection success path (validate player still exists/alive)"
    - "Add process.on('uncaughtException') and process.on('unhandledRejection') to server entry point as safety net"
  debug_session: ".planning/debug/reconnect-disrupts-other-players.md"

- truth: "Lobby refresh reconnection works reliably, preserving seat and role selection"
  status: failed
  reason: "User reported: This only works some times - most of the times it still goes back to the lobby. When it doesnt work, I see a quick flash of yellow text trying to reconnect. Think hard of how to fix this."
  severity: major
  test: 10
  root_cause: "Lobby reconnection at line 51 makes a single reconnect attempt with zero retries. Server needs ~9s (ping timeout) to detect F5 disconnect and register token in _reconnections map. Client's single attempt fires in ~1s, before server has processed the disconnect. The game reconnection path already has 12 retries with 1000ms delay, but this fix was never applied to lobby reconnection."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Lines 50-70: single reconnect attempt with no retry loop. Lines 114-132: game reconnection has MAX_RETRIES=12, RETRY_DELAY=1000 (the fix that was never applied to lobby)"
  missing:
    - "Add same retry loop to lobby reconnection (12 retries, 1000ms delay) matching the game reconnection pattern at lines 114-132"
    - "Show reconnection attempt progress in status text"
  debug_session: ".planning/debug/lobby-reconnect-flaky.md"

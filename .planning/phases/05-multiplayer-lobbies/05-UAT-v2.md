---
status: fixed
phase: 05-multiplayer-lobbies
source: 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md, 05-07-SUMMARY.md
started: 2026-02-10T22:00:00Z
updated: 2026-02-10T22:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create Private Room & Room Code
expected: From the lobby menu, click "Create Private Room". A lobby view appears with a 6-character room code displayed in yellow at the top. The code should appear even if there's a brief delay (state listener handles race condition).
result: pass

### 2. Join Private Room by Code
expected: From a second browser tab, click "Join Private Room". Enter the room code from tab 1. You join the same lobby and see the other player in the player list.
result: issue
reported: "Some letters doesnt work when entering the code, for example the letter D and S. When joining a room, a character is sometimes already highlighted as selected. This cause confusion, as that same character can be selected in multiple browsers."
severity: major

### 3. Character Selection Highlight
expected: In the lobby, click on a character panel (Paran, Faran, or Baran). The selected character gets an immediate green border. If another player already selected that role, it should appear grayed out and not be selectable.
result: issue
reported: "If I refresh the browser, im back to the main menu. And when trying to join the room again the room is not found. After a while, the spot gets available again - probably due to some timeout mechanism. Though I can rejoin the room. If all players has selected a character, there is no way to swap with another player as I cant deselect the character so that another player can select it."
severity: major

### 4. Ready System & Countdown
expected: After selecting a character, click Ready — it shows your status as ready. When all 3 players are ready with valid roles (1 Paran + 1 Faran + 1 Baran), a 3-second countdown appears (3, 2, 1).
result: pass

### 5. All 3 Players Enter Game with Correct Roles
expected: After the countdown, ALL 3 players transition to the GameScene. Each player's character matches what they selected in the lobby. No player gets kicked back to lobby.
result: issue
reported: "For one player in the corner is says 'Waiting for players...(3/3)', for the second player it says 'Match started!' and the third 'Connected: <playername>'. It is inconsistent."
severity: minor

### 6. Find Match (Matchmaking Queue)
expected: Click "Find Match" from the lobby menu. A role selection appears. After selecting a role, an animated "Searching..." message shows with queue counts. When enough players queue (1 Paran + 2 Guardians), all are placed into a lobby with pre-assigned roles.
result: pass

### 7. Disconnected Player Ghosting
expected: During a match, if a player closes their browser tab, remaining players see that player's sprite become ghosted (30% opacity) with a yellow "DC" label. The disconnected player is frozen in place.
result: pass

### 8. Browser Refresh Reconnection
expected: During an active match, press F5 to refresh. Instead of showing the lobby menu, the game should automatically reconnect you to the active match within a few seconds. You return at your previous position.
result: issue
reported: "It looks like it tries to reconnect - however after a short while it said 'Session expired'. The server logs says: '❌ reconnection token invalid or expired. Did you missed .allowReconnection()? 👉 https://docs.colyseus.io/server/room/#allowreconnection-client-seconds'"
severity: blocker

### 9. Victory Screen Returns to Lobby
expected: After a match ends and the victory screen shows, clicking "Return to Lobby" takes you back to the LobbyScene with the main menu (Create/Join/Find Match buttons).
result: pass

## Summary

total: 9
passed: 5
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Room code input accepts all valid characters; no false highlight on join"
  status: failed
  reason: "User reported: Some letters doesnt work when entering the code, for example the letter D and S. When joining a room, a character is sometimes already highlighted as selected. This cause confusion, as that same character can be selected in multiple browsers."
  severity: major
  test: 2
  root_cause: "Phaser keyboard manager intercepts keydown events (preventDefault) before HTML input receives them. D/S are WASD keys captured by Phaser. No keyboard.enabled=false on input focus. Character pre-highlight: selectedRole persists across sessions (never reset in showLobbyView/showMainMenu)."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "showJoinInput() creates HTML input without disabling Phaser keyboard; selectedRole never reset on menu/lobby transitions"
  missing:
    - "Disable Phaser keyboard (this.input.keyboard.enabled=false) on HTML input focus, re-enable on blur"
    - "Reset this.selectedRole=null in showLobbyView() and showMainMenu()"
  debug_session: ".planning/debug/room-code-input-keys.md"

- truth: "Players can deselect/swap characters; lobby refresh doesn't lose room seat"
  status: failed
  reason: "User reported: If I refresh the browser, im back to the main menu. And when trying to join the room again the room is not found. After a while, the spot gets available again - probably due to some timeout mechanism. Though I can rejoin the room. If all players has selected a character, there is no way to swap with another player as I cant deselect the character so that another player can select it."
  severity: major
  test: 3
  root_cause: "Two issues: (1) No lobby reconnection token stored — client only stores game room tokens. On refresh, goes to main menu. Old seat reserved for 30s (allowReconnection grace). Rejoin fails because room is full (3 players, 1 disconnected). Error swallowed as generic 'Room not found'. (2) Character deselect never implemented — selectRole() always selects, never toggles. No deselectRole message handler on server."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "No lobby token in localStorage; selectRole() has no toggle; joinPrivateRoom catch shows generic error"
    - path: "server/src/rooms/LobbyRoom.ts"
      issue: "No deselectRole message handler"
  missing:
    - "Add deselectRole: if clicking already-selected role, send deselectRole message, set selectedRole=null"
    - "Server: add deselectRole handler that clears player.role and player.ready"
    - "Store lobby reconnection token in localStorage, check on LobbyScene.create()"
    - "Show actual error in joinPrivateRoom catch (room full vs not found)"
  debug_session: ".planning/debug/character-deselect-lobby-refresh.md"

- truth: "All 3 players see consistent match status text on game start"
  status: failed
  reason: "User reported: For one player in the corner is says 'Waiting for players...(3/3)', for the second player it says 'Match started!' and the third 'Connected: <playername>'. It is inconsistent."
  severity: minor
  test: 5
  root_cause: "Three race conditions: (1) Line 101 unconditionally sets 'Waiting for players...(size/3)' — if size already 3 on initial sync, shows (3/3) permanently. (2) matchStart broadcast is one-shot; clients that register handler late miss it. (3) 2s delayed callback replaces 'Match started!' with 'Connected: sessionId' — confusing."
  artifacts:
    - path: "client/src/scenes/GameScene.ts"
      issue: "Lines 101, 134-141, 188: Multiple uncoordinated statusText.setText paths race based on join timing"
  missing:
    - "Use Schema-based matchState listener instead of one-shot broadcast for status text"
    - "Check initial matchState on connect (skip waiting text if already 'playing')"
    - "Remove 'Connected: sessionId' fallback, hide status text after 2s instead"
  debug_session: ".planning/debug/inconsistent-status-text.md"

- truth: "Browser refresh during active match auto-reconnects to game"
  status: failed
  reason: "User reported: It looks like it tries to reconnect - however after a short while it said 'Session expired'. The server logs says: '❌ reconnection token invalid or expired. Did you missed .allowReconnection()? 👉 https://docs.colyseus.io/server/room/#allowreconnection-client-seconds'"
  severity: blocker
  test: 8
  root_cause: "Race condition: client retry window (3 retries * 800ms = 2.4s) is shorter than server's worst-case disconnect detection (ping timeout ~9s). Browser may not send WebSocket close frame on F5 — server relies on ping/pong timeout. All client reconnection attempts arrive before allowReconnection is called."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Lines 69-70: MAX_RETRIES=3, RETRY_DELAY=800ms — total retry window 2.4s, insufficient for 9s ping timeout"
  missing:
    - "Increase MAX_RETRIES to 12 and RETRY_DELAY to 1000ms (12s window > 9s ping timeout)"
  debug_session: ".planning/debug/reconnection-allow-reconnection.md"

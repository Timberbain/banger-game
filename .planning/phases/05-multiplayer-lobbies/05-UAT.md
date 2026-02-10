---
status: diagnosed
phase: 05-multiplayer-lobbies
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md
started: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create Private Room
expected: From the lobby menu, click "Create Private Room". A lobby view appears with a 6-character room code displayed in yellow at the top. Code uses only unambiguous characters. Character selection panels visible below.
result: issue
reported: "creating a private room doesnt show any code"
severity: major

### 2. Join Private Room by Code
expected: From a second browser tab, click "Join Private Room". An HTML text input appears for the room code. Enter the code from the first tab. You should join the same lobby and see the other player in the player list.
result: pass

### 3. Character Selection
expected: In the lobby view, click on a character panel (Paran, Faran, or Baran). The selected character gets a green border. If another player already has that role, it should appear grayed out (50% opacity) and not be selectable.
result: issue
reported: "When clicking on a character, it is not getting highlighted"
severity: major

### 4. Ready System & Countdown
expected: After selecting a character, the Ready button becomes active. Click Ready — it turns green and shows your status as ready (checkmark) in the player list. When all 3 players are ready with valid roles (1 Paran + 1 Faran + 1 Baran), a 3-second countdown appears (3, 2, 1).
result: issue
reported: "After the countdown, 2 out of 3 players enters the game, the last player is sent back to the lobby. When refreshing the window which was returned to the lobby I get a message Session expired."
severity: blocker

### 5. Game Transition from Lobby
expected: After the countdown completes, the game automatically transitions to the GameScene. Your assigned character matches what you selected in the lobby. All 3 players spawn in the arena at role-appropriate positions.
result: issue
reported: "No, The one that selected Paran gets kicked out. The one that selected Baran, becomes Paran."
severity: blocker

### 6. Victory Screen Returns to Lobby
expected: After a match ends and the victory screen shows stats, clicking "Return to Lobby" takes you back to the LobbyScene (not the boot/loading screen). You should see the main menu with Create/Join/Find Match buttons again.
result: skipped
reason: Unable to test - game can't proceed when one player gets kicked out (2/3 players, blocked by test 4/5 issues)

### 7. Disconnected Player Indicator
expected: During a match, if a player disconnects (close their browser tab), remaining players should see that player's sprite become ghosted (30% opacity) with a yellow "DC" label below them. The disconnected player should be frozen in place (not moving).
result: issue
reported: "If a player disconnects, it just gets removed from the screen - no indication of ghosting."
severity: major

### 8. Browser Refresh Reconnection
expected: During an active match, press F5 to refresh the browser. Instead of showing the lobby menu, the game should automatically reconnect you to the active match within a few seconds. You return to the game at your previous position.
result: issue
reported: "This doesnt happen, instead it just says Session expired. After refreshing again, im returned to the lobby."
severity: major

### 9. Find Match (Matchmaking)
expected: Click "Find Match" from the lobby menu. A role selection screen appears with Paran, Faran, and Baran buttons. After selecting a role, an animated "Searching for match..." message appears. When enough players queue (1 Paran + 2 Guardians), you are placed into a lobby together.
result: issue
reported: "When selecting a preferred role, there is no animated searching for match. Instead im sent directly to a game lobby, as if I created a private room."
severity: major

## Summary

total: 9
passed: 1
issues: 7
pending: 0
skipped: 1

## Gaps

- truth: "Private room code displayed prominently in yellow at the top of lobby view"
  status: failed
  reason: "User reported: creating a private room doesnt show any code"
  severity: major
  test: 1
  root_cause: "Race condition: showLobbyView() runs before Colyseus initial state sync. room.state.roomCode is still empty string when display condition evaluates. No state.listen('roomCode') callback exists to re-render when state arrives."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Line 393: room code display condition runs once synchronously before state sync, no listener for roomCode changes"
  missing:
    - "Add room.state.listen('roomCode', ...) callback in showLobbyView() to create/update room code text when value arrives"
  debug_session: ".planning/debug/private-room-code-not-displayed.md"

- truth: "All 3 players transition from lobby to game after countdown completes"
  status: failed
  reason: "User reported: After the countdown, 2 out of 3 players enters the game, the last player is sent back to the lobby."
  severity: blocker
  test: 4
  root_cause: "matchMaker.create() returns a SeatReservation, consuming 1 of 3 maxClients slots. Only 2 real clients can join; the 3rd gets rejected."
  artifacts:
    - path: "server/src/rooms/LobbyRoom.ts"
      issue: "Line 255: matchMaker.create() reserves a phantom seat instead of matchMaker.createRoom() which creates without reservation"
  missing:
    - "Change matchMaker.create() to matchMaker.createRoom() in LobbyRoom.startMatch()"
  debug_session: ".planning/debug/lobby-to-game-transition.md"

- truth: "Player's assigned character in GameScene matches lobby selection; all 3 players enter game"
  status: failed
  reason: "User reported: The one that selected Paran gets kicked out. The one that selected Baran, becomes Paran."
  severity: blocker
  test: 5
  root_cause: "roleAssignments keyed by lobby sessionIds, but clients get new sessionIds in GameRoom. Lookup always fails, falls back to join-order assignment. GameRoom.onJoin() also ignores options.role sent by client."
  artifacts:
    - path: "server/src/rooms/LobbyRoom.ts"
      issue: "Lines 248-251: roleAssignments built with lobby sessionIds that won't match game sessionIds"
    - path: "server/src/rooms/GameRoom.ts"
      issue: "Lines 132-143: Looks up roleAssignment by game sessionId (always misses), never reads options.role"
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Line 458: Sends role in join options but server never reads it"
  missing:
    - "Have GameRoom.onJoin() read role from options.role (already sent by client) with validation, instead of sessionId lookup"
  debug_session: ".planning/debug/lobby-to-game-transition.md"

- truth: "Matchmaking shows animated searching message and queues players until match formed"
  status: failed
  reason: "User reported: When selecting a preferred role, there is no animated searching for match. Instead im sent directly to a game lobby, as if I created a private room."
  severity: major
  test: 9
  root_cause: "Matchmaking pipeline scaffolded but never wired up. Client calls joinOrCreate('lobby_room') which resolves immediately (creates/joins room). Server ignores matchmaking flag. MatchmakingQueue is dead code — never populated, results never consumed. TODO comment in LobbyRoom acknowledges incomplete implementation."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Line 364: joinOrCreate resolves immediately, 'Searching...' UI destroyed within ms. Never sends joinQueue message."
    - path: "server/src/rooms/LobbyRoom.ts"
      issue: "Lines 16-27: onCreate ignores matchmaking flag. Lines 93-96: tryFormMatch result discarded with TODO comment."
    - path: "server/src/rooms/MatchmakingQueue.ts"
      issue: "Queue logic correct but is dead code — never populated, results never consumed"
  missing:
    - "Need dedicated matchmaking flow: either a MatchmakingRoom where players wait, or HTTP queue with server-side orchestration. Client must NOT call joinOrCreate for matchmaking."
  debug_session: ".planning/debug/matchmaking-skips-search.md"

- truth: "Browser refresh during active match auto-reconnects to game at previous position"
  status: failed
  reason: "User reported: This doesnt happen, instead it just says Session expired. After refreshing again, im returned to the lobby."
  severity: major
  test: 8
  root_cause: "Two issues: (1) Primary: server/dist/ contains stale Phase 1 code without allowReconnection — if running npm start, reconnection is impossible. (2) Secondary: Race condition on F5 — reconnect request may arrive before server processes WebSocket close and registers token in _reconnections map."
  artifacts:
    - path: "server/dist/rooms/GameRoom.js"
      issue: "Stale compiled code (Feb 9) — onLeave immediately deletes player, no allowReconnection"
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "checkReconnection() at line 68 needs retry/delay for race condition"
  missing:
    - "Rebuild dist/ with npm run build in server/"
    - "Add retry logic (2-3 attempts with 500ms delay) to checkReconnection()"
  debug_session: ".planning/debug/reconnect-session-expired.md"

- truth: "Disconnected player shown ghosted (30% opacity) with DC label, frozen in place"
  status: failed
  reason: "User reported: If a player disconnects, it just gets removed from the screen - no indication of ghosting."
  severity: major
  test: 7
  root_cause: "Three issues: (1) For consented leaves, server sets connected=false then immediately deletes player in same sync block — onRemove fires and destroys all sprites before ghosted state can render. (2) attachRoomListeners() after reconnect is missing all state schema listeners (players.onAdd, onRemove, onChange, projectiles). (3) DC label shares eliminatedTexts map causing wrong positioning."
  artifacts:
    - path: "server/src/rooms/GameRoom.ts"
      issue: "onLeave sets connected=false then immediately deletes for consented leaves in same patch"
    - path: "client/src/scenes/GameScene.ts"
      issue: "attachRoomListeners() (lines 697-736) missing state schema listeners; onRemove unconditionally destroys sprites; DC label shares eliminatedTexts map"
  missing:
    - "For non-consented disconnects, verify onChange fires correctly with the connected=false change before allowReconnection blocks"
    - "attachRoomListeners() must re-register all state listeners (players.onAdd, onRemove, onChange, projectiles.onAdd, onRemove)"
    - "Separate DC label tracking from eliminatedTexts map"
  debug_session: ".planning/debug/disconnected-player-not-ghosted.md"

- truth: "Selected character gets a green border (4px stroke) when clicked"
  status: failed
  reason: "User reported: When clicking on a character, it is not getting highlighted"
  severity: major
  test: 3
  root_cause: "Two bugs: (1) onAdd callback only calls updatePanel() once but doesn't register onChange on newly added players — so when player.role changes after selection, updatePanel never re-fires. (2) selectRole() sets this.selectedRole locally but triggers no immediate visual update, relying entirely on broken onChange callback."
  artifacts:
    - path: "client/src/scenes/LobbyScene.ts"
      issue: "Line 560: onAdd callback doesn't register onChange on new players. Line 670-675: selectRole() has no immediate UI update."
  missing:
    - "onAdd callback must register player.onChange(() => updatePanel()) on each newly added player"
    - "selectRole() should call updatePanel() immediately after setting this.selectedRole for optimistic UI"
  debug_session: ".planning/debug/lobby-char-select-no-highlight.md"

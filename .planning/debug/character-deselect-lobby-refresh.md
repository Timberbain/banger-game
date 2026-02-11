---
status: resolved
trigger: "Two issues: (1) lobby refresh loses room seat, room not found on rejoin. (2) No way to deselect/swap characters once all selected."
created: 2026-02-10T23:00:00Z
updated: 2026-02-10T23:15:00Z
---

## Current Focus

hypothesis: Two distinct root causes confirmed -- see Resolution
test: n/a (analysis complete)
expecting: n/a
next_action: Apply fixes per recommendations below

## Symptoms

expected: (1) Lobby should handle browser refresh gracefully (reconnect or release seat quickly). (2) Players should be able to click their selected character to deselect it, freeing the role for others.
actual: (1) Browser refresh in lobby returns to main menu; re-entering room code returns "Room not found"; seat frees after ~30s timeout. (2) Once all 3 characters are selected, no player can deselect -- no way to swap roles.
errors: "Room not found" on rejoin after refresh (HTTP 404 from /rooms/find endpoint)
reproduction: (1) Create private lobby, join with 2nd player, refresh browser -> back to menu, enter code -> room not found. (2) Have all 3 players select characters -> none can deselect.
started: Always broken (feature never implemented for deselect; lobby reconnect not implemented)

## Eliminated

(none -- root causes identified on first analysis)

## Evidence

- timestamp: 2026-02-10T23:02:00Z
  checked: server/src/rooms/LobbyRoom.ts onLeave() (lines 126-159)
  found: LobbyRoom uses allowReconnection(client, 30) for non-consented leaves. During this 30s grace period, the player's seat remains occupied (player stays in state.players map with connected=false). The room still has maxClients=3.
  implication: The room IS still running during grace period, but the seat is occupied -- a new joinById would be rejected because the room is full (3 players, one disconnected but still reserved).

- timestamp: 2026-02-10T23:03:00Z
  checked: client/src/scenes/LobbyScene.ts checkReconnection() (lines 33-124)
  found: The reconnection system only stores/checks 'bangerActiveRoom' token, which is set at line 600 when transitioning to GameScene. There is NO reconnection token stored when joining a LobbyRoom. The lobby only stores a game room token.
  implication: When a player refreshes in the lobby, there is no stored lobby reconnection token. The client goes straight to showMainMenu(). The player tries to rejoin as a NEW player via room code, but the old seat is still reserved for 30s.

- timestamp: 2026-02-10T23:04:00Z
  checked: server/src/index.ts /rooms/find endpoint (lines 51-74)
  found: The endpoint queries matchMaker.query({ name: "lobby_room" }) and finds rooms by metadata.roomCode. Private rooms use setPrivate(true) which hides them from matchmaking but NOT from matchMaker.query(). The room IS findable during grace period.
  implication: The room IS found by the HTTP endpoint. But when the client tries client.joinById(roomId), it fails because the room is at maxClients (3 players -- 2 real + 1 disconnected awaiting reconnection). The error may manifest as a different error, not literally "room not found" but a "room is full" or similar that the client catches and displays as "Room not found!".

- timestamp: 2026-02-10T23:05:00Z
  checked: client/src/scenes/LobbyScene.ts joinPrivateRoom() (lines 279-313)
  found: The catch block at line 303-312 catches ANY error and shows "Room not found!" text. So whether the actual error is "room is full", "room not found", or anything else, the user always sees "Room not found!". This is misleading.
  implication: The actual server error is likely "room is full" (seat reserved), but the client swallows it and shows generic "Room not found!".

- timestamp: 2026-02-10T23:06:00Z
  checked: client/src/scenes/LobbyScene.ts selectRole() (lines 821-828)
  found: selectRole() unconditionally sets this.selectedRole = role and sends 'selectRole' message. There is NO check for "am I clicking my already-selected role?" and NO deselect logic. The method always selects, never deselects.
  implication: Once a role is selected, there's no way to clear it client-side.

- timestamp: 2026-02-10T23:07:00Z
  checked: server/src/rooms/LobbyRoom.ts 'selectRole' message handler (lines 29-59)
  found: The server handler validates the role and checks if another player has it. If valid and available, it sets player.role = role. There is NO 'deselectRole' message handler. There is also no logic for "if player already has this role, clear it".
  implication: Neither client nor server supports deselecting a role. This feature was never implemented.

- timestamp: 2026-02-10T23:08:00Z
  checked: client/src/scenes/LobbyScene.ts createCharacterSelection() panel click handler (lines 669-673)
  found: The click handler only fires if isRoleAvailable(char.role) is true. isRoleAvailable() (lines 830-842) checks if another player has the role. If the current player has it, it returns true (it excludes self), so the player can click their own role but it just re-selects the same role (no-op on server). However, roles taken by OTHER players are grayed out and disableInteractive() is called (line 688), so they can't even click to attempt selection.
  implication: UI prevents clicking other players' roles (correct) but clicking own role just re-sends same selectRole (pointless, should toggle off).

## Resolution

root_cause: |
  **Issue 1 - Lobby Refresh:** Two compounding problems:
  (A) The client never stores a lobby reconnection token (only stores game room tokens at line 600). So on browser refresh, checkReconnection() finds no token and shows the main menu.
  (B) When the player tries to rejoin via room code, the old session's seat is still reserved by allowReconnection(client, 30) for 30 seconds. The room is at maxClients=3 (2 connected + 1 disconnected-but-reserved), so joinById fails. The client catch block (line 303) shows "Room not found!" for ANY error, masking the real "room full" error.

  **Issue 2 - Character Deselect:** The feature simply doesn't exist. Neither the client selectRole() method nor the server 'selectRole' message handler support toggling/deselecting a role. Once selected, a role can only be changed to a different available role, never cleared. When all 3 roles are taken, no swapping is possible.

fix: |
  **Issue 1 Fix (Lobby Reconnection):**
  - Store lobby reconnection token in localStorage (separate key like 'bangerLobbyRoom') when joining a lobby room
  - In LobbyScene.create(), check for lobby token FIRST, attempt client.reconnect(token)
  - On successful reconnect, call showLobbyView() instead of showMainMenu()
  - Clear lobby token when leaving lobby intentionally or transitioning to game
  - Consider showing the actual error message in joinPrivateRoom() catch block instead of always "Room not found!"

  **Issue 2 Fix (Character Deselect):**
  - Client: In selectRole(), check if role === this.selectedRole. If so, send 'deselectRole' message and set this.selectedRole = null
  - Server: Add 'deselectRole' message handler that sets player.role = '' and player.ready = false
  - UI: The panel click handler already allows clicking own role (isRoleAvailable returns true for self). Just need selectRole() to toggle.

verification: (not yet verified)
files_changed: []

## Files Involved

- server/src/rooms/LobbyRoom.ts
  - Line 29-59: selectRole handler -- needs deselect logic (either toggle in same handler or add new deselectRole handler)
  - Line 126-159: onLeave -- allowReconnection works but client never uses it
  - Missing: 'deselectRole' message handler

- client/src/scenes/LobbyScene.ts
  - Line 33-124: checkReconnection() -- only checks game room token, not lobby token
  - Line 279-313: joinPrivateRoom() -- catch swallows real error, shows generic "Room not found!"
  - Line 502-613: showLobbyView() -- no lobby token storage for reconnection
  - Line 821-828: selectRole() -- no toggle/deselect logic
  - Line 669-673: panel click handler -- needs to also handle deselect case

- shared/lobby.ts
  - Line 8: LOBBY_RECONNECT_GRACE is 30s (reasonable, but useless without client reconnection support)

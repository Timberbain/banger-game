---
status: diagnosed
trigger: "After lobby countdown, only 2 of 3 players enter the game. Paran player gets kicked back to lobby. Baran becomes Paran in game (wrong role assignment)."
created: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes: (1) sessionId mismatch causes roleAssignment lookup to miss all players, triggering join-order fallback, and (2) maxClients=3 blocks the 3rd player
test: Full code trace of lobby-to-game transition
expecting: Evidence of sessionId mismatch + maxClients race
next_action: Return diagnosis

## Symptoms

expected: All 3 players transition to GameScene with lobby-selected roles preserved
actual: Only 2 of 3 players enter game. Paran player kicked back to lobby. Baran becomes Paran in game.
errors: Unknown - need to investigate
reproduction: Start lobby with 3 players (Paran, Faran, Baran), complete countdown
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-02-10T12:05:00Z
  checked: LobbyRoom.startMatch() role assignment construction (lines 248-251)
  found: roleAssignments maps LOBBY sessionId -> role. E.g. { "lobbySession_abc": "paran", "lobbySession_def": "faran", "lobbySession_ghi": "baran" }
  implication: The keys in roleAssignments are the sessionIds from the LobbyRoom connection

- timestamp: 2026-02-10T12:06:00Z
  checked: matchMaker.create() return type (MatchMaker.d.ts line 55)
  found: matchMaker.create() returns Promise<SeatReservation> = { sessionId, room: RoomListingData }. It creates the room AND reserves ONE seat. The SeatReservation.sessionId is for the caller (server-side), not a player.
  implication: matchMaker.create() only creates the room, it does NOT reserve seats for the 3 lobby players

- timestamp: 2026-02-10T12:08:00Z
  checked: LobbyRoom broadcasts gameReady with { gameRoomId: reservation.room.roomId } (lines 261-263)
  found: Server sends only the roomId. Does not send seat reservations. Clients must independently call client.joinById()
  implication: Clients join the GameRoom as NEW connections, getting NEW sessionIds from the GameRoom

- timestamp: 2026-02-10T12:10:00Z
  checked: Client gameReady handler (LobbyScene.ts lines 447-474)
  found: Client flow: (1) await this.room.leave() - leaves lobby, (2) await this.client.joinById(gameRoomId, { name, fromLobby: true, role: this.selectedRole }) - joins game room
  implication: Each client gets a BRAND NEW sessionId when joining the GameRoom. The lobby sessionId is discarded.

- timestamp: 2026-02-10T12:12:00Z
  checked: GameRoom.onJoin() role assignment lookup (lines 131-144)
  found: Line 132 checks `this.roleAssignments[client.sessionId]` - but client.sessionId is the NEW GameRoom sessionId, NOT the lobby sessionId stored in roleAssignments
  implication: CRITICAL BUG - roleAssignment lookup ALWAYS fails because keys are lobby sessionIds but lookup uses game sessionIds. Every player falls through to join-order fallback.

- timestamp: 2026-02-10T12:14:00Z
  checked: GameRoom.onJoin() fallback role assignment (lines 136-143)
  found: Fallback assigns based on this.state.players.size: 0->paran, 1->faran, 2->baran
  implication: First client to connect becomes paran regardless of lobby role selection. This explains why Baran becomes Paran (if Baran client's joinById resolves first).

- timestamp: 2026-02-10T12:16:00Z
  checked: GameRoom.maxClients and lock behavior (line 11 + line 178-179)
  found: maxClients=3. Line 178: when players.size === maxClients, startMatch() is called which calls this.lock(). matchMaker.create() itself reserves 1 seat internally.
  implication: matchMaker.create() reserves a seat for the server-side call. 3 clients try to join a room that might already have 1 seat reserved by create(), leaving only 2 slots for actual players. The 3rd player gets rejected.

- timestamp: 2026-02-10T12:20:00Z
  checked: Colyseus matchMaker.create() vs createRoom() (MatchMaker.d.ts lines 55 vs 113)
  found: create() returns SeatReservation (reserves a seat), createRoom() returns RoomListingData (no seat reservation). LobbyRoom uses create() instead of createRoom().
  implication: BUG #2 - Using matchMaker.create() reserves a phantom seat, reducing available slots from 3 to 2. The 3rd player client cannot join because maxClients is reached.

## Resolution

root_cause: |
  TWO interacting bugs in the lobby-to-game transition:

  BUG 1 (Wrong role assignment - Baran becomes Paran):
  LobbyRoom.startMatch() builds roleAssignments keyed by LOBBY sessionIds, but when clients
  join the GameRoom via client.joinById(), they get NEW sessionIds. GameRoom.onJoin() looks up
  this.roleAssignments[client.sessionId] using the new GameRoom sessionId, which never matches
  any lobby sessionId. The lookup always returns undefined, so every player falls through to the
  join-order fallback (playerCount 0->paran, 1->faran, 2->baran). Role assignment is effectively
  random based on which client's joinById() resolves first.

  BUG 2 (Paran player gets kicked - only 2 of 3 enter):
  LobbyRoom uses matchMaker.create() (line 255) which reserves a seat internally, consuming 1
  of the 3 maxClients slots. When the 3 clients try to joinById(), only 2 slots remain. The 3rd
  client gets rejected and falls into the catch block (line 469), which calls showMainMenu() -
  kicking them back to the lobby.

fix:
verification:
files_changed: []

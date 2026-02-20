---
status: diagnosed
trigger: "Lobby refresh reconnection is flaky. When multiple browsers refresh while in a lobby, only ~1 reconnects. Others time out after 12 attempts. Additionally, after a failed lobby reconnection, the player cannot rejoin via matchmaker."
created: 2026-02-11T12:00:00Z
updated: 2026-02-11T12:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes found: (1) shared localStorage key overwrites tokens, (2) room stays locked/full during reconnect grace period
test: Traced full reconnection flow through client localStorage, Colyseus matchmaker, Room._reserveSeat, and Room._onLeave
expecting: Found both issues with evidence
next_action: Return diagnosis

## Symptoms

expected: When multiple browsers (e.g., 3 players in lobby) all F5 refresh simultaneously, all should reconnect to the same lobby
actual: Only ~1 of the players successfully reconnects. Others fail after 12 retry attempts (12 seconds)
errors: Failed reconnection attempts in client console ("reconnection token invalid or expired")
reproduction: Have 3 players in a lobby room (using tabs in same browser), all press F5 simultaneously
started: Phase 5 - lobby reconnection feature

Additional issue: After a failed lobby reconnection, the player cannot rejoin via matchmaker

## Eliminated

- hypothesis: Colyseus Room._reserveSeat blocks concurrent reconnections due to maxClients
  evidence: _reserveSeat with allowReconnection=true explicitly SKIPS the hasReachedMaxClients() check (Room.js line 484). All 3 reconnection seats can be reserved independently. Verified by reading the Colyseus core source.
  timestamp: 2026-02-11T12:10:00Z

- hypothesis: allowReconnection's cleanup() invalidates other clients' tokens
  evidence: Each client has a unique sessionId and _reconnectionToken. cleanup() only deletes the specific client's entries from _reconnections, reservedSeats, reservedSeatTimeouts, and _reconnectingSessionId. Other clients' entries are untouched.
  timestamp: 2026-02-11T12:12:00Z

- hypothesis: Room auto-disposes when all 3 clients disconnect simultaneously
  evidence: _disposeIfEmpty() checks #_onLeaveConcurrent === 0 (false during onLeave), clients.length === 0, AND Object.keys(reservedSeats).length === 0. While allowReconnection is pending, reservedSeats has entries, AND #_onLeaveConcurrent > 0. Room cannot auto-dispose during reconnection window.
  timestamp: 2026-02-11T12:14:00Z

- hypothesis: Server reconnect endpoint (matchMaker.reconnect) has race condition between concurrent requests
  evidence: matchMaker.reconnect only reads state (driver.findOne, checkReconnectionToken). checkReconnectionToken reads from _reconnections Map and sets _reconnectingSessionId Map. Each client's token maps to a unique sessionId. No shared mutable state between different clients' reconnection paths.
  timestamp: 2026-02-11T12:16:00Z

## Evidence

- timestamp: 2026-02-11T12:05:00Z
  checked: LobbyScene.ts showLobbyView() localStorage token storage (lines 622-629)
  found: All browser tabs/windows in the same browser share one localStorage. The key 'bangerLobbyRoom' stores a SINGLE token object: { token, roomId, timestamp }. Each tab writes its OWN reconnectionToken to the SAME key. The last tab to call showLobbyView() overwrites all previous tokens.
  implication: PRIMARY ROOT CAUSE for "only ~1 reconnects." When multiple tabs refresh, they all read the same token (the last one written). Only the client whose token was preserved can reconnect. Others use an invalid token.

- timestamp: 2026-02-11T12:07:00Z
  checked: Colyseus reconnection token storage in Room.js allowReconnection (line 406-409)
  found: Each client has a unique _reconnectionToken (generated in _onJoin at line 310). allowReconnection stores this in _reconnections[reconnectionToken] = [sessionId, deferred]. The server correctly stores ALL three tokens separately. But the CLIENT localStorage only stores ONE.
  implication: The server is ready for all 3 reconnections. The client side is the bottleneck.

- timestamp: 2026-02-11T12:10:00Z
  checked: Room.js hasReachedMaxClients and _incrementClientCount during disconnect+reconnect cycle
  found: When 3 clients are in the room, the listing shows clients=3 and room is locked (_maxClientsReached=true). When clients disconnect, allowReconnection does NOT decrement client count. The listing STILL shows 3 clients and the room remains locked. Reconnection seats are added to reservedSeats but don't affect listing client count.
  implication: A new player CANNOT join the room (via joinById or room code) while disconnected players' reconnection grace period is active. The room appears full AND locked.

- timestamp: 2026-02-11T12:15:00Z
  checked: What happens when failed reconnection players try to rejoin (matchmaker flow)
  found: After failed reconnection (12 retries exhausted), client clears localStorage token and shows main menu. If user tries to rejoin the same room via room code, matchMaker.joinById checks room.locked (true) and throws MATCHMAKE_INVALID_ROOM_ID. If user tries "Find Match" via matchmaking room, that should work (creates/joins separate matchmaking room). The "can't rejoin" issue specifically affects rejoining the SAME lobby room, not matchmaking for new lobbies.
  implication: SECONDARY ISSUE - The room stays locked with 3 client seats (even though only 1 is connected) for up to 30 seconds (LOBBY_RECONNECT_GRACE). During this window, the 2 failed-reconnect clients cannot rejoin the existing room as new players.

- timestamp: 2026-02-11T12:18:00Z
  checked: _decrementClientCount timing for failed reconnections
  found: When allowReconnection times out (30s), the Deferred rejects. The .catch() in _onLeave calls _decrementClientCount, which also calls unlock() if _maxClientsReached was set. So after 30 seconds, room unlocks and client count drops. But by then, users have already given up.
  implication: The room eventually heals (after 30s grace period expires), but the UX is broken during the 12-30s window when clients are trying to rejoin.

- timestamp: 2026-02-11T12:20:00Z
  checked: How room.leave() interacts with the stored token (shutdown method, line 957-970)
  found: LobbyScene.shutdown() calls localStorage.removeItem('bangerLobbyRoom') and room.leave(). shutdown() fires on scene.start() transitions but NOT on F5/page reload. On F5, the stale token persists in localStorage. On clean navigation (scene transition), the token is properly cleared.
  implication: F5 behavior is correct (token persists for reconnection). But the single-key localStorage design means it only works for one tab.

## Resolution

root_cause: |
  TWO ROOT CAUSES:

  1. SHARED localStorage KEY (PRIMARY - causes "only ~1 reconnects"):
     LobbyScene.ts line 624 stores the lobby reconnection token at localStorage key 'bangerLobbyRoom'.
     This is a SINGLE key shared by all tabs/windows in the same browser. When 3 tabs are in a lobby,
     each writes its unique reconnectionToken to the same key. The last write wins. When all 3 tabs
     refresh (F5), they ALL read the SAME token from localStorage. Only the client whose token was
     preserved can successfully reconnect. The other 2 clients attempt reconnection with a token that
     belongs to a DIFFERENT session, which the server correctly rejects ("reconnection token invalid
     or expired") on every retry.

     File: client/src/scenes/LobbyScene.ts line 624
     Key code: localStorage.setItem('bangerLobbyRoom', JSON.stringify({ token: this.room.reconnectionToken, ... }))

  2. ROOM STAYS LOCKED/FULL DURING GRACE PERIOD (SECONDARY - causes "can't rejoin after failure"):
     When players disconnect, their seats remain reserved via allowReconnection() for 30 seconds
     (LOBBY_RECONNECT_GRACE). The room listing still shows 3 clients and the room is locked
     (_maxClientsReached=true). If a player's reconnection fails (wrong token), they return to the
     main menu. Attempting to rejoin the same room via room code fails because:
     - matchMaker.joinById checks room.locked and throws MATCHMAKE_INVALID_ROOM_ID
     - Even if unlocked, hasReachedMaxClients() returns true (0 clients + 3 reservedSeats >= 3)
     The room only "heals" after the 30-second grace period expires for each pending reconnection.

     File: server node_modules/@colyseus/core/build/Room.js lines 484, 136
     This is Colyseus framework behavior, not a bug per se, but the 30s window creates a bad UX.

fix:
verification:
files_changed: []

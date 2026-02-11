---
status: diagnosed
trigger: "When pressing F5 to refresh during active match, sees 'Session expired' instead of reconnecting"
created: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Stale dist/ build is primary cause; secondary race condition in F5 reconnection flow
test: Compared dist/rooms/GameRoom.js (5.4KB, Phase 1 code) vs src/rooms/GameRoom.ts (16.5KB, current)
expecting: dist/onLeave has NO allowReconnection call
next_action: Return diagnosis

## Symptoms

expected: LobbyScene detects stored reconnection token, calls client.reconnect(token), returns to active match
actual: User sees "Session expired" and is returned to the lobby
errors: "Session expired" message displayed (LobbyScene.ts catch block line 93)
reproduction: Join a GameRoom match, press F5 to refresh browser
started: Likely never worked - reconnection support added in Phase 5 but dist/ never rebuilt

## Eliminated

- hypothesis: Token not stored in localStorage
  evidence: LobbyScene stores token at line 462 after joinById resolves, GameScene re-stores at line 104. Both use gameRoom.reconnectionToken which is set during JOIN_ROOM protocol message before promise resolves.
  timestamp: 2026-02-10T12:10:00Z

- hypothesis: Token format mismatch
  evidence: SDK stores "roomId:internalToken", splits on ":" during reconnect(). generateId() uses nanoid (no colons). Server checkReconnectionToken uses internalToken as key in _reconnections map - matches what allowReconnection stored.
  timestamp: 2026-02-10T12:12:00Z

- hypothesis: Expiration check too aggressive
  evidence: Client checks elapsed > 90000ms (60s grace + 30s buffer). F5 reload takes 1-2s max. This is not the issue.
  timestamp: 2026-02-10T12:13:00Z

- hypothesis: Room locked prevents reconnection
  evidence: Colyseus matchmaker reconnect() function does NOT check room.locked (only joinById does). Room locking does not affect reconnection.
  timestamp: 2026-02-10T12:15:00Z

- hypothesis: F5 treated as consented leave
  evidence: Browser sends WS close code 1001. Server checks code === 4000 (WS_CLOSE_CONSENTED). 1001 !== 4000 = false. Non-consented path is taken correctly.
  timestamp: 2026-02-10T12:17:00Z

- hypothesis: beforeunload handler calls room.leave()
  evidence: No beforeunload handlers in client code, Phaser, or Colyseus SDK. GameScene has no shutdown() method. LobbyScene.shutdown() only calls leave() on lobby room (already left).
  timestamp: 2026-02-10T12:19:00Z

- hypothesis: CORS blocking reconnect HTTP request
  evidence: Colyseus server has built-in CORS headers with Allow-Origin: *. Express also has cors() middleware. Both handle requests correctly.
  timestamp: 2026-02-10T12:20:00Z

## Evidence

- timestamp: 2026-02-10T12:05:00Z
  checked: server/dist/rooms/GameRoom.js (compiled code)
  found: dist/GameRoom.js is 5.4KB, last modified Feb 9 22:39. It contains Phase 1 code only. The onLeave method (line 95-98) immediately calls this.state.players.delete(client.sessionId) with NO allowReconnection call. No match state machine, no lobby integration, no maps, no combat system.
  implication: If server runs from dist/ (npm start), reconnection is impossible - player is always immediately removed on disconnect.

- timestamp: 2026-02-10T12:06:00Z
  checked: server/src/rooms/GameRoom.ts (source code)
  found: Source is 16.5KB, last modified Feb 10 20:44. The onLeave method (lines 183-234) correctly marks player disconnected, checks matchState === PLAYING, and calls await this.allowReconnection(client, 60) for non-consented leaves.
  implication: Source code has correct reconnection support. If server runs from source (npm run dev), reconnection SHOULD work.

- timestamp: 2026-02-10T12:07:00Z
  checked: server/dist/index.js (compiled entry point)
  found: dist/index.js does NOT register lobby_room, has no /rooms/find endpoint, no LobbyRoom import. Only registers "game_room".
  implication: If running from dist/, the entire lobby system (lobby rooms, private rooms, matchmaking, room codes) would be non-functional. This contradicts the user's ability to play matches through lobbies.

- timestamp: 2026-02-10T12:08:00Z
  checked: server/package.json scripts
  found: "dev": "ts-node-dev --respawn --transpile-only src/index.ts" (runs source), "start": "node dist/index.js" (runs stale dist). tsconfig includes "../shared/**/*".
  implication: User must be using npm run dev for lobby system to work. Source code should be running.

- timestamp: 2026-02-10T12:15:00Z
  checked: Colyseus 0.15 server-side reconnection flow in @colyseus/core/build/Room.js
  found: allowReconnection() stores _reconnections[token] synchronously before returning deferred. checkReconnectionToken() looks up this map. _reserveSeat is called with allowReconnection=true flag. The timing between allowReconnection storage and reconnect request lookup should work.
  implication: Server-side reconnection mechanism is correct in theory.

- timestamp: 2026-02-10T12:20:00Z
  checked: Colyseus 0.15 client SDK reconnect flow in colyseus.js/build/esm/Client.mjs
  found: client.reconnect(token) splits "roomId:internalToken", sends HTTP POST to matchmake/reconnect/{roomId} with { reconnectionToken: internalToken }. On success, consumeSeatReservation creates Room, opens WebSocket with sessionId + reconnectionToken params.
  implication: Client-side reconnection flow is correct.

- timestamp: 2026-02-10T12:25:00Z
  checked: LobbyRoom.startMatch() role assignment flow
  found: roleAssignments map uses LOBBY session IDs as keys. When clients joinById to GameRoom, they get NEW session IDs. GameRoom.onJoin checks this.roleAssignments[client.sessionId] which uses game room session ID - these don't match lobby session IDs. Falls through to position-based assignment.
  implication: Secondary bug - role assignments from lobby are never used (always falls back to join-order assignment). Not related to reconnection but is a correctness issue.

## Resolution

root_cause: The server dist/ directory contains stale Phase 1 code (last built Feb 9) that predates ALL reconnection support. The compiled GameRoom.onLeave immediately deletes players without calling allowReconnection(). If the server is ever run with "npm start" instead of "npm run dev", reconnection is impossible. Additionally, even when running from source via ts-node-dev, there is a potential race condition where the F5 refresh client reconnect HTTP request could arrive at the server before the WebSocket close event is processed, meaning allowReconnection() has not yet been called and _reconnections has no entry for the token. This is a narrow window but could occur especially on fast page reloads.
fix:
verification:
files_changed: []

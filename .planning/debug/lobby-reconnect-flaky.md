---
status: diagnosed
trigger: "Lobby reconnection after F5 refresh is flaky -- works sometimes but mostly fails. User sees a quick flash of yellow 'Reconnecting...' text before falling back to main menu."
created: 2026-02-11T10:00:00Z
updated: 2026-02-11T10:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Lobby reconnection has zero retries (single attempt), same race condition as previously fixed GameRoom reconnection
test: Compared lobby reconnect code (line 51, 0 retries) vs game reconnect code (lines 114-132, 12 retries with 1000ms delay)
expecting: Single attempt fails because server hasn't processed WebSocket close yet
next_action: Return diagnosis

## Symptoms

expected: F5 refresh while in lobby should reconnect to the same lobby room within a few seconds
actual: Yellow "Reconnecting to lobby..." text flashes briefly, then falls back to main menu
errors: Console: "Lobby reconnection failed:" with matchmake error (token not yet registered)
reproduction: Join a lobby room, press F5 to refresh browser
started: Phase 5 - lobby reconnection feature added in 05-08

## Eliminated

- hypothesis: Token not stored in localStorage
  evidence: Token IS stored at LobbyScene.ts line 604-611 in showLobbyView(). Uses room.reconnectionToken which is set during JOIN_ROOM protocol. Verified format is "roomId:internalToken" which is what client.reconnect() expects.
  timestamp: 2026-02-11T10:05:00Z

- hypothesis: Token cleared by shutdown() on F5
  evidence: Phaser does NOT call scene.shutdown() on page unload. It only fires on scene.start()/stop(). The shutdown() at line 939 with localStorage.removeItem at line 942 is NOT triggered by F5. Token survives page reload.
  timestamp: 2026-02-11T10:08:00Z

- hypothesis: Token format mismatch
  evidence: Room.reconnectionToken stores "roomId:internalToken" (Room.js line 155/165). Client.reconnect() splits on ":" and sends internalToken to matchmake/reconnect/{roomId}. Server looks up _reconnections[token]. Format is consistent.
  timestamp: 2026-02-11T10:10:00Z

- hypothesis: Expiration check rejecting valid token
  evidence: LOBBY_RECONNECT_GRACE = 30s. F5 reload takes <2s. elapsed < graceMs check passes. Token is fresh enough.
  timestamp: 2026-02-11T10:11:00Z

- hypothesis: allowReconnection not called on server
  evidence: LobbyRoom.ts line 152-167: onLeave correctly checks consented. F5 sends WS close code 1001 (Going Away), not 4000 (WS_CLOSE_CONSENTED), so consented=false. Non-consented path calls allowReconnection(client, 30). Server code is correct.
  timestamp: 2026-02-11T10:13:00Z

## Evidence

- timestamp: 2026-02-11T10:05:00Z
  checked: LobbyScene.ts lobby reconnection code (lines 33-77)
  found: Lobby reconnection makes a SINGLE attempt at line 51 with ZERO retries. If client.reconnect(token) fails, it immediately catches (line 65), removes the token, and falls through to main menu.
  implication: This is the primary bug. A single attempt is insufficient due to the WebSocket close race condition.

- timestamp: 2026-02-11T10:06:00Z
  checked: LobbyScene.ts game reconnection code (lines 114-132)
  found: Game reconnection has MAX_RETRIES = 12 and RETRY_DELAY = 1000ms, giving a ~12 second retry window. This was the fix applied for the game reconnection race condition documented in reconnection-allow-reconnection.md.
  implication: The same fix was NOT applied to lobby reconnection. Two code paths with the same race condition, only one was fixed.

- timestamp: 2026-02-11T10:10:00Z
  checked: Colyseus server ping/pong timeout (@colyseus/core WebSocketTransport)
  found: pingInterval=3000ms, pingMaxRetries=2. Server detects unresponsive client after ~9 seconds (3 pings missed). If browser doesn't send WS close frame during F5, server takes 9 seconds to fire onLeave and call allowReconnection().
  implication: Client's single instant attempt vs server's potential 9-second detection window = almost guaranteed failure when close frame is not sent promptly.

- timestamp: 2026-02-11T10:12:00Z
  checked: Browser WebSocket close behavior during F5
  found: Browsers MAY send WS close frame during navigation, but it is not guaranteed. Chrome usually does, but timing varies. When close frame IS sent, server processes it immediately (~0ms), and single attempt might succeed. When NOT sent, server relies on 9-second ping timeout.
  implication: This explains the "flaky" behavior -- it works sometimes (when close frame arrives in time) but mostly fails (when it doesn't or arrives late).

- timestamp: 2026-02-11T10:15:00Z
  checked: Why "mostly fails" vs "sometimes works"
  found: The single reconnect attempt timing is: page unloads -> page reloads -> Phaser initializes -> LobbyScene.create() -> checkReconnection() -> client.reconnect(token). This takes ~500-1500ms. If the WS close frame was processed by server in that window, allowReconnection has registered the token. If not, the single attempt fails immediately.
  implication: The success rate depends on whether the browser sends the close frame AND the server processes it before the client's single attempt fires. A narrow timing window.

- timestamp: 2026-02-11T10:18:00Z
  checked: LobbyRoom.ts onLeave (lines 143-176)
  found: The onLeave handler awaits allowReconnection which blocks until reconnection succeeds or times out. Token registration in Colyseus internals (_reconnections[token]) happens synchronously inside allowReconnection() BEFORE the await/deferred. So once onLeave fires, the token is immediately available for client reconnection.
  implication: The bottleneck is server detecting the disconnect (firing onLeave), not the allowReconnection call itself.

## Resolution

root_cause: |
  The lobby reconnection code path (LobbyScene.ts lines 50-70) makes a SINGLE reconnection attempt with ZERO retries. This is the exact same race condition that was previously diagnosed and fixed for GameRoom reconnection (see reconnection-allow-reconnection.md), but the fix (12 retries with 1000ms delay) was only applied to the game reconnection code path (lines 114-132), NOT the lobby reconnection path.

  When F5 is pressed in a lobby:
  1. Browser may or may not send WebSocket close frame (not guaranteed)
  2. If close frame is NOT sent, server takes ~9 seconds (ping timeout) to detect disconnect and call allowReconnection()
  3. Client's single reconnect attempt fires ~500-1500ms after F5, BEFORE allowReconnection has been called
  4. Server returns "reconnection token invalid or expired" because token is not yet in _reconnections map
  5. Client catches the error, clears the token, falls through to main menu

  "Works sometimes" = close frame arrived before the single attempt (lucky timing)
  "Mostly fails" = close frame didn't arrive or server hasn't processed it yet (common case)

fix:
verification:
files_changed: []

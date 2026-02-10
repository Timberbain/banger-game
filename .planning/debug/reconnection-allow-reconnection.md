---
status: diagnosed
trigger: "Browser refresh during active match fails to reconnect. Client tries but gets 'Session expired'. Server logs: '❌ reconnection token invalid or expired. Did you missed .allowReconnection()?'"
created: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Race condition between client reconnection attempts and server disconnect detection
test: Traced full WebSocket close -> onLeave -> allowReconnection -> client reconnect flow
expecting: Client reconnect requests arrive before server has registered allowReconnection
next_action: Write diagnosis

## Symptoms

expected: F5 during active match should reconnect within a few seconds
actual: Client tries to reconnect but gets "Session expired" after a short while
errors: Server log "reconnection token invalid or expired. Did you missed .allowReconnection()?"
reproduction: F5 refresh during active PLAYING match
started: Phase 5 - reconnection feature

## Eliminated

- hypothesis: stale dist/ not matching source
  evidence: Server runs via ts-node-dev src/index.ts which uses TypeScript source directly, NOT dist/. Dist is only for production builds. The stale dist at server/dist/rooms/GameRoom.js (which lacks allowReconnection) is irrelevant.
  timestamp: 2026-02-10T12:05:00Z

- hypothesis: consented parameter is wrong for F5 (true instead of false)
  evidence: Colyseus core Room.js line 610 passes consented = (code === Protocol.WS_CLOSE_CONSENTED). WS_CLOSE_CONSENTED = 4000. Browser F5 sends close code 1001 (Going Away) or 1006 (abnormal). Both are != 4000, so consented = false. allowReconnection path IS entered.
  timestamp: 2026-02-10T12:10:00Z

- hypothesis: reconnection token format mismatch between client and server
  evidence: Client stores roomId:rawToken, splits on ":" to send rawToken. Server uses client._reconnectionToken (the raw token) as key in _reconnections map. These match. generateId() uses nanoid, no ":" chars.
  timestamp: 2026-02-10T12:15:00Z

- hypothesis: locked room blocks reconnection
  evidence: MatchMaker.reconnect() does NOT check room.locked (unlike joinById which does). Reconnection bypasses lock.
  timestamp: 2026-02-10T12:16:00Z

- hypothesis: deferred 2s deletion for consented leaves interferes
  evidence: F5 triggers non-consented leave (code 1001 != 4000), so consented path with 2s deletion is never entered. No interference.
  timestamp: 2026-02-10T12:17:00Z

## Evidence

- timestamp: 2026-02-10T12:05:00Z
  checked: Server process list
  found: Server running via ts-node-dev --respawn --transpile-only src/index.ts (PID 35468/28639)
  implication: Source TypeScript is used directly, dist/ files are irrelevant

- timestamp: 2026-02-10T12:06:00Z
  checked: GameRoom.ts onLeave (lines 199-255)
  found: allowReconnection IS called for non-consented leaves during PLAYING state (line 235). Code is correct. Uses LOBBY_CONFIG.MATCH_RECONNECT_GRACE (60 seconds).
  implication: Server source code correctly implements reconnection

- timestamp: 2026-02-10T12:07:00Z
  checked: Colyseus core Room.js _onLeave (line 610)
  found: consented = (code === Protocol.WS_CLOSE_CONSENTED) where WS_CLOSE_CONSENTED = 4000. F5 produces code 1001. So consented = false.
  implication: F5 correctly triggers non-consented leave path

- timestamp: 2026-02-10T12:08:00Z
  checked: LobbyScene.ts checkReconnection (lines 33-124)
  found: Client reads token from localStorage, retries 3 times with 800ms delay between retries. Total retry window ~2.4s from first attempt.
  implication: Client gives up after ~2.4 seconds

- timestamp: 2026-02-10T12:10:00Z
  checked: WebSocket transport ping configuration (WebSocketTransport.js lines 49-50)
  found: pingInterval = 3000ms, pingMaxRetries = 2. Server detects unresponsive client after 3 * 3 = 9000ms (3 ticks: tick1=increment, tick2=increment, tick3=terminate).
  implication: If browser doesn't send close frame, server takes ~9 seconds to detect disconnect

- timestamp: 2026-02-10T12:12:00Z
  checked: Client colyseus.js SDK (Room.js, Client.js)
  found: No beforeunload/unload handler. SDK does NOT proactively close WebSocket on page navigation. Relies on browser's native WebSocket close behavior.
  implication: Close frame delivery depends entirely on browser behavior

- timestamp: 2026-02-10T12:14:00Z
  checked: allowReconnection internals (Room.js lines 391-430)
  found: Token registration (_reconnections[token] and _reserveSeat) happens synchronously inside allowReconnection, before the returned promise. But this only runs after onLeave is called, which only happens after the close event fires on the server side.
  implication: Token is available immediately once close event fires, but not before

- timestamp: 2026-02-10T12:20:00Z
  checked: MatchMaker.reconnect (MatchMaker.js lines 166-189)
  found: Error "reconnection token invalid or expired" occurs when checkReconnectionToken returns undefined. This happens when token is not in _reconnections OR reservedSeat[3] (allowReconnection flag) is false.
  implication: The token is not registered at the time the client tries to reconnect

- timestamp: 2026-02-10T12:22:00Z
  checked: Browser WebSocket close behavior on F5
  found: Browsers may or may not send WebSocket close frame during page navigation. Modern Chrome usually does, but it's not guaranteed. Web references confirm "onclose event may fire late or not at all because the browser didn't send a close frame."
  implication: Without close frame, server relies on 9-second ping timeout, but client only retries for ~2.4 seconds

## Resolution

root_cause: |
  Race condition between server disconnect detection and client reconnection attempts.

  When F5 is pressed during an active match:
  1. Browser may or may not send WebSocket close frame (browser-dependent, not guaranteed)
  2. If close frame IS sent: server processes it immediately, allowReconnection registers token ~instantly. Client reconnect succeeds (usually).
  3. If close frame is NOT sent: server relies on ping/pong timeout to detect disconnect. With pingInterval=3000ms and pingMaxRetries=2, server takes ~9 seconds to call terminate(), which triggers _onLeave and allowReconnection.
  4. Client (LobbyScene.checkReconnection) retries only 3 times with 800ms delays, exhausting all attempts within ~2.4 seconds.
  5. All 3 client reconnection attempts hit the server BEFORE allowReconnection has been called, so checkReconnectionToken returns undefined -> "reconnection token invalid or expired" error.

  The fundamental problem: the client's retry window (3 * 800ms = 2.4s) is much shorter than the server's worst-case disconnect detection time (~9s). When the browser doesn't reliably send the WebSocket close frame, all reconnection attempts fail.

  Additional contributing factor: the Colyseus.js client SDK has no beforeunload handler to proactively close the WebSocket, and the game code doesn't add one either.

fix: |
  Two complementary fixes needed:

  FIX 1 (Client - Primary): Increase retry count and delay to outlast server ping timeout
  File: client/src/scenes/LobbyScene.ts, lines 69-70
  Change MAX_RETRIES from 3 to 12 and RETRY_DELAY from 800ms to 1000ms
  This gives ~12 seconds of retry window, exceeding the 9-second ping timeout.

  FIX 2 (Client - Proactive): Add a beforeunload handler in GameScene to close the WebSocket explicitly
  File: client/src/scenes/GameScene.ts
  Add window.addEventListener('beforeunload', ...) that calls this.room.connection.close(4000) (consented close)
  Wait - this would send a CONSENTED close, which would skip allowReconnection.
  Instead: just close the raw WebSocket (no close code / code 1001) so server treats it as non-consented.
  Actually, the best approach is to NOT explicitly close (let browser do it) but instead increase retries.

  RECOMMENDED FIX: Just increase the client retry parameters in LobbyScene.ts:
  - MAX_RETRIES: 3 -> 12
  - RETRY_DELAY: 800 -> 1000

  This ensures the client retries long enough for the server to detect the disconnect via ping timeout and call allowReconnection.

verification:
files_changed: []

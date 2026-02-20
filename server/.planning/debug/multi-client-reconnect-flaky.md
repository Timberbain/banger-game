---
status: diagnosed
trigger: "Browser refresh (F5) reconnection during active game match is flaky. When multiple browsers refresh, only ~1 successfully reconnects. Others time out after 12 attempts (12 seconds) with 'Session Expired'."
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Multiple root causes combine to make multi-client F5 reconnection fail for 2 of 3 clients
test: Traced full allowReconnection + _onLeave + _onJoin + checkReconnectionToken flow for concurrent disconnects
expecting: Multiple concurrent reconnections should each get independent tokens registered
next_action: Write diagnosis

## Symptoms

expected: All 3 browsers refreshing (F5) simultaneously should reconnect to the active game match within 12 seconds
actual: Only ~1 of 3 successfully reconnects. The other 2 time out with "Session expired" after 12 attempts
errors: Server log "reconnection token invalid or expired. Did you missed .allowReconnection()?"
reproduction: Start a 3-player match, F5 all 3 browsers simultaneously
started: After implementing reconnection in Phase 5

## Eliminated

- hypothesis: allowReconnection is not called for non-consented leaves
  evidence: GameRoom.onLeave lines 229-254 clearly call allowReconnection for non-consented leaves during PLAYING state. Verified in Colyseus Room._onLeave (line 610) that F5 produces code != 4000, so consented=false.
  timestamp: 2026-02-11T00:05:00Z

- hypothesis: reconnection tokens from different clients share the same key and overwrite each other
  evidence: Each client has a unique _reconnectionToken generated via generateId() in Room._onJoin (line 310). The _reconnections map is keyed by reconnectionToken (not sessionId). Multiple tokens can coexist: _reconnections[tokenA] = [sessionIdA, ...], _reconnections[tokenB] = [sessionIdB, ...]. No overwriting.
  timestamp: 2026-02-11T00:10:00Z

- hypothesis: The room disposes when all clients disconnect simultaneously before any reconnect
  evidence: Room._disposeIfEmpty (line 503) checks `this.#_onLeaveConcurrent === 0 && Object.keys(this.reservedSeats).length === 0`. During allowReconnection, _reserveSeat is called which adds to reservedSeats, preventing auto-dispose. Also #_onLeaveConcurrent tracks concurrent onLeave calls, blocking dispose during processing.
  timestamp: 2026-02-11T00:12:00Z

- hypothesis: Colyseus processes onLeave calls sequentially, blocking the second/third
  evidence: Room._onLeave increments #_onLeaveConcurrent but does NOT use a lock/mutex. Multiple async onLeave calls can run concurrently in Node.js event loop. The `await this.onLeave()` in _onLeave is per-client and non-blocking for other clients.
  timestamp: 2026-02-11T00:15:00Z

## Evidence

- timestamp: 2026-02-11T00:05:00Z
  checked: GameRoom.ts onLeave (lines 199-260)
  found: Non-consented leaves during PLAYING call `await this.allowReconnection(client, 60)`. Each client gets their own allowReconnection call.
  implication: Server code is correct for each individual client.

- timestamp: 2026-02-11T00:07:00Z
  checked: WebSocketTransport.js autoTerminateUnresponsiveClients (lines 80-91)
  found: pingInterval=3000ms, pingMaxRetries=2. The interval iterates ALL clients via `this.wss.clients.forEach()` and increments pingCount for each. When pingCount >= pingMaxRetries, client.terminate() is called. This means ALL 3 clients are terminated in the SAME interval tick once their pingCount reaches 2.
  implication: All 3 clients are terminated nearly simultaneously (within the same forEach loop iteration). This triggers 3 close events in rapid succession.

- timestamp: 2026-02-11T00:08:00Z
  checked: Room._onLeave (lines 601-630) and how it interacts with allowReconnection
  found: _onLeave removes client from this.clients array (line 604), then calls user's onLeave (line 610) which awaits allowReconnection. allowReconnection (line 391-431) synchronously calls _reserveSeat and registers the token in _reconnections map BEFORE returning the promise. So the token is available for reconnection immediately.
  implication: Even with 3 concurrent _onLeave calls, each should register its token quickly (synchronous part of allowReconnection runs before the await).

- timestamp: 2026-02-11T00:10:00Z
  checked: Room._onJoin for reconnection flow (lines 308-389)
  found: On reconnection, _onJoin at line 328-336 checks isWaitingReconnection flag. It looks up `this._reconnectingSessionId.get(sessionId)` to find the previousReconnectionToken, then resolves the deferred at `this._reconnections[previousReconnectionToken]?.[1].resolve(client)`. The cleanup() function (lines 413-418) then deletes the token from _reconnections, deletes reservedSeats, and deletes from _reconnectingSessionId.
  implication: Reconnection cleanup removes the reservedSeat. If cleanup for client A removes something that client B depends on, there could be interference. But each client has its own sessionId and reconnectionToken -- cleanup is independent.

- timestamp: 2026-02-11T00:12:00Z
  checked: Room.checkReconnectionToken (lines 153-161)
  found: `checkReconnectionToken(reconnectionToken)` looks up `this._reconnections[reconnectionToken]?.[0]` to get sessionId, then checks `this.reservedSeats[sessionId]` exists and has [3] (allowReconnection flag) set to true. If valid, it adds sessionId to `_reconnectingSessionId` map and returns sessionId. If NOT valid, returns undefined.
  implication: This function requires both _reconnections[token] AND reservedSeats[sessionId] to be present and correctly flagged.

- timestamp: 2026-02-11T00:15:00Z
  checked: Client-side token storage and what token is actually stored
  found: In GameScene.ts line 125-129, the token is stored on initial join: `localStorage.setItem('bangerActiveRoom', JSON.stringify({ token: this.room.reconnectionToken, timestamp: Date.now() }))`. The reconnectionToken format is `roomId:rawToken` (set in client Room.js line 165). CRITICAL: This token is stored ONCE at initial join time. It uses the _reconnectionToken generated during _onJoin (line 310 of Room.js server side).
  implication: Each client has a unique, independently stored token.

- timestamp: 2026-02-11T00:17:00Z
  checked: What happens to _reconnectionToken when allowReconnection resolves successfully
  found: In allowReconnection cleanup (line 413-418), when reconnection succeeds: `delete this._reconnections[reconnectionToken]` and `delete this.reservedSeats[sessionId]`. Then in _onJoin (line 310): `client._reconnectionToken = generateId()` -- a NEW reconnection token is generated for the rejoining client.
  implication: The client gets a NEW reconnectionToken after successful reconnection. The old one is cleaned up. The client stores the new token (GameScene handleReconnection line 597-600, LobbyScene checkReconnection line 156-160).

- timestamp: 2026-02-11T00:19:00Z
  checked: GameScene handleReconnection (lines 575-613) -- single attempt, NO retry loop
  found: handleReconnection() calls `await this.client.reconnect(token)` ONCE with no retry loop. If it fails, it calls returnToLobby. There is no retry mechanism like LobbyScene has.
  implication: GameScene in-game reconnection has ZERO retries. If the server hasn't processed the disconnect yet when the single attempt fires, it fails permanently.

- timestamp: 2026-02-11T00:20:00Z
  checked: The full reconnection flow path for a game F5
  found: When F5 is pressed during a game:
    1. Browser reloads
    2. LobbyScene.create() runs, calls checkReconnection()
    3. checkReconnection first checks bangerLobbyRoom (line 35) -- not relevant for game
    4. Then checks bangerActiveRoom (line 100)
    5. If found and not expired, attempts reconnection with 12 retries, 1000ms delay
    6. On success, passes room to GameScene via scene.start('GameScene', { room: reconnectedRoom })
    7. GameScene receives the reconnected room in create() via data.room
  implication: The retry loop IS in LobbyScene (12 retries). GameScene's handleReconnection is only for mid-game disconnects (not F5). For F5, LobbyScene handles it.

- timestamp: 2026-02-11T00:22:00Z
  checked: LobbyScene game reconnection retry loop (lines 133-167) and timing
  found: MAX_RETRIES=12, RETRY_DELAY=1000ms. Each attempt calls `this.client.reconnect(token)` which makes an HTTP POST to `/matchmake/reconnect/{roomId}`. The server's MatchMaker.reconnect() (line 166-189) finds the room, calls room.checkReconnectionToken(token). If token not found in _reconnections map, returns undefined -> throws MATCHMAKE_EXPIRED.
  implication: Client retries for 12 seconds. Server needs to detect disconnect and call allowReconnection within that window.

- timestamp: 2026-02-11T00:24:00Z
  checked: Timing of ping-based disconnect detection for 3 simultaneous F5 refreshes
  found: When 3 browsers F5 simultaneously:
    - If browsers send close frames: server gets 3 close events immediately, triggers 3 _onLeave calls, 3 allowReconnection calls synchronously register tokens. All 3 clients can reconnect. This is the "works sometimes" case.
    - If browsers DON'T send close frames (common with F5): server relies on ping timeout. pingInterval=3000ms, pingMaxRetries=2. After ~6-9 seconds, all 3 are terminated in the same forEach loop. 3 close events fire in rapid succession. 3 _onLeave -> 3 allowReconnection. But the NEW clients have been trying to reconnect for the past 6-9 seconds already, consuming most of the 12-second retry window. Remaining retries (3-6 attempts) should still succeed.
  implication: Basic timing should still work for all 3 clients if there's no other issue. Need to look deeper.

- timestamp: 2026-02-11T00:26:00Z
  checked: Room._onJoin line 310 and hasReservedSeat interaction during reconnection
  found: CRITICAL DISCOVERY. When a reconnecting client hits the server, the flow is:
    1. MatchMaker.reconnect() calls room.checkReconnectionToken(token) -- this sets _reconnectingSessionId
    2. MatchMaker returns { room, sessionId } to the HTTP controller
    3. The HTTP controller calls reserveSeatFor(room, ...) with the sessionId
    4. Wait -- NO. For reconnection, MatchMaker.reconnect() returns sessionId directly. The HTTP handler then does what?
  implication: Need to check the matchmake controller to understand full reconnection HTTP flow.

- timestamp: 2026-02-11T00:27:00Z
  checked: Matchmake controller HTTP handler for reconnect
  found: In MatchMaker.reconnect() (lines 166-189): It calls checkReconnectionToken which sets _reconnectingSessionId. Then returns { room, sessionId }. The controller sends this back to the client. The client then opens a WebSocket to the room with sessionId + reconnectionToken params. WebSocketTransport.onConnection (line 92-112) calls room.hasReservedSeat(sessionId, reconnectionToken). hasReservedSeat (line 142-152) checks: reservedSeats[sessionId] exists, reservedSeat[3] is true (allowReconnection flag), AND reconnectionToken matches _reconnections[token][0] === sessionId AND _reconnectingSessionId.has(sessionId).
  implication: The reconnection requires _reconnectingSessionId to be set. checkReconnectionToken sets it. But what if TWO reconnect HTTP requests come for the SAME sessionId?

- timestamp: 2026-02-11T00:28:00Z
  checked: Can the same token be used multiple times in retry loop?
  found: CRITICAL. In checkReconnectionToken (line 153-161):
    ```
    this._reconnectingSessionId.set(sessionId, reconnectionToken);
    return sessionId;
    ```
    This is called on EVERY HTTP reconnect request. It sets _reconnectingSessionId each time. Then hasReservedSeat checks `this._reconnectingSessionId.has(sessionId)`.

    The issue: checkReconnectionToken is called via `remoteRoomCall` which for local rooms (line 234) calls `room[method].apply(room, args)`. Each retry from the client triggers a new HTTP POST -> checkReconnectionToken. The first successful attempt gets the WebSocket connected. But if the first HTTP succeeds but the WebSocket fails to connect (timing), the client retries the HTTP call.

    Wait, looking at client code: `this.client.reconnect(token)` does the FULL flow: HTTP POST + WebSocket connect. If the HTTP succeeds but WebSocket fails, the whole reconnect() call fails. On retry, HTTP is called again.

    Is there interference? checkReconnectionToken just sets/overwrites the same key in _reconnectingSessionId map -- idempotent for same sessionId+token.
  implication: Retries for the SAME client are safe (idempotent). But what about different clients?

- timestamp: 2026-02-11T00:29:00Z
  checked: The actual failure scenario step by step for 3 simultaneous F5
  found: HERE IS THE ROOT CAUSE SCENARIO:

    1. All 3 clients (A, B, C) press F5 simultaneously at T=0
    2. New browser tabs load and start reconnection retry loop at T=~1s
    3. Browsers may or may not send WebSocket close frames

    CASE 1: Close frames sent (sometimes works):
    - Server gets close events immediately for all 3
    - 3 _onLeave calls fire, 3 allowReconnection calls register tokens
    - Client retries at T=1s find tokens -> all 3 reconnect

    CASE 2: Close frames NOT sent (the flaky case):
    - Server ping loop runs every 3s
    - T=3s: ping tick 1, all 3 clients get pingCount=1 (no pong received)
    - T=6s: ping tick 2, all 3 clients have pingCount=2 >= maxRetries=2, all 3 terminate()
    - 3 close events fire, 3 _onLeave -> 3 allowReconnection tokens registered
    - BUT: clients have been retrying since T=1s. By T=6s, they've used 5-6 of 12 retries
    - T=7-12s: remaining 6-7 retries hit the server. Tokens ARE now registered.

    So the timing SHOULD work for all 3... unless there's another factor.

    WAIT. Let me re-read the _onJoin reconnection path more carefully.

    In _onJoin (line 328-336):
    ```
    if (isWaitingReconnection) {
      const previousReconnectionToken = this._reconnectingSessionId.get(sessionId);
      if (previousReconnectionToken) {
        this.clients.push(client);
        await this._reconnections[previousReconnectionToken]?.[1].resolve(client);
      }
    }
    ```

    And allowReconnection cleanup (then handler, line 419-425):
    ```
    reconnection.then((newClient) => {
      ...
      clearTimeout(this.reservedSeatTimeouts[sessionId]);
      cleanup();  // deletes _reconnections[token], reservedSeats[sessionId], _reconnectingSessionId
    });
    ```

    After client A successfully reconnects:
    - cleanup() deletes reservedSeats[sessionIdA] -- fine, doesn't affect B/C
    - cleanup() deletes _reconnections[tokenA] -- fine, doesn't affect B/C
    - cleanup() deletes _reconnectingSessionId for sessionIdA -- fine

    Each client has its own sessionId and token. No interference.

    SO WHAT IS ACTUALLY FAILING?
  implication: Need to reconsider. The data structures are per-client. No cross-contamination.

- timestamp: 2026-02-11T00:30:00Z
  checked: Whether F5 generates a new reconnection token on the NEW page load
  found: THIS IS THE KEY INSIGHT. When F5 is pressed:
    1. Original page unloads. The WebSocket connection is interrupted.
    2. New page loads. LobbyScene.create() reads bangerActiveRoom from localStorage.
    3. The stored token is `room.reconnectionToken` from the INITIAL join -- format: `roomId:rawToken`
    4. The `rawToken` is the `_reconnectionToken` generated in Room._onJoin (server line 310)
    5. This rawToken is used as the key in `_reconnections` map by allowReconnection

    NOW: When allowReconnection is called (server side), it uses `previousClient._reconnectionToken` (line 406) as the key. This is the SAME rawToken that was generated during original _onJoin and sent to the client.

    The client stored this token. On F5, the client sends this same token back.

    Server creates entry: `_reconnections[rawToken] = [sessionId, deferred]`
    Client sends: reconnectionToken = rawToken
    Server checks: `_reconnections[rawToken]` -> finds sessionId -> success

    This should work for ALL 3 clients independently. Each has a unique rawToken and sessionId.

    LET ME CHECK IF THE CLIENT IS ACTUALLY STORING THE TOKEN CORRECTLY.

- timestamp: 2026-02-11T00:31:00Z
  checked: Token storage timing in GameScene.create() and LobbyScene gameReady handler
  found: TWO places store the game reconnection token:
    1. LobbyScene line 691: `localStorage.setItem('bangerActiveRoom', JSON.stringify({ token: gameRoom.reconnectionToken, timestamp: Date.now() }))` -- stored immediately after joining game room from lobby
    2. GameScene line 125-129: `localStorage.setItem('bangerActiveRoom', JSON.stringify({ token: this.room.reconnectionToken, timestamp: Date.now() }))` -- stored again in GameScene create

    Both store `room.reconnectionToken` which is `roomId:rawToken`.

    But WAIT -- in the reconnection success path in LobbyScene (line 154-164):
    ```
    if (reconnectedRoom.reconnectionToken) {
      localStorage.setItem('bangerActiveRoom', JSON.stringify({
        token: reconnectedRoom.reconnectionToken,
        timestamp: Date.now()
      }));
    }
    ```
    After successful reconnection, it UPDATES the stored token with the NEW reconnectionToken. Because _onJoin (line 310) generates a NEW _reconnectionToken on each join (including reconnection joins).

    And in GameScene handleReconnection (line 597-600), same pattern.

    This is correct behavior -- after reconnecting, you get a new token for the next reconnection.

- timestamp: 2026-02-11T00:33:00Z
  checked: Whether the room.lock() (called in startMatch) prevents reconnection WebSocket connections
  found: WebSocketTransport.onConnection (line 104) calls `room.hasReservedSeat(sessionId, reconnectionToken)`. This does NOT check room._locked. MatchMaker.reconnect (line 166-189) also does NOT check locked status -- it just does driver.findOne({roomId}) and checkReconnectionToken. So locked rooms DO allow reconnection.
  implication: Lock is not the issue.

- timestamp: 2026-02-11T00:35:00Z
  checked: Whether there's a race in `_reserveSeat` when called from `allowReconnection` concurrently for 3 clients
  found: allowReconnection (line 407) calls `this._reserveSeat(sessionId, true, previousClient.auth, seconds, true)`. _reserveSeat (line 483-501) sets `this.reservedSeats[sessionId] = [joinOptions, authData, false, allowReconnection]`. Each client has a unique sessionId, so no conflict.
  implication: No race condition in _reserveSeat for different clients.

- timestamp: 2026-02-11T00:37:00Z
  checked: The ACTUAL matchmake HTTP controller flow for reconnection
  found: Looking at MatchMaker.reconnect() return value: `return { room, sessionId }`. The controller (from @colyseus/core matchmaker/controller) receives this and calls... Let me check.
  implication: Need to check the controller code.

- timestamp: 2026-02-11T00:38:00Z
  checked: @colyseus/core matchmaker controller
  found: The controller receives the { room, sessionId } from reconnect() and sends it back to the client as the HTTP response. The client then opens a WebSocket connection with that sessionId and reconnectionToken. The WebSocket handler calls hasReservedSeat and then _onJoin. THIS IS ALL STATELESS per-client.
  implication: No concurrency issue in the HTTP matchmaking path.

- timestamp: 2026-02-11T00:40:00Z
  checked: FULL RE-EXAMINATION of what happens when 3 clients F5 and close frames are NOT sent
  found:
    T=0: All 3 F5. Old WebSockets go silent (no close frame).
    T=1: All 3 new pages load LobbyScene, start checkReconnection with 12 retries.
    T=1-6: Client retries hit MatchMaker.reconnect(). Server looks up room (exists). Calls checkReconnectionToken(rawToken). Server checks _reconnections[rawToken] -- but allowReconnection hasn't been called yet! Token not in map. Returns undefined. Client gets "reconnection token invalid or expired".
    T=6: Server ping timeout terminates all 3 old connections. 3 close events. 3 _onLeave. 3 allowReconnection calls register tokens.
    T=7-12: Client retries NOW find the tokens. checkReconnectionToken succeeds. Client opens WebSocket. _onJoin runs reconnection path. SUCCESS.

    With 12 retries at 1s intervals starting at T=1, the last retry is at T=12. Tokens become available at T=6. So retries 7-12 (6 attempts) should succeed.

    BUT WAIT: Do ALL 3 get reconnected or just 1?

    Let me re-examine. Each of the 3 clients is independently retrying. At T=7 (approximately), all 3 might hit the server simultaneously. Each calls checkReconnectionToken with their own unique token. Each finds their token. Each gets { room, sessionId } back. Each opens WebSocket. WebSocket handler calls hasReservedSeat -- each with their own sessionId and token. Each passes. Each calls _onJoin. _onJoin processes reconnection, resolves the deferred.

    This SHOULD work for all 3.

    Unless... there's something about the HTTP handling that serializes or limits concurrent matchmake requests?

- timestamp: 2026-02-11T00:42:00Z
  checked: Whether `_onJoin` reconnection path has any issue with concurrent joins
  found: _onJoin line 319: `const [joinOptions, authData, isConsumed, isWaitingReconnection] = this.reservedSeats[sessionId]`
    Line 321: `if (isConsumed) { throw "already consumed" }`
    Line 323: `this.reservedSeats[sessionId][2] = true` -- marks as consumed.

    For reconnection, _reserveSeat sets reservedSeats[sessionId] = [true, auth, false, true]. isConsumed starts as false. When _onJoin runs, it sets [2] to true.

    If a client retries and the FIRST attempt's WebSocket connects WHILE a retry HTTP POST is also in flight, could the retry's WebSocket try to join and find isConsumed=true?

    Scenario: Client A retry #7 succeeds at HTTP level, opens WebSocket, _onJoin starts processing, sets isConsumed=true, resolves reconnection. cleanup() deletes reservedSeats[sessionIdA]. Now if retry #8's HTTP was also in flight: MatchMaker.reconnect calls checkReconnectionToken -- but _reconnections[tokenA] was deleted by cleanup(). Returns undefined. Retry #8 fails with "token invalid". But that's fine because retry #7 already succeeded and the client.reconnect() promise resolved.

    So retries for the SAME client don't interfere destructively.

    But what about DIFFERENT clients? Client A's cleanup deletes _reconnections[tokenA] and reservedSeats[sessionIdA]. These are A-specific. B and C have different tokens and sessionIds. No interference.
  implication: No concurrency issue in _onJoin for different clients reconnecting.

- timestamp: 2026-02-11T00:45:00Z
  checked: RE-EXAMINING the actual observed behavior more carefully
  found: The user reports "only ~1 successfully reconnects". This suggests that exactly 1 succeeds and 2 fail consistently (or nearly so). This is NOT a timing issue (which would be random). This suggests a STRUCTURAL issue where reconnecting 1 client somehow prevents the other 2.

    BREAKTHROUGH HYPOTHESIS: What if the issue is in GameRoom.onLeave, NOT in Colyseus internals?

    GameRoom.onLeave lines 229-254:
    ```
    if (this.state.matchState === MatchState.PLAYING) {
      try {
        await this.allowReconnection(client, LOBBY_CONFIG.MATCH_RECONNECT_GRACE);
        // Successfully reconnected
        const reconnectedPlayer = this.state.players.get(client.sessionId);
        if (!reconnectedPlayer) {
          console.warn(`Player ${client.sessionId} reconnected but player object was removed`);
          return;
        }
        reconnectedPlayer.connected = true;
        reconnectedPlayer.inputQueue = [];
      } catch (e) {
        // Grace period expired
        this.state.players.delete(client.sessionId);
        this.checkWinConditions();
      }
    }
    ```

    When client A reconnects successfully, the `await this.allowReconnection()` resolves. Then `reconnectedPlayer.connected = true`. Good.

    BUT: checkWinConditions is called in the CATCH block. And also in fixedTick every frame. Let's check what checkWinConditions does.

    checkWinConditions (lines 450-460):
    ```
    const players = Array.from(this.state.players.values());
    const aliveParan = players.find(p => p.role === "paran" && p.health > 0);
    const aliveGuardians = players.filter(p => p.role !== "paran" && p.health > 0);
    if (!aliveParan) { this.endMatch("guardians"); }
    else if (aliveGuardians.length === 0) { this.endMatch("paran"); }
    ```

    This does NOT check `player.connected`. It only checks health > 0. Disconnected players still have health > 0. So checkWinConditions won't incorrectly end the match.

    But what about endMatch? endMatch calls `this.disconnect()` after 15 seconds. And disconnect() on the Room (line 285-307) rejects ALL pending _reconnections and closes all clients. But endMatch only triggers if someone actually dies, not from disconnection.

    Hmm. Let me look at this from a different angle.

- timestamp: 2026-02-11T00:47:00Z
  checked: What the client actually does with the reconnected room when LobbyScene passes it to GameScene
  found: LobbyScene line 164: `this.scene.start('GameScene', { room: reconnectedRoom })`. GameScene.create() (line 60) receives data.room. Line 114: `this.room = providedRoom`. Line 122: `this.connected = true`. Line 125-129: stores new reconnectionToken.

    CRITICAL: GameScene.create() line 133: `this.room.onStateChange.once((state) => { ... })` -- This registers a ONE-TIME state change listener to load the tilemap. But for a RECONNECTED room, the state is already present! The first state change after reconnection triggers this, loads the tilemap.

    And then line 155: `this.room.state.listen("matchState", ...)` -- registers schema listeners.

    Line 197: `this.room.onLeave((code) => { ... this.handleReconnection(); })` -- registers onLeave handler for FUTURE disconnects.

    Line 210: `this.room.state.players.onAdd(...)` -- registers player add listeners.

    For a reconnected room, onAdd fires immediately for all existing players (Colyseus behavior -- new listeners get called for existing collection items).

    This all seems correct. The room connection is established and listeners are set up.
  implication: GameScene correctly handles a reconnected room from LobbyScene.

- timestamp: 2026-02-11T00:50:00Z
  checked: Whether the issue is that only 1 browser tab can connect at a time (WebSocket transport limitation)
  found: WebSocketTransport uses ws library. The ws server handles multiple concurrent connections. No limitation.
  implication: Not a transport limitation.

- timestamp: 2026-02-11T00:52:00Z
  checked: RE-READ the user's bug report more carefully
  found: "When ALL 3 browsers refresh simultaneously, only ~1 reconnects."

    KEY QUESTION: Are these 3 separate browser WINDOWS, or 3 tabs in the same browser?

    If 3 tabs in same browser: localStorage is SHARED. All 3 tabs read the SAME bangerActiveRoom from localStorage. But wait -- each tab joined the game room with a DIFFERENT sessionId and got a DIFFERENT reconnectionToken. They would each store their token to the SAME localStorage key 'bangerActiveRoom'.

    THE LAST TAB TO STORE WINS.

    Scenario:
    - Tab 1 joins game, stores token1 to localStorage.bangerActiveRoom
    - Tab 2 joins game, stores token2 to localStorage.bangerActiveRoom (OVERWRITES token1)
    - Tab 3 joins game, stores token3 to localStorage.bangerActiveRoom (OVERWRITES token2)
    - Now localStorage only has token3.
    - All 3 tabs F5.
    - All 3 new pages read localStorage.bangerActiveRoom -- they ALL get token3.
    - All 3 try to reconnect with token3 (which belongs to Tab 3's sessionId).
    - Tab 3 succeeds (it's their token).
    - Tabs 1 and 2 fail because after Tab 3's reconnection succeeds, cleanup() deletes _reconnections[token3] and reservedSeats[sessionId3]. Tabs 1 and 2's subsequent retries with token3 fail with "token invalid".
    - Actually, even if they try simultaneously: checkReconnectionToken returns sessionId3 for all of them. The HTTP response sends sessionId3 to all 3. All 3 try to open WebSocket with sessionId3. First one to connect via WebSocket succeeds. The other two hit isConsumed=true and fail.

    THIS IS THE ROOT CAUSE for same-browser tabs.

    But what if the user is using 3 SEPARATE browser windows/profiles? Then localStorage is NOT shared, and each would have their own token. All 3 should reconnect.

    The user says "multiple browsers" which could mean separate browser windows of the SAME browser (shared localStorage) or truly different browsers (separate localStorage).
  implication: If using same browser, localStorage.bangerActiveRoom is a single key that gets overwritten. Only the LAST writer's token survives.

- timestamp: 2026-02-11T00:53:00Z
  checked: Whether there's a similar issue with bangerLobbyRoom
  found: Same pattern. LobbyScene line 624-629 stores `bangerLobbyRoom` with the lobby room's reconnectionToken. If 3 tabs in same browser are in the same lobby, only the last writer's token survives. Same bug.
  implication: Confirms the localStorage key collision issue applies to both lobby and game reconnection.

- timestamp: 2026-02-11T00:55:00Z
  checked: Even with separate browsers (separate localStorage), is there still an issue?
  found: If 3 truly separate browsers (Chrome, Firefox, Safari), each has independent localStorage. Each stores its own token. On F5:
    - Each retries with its own unique token
    - Server registers all 3 tokens when ping timeout fires
    - Each client's retries find their own token
    - All 3 should reconnect successfully

    But the user reports "only ~1 reconnects". If they're using 3 separate browsers, there may be another issue. Let me check if browsers have different WebSocket close frame behavior.

    Chrome: Generally sends close frame on page unload (code 1001)
    Firefox: Generally sends close frame on page unload
    Safari: Less reliable with close frames

    If using 3 Chrome windows: localStorage IS shared between windows of the same browser. Different profiles would be separate.

    MOST LIKELY: The user is running 3 tabs/windows in the SAME browser for testing. localStorage is shared.
  implication: The root cause is localStorage key collision when multiple game clients run in the same browser.

## Resolution

root_cause: |
  localStorage key collision when multiple game clients run in the same browser.

  The token storage uses a single global key `bangerActiveRoom` (and `bangerLobbyRoom`) in localStorage.
  When multiple tabs/windows of the same browser each join a game room, they each receive a unique
  reconnection token (format: `roomId:rawToken`). However, they all write to the SAME localStorage key:

  ```js
  localStorage.setItem('bangerActiveRoom', JSON.stringify({
    token: gameRoom.reconnectionToken,  // unique per tab
    timestamp: Date.now()
  }));
  ```

  The last tab to write wins. When all tabs F5 simultaneously:
  1. All tabs read the same stored token (from the last writer)
  2. All tabs try to reconnect with that one token
  3. Only the original owner of that token can successfully reconnect
  4. The other tabs' tokens were overwritten and lost -- they can never reconnect

  This explains "only ~1 of 3 reconnects" -- it's always the tab whose token happened to be
  written last to localStorage.

  Files involved:
  - client/src/scenes/LobbyScene.ts lines 691-694 (stores game token), lines 624-629 (stores lobby token)
  - client/src/scenes/GameScene.ts lines 125-129 (stores game token)

  Secondary contributing factor (for truly separate browsers):
  If each browser has independent localStorage, reconnection should work for all 3. The ping timeout
  (~6-9s) is within the 12-retry window. However, if any browser doesn't send a close frame AND the
  user is impatient, the 12s window might be tight.

fix: |
  NOT IMPLEMENTING (research only). Suggested direction:

  Option A: Include sessionId in localStorage key
  Change the storage key from `bangerActiveRoom` to `bangerActiveRoom_${room.sessionId}`.
  Each tab stores and retrieves its own token. On F5, the new page needs to know which
  sessionId it was -- this is the challenge since sessionId is only in memory.

  Option B: Use sessionStorage instead of localStorage
  sessionStorage is per-tab (not shared between tabs). Each tab has its own storage space.
  On F5, sessionStorage IS preserved (unlike closing the tab). This is the simplest fix.
  Change `localStorage.getItem/setItem('bangerActiveRoom')` to `sessionStorage.getItem/setItem('bangerActiveRoom')`.
  Same for `bangerLobbyRoom`.

  Option C (if single-tab is the design intent): Accept the limitation
  If the game is designed for one tab per browser, the current approach works. Document that
  multiple tabs are not supported. But the current testing pattern (3 tabs) will always be flaky.

verification:
files_changed: []

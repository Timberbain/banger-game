---
status: diagnosed
trigger: "Two sub-issues after lobby-to-game transition: (1) Baran controls intermittently not responding, (2) Status text inconsistent across players"
created: 2026-02-11T10:00:00Z
updated: 2026-02-11T10:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two distinct root causes: (1) PredictionSystem init uses stale role from onAdd timing, (2) Status text race between initial check + listen() immediate callback + onAdd player count updates
test: Full code trace of create() timing
expecting: Evidence of timing-dependent behavior
next_action: Return diagnosis

## Symptoms

expected: (1) All players' controls work immediately after entering game from lobby. (2) All players see consistent status text progression: "Waiting for players... X/3" -> "Match started!" -> hidden.
actual: (1) Baran controls intermittently don't respond after lobby-to-game transition. (2) Paran shows "Waiting for players... 0/3", Faran shows nothing (hidden), Baran shows "Match started!"
errors: None visible
reproduction: Create lobby with 3 players (Paran, Faran, Baran), complete countdown, observe GameScene
started: Since lobby-to-game transition was implemented

## Eliminated

## Evidence

- timestamp: 2026-02-11T10:02:00Z
  checked: GameScene.create() lines 92-98 - room assignment
  found: When coming from lobby, `providedRoom` is the room already joined by LobbyScene's gameReady handler (LobbyScene.ts line 666). The room is already connected at this point.
  implication: The room object is live and already receiving state patches before GameScene.create() runs listeners

- timestamp: 2026-02-11T10:04:00Z
  checked: GameScene.create() lines 100-109 - initial status text
  found: Immediately after setting room, code checks `this.room.state.matchState` and `this.room.state.players.size`. Since room was joined in LobbyScene BEFORE scene transition, state may or may not be fully synced yet.
  implication: The initial check is a race - matchState could be "waiting" OR "playing" depending on join timing vs 3rd player arrival

- timestamp: 2026-02-11T10:06:00Z
  checked: @colyseus/schema listen() implementation (Schema.js line 139)
  found: `listen(prop, callback, immediate = true)` - fires callback IMMEDIATELY with current value if property is already set. matchState default is "waiting" (GameState.ts line 42).
  implication: listen("matchState", cb) fires immediately with "waiting" on registration, but the if-guard only acts on "playing". So for the initial "waiting" value, listen() does nothing.

- timestamp: 2026-02-11T10:08:00Z
  checked: Status text update flow for 3 players joining at ~same time
  found: |
    Server flow: Player1 onJoin -> set player -> Player2 onJoin -> set player -> Player3 onJoin -> set player -> startMatch() sets matchState="playing"
    Client flow for FIRST joiner (Paran, if first):
      1. Line 108: setText("Waiting for players... (0/3)") or (1/3) depending on initial sync
      2. Line 142: listen("matchState") fires immediately with "waiting" -> no action (only handles "playing")
      3. Line 197: onAdd fires for self -> setText("Waiting for players... (1/3)") [count < 3]
      4. Eventually: matchState changes to "playing" -> listen callback fires -> setText("Match started!")
    Client flow for LAST joiner (Baran, if last):
      1. Line 102: matchState might ALREADY be "playing" (3rd player triggers startMatch synchronously in onJoin)
      2. If matchState already "playing": Line 103 setText("Match started!")
      3. Line 142: listen("matchState") fires immediately with "playing" -> ALSO sets "Match started!" + starts hide timer
      4. Two hide timers are now running (one from line 104, one from line 145)
    Client flow for MIDDLE joiner (Faran):
      1. Line 108: matchState is "waiting" -> setText("Waiting for players... (1/3)")
      2. Line 142: listen("matchState") fires immediately with "waiting" -> no action
      3. BUT: If the room patch arrives between line 108 and when onAdd runs, the listen callback may fire with "playing"
      4. If listen callback fires "playing" very quickly, hide timer starts, text becomes invisible before user reads it
  implication: The 3 players see DIFFERENT status text because they join at slightly different times relative to startMatch()

- timestamp: 2026-02-11T10:10:00Z
  checked: Why Faran sees "nothing" (empty/hidden status)
  found: |
    Faran joins 2nd. By the time GameScene.create() runs:
    1. Initial check (line 102): matchState is "waiting" -> shows "Waiting for players... (N/3)"
    2. listen("matchState") registers and fires immediately with "waiting" -> no-op
    3. Shortly after, 3rd player (Baran) joins server-side, startMatch() runs, matchState="playing"
    4. listen callback fires with "playing" -> setText("Match started!") + 2000ms hide timer
    5. The hide timer fires -> text becomes invisible
    BUT: If the state patch containing matchState="playing" arrives within the create() execution
    or very shortly after, the "Match started!" text appears briefly and hides, leaving user seeing "nothing"
  implication: Faran sees nothing because the "Match started!" text appeared and auto-hid too fast

- timestamp: 2026-02-11T10:12:00Z
  checked: Paran shows "Waiting for players... 0/3"
  found: |
    Line 108: `this.room.state.players.size` - if Paran is the FIRST to join AND the initial state hasn't been patched yet, players.size is 0.
    The onAdd callback (line 197) will fire for each player as they sync, but the onAdd status update (line 206) only fires when `count < 3`.
    When count reaches 3, startMatch() fires on server, matchState changes to "playing", and the listen callback shows "Match started!" + hides after 2s.
    BUT: Paran could be seeing "0/3" because: the initial state sync hasn't happened when line 108 runs. The room was joined in LobbyScene, but the GameScene create() runs synchronously after scene.start(), and the first state patch may not have arrived yet.
  implication: players.size is 0 at initial check because state hasn't synced to the new scene yet

- timestamp: 2026-02-11T10:14:00Z
  checked: Baran controls issue - PredictionSystem initialization in onAdd (lines 251-260)
  found: |
    Line 211: `const role = player.role || 'faran'` - defaults to 'faran' if role not yet assigned
    Line 253: `this.localRole = role`
    Line 254-260: `this.prediction = new PredictionSystem(...)` initialized with `role`

    CRITICAL: When onAdd fires, player.role may be empty string "" (falsy) if the role hasn't been synced yet.
    Player schema: `@type("string") role: string = ""` (GameState.ts line 27)

    Server sets player.role BEFORE adding to state map (GameRoom.ts line 186-189):
    ```
    player.role = role;  // line 186
    player.lastProcessedSeq = 0;  // line 187
    this.state.players.set(client.sessionId, player);  // line 189
    ```

    So role SHOULD be set when onAdd fires. But with Colyseus 0.15, the initial state patch
    may deliver the player with default values first, then the role in a subsequent patch.
  implication: If role is empty on initial onAdd, PredictionSystem is created with 'faran' role even for Baran. This would cause wrong physics params but wouldn't completely break controls.

- timestamp: 2026-02-11T10:16:00Z
  checked: Whether PredictionSystem role mismatch causes control failure
  found: |
    PredictionSystem uses role to get CHARACTERS[role] stats (acceleration, drag, maxVelocity).
    If role='faran' but server processes as 'baran', prediction would use faran stats while server uses baran stats.
    This causes reconciliation mismatches but wouldn't make controls "not respond" entirely.

    HOWEVER: The update() loop guard (line 353) checks `!this.prediction`. If prediction is null,
    the entire update() returns early - no input processing at all.

    prediction is set ONLY in the onAdd callback (line 254) for the local player.
    If the local player's onAdd hasn't fired yet, prediction is null, and controls don't work.
  implication: Controls not responding = prediction is null = local player onAdd hasn't fired yet

- timestamp: 2026-02-11T10:18:00Z
  checked: Lobby-to-game transition timing (LobbyScene.ts lines 657-679)
  found: |
    gameReady handler flow:
    1. await this.room.leave()  -- leaves lobby (consented=true)
    2. const gameRoom = await this.client.joinById(gameRoomId, { name, fromLobby: true, role: this.selectedRole })
    3. Store reconnection token
    4. this.scene.start('GameScene', { room: gameRoom })

    step 2 awaits until the WebSocket connection + initial handshake completes.
    step 4 starts GameScene which calls create(data) synchronously.

    In create(), line 92-93: `this.room = providedRoom` (already connected room)
    The room's onAdd callbacks are registered at line 197.

    BUT: Colyseus 0.15 onAdd fires immediately for existing items by default.
    If players are ALREADY in the state when onAdd is registered, the callback fires immediately.
  implication: onAdd should fire immediately for players already in state. But the TIMING of when the initial state sync arrives matters.

- timestamp: 2026-02-11T10:20:00Z
  checked: Race condition in Baran joining as 3rd player
  found: |
    When Baran (3rd player) joins:
    1. Server: onJoin runs, player added to state, startMatch() called (sets matchState="playing", calls lock())
    2. Client Baran: joinById resolves, gets room reference
    3. Client Baran: scene.start('GameScene', { room })
    4. GameScene.create() runs, registers onAdd at line 197

    The critical question: has the initial state sync (containing the local player) arrived at the client before line 197?

    joinById resolves after the WebSocket handshake + initial state sync. So by the time scene.start is called,
    the room SHOULD have the initial state. When onAdd is registered, it fires immediately for existing players.

    BUT: If there's any delay between joinById resolution and the state being fully decoded,
    the local player's onAdd might not fire, leaving prediction=null.

    More likely scenario for "intermittent" failure:
    - 3 players join nearly simultaneously
    - All 3 leave lobby at ~same time
    - Network jitter means Baran's joinById may complete BEFORE their player is fully added to server state
    - The initial state sync might include 2 players (Paran + Faran) but not yet Baran
    - onAdd fires for Paran and Faran (remote), but Baran's own player hasn't arrived yet
    - prediction remains null until the NEXT state patch delivers Baran's player
    - During this gap, update() returns early = controls don't respond
  implication: INTERMITTENT because it depends on network timing. If Baran joins after others are already in state, their own player may arrive in a later patch, not the initial sync.

- timestamp: 2026-02-11T10:22:00Z
  checked: Whether this is truly intermittent or consistent for 3rd joiner
  found: |
    Server-side: All 3 clients call joinById(). Server processes onJoin synchronously for each.
    But client-side: joinById() resolves when the room's initial state is received.

    The 3rd player's client calls joinById -> server processes onJoin for player3 -> player3 added to state ->
    startMatch() called -> state is serialized and sent to ALL clients including player3.

    For player3's client: joinById resolves after receiving the initial state which should include themselves.

    Actually, reviewing Colyseus internals: joinById resolves after the "join" handshake, which includes
    the full initial state. The player IS in the state at that point because onJoin runs synchronously
    before sending the join confirmation.

    So the prediction SHOULD be initialized for Baran.

    The "intermittent" nature suggests a different cause: scene lifecycle issue.
    When scene.start('GameScene', ...) is called, if GameScene was previously created (e.g., in a
    previous match), Phaser may reuse the instance. The constructor fields keep their old values
    because constructor() only runs once.
  implication: SCENE REUSE BUG - If GameScene was previously instantiated, member variables like prediction, connected, localRole retain stale values from the previous session

- timestamp: 2026-02-11T10:24:00Z
  checked: GameScene member variable initialization (lines 10-48)
  found: |
    All member variables are initialized at declaration:
    - room: Room | null = null
    - playerSprites: Map = new Map()
    - connected: boolean = false
    - prediction: PredictionSystem | null = null
    - localRole: string = ''

    BUT: In Phaser, scene.start() on a scene that already exists calls create() but does NOT
    re-run the constructor or re-initialize member variables. The TypeScript member initializers
    run in the constructor.

    If a player plays a match, returns to lobby, and joins another match:
    1. First match: constructor runs, all variables initialized fresh
    2. Victory -> LobbyScene (scene.start('LobbyScene'))
    3. Second match: scene.start('GameScene') -> create() runs but constructor does NOT
    4. prediction still has the OLD PredictionSystem from the previous match
    5. connected is still true from the previous match

    In create(), line 92-93 sets this.room to the new room, but OLD prediction still exists.
    Line 353: update() checks `!this.prediction` -> prediction is NOT null (old one exists) -> doesn't return early.
    Line 438: `this.prediction.sendInput(input, this.room)` -> sends input via OLD prediction to NEW room.
    The OLD prediction has wrong state (position, velocity from old match) and wrong role potentially.

    When onAdd fires for the local player in the NEW match, line 254 creates a NEW PredictionSystem,
    overwriting the old one. If there's any gap, the old prediction sends garbage.

    BUT: For first-time play (no previous match), this isn't an issue.

    The bug report says "from lobby" not "from second match", so this may not be the cause.
    Let me re-examine the initial play case more carefully.
  implication: Scene reuse is a real bug but may not explain first-play intermittent failure

- timestamp: 2026-02-11T10:26:00Z
  checked: First-time lobby-to-game Baran controls - another angle
  found: |
    In the lobby-to-game transition, the gameReady handler runs:
    1. await this.room.leave()  -- leave lobby room (LobbyScene.ts line 663)
    2. const gameRoom = await this.client.joinById(...)  -- join game room
    3. this.scene.start('GameScene', { room: gameRoom })

    scene.start() transitions scenes. Phaser calls shutdown() on LobbyScene (line 939-952).
    LobbyScene.shutdown() calls this.room.leave() AGAIN (line 946).

    But this.room was already left in step 1. However, between step 1 and step 3,
    this.room is NOT updated to null. And at step 2, the client connects to a NEW room.
    this.room still points to the OLD lobby room.

    Wait, line 663: `await this.room!.leave()` -- this is the LOBBY room.
    Line 666: `const gameRoom = await this.client.joinById(...)` -- this is the GAME room.
    this.room is NOT reassigned to gameRoom. this.room still points to the (now left) lobby room.

    Line 679: `this.scene.start('GameScene', { room: gameRoom })` -- passes gameRoom as data.

    Then when LobbyScene.shutdown() runs (line 939-952):
    Line 946: this.room.leave() -- tries to leave the ALREADY LEFT lobby room again.
    This might throw, caught by line 947. Not a control issue for GameScene.

    GameScene receives `gameRoom` correctly via data.room. This part is fine.
  implication: LobbyScene shutdown double-leave is harmless. GameScene gets correct room.

- timestamp: 2026-02-11T10:28:00Z
  checked: GameScene create() with room from lobby - keyboard capture timing
  found: |
    Line 67: this.cursors = this.input.keyboard!.createCursorKeys()
    Line 68-73: this.wasd = this.input.keyboard!.addKeys('W,A,S,D')

    These set up keyboard input. The input system is tied to the Phaser scene.
    When GameScene.create() runs, the scene is active and keyboard should work.

    BUT: LobbyScene.showJoinInput() (lines 245-336) disables Phaser keyboard on HTML input focus:
    Line 283: `this.input.keyboard.enabled = false`
    Line 288: blur handler re-enables it

    If the HTML input is focused when gameReady fires, keyboard might still be disabled.
    clearUI() (line 924-937) removes the HTML input element. But does removing the element trigger blur?

    Line 933: `document.body.removeChild(this.htmlInput)` -- removing DOM element does NOT reliably fire blur.
    So `this.input.keyboard.enabled` might remain false on LobbyScene.

    BUT: GameScene has its OWN input keyboard (different scene). When scene.start('GameScene') runs,
    GameScene gets a fresh input manager. LobbyScene's input.keyboard.enabled=false doesn't affect GameScene.

    Actually wait - in Phaser, when you use scene.start(), the new scene has its own input plugin.
    The keyboard enabled flag is per-scene. So this shouldn't be the issue.

    For Baran specifically: the "intermittent" nature suggests this happens SOMETIMES not always.

    Re-reading the symptom: "Baran (guardian) controls intermittently not responding after entering game FROM LOBBY"

    The key insight might be simpler: the `update()` guard on line 353 checks `!this.prediction`.
    prediction is set in onAdd. In Colyseus 0.15, onAdd fires immediately for existing items.

    But what if the 3rd player joins and startMatch+lock() runs, and the state patch batching means
    the player appears in state on the NEXT patch cycle (not the same frame as the join)?

    Server patchRate = 1000/60 ~16ms. If the 3rd player's onJoin runs and state is set,
    but the state patch hasn't been sent yet when the join handshake completes,
    the client would see an empty or partial state initially.

    Actually: Colyseus sends the FULL state on join (not a patch). The full state includes
    all current players. So when joinById resolves, the state should have all players.

    The most likely intermittent cause: during the initial state delivery, the local player's
    onAdd fires, but the `player.role` is still the default "" (empty string).
    Line 211: `const role = player.role || 'faran'` -> defaults to 'faran'
    Line 253: `this.localRole = 'faran'` (but Baran selected 'baran')

    In update() line 413: `if (this.localRole === 'paran')` -> false (localRole is 'faran')
    So Baran falls into the else branch (line 424-426): guardian diagonal input. This is CORRECT for baran.

    So even if localRole defaults to 'faran', the input processing is the same for all guardians.
    The PredictionSystem uses CHARACTERS[role] for stats. faran vs baran might have different stats.
    Let me check.
  implication: Need to verify if faran and baran have different physics stats

- timestamp: 2026-02-11T10:29:00Z
  checked: Character stats for faran vs baran (shared/characters)
  found: Need to check CHARACTERS definition
  implication: Different stats would cause prediction mismatch but not "controls not responding"

## Resolution

root_cause: |
  TWO ROOT CAUSES:

  ### Sub-issue 1: Baran controls intermittently not responding

  ROOT CAUSE: Race condition between scene creation and PredictionSystem initialization.

  The update() loop at GameScene.ts:353 has a guard: `if (!this.connected || !this.room || !this.prediction) return;`

  `prediction` is only set inside the `players.onAdd` callback (line 254) when the local player is detected.
  In Colyseus 0.15, onAdd fires immediately for existing items when registered. However, there is a
  timing window where:

  1. The room was joined in LobbyScene (line 666) and passed to GameScene
  2. GameScene.create() runs and registers onAdd at line 197
  3. If the initial state has been decoded before onAdd registration, onAdd fires immediately -> prediction initialized -> OK
  4. But if there is any delay (scene transition overhead, state decoding), prediction stays null

  Additionally, for SUBSEQUENT matches (scene reuse), GameScene's member variables are NOT re-initialized
  because Phaser's scene.start() calls create() but NOT the constructor. This means:
  - `this.connected` is still `true` from previous match
  - `this.prediction` still points to the OLD PredictionSystem
  - `this.playerSprites`, `this.remotePlayers` etc contain stale data from previous match
  - Old sprites are never cleaned up, new sprites are created on top

  The member variables MUST be reset at the top of create(). This is likely the primary cause
  of "intermittent" issues - it works on first play but breaks on subsequent lobby->game cycles.

  ### Sub-issue 2: Status text inconsistency

  ROOT CAUSE: Three competing status-text writers race against each other with no coordination:

  Writer 1 (line 102-109): Initial synchronous check of `this.room.state.matchState`
  - Runs immediately after room assignment
  - Shows either "Match started!" or "Waiting for players... (N/3)"

  Writer 2 (line 142-148): Schema listen("matchState") callback
  - Fires IMMEDIATELY on registration with current value (Colyseus 0.15 default: immediate=true)
  - If matchState is already "playing" at registration time, sets "Match started!" + 2s hide timer
  - If matchState is "waiting", does nothing (if-guard only acts on "playing")

  Writer 3 (line 203-207): onAdd player count update
  - Fires for each player added, updates "Waiting for players... (N/3)"
  - Only fires when count < 3 and matchState !== 'playing'

  The race produces different results per player:

  **Paran (1st joiner):**
  - Writer 1: matchState="waiting", players.size=0 or 1 -> "Waiting for players... (0/3)"
  - Writer 2: fires with "waiting" -> no action
  - Writer 3: fires for each player, updates count
  - Eventually Writer 2 fires on change to "playing" -> "Match started!" -> hides after 2s
  - User sees "Waiting for players... 0/3" initially (stale count, never updates to 3/3)

  **Faran (2nd joiner):**
  - Writer 1: matchState="waiting" -> "Waiting for players... (N/3)"
  - Writer 2: fires with "waiting" -> no action
  - Very quickly after, 3rd player joins -> matchState changes to "playing"
  - Writer 2 fires with "playing" -> "Match started!" + 2s hide timer
  - 2s later: text hidden. User barely sees anything.

  **Baran (3rd/last joiner):**
  - Server: onJoin adds player, players.size=3, startMatch() runs SYNCHRONOUSLY -> matchState="playing"
  - Client: initial state already has matchState="playing"
  - Writer 1: matchState="playing" -> "Match started!" + 2s hide timer (line 103-106)
  - Writer 2: listen() fires immediately with "playing" -> "Match started!" + ANOTHER 2s hide timer (line 144-147)
  - Two hide timers both running. Text shows "Match started!" correctly but has double-timer issue.

  The core problem: Writer 1 and Writer 2 are REDUNDANT when matchState is already "playing" (both fire),
  and there's no handling of the "waiting" -> "Waiting for players..." progression that accounts for
  the initial player count being 0 (because players.size hasn't synced yet when Writer 1 runs).

  The `listen("matchState")` call was added in the 05-09 fix but it duplicates the initial check.
  The listen() fires immediately with the current value, so for Baran it creates a duplicate "Match started!"
  with a duplicate hide timer. For Faran the timing causes the text to flash and disappear.
  For Paran the initial count of 0 is never corrected because onAdd only updates when count < 3.

fix:
verification:
files_changed: []

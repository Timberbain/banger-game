---
status: diagnosed
trigger: "When a player disconnects during a match, they are removed from the screen entirely instead of being shown as ghosted (30% opacity) with a DC label."
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Multiple root causes found
test: Static analysis of server onLeave + Colyseus core source + client onChange/onRemove handlers
expecting: N/A - diagnosis complete
next_action: Return findings

## Symptoms

expected: Disconnected player should remain visible at 30% opacity with a yellow "DC" label below, frozen in place
actual: Disconnected player is removed from the screen entirely
errors: None reported
reproduction: Player disconnects during active match
started: Unknown - may have never worked correctly

## Eliminated

- hypothesis: "Colyseus sets consented=true for browser tab close, causing immediate player deletion"
  evidence: Verified in @colyseus/core Room.mjs line 580 - consented is true ONLY when close code === 4000 (WS_CLOSE_CONSENTED). Browser tab close sends code 1001 which is NOT 4000. consented=false for tab close.
  timestamp: 2026-02-10

- hypothesis: "onChange doesn't fire when connected changes in schema v2"
  evidence: Verified in @colyseus/schema/build/esm/index.mjs - _triggerChanges (line 2561) fires after decode completes. Schema onChange callback (line 2959) fires for any property change. Boolean connected field IS @type decorated and will be tracked.
  timestamp: 2026-02-10

- hypothesis: "onRemove fires prematurely during grace period"
  evidence: Server code (GameRoom.ts lines 209-228) shows players.delete() only in catch block after grace period expires. During the await, player stays in MapSchema. onRemove cannot fire on remote clients during grace period.
  timestamp: 2026-02-10

- hypothesis: "player.connected value is stale inside onChange callback"
  evidence: @colyseus/schema v2 fires _triggerChanges AFTER all decode operations complete (index.mjs line 2561). Properties are already updated when callbacks fire.
  timestamp: 2026-02-10

## Evidence

- timestamp: 2026-02-10
  checked: Server GameRoom.onLeave flow (lines 183-234)
  found: player.connected=false is set on line 193 BEFORE the consented check. For non-consented leaves during PLAYING state, allowReconnection is called (line 214) with 60s grace. Player stays in MapSchema.
  implication: Server-side flow is correct for non-consented disconnects.

- timestamp: 2026-02-10
  checked: Colyseus core _onLeave (Room.mjs line 580)
  found: consented = (code === Protocol.WS_CLOSE_CONSENTED) where WS_CLOSE_CONSENTED = 4000. Browser tab close sends code 1001 != 4000. Only explicit room.leave() sends LEAVE_ROOM protocol which maps to 4000.
  implication: Non-intentional disconnects always go through the reconnection grace period path.

- timestamp: 2026-02-10
  checked: Client GameScene onChange handler (lines 229-345)
  found: onChange handler correctly checks !player.connected (line 251), sets alpha to 0.3, creates DC label. Logic appears correct.
  implication: If onChange fires, the DC rendering should work.

- timestamp: 2026-02-10
  checked: Client GameScene onRemove handler (lines 364-398)
  found: onRemove unconditionally destroys all sprites, labels, health bars, eliminated texts for the removed sessionId.
  implication: If onRemove fires (after grace period), all visual elements are cleaned up. This is correct behavior.

- timestamp: 2026-02-10
  checked: Client handleReconnection + attachRoomListeners (lines 656-736)
  found: attachRoomListeners() (line 697) only re-attaches message handlers (matchStart, matchEnd, onLeave). Does NOT re-attach: players.onAdd, players.onRemove, player.onChange, projectiles.onAdd, projectiles.onRemove.
  implication: After successful reconnection, the reconnecting client is blind to ALL state changes - no new sprites, no position updates, no disconnect rendering.

- timestamp: 2026-02-10
  checked: Colyseus client SDK Room constructor (Room.mjs line 37)
  found: this.onLeave(() => this.removeAllListeners()) registered in constructor. When WebSocket closes, onclose handler (line 56) invokes onLeave which clears all listeners, then calls room.destroy().
  implication: The old room's state listeners are fully torn down on disconnect. New room from reconnect() starts with zero state listeners.

- timestamp: 2026-02-10
  checked: GameScene update loop health bar / eliminated text repositioning (lines 571-585)
  found: eliminatedText.y = sprite.y - 40, but DC text is created at player.y + 30 (line 260). Update loop repositions DC text above sprite instead of below.
  implication: Minor cosmetic issue - DC label position is inconsistent with creation position.

## Resolution

root_cause: |
  TWO ROOT CAUSES identified:

  ROOT CAUSE 1 (Primary - affects what REMOTE clients see):
  The disconnect ghosting (onChange handler, lines 251-273) SHOULD work for non-consented
  disconnects based on code analysis. The server correctly sets player.connected=false,
  the player stays in MapSchema during the 60s grace period, and the client onChange handler
  has correct DC rendering logic. However, the code has NEVER been tested - it was written
  during Phase 5 but no tests exist. The most likely failure scenario is that the user is
  testing by calling room.leave() explicitly (from VictoryScene line 124 or LobbyScene
  lines 452/712), which sends LEAVE_ROOM protocol -> consented=true -> server immediately
  deletes the player (line 198) -> onRemove fires -> sprites destroyed. The DC ghosting
  path only works for non-consented disconnects (network failure, not explicit leave).

  If the issue occurs even for genuine network disconnects, the problem may be a subtle
  timing issue in the Colyseus schema v2 patch encoding where connected=false is not
  being included in the delta (would need runtime verification with logging).

  ROOT CAUSE 2 (Secondary - affects RECONNECTING client):
  attachRoomListeners() at line 697 in GameScene.ts only re-attaches message handlers
  (matchStart, matchEnd, onLeave) but does NOT re-attach state schema listeners:
  - players.onAdd (missing)
  - players.onRemove (missing)
  - player.onChange for each player (missing)
  - projectiles.onAdd (missing)
  - projectiles.onRemove (missing)
  After successful reconnection, the client receives a new Room instance but has zero
  state listeners. No sprites update, no new players appear, no disconnect states render.
  The client is effectively frozen at whatever state it had before disconnecting.

fix:
verification:
files_changed: []

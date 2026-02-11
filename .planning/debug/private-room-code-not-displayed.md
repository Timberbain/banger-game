---
status: diagnosed
trigger: "When creating a private room in the lobby, no room code is displayed to the user."
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Timing issue: showLobbyView reads state before initial sync
test: Traced full code path from server generation to client display
expecting: N/A - root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: A 6-character room code should appear in yellow at the top of the lobby view after creating a private room
actual: No room code is displayed to the user
errors: None reported
reproduction: Create a private room in the lobby
started: Unknown

## Eliminated

- hypothesis: Server fails to generate room code
  evidence: LobbyRoom.ts:21 correctly calls generateRoomCode() in onCreate when options.private is true. roomCode.ts generates valid 6-char codes.
  timestamp: 2026-02-10

- hypothesis: LobbyState schema missing roomCode/isPrivate fields
  evidence: LobbyState.ts:19-20 has both @type("string") roomCode and @type("boolean") isPrivate properly decorated for sync
  timestamp: 2026-02-10

- hypothesis: Client doesn't pass private:true when creating room
  evidence: LobbyScene.ts:162-163 passes { private: true, name: this.playerName }
  timestamp: 2026-02-10

## Evidence

- timestamp: 2026-02-10
  checked: Server room code generation (LobbyRoom.ts:20-26)
  found: roomCode and isPrivate are correctly assigned in onCreate when options.private is truthy
  implication: Server-side generation is correct

- timestamp: 2026-02-10
  checked: LobbyState schema (LobbyState.ts:17-22)
  found: Both roomCode and isPrivate have @type decorators and are sync'd. Default values are "" and false respectively.
  implication: Schema is correct but defaults are falsy

- timestamp: 2026-02-10
  checked: Client display condition (LobbyScene.ts:393)
  found: Condition is `if (this.room.state.isPrivate && this.room.state.roomCode)` - runs once synchronously in showLobbyView()
  implication: If state hasn't synced yet, both values are falsy defaults, condition fails

- timestamp: 2026-02-10
  checked: Call sequence in createPrivateRoom (LobbyScene.ts:162-168)
  found: showLobbyView() is called immediately after `await this.client.create()` resolves, with no wait for state sync
  implication: In Colyseus 0.15, create() resolves on join acknowledgement; initial state patch may not yet be deserialized

- timestamp: 2026-02-10
  checked: Whether showLobbyView has any listener to re-render room code on state change
  found: NO listener for roomCode or isPrivate changes. Only countdown (line 423) and player changes (lines 560-563, 615-619) have listeners.
  implication: Even if state syncs later, the room code display logic never re-executes

## Resolution

root_cause: Race condition between room creation and state synchronization. In LobbyScene.ts, createPrivateRoom() calls showLobbyView() immediately after `await this.client.create()` resolves (line 168). At this point, the initial state patch from the server has not yet been deserialized on the client, so `room.state.isPrivate` is still `false` and `room.state.roomCode` is still `""` (their Schema default values). The display condition on line 393 (`if (this.room.state.isPrivate && this.room.state.roomCode)`) evaluates to false, and the room code text is never created. There is no state change listener that would re-check this condition after state sync completes.
fix:
verification:
files_changed: []

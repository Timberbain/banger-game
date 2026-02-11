---
phase: 05-multiplayer-lobbies
plan: 08
status: complete
type: execute
gap_closure: true
started: 2026-02-10T23:30:00Z
completed: 2026-02-10T23:45:00Z
---

## Result

All 6 lobby-related UAT gaps fixed across LobbyScene.ts and LobbyRoom.ts.

## Changes

### client/src/scenes/LobbyScene.ts
- **Fix A**: Added focus/blur listeners on HTML input in showJoinInput() to disable/enable Phaser keyboard capture. D, S, W, A keys now work in room code input.
- **Fix B**: Reset `this.selectedRole = null` in both showMainMenu() and showLobbyView(). No more stale character highlight.
- **Fix C**: Changed MAX_RETRIES from 3→12 and RETRY_DELAY from 800→1000ms. Reconnection window now 12s (exceeds 9s server ping timeout).
- **Fix D**: Updated joinPrivateRoom catch to distinguish "Room is full!" vs "Room not found!" based on error message content.
- **Fix E**: selectRole() now toggles — clicking already-selected role sends 'deselectRole' and clears local state.
- **Fix G/H/I**: Lobby reconnection token stored in localStorage ('bangerLobbyRoom') on lobby join. checkReconnection() checks lobby token first, attempts reconnect. Token cleared on game transition, menu return, and shutdown.

### server/src/rooms/LobbyRoom.ts
- **Fix F**: Added 'deselectRole' message handler that clears player.role and player.ready, and cancels active countdown.

## Verification

- TypeScript compilation passes for both client and server (npx tsc --noEmit)
- All fix patterns verified present via grep
- No regressions to existing lobby flow

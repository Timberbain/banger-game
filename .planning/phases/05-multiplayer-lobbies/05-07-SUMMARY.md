---
phase: 05-multiplayer-lobbies
plan: 07
subsystem: reconnection
tags: [reconnection, disconnect-ui, state-sync, race-condition]
dependencies:
  requires: [05-03-reconnection-support]
  provides: [reliable-reconnection, visual-disconnect-feedback]
  affects: [game-room, game-scene, lobby-scene]
tech-stack:
  added: []
  patterns: [retry-with-backoff, deferred-deletion, state-listener-reattachment]
key-files:
  created: []
  modified:
    - path: server/src/rooms/GameRoom.ts
      changes: [deferred-consented-leave-deletion]
    - path: client/src/scenes/GameScene.ts
      changes: [separate-dc-labels, handlePlayerChange-helper, full-state-listener-reattachment]
    - path: client/src/scenes/LobbyScene.ts
      changes: [retry-logic-with-800ms-delay]
key-decisions:
  - decision: Defer consented leave deletion by 2s during PLAYING state
    rationale: Gives clients time to render ghosted disconnect state before removal
    alternatives: [immediate-deletion, longer-delay]
  - decision: Separate dcLabels map from eliminatedTexts map
    rationale: Prevents collision between DC and ELIMINATED labels
    alternatives: [shared-map-with-type-flag, single-status-label]
  - decision: 3 retries with 800ms delay for reconnection
    rationale: Allows server time to process WebSocket close and register reconnection token
    alternatives: [single-attempt, exponential-backoff, longer-delay]
  - decision: Extract handlePlayerChange() helper for code reuse
    rationale: Deduplicates onChange logic between initial connection and reconnection
    alternatives: [inline-duplication, event-emitter-pattern]
metrics:
  duration: 205
  completed: 2026-02-10T21:41:17Z
  tasks: 2
  files: 3
  commits: 2
---

# Phase 05 Plan 07: Reconnection Failures & Disconnect Ghosting Summary

**One-liner:** Fixed disconnect ghosting with separate DC labels and deferred deletion; added 3-attempt retry logic with 800ms delay for F5 reconnection; full Schema state listener re-registration after reconnect.

## What Was Built

Fixed two critical reconnection issues:

1. **Disconnect ghosting failure**: Consented leaves deleted player immediately in same patch as connected=false, causing onRemove to fire before ghost could render. DC and ELIMINATED labels shared same map, causing collision.

2. **Browser refresh reconnection failure**: Race condition where client reconnects before server processes WebSocket close and registers token in _reconnections map. Missing state listeners after reconnect caused new players/projectiles to be invisible.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Fix disconnect ghosting (server + client) | 208c091 | GameRoom.ts, GameScene.ts |
| 2 | Fix reconnection (retry logic + full state listener re-registration) | 6652482 | GameScene.ts, LobbyScene.ts |

## Implementation Details

### Task 1: Disconnect Ghosting

**Server (GameRoom.ts):**
- Defer consented leave deletion by 2s during PLAYING state
- connected=false syncs in one patch, deletion happens 2s later
- Allows clients to render ghosted state before removal
- Immediate deletion for non-PLAYING states (no visual needed)

**Client (GameScene.ts):**
- Create separate dcLabels map (Map<string, Phaser.GameObjects.Text>)
- DC label shows for disconnected alive players (yellow "DC" at y+30)
- ELIMINATED shows for dead players (red "ELIMINATED" at y-40)
- Labels tracked independently, cleaned up on reconnect/death/removal
- Fix: DC rendering checks health > 0 (prevents DC on dead disconnected)

### Task 2: Reconnection

**LobbyScene.ts:**
- Add retry logic: 3 attempts with 800ms delay
- Loop through attempts, catch failures, wait before retry
- Update UI with attempt count during retry sequence
- Throw only after all attempts exhausted

**GameScene.ts:**
- Extract handlePlayerChange() helper (78 lines)
- Shared between create() and attachRoomListeners()
- Centralizes disconnect/death/alive state rendering
- Expand attachRoomListeners() to include:
  - players.onAdd, players.onRemove, player.onChange
  - projectiles.onAdd, projectiles.onRemove
  - Skip creating visuals for already-present players
  - Re-register all onChange callbacks

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

**Colyseus batch patching:** Changes to Schema properties batch into a single patch per tick. Setting player.connected=false and calling players.delete() in the same code path causes both changes to arrive in the same client patch, with onRemove firing before the connected=false onChange can render.

**WebSocket close timing:** The WebSocket close event is asynchronous. If client.reconnect() is called before the server processes the close and calls allowReconnection(), the reconnection token doesn't exist yet in the _reconnections map, causing the reconnect to fail. The 800ms retry delay gives the server time to process the close.

**State listener registration:** Colyseus state listeners are per-room-connection. After reconnection, the room object is replaced, so all listeners must be re-registered. Missing this causes new players/projectiles added after reconnect to be invisible.

## Self-Check: PASSED

**Files created:** N/A

**Files modified:**
- server/src/rooms/GameRoom.ts: FOUND
- client/src/scenes/GameScene.ts: FOUND
- client/src/scenes/LobbyScene.ts: FOUND

**Commits:**
- 208c091: FOUND
- 6652482: FOUND

**Verification:**
- dcLabels map found in GameScene.ts (10 references)
- clock.setTimeout for deferred deletion found in GameRoom.ts
- eliminatedTexts NOT found in disconnect rendering block
- MAX_RETRIES retry logic found in LobbyScene.ts
- handlePlayerChange method found in GameScene.ts (4 references)
- players.onAdd found in attachRoomListeners (2 total: create + attach)
- projectiles.onAdd found in attachRoomListeners (2 total: create + attach)

All claims verified.

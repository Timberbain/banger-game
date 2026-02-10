---
phase: 05-multiplayer-lobbies
plan: 04
subsystem: multiplayer-core
tags: [bugfix, gap-closure, room-transition, role-assignment]
completed: 2026-02-10
duration: 5 minutes

dependency_graph:
  requires:
    - 05-01 (LobbyRoom and GameRoom with role assignment system)
    - 05-02 (Client lobby UI and scene transitions)
  provides:
    - Working lobby-to-game transition for all 3 players
    - Correct role assignment from lobby to GameRoom
  affects:
    - LobbyRoom.startMatch() - room creation mechanism
    - GameRoom.onJoin() - role assignment logic

tech_stack:
  added: []
  patterns:
    - matchMaker.createRoom() for room creation without seat reservation
    - Client-sent role in options for cross-room role persistence
    - Server-side role conflict detection and fallback

key_files:
  created: []
  modified:
    - server/src/rooms/LobbyRoom.ts
    - server/src/rooms/GameRoom.ts
    - server/dist/server/src/rooms/LobbyRoom.js
    - server/dist/server/src/rooms/GameRoom.js

decisions:
  - title: "matchMaker.createRoom() instead of create()"
    rationale: "create() returns SeatReservation which consumes 1 of 3 maxClients slots, preventing 3rd player from joining. createRoom() just creates the room without reserving a seat."
    alternatives: ["Use create() and consume the reservation", "Increase maxClients to 4"]
    chosen: "createRoom()"
  - title: "Role from options.role instead of sessionId lookup"
    rationale: "SessionIds change when clients join new rooms, so roleAssignments[sessionId] lookup fails. Client already sends role in join options from lobby."
    alternatives: ["Use seat reservations with role metadata", "Create player-to-role mapping service"]
    chosen: "options.role"
  - title: "Server-side role conflict prevention"
    rationale: "Network race conditions could cause duplicate role assignments. Server validates and falls back to first available role if conflict detected."
    alternatives: ["Trust client role selection", "Reject join on conflict"]
    chosen: "Fallback to available role"

metrics:
  tasks_completed: 2
  files_modified: 2
  commits: 2
  build_output_files: 54
---

# Phase 5 Plan 4: Fix Lobby-to-Game Transition Blockers

**One-liner:** Fix phantom seat reservation and wrong role assignment blocking all 3 players from joining GameRoom after lobby countdown.

## Overview

This gap closure plan resolved two critical blockers preventing the lobby-to-game transition from working:

1. **Phantom Seat Blocker**: LobbyRoom.startMatch() used `matchMaker.create()` which returns a SeatReservation, consuming 1 of the 3 maxClients slots. This left only 2 slots available, causing the 3rd player to be rejected with "room is full".

2. **Role Assignment Blocker**: GameRoom.onJoin() looked up roles using `roleAssignments[client.sessionId]`, but sessionIds change when clients join a new room. The roleAssignments map from LobbyRoom used old sessionIds, so lookups always failed, causing wrong role assignments.

## Implementation Details

### Task 1: Fix Phantom Seat and Role Assignment

**Phantom Seat Fix (LobbyRoom.ts line 255)**

Changed from:
```typescript
const reservation = await matchMaker.create("game_room", {
  fromLobby: true,
  roleAssignments,
});
this.broadcast("gameReady", { gameRoomId: reservation.room.roomId });
```

To:
```typescript
const room = await matchMaker.createRoom("game_room", {
  fromLobby: true,
  roleAssignments,
});
this.broadcast("gameReady", { gameRoomId: room.roomId });
```

The `createRoom()` method creates the room without seat reservation, leaving all 3 maxClients slots available for real players.

**Role Assignment Fix (GameRoom.ts lines 128-144)**

Replaced sessionId-based role lookup with client-sent role from options:

```typescript
let role: string;

// If client sends role from lobby, use it (with validation)
if (options?.role && ["paran", "faran", "baran"].includes(options.role)) {
  role = options.role;
} else if (this.roleAssignments && this.roleAssignments[client.sessionId]) {
  // Fallback to roleAssignments lookup (unlikely to match but kept for safety)
  role = this.roleAssignments[client.sessionId];
} else {
  // Final fallback: assign by join order (backward compatibility for direct joins)
  const playerCount = this.state.players.size;
  if (playerCount === 0) {
    role = "paran";
  } else if (playerCount === 1) {
    role = "faran";
  } else {
    role = "baran";
  }
}

// Validate no duplicate roles
let roleTaken = false;
this.state.players.forEach((p) => {
  if (p.role === role) roleTaken = true;
});
if (roleTaken) {
  // Assign first available role
  const takenRoles = new Set<string>();
  this.state.players.forEach((p) => { takenRoles.add(p.role); });
  const availableRoles = ["paran", "faran", "baran"].filter(r => !takenRoles.has(r));
  role = availableRoles[0] || "baran";
}
```

The client already sends `role: this.selectedRole` in join options (LobbyScene.ts line 458), so GameRoom can read it directly. Added conflict detection to handle race conditions where two clients might claim the same role.

### Task 2: Rebuild Server dist/

Recompiled TypeScript to ensure the running server uses the fixed code:
```bash
cd server && npx tsc
```

Verified the build output contains:
- `dist/server/src/rooms/LobbyRoom.js` line 230: `matchMaker.createRoom()`
- `dist/server/src/rooms/GameRoom.js` line 131: `options?.role` check

The dist folder now contains all Phase 5 code (LobbyRoom, MatchmakingRoom, MatchmakingQueue) that was previously missing from the compiled output.

## Verification Results

All verification criteria passed:
- `server/src/rooms/LobbyRoom.ts` uses `matchMaker.createRoom()` not `matchMaker.create()`
- `server/src/rooms/GameRoom.ts` reads role from `options.role` with validation
- GameRoom has role conflict prevention (no duplicate roles)
- Server TypeScript compiles without errors (`npx tsc --noEmit`)
- Server dist/ rebuilt and matches source (modification times confirmed)

Grep verifications:
- `matchMaker.createRoom` found in LobbyRoom.ts
- `options?.role` found in GameRoom.ts
- `matchMaker.create(` NOT found in LobbyRoom.ts (only createRoom)
- Compiled .js files contain the fixes

## Deviations from Plan

None - plan executed exactly as written. Both blockers were clearly diagnosed in the UAT, and the fixes were straightforward API changes.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3d85498 | Fix phantom seat reservation and role assignment blockers |
| 2 | 71a85f5 | Rebuild server dist with lobby and role fixes |

## Testing Notes

These fixes address UAT failures from `.planning/phases/05-multiplayer-lobbies/05-UAT.md`:
- **GAP-02**: "Only 2 of 3 players joined game" - fixed by removing phantom seat reservation
- **GAP-03**: "Wrong roles assigned" - fixed by using options.role instead of sessionId lookup

To verify the fixes work:
1. Start server: `cd server && npm start`
2. Start client: `cd client && npm run dev`
3. Open 3 browser tabs
4. Create private lobby in tab 1, join with tabs 2-3 using room code
5. Each player selects different role and clicks Ready
6. Verify all 3 players transition to GameScene with correct roles after countdown

Expected behavior:
- All 3 players successfully join GameRoom (no "room is full" error)
- Each player's character in GameScene matches their lobby role selection
- No phantom occupancy consuming a maxClients slot

## Self-Check: PASSED

Verified all claimed files exist:
```
FOUND: /Users/jonasbrandvik/Projects/banger-game/server/src/rooms/LobbyRoom.ts
FOUND: /Users/jonasbrandvik/Projects/banger-game/server/src/rooms/GameRoom.ts
FOUND: /Users/jonasbrandvik/Projects/banger-game/server/dist/server/src/rooms/LobbyRoom.js
FOUND: /Users/jonasbrandvik/Projects/banger-game/server/dist/server/src/rooms/GameRoom.js
```

Verified all claimed commits exist:
```
FOUND: 3d85498 (fix(05-04): fix phantom seat and role assignment blockers)
FOUND: 71a85f5 (chore(05-04): rebuild server dist with lobby and role fixes)
```

All claims verified.

---
phase: 05-multiplayer-lobbies
plan: 06
subsystem: matchmaking
tags: [matchmaking, queue, lobby, gap-closure]
dependency_graph:
  requires: [05-01-lobby-infrastructure, 05-02-client-lobby-ui]
  provides: [working-matchmaking-queue]
  affects: [matchmaking-pipeline]
tech_stack:
  added: [MatchmakingRoom]
  patterns: [shared-room-instance, queue-based-matching, role-assignment]
key_files:
  created:
    - server/src/rooms/MatchmakingRoom.ts
  modified:
    - server/src/index.ts
    - client/src/scenes/LobbyScene.ts
decisions:
  - Single shared MatchmakingRoom instance for all queuing players
  - Match formation check runs every 1 second via clock interval
  - Server creates lobby room and broadcasts roomId to matched players
  - Client receives assigned role and auto-selects in lobby
  - Queue size displayed to players while waiting
metrics:
  duration: 4 minutes
  completed: 2026-02-10
  tasks: 2
  commits: 2
  files_modified: 3
---

# Phase 05 Plan 06: Matchmaking Room Implementation Summary

**One-liner:** Dedicated MatchmakingRoom with queue-based player matching, animated searching UI, and seamless lobby transition when 1 paran + 2 guardians are found.

## What Was Built

### MatchmakingRoom (Server)
- **Queue system:** Players join shared matchmaking_room with preferredRole
- **Role tracking:** Separate counts for paran queue vs guardian queue
- **Match formation:** Every 1 second, check if 1 paran + 2 guardians available
- **Lobby creation:** When match forms, create lobby_room and send roomId to matched players
- **Role assignment:** Server assigns specific roles (paran, faran, baran) and sends with matchFound message
- **Queue cleanup:** Remove matched players from queue after lobby created

### Client Matchmaking Flow
- **Join matchmaking_room:** "Find Match" button now joins dedicated waiting room (not lobby_room)
- **Animated UI:** "Searching..." text with animated dots while waiting
- **Queue display:** Real-time queue counts shown (e.g., "In queue: 2 Paran, 3 Guardian")
- **matchFound handler:** Receive lobby roomId and assigned role, leave matchmaking, join lobby
- **Auto-role selection:** Pre-select assigned role after joining lobby
- **Cancel button:** Leave matchmaking queue and return to menu

## Architecture

### Before (Broken Flow)
```
Client clicks "Find Match"
→ joinOrCreate('lobby_room', { matchmaking: true })
→ Resolves immediately (creates or joins lobby)
→ "Searching..." text replaced within milliseconds
→ No actual waiting/queueing
```

### After (Working Flow)
```
Client clicks "Find Match"
→ joinOrCreate('matchmaking_room', { preferredRole })
→ Shows "Searching..." UI with queue counts
→ Server checks for match every 1s
→ When 1 paran + 2 guardians found:
   - Server creates lobby_room
   - Server sends matchFound message to matched players
   - Clients leave matchmaking_room
   - Clients joinById(lobbyRoomId) with assigned roles
→ Lobby scene loads with pre-selected roles
```

## Key Design Decisions

**Single Shared MatchmakingRoom:**
- All players join the same room instance (no filterBy)
- Simplifies match formation logic (no cross-room coordination needed)
- maxClients = 50 to allow many players to queue simultaneously

**Match Check Interval:**
- 1 second interval via this.clock.setInterval
- Balances responsiveness with server load
- Sufficient for matchmaking (players expect some wait time)

**Role Assignment Logic:**
- Paran: always assigned "paran"
- Guardian 1: assigned preferred role (faran or baran)
- Guardian 2: assigned opposite guardian role (ensures 1 faran + 1 baran)

**Client Auto-Role Selection:**
- After joining lobby, client sends selectRole with assigned role
- 500ms delay ensures lobby view has loaded
- Provides seamless experience (no manual role selection needed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error on matchmakingRoom.state**
- **Found during:** Task 2 compilation
- **Issue:** TypeScript cannot infer type of matchmakingRoom.state (unknown type)
- **Fix:** Cast to `(matchmakingRoom.state as any)` for paranCount/guardianCount access
- **Files modified:** client/src/scenes/LobbyScene.ts
- **Commit:** 19d1499

## Testing Notes

**Manual verification needed:**
1. Start server and client
2. Open 3 browser windows
3. Click "Find Match" in window 1 (choose Paran)
4. Click "Find Match" in window 2 (choose Faran)
5. Click "Find Match" in window 3 (choose Baran)
6. Verify:
   - All 3 see "Searching..." with queue counts incrementing
   - When all 3 joined, match forms and all transition to lobby together
   - Each player has assigned role pre-selected in lobby
   - Cancel button works during queue
7. Test edge cases:
   - Cancel during search (should return to menu)
   - Network disconnect during queue (should handle gracefully)
   - Join with invalid role (should default to faran)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | d2100bd | Create MatchmakingRoom for queue-based matchmaking |
| 2 | 19d1499 | Update client to use MatchmakingRoom for queue system |

## Self-Check

Verifying deliverables:

```bash
# Check created files
[ -f "server/src/rooms/MatchmakingRoom.ts" ] && echo "FOUND: MatchmakingRoom.ts" || echo "MISSING"
```

```bash
# Check commits
git log --oneline --all | grep -q "d2100bd" && echo "FOUND: d2100bd" || echo "MISSING"
git log --oneline --all | grep -q "19d1499" && echo "FOUND: 19d1499" || echo "MISSING"
```

```bash
# Check registration
grep -q "matchmaking_room" server/src/index.ts && echo "FOUND: matchmaking_room registration" || echo "MISSING"
```

**Results:**
✓ FOUND: server/src/rooms/MatchmakingRoom.ts
✓ FOUND: commit d2100bd
✓ FOUND: commit 19d1499
✓ FOUND: matchmaking_room registration in server/src/index.ts

## Self-Check: PASSED

All deliverables verified. Plan execution complete.

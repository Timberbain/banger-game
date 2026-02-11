---
status: diagnosed
trigger: "F5 reconnection disrupts other players' connections"
created: 2026-02-11T12:00:00Z
updated: 2026-02-11T13:30:00Z
---

## Current Focus

hypothesis: Two compounding issues -- (1) Missing onUncaughtException handler means any unhandled throw in simulation/timers crashes server, (2) Missing error resilience in reconnection flow
test: N/A - diagnosis complete
expecting: N/A
next_action: Return diagnosis

## Symptoms

expected: When one player presses F5, that player reconnects; other two players are unaffected
actual: The other two players see "reconnecting" and eventually fall back to lobby
errors: N/A (no crash error reported)
reproduction: Start 3-player match, one player presses F5
started: Phase 5 reconnection implementation

## Eliminated

9 hypotheses eliminated through code-level verification:
- allowReconnection affecting other clients (isolated to single sessionId)
- onJoin called again during reconnect (Colyseus skips onJoin for reconnections)
- encodeAll corrupting patches (does not clear incremental change tracker)
- Ping/pong terminating other clients (browsers auto-respond at protocol level)
- Room auto-disposing during reconnect (clients.length > 0 prevents this)
- checkWinConditions ending match (disconnected player still alive)
- patchRate misconfigured (correctly set to 16.67ms for 60Hz)
- Simulation loop affected (plain setInterval, not touched by reconnection)
- Server crash in onLeave code (all in try/catch)

## Evidence

- Colyseus Room._onJoin (Room.js:308-389): reconnection path (isWaitingReconnection=true) correctly skips onJoin, pushes new client, resolves deferred
- Schema.encode() with encodeAll=true (Schema.js:485-487): does NOT discard incremental changes, preserving patches for other clients
- allowReconnection .then() handler (Room.js:419-425): properly transfers WebSocket ref, sets RECONNECTED state, cleans up
- _onLeave post-reconnection (Room.js:617-629): correctly skips _decrementClientCount when client state is RECONNECTED
- autoTerminateUnresponsiveClients (WebSocketTransport.js:80-91): ping/pong only affects the specific dead WebSocket
- _disposeIfEmpty (Room.js:502-507): requires clients.length===0 AND no reserved seats -- impossible with 2 clients connected
- GameRoom does NOT define onUncaughtException (confirmed via grep)
- Colyseus ONLY wraps simulation/timer callbacks in try/catch when onUncaughtException is defined (Room.js:168-169)

## Resolution

root_cause: |
  PRIMARY: GameRoom does NOT define onUncaughtException. In Colyseus 0.15, the framework
  ONLY wraps setSimulationInterval, clock.setTimeout, clock.setInterval, and onMessage
  handlers in try/catch when onUncaughtException is defined (Room.js:168-169, 658-675).
  Without it, ANY unhandled exception in these handlers propagates to the Node.js event
  loop, crashing the process. ts-node-dev --respawn restarts the server, killing ALL
  WebSocket connections for ALL clients in ALL rooms.

  This explains the symptom: the F5 player's reconnection attempt triggers server-side
  processing (allowReconnection resolve, state mutations, _onJoin). If any error occurs
  during this async chain, the entire server process crashes. The other two players lose
  their connections. The F5 player's retry loop (12 attempts) either also fails (room
  gone after restart) or reconnects to a fresh server without their room.

  SECONDARY: Even without a crash, the reconnection flow has no defensive error handling.
  If the player state is mutated between disconnect and reconnect (e.g., killed by
  projectile while disconnected), the reconnection success path at GameRoom.ts:238-239
  sets connected=true without validating player state, which could cause downstream
  issues in fixedTick.

  REQUIRES LIVE VERIFICATION: Add onUncaughtException handler and verbose logging to
  confirm this is the crash path. Without it, the exact trigger cannot be determined
  from static code review alone.

fix: N/A - research only
verification: N/A
files_changed: []

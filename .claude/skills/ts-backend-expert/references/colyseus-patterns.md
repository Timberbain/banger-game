# Colyseus.js Patterns & Best Practices

## Table of Contents
- [Schema Design](#schema-design)
- [Room Architecture](#room-architecture)
- [State Synchronization](#state-synchronization)
- [Input Handling](#input-handling)
- [Reconnection](#reconnection)
- [Room Communication](#room-communication)
- [Performance](#performance)

## Schema Design

### Selective Synchronization
Decorate only client-visible fields with `@type`. Server-only fields stay undecorated:

```typescript
export class Player extends Schema {
  // Synced to all clients
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") health: number = 100;

  // Server-only — never sent over the wire
  inputQueue: InputMessage[] = [];
  lastFireTime: number = 0;
  internalCooldown: number = 0;
}
```

**Why:** Reduces bandwidth. Every `@type` field is serialized on change. Keep internal bookkeeping off the wire.

### Schema Granularity
- Keep Schema classes as minimal data containers (under 50 lines)
- One Schema per logical entity (Player, Projectile, Obstacle)
- Use `MapSchema<T>` for entities keyed by ID, `ArraySchema<T>` for ordered collections

### Avoid Nested Schema Unless Necessary
Flat schemas are cheaper to diff and sync. Only nest when the nested object has independent change frequency.

## Room Architecture

### Room Lifecycle Methods
Every room should implement these in order:

```typescript
class GameRoom extends Room<GameState> {
  onCreate(options: any)    // Init state, load maps, set intervals
  onJoin(client, options)   // Add player to state, validate options
  onLeave(client, consented) // Handle disconnect/reconnect
  onDispose()               // Cleanup intervals, release resources
}
```

### Single Responsibility Per Room Type
- **Lobby rooms**: Pre-match setup, role selection, ready system
- **Game rooms**: Authoritative simulation, input processing, win conditions
- **Queue rooms**: Matchmaking logic, periodic polling, match formation

Do not combine matchmaking and gameplay in the same room.

### Fixed Timestep Pattern
For deterministic simulation, use an accumulator:

```typescript
let elapsed = 0;
this.setSimulationInterval((deltaTime) => {
  elapsed += deltaTime;
  while (elapsed >= FIXED_STEP) {
    elapsed -= FIXED_STEP;
    this.fixedTick(FIXED_STEP);
  }
});
```

**Why:** Variable deltaTime causes client prediction drift. Fixed timestep (e.g., 1/60s) ensures server and client run identical physics.

## State Synchronization

### Delta Sync Strategy
Colyseus 0.15 uses automatic delta encoding. Optimize by:
- Minimizing `@type` fields (only sync what clients need)
- Using `number` over `string` where possible (cheaper diffs)
- Batching state changes within a single tick (one patch per interval)

### Broadcast vs Schema
- Use Schema for continuous state (positions, health, scores)
- Use `this.broadcast()` for discrete events (matchEnd, killFeed, announcements)

```typescript
// Continuous — use Schema
@type("number") health: number = 100;

// Discrete — use broadcast
this.broadcast("killFeed", { killer: "player1", victim: "player2" });
```

## Input Handling

### Input Queue Pattern
Queue inputs and drain them in fixedTick for deterministic replay:

```typescript
onMessage("input", (client, message) => {
  if (!this.isValidInput(message)) return;
  const player = this.state.players.get(client.sessionId);
  if (!player) return;
  if (player.inputQueue.length >= MAX_QUEUE) {
    player.inputQueue.shift(); // Drop oldest, not newest
  }
  player.inputQueue.push(message);
});
```

### Input Validation
Always validate untrusted client data at the boundary:

```typescript
private isValidInput(input: any): boolean {
  if (typeof input !== 'object' || input === null) return false;
  if (typeof input.seq !== 'number') return false;
  if (typeof input.up !== 'boolean') return false;
  // Validate all expected fields...
  return true;
}
```

**Never trust client data.** Validate types, ranges, and structure.

### Rate Limiting
Cap input queue size per player to prevent memory abuse:

```typescript
if (player.inputQueue.length >= 10) {
  player.inputQueue.shift();
}
```

## Reconnection

### Grace Period Pattern
Allow reconnection with cleanup on timeout:

```typescript
async onLeave(client: Client, consented: boolean) {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;

  player.connected = false;

  if (consented) {
    // Intentional leave — remove after short delay
    await this.clock.setTimeout(() => {
      this.state.players.delete(client.sessionId);
    }, 2000);
    return;
  }

  try {
    await this.allowReconnection(client, 60);
    player.connected = true;
  } catch {
    this.state.players.delete(client.sessionId);
  }
}
```

### onUncaughtException
Override to prevent reconnection errors from crashing the room:

```typescript
onUncaughtException(err: Error, methodName: string) {
  console.error(`[Room] Error in ${methodName}:`, err.message);
  // Do NOT rethrow — let room continue for other players
}
```

## Room Communication

### Room Transition Pattern
Use `matchMaker.createRoom()` (not `matchMaker.create()`) to avoid phantom seat reservations:

```typescript
const gameRoom = await matchMaker.createRoom("game_room", {
  roleAssignments,
  mapName: selectedMap,
});
this.broadcast("gameReady", { gameRoomId: gameRoom.roomId });
```

Clients join the new room with their assigned options:

```typescript
// Client-side
const gameRoom = await client.joinById(gameRoomId, { role: assignedRole });
```

### Private Rooms
Use `setPrivate(true)` + metadata for room codes:

```typescript
onCreate(options: any) {
  this.setPrivate(true);
  const code = generateRoomCode();
  this.setMetadata({ roomCode: code });
}
```

Lookup via HTTP endpoint + `matchMaker.query()`.

## Performance

### Avoid Redundant Iterations
If you iterate players multiple times per tick, consider combining passes:

```typescript
// Prefer: single pass with multiple checks
this.state.players.forEach((player, id) => {
  this.processInput(player);
  this.resolveCollisions(player);
  this.checkContactKills(player);
});
```

### Server-Only Computation
Move expensive calculations server-side and only sync results:
- Collision detection → sync resolved positions
- Damage calculation → sync health changes
- Win condition checks → broadcast match end

### Memory Management
- Clear intervals in `onDispose()`
- Remove players from MapSchema on disconnect timeout
- Shift oldest inputs when queue is full (not push unbounded)

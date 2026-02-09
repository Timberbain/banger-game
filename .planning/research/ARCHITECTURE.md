# Architecture Patterns: Real-Time Multiplayer Browser Arena Game

**Domain:** Browser-based multiplayer arena shooter (Phaser + Colyseus)
**Project:** Banger (1v2 asymmetric shooter)
**Researched:** 2026-02-09
**Confidence:** MEDIUM (based on established patterns, unable to verify with current sources)

## Recommended Architecture

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   UI Layer   │  │  Game Scene  │  │ Input System │      │
│  │  (HTML/CSS)  │  │   (Phaser)   │  │   (Phaser)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │ Client Manager  │                        │
│                   │ (State Handler) │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │ Colyseus Client │                        │
│                   └────────┬────────┘                        │
└────────────────────────────┼─────────────────────────────────┘
                             │ WebSocket
┌────────────────────────────▼─────────────────────────────────┐
│                         SERVER                               │
│                   ┌─────────────────┐                        │
│                   │  Colyseus Core  │                        │
│                   │ (Room Manager)  │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐     │
│  │  Game Room   │  │  Game Room   │  │  Game Room   │     │
│  │  (Instance)  │  │  (Instance)  │  │  (Instance)  │     │
│  └──────┬───────┘  └──────────────┘  └──────────────┘     │
│         │                                                    │
│  ┌──────▼───────────────────────────────────────┐          │
│  │           Game Room Components                │          │
│  │  ┌──────────────┐  ┌──────────────┐          │          │
│  │  │ Game State   │  │Physics Engine│          │          │
│  │  │   (Schema)   │  │ (Collision)  │          │          │
│  │  └──────┬───────┘  └──────┬───────┘          │          │
│  │         │                  │                  │          │
│  │  ┌──────▼──────────────────▼───────┐         │          │
│  │  │      Game Loop (fixdt)          │         │          │
│  │  │  - Movement                     │         │          │
│  │  │  - Combat                       │         │          │
│  │  │  - Collision                    │         │          │
│  │  └─────────────────────────────────┘         │          │
│  └───────────────────────────────────────────────┘          │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │   Persistence   │                        │
│                   │ (Accounts/Stats)│                        │
│                   └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### Client Components

| Component | Responsibility | Communicates With | Boundaries |
|-----------|---------------|-------------------|------------|
| **UI Layer** | Menu, HUD, lobby, room codes, matchmaking UI | Client Manager | NEVER directly accesses game state. All game data via Client Manager. |
| **Game Scene** | Render game world, display sprites, animations, effects | Client Manager, Input System | NEVER modifies authoritative state. Only renders from received state. |
| **Input System** | Capture player input (keyboard, mouse), send to server | Colyseus Client | Captures input only. Does NOT apply input to local state (server-authoritative). |
| **Client Manager** | Handle state updates, interpolation, reconciliation | All client components, Colyseus Client | Bridge between Colyseus state and Phaser rendering. Manages prediction/interpolation. |
| **Colyseus Client** | WebSocket connection, room join/leave, message handling | Server | Only networking layer. Does NOT contain game logic. |

### Server Components

| Component | Responsibility | Communicates With | Boundaries |
|-----------|---------------|-------------------|------------|
| **Colyseus Core** | HTTP server, room creation/discovery, matchmaking | Game Rooms, Clients | Framework layer. Minimal custom logic here. |
| **Game Room** | Match lifecycle, player join/leave, game loop orchestration | Game State, Physics Engine, Persistence | One instance per active match. Isolated state. |
| **Game State (Schema)** | Authoritative game state, serialization | Game Room, Clients (via Colyseus) | Single source of truth. Uses `@colyseus/schema` for sync. |
| **Physics Engine** | Movement simulation, collision detection, projectile physics | Game State | Pure logic. No network code. Operates on state only. |
| **Game Loop** | Fixed timestep update (60Hz typical), apply input, run physics | All server game components | Runs continuously. Processes input queue, updates state, broadcasts. |
| **Persistence** | Account data, stats, unlocks | Game Room (on match end) | Async writes. Does NOT block game loop. |

## Data Flow

### Connection & Lobby Flow

```
1. Client loads → HTTP request to server
2. Server responds with available rooms or matchmaking status
3. Client displays UI (room code entry or matchmaking button)
4. User action → Client calls Colyseus joinOrCreate/joinById
5. Server creates/assigns Game Room → sends full state snapshot
6. Client receives state → initializes Phaser scene with entities
```

### Game Loop Flow (Authoritative Server)

```
CLIENT:
Input captured → Send to server immediately → Render last received state
  ↓
  (Optional: Client-side prediction for local player only)
  ↓
Receive state update → Interpolate entities → Render

SERVER (every tick, ~16ms for 60Hz):
1. Receive input messages from all clients
2. Queue inputs by player
3. Process input queue (movement, shooting, abilities)
4. Run physics simulation (collisions, projectiles)
5. Update game state (positions, health, scores)
6. Colyseus automatically broadcasts state changes to clients
7. Repeat
```

### Data Flow Diagram

```
[Player Input] → [Colyseus Client] → [WebSocket] → [Game Room]
                                                         ↓
                                            [Process Input Queue]
                                                         ↓
                                            [Update Physics]
                                                         ↓
                                            [Modify Game State]
                                                         ↓
                                    [Colyseus Schema Auto-Sync]
                                                         ↓
                      [WebSocket] → [Colyseus Client] → [Client Manager]
                                                         ↓
                                            [Interpolate Entities]
                                                         ↓
                                            [Render Phaser Scene]
```

### Critical Data Flows

#### Player Movement
```
Client: Keydown → InputSystem.onKeyDown()
  → colyseusRoom.send("input", {type: "move", direction: "up", timestamp})
Server: Room.onMessage("input") → inputQueue.push()
  → GameLoop: process inputQueue → Physics.applyAcceleration()
  → State.player.x += velocity * deltaTime
  → Colyseus broadcasts changed properties
Client: Room.onStateChange() → ClientManager.updatePlayer()
  → GameScene.updateSprite(player.x, player.y)
```

#### Shooting & Hit Detection
```
Client: Mouse click → InputSystem.onPointerDown()
  → colyseusRoom.send("shoot", {angle, timestamp})
Server: Room.onMessage("shoot") → validate cooldown/ammo
  → State.projectiles.push(new Projectile())
  → GameLoop: Physics.updateProjectiles()
  → Collision.checkProjectileHits() → apply damage
  → State.player.health -= damage
  → Colyseus broadcasts new projectile + health change
Client: Room.state.projectiles.onAdd() → GameScene.addProjectile()
  → Room.state.player.health.onChange() → GameScene.updateHealthBar()
```

#### Match Lifecycle
```
Lobby → Room.onCreate() → initialize empty state
Player joins → Room.onJoin() → add player to state
All players ready → Room.startMatch() → begin game loop
Win condition → Room.endMatch() → save stats → cleanup
Disconnect → Room.onLeave() → remove player or end match
```

## Patterns to Follow

### Pattern 1: Authoritative Server with Dumb Client

**What:** Server owns all game logic. Client only renders and sends input.

**When:** Always for competitive multiplayer. Prevents cheating.

**Why:** Single source of truth. All players see same results. No client-side hacks.

**Implementation:**
```typescript
// SERVER: Room.ts
class GameRoom extends Room {
  fixedTimeStep = 1000 / 60; // 60Hz

  onCreate() {
    this.setState(new GameState());
    this.setSimulationInterval(() => this.update(), this.fixedTimeStep);
  }

  onMessage(client, type, message) {
    // Validate and queue input
    if (type === "input") {
      this.inputQueue.push({ clientId: client.sessionId, ...message });
    }
  }

  update() {
    // Process ALL queued input
    this.processInputs();
    // Run authoritative physics
    this.physics.update(this.state, this.fixedTimeStep);
    // Detect collisions, apply damage
    this.collisions.check(this.state);
    // State automatically synced by Colyseus
  }
}

// CLIENT: GameScene.ts
class GameScene extends Phaser.Scene {
  create() {
    this.room.onMessage("*", (type, message) => {
      // Never modify game logic here
    });

    // Only capture input
    this.input.keyboard.on('keydown', (event) => {
      this.room.send("input", { key: event.key });
    });
  }

  update() {
    // Only render from state
    this.room.state.players.forEach(player => {
      this.playerSprites[player.id].setPosition(player.x, player.y);
    });
  }
}
```

### Pattern 2: Schema-Driven State Sync

**What:** Use `@colyseus/schema` for automatic state synchronization.

**When:** Always with Colyseus. Efficient binary protocol.

**Why:** Automatic change detection. Only syncs changed properties. Type-safe.

**Implementation:**
```typescript
// SERVER: GameState.ts
import { Schema, type, MapSchema } from "@colyseus/schema";

class Player extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") health: number;
  @type("string") team: string;
}

class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("number") matchTime: number;
}

// CLIENT: Automatic sync
room.state.players.onAdd = (player, sessionId) => {
  // Create sprite
  this.createPlayerSprite(sessionId, player);

  // Listen to individual property changes
  player.onChange = (changes) => {
    changes.forEach(change => {
      if (change.field === "health") {
        this.updateHealthBar(sessionId, change.value);
      }
    });
  };
};
```

### Pattern 3: Input Queue with Timestamp Validation

**What:** Queue inputs with timestamps, process in order, validate timing.

**When:** All player actions (movement, shooting, abilities).

**Why:** Handles network jitter, prevents out-of-order processing, detects speedhacks.

**Implementation:**
```typescript
// SERVER: InputProcessor.ts
class InputProcessor {
  private inputQueue: Array<{clientId: string, timestamp: number, input: any}> = [];

  queueInput(clientId: string, input: any) {
    const now = Date.now();

    // Timestamp validation (anti-cheat)
    if (Math.abs(input.timestamp - now) > 1000) {
      console.warn("Suspicious timestamp from", clientId);
      return; // Ignore suspicious input
    }

    this.inputQueue.push({ clientId, timestamp: input.timestamp, input });
  }

  processQueue(state: GameState) {
    // Sort by timestamp
    this.inputQueue.sort((a, b) => a.timestamp - b.timestamp);

    // Process in order
    this.inputQueue.forEach(({clientId, input}) => {
      const player = state.players.get(clientId);
      if (player) {
        this.applyInput(player, input);
      }
    });

    this.inputQueue = []; // Clear after processing
  }
}
```

### Pattern 4: Fixed Timestep Server Loop

**What:** Server game loop runs at fixed interval (e.g., 60Hz).

**When:** Always for deterministic physics.

**Why:** Consistent simulation. Same results regardless of CPU speed. Predictable behavior.

**Implementation:**
```typescript
// SERVER: Room.ts
class GameRoom extends Room {
  private accumulator = 0;
  private readonly fixedDelta = 1000 / 60; // 60Hz = 16.67ms

  onCreate() {
    this.setState(new GameState());

    // Colyseus provides simulation interval
    this.setSimulationInterval(() => {
      this.fixedUpdate(this.fixedDelta);
    }, this.fixedDelta);
  }

  fixedUpdate(deltaTime: number) {
    // Always consistent deltaTime
    this.physics.update(this.state, deltaTime / 1000); // Convert to seconds
  }
}
```

### Pattern 5: Entity Interpolation on Client

**What:** Smooth movement between server state updates using interpolation.

**When:** All networked entities except local player (if using prediction).

**Why:** Network updates arrive at 20-60Hz. Display is 60-144Hz. Interpolation fills gaps.

**Implementation:**
```typescript
// CLIENT: EntityInterpolator.ts
class EntityInterpolator {
  private previousState: {x: number, y: number};
  private targetState: {x: number, y: number};
  private lerpProgress = 0;

  onServerUpdate(newX: number, newY: number) {
    this.previousState = { ...this.targetState };
    this.targetState = { x: newX, y: newY };
    this.lerpProgress = 0;
  }

  update(deltaTime: number) {
    this.lerpProgress += deltaTime / 50; // Interpolate over 50ms (~3 frames)
    this.lerpProgress = Math.min(this.lerpProgress, 1);

    const interpolatedX = Phaser.Math.Linear(
      this.previousState.x,
      this.targetState.x,
      this.lerpProgress
    );
    const interpolatedY = Phaser.Math.Linear(
      this.previousState.y,
      this.targetState.y,
      this.lerpProgress
    );

    return { x: interpolatedX, y: interpolatedY };
  }
}
```

### Pattern 6: Room Code + Matchmaking Dual System

**What:** Support both private rooms (via code) and automatic matchmaking.

**When:** Casual multiplayer games with friend play.

**Why:** Players want to play with friends OR find random opponents.

**Implementation:**
```typescript
// SERVER: Server.ts
gameServer.define("game_room", GameRoom)
  .filterBy(["mode"]); // Separate matchmaking from private

// CLIENT: LobbyScene.ts
// Private room with code
async createPrivateRoom() {
  const room = await client.create("game_room", {
    mode: "private",
    roomCode: generateCode()
  });
  return room.roomId;
}

async joinPrivateRoom(code: string) {
  const rooms = await client.getAvailableRooms("game_room");
  const room = rooms.find(r => r.metadata.roomCode === code);
  if (room) {
    return await client.joinById(room.roomId);
  }
}

// Matchmaking
async joinMatchmaking() {
  return await client.joinOrCreate("game_room", {
    mode: "matchmaking"
  });
}
```

### Pattern 7: Component-Based Game State

**What:** Organize state into logical components (players, projectiles, map objects).

**When:** Always. Keeps state organized and serializable.

**Why:** Clear separation of concerns. Easy to sync specific parts. Scalable structure.

**Implementation:**
```typescript
// SERVER: GameState.ts
class Player extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") velocityX: number = 0;
  @type("number") velocityY: number = 0;
  @type("number") health: number = 100;
  @type("number") score: number = 0;
  @type("string") team: "red" | "blue";
}

class Projectile extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") angle: number;
  @type("number") speed: number;
  @type("string") ownerId: string;
}

class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Projectile]) projectiles = new ArraySchema<Projectile>();
  @type("string") currentMap: string;
  @type("number") matchTime: number = 0;
  @type("boolean") matchActive: boolean = false;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Game Logic

**What:** Implementing game rules, physics, or combat on client.

**Why bad:** Enables cheating. Clients can lie. Desync between players.

**Consequences:** Players see different results. Hacked clients dominate. Game breaks.

**Instead:** ALL logic on server. Client only renders and sends input. Server validates everything.

```typescript
// BAD: Client applies damage
onHit(projectile, player) {
  player.health -= projectile.damage; // Client modifies state
  this.room.send("hit", { playerId: player.id, damage: projectile.damage });
}

// GOOD: Client reports event, server validates and applies
onHit(projectile, player) {
  // Just report potential hit
  this.room.send("hit_detected", {
    projectileId: projectile.id,
    playerId: player.id
  });
  // Server will check collision and apply damage if valid
}
```

### Anti-Pattern 2: Synchronizing Too Much State

**What:** Syncing internal state, temporary values, or derived data.

**Why bad:** Wastes bandwidth. Slower updates. More complex state.

**Consequences:** Laggy gameplay. Higher server load. Harder debugging.

**Instead:** Only sync essential state. Derive everything else on client.

```typescript
// BAD: Syncing derived state
class Player extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") velocityX: number;
  @type("number") velocityY: number;
  @type("number") speed: number; // Derived from velocity - wasteful!
  @type("number") angle: number; // Can be calculated - wasteful!
}

// GOOD: Only essential state
class Player extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") velocityX: number;
  @type("number") velocityY: number;

  // Client calculates these
  // speed = Math.sqrt(vx² + vy²)
  // angle = Math.atan2(vy, vx)
}
```

### Anti-Pattern 3: Processing Input in onMessage Handler

**What:** Directly modifying state inside `Room.onMessage()`.

**Why bad:** Race conditions. Inconsistent update timing. Bypasses fixed timestep.

**Consequences:** Physics glitches. Unfair advantages (faster connections win). Unpredictable behavior.

**Instead:** Queue inputs in `onMessage`. Process queue in fixed update loop.

```typescript
// BAD: Immediate processing
onMessage(client, type, message) {
  if (type === "move") {
    const player = this.state.players.get(client.sessionId);
    player.velocityX = message.direction.x; // Processed immediately
    player.velocityY = message.direction.y;
  }
}

// GOOD: Queue for next tick
onMessage(client, type, message) {
  if (type === "move") {
    this.inputQueue.push({
      clientId: client.sessionId,
      type: "move",
      data: message
    });
  }
}

update() {
  // Process all inputs in fixed timestep
  this.processInputQueue();
  this.physics.update();
}
```

### Anti-Pattern 4: Blocking Operations in Game Loop

**What:** Database queries, file I/O, HTTP requests inside `update()`.

**Why bad:** Blocks game loop. Variable frame time. Stuttering.

**Consequences:** Entire match freezes during blocking operation. Unplayable lag spikes.

**Instead:** Async operations outside game loop. Save to database after match ends.

```typescript
// BAD: Blocking database write
update() {
  this.physics.update();

  if (this.state.matchEnded) {
    this.database.saveMatch(this.state); // BLOCKS ENTIRE LOOP
  }
}

// GOOD: Async after game loop
async onMatchEnd() {
  this.state.matchEnded = true;

  // Stop game loop first
  this.clearSimulationInterval();

  // Then save async (won't block new matches)
  await this.database.saveMatch(this.state);

  // Disconnect players
  this.disconnect();
}
```

### Anti-Pattern 5: Large State Snapshots

**What:** Sending entire state object on every change.

**Why bad:** Massive bandwidth usage. Slow updates. Poor scalability.

**Consequences:** Laggy with 10+ entities. Network congestion. Higher costs.

**Instead:** Use Colyseus Schema. Only changed properties are synced automatically.

```typescript
// BAD: Manual full state sync
update() {
  this.physics.update();

  // Sending entire state to all clients every frame
  this.broadcast("state_update", this.state); // Huge payload
}

// GOOD: Colyseus automatic delta sync
update() {
  this.physics.update();

  // Modify state directly - Colyseus only sends changes
  this.state.players.forEach(player => {
    player.x += player.velocityX; // Only x synced if changed
    player.y += player.velocityY; // Only y synced if changed
  });
  // Colyseus handles efficient sync automatically
}
```

### Anti-Pattern 6: Trusting Client Timestamps

**What:** Using client-provided timestamps without validation.

**Why bad:** Client can manipulate time. Speedhacks possible.

**Consequences:** Players can move faster, shoot faster, cheat cooldowns.

**Instead:** Validate timestamps. Use server time as source of truth.

```typescript
// BAD: Trusting client time
onMessage(client, type, message) {
  const player = this.state.players.get(client.sessionId);

  if (type === "shoot") {
    // Client says enough time passed - believing it
    if (message.timestamp - player.lastShot > 1000) {
      this.createProjectile(player);
      player.lastShot = message.timestamp; // Using client time
    }
  }
}

// GOOD: Server time validation
onMessage(client, type, message) {
  const now = Date.now(); // Server time
  const player = this.state.players.get(client.sessionId);

  if (type === "shoot") {
    // Validate client timestamp isn't too far off
    if (Math.abs(message.timestamp - now) > 1000) {
      console.warn("Time manipulation suspected", client.sessionId);
      return;
    }

    // Use server time for cooldown
    if (now - player.lastShot > 1000) {
      this.createProjectile(player);
      player.lastShot = now; // Server time
    }
  }
}
```

## Suggested Build Order

### Dependencies Between Components

```
1. Game State Schema
   ↓
2. Server Room (basic) + Colyseus Server
   ↓
3. Client Connection + UI (lobby, room codes)
   ↓
4. Input System (capture only)
   ↓
5. Server Game Loop + Input Processing
   ↓
6. Server Physics (movement)
   ↓
7. Client Rendering (Phaser scene, sprites)
   ↓
8. Server Combat (projectiles, damage)
   ↓
9. Server Collision Detection
   ↓
10. Client Interpolation (smooth movement)
   ↓
11. Match Lifecycle (win conditions, timers)
   ↓
12. Persistence (accounts, stats)
   ↓
13. Multiple Maps
   ↓
14. Matchmaking (if separate from room codes)
```

### Why This Order

**Phase 1-3: Foundation**
- Schema first: defines contract between client/server
- Basic room: proves Colyseus works
- UI/connection: players can join before gameplay works

**Phase 4-7: Core Loop**
- Input → Loop → Physics → Rendering
- Each builds on previous
- Results in playable movement (no combat yet)

**Phase 8-10: Combat**
- Projectiles built on physics
- Collision uses existing entities
- Interpolation makes combat smooth

**Phase 11-13: Features**
- Match lifecycle depends on combat working
- Persistence after matches work
- Maps after core gameplay solid

**Phase 14: Scaling**
- Matchmaking last (most complex, least essential for MVP)

### Critical Path

**Minimum playable game:**
1. Schema (Player, basic state)
2. Room + Server
3. Client connection + basic UI
4. Input capture
5. Server loop + input processing
6. Movement physics
7. Phaser rendering

**This gives:** Players can join and move around. No combat, no win conditions, but provably multiplayer.

**Next critical features:**
8. Projectiles
9. Collision/damage
10. Health/death

**This gives:** Full gameplay loop. Matches don't officially "end" but game is playable.

### Parallelizable Work

Once core loop works (phases 1-7), these can be built in parallel:

- **Map system**: Independent of combat
- **UI polish**: Separate from gameplay
- **Account system**: Backend separate from game server
- **Matchmaking**: Uses existing room system

### Risk Areas Requiring Research

**Phase 5 (Game Loop):** Tick rate tuning. May need performance testing to find optimal Hz.

**Phase 9 (Collision):** Collision detection algorithm choice. Broad-phase optimization may need research.

**Phase 10 (Interpolation):** Latency handling. May need lag compensation research for fairness.

**Phase 12 (Persistence):** Database choice and schema. Async patterns with Colyseus. Needs architecture decision.

## Scalability Considerations

| Concern | At 10 players (MVP) | At 1000+ concurrent | At 10,000+ concurrent |
|---------|---------------------|---------------------|----------------------|
| **Server Architecture** | Single Colyseus server | Horizontal scaling with Redis presence | Multi-region with load balancer |
| **Room Management** | All rooms on one server | Distribute rooms across servers | Room affinity, regional servers |
| **Database** | SQLite or simple PostgreSQL | PostgreSQL with connection pooling | Read replicas, caching layer (Redis) |
| **Physics** | 60Hz fixed timestep | Same (per-room isolated) | Same (rooms are independent) |
| **State Sync** | Colyseus binary protocol (efficient) | Same (minimal bandwidth per player) | CDN for assets, optimized schema |
| **Matchmaking** | Simple joinOrCreate | Queue-based with room balancing | Skill-based rating, regional pools |

### Colyseus Scaling Pattern

Colyseus supports horizontal scaling out of the box:

```typescript
// SERVER: Server.ts
import { Server, RedisPresence } from "@colyseus/core";

const gameServer = new Server({
  presence: new RedisPresence(), // Shared state across servers
});

// Multiple servers share Redis presence
// Players can connect to any server
// Matchmaking works across all servers
```

**Scaling trigger points:**
- **100 concurrent players:** Monitor CPU usage
- **500 concurrent players:** Consider second server + Redis presence
- **1000+ concurrent players:** Horizontal scaling essential
- **5000+ concurrent players:** Regional distribution, load balancer

**Room isolation benefits:**
- Each match (3 players) is independent
- One match lag doesn't affect others
- Easy to distribute across servers
- Linear scaling (more servers = more rooms)

## Key Architectural Decisions

### 1. Server Tick Rate: 60Hz
**Rationale:** Balance between responsiveness and server load. Industry standard for action games.
**Alternative:** 30Hz (lower load, more lag), 120Hz (higher responsiveness, much higher load)
**Recommendation:** Start at 60Hz. Profile and adjust if needed.

### 2. State Sync: Colyseus Schema (automatic)
**Rationale:** Efficient binary protocol. Automatic change detection. Type-safe.
**Alternative:** Manual JSON messages (flexible but verbose), MessagePack (fast but no auto-sync)
**Recommendation:** Use Schema. Only use manual messages for one-off events (match start, death).

### 3. Client Rendering: Interpolation only (no prediction)
**Rationale:** Simpler implementation. Acceptable latency for 1v2 game.
**Alternative:** Client-side prediction + reconciliation (lower perceived latency, complex)
**Recommendation:** Start with interpolation. Add prediction if playtesters report lag issues.

### 4. Collision Detection: AABB (Axis-Aligned Bounding Boxes)
**Rationale:** Fast, simple, sufficient for top-down shooter.
**Alternative:** SAT (Separating Axis Theorem) for rotated boxes, Circle collision for optimization
**Recommendation:** AABB for MVP. Optimize with spatial partitioning if >20 entities per room.

### 5. Persistence: Separate service from game server
**Rationale:** Game loop never blocks on database. Independent scaling.
**Alternative:** Direct database access in Room (simpler, blocks game loop)
**Recommendation:** Separate service. Game server sends match results to API. API writes to DB async.

### 6. Deployment: Docker containers
**Rationale:** Self-hosted requirement. Easy to scale horizontally.
**Alternative:** Bare metal (harder to manage), Kubernetes (overkill for initial scale)
**Recommendation:** Docker Compose for initial deploy. Kubernetes if scaling beyond 10 servers.

## Sources

**Note:** This architecture is based on established patterns for real-time multiplayer browser games and the standard approaches used with Phaser + Colyseus. Due to tool access limitations, I could not verify specifics with current official documentation or Context7.

**Confidence Level: MEDIUM**
- Patterns are industry-standard for this domain
- Colyseus architectural patterns are well-documented in official docs (though not accessed in this research)
- Phaser rendering patterns are stable and widely used
- Unable to verify 2026-specific updates or recent framework changes

**Recommended validation:**
- Verify current Colyseus best practices at https://docs.colyseus.io/
- Check Phaser 3 architecture guide at https://phaser.io/
- Review recent Colyseus + Phaser examples on GitHub
- Validate tick rate recommendations against current hardware benchmarks

**What this research provides:**
- Clear component boundaries for roadmap phase planning
- Data flow understanding for feature sequencing
- Build order with dependency mapping
- Risk areas flagged for phase-specific research

**What requires phase-specific research:**
- Exact collision algorithm choice (Phase: Combat)
- Database schema design (Phase: Persistence)
- Performance tuning tick rate (Phase: Core Loop)
- Lag compensation approach if needed (Phase: Polish)

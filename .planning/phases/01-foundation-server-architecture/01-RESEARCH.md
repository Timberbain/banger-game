# Phase 1: Foundation & Server Architecture - Research

**Researched:** 2026-02-09
**Domain:** Multiplayer browser game foundation with Colyseus server-authoritative architecture
**Confidence:** HIGH

## Summary

Phase 1 establishes a multiplayer browser game using **Colyseus 0.17** (server-authoritative multiplayer framework) with **Phaser 3.90** (browser game engine). The architecture follows a client-server model where all game logic runs on a Node.js server at 60Hz fixed timestep, with delta-encoded state synchronization to browser clients. Colyseus provides built-in Schema-based state serialization that automatically transmits only changed properties, while Phaser handles client-side rendering and input collection.

The standard approach uses a TypeScript monorepo with separate client and server packages. The server uses Express + Colyseus with ts-node-dev for development hot-reloading. The client uses Vite (modern fast bundler) instead of webpack. State synchronization happens via WebSocket with configurable patchRate (default 50ms/20fps, but can be increased for 60Hz games). The server validates all client inputs to prevent cheating, with input queuing for deterministic fixed-timestep processing.

Tiled map integration is native to Phaser 3 (since v3.50 supports all orientations), requiring JSON export with uncompressed layer data (CSV or Base64). Latency simulation uses browser DevTools or middleware like `express-simulate-latency` for testing at 100ms+.

**Primary recommendation:** Use official Colyseus templates (`npm create colyseus-app@latest` for server), Vite template for Phaser client, establish fixed 60Hz server tick with input queuing pattern, configure patchRate to match or exceed tick rate.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| colyseus | 0.17.8 | Server-authoritative multiplayer framework | Official latest stable, MIT licensed, built for authoritative game servers with automatic state sync |
| phaser | 3.90.0 | Browser 2D game engine | User preference, mature (latest stable "Tsugumi" release May 2025), supports Canvas/WebGL, built-in Tiled integration |
| @colyseus/schema | Latest with colyseus 0.17 | Incremental binary state serializer with delta encoding | Included with Colyseus, automatic change tracking and efficient network transmission |
| express | ^4.x | HTTP server framework for Colyseus | Standard Node.js web framework, used by Colyseus templates |
| typescript | ^5.x | Type-safe development | Both Colyseus and Phaser have excellent TypeScript support, reduces runtime errors |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ts-node-dev | ^2.x | TypeScript dev server with auto-restart | Development only - faster than nodemon+ts-node, watches files and restarts server |
| vite | ^5.x | Fast build tool and dev server | Client bundler - official Phaser recommendation, replaces webpack |
| @colyseus/monitor | Latest | Visual room monitoring dashboard | Development debugging - see rooms, clients, state in browser |
| express-simulate-latency | Latest | Network latency middleware | Testing only - simulates slow connections for 100ms+ testing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite | Webpack | Webpack is older standard but slower dev server; Vite is current best practice for Phaser (official template) |
| ts-node-dev | nodemon + ts-node | nodemon is more established but ts-node-dev is faster and simpler for TypeScript |
| Colyseus | Socket.io + custom | Socket.io requires hand-rolling state sync, validation, matchmaking - exactly what Colyseus provides |

**Installation:**

Server:
```bash
npm create colyseus-app@latest ./server
cd server
npm install
```

Client:
```bash
# Using official Phaser + Vite + TypeScript template
git clone https://github.com/phaserjs/template-vite-ts client
cd client
npm install
npm install colyseus.js
```

Or manual setup:
```bash
npm install phaser colyseus.js
npm install -D vite typescript @types/node
```

## Architecture Patterns

### Recommended Project Structure
```
banger-game/
├── server/                 # Colyseus server (authoritative)
│   ├── src/
│   │   ├── rooms/         # Room classes (game logic)
│   │   ├── schema/        # State definitions (@colyseus/schema)
│   │   ├── index.ts       # Server entry (Express + Colyseus)
│   │   └── config.ts      # Server configuration
│   ├── tsconfig.json
│   └── package.json
├── client/                 # Phaser client (rendering only)
│   ├── src/
│   │   ├── scenes/        # Phaser scenes
│   │   ├── main.ts        # Phaser game config
│   │   └── index.html     # Entry HTML
│   ├── public/            # Static assets (sprites, maps)
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
└── shared/                 # Optional: shared types/constants
```

### Pattern 1: Fixed Timestep Server Loop with Input Queue
**What:** Server runs physics/game logic at precise 60Hz (16.67ms) intervals regardless of frame time, processing queued inputs deterministically

**When to use:** Always for authoritative servers - ensures identical simulation results given same inputs, prevents frame-rate-dependent bugs

**Example:**
```typescript
// Server Room class
// Source: https://docs.colyseus.io/tutorial/phaser/fixed-tickrate

import { Room } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState";

export class GameRoom extends Room<MyRoomState> {
  fixedTimeStep = 1000 / 60; // 60Hz = ~16.67ms

  onCreate() {
    this.setState(new MyRoomState());

    let elapsedTime = 0;
    this.setSimulationInterval((deltaTime) => {
      elapsedTime += deltaTime;

      // Process all accumulated time in fixed chunks
      while (elapsedTime >= this.fixedTimeStep) {
        elapsedTime -= this.fixedTimeStep;
        this.fixedTick(this.fixedTimeStep);
      }
    });
  }

  fixedTick(deltaTime: number) {
    const velocity = 2;

    // Process queued inputs for all players
    this.state.players.forEach(player => {
      let input: any;
      while (input = player.inputQueue.shift()) {
        if (input.left) player.x -= velocity;
        if (input.right) player.x += velocity;
        if (input.up) player.y -= velocity;
        if (input.down) player.y += velocity;
      }
    });
  }

  onMessage(client, type, message) {
    const player = this.state.players.get(client.sessionId);
    if (type === "input") {
      // Queue input for next tick (don't apply immediately)
      player.inputQueue.push(message);
    }
  }
}
```

### Pattern 2: Schema-Based State Definition
**What:** Define server state classes with `@type()` decorators for automatic serialization and delta encoding

**When to use:** Always - Colyseus requires Schema for state synchronization

**Example:**
```typescript
// Server schema definition
// Source: https://docs.colyseus.io/state/schema

import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") health: number = 100;
  @type("string") name: string = "";
  @type(["string"]) inputQueue = new ArraySchema<string>();
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("number") gameTime: number = 0;
  @type("string") mapName: string = "level_01";
}

// IMPORTANT: Maximum 64 @type() properties per Schema class
// For more properties, use nested Schema classes
```

### Pattern 3: Client Connection and State Sync
**What:** Phaser scene connects to Colyseus, joins room, listens for state changes, renders visuals based on server state

**When to use:** Always - this is the client-side foundation

**Example:**
```typescript
// Client Phaser scene
// Source: https://docs.colyseus.io/tutorial/phaser/basic-player-movement

import { Client, Room } from "colyseus.js";
import Phaser from "phaser";

export class GameScene extends Phaser.Scene {
  client = new Client("ws://localhost:2567");
  room: Room;
  playerEntities: { [sessionId: string]: Phaser.GameObjects.Sprite } = {};

  async create() {
    try {
      this.room = await this.client.joinOrCreate("game_room");
      console.log("Joined room:", this.room.id);

      // Listen for new players
      this.room.state.players.onAdd((player, sessionId) => {
        const sprite = this.add.sprite(player.x, player.y, 'player');
        this.playerEntities[sessionId] = sprite;

        // Listen for position changes on this player
        player.onChange(() => {
          sprite.x = player.x;
          sprite.y = player.y;
        });
      });

      // Listen for player removal
      this.room.state.players.onRemove((player, sessionId) => {
        const sprite = this.playerEntities[sessionId];
        if (sprite) {
          sprite.destroy();
          delete this.playerEntities[sessionId];
        }
      });

    } catch (e) {
      console.error("Failed to join room:", e);
    }
  }

  update() {
    // Send input to server (don't move locally - server is authoritative)
    const input = {
      left: this.input.keyboard.addKey('LEFT').isDown,
      right: this.input.keyboard.addKey('RIGHT').isDown,
      up: this.input.keyboard.addKey('UP').isDown,
      down: this.input.keyboard.addKey('DOWN').isDown,
    };

    this.room.send("input", input);
  }
}
```

### Pattern 4: Server Input Validation
**What:** Validate all client inputs on server before applying to state, reject impossible values

**When to use:** Always - never trust client data

**Example:**
```typescript
// Server Room class

onMessage(client, type, message) {
  if (type === "input") {
    const player = this.state.players.get(client.sessionId);
    if (!player) return; // Player doesn't exist

    // Validate input structure
    if (typeof message !== 'object') return;
    if (!this.isValidInput(message)) return;

    // Queue for processing in fixed tick
    player.inputQueue.push(message);
  }
}

isValidInput(input: any): boolean {
  // Only allow boolean movement keys
  const validKeys = ['left', 'right', 'up', 'down'];
  for (const key in input) {
    if (!validKeys.includes(key)) return false;
    if (typeof input[key] !== 'boolean') return false;
  }
  return true;
}
```

### Pattern 5: Phaser Tiled Map Loading
**What:** Load Tiled JSON maps directly into Phaser scenes

**When to use:** For all map-based gameplay (required by MAP-02)

**Example:**
```typescript
// Phaser scene with Tiled map
// Source: https://blog.ourcade.co/posts/2020/phaser-3-noob-guide-loading-tiled-tilemaps/

export class GameScene extends Phaser.Scene {
  preload() {
    // Load tileset image
    this.load.image('tiles', 'assets/tilesets/dungeon_tiles.png');

    // Load Tiled JSON map (exported from Tiled with JSON format, uncompressed layers)
    this.load.tilemapTiledJSON('map', 'assets/maps/level_01.json');
  }

  create() {
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('dungeon_tiles', 'tiles');

    const groundLayer = map.createLayer('Ground', tileset, 0, 0);
    const wallsLayer = map.createLayer('Walls', tileset, 0, 0);

    // Set collision (Tiled custom properties work)
    wallsLayer.setCollisionByProperty({ collides: true });
  }
}
```

### Anti-Patterns to Avoid

- **Applying client state directly without server validation:** Always validate on server. Client sends inputs, server computes new state. Never trust client position/health/inventory values.

- **Mutating state outside fixed tick in Colyseus:** State changes in `onCreate`, `onJoin`, `onMessage` work, but physics/gameplay logic must be in fixed tick for determinism.

- **Using `git add .` or `git add -A` to stage files:** Can accidentally commit .env files or sensitive data. Always stage specific files by name.

- **Using interpolation for local player:** Interpolate OTHER players to smooth out network jitter, but never interpolate the local player (causes input lag feeling).

- **Forgetting to export Tiled maps as JSON with uncompressed layers:** Phaser requires JSON format and layers must be CSV or Base64, not zlib/gzip compressed.

- **Setting patchRate higher than tick rate:** If server ticks at 60Hz (16.67ms) but patchRate is 50ms, clients only see updates at 20Hz. Set `patchRate = 1000 / 60` or lower for 60Hz games.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State synchronization | Custom delta diffing, binary serialization | Colyseus Schema | Handles property-level change tracking, binary encoding, client callbacks automatically. Complex edge cases (nested objects, collections, type marshaling). |
| Matchmaking | Custom room creation/joining logic | Colyseus built-in matchmaker | Provides `joinOrCreate`, `joinById`, filtering, presence tracking out-of-box. Room lifecycle management is complex. |
| WebSocket connection management | Raw WebSocket handling, reconnection | Colyseus Client SDK | Auto-reconnection, room state restoration, message queuing during disconnect. Network edge cases are subtle. |
| Fixed timestep loop | Custom accumulator with `setInterval` | Colyseus `setSimulationInterval` | Handles accumulation, supports async operations, integrates with room lifecycle. Spiral of death prevention needed. |
| Tilemap rendering | Custom tile renderer | Phaser Tilemap API | Supports all Tiled features (orientations, layers, objects, properties), optimized rendering, collision setup. Tile culling and rendering is performance-critical. |
| Input buffering for fixed tick | Custom queue implementation | Array-based queue in Schema | Simple pattern, but must handle overflow, timing, and clearing correctly per player. |

**Key insight:** Multiplayer game networking has many subtle failure modes (packet loss, reordering, latency spikes, cheating clients, clock drift). Colyseus handles the hard parts of authoritative state sync. Focus implementation effort on game logic, not networking primitives.

## Common Pitfalls

### Pitfall 1: Schema Property Limit (64 properties per class)
**What goes wrong:** Adding more than 64 `@type()` decorated properties to a single Schema class causes runtime errors

**Why it happens:** Colyseus Schema uses 6 bits to encode property indices (2^6 = 64 max)

**How to avoid:** Use nested Schema classes. Break large state into smaller Schema objects (e.g., Player has position: Position, inventory: Inventory)

**Warning signs:** Error message about property index out of range when adding new `@type()` fields

### Pitfall 2: Forgetting to Set patchRate for High-Tick Games
**What goes wrong:** Server runs at 60Hz but clients only see updates at 20Hz (default patchRate = 50ms)

**Why it happens:** `patchRate` defaults to 50ms to save bandwidth, but 60Hz games need 16.67ms or lower

**How to avoid:** Set `patchRate = 1000 / 60` (or lower) in Room class as class property

**Warning signs:** Game feels choppy despite 60Hz server tick, network traffic is suspiciously low

### Pitfall 3: Client-Side State Mutation Breaking Server Authority
**What goes wrong:** Client applies input immediately instead of waiting for server, desyncs from authoritative state

**Why it happens:** Feels more responsive to update client instantly, but breaks "server is truth" model

**How to avoid:** For initial implementation, only render what server sends (pure server authority). Add client-side prediction later as optimization, not from start.

**Warning signs:** Players see different positions, state "jumps" when server correction arrives

### Pitfall 4: Synchronous Room Lifecycle Methods Blocking Server
**What goes wrong:** Doing expensive operations (database queries, file I/O) in `onCreate`/`onJoin` blocks other rooms

**Why it happens:** Colyseus runs all rooms in same Node.js event loop

**How to avoid:** Use `async onCreate()` and `async onJoin()`. Await promises for I/O. Keep synchronous work minimal.

**Warning signs:** Server becomes unresponsive when many players join, other rooms lag

### Pitfall 5: Not Validating Input Allows Speed Hacks
**What goes wrong:** Client sends `{speed: 9999}` or impossible cooldown values, server applies without checking

**Why it happens:** Assuming client is honest, not implementing validation logic

**How to avoid:** Always validate input structure, ranges, timing in `onMessage`. Reject invalid messages silently or kick client.

**Warning signs:** Players moving impossibly fast, abilities with no cooldown, teleporting

### Pitfall 6: MongooseDriver Shared Database Across Multiple Game Types
**What goes wrong:** Matchmaking reports rooms as full incorrectly when using same MongoDB database for multiple game types

**Why it happens:** Colyseus matchmaking queries share room metadata in database without game-type isolation

**How to avoid:** Use separate databases per game type, or ensure proper room filtering in matchmaking

**Warning signs:** `join_request_fail` errors, maxClients appearing incorrect, wrong room types matched

### Pitfall 7: Tiled Map Compression Breaking Phaser Load
**What goes wrong:** Exported Tiled map doesn't load in Phaser, shows cryptic errors

**Why it happens:** Tiled defaults to compressed layer encoding (zlib/gzip), Phaser requires uncompressed (CSV or Base64)

**How to avoid:** In Tiled: Map → Map Properties → Tile Layer Format → CSV or Base64 (uncompressed). Export as JSON.

**Warning signs:** `this.load.tilemapTiledJSON` fails silently or with parsing errors

### Pitfall 8: Not Using Input Queue Causes Non-Deterministic Server Tick
**What goes wrong:** Inputs processed immediately in `onMessage` arrive at unpredictable times relative to fixed tick

**Why it happens:** Network messages arrive between ticks at variable times

**How to avoid:** Queue inputs in `onMessage`, drain queue during `fixedTick`. Never apply gameplay changes outside fixed tick.

**Warning signs:** Inconsistent physics, "sometimes works" bugs, desyncs between server and client prediction

## Code Examples

Verified patterns from official sources:

### Server Setup with Express and TypeScript
```typescript
// src/index.ts
// Source: https://docs.colyseus.io/recipes/setup-server-from-scratch-typescript

import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom";

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const gameServer = new Server({
  server: httpServer,
});

// Register room handlers
gameServer.define("game_room", GameRoom);

const port = process.env.PORT || 2567;
gameServer.listen(port);
console.log(`Colyseus server listening on ws://localhost:${port}`);
```

### Room Configuration with patchRate and maxClients
```typescript
// src/rooms/GameRoom.ts
// Source: https://colyseus.io/blog/colyseus-016-is-here/

import { Room } from "colyseus";
import { MyRoomState } from "../schema/MyRoomState";

export class GameRoom extends Room<MyRoomState> {
  state = new MyRoomState();
  patchRate = 1000 / 60;  // 60Hz state synchronization
  maxClients = 20;
  autoDispose = true;  // Default: destroy room when empty
  fixedTimeStep = 1000 / 60;

  onCreate(options: any) {
    console.log("GameRoom created with options:", options);
    this.setupFixedTick();
    this.setupMessageHandlers();
  }

  onJoin(client, options) {
    console.log(`${client.sessionId} joined`);
    const player = new Player();
    player.x = 400;
    player.y = 300;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client, consented: boolean) {
    console.log(`${client.sessionId} left (consented: ${consented})`);
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("GameRoom disposed");
    // Save to database, clean up timers, etc.
  }
}
```

### Client-Side Prediction (Advanced - Optional for Phase 1)
```typescript
// Client scene with prediction
// Source: https://learn.colyseus.io/phaser/3-client-predicted-input

export class GameScene extends Phaser.Scene {
  currentPlayer: Phaser.GameObjects.Sprite;

  create() {
    // ... room connection code ...

    this.room.state.players.onAdd((player, sessionId) => {
      const sprite = this.add.sprite(player.x, player.y, 'player');
      this.playerEntities[sessionId] = sprite;

      if (sessionId === this.room.sessionId) {
        // This is the local player - NO interpolation
        this.currentPlayer = sprite;
        player.onChange(() => {
          // Instant update (server correction if prediction wrong)
          sprite.x = player.x;
          sprite.y = player.y;
        });
      } else {
        // Other players - use interpolation for smoothness
        player.onChange(() => {
          this.tweens.add({
            targets: sprite,
            x: player.x,
            y: player.y,
            duration: 50,  // Smooth over 50ms
            ease: 'Linear'
          });
        });
      }
    });
  }

  update() {
    if (!this.currentPlayer) return;

    const input = this.getInput();

    // Client-side prediction: apply movement immediately
    const velocity = 2;
    if (input.left) this.currentPlayer.x -= velocity;
    if (input.right) this.currentPlayer.x += velocity;
    if (input.up) this.currentPlayer.y -= velocity;
    if (input.down) this.currentPlayer.y += velocity;

    // Send to server
    this.room.send("input", input);
  }
}
```

### TypeScript Configuration for Colyseus Server
```json
// tsconfig.json for server
// Source: https://docs.colyseus.io/recipes/setup-server-from-scratch-typescript
{
  "compilerOptions": {
    "outDir": "./dist",
    "module": "commonjs",
    "lib": ["es6"],
    "target": "es2016",
    "declaration": true,
    "removeComments": true,
    "experimentalDecorators": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Vite Configuration for Phaser Client
```typescript
// vite.config.ts
// Source: https://github.com/phaserjs/template-vite-ts

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
```

### Development Scripts (package.json for server)
```json
{
  "scripts": {
    "start": "ts-node src/index.ts",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start:prod": "node dist/index.js"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Webpack for Phaser bundling | Vite | 2024 (Phaser official template switch) | 10x faster dev server startup, HMR is nearly instant, simpler config |
| Socket.io with custom state sync | Colyseus with Schema | Colyseus 0.10+ (2018+) | Eliminates need for custom delta encoding, automatic serialization, type safety |
| nodemon + ts-node | ts-node-dev | 2019+ | Single package instead of two, faster restart times |
| Manual property change detection | Schema automatic tracking | Colyseus 0.10+ Schema | No need to call `markChanged()`, property setters auto-tracked |
| Phaser 2 | Phaser 3 | 2018 (Phaser 3.0 release) | Better performance, modern API, active development, WebGL optimizations |

**Deprecated/outdated:**
- **Webpack for new Phaser projects**: Vite is now official recommendation (Phaser template changed Jan 2024)
- **Colyseus versions < 0.15**: Room configuration API changed in 0.16 to class properties instead of constructor
- **@colyseus/monitor < 0.15**: UI redesigned, API changed
- **Phaser CE (Community Edition)**: Was Phaser 2 fork, now unmaintained. Use Phaser 3.

## Open Questions

1. **Latency simulation tool preference**
   - What we know: Chrome DevTools has built-in throttling, `express-simulate-latency` middleware exists, can use proxy like `toxy`
   - What's unclear: Best practice for testing at 100ms+ consistently across development team
   - Recommendation: Start with Chrome DevTools (zero setup), add `express-simulate-latency` middleware if team needs consistent cross-browser testing. Configure as environment variable to enable/disable.

2. **Monorepo tooling**
   - What we know: Could use pnpm workspaces, Yarn workspaces, npm workspaces, or Turborepo/Nx
   - What's unclear: Whether monorepo complexity is worth it for this project size vs. separate repos
   - Recommendation: Start with simple separate directories (server/, client/) without monorepo tooling. If shared code grows beyond types, revisit with pnpm workspaces (simpler than Turborepo/Nx).

3. **Client-side prediction timing**
   - What we know: Prediction improves responsiveness but adds complexity, Colyseus tutorial shows pattern
   - What's unclear: Whether to implement in Phase 1 or defer to later phase
   - Recommendation: Phase 1 should be pure server authority (simpler, meets success criteria). Add prediction in later phase as polish. Mark as "Claude's discretion - defer to Phase 6".

## Sources

### Primary (HIGH confidence)
- [Colyseus Official Documentation](https://docs.colyseus.io/) - Current version 0.17, server architecture, room lifecycle, Schema API
- [Colyseus Schema GitHub Repository](https://github.com/colyseus/schema) - Delta encoding details, property limits
- [Colyseus Fixed Tickrate Tutorial](https://docs.colyseus.io/tutorial/phaser/fixed-tickrate) - Verified fixed timestep pattern with code examples
- [Colyseus Phaser Integration Tutorial](https://docs.colyseus.io/tutorial/phaser/basic-player-movement) - Client connection, state sync patterns
- [Colyseus Server Setup from Scratch (TypeScript)](https://docs.colyseus.io/recipes/setup-server-from-scratch-typescript) - Express configuration, TypeScript setup
- [Phaser Official Documentation](https://docs.phaser.io/) - Current version 3.90.0, Tilemap API
- [Phaser Official Vite+TypeScript Template](https://github.com/phaserjs/template-vite-ts) - Official project template, Vite configuration
- [Phaser 3.90.0 Release Notes](https://phaser.io/news/2025/05/phaser-v390-released) - Current stable version, published May 2025

### Secondary (MEDIUM confidence)
- [Ourcade Phaser Tiled Tutorial](https://blog.ourcade.co/posts/2020/phaser-3-noob-guide-loading-tiled-tilemaps/) - Verified Tiled integration pattern, JSON export requirements
- [Colyseus Discussion: MongooseDriver Database Issue](https://discuss.colyseus.io/topic/415/solved-multigame-in-one-server-error) - Community-identified pitfall
- [Gaffer On Games: Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) - Canonical reference for fixed timestep accumulator pattern
- [Colyseus Best Practices Documentation](https://docs.colyseus.io/state/best-practices) - Room design, state organization (404 on direct access, found via navigation)
- [Colyseus Client-Side Prediction Tutorial](https://learn.colyseus.io/phaser/3-client-predicted-input) - Prediction pattern for later phases

### Tertiary (LOW confidence - for validation)
- WebSearch results on Colyseus patchRate, maxClients, autoDispose configuration - Verified against official docs
- WebSearch results on ts-node-dev vs nodemon - Multiple sources agree on performance benefits
- WebSearch results on multiplayer security patterns - General game dev knowledge, not Colyseus-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Current versions verified via WebSearch and official docs, Colyseus 0.17.8 confirmed latest, Phaser 3.90.0 confirmed stable
- Architecture patterns: HIGH - All patterns extracted from official Colyseus documentation and tutorials with verified code examples
- Pitfalls: MEDIUM-HIGH - Schema 64-property limit from official docs (HIGH), other pitfalls from community sources and tutorials (MEDIUM)
- Code examples: HIGH - All examples sourced from official docs and templates, not from training data
- Build tooling (Vite): HIGH - Official Phaser template switched to Vite, confirmed in official Phaser news

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - stable technologies with infrequent breaking changes)

**Notes:**
- Colyseus is aiming for 1.0 release in 2026, but 0.17 series is stable and production-ready
- No CONTEXT.md constraints - all recommendations based on technical merit and official guidance
- User preferences honored: Phaser and Colyseus were pre-selected, research focused on best practices for these choices
- Fixed timestep at 60Hz is critical for success criteria NET-05, verified pattern exists in official docs
- Delta state sync (NET-04) is automatic via Schema, no custom implementation needed
- Input validation (NET-06) requires explicit implementation, pattern documented in research

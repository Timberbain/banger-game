# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Banger is an asymmetric 1v2 multiplayer arena shooter built with server-authoritative architecture. One Paran (melee/speed) fights two Guardians (Faran + Baran, ranged). Solarpunk pixel art aesthetic.

## Project Structure

```
banger-game/
├── server/                    # Colyseus game server (port 2567)
│   └── src/
│       ├── index.ts           # Express + Colyseus server bootstrap
│       ├── config.ts          # Server tick rate, game constants
│       ├── rooms/             # Colyseus room handlers
│       │   ├── GameRoom.ts    # Main match (60Hz authoritative loop)
│       │   ├── LobbyRoom.ts   # Pre-match role selection + ready system
│       │   ├── MatchmakingRoom.ts  # Public queue matchmaking
│       │   └── MatchmakingQueue.ts # Queue data structure
│       ├── schema/            # Colyseus Schema state definitions
│       │   ├── GameState.ts   # Players, projectiles, obstacles, match meta
│       │   ├── LobbyState.ts  # Player list, room code, countdown
│       │   ├── Projectile.ts  # Position, velocity, damage
│       │   └── Obstacle.ts    # Tile position, HP, destroyed flag
│       └── utils/
│           └── roomCode.ts    # Private room code generation
├── client/                    # Phaser 3 game client (port 8080)
│   ├── src/
│   │   ├── main.ts            # Phaser game config + scene registration
│   │   ├── scenes/            # Phaser scenes (lifecycle: create/update)
│   │   │   ├── BootScene.ts   # Asset loading, animations, title screen
│   │   │   ├── LobbyScene.ts  # Character selection, room joining
│   │   │   ├── GameScene.ts   # Main game loop, server sync, rendering
│   │   │   ├── HUDScene.ts    # Overlay: health, cooldown, timer, kill feed
│   │   │   ├── VictoryScene.ts    # Match results overlay
│   │   │   ├── StageIntroScene.ts # Stage transition iris wipe
│   │   │   └── HelpScene.ts   # Keybind reference overlay
│   │   ├── systems/           # Reusable game systems
│   │   │   ├── Prediction.ts  # Client-side physics prediction
│   │   │   ├── Interpolation.ts   # Remote player smoothing
│   │   │   ├── AudioManager.ts    # Cross-scene audio singleton (jsfxr)
│   │   │   └── ParticleFactory.ts # Visual effects (hit, death, trails)
│   │   ├── config/
│   │   │   └── SoundDefs.ts   # jsfxr sound effect definitions
│   │   ├── ui/
│   │   │   └── designTokens.ts    # UI colors, fonts, spacing constants
│   │   └── types/
│   │       └── jsfxr.d.ts     # Type declarations for jsfxr library
│   ├── public/                # Static assets served by Vite
│   │   ├── maps/              # Tiled JSON arena maps
│   │   ├── sprites/           # Character + projectile spritesheets
│   │   ├── tilesets/          # Arena tileset images
│   │   ├── audio/             # Music files
│   │   └── images/            # Splash screens, backgrounds
│   └── vite.config.ts         # Vite config (port 8080, @ alias, Phaser chunk)
├── shared/                    # Pure TypeScript shared by server + client
│   ├── physics.ts             # Movement, acceleration, network constants
│   ├── characters.ts          # Character stats (Paran, Faran, Baran)
│   ├── maps.ts                # Arena definitions + spawn points
│   ├── collisionGrid.ts       # AABB tile collision resolution
│   ├── obstacles.ts           # Destructible obstacle definitions (tiers)
│   └── lobby.ts               # Lobby constants (max players, countdown)
├── assets/                    # Source art assets (not served directly)
│   ├── sprites/               # Source character sprites
│   ├── tilesets/              # Source tileset images + wall variants
│   ├── icons/                 # UI icon sprites
│   ├── images/                # Source splash/background art
│   ├── fonts/                 # Engebrechtre font family
│   └── soundtrack/            # Lobby + stage music tracks
├── scripts/                   # Asset generation scripts
│   ├── generate-assets.py     # PIL-based sprite/tileset generator
│   └── generate-arenas.py     # Tiled-format arena map generator
├── docs/                      # Project documentation
│   ├── GAME_DESIGN.md         # Game design document
│   ├── design-system.md       # Visual design system (solarpunk)
│   ├── claude-learnings.md    # Claude's codebase learnings
│   └── improvements.md        # Application improvement backlog
└── .planning/                 # Phase plans, debug notes, research (gitignored patterns)
```

## Development Commands

### Server (port 2567)

```bash
cd server && npm run dev      # ts-node-dev with auto-restart
cd server && npm run build    # TypeScript compilation to dist/
cd server && npm run start    # Run compiled server
```

### Client (port 8080)

```bash
cd client && npm run dev      # Vite dev server with HMR
cd client && npm run build    # Production build
cd client && npm run preview  # Preview production build
```

Both server and client must be running simultaneously for development. No test or lint commands exist.

### Environment Variables

- `PORT` — Server port (default 2567)
- `SIMULATE_LATENCY` — Add artificial latency in ms for network testing

## Architecture

### Stack

- **Server:** Node.js + Express 4 + Colyseus 0.15.57 + TypeScript 5
  - `ts-node-dev` for dev hot-reload, `tsc` for production build
  - `@colyseus/monitor` for dev room inspection at `/colyseus`
  - `@colyseus/schema` for binary state synchronization
  - `cors` for cross-origin dev access
- **Client:** Phaser 3.90 + Vite 5 + TypeScript 5
  - `colyseus.js@0.15.28` for WebSocket client SDK
  - `jsfxr` for procedural sound effect generation
  - 1280x720 viewport, pixel art rendering (pixelArt + roundPixels)
  - Phaser.Scale.FIT with auto-center for responsive display
- **Shared:** Pure TypeScript modules in `/shared/` (no framework deps)
  - Imported by server via tsconfig paths, by client via relative imports
- **Asset Pipeline:** Python scripts (`PIL`) for sprite/tileset generation, Tiled JSON for arena maps
- **No test framework or linter configured** — validation is manual UAT

### Colyseus Version Pinning (Critical)

Server uses `colyseus@0.15.57`, client uses `colyseus.js@0.15.28`. These versions MUST stay compatible — 0.16.x+ client has incompatible WebSocket protocol, 0.17.x server has missing peer deps.

### Server Rooms (`server/src/rooms/`)

- **GameRoom** — Main match: 60Hz fixed timestep, server-authoritative physics, collision, projectile management, match state machine (WAITING → PLAYING → ENDED)
- **LobbyRoom** — Pre-match: role selection (1 paran + 1 faran + 1 baran), ready system, 3s countdown, private room codes
- **MatchmakingRoom** — Public queue: 1s match check interval, routes to lobby on match found

### Client Scenes (`client/src/scenes/`)

- **BootScene** — Asset loading, animation setup, audio init, title screen
- **LobbyScene** — Character selection, room joining, reconnection check
- **GameScene** — Main game loop, server sync, client prediction, rendering
- **HUDScene** — Overlay (scene.launch, not scene.start): health bars, cooldown, timer, kill feed, ping
- **VictoryScene** — Overlay on GameScene with match stats
- **HelpScene** — Keybind reference overlay

### Client Systems (`client/src/systems/`)

- **Prediction** — Client-side physics prediction with collision grid, sequence number tracking
- **Interpolation** — Remote player smoothing at 100ms delay behind server
- **AudioManager** — Cross-scene singleton via game registry, jsfxr-generated SFX
- **ParticleFactory** — Hit flash, speed lines, wall impact, death explosion, projectile trails

### Shared Code (`/shared/`)

Physics, characters, maps, collision grid, obstacle definitions, and lobby config. Both client and server import from here. Server tsconfig includes `../shared/**/*`; client uses Vite alias `@` → `./src` but imports shared via relative paths.

### Schema Definitions (`server/src/schema/`)

- **GameState** — Players (MapSchema), projectiles (MapSchema), obstacles (MapSchema), match metadata
- **LobbyState** — Player list, room code, private flag, countdown
- **Projectile** — Position, velocity, ownerId, damage, spawnTime
- **Obstacle** — Tile position, HP, destroyed flag

## Key Technical Constraints

### Physics

- Fixed timestep `1/60s` must be used everywhere (not deltaTime) for deterministic client prediction
- Input must be sent EVERY FRAME for acceleration physics (not just on key change)
- Paran: cardinal-only movement (last-key-wins), loses ALL velocity on wall/obstacle hit
- Guardians: 8-directional, instant stop on release

### Networking

- Server no-input fallback: maintain velocity + integrate position (do NOT call physics with noInput — that triggers instant stop and causes jitter)
- Use `matchMaker.createRoom` for GameRoom transition (NOT `create` — that reserves a phantom seat)
- Role assignment: GameRoom reads `options.role` from client (session IDs change between rooms)
- Use `matchEnd` broadcast for stats (not Schema listener — avoids stale data)

### Phaser Scene Reuse

Scenes are reused via `scene.start()` which skips the constructor. All member variables must be reset in `create()`.

### Collision System

`CollisionGrid` in `/shared/collisionGrid.ts` provides pure AABB-vs-tile resolution. Server loads Tiled JSON maps and resolves collisions after every physics call. Client runs identical collision for prediction.

### Match Flow

LobbyScene → (role select + ready) → GameRoom created → GameScene + HUD overlay → VictoryScene overlay → back to LobbyScene

### Reconnection

- Server: `allowReconnection(client, 60)` with 60s grace period
- Client: localStorage token, `checkReconnection()` on LobbyScene create, 3 retries with 800ms delay
- `attachRoomListeners` must re-register ALL Schema listeners after reconnect

## Development Workflow

### Proactive Learning Documentation

After discovering a gotcha, workaround, version quirk, or non-obvious pattern in this codebase, immediately document it in `docs/claude-learnings.md`. This includes debugging insights, framework pitfalls, things that work differently than expected, and patterns that save time. Don't wait to be asked — treat this as a standing habit after every significant discovery.

### Requirement Review

Before implementing a request, briefly evaluate whether the requirement could be improved — simpler approach, better UX, fewer edge cases, or better alignment with existing patterns. If you have a concrete suggestion, raise it before coding. Silently implementing a suboptimal design wastes more time than a quick question.

### Consistency Enforcement

When touching any file, verify that the implementation follows existing project conventions: naming patterns, file organization, error handling style, Schema usage, scene lifecycle patterns, shared-code boundaries, and the solarpunk design system. If new code would diverge from established patterns, flag it and align on the approach first.

### Improvement Identification

When you spot technical debt, refactoring opportunities, missing abstractions, performance bottlenecks, or feature ideas during work, highlight them to the user. If approved, add them to `docs/improvements.md` for future reference.

### Documentation Files

Two living documents capture observations across sessions:

- **`docs/claude-learnings.md`** — Claude's self-improvement notes: codebase gotchas, debugging tricks, version quirks, efficient patterns. Helps future sessions avoid repeated mistakes and work faster in this specific codebase.
- **`docs/improvements.md`** — Application improvement backlog: technical debt, refactoring opportunities, performance ideas, feature suggestions. Reviewed periodically to inform roadmap decisions.

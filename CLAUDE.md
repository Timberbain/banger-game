# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Banger is an asymmetric 1v2 multiplayer arena shooter built with server-authoritative architecture. One Paran (melee/speed) fights two Guardians (Faran + Baran, ranged). Solarpunk pixel art aesthetic.

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
- **Server:** Express + Colyseus 0.15.57 + TypeScript
- **Client:** Phaser 3.90 + Vite 5 + TypeScript
- **Shared:** Pure TypeScript modules in `/shared/` (no framework deps)

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

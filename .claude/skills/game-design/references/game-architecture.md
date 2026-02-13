# Game Architecture

Server-authoritative multiplayer arena combat. Phaser 3 client + Colyseus 0.15 server, shared TypeScript physics.

---

## Scene Flow

```
BootScene → LobbyScene → GameScene + HUDScene (overlay) → VictoryScene (overlay) → LobbyScene
```

- **BootScene**: Preload sprites/projectiles/particle, init AudioManager, create animations, title screen
- **LobbyScene**: Menu → room creation/join → character selection → ready → countdown → game
- **GameScene**: Arena combat, player/projectile rendering, client prediction, tilemap
- **HUDScene**: Overlay (scene.launch not scene.start), health bars, timer, kill feed, cooldown, ping
- **VictoryScene**: Overlay on top of GameScene, stats table, return to lobby

### Scene Lifecycle Rules

- `scene.start()` destroys previous scene, `scene.launch()` runs alongside
- Phaser reuses scene instances — `create()` must reset ALL member vars (constructor skipped)
- HUDScene and VictoryScene are overlays — GameScene stays visible beneath

---

## Physics System

**Shared code** in `shared/physics.ts`, used by server and client for deterministic behavior.

### Constants

```typescript
PHYSICS = { acceleration: 600, drag: 0.85, maxVelocity: 200, minVelocity: 0.01, facingThreshold: 10 }
ARENA = { width: 800, height: 608 }  // 25x19 tiles at 32px
NETWORK = { tickRate: 60, fixedTimeStep: 1000/60, interpolationDelay: 100 }
```

### Character Stats (`shared/characters.ts`)

| Stat | Faran | Baran | Paran |
|------|-------|-------|-------|
| Health | 50 | 50 | 150 |
| Acceleration | 800 | 800 | 300 |
| Max Velocity | 160 | 160 | 300 |
| Drag | 0.4 | 0.4 | 0.95 |
| Damage | 10 | 10 | 40 |
| Fire Rate | 200ms | 200ms | 1000ms |
| Projectile Speed | 300 | 300 | 400 |

### Movement Models

**Paran**: Pac-Man cardinal movement. Last-key-wins via `directionPressOrder` array. Only one axis active at a time. Instant stop when no keys held. Speed redirects on direction change (velocity transfers). Wall collision zeroes ALL velocity.

**Guardians** (Faran/Baran): 8-directional movement. Diagonal allowed. Instant stop on key release. Standard acceleration physics with drag.

### Critical Rule: Fixed Timestep

Always use `1/60` seconds (not deltaTime parameter) for physics to ensure deterministic client prediction matches server simulation.

---

## Client Prediction (`client/src/systems/Prediction.ts`)

- Sends input EVERY FRAME (not just on change) — required for acceleration physics
- Maintains local predicted state
- On server reconciliation: rewind to server state, replay all unacknowledged inputs
- Collision grid mirrors server grid for wall resolution
- Clamps velocity to 0 at arena edges to prevent wall-sliding

### Input Flow

1. Client captures keyboard state every frame
2. `PredictionSystem.sendInput()` applies physics locally + sends to server with sequence number
3. Server processes input, responds with authoritative state + last acknowledged sequence
4. Client prunes acknowledged inputs, replays remaining from server state

---

## Interpolation (`client/src/systems/Interpolation.ts`)

- Remote players render 100ms behind server time
- Snapshot buffer stores last 1000ms of positions per player
- Linear interpolation between bracketing snapshots
- Fallback to latest snapshot if target time is ahead

---

## Collision System (`shared/collisionGrid.ts`)

- Pure TypeScript AABB-vs-tile, axis-separated resolution
- `CollisionGrid` built from Tiled JSON wall layer data
- Server loads in `GameRoom.onCreate()`, resolves after every physics call + no-input path
- Client mirrors grid for prediction
- Destructible obstacles sync via `ObstacleState` Schema

### Collision Resolution Order

1. Apply physics (velocity + position)
2. Resolve X-axis collisions (push out of tiles, zero vx if hit)
3. Resolve Y-axis collisions (push out of tiles, zero vy if hit)
4. Paran special: if ANY hit, zero both vx AND vy (wall penalty)

---

## Particle System (`client/src/systems/ParticleFactory.ts`)

All effects use `particle.png` (8x8 white circle) tinted at runtime.

### API Pattern

```typescript
// One-shot burst
const emitter = scene.add.particles(x, y, 'particle', { ...config, emitting: false });
emitter.setDepth(20);
emitter.explode(count);
scene.time.delayedCall(delay, () => emitter.destroy());

// Continuous trail (caller must destroy)
const trail = scene.add.particles(0, 0, 'particle', { ...config, follow: sprite, emitting: true });
```

---

## Audio System (`client/src/systems/AudioManager.ts`)

- Singleton on Phaser registry: `registry.get('audioManager')`
- jsfxr generates SFX from `SoundDefs.ts` parameter sets
- Volume persisted to localStorage (SFX: 0.7, Music: 0.4)
- `playSFX(key)` creates new AudioBufferSourceNode per call (supports overlap)
- Music via HTMLAudioElement for looping

---

## HUD Overlay (`client/src/scenes/HUDScene.ts`)

Launched alongside GameScene. All text uses monospace bold + black stroke.

### Element Depth Layering

| Depth | Elements |
|-------|----------|
| 200 | Role reminder, timer, ping, kill feed BGs |
| 201 | Kill feed text, cooldown bars |
| 300 | Role banner |
| 400 | Match countdown |

### Update Sources

- **Health bars**: Schema listener on player health changes
- **Timer**: Frame update (elapsed from matchStartTime)
- **Kill feed**: `playerKilled` broadcast message
- **Cooldown**: Frame update (time since last fire)
- **Ping**: 2s interval, room.send('ping') / room.onMessage('pong')

---

## Multiplayer Room Architecture

### Room Types

| Room | Purpose |
|------|---------|
| LobbyRoom | Role selection, ready system, 3s countdown → creates GameRoom |
| MatchmakingRoom | Queue room, 1s check, matchFound → lobby join |
| GameRoom | Arena combat, 60Hz tick, match state machine |

### Match State Machine

```
WAITING → PLAYING (3 players joined) → ENDED (elimination or timeout)
```

### Key Multiplayer Patterns

- **Room codes**: 6-char uppercase (excludes 0/O/1/I/L), `setPrivate(true)` + metadata
- **Room transition**: `matchMaker.createRoom()` (NOT `create()` — create reserves phantom seat)
- **Role assignment**: GameRoom reads `options.role` from client join (session IDs change between rooms)
- **Reconnection**: `allowReconnection(client, 60)`, 3 retries client-side with 800ms delay
- **Disconnect handling**: defer consented leave by 2s, separate DC labels from eliminated labels
- **State listeners**: `attachRoomListeners` must re-register ALL Schema listeners after reconnect

---

## Depth Layering Convention

| Range | Use |
|-------|-----|
| 0 | Background tilemap ground layer |
| 1 | Walls layer |
| 4 | Projectile trails |
| 5 | Projectile sprites |
| 9 | Speed lines |
| 10 | Player sprites |
| 15 | Eliminated/DC labels |
| 20 | Particle effects (hit, death, impact) |
| 200+ | HUD overlay elements |
| 300+ | Banners, countdowns |

---

## Asset Loading Pattern

### Static (BootScene preload)

```typescript
this.load.spritesheet('paran', 'sprites/paran.png', { frameWidth: 32, frameHeight: 32 });
this.load.spritesheet('projectiles', 'sprites/projectiles.png', { frameWidth: 8, frameHeight: 8 });
this.load.image('particle', 'sprites/particle.png');
```

### Dynamic (GameScene per-map)

```typescript
const tilesetInfo = MAP_TILESET_INFO[mapName];
this.load.image(tilesetInfo.key, tilesetInfo.image);
this.load.tilemapTiledJSON(`map_${mapName}`, `maps/${mapName}.json`);
```

Tileset loaded after receiving `mapName` from server state via `onStateChange.once()`.

---

## Server No-Input Fallback

When server receives no input packet for a tick (network gap): maintain current velocity + integrate position. Do NOT call physics with empty input — that triggers instant stop, causing visible jitter.

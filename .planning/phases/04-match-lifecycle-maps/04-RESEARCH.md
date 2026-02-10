# Phase 4: Match Lifecycle & Maps - Research

**Researched:** 2026-02-10
**Domain:** Match state management, win conditions, spectator mode, map rotation, post-match statistics
**Confidence:** HIGH

## Summary

Phase 4 implements complete match lifecycle management with win conditions, multiple hand-crafted maps, spectator mode for eliminated players, and post-match statistics display. This phase transforms the combat sandbox from Phase 3 into a structured competitive experience with clear start/end states, victory conditions, and arena variety.

The core technical challenge is managing game state transitions (waiting → playing → ended) in a server-authoritative environment while maintaining smooth gameplay from Phase 3. The server must detect win conditions, broadcast match results, track per-match statistics (kills, damage, accuracy), and handle eliminated players gracefully without disrupting the game loop. Map management requires loading different Tiled JSON maps dynamically and rotating between them across matches.

Key decisions: (1) Server tracks match state as an enum synced to clients via Schema, (2) Win condition checked each tick after player death (all guardians dead OR Paran dead), (3) Spectator mode implemented as "dead but connected" state—clients receive full state but send no input, (4) Stats tracked server-side in GameState, broadcasted at match end, displayed in Phaser UI overlay, (5) Map rotation handled server-side with sequential or random selection, map name synced to clients for loading appropriate tilemap.

**Primary recommendation:** Implement match state machine first (waiting/playing/ended), then win conditions and statistics tracking, then client-side victory/defeat screen with stats display, then spectator camera controls, finally add multiple maps with rotation logic. Test each increment to ensure existing combat feel remains intact.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Colyseus Schema | 0.15.57 | Match state sync | Enum/string fields for match state, stats objects; established in Phase 1 |
| Colyseus Room Lifecycle | 0.15.57 | Match transitions | onCreate/onDispose hooks for match initialization and cleanup |
| Phaser 3 Scene Manager | 3.90.0 | Victory/defeat UI | Scene transitions for game → end screen → lobby; overlay scenes for stats |
| Phaser 3 Tilemap | 3.90.0 | Multi-map support | Load different Tiled JSON maps dynamically via scene data |
| Tiled Map Editor | 1.10+ | Hand-crafted arenas | Export JSON format maps with Ground and Walls layers; free, standard tool |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Phaser 3 Camera | 3.90.0 | Spectator controls | Follow different players when eliminated; already in Phaser |
| Colyseus broadcast() | 0.15.57 | Match end events | Broadcast "matchEnd" message with final stats to all clients |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Enum match state | Boolean flags | Enum (waiting/playing/ended) is clearer and more extensible than isPlaying, isEnded flags |
| Scene overlay for stats | DOM overlay | Phaser scenes keep everything in canvas; DOM harder to style consistently |
| Sequential map rotation | Random selection | Sequential ensures variety; random can repeat; hybrid (weighted random) best for later |
| Server-side stats only | Client-side tracking | Server prevents stat manipulation; clients can estimate for immediate UI feedback |

**Installation:**
```bash
# No new dependencies required
# All match lifecycle built on existing Colyseus + Phaser + Tiled stack
```

## Architecture Patterns

### Recommended Project Structure
```
shared/
├── physics.ts           # (existing) Arena bounds already defined
└── maps.ts              # New: Map metadata (names, file paths, spawn points)

server/src/
├── schema/
│   ├── GameState.ts     # Add: matchState, matchStats, mapName fields
│   └── MatchStats.ts    # New: Schema for kills, damage, accuracy per player
├── rooms/
│   └── GameRoom.ts      # Add: win condition check, match state transitions, map selection
└── systems/
    ├── MatchSystem.ts   # New: state machine, win conditions, stat tracking
    └── MapRotation.ts   # New: map selection logic (sequential/random)

client/src/
├── scenes/
│   ├── GameScene.ts     # Add: spectator camera, match state handling
│   ├── VictoryScene.ts  # New: victory/defeat screen with stats display
│   └── LobbyScene.ts    # New: pre-match lobby (stub for Phase 5)
└── ui/
    └── StatsDisplay.ts  # New: formatted stats panel component
```

### Pattern 1: Match State Machine

**What:** Server tracks match lifecycle as an enum (WAITING, PLAYING, ENDED) synced to all clients via Schema.

**When to use:** Always for structured multiplayer matches—provides clear transitions and prevents gameplay during setup/teardown.

**How it works:**
1. Room onCreate: set matchState = WAITING
2. When 3 players join: transition to PLAYING, start match timer
3. Each tick: check win conditions (all guardians dead OR Paran dead)
4. On win condition met: set matchState = ENDED, broadcast final stats
5. After 10s in ENDED: disconnect all clients (auto-returns to lobby in Phase 5)
6. Room onDispose: cleanup (save stats to DB in Phase 6)

**Example:**
```typescript
// Server: schema/GameState.ts
import { Schema, type } from "@colyseus/schema";

export enum MatchState {
  WAITING = "waiting",
  PLAYING = "playing",
  ENDED = "ended"
}

export class GameState extends Schema {
  @type("string") matchState: string = MatchState.WAITING;
  @type("number") matchStartTime: number = 0;
  @type("number") matchEndTime: number = 0;
  // ... existing players, projectiles, etc.
}

// Server: rooms/GameRoom.ts
fixedTick(deltaTime: number) {
  if (this.state.matchState !== MatchState.PLAYING) {
    return; // Don't process game logic during waiting/ended
  }

  // ... existing movement, projectiles, combat logic ...

  // Check win conditions
  this.checkWinConditions();
}

private checkWinConditions() {
  const alivePlayers = Array.from(this.state.players.values())
    .filter(p => p.health > 0);

  const aliveParan = alivePlayers.find(p => p.role === "paran");
  const aliveGuardians = alivePlayers.filter(p => p.role !== "paran");

  if (!aliveParan) {
    this.endMatch("guardians"); // Guardians win
  } else if (aliveGuardians.length === 0) {
    this.endMatch("paran"); // Paran wins
  }
}

private endMatch(winner: string) {
  this.state.matchState = MatchState.ENDED;
  this.state.matchEndTime = this.state.serverTime;

  // Broadcast final stats to all clients
  this.broadcast("matchEnd", {
    winner,
    stats: this.state.matchStats,
    duration: this.state.matchEndTime - this.state.matchStartTime
  });

  // Disconnect all clients after delay (returns them to lobby)
  this.clock.setTimeout(() => {
    this.disconnect(); // Triggers room disposal
  }, 10000); // 10 second delay to view stats
}
```

**Source:** [Colyseus Room Lifecycle Methods](https://github.com/colyseus/docs/blob/master/pages/server/room.mdx)

### Pattern 2: Spectator Mode (Dead but Watching)

**What:** Eliminated players remain connected to receive state updates but stop sending input; camera switches to follow alive players.

**When to use:** For matches where elimination happens before match end—keeps players engaged and learning.

**How it works:**
1. Player health reaches 0: client detects dead state from synced health
2. Client stops sending input (skip input message in update loop)
3. Client switches camera to follow mode, cycling through alive players
4. Server ignores any input from dead players (health <= 0 check)
5. Dead player still receives full state updates (movement, projectiles, etc.)
6. On match end: show victory/defeat screen based on team outcome

**Example:**
```typescript
// Client: scenes/GameScene.ts
update(time: number, delta: number) {
  const localPlayer = this.room!.state.players.get(this.room!.sessionId);
  const isDead = localPlayer && localPlayer.health <= 0;

  if (isDead) {
    // Spectator mode: don't send input, follow alive players
    this.updateSpectatorCamera();
    return; // Skip input processing
  }

  // Normal gameplay: read input, send to server
  const input = this.readInput();
  this.prediction!.sendInput(input, this.room!);
  // ... existing prediction/interpolation logic ...
}

private updateSpectatorCamera() {
  // Cycle through alive players with Tab key
  if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
    this.spectatorTarget = this.getNextAlivePlayer();
  }

  if (this.spectatorTarget) {
    const target = this.room!.state.players.get(this.spectatorTarget);
    if (target) {
      this.cameras.main.centerOn(target.x, target.y);
    }
  }
}

private getNextAlivePlayer(): string | null {
  const alivePlayers = Array.from(this.room!.state.players.entries())
    .filter(([id, p]) => p.health > 0 && id !== this.room!.sessionId);

  if (alivePlayers.length === 0) return null;

  // Cycle to next player
  const currentIndex = alivePlayers.findIndex(([id]) => id === this.spectatorTarget);
  const nextIndex = (currentIndex + 1) % alivePlayers.length;
  return alivePlayers[nextIndex][0];
}
```

**Source:** [Phaser Camera Follow](https://docs.phaser.io/api-documentation/class/cameras-camera), [Unity Spectator Discussions](https://discussions.unity.com/t/spectator-mode/874345)

### Pattern 3: Match Statistics Tracking

**What:** Server tracks per-player stats (kills, damage dealt, shots fired, shots hit) during match, broadcasts at end.

**When to use:** Always for competitive games—provides feedback, learning, and replayability.

**How it works:**
1. Server adds MatchStats Schema to GameState with per-player maps
2. On projectile spawn: increment shotsFired[ownerId]
3. On projectile hit: increment shotsHit[ownerId], add damage to damageDealt[ownerId]
4. On player death: increment kills[killerId]
5. On match end: calculate derived stats (accuracy = hits/fired * 100)
6. Broadcast stats object to all clients
7. Client displays in VictoryScene overlay

**Example:**
```typescript
// Server: schema/GameState.ts
export class PlayerStats extends Schema {
  @type("number") kills: number = 0;
  @type("number") deaths: number = 0;
  @type("number") damageDealt: number = 0;
  @type("number") shotsFired: number = 0;
  @type("number") shotsHit: number = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerStats }) matchStats = new MapSchema<PlayerStats>();
  // ... existing fields ...
}

// Server: rooms/GameRoom.ts
onJoin(client: Client, options?: any) {
  const player = new Player();
  // ... existing player setup ...

  // Initialize stats for this player
  const stats = new PlayerStats();
  this.state.matchStats.set(client.sessionId, stats);

  this.state.players.set(client.sessionId, player);
}

fixedTick(deltaTime: number) {
  // ... existing logic ...

  // Process fire input
  if (fire && player.health > 0) {
    if (this.state.serverTime - player.lastFireTime >= stats.fireRate) {
      // Spawn projectile
      const proj = new Projectile();
      // ... projectile setup ...
      this.state.projectiles.push(proj);

      // Track shot fired
      this.state.matchStats.get(sessionId)!.shotsFired++;

      player.lastFireTime = this.state.serverTime;
    }
  }

  // Projectile collision detection
  this.state.players.forEach((target, targetId) => {
    if (targetId === proj.ownerId) return;
    if (target.health <= 0) return;

    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < COMBAT.playerRadius + COMBAT.projectileRadius) {
      // Hit confirmed
      target.health = Math.max(0, target.health - proj.damage);

      // Track stats
      const shooterStats = this.state.matchStats.get(proj.ownerId)!;
      shooterStats.shotsHit++;
      shooterStats.damageDealt += proj.damage;

      if (target.health === 0) {
        shooterStats.kills++;
        this.state.matchStats.get(targetId)!.deaths++;
      }

      hit = true;
    }
  });
}
```

**Source:** [CS2 Stats Trackers](https://community.skin.club/en/articles/best-cs2-stats-trackers), [Gaming Analytics Best Practices](https://lorgar.com/blog/gaming-statistics-how-to-improve-your-gaming-skills-with-in-game-analytics/)

### Pattern 4: Victory/Defeat Scene Overlay

**What:** Client transitions to VictoryScene (overlay) when matchState = ENDED, displaying winner and stats.

**When to use:** For match-based games—clear visual feedback of outcome and performance.

**How it works:**
1. GameScene listens for matchState changes in onChange callback
2. When matchState = ENDED: launch VictoryScene as overlay (GameScene pauses underneath)
3. VictoryScene receives final stats via scene.data
4. Display winner announcement, player stats table, "Return to Lobby" button
5. On button click: stop VictoryScene, disconnect from room, launch LobbyScene

**Example:**
```typescript
// Client: scenes/GameScene.ts
create() {
  // ... existing setup ...

  // Listen for match state changes
  this.room!.state.listen("matchState", (value: string) => {
    if (value === "ended") {
      this.handleMatchEnd();
    }
  });

  // Listen for matchEnd broadcast (includes stats)
  this.room!.onMessage("matchEnd", (data) => {
    this.finalStats = data.stats;
    this.winner = data.winner;
  });
}

private handleMatchEnd() {
  // Launch victory scene as overlay
  this.scene.launch("VictoryScene", {
    winner: this.winner,
    stats: this.finalStats,
    localSessionId: this.room!.sessionId
  });

  // Pause game scene
  this.scene.pause();
}

// Client: scenes/VictoryScene.ts
export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  create(data: any) {
    const { winner, stats, localSessionId } = data;

    // Semi-transparent black background
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);

    // Winner announcement
    const localPlayer = stats.get(localSessionId);
    const didWin = (winner === "paran" && localPlayer.role === "paran") ||
                   (winner === "guardians" && localPlayer.role !== "paran");

    const titleText = didWin ? "VICTORY!" : "DEFEAT";
    const titleColor = didWin ? "#00ff00" : "#ff0000";

    this.add.text(400, 100, titleText, {
      fontSize: '64px',
      color: titleColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Stats table
    let yOffset = 200;
    this.add.text(400, yOffset, "MATCH STATS", {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    yOffset += 40;
    stats.forEach((playerStats: any, sessionId: string) => {
      const accuracy = playerStats.shotsFired > 0
        ? (playerStats.shotsHit / playerStats.shotsFired * 100).toFixed(1)
        : "0.0";

      const statLine = `${playerStats.name}: ${playerStats.kills} kills, ${playerStats.damageDealt} dmg, ${accuracy}% acc`;

      this.add.text(400, yOffset, statLine, {
        fontSize: '18px',
        color: sessionId === localSessionId ? '#ffff00' : '#ffffff'
      }).setOrigin(0.5);

      yOffset += 30;
    });

    // Return button
    const button = this.add.text(400, 500, "Return to Lobby", {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    button.on('pointerdown', () => {
      this.returnToLobby();
    });
  }

  private returnToLobby() {
    // Disconnect from game room
    const gameScene = this.scene.get('GameScene') as GameScene;
    gameScene.room?.leave();

    // Stop both scenes
    this.scene.stop('VictoryScene');
    this.scene.stop('GameScene');

    // Launch lobby scene (stub for Phase 5)
    this.scene.start('LobbyScene');
  }
}
```

**Source:** [Phaser Scene Manager](https://docs.phaser.io/phaser/concepts/scenes/cross-scene-communication), [Phaser Text Creation](https://docs.phaser.io/phaser/concepts/gameobjects/text)

### Pattern 5: Map Rotation System

**What:** Server selects a map from available pool (sequential or random), stores map name in GameState, clients load corresponding tilemap.

**When to use:** For games with multiple arenas—adds variety and strategic depth.

**How it works:**
1. Server defines map pool in config (map names, file paths, spawn points)
2. Room onCreate: select map (sequential index or Math.random())
3. Store selected map name in GameState.mapName
4. Server uses map metadata for spawn point placement
5. Client GameScene.preload: load tilemap based on state.mapName
6. Client GameScene.create: create tilemap layers from loaded data
7. On next match: increment index or re-randomize

**Example:**
```typescript
// Shared: maps.ts
export interface MapMetadata {
  name: string;
  file: string;
  tileset: string;
  spawnPoints: { paran: { x: number; y: number }; guardians: { x: number; y: number }[] };
}

export const MAPS: MapMetadata[] = [
  {
    name: "test_arena",
    file: "maps/test_arena.json",
    tileset: "tiles",
    spawnPoints: {
      paran: { x: 400, y: 300 },
      guardians: [{ x: 200, y: 150 }, { x: 600, y: 450 }]
    }
  },
  {
    name: "corridor_chaos",
    file: "maps/corridor_chaos.json",
    tileset: "tiles",
    spawnPoints: {
      paran: { x: 100, y: 300 },
      guardians: [{ x: 700, y: 150 }, { x: 700, y: 450 }]
    }
  },
  {
    name: "cross_fire",
    file: "maps/cross_fire.json",
    tileset: "tiles",
    spawnPoints: {
      paran: { x: 400, y: 300 },
      guardians: [{ x: 100, y: 100 }, { x: 700, y: 500 }]
    }
  }
];

// Server: rooms/GameRoom.ts
import { MAPS } from "../../../shared/maps";

export class GameRoom extends Room<GameState> {
  private currentMapIndex: number = 0;

  onCreate(options: any) {
    this.setState(new GameState());

    // Select map (sequential rotation)
    const selectedMap = MAPS[this.currentMapIndex];
    this.state.mapName = selectedMap.name;

    // Use spawn points for player placement
    this.mapMetadata = selectedMap;

    console.log(`Room created with map: ${selectedMap.name}`);
  }

  onJoin(client: Client, options?: any) {
    const player = new Player();

    // Assign role and spawn point from map metadata
    const playerCount = this.state.players.size;
    let role: string;
    let spawnPoint: { x: number; y: number };

    if (playerCount === 0) {
      role = "paran";
      spawnPoint = this.mapMetadata.spawnPoints.paran;
    } else {
      role = playerCount === 1 ? "faran" : "baran";
      spawnPoint = this.mapMetadata.spawnPoints.guardians[playerCount - 1];
    }

    player.x = spawnPoint.x;
    player.y = spawnPoint.y;
    player.role = role;
    // ... rest of player setup ...
  }

  // For next match (called in Phase 5 lobby)
  private rotateMap() {
    this.currentMapIndex = (this.currentMapIndex + 1) % MAPS.length;
  }
}

// Client: scenes/GameScene.ts
preload() {
  // Wait for initial state to know which map to load
  // This is handled via onStateChange.once in create()
}

async create() {
  // ... existing Colyseus connection ...

  this.room!.onStateChange.once((state) => {
    const mapName = state.mapName;
    const mapData = MAPS.find(m => m.name === mapName);

    if (!mapData) {
      console.error(`Unknown map: ${mapName}`);
      return;
    }

    // Load and create tilemap dynamically
    this.load.tilemapTiledJSON(mapName, mapData.file);
    this.load.image(mapData.tileset, 'tilesets/placeholder.png');

    this.load.once('complete', () => {
      const map = this.make.tilemap({ key: mapName });
      const tileset = map.addTilesetImage('placeholder', mapData.tileset);

      const groundLayer = map.createLayer('Ground', tileset!, 0, 0);
      const wallsLayer = map.createLayer('Walls', tileset!, 0, 0);
      wallsLayer?.setCollisionByExclusion([-1, 0]);

      // Continue with game setup...
    });

    this.load.start();
  });
}
```

**Source:** [Phaser Load Tiled JSON](https://docs.phaser.io/api-documentation/class/loader-loaderplugin), [PUBG Map Rotation](https://pubgchallenge.co/pubg-map-rotation), [Valorant Map Rotation](https://www.sheepesports.com/en/val/articles/valorant-what-maps-are-in-rotation/en)

### Anti-Patterns to Avoid

- **Processing game logic during WAITING/ENDED states:** Always guard fixedTick with `if (matchState !== PLAYING) return;` to prevent movement/combat during transitions.

- **Client-side win condition detection:** Server is source of truth for win conditions; clients only react to matchState changes. Client-side checks cause desync if network drops a packet.

- **Allowing input from dead players:** Server must check `if (player.health <= 0) return;` before processing any input to prevent ghost shooting.

- **Hardcoding map paths in GameScene:** Use MAPS array and state.mapName for dynamic loading; hardcoding prevents rotation and breaks when adding new maps.

- **Blocking main thread during map load:** Use Phaser's `load.once('complete', callback)` for async map loading; blocking causes frame drops and connection timeouts.

- **Not handling missing stats gracefully:** Check `stats.get(sessionId)` exists before accessing; player might disconnect before stats display, causing crash.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine with transitions | Custom boolean flags (isWaiting, isPlaying, isEnded) | Enum-based matchState field | Enums are self-documenting, prevent invalid states (can't be both waiting AND playing), easier to extend (add PAUSED later) |
| Spectator camera smoothing | Manual lerp with custom easing | Phaser Camera.startFollow() with lerp | Phaser handles edge cases (target destroyed, bounds, zoom), built-in lerp is well-tested |
| Stats aggregation logic | Manual map iteration and calculation | Schema MapSchema with automatic sync | MapSchema syncs efficiently (delta encoding), prevents desync, handles add/remove automatically |
| Map file management | Custom JSON loader with fetch() | Phaser LoaderPlugin.tilemapTiledJSON() | Phaser handles caching, error states, progress events, CORS, and integrates with Asset Manager |
| Victory screen layout | Canvas drawing with manual positioning | Phaser Scene with Text GameObjects | Scene system handles lifecycle (pause/resume), Text objects handle word wrap, alignment, styling automatically |

**Key insight:** Match lifecycle is a well-solved problem in multiplayer frameworks. Colyseus provides room lifecycle hooks (onCreate, onDispose) that map directly to match phases. Phaser provides scene management for UI transitions. Tiled provides map editing with JSON export. Don't reinvent these—compose them into your specific game rules (win conditions, stats tracked, maps designed).

## Common Pitfalls

### Pitfall 1: Race Condition Between Match End and Player Actions

**What goes wrong:** Player fires projectile exactly as match ends; server processes hit after matchState = ENDED, causing stats to update post-match or crash due to missing state.

**Why it happens:** Server sets matchState = ENDED in one tick, but client hasn't received state update yet and sends one more input frame. Server processes input queue before broadcasting matchEnd.

**How to avoid:**
1. Check matchState at START of input processing: `if (this.state.matchState !== MatchState.PLAYING) { player.inputQueue = []; return; }`
2. Drain input queues when transitioning to ENDED: `this.state.players.forEach(p => p.inputQueue = [])`
3. Set matchState = ENDED BEFORE processing projectile collisions in same tick

**Warning signs:** "Cannot read property 'kills' of undefined" errors in logs after match ends, projectiles hitting after victory screen appears, stats showing N+1 kills where N is actual kills.

**Source:** [Replication Race Conditions](https://forums.unrealengine.com/t/replication-race-condition-between-replicated-gamestate-and-rpc-call-on-client/2403583), [Multiplayer State Sync](https://medium.com/@qingweilim/how-do-multiplayer-games-sync-their-state-part-1-ab72d6a54043)

### Pitfall 2: Spectator Camera Following Destroyed Entity

**What goes wrong:** Spectator camera follows a player who disconnects or whose sprite gets destroyed; camera snaps to (0, 0) or crashes.

**Why it happens:** Player disconnects → sprite destroyed → camera still references old sprite object → camera.centerOn() receives undefined position.

**How to avoid:**
1. Store spectatorTarget as sessionId string, not sprite reference
2. In updateSpectatorCamera(), check if target still exists: `const target = this.room.state.players.get(this.spectatorTarget); if (!target) { this.spectatorTarget = this.getNextAlivePlayer(); }`
3. Listen for players.onRemove: `if (sessionId === this.spectatorTarget) { this.spectatorTarget = null; }`
4. Fall back to free camera mode if no alive players remain

**Warning signs:** Camera suddenly at top-left corner, "Cannot read property 'x' of undefined" in updateSpectatorCamera(), camera stuck on empty arena.

**Source:** [Unity Spectator Camera Discussions](https://discussions.unity.com/t/spectator-mode/874345), [Unreal Spectator Perspectives](https://forums.unrealengine.com/t/orienting-spectator-camera-to-different-perspectives-while-spectating-other-players/497108)

### Pitfall 3: Map Load Timing Desync

**What goes wrong:** Client tries to render players before tilemap loads; sprites appear in void, collision layers missing, visual glitches.

**Why it happens:** Colyseus onStateChange fires immediately with initial state (including mapName), but Phaser load.tilemapTiledJSON() is async. Client starts rendering players while map assets still loading.

**How to avoid:**
1. Use onStateChange.once() to read mapName, then load.start() map assets
2. Only create player sprites in load.once('complete') callback after map loads
3. Show "Loading map..." text during asset load
4. Store player adds in queue during load: `this.room.state.players.onAdd((player, id) => { if (!this.mapLoaded) { this.pendingPlayers.push({player, id}); } else { this.createPlayerSprite(player, id); } })`

**Warning signs:** Players visible before map appears, "Cannot read property 'createLayer' of null", tilemap layers render on top of players.

**Source:** [Phaser Load Tiled JSON](https://docs.phaser.io/api-documentation/class/loader-loaderplugin)

### Pitfall 4: Stats Not Syncing to Late Joiners

**What goes wrong:** Player joins mid-match, their stats object not initialized, server crashes trying to increment shotsFired for new player.

**Why it happens:** onJoin creates player and stats, but if match already started, win condition check might run before stats object synced to all clients.

**How to avoid:**
1. Initialize stats in onJoin BEFORE adding player to state: `this.state.matchStats.set(sessionId, new PlayerStats()); this.state.players.set(sessionId, player);`
2. Lock room when matchState = PLAYING: `this.lock();` in transition to playing state
3. Check stats existence before incrementing: `const stats = this.state.matchStats.get(sessionId); if (!stats) return;`
4. Don't allow joins mid-match (Phase 5 will handle this properly with lobby)

**Warning signs:** "Cannot read property 'shotsFired' of undefined" when mid-match joiner fires, stats showing 0 for players who dealt damage, matchStats.size !== players.size.

**Source:** Best practice from Colyseus Schema documentation

### Pitfall 5: Victory Scene Not Receiving Updated Stats

**What goes wrong:** Victory screen shows stale stats (e.g., final kill not counted) because scene.launch() happens before broadcast completes.

**Why it happens:** Server sets matchState = ENDED (triggers client scene transition) in one tick, broadcasts matchEnd message in next tick due to network delay. Client launches VictoryScene with incomplete data.

**How to avoid:**
1. Set matchState = ENDED AFTER broadcasting matchEnd: `this.broadcast('matchEnd', stats); this.clock.setTimeout(() => { this.state.matchState = MatchState.ENDED; }, 100);`
2. Wait for matchEnd message before launching scene: `this.room.onMessage('matchEnd', (data) => { this.scene.launch('VictoryScene', data); });`
3. Don't rely on matchState change alone for scene transition—use explicit message
4. Use Colyseus afterNextPatch option: `this.broadcast('matchEnd', stats, { afterNextPatch: true });`

**Warning signs:** Victory screen shows N-1 kills, damage totals don't match final values, accuracy calculation off by one shot.

**Source:** [Colyseus Broadcast API](https://github.com/colyseus/docs/blob/master/pages/server/room.mdx)

## Code Examples

Verified patterns from official sources and prior phases:

### Match State Initialization and Transition

```typescript
// Server: rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, MatchState, PlayerStats } from "../schema/GameState";

export class GameRoom extends Room<GameState> {
  onCreate(options: any) {
    this.setState(new GameState());
    this.state.matchState = MatchState.WAITING;

    // Lock room to prevent joins mid-match (Phase 5 will handle reconnect)
    this.maxClients = 3;

    console.log(`GameRoom created, waiting for ${this.maxClients} players`);
  }

  onJoin(client: Client, options?: any) {
    // Initialize player and stats atomically
    const player = new Player();
    const stats = new PlayerStats();

    // ... player setup ...

    this.state.matchStats.set(client.sessionId, stats);
    this.state.players.set(client.sessionId, player);

    // Start match when 3 players joined
    if (this.state.players.size === this.maxClients) {
      this.startMatch();
    }
  }

  private startMatch() {
    this.state.matchState = MatchState.PLAYING;
    this.state.matchStartTime = this.state.serverTime;
    this.lock(); // No more joins

    this.broadcast("matchStart", {
      map: this.state.mapName,
      startTime: this.state.matchStartTime
    });
  }

  fixedTick(deltaTime: number) {
    // Guard: only process game logic during active match
    if (this.state.matchState !== MatchState.PLAYING) {
      return;
    }

    // Increment tick and time
    this.state.tickCount++;
    this.state.serverTime += deltaTime;

    // ... existing movement, projectiles, combat logic ...

    // Check win conditions AFTER all combat processed
    this.checkWinConditions();
  }

  private checkWinConditions() {
    const alivePlayers = Array.from(this.state.players.values())
      .filter(p => p.health > 0);

    const aliveParan = alivePlayers.find(p => p.role === "paran");
    const aliveGuardians = alivePlayers.filter(p => p.role !== "paran");

    if (!aliveParan) {
      this.endMatch("guardians");
    } else if (aliveGuardians.length === 0) {
      this.endMatch("paran");
    }
  }

  private endMatch(winner: string) {
    // Drain all input queues to prevent post-match actions
    this.state.players.forEach(p => p.inputQueue = []);

    // Broadcast final stats FIRST (before state change)
    this.broadcast("matchEnd", {
      winner,
      stats: this.serializeStats(),
      duration: this.state.serverTime - this.state.matchStartTime
    }, { afterNextPatch: true }); // Ensure stats synced before state change

    // THEN set match state (triggers client UI transitions)
    this.state.matchState = MatchState.ENDED;
    this.state.matchEndTime = this.state.serverTime;

    // Disconnect all clients after delay (Phase 5 will return to lobby instead)
    this.clock.setTimeout(() => {
      this.disconnect();
    }, 10000);
  }

  private serializeStats() {
    const stats: any = {};
    this.state.matchStats.forEach((playerStats, sessionId) => {
      const player = this.state.players.get(sessionId);
      stats[sessionId] = {
        name: player?.name || "Unknown",
        role: player?.role || "unknown",
        kills: playerStats.kills,
        deaths: playerStats.deaths,
        damageDealt: playerStats.damageDealt,
        shotsFired: playerStats.shotsFired,
        shotsHit: playerStats.shotsHit,
        accuracy: playerStats.shotsFired > 0
          ? (playerStats.shotsHit / playerStats.shotsFired * 100)
          : 0
      };
    });
    return stats;
  }
}
```

**Source:** Adapted from [Colyseus Room Lifecycle](https://github.com/colyseus/docs/blob/master/pages/server/room.mdx) and Phase 3 research patterns

### Client Victory Screen with Stats Display

```typescript
// Client: scenes/VictoryScene.ts
import Phaser from 'phaser';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  create(data: { winner: string; stats: any; localSessionId: string }) {
    const { winner, stats, localSessionId } = data;

    // Semi-transparent overlay
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.85).setDepth(0);

    // Determine local player outcome
    const localStats = stats[localSessionId];
    const didWin = (winner === "paran" && localStats.role === "paran") ||
                   (winner === "guardians" && localStats.role !== "paran");

    // Victory/Defeat title
    const titleText = didWin ? "VICTORY!" : "DEFEAT";
    const titleColor = didWin ? "#00ff00" : "#ff0000";

    this.add.text(400, 80, titleText, {
      fontSize: '72px',
      color: titleColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(1);

    // Winner subtitle
    const winnerText = winner === "paran" ? "Paran Escaped!" : "Guardians Win!";
    this.add.text(400, 150, winnerText, {
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(1);

    // Stats header
    this.add.text(400, 220, "MATCH STATISTICS", {
      fontSize: '24px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1);

    // Stats table header
    const headerY = 260;
    this.add.text(150, headerY, "Player", { fontSize: '16px', color: '#aaaaaa' }).setDepth(1);
    this.add.text(320, headerY, "K", { fontSize: '16px', color: '#aaaaaa' }).setDepth(1);
    this.add.text(370, headerY, "D", { fontSize: '16px', color: '#aaaaaa' }).setDepth(1);
    this.add.text(420, headerY, "Damage", { fontSize: '16px', color: '#aaaaaa' }).setDepth(1);
    this.add.text(530, headerY, "Accuracy", { fontSize: '16px', color: '#aaaaaa' }).setDepth(1);

    // Draw line under header
    const headerLine = this.add.graphics();
    headerLine.lineStyle(2, 0x666666);
    headerLine.lineBetween(120, headerY + 25, 680, headerY + 25);
    headerLine.setDepth(1);

    // Stats rows
    let yOffset = headerY + 40;
    Object.entries(stats).forEach(([sessionId, playerStats]: [string, any]) => {
      const isLocal = sessionId === localSessionId;
      const rowColor = isLocal ? '#ffff00' : '#ffffff';

      // Highlight local player row
      if (isLocal) {
        this.add.rectangle(400, yOffset + 10, 560, 30, 0x333333, 0.5).setDepth(1);
      }

      // Player name (truncate if too long)
      const displayName = playerStats.name.length > 15
        ? playerStats.name.substring(0, 12) + "..."
        : playerStats.name;

      this.add.text(150, yOffset, displayName, {
        fontSize: '18px',
        color: rowColor,
        fontStyle: isLocal ? 'bold' : 'normal'
      }).setDepth(2);

      // K/D/Damage/Accuracy
      this.add.text(320, yOffset, playerStats.kills.toString(), {
        fontSize: '18px',
        color: rowColor
      }).setDepth(2);

      this.add.text(370, yOffset, playerStats.deaths.toString(), {
        fontSize: '18px',
        color: rowColor
      }).setDepth(2);

      this.add.text(420, yOffset, playerStats.damageDealt.toString(), {
        fontSize: '18px',
        color: rowColor
      }).setDepth(2);

      this.add.text(530, yOffset, `${playerStats.accuracy.toFixed(1)}%`, {
        fontSize: '18px',
        color: rowColor
      }).setDepth(2);

      yOffset += 35;
    });

    // Return to lobby button
    const button = this.add.text(400, 520, "Return to Lobby", {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#0066cc',
      padding: { x: 30, y: 15 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    button.on('pointerover', () => button.setBackgroundColor('#0088ff'));
    button.on('pointerout', () => button.setBackgroundColor('#0066cc'));
    button.on('pointerdown', () => this.returnToLobby());
  }

  private returnToLobby() {
    // Disconnect from room
    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene.room) {
      gameScene.room.leave();
    }

    // Stop all game scenes
    this.scene.stop('VictoryScene');
    this.scene.stop('GameScene');

    // Return to boot scene (Phase 5 will replace with proper lobby)
    this.scene.start('BootScene');
  }
}
```

**Source:** Adapted from [Phaser Text Creation](https://docs.phaser.io/phaser/concepts/gameobjects/text) and [Phaser Scene Communication](https://docs.phaser.io/phaser/concepts/scenes/cross-scene-communication)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Boolean flags (isMatchActive) | Enum-based state machine (WAITING/PLAYING/ENDED) | ~2020 | Enums prevent invalid states, easier to debug, clearer intent |
| Kick dead players from room | Spectator mode (dead but watching) | ~2018 (post-BR boom) | Higher engagement, learning opportunity, better UX for asymmetric games |
| Manual map loading per scene | Dynamic tilemap loading from state | Phaser 3.0+ (2018) | Map rotation without code changes, data-driven design |
| Client-calculated stats | Server-authoritative with broadcast | Always (anti-cheat) | Prevents stat manipulation, consistent across all clients |
| Hardcoded spawn points | Map metadata with spawn arrays | ~2019 | Designers iterate maps independently, no code changes needed |

**Deprecated/outdated:**
- **Global state for match management**: Old Phaser 2 pattern, now use Scene Data and Registry for cross-scene state
- **Colyseus filterBy for spectators**: Removed in 0.14+, now use client-side filtering of state updates
- **Manual JSON.stringify for stats**: Colyseus Schema handles serialization automatically with delta encoding

## Open Questions

1. **Should eliminated players be able to chat?**
   - What we know: Spectator mode allows full state visibility, no input sent
   - What's unclear: Whether dead players should communicate (could ghost info to alive teammates)
   - Recommendation: Disable chat for dead players in Phase 4; reconsider in Phase 5 when adding proper lobby chat

2. **How to handle disconnect during match end transition?**
   - What we know: Server sets 10s delay before disconnect, client shows victory screen
   - What's unclear: If player refreshes during delay, do they rejoin ended match or go to lobby?
   - Recommendation: Phase 4 - prevent rejoin (room locked); Phase 5 - add reconnect grace period that checks matchState

3. **Should map rotation be configurable or random?**
   - What we know: Sequential ensures variety, random can repeat, weighted-random balances both
   - What's unclear: What players prefer for a 3-player asymmetric game
   - Recommendation: Start with sequential (simplest), add random option in server config, gather feedback in playtesting

4. **How detailed should accuracy stats be?**
   - What we know: Basic accuracy = hits/fired * 100; CS2 tracks per-weapon, headshot %, distance
   - What's unclear: Whether role-specific stats (Paran collision count) add value
   - Recommendation: Phase 4 - basic K/D/Damage/Accuracy; Phase 6 - detailed stats after gathering user feedback

5. **Should spectator have free camera or locked to players?**
   - What we know: Locked camera simpler, free camera more flexible, BR games use both with toggle
   - What's unclear: Whether 3-player arena needs free camera or player-lock is sufficient
   - Recommendation: Phase 4 - player-locked only (Tab to cycle); Phase 7 UX polish - add free camera toggle if requested

## Sources

### Primary (HIGH confidence)
- [Colyseus Room Lifecycle Methods](https://github.com/colyseus/docs/blob/master/pages/server/room.mdx) - State machine, onCreate/onDispose, broadcast API
- [Colyseus Schema Documentation](https://github.com/colyseus/docs/blob/master/pages/server/room.mdx) - MapSchema for stats, enum for match state
- [Phaser 3 Tilemap API](https://docs.phaser.io/api-documentation/class/loader-loaderplugin) - tilemapTiledJSON loading
- [Phaser 3 Scene Manager](https://docs.phaser.io/phaser/concepts/scenes/cross-scene-communication) - Scene transitions, overlays, data passing
- [Phaser 3 Text GameObjects](https://docs.phaser.io/phaser/concepts/gameobjects/text) - Styling, positioning, interactive buttons
- [Tiled JSON Format](https://doc.mapeditor.org/en/stable/reference/json-map-format) - Layer structure, tileset references
- Phase 3 Research - Projectile patterns, Schema setup, server-authoritative combat

### Secondary (MEDIUM confidence)
- [CS2 Stats Trackers](https://community.skin.club/en/articles/best-cs2-stats-trackers) - Metrics to track (K/D, accuracy, damage)
- [Gaming Analytics Best Practices](https://lorgar.com/blog/gaming-statistics-how-to-improve-your-gaming-skills-with-in-game-analytics/) - Consistency over complexity, focus on actionable metrics
- [PUBG Map Rotation](https://pubgchallenge.co/pubg-map-rotation) - Probability-based rotation, region-specific pools
- [Valorant Map Rotation](https://www.sheepesports.com/en/val/articles/valorant-what-maps-are-in-rotation/en) - Weekly rotation schedules
- [League of Legends Spectator Mode](https://lensviewing.com/league-of-legends-different-camera-angle/) - Camera controls and perspectives

### Tertiary (LOW confidence - flagged for validation)
- [Unity Spectator Discussions](https://discussions.unity.com/t/spectator-mode/874345) - General patterns, not framework-specific
- [Unreal Spectator Perspectives](https://forums.unrealengine.com/t/orienting-spectator-camera-to-different-perspectives-while-spectating-other-players/497108) - Camera switching concepts
- [Multiplayer State Sync](https://medium.com/@qingweilim/how-do-multiplayer-games-sync-their-state-part-1-ab72d6a54043) - General networking patterns
- [Replication Race Conditions](https://forums.unrealengine.com/t/replication-race-condition-between-replicated-gamestate-and-rpc-call-on-client/2403583) - Engine-specific but concepts apply

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project from Phase 1-3, well-documented, proven in prior phases
- Architecture: HIGH - Colyseus docs provide clear patterns, Phaser examples comprehensive, Tiled format stable
- Pitfalls: MEDIUM-HIGH - Race conditions verified from forums, timing issues common but solutions well-known

**Research date:** 2026-02-10
**Valid until:** 60 days (stable multiplayer frameworks, no breaking changes expected)

**Technologies researched:**
- Colyseus 0.15.57 (room lifecycle, Schema, broadcast API)
- Phaser 3.90.0 (scene management, tilemap loading, UI creation)
- Tiled 1.10+ (JSON map format, layer structure)
- General multiplayer game patterns (stats tracking, spectator mode, map rotation)

**Key gaps addressed:**
- ✅ Match state transitions and lifecycle management
- ✅ Win condition detection and game-ending logic
- ✅ Spectator mode implementation for eliminated players
- ✅ Statistics tracking (what to track, how to sync, when to display)
- ✅ Victory/defeat screen UI patterns
- ✅ Multi-map support and rotation strategies
- ✅ Common pitfalls (race conditions, timing, state sync)

**Ready for planning:** YES - All technical domains researched, patterns documented, pitfalls identified, code examples verified

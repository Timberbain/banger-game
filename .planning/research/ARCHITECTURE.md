# Architecture Patterns

**Domain:** v2.0 Arena Evolution -- HD viewport, scrollable arenas, multi-stage rounds, powerups, minimap, tileset rendering, music system, HUD overhaul
**Researched:** 2026-02-13
**Confidence:** HIGH (based on direct codebase analysis + verified Phaser 3 / Colyseus 0.15 capabilities)

---

## Recommended Architecture

The v2.0 features fall into **7 integration domains**, each touching different layers of the existing stack. The core insight is that HD viewport + scrollable arenas are a **foundational change** that cascades into nearly every other feature, so they must be built first.

### High-Level Change Map

```
 SHARED LAYER                SERVER LAYER               CLIENT LAYER
 ============                ============               ============
 physics.ts                  GameRoom.ts                main.ts (game config)
   ARENA.width/height          multi-stage state          width: 1280, height: 720
   (800x608 -> per-map)        machine (WAITING ->
                                STAGE_INTRO ->            GameScene.ts
 maps.ts                       PLAYING -> STAGE_END ->     camera.startFollow()
   MapMetadata extended         MATCH_END)                  camera.setBounds()
   (arenaWidth/Height,                                      tilemap from new tilesets
   powerupSpawns[],           PowerupState schema           powerup sprites
   stagePool[])                (type, x, y, active)         minimap camera
                                                            music per stage
 characters.ts               schema/GameState.ts
   (unchanged)                  + stageNumber            HUDScene.ts
                                + stageScores[]            repositioned for 1280x720
 powerups.ts (NEW)              + powerups MapSchema       round score display
   PowerupDef types                                        powerup pickup indicator
   effects, durations         schema/PowerupState.ts
                               (NEW)                     AudioManager.ts
 collisionGrid.ts                                          music playlist system
   (unchanged -- already                                   crossfade between tracks
   size-agnostic)
```

---

## Component Boundaries

### NEW Components

| Component | Layer | Responsibility | Communicates With |
|-----------|-------|---------------|-------------------|
| `shared/powerups.ts` | Shared | Powerup type definitions, effects, durations, spawn rules | GameRoom, GameScene |
| `server/src/schema/PowerupState.ts` | Server | Colyseus Schema for syncing powerup entities to clients | GameState, GameRoom |

### MODIFIED Components (by impact severity)

| Component | Change Severity | What Changes |
|-----------|----------------|-------------|
| `shared/physics.ts` | **MEDIUM** | `ARENA` becomes per-map (not const). Remove hardcoded 800x608. PredictionSystem and GameRoom pass arena bounds from map metadata instead of importing ARENA singleton. |
| `shared/maps.ts` | **HIGH** | `MapMetadata` extended with `arenaWidth`, `arenaHeight` (pixels), `powerupSpawns[]`, `musicTrack`. Existing maps updated. New larger maps added. |
| `client/src/main.ts` | **LOW** | Game config `width: 1280, height: 720`. Scale mode stays `FIT`. |
| `client/src/scenes/GameScene.ts` | **HIGH** | Camera follow, camera bounds, tilemap for larger arenas, minimap camera, powerup sprite rendering, music per stage, stage transition handling, hot-swap tilemap between stages. |
| `client/src/scenes/HUDScene.ts` | **HIGH** | All hardcoded positions (800-based) updated to 1280x720. New round score indicator. Powerup active indicator. HUD icons from provided icon sprites. |
| `client/src/scenes/BootScene.ts` | **LOW** | Load icon sprites, music files. Title screen positions adjusted for 1280x720. |
| `client/src/scenes/VictoryScene.ts` | **MEDIUM** | Per-stage score display, best-of-3 summary. Positions updated for 1280x720. |
| `client/src/scenes/LobbyScene.ts` | **LOW** | Positions adjusted for 1280x720. Lobby music playback. |
| `client/src/systems/Prediction.ts` | **MEDIUM** | Arena bounds passed per-map instead of importing ARENA const. Edge clamp uses map dimensions. |
| `client/src/systems/AudioManager.ts` | **MEDIUM** | Music system extended: crossfade support, volume fade helpers. |
| `server/src/rooms/GameRoom.ts` | **HIGH** | Multi-stage state machine, per-stage map loading, powerup spawning/collection logic, stage score tracking, health/position reset between stages. |
| `server/src/schema/GameState.ts` | **HIGH** | New fields: `stageNumber`, `totalStages`, `stageWinners` (ArraySchema), `powerups` (MapSchema). Match state extended with new states. |
| `server/src/config.ts` | **LOW** | New constants for stage count, powerup spawn intervals, stage transition timing. |

---

## Detailed Architecture Per Feature

### 1. HD Viewport (800x600 -> 1280x720)

**What changes:**
- `client/src/main.ts`: `width: 1280, height: 720`
- All scene UI positioning uses new dimensions
- HUDScene: `setScroll(0, 0)` already correct -- it uses its own fixed camera. All hardcoded X/Y values (800-based) need updating to 1280-based.
- Scale mode `Phaser.Scale.FIT` + `CENTER_BOTH` already configured -- scales down for smaller screens automatically.

**Existing code impact (every hardcoded coordinate):**
- `BootScene`: splash image `setDisplaySize(800, 600)` -> `(1280, 720)`, text positions centered on new canvas
- `LobbyScene`: all UI positioned relative to 800x600 -> reposition
- `VictoryScene`: all UI positioned relative to 800x600 -> reposition (stats table columns, button Y, dividers)
- `HelpScene`: all UI positioned relative to 800x600 -> reposition
- `HUDScene`: health bar Y=575, timer at (400,20), kill feed at (790, 60), cooldown at (400, 538), ping at (780, 20), role banner at (400, 200) -- ALL need adjustment

**Pattern:** Define layout constants derived from viewport size instead of using magic numbers:

```typescript
// client/src/ui/layout.ts
export const VIEWPORT = { width: 1280, height: 720 };
export const HUD = {
  healthBarY: VIEWPORT.height - 45,
  timerX: VIEWPORT.width / 2,
  timerY: 20,
  killFeedX: VIEWPORT.width - 10,
  killFeedY: 60,
  pingX: VIEWPORT.width - 20,
  pingY: 20,
  cooldownX: VIEWPORT.width / 2,
  cooldownY: VIEWPORT.height - 82,
};
```

**Confidence:** HIGH -- straightforward config change + positioning updates.

### 2. Scrollable Arenas (Camera Follow)

**What changes:**

```typescript
// GameScene.createTilemap() -- after tilemap creation:
const mapWidthPx = map.widthInPixels;   // e.g., 1600 (50 tiles x 32px)
const mapHeightPx = map.heightInPixels; // e.g., 1216 (38 tiles x 32px)

// Set camera bounds to arena size
this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);

// Follow local player sprite
const localSprite = this.playerSprites.get(this.room.sessionId);
if (localSprite) {
  this.cameras.main.startFollow(localSprite, true, 0.1, 0.1);
  // lerp 0.1 = smooth camera lag, good for fast action
}
```

**Shared layer change -- ARENA must become per-map:**

Currently `physics.ts` exports `ARENA = { width: 800, height: 608 }` as a constant. Both `PredictionSystem` (line 106-107) and `GameRoom` (line 343) use `ARENA.width`/`ARENA.height` for edge clamping. This must become dynamic:

```typescript
// shared/physics.ts -- keep ARENA as default for backward compat, but make it overridable
// Each map provides its own arena dimensions via MapMetadata

// PredictionSystem constructor change:
constructor(
  initialState: PlayerState,
  role: string,
  arenaBounds: { width: number; height: number }
)

// GameRoom uses mapMetadata dimensions instead of ARENA const
player.x = Math.max(0, Math.min(this.arenaWidth, player.x));
player.y = Math.max(0, Math.min(this.arenaHeight, player.y));
```

**Server-side:** `GameRoom.onCreate()` already loads map dimensions from JSON (`mapJson.width * mapJson.tilewidth`). Pass these to collision resolution and edge clamping instead of ARENA const.

**Client-side prediction:** `PredictionSystem` needs arena bounds passed in constructor. Currently hardcodes `ARENA.width`/`ARENA.height` for edge clamp on lines 106-107.

**Spectator mode integration:** Spectator mode already has camera centering (GameScene lines 390-398) via `this.cameras.main.centerOn(...)`. With camera follow active, spectator mode should switch to `startFollow(targetSprite)` on the target, and switch between targets with Tab.

**Confidence:** HIGH -- Phaser 3 camera.startFollow + setBounds is well-documented. The existing codebase already does spectator camera centering; this extends that pattern.

### 3. Multi-Stage Best-of-3 Rounds

This is the most architecturally significant change. Two approaches considered:

**Approach A: Same GameRoom, State Reset Per Stage (RECOMMENDED)**
- GameRoom stays open across all stages (3 max)
- State machine extended with new states
- Between stages: health reset, position reset, new map loaded, powerups cleared
- Advantages: no room transition, no reconnection risk, same WebSocket connection
- Disadvantages: more complex state machine in GameRoom

**Approach B: New GameRoom Per Stage (REJECTED)**
- Create new GameRoom for each stage, transfer players
- Problems: session IDs change between rooms (known issue from Phase 5 -- caused extensive debugging), reconnection tokens invalidated, network overhead, race conditions

**Recommended state machine:**

```
WAITING (< 3 players)
  |
  v  (3 players join)
STAGE_INTRO (3s countdown, show map name + stage number)
  |
  v  (countdown ends)
PLAYING (normal game loop: physics, combat, powerups)
  |
  v  (win condition met OR timeout)
STAGE_END (3s results display, award point to winner)
  |
  +---> if no side has 2 wins AND stageNumber < totalStages:
  |       reset state, next map -> goto STAGE_INTRO
  |
  +---> else: MATCH_END (show final Bo3 results, 15s auto-disconnect)
```

**Schema additions to GameState:**

```typescript
@type("number") stageNumber: number = 1;
@type("number") totalStages: number = 3;
@type(["string"]) stageWinners = new ArraySchema<string>();
// stageWinners: ["paran", "guardians", ...] -- one entry per completed stage
```

**Stage transition logic in GameRoom:**

```typescript
private endStage(winner: string) {
  this.state.stageWinners.push(winner);
  this.state.matchState = "stage_end";

  // Broadcast stage result with stats
  this.broadcast("stageEnd", {
    winner,
    stageNumber: this.state.stageNumber,
    stageScores: { paran: paranWins, guardians: guardianWins },
  });

  // Check if match is decided
  const paranWins = this.state.stageWinners.filter(w => w === "paran").length;
  const guardianWins = this.state.stageWinners.filter(w => w === "guardians").length;

  if (paranWins >= 2 || guardianWins >= 2) {
    this.clock.setTimeout(() => this.endMatch(paranWins > guardianWins ? "paran" : "guardians"), 3000);
  } else if (this.state.stageNumber >= this.state.totalStages) {
    // All stages played -- winner has more wins
    const overallWinner = paranWins > guardianWins ? "paran" : "guardians";
    this.clock.setTimeout(() => this.endMatch(overallWinner), 3000);
  } else {
    this.clock.setTimeout(() => this.startNextStage(), 3000);
  }
}

private startNextStage() {
  this.state.stageNumber++;

  // Load next map from stage pool
  const nextMap = this.stagePool[this.state.stageNumber - 1];
  this.loadMapForStage(nextMap);

  // Reset ALL player state
  this.state.players.forEach((player, sessionId) => {
    const stats = CHARACTERS[player.role];
    player.health = stats.maxHealth;
    player.vx = 0;
    player.vy = 0;
    player.lastFireTime = 0;
    player.inputQueue = [];
    // Reset to new map spawn points
    this.assignSpawnPosition(player);
  });

  // Clear projectiles and powerups
  this.state.projectiles.splice(0, this.state.projectiles.length);
  this.state.powerups.clear();
  this.state.obstacles.clear();

  // Reinitialize obstacles from new map
  this.initializeObstacles();

  // Update map name (triggers client tilemap reload)
  this.state.mapName = nextMap.name;

  // Stage intro countdown
  this.state.matchState = "stage_intro";
  this.clock.setTimeout(() => this.beginPlay(), 3000);
}
```

**Client-side stage transitions in GameScene:**

```
GameScene receives matchState = "stage_end":
  1. Show brief "Stage X: [winner side] wins!" overlay via HUDScene event
  2. Fade music out
  3. Pause input processing

GameScene receives matchState = "stage_intro":
  1. Detect mapName changed via state.listen("mapName")
  2. Destroy old tilemap layers + collision grid
  3. Clear minimap markers
  4. Load new map JSON + tileset (may be cached from preload)
  5. Rebuild collision grid for prediction
  6. Update camera bounds for new arena size
  7. Reset prediction system with new position + new arena bounds
  8. Start new music track with crossfade
  9. Show "Stage 2: [Map Name]" overlay via HUDScene

GameScene receives matchState = "playing":
  10. Resume normal game loop
```

**Critical concern -- tilemap hot-swap:** When server resets player positions between stages, Schema onChange fires for each player with new x/y. The prediction system must be reset:

```typescript
// Triggered by mapName change
this.room.state.listen("mapName", (newMapName: string) => {
  if (this.currentMapName && newMapName !== this.currentMapName) {
    this.handleStageMapChange(newMapName);
  }
  this.currentMapName = newMapName;
});

private handleStageMapChange(mapName: string) {
  // Destroy existing tilemap
  if (this.wallsLayer) { this.wallsLayer.destroy(); this.wallsLayer = null; }
  // ... destroy ground layer

  // Reset prediction system
  if (this.prediction) {
    this.prediction.reset({ x: 0, y: 0, vx: 0, vy: 0, angle: 0 });
    // Actual position will come from next server state update
  }

  // Load new map
  this.loadAndCreateTilemap(mapName);
}
```

**Map pool per match:** Each match gets 3 maps assigned at creation (no repeats). Store as `MapMetadata[]` on GameRoom. Stage N uses pool[N-1].

**Confidence:** HIGH for state machine approach. The existing code already has WAITING -> PLAYING -> ENDED; extending to multi-stage is additive. MEDIUM confidence on exact Phaser tilemap hot-swap -- calling `map.destroy()` and `this.make.tilemap()` mid-scene should work but needs testing to verify no cache/memory issues.

### 4. Powerup System

**Architecture follows the exact same pattern as existing projectile and obstacle sync:**

```
Server (authoritative)              Client (visual only)
========================           ========================
PowerupState in MapSchema          Sprite + tween animation
Spawn timer (configurable)         powerups.onAdd -> create sprite
Collision check in fixedTick       powerups.onRemove -> destroy sprite
Effect application to Player       onChange -> update visual
Duration tracking + expiry         HUD indicator for active effects
```

**Shared types (`shared/powerups.ts`):**

```typescript
export enum PowerupType {
  SPEED_BOOST = "speed_boost",    // +50% maxVelocity for 5s
  HEALTH_PACK = "health_pack",    // +30 HP instantly
  DAMAGE_BOOST = "damage_boost",  // +50% damage for 5s
  SHIELD = "shield",              // Block next hit, visual indicator
}

export interface PowerupDef {
  type: PowerupType;
  duration: number;    // ms, 0 = instant effect
  icon: string;        // icon key for HUD display
  tint: number;        // color tint for map sprite
  spawnWeight: number; // relative spawn probability
}

export const POWERUP_DEFS: Record<string, PowerupDef> = {
  [PowerupType.SPEED_BOOST]:  { type: PowerupType.SPEED_BOOST,  duration: 5000, icon: "potion-blue",   tint: 0x4488ff, spawnWeight: 3 },
  [PowerupType.HEALTH_PACK]:  { type: PowerupType.HEALTH_PACK,  duration: 0,    icon: "potion-red",    tint: 0xff4444, spawnWeight: 3 },
  [PowerupType.DAMAGE_BOOST]: { type: PowerupType.DAMAGE_BOOST, duration: 5000, icon: "potion-orange", tint: 0xffaa44, spawnWeight: 2 },
  [PowerupType.SHIELD]:       { type: PowerupType.SHIELD,       duration: 8000, icon: "potion-green",  tint: 0x44ff88, spawnWeight: 1 },
};
```

**Server schema (`server/src/schema/PowerupState.ts`):**

```typescript
export class PowerupState extends Schema {
  @type("string") type: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("boolean") active: boolean = true;
  @type("number") spawnTime: number = 0;
}
```

**Collection logic in GameRoom.fixedTick():**
- After player physics + collision, check player AABB overlap with active powerups
- On overlap: apply effect server-side, set `active = false`, delete from MapSchema
- Duration-based effects: track on Player (server-only fields, NOT synced via schema)
- Sync active effects to client via a simple schema field for HUD display

**Player additions (server-only, not schema-decorated):**
```typescript
// Server-only tracking -- NOT synced to clients
activeEffects: Array<{ type: string; expiresAt: number }> = [];
speedMultiplier: number = 1.0;
damageMultiplier: number = 1.0;
hasShield: boolean = false;
```

**Player schema addition for client HUD:**
```typescript
// Synced to clients so HUD can display active powerup icons
@type("string") activePowerup: string = "";  // current active effect type, "" if none
```

**Spawn logic:**
- Map metadata includes `powerupSpawns: { x: number; y: number }[]` (fixed positions per map)
- Server spawns at random available spawn point every 15-20s
- Max active powerups per arena: 3 (prevents clutter)
- Cleared between stages

**Client rendering in GameScene:**
- `GameState.powerups.onAdd` -> create sprite at (x, y) using icon texture, tinted per POWERUP_DEFS
- Floating bob tween animation (y oscillation)
- `onRemove` -> destroy sprite + pickup particle burst
- Powerup icon sprites use images from `assets/icons/` (potion bottles: icon277-280)

**Confidence:** HIGH -- follows exact same onAdd/onRemove pattern as projectiles and obstacles. Server-authoritative collection prevents exploits.

### 5. Minimap

**Implementation:** Phaser 3 secondary camera in GameScene. NOT a separate scene or RenderTexture.

```typescript
// GameScene -- after tilemap creation
const mapW = map.widthInPixels;
const mapH = map.heightInPixels;
const minimapW = 180;
const minimapH = Math.round(minimapW * (mapH / mapW));

this.minimapCam = this.cameras.add(
  1280 - minimapW - 10,  // x: 10px padding from right edge
  10,                      // y: 10px padding from top
  minimapW,
  minimapH
);
this.minimapCam.setBounds(0, 0, mapW, mapH);
this.minimapCam.setZoom(minimapW / mapW);
this.minimapCam.setAlpha(0.7);
this.minimapCam.setBackgroundColor('rgba(0,0,0,0.3)');
this.minimapCam.setName('minimap');
```

**HUDScene separation advantage:** Because HUDScene is a separate scene launched as overlay, its objects are in a different scene entirely. The minimap camera in GameScene will NOT accidentally render HUD text. This is already architecturally correct.

**Player markers on minimap:** At minimap zoom (~0.11x for 1600px -> 180px), 32px sprites become ~3.5px. Too small. Add dedicated colored circle markers:

```typescript
// Create minimap markers (game objects in GameScene, ignored by main camera)
const marker = this.add.circle(player.x, player.y, 8, roleColor);
marker.setDepth(500);
this.cameras.main.ignore(marker);  // Main camera ignores markers
// Minimap camera renders them at zoomed scale -> ~1px visible dots
// Update marker positions in update() loop alongside sprite positions
```

**Minimap border:** Add a rectangle frame graphic ignored by main camera but visible in minimap viewport area. Or draw a border in HUDScene at the minimap position (HUDScene renders on top).

**Confidence:** HIGH -- Phaser 3 multi-camera with `cameras.add()` is well-supported. `camera.ignore()` allows selective rendering per camera.

### 6. Tileset-Based Rendering (New Tilesets)

**Current state:** 4 maps, each with a unique generated tileset image (solarpunk_ruins, solarpunk_living, etc.). New provided assets: `hedge_tileset.png`, `brick_tileset.png`, `wood_tileset.png`, ground tileset.

**Integration approach:**

1. Create new Tiled JSON maps using the provided tilesets at larger dimensions (~50x38 tiles = 1600x1216 pixels)
2. Each map JSON references its tileset in the `tilesets` array (same as existing maps)
3. `MAP_TILESET_INFO` in GameScene already maps map names to tileset keys -- extend with new entries
4. BootScene already defers tileset loading to GameScene (per-map) -- this pattern scales naturally

**New map creation:**
- Author maps in Tiled editor, export as JSON
- Ground layer + Walls layer structure remains identical to existing maps
- Larger maps: ~50x38 tiles instead of 25x19
- Mix existing solarpunk tilesets with new hedge/brick/wood tilesets for variety between stages

**Tileset loading (already correct pattern in GameScene):**
```typescript
// GameScene.ts lines 207-216 already do this:
if (!this.textures.exists(tilesetInfo.key)) {
  this.load.image(tilesetInfo.key, tilesetInfo.image);
}
this.load.tilemapTiledJSON(mapKey, mapFile);
```

For multi-stage hot-swap between stages: destroy old tilemap, load new one:
```typescript
private loadStageMap(mapKey: string) {
  // Destroy existing tilemap layers
  if (this.wallsLayer) { this.wallsLayer.destroy(); this.wallsLayer = null; }
  if (this.groundLayer) { this.groundLayer.destroy(); this.groundLayer = null; }

  // Load new map (may already be cached from preload)
  if (!this.cache.tilemap.has(mapKey)) {
    this.load.tilemapTiledJSON(mapKey, mapFile);
    this.load.once('complete', () => this.createTilemap(mapKey));
    this.load.start();
  } else {
    this.createTilemap(mapKey);
  }
}
```

**Asset deployment:** Copy tileset PNGs from `assets/tilesets/` to `client/public/tilesets/` (same as existing tilesets). Map JSONs go to `client/public/maps/`.

**Confidence:** HIGH -- existing pattern handles per-map tilesets. Larger maps are just more tile data, same format.

### 7. Music System

**Current state:** `AudioManager` plays one music track via `HTMLAudioElement`. Called from GameScene on match start (`audio/match_music.mp3`) and stopped on match end.

**Available music files:**
- Lobby: `assets/soundtrack/lobby/Pixel Jitter Jive.mp3`
- Stage: `assets/soundtrack/stage/Art Deco Forest Arena.mp3`, `Forest Deco Run.mp3`

**Required changes:**
- Lobby music: play in LobbyScene, stop when entering game
- Stage music: different track per arena/stage
- Crossfade between tracks on stage transitions
- Music stops cleanly during stage transitions, resumes with new track on next stage

**Implementation -- extend AudioManager with crossfade:**

```typescript
// AudioManager additions:

playMusicWithFade(src: string, fadeInMs: number = 1000): void {
  if (this.currentMusic) {
    // Fade out existing track
    const oldMusic = this.currentMusic;
    const fadeOutInterval = setInterval(() => {
      if (oldMusic.volume > 0.02) {
        oldMusic.volume = Math.max(0, oldMusic.volume - 0.02);
      } else {
        clearInterval(fadeOutInterval);
        oldMusic.pause();
        oldMusic.currentTime = 0;
      }
    }, 50);
  }

  // Start new track with fade in
  this.currentMusic = new Audio(src);
  this.currentMusic.volume = 0;
  this.currentMusic.loop = true;
  this.currentMusic.play().catch(() => {});

  const fadeInInterval = setInterval(() => {
    if (this.currentMusic && this.currentMusic.volume < this.musicVolume) {
      this.currentMusic.volume = Math.min(this.musicVolume, this.currentMusic.volume + 0.02);
    } else {
      clearInterval(fadeInInterval);
    }
  }, 50);
}
```

**Music assignment per map:** Add `musicTrack` field to MapMetadata:
```typescript
export interface MapMetadata {
  // ... existing fields
  musicTrack: string;  // e.g., "audio/stage/art-deco-forest-arena.mp3"
}
```

**Asset deployment:** Copy mp3 files from `assets/soundtrack/` to `client/public/audio/`:
- `client/public/audio/lobby/pixel-jitter-jive.mp3`
- `client/public/audio/stage/art-deco-forest-arena.mp3`
- `client/public/audio/stage/forest-deco-run.mp3`

**Decision: Keep HTMLAudioElement for music (not Phaser sound manager).** The existing AudioManager uses raw HTMLAudioElement for music and jsfxr for SFX. This split works well -- HTMLAudioElement handles MP3 looping natively and the crossfade implementation above is simpler than coordinating Phaser tweens with external audio objects. No changes to jsfxr SFX handling needed.

**Confidence:** HIGH -- HTMLAudioElement crossfade is straightforward. Music files already exist in assets.

---

## Data Flow Changes

### Current Data Flow (v1.0 -- single stage)

```
LobbyRoom (role select, ready)
  |
  v  matchMaker.createRoom("game_room", { roleAssignments, fromLobby })
GameRoom.onCreate()
  - Pick map (sequential rotation)
  - Load collision grid
  - WAITING state
  |
  v  3 players join
GameRoom.startMatch()
  - PLAYING state
  - 60Hz fixedTick loop
  |
  v  win condition OR timeout
GameRoom.endMatch()
  - ENDED state
  - broadcast "matchEnd"
  - 15s auto-disconnect
```

### New Data Flow (v2.0 -- multi-stage)

```
LobbyRoom (role select, ready)
  |
  v  matchMaker.createRoom("game_room", { roleAssignments, fromLobby })
GameRoom.onCreate()
  - Pick stage pool (3 maps from MAPS, no repeats)
  - Load stage 1 collision grid
  - WAITING state
  |
  v  3 players join
GameRoom.startStage()
  - STAGE_INTRO state (3s, update mapName schema field)
  - Client detects mapName change, loads new tilemap
  |
  v  3s countdown ends
GameRoom.beginPlay()
  - PLAYING state
  - 60Hz fixedTick loop (includes powerup spawn/collection)
  |
  v  stage win condition OR timeout
GameRoom.endStage(winner)
  - STAGE_END state
  - broadcast "stageEnd" with stage winner + scores
  - push to stageWinners array
  |
  +---> If match NOT decided and stages remain:
  |       3s pause, then loadNextStage() -> goto startStage()
  |
  +---> If match decided (2 wins, or all stages played):
  |       goto endMatch()
  |
  v
GameRoom.endMatch()
  - MATCH_END state
  - broadcast "matchEnd" with overall winner + per-stage results + stats
  - 15s auto-disconnect
```

### Client-Side Stage Transition Sequence

```
1. GameScene receives matchState = "stage_end"
   - HUDScene shows "STAGE 1: Paran Wins!" overlay
   - AudioManager fades out current music
   - Input processing paused

2. Server updates stageNumber + mapName after 3s

3. GameScene detects mapName change via state.listen("mapName")
   - Destroy old tilemap layers
   - Clear projectile sprites, powerup sprites
   - Clear minimap markers
   - Reset collision grid

4. GameScene loads new tilemap JSON + tileset
   - May already be cached (background preload during play)
   - Creates new tilemap layers
   - Rebuilds CollisionGrid for client prediction
   - Updates camera.setBounds() for new arena dimensions
   - Recreates minimap camera bounds

5. GameScene receives matchState = "stage_intro"
   - HUDScene shows "STAGE 2: [Map Name]" with 3s countdown
   - AudioManager starts new stage music with fade-in
   - Player sprites repositioned (server sends new x/y via schema)
   - Prediction system reset with new arena bounds

6. GameScene receives matchState = "playing"
   - Resume normal update loop
   - Input processing resumed
```

**Critical detail -- prediction system reset between stages:**

When the server resets player positions, Schema onChange fires with new x/y. The client must detect this is a stage reset (not normal movement) and hard-reset the prediction system rather than reconciling:

```typescript
// Detect stage reset: if matchState just changed to "stage_intro",
// next player position update is a reset, not a correction
private handlePlayerChange(player: any, sessionId: string, isLocal: boolean) {
  if (isLocal && this.prediction) {
    if (this.isStageTransition) {
      // Hard reset -- don't reconcile
      this.prediction.reset({
        x: player.x, y: player.y, vx: 0, vy: 0, angle: 0
      });
      this.isStageTransition = false;
    } else {
      // Normal reconciliation
      this.prediction.reconcile({ ... });
    }
  }
}
```

---

## Patterns to Follow

### Pattern 1: Schema-Driven State Machine

**What:** All match/stage state transitions use Colyseus Schema fields that clients listen to. Use messages for supplementary one-shot data.

**When:** Any time match state changes (stage transitions, powerup events).

**Example:**
```typescript
// Server: use Schema field (auto-synced, survives reconnection)
this.state.matchState = "stage_intro";
this.state.stageNumber = 2;
this.state.mapName = "corridor_chaos";

// Server: use message for one-shot data payload
this.broadcast("stageEnd", { winner, stageNumber, scores });

// Client: Schema listener for state-driven behavior
this.room.state.listen("matchState", (value: string) => {
  if (value === "stage_intro") this.handleStageIntro();
  if (value === "stage_end") this.handleStageEnd();
  if (value === "playing") this.handlePlayStart();
});

// Client: message listener for data payload
this.room.onMessage("stageEnd", (data) => {
  this.showStageResult(data.winner, data.scores);
});
```

**Why:** Schema listeners survive reconnection (state is re-synced on reconnect). Messages are fire-and-forget. Combine both: Schema for persistent state, messages for event data.

### Pattern 2: Per-Map Arena Bounds

**What:** Replace all hardcoded ARENA references with map-specific bounds passed through the system.

**When:** Every place that references arena width/height.

**Example:**
```typescript
// shared/maps.ts -- extend MapMetadata
export interface MapMetadata {
  name: string;
  displayName: string;
  file: string;
  tileset: string;
  arenaWidth: number;   // pixels (replaces ARENA.width)
  arenaHeight: number;  // pixels (replaces ARENA.height)
  spawnPoints: { ... };
  powerupSpawns: { x: number; y: number }[];
  musicTrack: string;
}

// PredictionSystem: arena bounds as constructor arg, not import
constructor(initialState: PlayerState, role: string, bounds: { width: number; height: number })

// GameRoom: use map metadata dimensions
const arenaW = this.mapMetadata.arenaWidth;
const arenaH = this.mapMetadata.arenaHeight;
player.x = Math.max(0, Math.min(arenaW, player.x));
```

### Pattern 3: Additive Schema Extension

**What:** Add new fields to GameState rather than restructuring existing ones. Use MapSchema for entity collections.

**When:** Adding powerups, stage scores, any new synced state.

**Example:**
```typescript
// GameState.ts -- additive changes only
@type({ map: PowerupState }) powerups = new MapSchema<PowerupState>();
@type("number") stageNumber: number = 1;
@type("number") totalStages: number = 3;
@type(["string"]) stageWinners = new ArraySchema<string>();
```

**Why:** Preserves backward compatibility during incremental development. Existing client code continues working even before it handles new fields (they just have default values).

### Pattern 4: Camera.ignore() for Layer Separation

**What:** Use `camera.ignore(gameObject)` to control which objects appear on which camera (main vs minimap).

**When:** Minimap markers, any object that should only appear on one camera.

**Example:**
```typescript
// Minimap-only markers
const marker = this.add.circle(x, y, 8, color);
this.cameras.main.ignore(marker);  // Not visible on main camera
// minimapCam renders it at zoomed scale

// Main-camera-only UI elements (rare -- most UI is in HUDScene)
const arrow = this.add.triangle(...);
this.minimapCam.ignore(arrow);  // Not visible on minimap
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Room Transition Between Stages

**What:** Creating a new GameRoom for each stage of a best-of-3 match.

**Why bad:** Session IDs change between rooms (documented in Phase 5 MEMORY.md). Reconnection tokens invalidated. 2+ seconds of network overhead per transition. Race conditions during player transfer. The existing LobbyRoom -> GameRoom transition already required extensive debugging (11 plans + 3 gap closure rounds in Phase 5).

**Instead:** Keep the same GameRoom open. Reset state within the room between stages. The WebSocket connection stays alive, Schema syncs automatically.

### Anti-Pattern 2: HUDScene Reading GameScene Camera Scroll

**What:** Having HUDScene try to account for GameScene's camera scroll position for element placement.

**Why bad:** HUDScene has its own independent camera with `setScroll(0, 0)`. Its objects are in screen space, not world space. Coupling HUDScene to GameScene camera creates fragile coordinate transforms.

**Instead:** HUDScene stays in fixed screen space. All HUD elements position relative to viewport (1280x720), completely independent of game camera scroll. This is already the correct architecture.

### Anti-Pattern 3: Loading All Maps at Boot

**What:** Preloading all tilemap JSONs and tilesets in BootScene.

**Why bad:** With 8+ maps and 6+ tilesets, this front-loads significant download time. The existing pattern of per-map dynamic loading in GameScene is correct and should be maintained.

**Instead:** Continue dynamic loading in GameScene. For multi-stage, optionally preload the next stage's assets during the current stage's play phase (background preload using `this.load.start()` without blocking).

### Anti-Pattern 4: Client-Authoritative Powerup Collection

**What:** Client detecting powerup pickup and sending a "collected" message to server.

**Why bad:** Exploitable -- two clients could claim the same powerup. Timing discrepancies between client prediction and server state.

**Instead:** Server checks player-powerup overlap in fixedTick (same pattern as projectile hit detection and Paran contact kill). Client only renders visual feedback when powerup is removed from MapSchema.

### Anti-Pattern 5: Syncing Powerup Effects as Schema Fields

**What:** Adding `@type("number") speedMultiplier` to Player schema to sync effect modifiers.

**Why bad:** These values change every tick when effects expire. Unnecessary bandwidth for derived state. Client doesn't need to know the exact multiplier -- just which effect type is active for HUD display.

**Instead:** Server tracks multipliers internally (not schema-decorated). Sync only `@type("string") activePowerup` for HUD icon display.

---

## Scalability Considerations

| Concern | Current (v1.0) | With v2.0 Changes | Mitigation |
|---------|----------------|-------------------|------------|
| Schema size per tick | ~200 bytes (3 players + projectiles) | ~350 bytes (+powerups, +stage fields) | Negligible. Colyseus delta encoding means only changed bytes sent. |
| Map JSON size | 25x19 = 475 tiles (~15KB) | 50x38 = 1900 tiles (~50KB) | Still tiny. Single HTTP request, cacheable. |
| Tilemap render perf | Full arena visible | Camera culls off-screen tiles | Phaser tilemap layer uses camera culling automatically. Only visible tiles rendered. |
| Camera follow updates | No scroll | Main camera + minimap per frame | Phaser camera follow is engine-level; near-zero overhead. |
| Minimap render pass | N/A | Second camera render | Phaser culls per camera viewport. Minimap renders far fewer pixels. ~3-5% frame budget. |
| Music memory | 1 HTMLAudioElement | 2 during crossfade, 1 steady state | HTMLAudioElement streams, not buffered in full. Crossfade overlap is ~1s. |
| Powerup collision checks | N/A | 3 players x N powerups per tick | N capped at 3-5. Total: 15 distance checks per tick at 60Hz. Trivial. |
| Stage transition latency | N/A | Tilemap destroy + recreate | ~200ms for JSON parse + tilemap creation. Hidden by 3s stage intro countdown. |
| Collision grid memory | 25x19 = 475 cells | 50x38 = 1900 cells | ~8KB. Negligible. |

---

## Suggested Build Order (Dependency-Driven)

```
Phase 1: HD Viewport + Camera Follow + Arena Bounds
         (FOUNDATION -- everything depends on this)
  - main.ts: width/height config
  - shared/physics.ts: ARENA -> per-map bounds
  - shared/maps.ts: arenaWidth/arenaHeight in MapMetadata
  - GameScene: camera.startFollow(), camera.setBounds()
  - PredictionSystem: accept arena bounds, update edge clamp
  - GameRoom: use map dimensions for edge clamp
  - All scenes: reposition UI for 1280x720
  - HUDScene: update all hardcoded positions

Phase 2: New Tilesets + Larger Maps
         (Requires Phase 1 for camera scroll to work with big maps)
  - Author new 50x38 maps in Tiled using provided tilesets
  - Deploy tileset images + map JSONs
  - Update MAP_TILESET_INFO and MAPS registry
  - Test with camera follow on large arenas
  - Update spawn points for larger arenas

Phase 3: Multi-Stage Best-of-3
         (Requires Phase 2 for map pool; most complex feature)
  - Extended state machine in GameRoom
  - Schema additions (stageNumber, stageWinners, etc.)
  - Stage transition: reset health/positions/projectiles
  - Client tilemap hot-swap on mapName change
  - Prediction system stage reset
  - HUDScene stage score indicator
  - VictoryScene best-of-3 summary display

Phase 4: Powerup System
         (Can start in parallel with Phase 3 on simple maps)
  - shared/powerups.ts type definitions
  - server/schema/PowerupState.ts
  - GameRoom spawn timer + collection logic
  - GameRoom effect application + duration tracking
  - GameScene powerup sprite rendering (onAdd/onRemove)
  - HUDScene active powerup indicator

Phase 5: Minimap
         (Requires Phase 1 camera + Phase 2 larger maps)
  - Secondary camera in GameScene
  - Player color markers with camera.ignore()
  - Minimap border/background in HUDScene
  - Minimap visibility toggle (optional)
  - Between-stage minimap recreation

Phase 6: Music System
         (Independent -- can run in parallel with any phase)
  - Deploy music mp3s to client/public/audio/
  - AudioManager crossfade extension
  - MapMetadata musicTrack field
  - LobbyScene: play lobby music
  - GameScene: play per-stage music with crossfade
  - Stage transition: fade out -> fade in new track

Phase 7: HUD Overhaul with Icons
         (After Phases 1, 4 -- integrates everything)
  - Load icon sprites in BootScene (from assets/icons/)
  - Icon-based health display (heart icons)
  - Icon-based timer display
  - Cooldown bar with icon
  - Powerup active display with icons
  - Round score indicator with stage markers
  - Visual polish pass across all HUD elements
```

**Phase ordering rationale:**
- **Phase 1 first:** Every subsequent feature needs 1280x720 positioning and camera scroll awareness. Without this, you can't test large maps, minimap, or correct HUD placement.
- **Phase 2 before Phase 3:** Multi-stage needs a pool of maps. Creating larger maps validates the camera/tileset system.
- **Phase 3 before Phase 4:** Powerups in a multi-stage context require the stage lifecycle (cleared between stages, spawn timers reset). Building powerups first would require rework.
- **Phase 5 after Phases 1+2:** Minimap only makes sense with scrollable arenas larger than the viewport.
- **Phase 6 parallel-safe:** Music is entirely independent of gameplay systems. Can be done alongside any other phase.
- **Phase 7 last:** HUD polish integrates elements from powerups (Phase 4), stage scores (Phase 3), and icons. Best done when all systems exist.

---

## Sources

- Direct analysis of all source files in the Banger codebase (GameScene.ts, HUDScene.ts, GameRoom.ts, GameState.ts, Prediction.ts, AudioManager.ts, physics.ts, maps.ts, collisionGrid.ts, characters.ts, obstacles.ts, BootScene.ts, VictoryScene.ts, main.ts, config.ts, ParticleFactory.ts)
- [Phaser 3 Camera setBounds](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera#setBounds) -- verified camera bounds API
- [Phaser 3 Camera Follow](https://newdocs.phaser.io/docs/3.55.2/Phaser.Cameras.Scene2D.Camera) -- startFollow with lerp parameters
- [Phaser 3 Minimap Camera Example](https://phaser.io/examples/v3/view/camera/minimap-camera) -- multi-camera with smaller viewport
- [Phaser 3 Multiple Cameras](https://phaser.io/examples/v3/view/camera/multiple-cameras) -- cameras.add() API
- [Phaser 3 ScrollFactor](https://newdocs.phaser.io/docs/3.54.0/Phaser.GameObjects.Components.ScrollFactor) -- scrollFactor(0) for fixed UI
- [Phaser 3 Camera Examples (TypeScript)](https://examples.ourcade.co/phaser3-typescript/camera/) -- community TypeScript examples
- [Colyseus 0.15 Room API](https://0-15-x.docs.colyseus.io/server/room/) -- Room lifecycle, allowReconnection
- [Colyseus State Best Practices](https://docs.colyseus.io/state/best-practices) -- Schema design patterns
- [Phaser 3 Audio Concepts](https://docs.phaser.io/phaser/concepts/audio) -- Web Audio context management
- [Volume Fading in Phaser 3](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/fadevolume/) -- fade plugin patterns
- [Web Audio Best Practices for Games](https://blog.ourcade.co/posts/2020/phaser-3-web-audio-best-practices-games/) -- audio context unlock patterns
- Project memory (MEMORY.md) -- Phase 5 learnings on room transitions and session ID changes

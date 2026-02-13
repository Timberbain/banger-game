# Technology Stack: v2.0 Arena Evolution

**Project:** Banger - v2.0 Milestone
**Researched:** 2026-02-13
**Overall confidence:** HIGH (all recommendations use built-in Phaser 3 / Colyseus capabilities already in the codebase, verified against official docs)

## Executive Summary

The v2.0 features (HD viewport, scrollable camera, larger arenas, best-of-3 rounds, powerups, minimap, tileset rendering, music, HUD icons) require **zero new npm dependencies**. Every capability is already available through Phaser 3.90's built-in APIs and the existing Colyseus 0.15 server. The work is integration and configuration, not library adoption.

The only "new" assets entering the pipeline are the provided tilesets, icons, and mp3 soundtrack files -- all of which Phaser's loader handles natively.

---

## Recommended Stack Additions

### New Dependencies Required

**None.** Every v2.0 feature is implementable with the existing stack:

| Feature | Implementation | Why No New Dep |
|---------|---------------|----------------|
| HD viewport (1280x720) | `Phaser.GameConfig.width/height` change | Config value change |
| Scrollable camera | `camera.startFollow()` + `camera.setBounds()` | Built-in Phaser Camera API |
| Larger arenas (~50x38) | Tiled JSON with wider dimensions | Same tilemap pipeline, bigger numbers |
| Best-of-3 rounds | Server-side state machine in GameRoom | Pure TS logic on existing Colyseus schema |
| Powerup system | New Colyseus Schema + shared config | Same pattern as projectiles/obstacles |
| Minimap | `this.cameras.add()` secondary camera | Built-in Phaser multi-camera |
| Tileset rendering | Already using Phaser tilemaps + Tiled JSON | Existing pipeline, new tileset images |
| Music from mp3 | `this.sound.add()` via Phaser Sound Manager | Built-in, already used for match_music.mp3 |
| HUD icons | `this.load.image()` + `this.add.image()` | Standard Phaser image loading |

### Existing Stack (Unchanged)

| Technology | Version | Pinned | Purpose |
|------------|---------|--------|---------|
| Phaser | 3.90.0 | ^3.90.0 | Client engine |
| Colyseus server | 0.15.57 | ^0.15.57 | Game server |
| colyseus.js client | 0.15.28 | ^0.15.28 | Client SDK |
| @colyseus/schema | 2.0.35 | ^2.0.35 | State serialization |
| Vite | 5.4.21 | ^5.4.21 | Client build |
| TypeScript | 5.9.3 (client) / 5.0 (server) | current | Language |
| jsfxr | 1.4.0 | ^1.4.0 | Procedural SFX |
| Express | 4.18.0 | ^4.18.0 | HTTP server |

**Confidence:** HIGH -- these are the exact versions from `package.json`, validated in the running codebase.

---

## Feature-by-Feature Technical Stack

### 1. HD Viewport (1280x720)

**What changes:**
- `client/src/main.ts`: GameConfig `width: 1280, height: 720`
- `client/src/ui/designTokens.ts`: `Layout.canvas` updated to `{ width: 1280, height: 720 }`
- `shared/physics.ts`: `ARENA` constants updated per-map (no longer one global size)
- All hardcoded `800`/`600` pixel references in scenes replaced with Layout constants

**Phaser API used:**
- `Phaser.Scale.FIT` with `autoCenter: CENTER_BOTH` (already configured) -- handles letterboxing automatically
- `pixelArt: true` (already configured) -- ensures nearest-neighbor scaling at HD

**Integration points:**
- HUDScene positions are hardcoded to 800x600 -- must all reference `Layout.canvas.width/height` or `this.cameras.main.width/height`
- BootScene splash images (splash-bg, city-bg) need to scale to 1280x720
- VictoryScene and LobbyScene layout math needs updating

**Confidence:** HIGH -- this is a config change + search-and-replace of hardcoded coordinates.

### 2. Scrollable Camera (Following Local Player)

**What changes:**
- GameScene: `this.cameras.main.startFollow(localSprite, true, 0.1, 0.1)` after creating local player sprite
- GameScene: `this.cameras.main.setBounds(0, 0, arenaWidth, arenaHeight)` after tilemap creation
- HUDScene: Already uses `this.cameras.main.setScroll(0, 0)` -- remains unaffected by game camera scrolling (correct as-is)
- Prediction system: `ARENA.width/height` clamping must use per-map dimensions instead of globals

**Phaser API used:**
- `Camera.startFollow(target, roundPixels, lerpX, lerpY)` -- lerp 0.1 gives smooth tracking appropriate for 60Hz
- `Camera.setBounds(x, y, w, h)` -- prevents scrolling past arena edges
- `Camera.setDeadzone(w, h)` -- optional, small deadzone reduces camera jitter for fast Paran movement

**Integration points:**
- Spectator mode already calls `this.cameras.main.centerOn()` -- compatible with follow system (stopFollow before centering on spectator target, or just switch follow target)
- Remote player sprites render at world coordinates (already correct) -- interpolation unchanged
- Projectile sprites at world coordinates (already correct)
- Particle effects at world coordinates (already correct)

**Critical consideration:** The HUDScene overlay is separate from GameScene and has its own camera. This is already the correct architecture -- HUD elements stay fixed on screen while the game camera scrolls. No changes needed to the overlay pattern.

**Confidence:** HIGH -- Phaser's camera follow is extensively documented and this project already uses camera methods (centerOn for spectator).

### 3. Larger Arenas (~50x38 tiles = 1600x1216px)

**What changes:**
- `shared/maps.ts`: `MapMetadata.width/height` updated per map (e.g., 1600x1216)
- `shared/physics.ts`: `ARENA` becomes either per-map or derived from map metadata (no single global)
- Tiled JSON maps: `"width": 50, "height": 38` with `"tilewidth": 32, "tileheight": 32`
- Server `GameRoom.ts`: ARENA bounds clamping reads from `this.mapMetadata.width/height` instead of `ARENA` constant
- Client `Prediction.ts`: Edge clamping reads from map dimensions (passed at init or via CollisionGrid bounds)

**Server changes:**
- CollisionGrid already handles arbitrary map sizes (constructor takes `mapWidth`, `mapHeight`) -- no changes
- `resolveCollisions()` already operates on grid dimensions -- no changes
- Projectile bounds check (`proj.x < 0 || proj.x > ARENA.width`) must use map-specific bounds

**Client changes:**
- Tilemap creation pipeline unchanged -- Phaser tilemaps handle any size
- Camera bounds set from tilemap dimensions: `camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels)`

**Spawn point considerations:**
- Larger arenas need more distributed spawn points
- Consider multiple spawn options per role for variety

**Confidence:** HIGH -- CollisionGrid and tilemap pipeline already support arbitrary sizes, this is primarily a data change.

### 4. Multi-Stage Best-of-3 Rounds

**What changes:**
- `server/src/schema/GameState.ts`: New schema fields:
  - `@type("number") currentRound: number = 1`
  - `@type("number") maxRounds: number = 3` (best-of-3 = first to 2 wins)
  - `@type("number") paranRoundWins: number = 0`
  - `@type("number") guardianRoundWins: number = 0`
  - `@type("string") matchState` extended: `WAITING -> PLAYING -> ROUND_END -> PLAYING -> ... -> MATCH_END`
- `server/src/rooms/GameRoom.ts`: State machine extended with round transitions
  - On round end: broadcast `roundEnd` message, reset positions/health/obstacles, increment round counter
  - On match end (first to 2 wins): broadcast `matchEnd` as current
  - Between-round pause (3-5 seconds) for score display

**Colyseus schema additions (no new types needed):**
```typescript
// In GameState
@type("number") currentRound: number = 1;
@type("number") maxRounds: number = 3;
@type("number") paranRoundWins: number = 0;
@type("number") guardianRoundWins: number = 0;
```

**Client changes:**
- HUDScene: Round counter display (e.g., "Round 1/3" or win indicator dots)
- Between-round overlay: Score summary + countdown
- VictoryScene: Shows match-level results (not just round results)
- Audio: Per-round fanfare (reuse existing match_start_fanfare)

**Integration points:**
- Round reset must clear: player positions, health, velocities, projectiles, destructible obstacles, input queues
- CollisionGrid must be rebuilt from original map data on round reset (destructible tiles respawn)
- Client prediction system must reset on round transition
- Reconnection must account for round state (player reconnects mid-round-2)

**Confidence:** HIGH -- pure server-side state machine logic using existing Colyseus Schema patterns.

### 5. Powerup System

**What changes:**
- New shared config: `shared/powerups.ts` -- powerup types, durations, effects
- New schema: `server/src/schema/Powerup.ts` -- position, type, active flag
- `server/src/schema/GameState.ts`: `@type({ map: PowerupState }) powerups`
- `server/src/rooms/GameRoom.ts`: Spawn logic + pickup detection + effect application

**Schema design:**
```typescript
class PowerupState extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") type: string = ""; // "speed", "damage", "heal", "shield"
  @type("boolean") active: boolean = true;
}
```

**Shared powerup config pattern (matches existing CHARACTERS pattern):**
```typescript
export const POWERUPS: Record<string, PowerupDef> = {
  speed_boost: { duration: 5000, multiplier: 1.5, icon: 'potion-blue' },
  damage_boost: { duration: 5000, multiplier: 1.5, icon: 'potion-red' },
  heal: { amount: 25, icon: 'potion-green' },
  // ...
};
```

**Server pickup detection:** Same circle-overlap pattern as contact kill check (already in fixedTick):
```typescript
// Distance check: player center vs powerup center
if (dist < COMBAT.playerRadius + POWERUP_RADIUS) { ... }
```

**Client rendering:**
- Powerup sprites rendered at world coordinates (same as projectiles)
- Icon images from provided icon set (potion-red, potion-green, etc.)
- Pickup particle effect via existing ParticleFactory
- Active powerup indicator on HUD (timer bar + icon)

**Integration points:**
- Powerups must respawn on round reset (best-of-3)
- Server tracks active buffs per player (server-only, not synced -- effect applied during physics)
- Spawn timing: initial spawns at match start + periodic respawns on timer

**Confidence:** HIGH -- follows identical pattern to projectiles and obstacles (Schema + MapSchema + shared config).

### 6. Minimap

**What changes:**
- GameScene: Add secondary camera via `this.cameras.add(x, y, width, height)`
- Minimap camera: `setZoom(viewportWidth / arenaWidth)` to show entire arena
- Minimap camera: `setScroll()` to center on arena
- Minimap camera: Apply background tint/border for visual distinction
- Player sprites need minimap indicator dots (or are visible at minimap scale)

**Phaser API used:**
- `this.cameras.add(minimapX, minimapY, minimapW, minimapH)` -- creates secondary camera
- `camera.setZoom(scale)` -- zooms out to show full arena
- `camera.setBackgroundColor()` -- tinted background
- `camera.ignore(gameObject)` -- hide HUD elements from minimap camera

**Implementation approach (secondary camera, NOT RenderTexture):**
The secondary camera approach is simpler and more performant for this use case because:
1. All game objects automatically render on all cameras unless ignored
2. No manual draw calls needed
3. Zoom handles scaling automatically
4. Player sprites are visible as colored dots at minimap scale (32px sprites at ~0.15 zoom = ~5px, visible)

**Minimap sizing:**
- Arena 1600x1216 at viewport 1280x720
- Minimap: 200x152 in corner (preserves aspect ratio)
- Zoom: ~0.125 (200/1600)

**Integration points:**
- HUDScene elements must be ignored by minimap camera (they're in a separate scene, so naturally excluded)
- Minimap camera lives in GameScene (same scene as game objects)
- Border/frame rendered as a Rectangle game object, ignored by main camera but visible on minimap camera (or rendered in HUDScene)

**Confidence:** HIGH -- Phaser's multi-camera system is well-documented. The official Phaser examples include a "Minimap Camera" example.

### 7. Tileset-Based Map Rendering

**What changes:**
- New tileset images moved from `assets/images/` to `client/public/tilesets/`
- Tiled JSON maps reference new tilesets (hedge, brick, wood, ground textures)
- Maps may use multiple tilesets per map (Phaser tilemaps support this)
- `MAP_TILESET_INFO` in GameScene updated for new tilesets

**Current pipeline (unchanged):**
1. Server sends `mapName` via state
2. Client loads Tiled JSON + tileset image dynamically
3. `map.addTilesetImage()` + `map.createLayer()` builds visual
4. Wall layer data feeds CollisionGrid

**Multiple tilesets per map:**
Phaser `map.addTilesetImage()` can be called multiple times. `map.createLayer()` accepts an array of tilesets:
```typescript
const tileset1 = map.addTilesetImage('ground', 'ground_key');
const tileset2 = map.addTilesetImage('walls', 'walls_key');
const layer = map.createLayer('Walls', [tileset1, tileset2]);
```

**Tiled map structure for v2.0:**
- Ground layer: ground texture tiles (grass, stone, dirt)
- Walls layer: collision tiles (hedge, brick, wood -- matching existing obstacle tier system)
- Decoration layer (optional): non-collision visual tiles on top

**Integration points:**
- `OBSTACLE_TILE_IDS` in shared/obstacles.ts must map new tile IDs correctly
- Server loads Tiled JSON via `fs.readFileSync` -- path resolution unchanged
- CollisionGrid constructor reads wall layer data -- format identical

**Confidence:** HIGH -- the existing tilemap pipeline handles this. New tilesets are drop-in replacements.

### 8. Music System (MP3 Playback)

**What changes:**
- Replace raw `HTMLAudioElement` music in AudioManager with Phaser's Sound Manager
- Phaser Sound Manager is global (persists across scenes) -- perfect for music
- Load mp3 files via `this.load.audio()` in BootScene
- Play via `this.sound.add('track').play({ loop: true })`

**Why switch from HTMLAudioElement to Phaser Sound Manager:**
The current AudioManager uses raw `new Audio(src)` for music. This works but misses Phaser's benefits:
1. Phaser Sound Manager handles Web Audio API with HTML5 fallback automatically
2. Volume control integrates with Phaser's global sound system
3. Phaser tweens can fade volume (crossfade between lobby/match tracks)
4. Sound persists across scenes by default -- no manual lifecycle management

**Available tracks:**
| File | Purpose | Location |
|------|---------|----------|
| `Pixel Jitter Jive.mp3` | Lobby music | `assets/soundtrack/lobby/` |
| `Forest Deco Run.mp3` | Match track 1 | `assets/soundtrack/stage/` |
| `Art Deco Forest Arena.mp3` | Match track 2 | `assets/soundtrack/stage/` |
| `match_music.mp3` | Existing match track | `client/public/audio/` |

**Implementation:**
```typescript
// BootScene preload
this.load.audio('lobby_music', 'audio/lobby_music.mp3');
this.load.audio('match_music_1', 'audio/match_music_1.mp3');
this.load.audio('match_music_2', 'audio/match_music_2.mp3');

// Play with crossfade using Phaser tweens
const music = this.sound.add('lobby_music', { loop: true, volume: 0 });
music.play();
this.tweens.add({ targets: music, volume: 0.4, duration: 1000 });
```

**Music state machine:**
- BootScene/LobbyScene: lobby track (loop)
- GameScene: random match track (loop), crossfade on transition
- VictoryScene: match track fades, optional victory sting
- Scene transitions: fade out old, fade in new (500ms crossfade)

**Integration points:**
- AudioManager needs refactoring to wrap Phaser Sound Manager for music (keep jsfxr for SFX)
- Volume controls in AudioManager already persist to localStorage -- keep this
- SFX system (jsfxr) remains unchanged -- it operates independently

**Confidence:** HIGH -- Phaser Sound Manager is documented as global, persistent across scenes, with Web Audio support.

### 9. HUD Icons

**What changes:**
- Load icon PNGs in BootScene: `this.load.image('icon-heart-full', 'icons/icon001.png')`
- Use icons in HUDScene as `this.add.image()` game objects
- Replace text-based indicators with icon-based ones where appropriate

**Available icons (from assets/icons/):**
| Icon | Filename | HUD Usage |
|------|----------|-----------|
| heart-full | icon001.png | Health indicator |
| heart-empty | icon002.png | Lost health indicator |
| timer | icon005.png | Match timer icon |
| skull | icon006.png | Death/kill indicator |
| volume-1..4 | icon044-047.png | Volume level in settings |
| arrows | icon064-067.png | Navigation/direction |
| potions | icon277-280.png | Powerup indicators |
| food items | icon319-328.png | Powerup pickup sprites |
| gravestone | icon398.png | Eliminated player marker |

**Integration approach:**
1. Copy icons from `assets/icons/` to `client/public/icons/` (Vite serves from public/)
2. Load all needed icons in BootScene preload
3. Reference by key in HUDScene and GameScene
4. Icons are small PNGs (~400 bytes each) -- negligible load impact

**Icon sizing:**
Current icons appear to be 16x16 or 32x32 pixel art. With `pixelArt: true` in Phaser config, they render crisp at any scale. Use `setScale()` for HUD sizing.

**Confidence:** HIGH -- standard Phaser image loading, no special handling needed.

---

## What NOT to Add

| Temptation | Why Avoid |
|------------|-----------|
| **Phaser plugins** (e.g., rexUI) | Adds dependency weight. All needed UI is achievable with Phaser primitives (Rectangles, Text, Images). The project already builds all UI this way. |
| **Howler.js** for audio | Phaser's built-in Sound Manager does everything needed. Adding Howler would create two audio systems. |
| **pixi.js or other renderers** | Phaser wraps its own renderer. Mixing renderers causes conflicts. |
| **Tiled map editor plugins** | Maps can be authored in standard Tiled. No runtime plugins needed. |
| **ECS frameworks** (bitecs, etc.) | Project uses class-based architecture throughout. ECS migration would be a rewrite for no gain at this player count (3). |
| **Physics engines** (Matter.js, etc.) | Custom physics in shared/ is integral to client prediction determinism. Swapping physics would break prediction. Phaser arcade physics is already in config but unused (custom physics used instead). |
| **State management libs** | Colyseus Schema IS the state management. Adding Redux/Zustand would duplicate state. |
| **Additional networking** (Socket.io, etc.) | Colyseus handles all networking. Its WebSocket transport is sufficient. |

---

## Configuration Changes Summary

### client/src/main.ts
```typescript
const config: Phaser.Types.Core.GameConfig = {
  width: 1280,    // was 800
  height: 720,    // was 600
  // ... rest unchanged
};
```

### shared/physics.ts
```typescript
// ARENA becomes per-map (read from MapMetadata)
// Remove global ARENA constant or make it the max/default
export const ARENA = {
  width: 1600,    // was 800 -- now represents max arena size
  height: 1216,   // was 608 -- now represents max arena size
};
```

### shared/maps.ts
```typescript
// Maps gain larger dimensions
{
  name: "hedge_maze",
  width: 1600,    // 50 tiles x 32px
  height: 1216,   // 38 tiles x 32px
  // ...
}
```

---

## Asset Pipeline Changes

### New files to copy into client/public/
| Source | Destination | Purpose |
|--------|------------|---------|
| `assets/icons/*.png` | `client/public/icons/` | HUD and powerup icons |
| `assets/soundtrack/lobby/*.mp3` | `client/public/audio/` | Lobby music |
| `assets/soundtrack/stage/*.mp3` | `client/public/audio/` | Match music tracks |
| New tileset PNGs (when created) | `client/public/tilesets/` | Map tilesets |
| New Tiled JSON maps (when created) | `client/public/maps/` | Larger arena maps |

### Files requiring no pipeline changes
- Spritesheets (paran, faran, baran) -- 32x32 frames, unchanged
- Projectile sprites -- unchanged
- Particle texture -- unchanged
- Splash/background images -- scale to 1280x720 in scene code

---

## Alternatives Considered

| Feature | Recommended | Alternative | Why Not |
|---------|-------------|-------------|---------|
| Minimap | Secondary Phaser camera | RenderTexture manual draw | Camera approach auto-renders all game objects; RenderTexture requires manual draw calls each frame |
| Music | Phaser Sound Manager | Keep HTMLAudioElement | Phaser SM gives tweening (fade), global persistence, Web Audio fallback, consistent API |
| HD scaling | Phaser Scale.FIT | Fixed viewport + CSS scaling | Scale.FIT already handles this correctly; manual CSS would fight Phaser's scaler |
| Larger maps | Same Tiled pipeline, bigger JSON | Chunked loading | 50x38 is 1900 tiles -- trivial for Phaser. Chunking adds complexity for no performance gain at this size |
| Round system | Colyseus state machine | Separate rooms per round | Same room avoids reconnection overhead, preserves match context, simpler client code |
| Powerup sync | MapSchema<PowerupState> | Broadcast messages | Schema gives automatic delta sync + client prediction support; messages would need manual state tracking |

---

## Integration Risk Assessment

| Change | Risk | Reason |
|--------|------|--------|
| HD viewport | LOW | Config change, coordinates use Layout constants |
| Camera follow | LOW | Built-in Phaser API, well-documented |
| Larger arenas | LOW | Existing pipeline supports arbitrary sizes |
| Best-of-3 rounds | MEDIUM | State machine complexity, round reset must be thorough |
| Powerup system | MEDIUM | New server logic, balance tuning, interaction with existing combat |
| Minimap | LOW | Built-in multi-camera, separate from main rendering |
| Tileset rendering | LOW | Same pipeline, new asset files |
| Music system | LOW | Phaser Sound Manager is straightforward, replaces simpler system |
| HUD icons | LOW | Standard image loading |

**Highest risk:** Round system -- because round reset must correctly restore ALL state (positions, health, obstacles, collision grid, projectiles, input queues, prediction state). Missing any one causes desync.

---

## Sources

- [Phaser Camera API Documentation](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera) -- startFollow, setBounds, setViewport, setZoom
- [Phaser Camera Concepts](https://docs.phaser.io/phaser/concepts/cameras) -- multi-camera, viewport, deadzone
- [Phaser Audio Concepts](https://docs.phaser.io/phaser/concepts/audio) -- Sound Manager global persistence, Web Audio support
- [Phaser Minimap Camera Example](https://phaser.io/examples/v3/view/camera/minimap-camera) -- official example
- [Phaser Tilemap API](https://docs.phaser.io/api-documentation/function/tilemaps) -- multiple tilesets, layer creation
- Codebase analysis: `client/package.json`, `server/package.json`, all scene files, shared modules

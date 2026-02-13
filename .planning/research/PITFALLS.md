# Domain Pitfalls

**Domain:** v2.0 Arena Evolution -- Adding HD resolution, scrollable arenas, multi-stage rounds, powerups, minimap, tileset integration, music system, and HUD overhaul to an existing Phaser 3 + Colyseus multiplayer game.
**Project:** Banger (1v2 asymmetric shooter)
**Researched:** 2026-02-13
**Confidence:** HIGH (derived from codebase analysis + official docs + web research)

---

## Critical Pitfalls

Mistakes that cause rewrites, desyncs, or major architectural regressions.

---

### Pitfall 1: ARENA Constant Hardcoded Everywhere -- Resolution Change Breaks Physics

**What goes wrong:** The shared `physics.ts` exports `ARENA = { width: 800, height: 608 }` and this constant is used for edge clamping in both `PredictionSystem.sendInput()` (line 106-107), `PredictionSystem.reconcile()` (line 169-170), and `GameRoom.resolvePlayerCollision()` (line 342-343). Changing to larger arenas (e.g., 50x38 tiles = 1600x1216 pixels) without updating ARENA causes players to be clamped to the old 800x608 box in the center of the new map.

**Why it happens:** ARENA was designed as a single global constant when all maps shared the same dimensions. With variable-size maps, it needs to become per-map metadata.

**Consequences:** Players hit an invisible wall at x=800, y=608 in a 1600x1216 arena. Client prediction and server disagree if only one is updated. Projectiles despawn at old bounds.

**Prevention:**
1. Remove the global `ARENA` constant from `physics.ts`.
2. Add `arenaWidth` and `arenaHeight` fields to `MapMetadata` in `shared/maps.ts` (they already have `width` and `height` but these must become authoritative for physics, not just informational).
3. Pass arena dimensions into `PredictionSystem` constructor and `GameRoom.resolvePlayerCollision()` instead of importing ARENA.
4. Server sends arena dimensions in GameState schema so client prediction uses identical bounds.
5. Update `GameRoom.fixedTick()` projectile bounds check (line 524) to use map dimensions.

**Detection:** Players stuck at invisible walls despite open map; projectiles disappearing mid-arena.

**Phase:** Must be addressed first in HD Resolution / Arena Enlargement phase. Everything else depends on this.

**Confidence:** HIGH -- verified by reading exact code paths in `physics.ts:14-15`, `Prediction.ts:106-107`, `GameRoom.ts:342-343,524`.

---

### Pitfall 2: HUD Uses Hardcoded Pixel Positions -- Breaks on Resolution Change

**What goes wrong:** `HUDScene` positions every element at magic numbers: timer at `(400, 20)`, ping at `(780, 20)`, kill feed at `(790, 60)`, health bars at y=575, cooldown at `(400, 538)`. The `designTokens.ts` Layout object also hardcodes `canvas: { width: 800, height: 600 }` and `center: { x: 400, y: 300 }`. When resolution changes to 1280x720, all HUD elements cluster in the top-left or mid-left area instead of being properly anchored to screen edges.

**Why it happens:** With 800x600 viewport = arena, there was no distinction between "screen space" and "world space." Every pixel position doubled as both. With HD viewports, HUD must use screen-relative coordinates.

**Consequences:** Health bars render offscreen or overlap with game content. Timer and ping overlap with kill feed. All HUD elements are mispositioned.

**Prevention:**
1. Refactor all HUD positions to use `this.cameras.main.width` and `this.cameras.main.height` instead of magic numbers.
2. Update `Layout` in designTokens.ts to compute positions from viewport dimensions.
3. HUDScene already has `this.cameras.main.setScroll(0, 0)` (line 112) which is correct -- its camera must NOT follow the game camera. Verify this continues to work.
4. All HUD coordinates should be expressed as percentages or anchor offsets (e.g., `width - 20` for right-aligned, `height - 25` for bottom).

**Detection:** HUD elements visually mispositioned after resolution change.

**Phase:** HD Resolution phase, same plan as viewport change.

**Confidence:** HIGH -- verified hardcoded positions in `HUDScene.ts` lines 317, 386, 464, 504, 552, 592, 600, and `designTokens.ts` lines 309-323.

---

### Pitfall 3: VictoryScene Hardcoded to 800x600 -- Breaks on HD Resolution

**What goes wrong:** `VictoryScene` positions the splash image at `(400, 300)` with `setDisplaySize(800, 600)`, overlays at `(400, 300, 800, 600)`, title at `(400, 60)`, stats table with column positions `{ name: 100, role: 250, kills: 340, deaths: 400, damage: 470, accuracy: 570 }`, and button at `(400, 500)`. At 1280x720, stats will be left-aligned and cramped; overlay won't cover the full screen.

**Why it happens:** Same reason as HUD -- no distinction between viewport and world when they were identical.

**Consequences:** Victory screen looks broken: background doesn't cover full screen, stats misaligned, button not centered.

**Prevention:**
1. Use `this.cameras.main.width` and `this.cameras.main.height` for all positioning.
2. Center positions use `width / 2` not `400`.
3. Stats table column positions should be percentage-based: `cols.name = width * 0.125`, etc.
4. Splash and overlay sizes must match new viewport dimensions.

**Detection:** Visual regression immediately visible on VictoryScene.

**Phase:** HD Resolution phase.

**Confidence:** HIGH -- verified in `VictoryScene.ts` throughout create().

---

### Pitfall 4: Client Prediction Uses Edge Clamp, Not Collision Grid Bounds

**What goes wrong:** `PredictionSystem` clamps to `ARENA.width` and `ARENA.height` as a "safety net" (lines 106-107, 169-170), but the actual arena boundary is the wall tiles in the collision grid. When arenas get larger, the safety-net clamp must match the new map pixel dimensions. If the clamp is wrong, prediction and server disagree, causing rubber-banding.

But there is a subtler issue: collision grid already handles boundary walls (out-of-bounds treated as solid, `CollisionGrid.isSolid()` line 75-77). The ARENA clamp is redundant IF the collision grid is properly initialized. However, if the collision grid loads late (race condition between tilemap load and first input), the ARENA clamp is the only protection. Removing it creates a window where players can escape the map.

**Why it happens:** Layered defense: collision grid for tile walls, ARENA clamp for edge case. When ARENA dimensions no longer match the map, the defense layers conflict.

**Consequences:** With wrong ARENA values: rubber-banding at incorrect boundary. Without ARENA clamp: players clip through walls during the tilemap loading race condition window.

**Prevention:**
1. Make ARENA values dynamic, derived from map metadata.
2. Keep the safety-net clamp but source it from map dimensions, not a global constant.
3. On server: ARENA values come from loaded map JSON (`mapJson.width * mapJson.tilewidth`).
4. On client: PredictionSystem receives arena dimensions when collision grid is set.
5. Before collision grid loads, use the larger map dimensions for clamp (not 800x608).

**Detection:** Rubber-banding near map edges; players briefly appearing outside map bounds on scene load.

**Phase:** Arena Enlargement phase.

**Confidence:** HIGH -- verified code paths in both Prediction.ts and GameRoom.ts.

---

### Pitfall 5: Multi-Stage Rounds (Best of 3) Require Full State Reset Without Room Recreation

**What goes wrong:** The current match lifecycle is single-round: WAITING -> PLAYING -> ENDED -> disconnect after 15s (line 639). For best-of-3, the room must reset to PLAYING state after a round ends without disconnecting clients, but the entire GameState was designed for single-use: `matchStartTime`, `matchEndTime`, `winner`, `matchStats`, player health, positions, obstacles -- all assume one lifecycle.

If you try to reuse the room by resetting schema fields, existing `onChange` listeners on the client may not fire (Colyseus delta sync only sends changes, not full state), and the `obstacles` MapSchema cannot be easily "rebuilt" without remove + re-add of every entry (which fires onRemove/onAdd for every obstacle, causing visual flicker).

**Why it happens:** Colyseus schema sync is delta-based. Resetting a string from "ended" to "playing" fires a change. But resetting a MapSchema (obstacles) to its initial state requires deleting and re-creating entries, which is expensive and triggers cascade of client-side listeners.

**Consequences:**
- Obstacles don't reset: destroyed obstacles from round 1 remain destroyed in round 2.
- Player health doesn't reset if the `onChange` doesn't fire (same value written).
- Client collision grid retains cleared tiles from previous round.
- Projectiles from end of round 1 carry into round 2 if not cleaned up.
- matchStats accumulate across rounds (may be desired or not).

**Prevention:**
1. Add a `roundState` Schema field separate from `matchState`. Match = best of 3, Round = individual fight.
2. Between rounds: clear all projectiles, reset all player health/position/velocity, rebuild obstacle MapSchema entries, reset collision grid.
3. Client must listen for a `roundReset` message and rebuild its local collision grid and tilemap obstacle tiles.
4. Add `roundNumber`, `roundWins` (MapSchema of sessionId -> wins) to GameState schema.
5. For obstacle reset: rather than delete+recreate, reset `hp` and `destroyed` fields on existing entries. This fires onChange and avoids onRemove/onAdd churn.
6. Client collision grid: add a `rebuildFromMap()` method that re-initializes from the original wall layer data.

**Detection:** Destroyed obstacles persisting between rounds; health not resetting; projectiles carrying over.

**Phase:** Multi-Stage Rounds phase. Must be planned carefully before implementation.

**Confidence:** HIGH -- derived from Colyseus schema behavior analysis and direct codebase reading.

---

### Pitfall 6: Camera Follow on GameScene Breaks Existing Coordinate Assumptions

**What goes wrong:** Currently, GameScene has no camera following -- the entire arena fits in the viewport. Adding `this.cameras.main.startFollow(localSprite)` means the camera scrolls, which breaks:
1. **Victory particle burst** at `(400, 300)` (VictoryScene line 165-167) -- these are world coordinates, but VictoryScene is an overlay on the paused GameScene. The particles appear at map center, not screen center.
2. **Status text** at `(10, 10)` (GameScene line 158) -- scrolls off screen with the camera.
3. **Eliminated/DC text** positioned at player world coords (correct, since these should follow players).
4. **Spectator camera** `this.cameras.main.centerOn()` (line 393) -- this already works with scrolling cameras, but spectator mode must switch from following local player to following spectator target smoothly.

**Why it happens:** Fixed-viewport games never need to distinguish between screen and world coordinates. Camera follow introduces this distinction for every game object.

**Consequences:** Status text, eliminated labels, and other "screen-fixed" elements scroll away with the camera. Particles render at wrong positions.

**Prevention:**
1. Move all screen-fixed GameScene elements (status text, debug info) to HUDScene.
2. GameScene status text should either be in HUDScene or use `setScrollFactor(0)` to ignore camera scroll.
3. For spectator mode: use `this.cameras.main.stopFollow()` then `startFollow(newTarget)` with lerp for smooth transition.
4. Camera bounds: `this.cameras.main.setBounds(0, 0, mapWidth, mapHeight)` to prevent seeing outside the arena.
5. Particles in GameScene should use world coordinates (they already do for gameplay effects). VictoryScene particles should use screen coordinates since VictoryScene is a separate scene with its own camera.

**Detection:** UI text scrolling offscreen; particles appearing at wrong location during spectator mode.

**Phase:** HD Resolution + Camera Follow phase.

**Confidence:** HIGH -- verified all coordinate usages in GameScene.ts and VictoryScene.ts.

---

## Moderate Pitfalls

Mistakes that cause bugs, regressions, or significant debugging time but are recoverable without rewrites.

---

### Pitfall 7: Tile Bleeding Artifacts When Using Real Tilesets

**What goes wrong:** Current maps use simple PIL-generated tilesets (4 columns, 8 tiles, 32x32). Switching to artist-provided tileset spritesheets will cause "tile bleeding" -- thin lines of adjacent tile pixels appearing at tile edges, especially when the camera is at fractional scroll positions (which happens constantly with smooth camera follow).

**Why it happens:** WebGL texture sampling bleeds into adjacent pixels when tiles are packed tightly in a spritesheet. Phaser's `pixelArt: true` helps (disables anti-aliasing), but does not fully prevent bleeding at non-integer camera positions.

**Prevention:**
1. **Extrude tilesets** using `tile-extruder` (npm package) before importing. This duplicates edge pixels outward by 1-2px.
2. When calling `map.addTilesetImage()`, specify margin and spacing parameters matching the extrusion: `addTilesetImage(name, key, tileWidth, tileHeight, margin, spacing)`.
3. Set `this.cameras.main.roundPixels = true` on the game camera to snap rendering to integer pixels.
4. Update Tiled map JSON to reference the extruded tileset with correct margin/spacing values.
5. Ensure all tilesets use power-of-2 dimensions when possible (reduces WebGL artifacts).

**Detection:** Thin colored lines between tiles, especially visible during camera movement.

**Phase:** Tileset Integration phase.

**Confidence:** HIGH -- well-documented Phaser 3 issue, verified via multiple sources and GitHub issues.

---

### Pitfall 8: Powerup Schema Sync Timing -- Client Sees Pickup Before/After Server

**What goes wrong:** Adding powerups as a new MapSchema (similar to obstacles) creates a sync timing issue. Server spawns powerup -> delta sync to client -> client renders it. Player walks over powerup -> server detects collision -> removes from schema -> delta sync to client -> client removes sprite. But with client prediction, the local player's predicted position may overlap the powerup 100ms+ before the server processes it. The powerup visually persists on screen even though the player "picked it up" locally.

Worse: if two players race for a powerup, both clients may show the pickup animation, but only one actually gets it server-side.

**Why it happens:** Server-authoritative powerups require the server to be the single source of truth, but client prediction puts the local player ahead of the server state. There is no client prediction for powerup collisions.

**Consequences:** Visual desync: powerup appears picked up but reappears briefly. Or powerup lingers after the player clearly touched it. Player confusion in competitive scenarios.

**Prevention:**
1. **Optimistic client-side pickup**: When local predicted position overlaps powerup, immediately hide it visually and play pickup sound/effect. If server confirms (removes from schema), done. If server doesn't remove (another player got it), re-show the powerup.
2. **Pickup cooldown**: Server adds a brief "claimed" state (100ms) to prevent double-claims.
3. **Schema design**: `PowerupState` with fields: `type`, `x`, `y`, `active` (boolean), `claimedBy` (string). Client watches `active` and `claimedBy` changes.
4. **Prediction integration**: Add powerup overlap check in PredictionSystem or GameScene update, flagging "locally claimed" powerups to hide immediately.
5. **Do NOT add powerup collision to the shared physics** -- keep it server-only with optimistic client display.

**Detection:** Powerups lingering after being walked over; two players seeing conflicting pickup animations.

**Phase:** Powerup System phase.

**Confidence:** MEDIUM -- standard multiplayer pattern, but untested in this specific codebase.

---

### Pitfall 9: Minimap Camera Performance and Rendering

**What goes wrong:** The naive approach to a minimap in Phaser 3 is to add a second camera with a small viewport and high zoom-out. However:
1. A second camera renders ALL visible game objects twice (doubling draw calls).
2. With 50x38 tile maps, particles, projectile trails, and player sprites, this can halve framerate.
3. The minimap camera's ignore list must be maintained manually -- every new game object must be added to the ignore list of either the main camera or the minimap camera.

**Why it happens:** Phaser cameras are not "views" -- they are full render passes. Each camera renders every game object in its viewport that isn't ignored.

**Consequences:** FPS drops from 60 to 30-40. Minimap shows HUD elements, particle effects, text labels unless explicitly ignored. Maintaining ignore lists becomes a maintenance burden.

**Prevention:**
1. **Use RenderTexture instead of a second camera.** Draw a simplified minimap to a RenderTexture periodically (every 200-500ms, not every frame).
2. Minimap RenderTexture only draws: tilemap background (baked once), colored dots for player positions, colored dots for powerups. No particles, no projectile trails, no text.
3. Position the RenderTexture game object in HUDScene (not GameScene) so it doesn't scroll with the camera. Use `setScrollFactor(0)` or place in HUDScene which has a fixed camera.
4. Player positions come from schema state (not sprite positions) for accuracy.
5. Update frequency: 4-5 times per second is sufficient for a minimap. This is 200-250ms intervals.

**Detection:** Framerate drops when minimap is visible; minimap showing particles or HUD text.

**Phase:** Minimap phase.

**Confidence:** HIGH -- well-documented Phaser 3 performance pattern.

---

### Pitfall 10: Scene Reset for Multi-Round -- 30+ Member Variables to Re-Initialize

**What goes wrong:** GameScene.create() already resets 30+ member variables (lines 104-136) for scene reuse. Multi-stage rounds add MORE state: round number, round scores, powerup sprites, minimap reference, music state, camera follow target. Every new feature adds variables that MUST be reset between rounds. Missing even one causes subtle bugs (e.g., projectile trails from round 1 orphaned in round 2).

**Why it happens:** Phaser scene.start() skips the constructor. This is a known project constraint already documented in memory. Adding features multiplies the risk.

**Consequences:** Ghost sprites, orphaned particles, stale event listeners, memory leaks, incorrect HUD state between rounds.

**Prevention:**
1. **Mandatory pattern**: Every new Map, Set, or game object reference added to GameScene must have a corresponding reset in create() AND a new round-reset handler.
2. Consider extracting state into a `GameSceneState` class with a single `reset()` method that zeros everything. This consolidates the reset in one place instead of 30+ individual assignments.
3. For round transitions (without full scene restart): create a `resetForNewRound()` method that clears gameplay state but preserves connection state (room, client, sessionId).
4. Add a debug assertion that checks for non-null game object references that shouldn't exist after reset.

**Detection:** Visual artifacts, sound effects from previous round, stale health values, particles without sprites.

**Phase:** Applies to ALL phases. Establish the pattern in the first phase.

**Confidence:** HIGH -- this is a documented v1.0 lesson with 30+ verified member variables in GameScene.ts.

---

### Pitfall 11: CollisionGrid Must Be Rebuilt for New Maps Per Round

**What goes wrong:** `CollisionGrid` is constructed once from the Tiled JSON wall layer data in both `GameRoom.onCreate()` and `GameScene.createTilemap()`. It uses `clearTile()` to mark destroyed obstacles. Between rounds in best-of-3, the collision grid retains cleared tiles. On the client, `PredictionSystem.collisionGrid` also retains cleared tiles.

If a new map is selected for round 2 (map rotation), the collision grid must be fully rebuilt. If the same map is reused, destroyed tiles must be restored.

**Why it happens:** CollisionGrid has `clearTile()` but no `restoreTile()` or `rebuildFromData()` method. The constructor is the only way to set tile data.

**Consequences:** Players walk through destroyed obstacles in round 2. Client and server collision grids disagree if only one is rebuilt.

**Prevention:**
1. Add `rebuild(wallLayerData, ...)` method to CollisionGrid that reinitializes the grid from raw data.
2. Server: call `this.collisionGrid.rebuild(...)` at round start.
3. Client: listen for round-reset message and rebuild collision grid from cached tilemap data.
4. Client tilemap: restore destroyed tile visuals by re-applying the original wall layer data to the Walls layer.
5. Ensure PredictionSystem gets the rebuilt collision grid via `setCollisionGrid()`.

**Detection:** Walking through where obstacles used to be in round 2.

**Phase:** Multi-Stage Rounds phase.

**Confidence:** HIGH -- verified CollisionGrid has no rebuild capability (collisionGrid.ts lines 37-108).

---

### Pitfall 12: Music System -- HTMLAudioElement Does Not Crossfade or Manage Multiple Tracks

**What goes wrong:** The current `AudioManager.playMusic()` (line 84-97) creates a raw `HTMLAudioElement` with no crossfade, no track management, and no integration with Phaser's audio system. Adding match music, lobby music, round-transition stingers, and victory music requires:
1. Crossfading between tracks (current code does hard stop + start).
2. Ducking music volume during SFX-heavy moments.
3. Pausing music when browser tab is inactive (HTMLAudioElement continues playing).
4. Managing multiple audio elements (stinger over music).

Using raw HTMLAudioElement bypasses Phaser's audio context management, which handles autoplay policies, tab visibility, and context suspension.

**Why it happens:** v1.0 had a single match music track with simple start/stop. Multiple tracks with transitions need a proper music manager.

**Consequences:** Music overlaps; tracks play over each other on scene transitions. Music continues playing in background tabs. No smooth transitions between lobby/match/victory music.

**Prevention:**
1. **Replace HTMLAudioElement with Phaser's SoundManager** for music. Load MP3s via `this.load.audio()` in BootScene preload. Play via `this.sound.add()` and `sound.play()`.
2. Phaser's WebAudioSoundManager handles autoplay policies, tab visibility, and context management automatically.
3. Keep jsfxr for SFX (it works well), but use Phaser audio for music.
4. Add crossfade method: fade out current track over 500ms while fading in new track.
5. Store music references in AudioManager, not as raw HTMLAudioElement.
6. Handle the `game.events.on('blur')` / `game.events.on('focus')` for tab switching (Phaser handles this for its audio system, but not for raw HTMLAudioElement).

**Detection:** Music playing in background tabs; hard cuts between tracks; multiple tracks playing simultaneously.

**Phase:** Music System phase.

**Confidence:** HIGH -- verified current AudioManager.ts uses raw HTMLAudioElement (line 88), bypassing Phaser audio.

---

### Pitfall 13: Camera Bounds Smaller Than Viewport Stops Scrolling

**What goes wrong:** If `camera.setBounds(0, 0, mapWidth, mapHeight)` is called but the map pixel dimensions are smaller than the viewport (possible during development or with small test maps), the camera stops scrolling entirely. This can also happen if bounds are set before the tilemap loads (race condition: bounds set to 0,0,0,0).

**Why it happens:** Phaser's camera bounds logic prevents scrolling when bounds are smaller than viewport. This is by design to prevent showing empty space, but it blocks development testing.

**Consequences:** Camera appears frozen; follows the player but doesn't actually move. Hard to debug because no error is thrown.

**Prevention:**
1. Set camera bounds AFTER tilemap loads and dimensions are known.
2. Guard: `if (mapPixelWidth > this.cameras.main.width) camera.setBounds(...)`.
3. For development: add a fallback that allows scrolling even with small maps.
4. Log map dimensions vs viewport dimensions on load for debugging.

**Detection:** Camera not following player despite `startFollow()` being called.

**Phase:** HD Resolution + Camera Follow phase.

**Confidence:** HIGH -- documented in official Phaser camera docs.

---

### Pitfall 14: Tiled JSON Format Change -- Multiple Tilesets and More Layers

**What goes wrong:** Current maps use a minimal Tiled JSON format: 2 layers (Ground, Walls), 1 tileset, tile IDs 0-8. Richer tilesets will have multiple tilesets (ground tiles, wall tiles, decoration tiles), more layers (Ground, Walls, Decorations, Spawn), and tile IDs in higher ranges. The current tileset loading code in GameScene (line 1112-1116) expects exactly one tileset and exactly two layers named "Ground" and "Walls".

More critically, the server's collision grid builder (GameRoom.ts lines 86-87) does `mapJson.layers.find(l => l.name === 'Walls')` -- if the layer name changes or additional collision layers are added, the server won't find them.

Also, obstacle tile IDs are hardcoded in `shared/obstacles.ts`: `WALL: 3, HEAVY: 4, MEDIUM: 5, LIGHT: 6`. Real tilesets will use completely different tile IDs.

**Why it happens:** v1.0 maps were generated programmatically with known simple structure. Artist-designed maps in Tiled will use different conventions.

**Consequences:** Map doesn't render (missing tileset image or wrong tileset name). Server can't build collision grid (wrong layer name). Obstacles don't register as destructible (wrong tile IDs).

**Prevention:**
1. **Define a map format contract**: Required layers: "Ground", "Walls". Optional: "Decorations", "Spawns". Document this for map design.
2. **Tile ID mapping**: Instead of hardcoded IDs, use Tiled custom properties on tiles (e.g., `type: "wall"`, `type: "destructible"`, `hp: 3`). Parse tile properties from the tileset data in the JSON.
3. **Multiple tileset support**: GameScene.createTilemap() must iterate `map.tilesets` and add all tilesets, not just one.
4. **Server map loading**: Parse tileset data from JSON to build the collision grid based on tile properties, not hardcoded IDs.
5. **Backward compatibility**: Support both old format (hardcoded IDs) and new format (tile properties) during migration.

**Detection:** Black/missing tiles; obstacles not blocking; server crash on map load.

**Phase:** Tileset Integration phase. Must be addressed before new maps are designed.

**Confidence:** HIGH -- verified hardcoded assumptions in `obstacles.ts`, `GameRoom.ts:86-87`, `GameScene.ts:1112-1116`.

---

### Pitfall 15: Powerup Entities Increase Schema Bandwidth

**What goes wrong:** Adding powerups as a MapSchema<PowerupState> to GameState adds schema data that is synced every patch (60Hz). If powerups have position (for bobbing animation), type, active state, and timer, each powerup adds ~20-30 bytes per patch. With 5-10 powerups per map, that is 150-300 bytes/patch extra bandwidth.

More importantly: powerup spawning/despawning triggers onAdd/onRemove callbacks on the client, which must create/destroy sprites. If powerups spawn frequently (every 10-15 seconds), this creates garbage collection pressure from sprite creation/destruction.

**Why it happens:** MapSchema is designed for entities that change state. Powerups that spawn and despawn are a good fit, but the frequency matters.

**Consequences:** Increased bandwidth; GC pauses from frequent sprite creation/destruction; potential desync if powerup schema update arrives during a critical combat moment.

**Prevention:**
1. **Static positions, dynamic state**: Define powerup spawn points in map metadata (not schema). Only sync active/inactive state and type via schema. This reduces bandwidth since positions don't change.
2. **Pre-create sprites**: Create all powerup sprites at map load (one per spawn point), toggle visibility based on schema state. No runtime sprite creation/destruction.
3. **Low sync frequency**: Powerup state changes are infrequent (spawn every 15-30s, pickup is instant). Schema handles this well since delta sync only sends on change.
4. **Alternative**: Use messages instead of schema for powerup events (`powerupSpawned`, `powerupCollected`). Simpler but loses automatic reconnection state sync.
5. Recommended: Use schema for persistence (reconnection gets current powerup state) but with static positions defined in map data.

**Detection:** Bandwidth increase visible in network monitoring; frame drops on powerup spawn.

**Phase:** Powerup System phase.

**Confidence:** MEDIUM -- standard multiplayer pattern, specific bandwidth impact untested.

---

## Minor Pitfalls

Mistakes that cause inconvenience, minor bugs, or small time losses.

---

### Pitfall 16: BootScene Preload Doesn't Account for New Music Assets

**What goes wrong:** `BootScene.preload()` loads spritesheets, particles, and images but NOT audio files (jsfxr generates SFX in create()). Adding MP3 music files requires loading them in preload, but the loading bar/progress indicator doesn't exist yet. Large MP3 files (2-5MB each for lobby music, match music, victory music) can cause a noticeable loading delay with no feedback.

**Why it happens:** v1.0 had no preloaded audio files -- everything was jsfxr-generated at runtime.

**Consequences:** Multi-second blank screen while music loads; no loading progress for the user.

**Prevention:**
1. Add music files to BootScene.preload(): `this.load.audio('match_music', 'audio/match_music.mp3')`.
2. Add a simple loading bar (Phaser progress event) to show asset loading progress.
3. Consider OGG format alongside MP3 for smaller file sizes and broader codec support.
4. Keep total music payload under 5MB for reasonable load times.

**Detection:** Slow initial load with no visual feedback.

**Phase:** Music System phase.

**Confidence:** HIGH -- verified BootScene.preload() loads no audio files.

---

### Pitfall 17: Spectator Camera Follow Needs Smooth Transition Between Targets

**What goes wrong:** Current spectator mode does `this.cameras.main.centerOn(targetSprite.x, targetSprite.y)` every frame (GameScene line 393). This works without camera scrolling because centerOn is a no-op when the viewport covers the whole arena. With camera follow in larger arenas, switching spectator targets causes an instant camera jump to the new player, which is disorienting.

**Why it happens:** `centerOn` is an instant snap, not a smooth transition.

**Consequences:** Jarring camera jump when pressing Tab to cycle spectator targets.

**Prevention:**
1. Use `this.cameras.main.startFollow(targetSprite, true, 0.1, 0.1)` with lerp values for smooth camera tracking.
2. On target switch: `stopFollow()`, start a tween or pan to new target over 300-500ms, then `startFollow(newTarget)`.
3. Alternative: `camera.pan(x, y, duration)` for the transition, then startFollow.

**Detection:** Sudden camera teleport on spectator target switch.

**Phase:** Camera Follow phase.

**Confidence:** HIGH -- verified current spectator code at GameScene.ts line 393.

---

### Pitfall 18: Round Transition Needs HUD State Reset

**What goes wrong:** HUDScene receives room, localSessionId, and localRole in create() data (line 78). Between rounds in best-of-3, HUDScene must: reset health bars, clear kill feed, reset cooldown display, reset spectator state, show round number, update round score display. But HUDScene only receives data on create() -- there is no mechanism for round resets without stopping and relaunching the scene.

Stopping and relaunching HUDScene causes a visual flash (scene destroyed and recreated). It also requires re-registering all event listeners with GameScene.

**Why it happens:** HUDScene was designed for single-round lifecycle.

**Consequences:** Stale kill feed entries from previous round; health bars showing dead players as dead; cooldown not reset; spectator mode stuck on.

**Prevention:**
1. Add a `resetForNewRound()` public method to HUDScene that clears all gameplay state while preserving the room reference and UI structure.
2. GameScene calls `this.scene.get('HUDScene').resetForNewRound()` on round transition.
3. HUDScene.resetForNewRound(): clear kill feed entries, reset health bars, reset cooldown, hide spectator HUD, show "Round X" banner.
4. Add round score display to HUDScene that persists between rounds.

**Detection:** Kill feed showing kills from previous round; dead player indicators persisting.

**Phase:** Multi-Stage Rounds phase.

**Confidence:** HIGH -- verified HUDScene lifecycle at lines 78-152.

---

### Pitfall 19: Map JSON Path Resolution Differs Between Server and Client

**What goes wrong:** Server loads map JSON via filesystem: `path.join(__dirname, '../../../client/public', this.mapMetadata.file)` (GameRoom.ts line 84). Client loads via Phaser loader: `this.load.tilemapTiledJSON(mapKey, mapFile)` where mapFile is relative to public dir. With larger/more maps and potentially different directory structures, these paths can diverge. If map files move (e.g., into a `maps/v2/` subdirectory), the server path breaks while the client path works, or vice versa.

**Why it happens:** Server uses Node.js filesystem paths; client uses HTTP-relative paths. These are fundamentally different resolution mechanisms.

**Consequences:** Server crashes on map load ("ENOENT: no such file or directory"); client shows empty map.

**Prevention:**
1. Keep map file path in shared `MapMetadata.file` as the single source of truth.
2. Server map path resolution: compute once in a config module, not inline in GameRoom.
3. During development: add existence check with helpful error message before `JSON.parse(fs.readFileSync(...))`.
4. Consider embedding map data in shared code for small maps, or serving from a known base path.

**Detection:** Server crash on GameRoom.onCreate(); client showing empty world.

**Phase:** Tileset Integration / Map Format phase.

**Confidence:** HIGH -- verified path construction at GameRoom.ts line 84.

---

### Pitfall 20: Phaser Game Config Resolution Must Be Set Before Game Creation

**What goes wrong:** `main.ts` creates the Phaser.Game with `width: 800, height: 600` (line 10-11). Changing to 1280x720 requires changing this config. However, Phaser's width/height cannot be changed after game creation. The scale mode `Phaser.Scale.FIT` will scale the canvas to fit the container, but the internal resolution is fixed at creation time.

**Why it happens:** Phaser treats game resolution as immutable after `new Phaser.Game(config)`.

**Consequences:** If you forget to update main.ts, everything renders at 800x600 even though individual scenes try to use 1280x720 coordinates. The game will look correct but be lower resolution than intended.

**Prevention:**
1. Update `width: 1280, height: 720` in main.ts config.
2. Update `Phaser.Scale.FIT` mode to scale to container.
3. All scenes should reference `this.cameras.main.width` and `this.cameras.main.height` instead of hardcoded values.
4. Test that the canvas DOM element actually renders at the expected resolution.

**Detection:** Blurry rendering; coordinates don't match expected values; canvas element inspected in devtools shows wrong size.

**Phase:** HD Resolution phase -- must be the very first change.

**Confidence:** HIGH -- verified main.ts config at lines 9-11.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| HD Resolution (1280x720) | ARENA constant breaks physics (P1); HUD mispositioned (P2); VictoryScene broken (P3); main.ts config (P20) | Update main.ts first, then ARENA -> dynamic, then all hardcoded coords |
| Camera Follow / Scrolling | Camera breaks coordinate assumptions (P6); bounds < viewport blocks scroll (P13); spectator jump (P17) | Set bounds after tilemap load; move fixed UI to HUDScene; use lerp for follow |
| Arena Enlargement (50x38) | Prediction clamp wrong (P4); CollisionGrid rebuild needed (P11) | Dynamic ARENA from map metadata; add rebuild() to CollisionGrid |
| Multi-Stage Rounds | State reset without recreation (P5); scene reset (P10); HUD reset (P18); collision grid reset (P11) | Add roundState schema; resetForNewRound() methods; CollisionGrid.rebuild() |
| Powerup System | Sync timing desync (P8); bandwidth increase (P15) | Optimistic client pickup; static positions + schema state only |
| Minimap | Camera performance (P9) | RenderTexture at reduced update rate, not second camera |
| Tileset Integration | Tile bleeding (P7); Tiled format assumptions (P14); path resolution (P19) | Extrude tilesets; define format contract; tile properties over hardcoded IDs |
| Music System | HTMLAudioElement limitations (P12); BootScene preload (P16) | Switch to Phaser SoundManager for music; add loading bar |
| HUD Overhaul | All hardcoded positions (P2) | Anchor-based positioning from viewport dimensions |

---

## Recommended Phase Ordering (Risk-Based)

The pitfalls suggest this implementation order to minimize rework:

1. **HD Resolution + Camera Follow** (P1, P2, P3, P4, P6, P13, P20) -- Foundation change. Every other feature depends on correct resolution and camera behavior. Highest risk of cascading breakage if done later.

2. **Tileset Integration + Map Format** (P7, P14, P19) -- Changes the map data contract. Must be done before designing new larger maps.

3. **Arena Enlargement** (P4, P11) -- Depends on camera follow working and new map format.

4. **Multi-Stage Rounds** (P5, P10, P11, P18) -- Complex state management. Depends on arena/resolution being stable.

5. **Powerup System** (P8, P15) -- New entity type. Depends on map format and round lifecycle.

6. **Minimap** (P9) -- Depends on camera follow and larger arenas existing.

7. **Music System** (P12, P16) -- Independent. Can be done anytime but benefits from final scene flow being stable.

8. **HUD Overhaul** (P2) -- Partially addressed in HD Resolution phase; final polish after all features are in.

---

## Sources

- Phaser 3 Camera documentation: [Camera API](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera), [Camera Concepts](https://docs.phaser.io/phaser/concepts/cameras)
- Phaser 3 Render Texture: [Render Texture API](https://docs.phaser.io/api-documentation/class/gameobjects-rendertexture)
- Tile bleeding: [sporadic-labs/tile-extruder](https://github.com/sporadic-labs/tile-extruder), [Phaser issue #3352](https://github.com/photonstorm/phaser/issues/3352)
- Phaser 3 Audio: [Audio Concepts](https://docs.phaser.io/phaser/concepts/audio), [Audio loop issue #6702](https://github.com/phaserjs/phaser/issues/6702)
- Phaser Scale Manager: [ScaleManager API](https://docs.phaser.io/api-documentation/class/scale-scalemanager)
- Colyseus state best practices: [Colyseus State](https://docs.colyseus.io/state), [Best Practices](https://docs.colyseus.io/state/best-practices)
- Codebase analysis: All file references are to the current Banger codebase at `/Users/jonasbrandvik/Projects/banger-game/`

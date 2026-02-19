# Phase 9: Multi-Stage Rounds - Research

**Researched:** 2026-02-14
**Domain:** Server-authoritative best-of-3 round system with in-room state reset and Phaser camera transitions
**Confidence:** HIGH

## Summary

This phase adds best-of-3 match structure to an existing single-stage game. The critical architectural decision is whether to reset state within the existing GameRoom or create a new room per stage. Based on analysis of the codebase and Colyseus 0.15 constraints, **in-room state reset is the correct approach** -- creating new rooms would break session IDs (documented Phase 5 issue), lose reconnection tokens, and add unnecessary latency between stages.

The main technical challenges are: (1) safely resetting Colyseus Schema collections between stages without triggering known ArraySchema bugs, (2) swapping Phaser tilemaps mid-scene without memory leaks, and (3) orchestrating a smooth visual transition (zoom out, stage intro overlay, zoom in) that feels polished while keeping the server authoritative over stage progression.

**Primary recommendation:** Extend the existing GameRoom with a stage state machine (WAITING -> PLAYING -> STAGE_END -> TRANSITION -> PLAYING -> ... -> MATCH_END). Reset players/projectiles/obstacles between stages by iterating and deleting/re-initializing individual items rather than using .clear() or setState(). Use a dedicated `StageIntroScene` overlay (launched like VictoryScene) for between-stage transitions.

## Standard Stack

### Core (Already In Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Colyseus | 0.15.57 | Server room state sync | Already pinned, handles multi-stage via state mutation |
| Phaser 3 | 3.90 | Client rendering, camera effects | zoomTo, fade, pan all built-in |
| @colyseus/schema | (bundled) | State serialization | MapSchema/ArraySchema for game entities |

### No New Dependencies Required
This phase requires zero new packages. All functionality is achievable with existing Colyseus room state management and Phaser camera/scene APIs.

## Architecture Patterns

### Recommended Approach: Single Room, Multi-Stage State Machine

**Why not create new rooms per stage:**
- Session IDs change between rooms (documented Phase 5 lesson: "Role assignment: GameRoom reads options.role from client (NOT sessionId lookup -- IDs change between rooms)")
- Reconnection tokens become invalid when room changes
- Network latency for room transition (create room + 3 clients join = ~1-2s minimum)
- Clients must leave/join which can fail, causing player loss mid-match

**Why in-room reset is correct:**
- Session IDs remain stable across stages
- Reconnection tokens stay valid
- No network round-trip for room transition
- Server maintains authoritative control over stage flow
- HUD can persist across stages (just reset score display)

### State Machine Extension

Current: `WAITING -> PLAYING -> ENDED`

New: `WAITING -> PLAYING -> STAGE_END -> STAGE_TRANSITION -> PLAYING -> ... -> MATCH_END`

```
WAITING          -- All 3 players joined
  |
PLAYING          -- Stage N in progress (identical to current PLAYING)
  |
STAGE_END        -- Stage winner determined, freeze game (2s)
  |
STAGE_TRANSITION -- Server resets state, loads new map (3-4s client transition)
  |
  +---> PLAYING  -- Next stage starts (if no match winner yet)
  |
MATCH_END        -- Best-of-3 winner determined, show final results
```

### Schema Additions

Add to `GameState`:
```typescript
@type("uint8") currentStage: number = 1;          // 1, 2, or 3
@type("uint8") paranStageWins: number = 0;         // Paran side wins
@type("uint8") guardianStageWins: number = 0;      // Guardian side wins
@type("string") matchState: string = "waiting";     // Extended with new states
// mapName already exists and can be changed per stage
```

### Recommended Project Structure Changes

```
server/src/
  rooms/
    GameRoom.ts           # Extended with stage logic (resetStage, nextStage methods)
  schema/
    GameState.ts          # Add currentStage, paranStageWins, guardianStageWins

client/src/
  scenes/
    GameScene.ts          # Add stage transition handling, tilemap swap
    StageIntroScene.ts    # NEW: Overlay showing "Stage 2 - Brick Fortress" + score
    HUDScene.ts           # Add round score display (e.g., "1-0")
    VictoryScene.ts       # Enhanced with per-stage breakdown

shared/
  maps.ts                 # No change needed (3 maps already exist)
```

### Pattern 1: Server-Side Stage Reset

**What:** Server resets all game entities between stages without calling setState()
**When to use:** Every stage transition
**Why critical:** Calling setState() resets the binary patch algorithm, breaking delta sync

```typescript
// Source: Colyseus 0.15 docs (https://0-15-x.docs.colyseus.io/server/room/)
// WARNING: Do NOT call this.setState() again. Mutate existing state directly.

private resetStage(newMapName: string): void {
  // 1. Clear projectiles (ArraySchema) - splice backwards to avoid index issues
  while (this.state.projectiles.length > 0) {
    this.state.projectiles.pop();
  }

  // 2. Clear obstacles (MapSchema) - iterate and delete individually
  //    Do NOT use .clear() - has sync issues in Colyseus 0.15
  const obstacleKeys: string[] = [];
  this.state.obstacles.forEach((_, key) => obstacleKeys.push(key));
  for (const key of obstacleKeys) {
    this.state.obstacles.delete(key);
  }

  // 3. Reset players (keep in MapSchema, reset properties)
  this.state.players.forEach((player, sessionId) => {
    const stats = CHARACTERS[player.role];
    player.health = stats.maxHealth;
    player.vx = 0;
    player.vy = 0;
    player.inputQueue = [];
    player.lastFireTime = 0;
    player.lastProcessedSeq = 0;
    // Set spawn position from new map
    // ... (based on role and new map metadata)
  });

  // 4. Load new map collision data
  this.loadMap(newMapName);
  this.state.mapName = newMapName;

  // 5. Re-initialize obstacles from new map
  this.initializeObstacles();
}
```

### Pattern 2: Client-Side Tilemap Swap

**What:** Destroy old tilemap and layers, load and create new tilemap mid-scene
**When to use:** When server changes mapName between stages
**Critical:** Must destroy old layers to prevent memory leaks and z-order issues

```typescript
// In GameScene - called when server signals stage transition
private swapTilemap(newMapKey: string): void {
  // 1. Destroy existing tilemap layers
  if (this.wallsLayer) {
    this.wallsLayer.destroy();
    this.wallsLayer = null;
  }
  if (this.wallFrontsLayer) {
    this.wallFrontsLayer.destroy();
    this.wallFrontsLayer = null;
  }
  // Destroy ground layer too (store reference)
  // Note: Phaser 3.90 properly cleans up layer cache on destroy (fixed in 3.16+)

  // 2. Reset collision grid
  this.collisionGrid = null;
  if (this.prediction) {
    this.prediction.setCollisionGrid(null);
  }

  // 3. Load new tileset image if not cached
  const tilesetInfo = MAP_TILESET_INFO[newMapKey];
  if (!this.textures.exists(tilesetInfo.key)) {
    this.load.image(tilesetInfo.key, tilesetInfo.image);
  }

  // 4. Load new tilemap JSON (may already be in cache from BootScene)
  if (!this.cache.tilemap.has(newMapKey)) {
    this.load.tilemapTiledJSON(newMapKey, mapFile);
  }

  this.load.once('complete', () => {
    this.createTilemap(newMapKey);
  });
  this.load.start();
}
```

### Pattern 3: Stage Intro Overlay Scene

**What:** A Phaser overlay scene (launched, not started) showing stage info between rounds
**When to use:** During STAGE_TRANSITION state
**Pattern:** Same as VictoryScene (overlay on paused GameScene)

```typescript
// StageIntroScene - launched as overlay
export class StageIntroScene extends Phaser.Scene {
  create(data: {
    stageNumber: number;
    arenaName: string;
    paranWins: number;
    guardianWins: number;
  }) {
    // Dark overlay background
    // "STAGE 2" large text
    // "Brick Fortress" arena name
    // Score: "Paran 1 - 0 Guardians"
    // Auto-dismiss after 3 seconds (server controls timing)
  }
}
```

### Pattern 4: Zoom Transition (DISP-05)

**What:** Smooth camera zoom out -> stage intro -> zoom in on new arena
**When to use:** Between stages
**API:** Phaser Camera.zoomTo(zoom, duration, ease, force, callback)

```typescript
// Source: Phaser 3 Camera API (https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera)

// Phase 1: Zoom out + fade when stage ends
const cam = this.cameras.main;
cam.zoomTo(0.5, 1000, 'Sine.easeInOut');
cam.fade(1000, 0, 0, 0);  // Fade to black

// Phase 2: After tilemap swap, zoom in on new arena
cam.fadeIn(500, 0, 0, 0);  // Fade from black
cam.zoomTo(2.0, 800, 'Sine.easeInOut');
```

### Pattern 5: Arena Selection Without Repeats

**What:** Pick 3 unique arenas for a best-of-3 match from the pool of 3 maps
**When to use:** At match start (pre-select all 3 arenas)

```typescript
// Shuffle MAPS array indices at match start, use stage index to pick
private stageArenas: MapMetadata[] = [];

private selectArenas(): void {
  // Fisher-Yates shuffle of indices [0, 1, 2]
  const indices = [0, 1, 2];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  this.stageArenas = indices.map(i => MAPS[i]);
}
```

### Anti-Patterns to Avoid

- **Calling setState() between stages:** Resets the binary patch algorithm, breaks delta sync for all connected clients
- **Using ArraySchema.clear():** Known bug in Colyseus 0.15 -- clear + push causes onAdd to fire twice on clients (schema issue #107)
- **Using MapSchema.clear():** May not trigger onRemove properly on clients in 0.15 -- iterate and delete individually instead
- **Creating new rooms per stage:** Session IDs change between rooms, reconnection tokens invalidated, network latency added
- **Restarting GameScene between stages:** Loses room reference, WebSocket connection, all state listeners. Reset within the scene instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera transitions | Custom tween system | `cam.zoomTo()`, `cam.fade()`, `cam.pan()` | Built into Phaser, handles edge cases, supports easing |
| State serialization | Manual JSON sync for round data | Colyseus Schema `@type` decorators | Binary delta encoding is already set up, just add fields |
| Map shuffling | Complex rotation logic | Simple Fisher-Yates shuffle at match start | 3 maps = 6 possible orderings, trivial to pre-compute |
| Stage timer | setTimeout for stage transitions | Colyseus `this.clock.setTimeout()` | Server clock survives reconnection, authoritative timing |
| Overlay scenes | Custom DOM overlay | Phaser `scene.launch()` overlay pattern | Already used for VictoryScene and HUDScene |

**Key insight:** Every tool needed for this phase already exists in the stack. The complexity is in orchestrating the sequence correctly, not in building new systems.

## Common Pitfalls

### Pitfall 1: ArraySchema Clear Bug
**What goes wrong:** Using `this.state.projectiles.clear()` or splicing all then pushing causes `onAdd` to fire twice on clients
**Why it happens:** Colyseus 0.15 schema issue #107 -- clear operation is encoded twice (encodeAll + encode) for existing clients
**How to avoid:** Use `while (arr.length > 0) arr.pop()` to drain arrays. Never clear-then-push in the same tick.
**Warning signs:** Client shows duplicate projectiles or ghost entities after stage transition

### Pitfall 2: setState() Between Stages
**What goes wrong:** Calling `this.setState(new GameState())` after stage 1 resets the binary patch algorithm
**Why it happens:** Colyseus docs explicitly warn "Do not call setState() for every update"
**How to avoid:** Mutate existing state properties directly. Reset fields individually on the existing state object.
**Warning signs:** All clients receive full state dump instead of delta after stage transition

### Pitfall 3: Stale Client Listeners After Stage Reset
**What goes wrong:** Client's `onAdd` handlers for players fire again after reset (player objects already exist but properties change)
**Why it happens:** If you delete and re-add players to MapSchema, client treats them as new entities
**How to avoid:** Do NOT delete/re-add players between stages. Reset player properties in-place (health, position, velocity). Players persist across stages.
**Warning signs:** Duplicate player sprites, lost onChange handlers, prediction system re-initialized mid-match

### Pitfall 4: Tilemap Layer Name Collision
**What goes wrong:** Creating a new tilemap with layers named "Walls", "Ground" etc. fails because old references exist
**Why it happens:** Phaser tilemap layer cache retains names (fixed in 3.16+ but old layers still exist in display list)
**How to avoid:** Call `tilemap.destroy()` which destroys all TilemapLayers and clears the cache. Or destroy individual layers then create fresh tilemap.
**Warning signs:** Console error about layer name already existing, invisible map, wrong collision data

### Pitfall 5: HUD and Reconnection During Stage Transition
**What goes wrong:** Player disconnects during stage transition, reconnects, gets stale stage data
**Why it happens:** Transition state is brief (~3s), reconnection may land in wrong stage state
**How to avoid:** On reconnect, check `currentStage` and `matchState` -- if in STAGE_TRANSITION, wait for PLAYING. Server should include stage info in reconnection state.
**Warning signs:** Player spawns on wrong map, HUD shows wrong score, collision grid from previous stage

### Pitfall 6: Ghost Entities After Stage Reset
**What goes wrong:** Projectile sprites, eliminated text, DC labels from previous stage remain visible
**Why it happens:** Client cleanup only triggers on `onRemove` callbacks. If reset ordering is wrong, sprites linger.
**How to avoid:** On client side, when `matchState` changes to `STAGE_TRANSITION`, explicitly clear ALL game object maps (sprites, texts, trails, particles). Don't rely solely on Schema callbacks.
**Warning signs:** Floating "ELIMINATED" text over new spawn positions, projectile sprites stuck at old positions

### Pitfall 7: Match Timer Not Resetting
**What goes wrong:** Stage 2 starts with remaining time from stage 1
**Why it happens:** `matchStartTime` and `serverTime` carry over from previous stage
**How to avoid:** Reset `matchStartTime = serverTime` at the start of each new stage, not just the first.
**Warning signs:** Stage 2 starts with "2:30 remaining" instead of "5:00"

## Code Examples

### Server: Stage End Detection (replaces current endMatch)

```typescript
// In GameRoom - modified win condition handler
private endStage(stageWinner: string): void {
  // Drain all input queues
  this.state.players.forEach(p => { p.inputQueue = []; });

  // Track stage win
  if (stageWinner === "paran") {
    this.state.paranStageWins++;
  } else {
    this.state.guardianStageWins++;
  }

  // Check for match winner (best of 3)
  if (this.state.paranStageWins >= 2 || this.state.guardianStageWins >= 2) {
    this.endMatch(stageWinner);
    return;
  }

  // Set stage end state
  this.state.matchState = "stage_end";

  // Broadcast stage result
  this.broadcast("stageEnd", {
    stageWinner,
    stageNumber: this.state.currentStage,
    paranWins: this.state.paranStageWins,
    guardianWins: this.state.guardianStageWins,
  });

  // After brief pause, begin transition
  this.clock.setTimeout(() => {
    this.beginStageTransition();
  }, 2000);
}
```

### Server: Stage Transition

```typescript
private beginStageTransition(): void {
  this.state.matchState = "stage_transition";
  this.state.currentStage++;

  // Select next arena
  const nextMap = this.stageArenas[this.state.currentStage - 1];

  // Reset all game entities
  this.resetStage(nextMap);

  // Broadcast transition info for client overlay
  this.broadcast("stageTransition", {
    stageNumber: this.state.currentStage,
    arenaName: nextMap.displayName,
    mapName: nextMap.name,
    paranWins: this.state.paranStageWins,
    guardianWins: this.state.guardianStageWins,
  });

  // After transition period, start next stage
  this.clock.setTimeout(() => {
    this.startStage();
  }, 4000); // 4s for client to load new map + show intro
}

private startStage(): void {
  this.state.matchState = "playing";
  this.state.matchStartTime = this.state.serverTime;
  this.broadcast("stageStart", {
    stageNumber: this.state.currentStage,
    startTime: this.state.serverTime,
  });
}
```

### Client: Handling Stage Transition

```typescript
// In GameScene - listen for stage transition messages
this.room.onMessage("stageEnd", (data) => {
  // Lock controls
  this.controlsLocked = true;

  // Camera: zoom out slowly
  const cam = this.cameras.main;
  cam.zoomTo(0.5, 1500, 'Sine.easeInOut');

  // Audio: stage end sound
  if (this.audioManager) this.audioManager.playSFX('match_end_fanfare');
});

this.room.onMessage("stageTransition", (data) => {
  // Fade to black
  this.cameras.main.fade(500, 0, 0, 0, false, (_cam: any, progress: number) => {
    if (progress === 1) {
      // Clean up old tilemap and game objects
      this.cleanupStageVisuals();

      // Swap to new tilemap
      this.swapTilemap(data.mapName);

      // Launch stage intro overlay
      this.scene.launch("StageIntroScene", {
        stageNumber: data.stageNumber,
        arenaName: data.arenaName,
        paranWins: data.paranWins,
        guardianWins: data.guardianWins,
      });
    }
  });
});

this.room.onMessage("stageStart", (data) => {
  // Dismiss stage intro
  this.scene.stop("StageIntroScene");

  // Fade in from black
  this.cameras.main.fadeIn(500, 0, 0, 0);

  // Overview zoom animation (same as current match start)
  this.startMatchOverview();
});
```

### HUD: Round Score Display

```typescript
// In HUDScene - add persistent score display
private roundScoreText: Phaser.GameObjects.Text | null = null;

private createRoundScore(): void {
  // Display next to match timer at top center
  this.roundScoreText = this.add.text(this.W * 0.5, this.H * 0.07, '0 - 0', {
    fontSize: '16px',
    color: Colors.text.primary,
    fontFamily: 'monospace',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  });
  this.roundScoreText.setOrigin(0.5, 0.5);
  this.roundScoreText.setDepth(200);
}

// Update via Schema listener on paranStageWins / guardianStageWins
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create new room per round | Reset state in-place within same room | Colyseus 0.14+ best practice | Preserves session IDs, reconnection, reduces latency |
| ArraySchema.clear() | Pop items individually | Colyseus 0.15 (known bug #107) | Prevents double onAdd callbacks |
| MapSchema.clear() | Iterate + delete individually | Colyseus 0.15 (sync issues) | Ensures onRemove fires on all clients |
| Phaser scene.start for transitions | Overlay scenes (scene.launch) | Phaser 3 pattern | Keeps room connection alive, no scene re-init |

**Deprecated/outdated:**
- `setState()` for round resets: Never call after initial onCreate() -- resets binary patch algorithm
- `DynamicTilemapLayer` / `StaticTilemapLayer`: Merged into single `TilemapLayer` in Phaser 3.50+

## Open Questions

1. **Match timer per stage vs. overall**
   - What we know: Current match timer is 5 minutes total
   - What's unclear: Should each stage have its own 5-minute timer, or should total match time be shared?
   - Recommendation: Each stage gets its own timer (reset matchStartTime per stage). A 5-minute stage that times out = guardian win for that stage. This keeps each stage self-contained.

2. **Player stats: per-stage or cumulative?**
   - What we know: Current stats (kills, damage, accuracy) are tracked per match
   - What's unclear: Should stats reset per stage or accumulate across the whole best-of-3?
   - Recommendation: Accumulate across all stages (more interesting final stats). Add per-stage snapshot for the victory screen breakdown.

3. **What happens if a player disconnects between stages?**
   - What we know: Current reconnection grace is 60 seconds. Stage transition is ~4-6 seconds.
   - What's unclear: If player is disconnected during STAGE_TRANSITION, should they auto-reconnect into the next stage?
   - Recommendation: Keep existing 60s reconnection grace. During STAGE_TRANSITION, disconnected players stay in room with connected=false. When they reconnect, they receive current state including new map.

4. **Tilemap preloading strategy**
   - What we know: Currently, tilemap JSON and tileset image are loaded on-demand per map
   - What's unclear: Should all 3 arena tilemaps be preloaded at match start?
   - Recommendation: Preload all 3 tileset images and tilemap JSONs when entering GameScene (they are small files: ~50KB each). This eliminates any load delay during stage transitions.

## Sources

### Primary (HIGH confidence)
- Colyseus 0.15 Room API docs (https://0-15-x.docs.colyseus.io/server/room/) - setState warning, simulation interval, broadcast
- Phaser 3.90 Camera API (https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera) - zoomTo, fade, fadeIn, fadeOut, pan signatures
- Codebase analysis: GameRoom.ts, GameState.ts, GameScene.ts, VictoryScene.ts, HUDScene.ts, LobbyScene.ts, maps.ts

### Secondary (MEDIUM confidence)
- Colyseus schema issue #107 (https://github.com/colyseus/schema/issues/107) - ArraySchema clear+push double onAdd bug
- Colyseus issue #641 (https://github.com/colyseus/colyseus/issues/641) - ArraySchema known issues tracker
- Colyseus discussion (https://discuss.colyseus.io/topic/529/mapschema-clear) - MapSchema.clear() sync issues
- Phaser issue #4319 (https://github.com/photonstorm/phaser/issues/4319) - TilemapLayer.destroy() cache cleanup (fixed in 3.16)

### Tertiary (LOW confidence)
- None. All findings verified through official docs or codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing tools
- Architecture (in-room reset): HIGH - verified Colyseus docs, confirmed by Phase 5 learnings about session ID changes
- Pitfalls (ArraySchema/MapSchema): HIGH - verified via GitHub issues with reproduction steps
- Camera transitions: HIGH - verified Phaser API docs for 3.90
- Stage intro overlay: HIGH - follows established VictoryScene pattern in codebase
- Tilemap swapping: MEDIUM - verified destroy() is safe in 3.90, but mid-scene tilemap swap is less commonly documented

**Research date:** 2026-02-14
**Valid until:** Stable -- Colyseus 0.15 and Phaser 3.90 are pinned versions, findings won't change

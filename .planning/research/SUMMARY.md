# Project Research Summary

**Project:** Banger v2.0 Arena Evolution
**Domain:** Multiplayer Game Enhancement (Phaser 3 + Colyseus)
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

The v2.0 milestone adds HD resolution (1280x720), scrollable camera-followed arenas (50x38 tiles vs 25x19), best-of-3 multi-stage matches, powerup system, minimap, new tileset rendering, music system, and icon-based HUD overhaul. The remarkable finding is that **zero new npm dependencies are required** — every feature is implementable using Phaser 3.90's built-in APIs and the existing Colyseus 0.15 architecture.

The recommended approach treats HD viewport and camera follow as the **foundational change** that cascades into all other features. Without camera scrolling working correctly, larger arenas are unplayable. The camera foundation must be built first, followed by new tilesets/maps, then the multi-stage match system, and finally enhancement layers (powerups, minimap, music, HUD polish). This dependency-driven ordering prevents rework: attempting multi-stage matches before larger arenas are functional would require rewriting the state machine once maps change.

The key risks are architectural, not technological: (1) the hardcoded `ARENA = {800, 608}` constant must become per-map metadata or edge clamping breaks physics, (2) 30+ hardcoded HUD pixel positions must become viewport-relative, (3) multi-stage match lifecycle requires comprehensive state reset without room recreation to avoid Colyseus session ID issues, and (4) Phaser scene reuse means every new feature adds member variables that MUST be reset in `create()`. All risks are mitigatable through patterns documented in the research.

## Key Findings

### Recommended Stack

No new dependencies required. The existing stack (Phaser 3.90, Colyseus 0.15.57 server / 0.15.28 client, Vite 5, TypeScript 5, Express 4, jsfxr 1.4) already provides every needed capability. HD viewport is a game config change. Camera follow is Phaser's built-in `camera.startFollow()`. Larger arenas use the same tilemap pipeline with bigger JSON files. Multi-stage rounds are pure server-side state machine logic using existing Schema patterns. Powerups follow the same Schema + MapSchema pattern as projectiles and obstacles. Minimap uses Phaser's native multi-camera API. Music uses either HTMLAudioElement with custom crossfade or Phaser's built-in Sound Manager. HUD icons use standard `this.load.image()`.

**Core technologies (unchanged):**
- **Phaser 3.90** — Built-in camera follow (`startFollow`, `setBounds`), multi-camera (`cameras.add`), tilemap scaling, Sound Manager — all features needed are native
- **Colyseus 0.15** — State machine extensions use existing Schema patterns; PowerupState follows same pattern as ProjectileState/ObstacleState
- **Vite 5** — Asset serving unchanged; tileset PNGs and music MP3s go in `client/public/` and load via Phaser loader
- **TypeScript shared/ modules** — Powerup definitions, arena bounds, and map metadata are additive shared types

**Confidence:** HIGH — all recommendations verified against Phaser 3 documentation and existing codebase patterns.

### Expected Features

**Must have (table stakes):**
- **Camera follow with smooth lerp** — Players must see their character in larger arenas; instant snap feels jarring
- **World bounds matching arena size** — Camera must not scroll past map edges into void
- **HD viewport resolution** — Current 800x600 is small on modern screens; 1280x720 provides appropriate scale for 32px pixel art
- **Minimap showing player positions** — In scrollable arenas, global awareness is essential for tactical play
- **Round indicator / score display** — Best-of-3 needs visible round number and cumulative score
- **Music during matches** — Silent arenas feel unfinished in a polished game

**Should have (competitive differentiators):**
- **Powerup spawning system** — Adds strategic depth via risk/reward positioning and map control
- **Camera deadzone** — Small dead area prevents camera jitter, polished feel
- **Per-arena music tracks** — Different music per map creates distinct atmosphere
- **Music crossfade on transitions** — Smooth 0.5s fades prevent jarring audio cuts
- **Icon-based HUD elements** — Hearts for health, timer icon, skull for kills replace text-only UI
- **Active powerup indicator** — Shows which powerup is active on a player with duration bar
- **Round-specific arena selection** — Each round in best-of-3 uses a different map

**Defer (v2+):**
- Fog-of-war minimap (adds complexity, validate base minimap first)
- Powerup balancing per character (see if base system needs it from playtesting)
- More than 3 rounds (best-of-5 only if matches feel too short)
- Adaptive music with stems/layers (track-per-scene is sufficient)

**Estimated scope:** 20-25 plans across 7 feature phases.

### Architecture Approach

The architecture treats v2.0 as **7 integration domains** touching different layers: (1) shared physics (ARENA becomes per-map), (2) shared maps (extended MapMetadata), (3) client main.ts (resolution config), (4) GameScene (camera, tilemap, powerups, minimap, music), (5) HUDScene (repositioning + icons), (6) GameRoom (multi-stage state machine + powerup logic), (7) GameState schema (stage tracking + powerups MapSchema). The core architectural insight is that HD viewport + scrollable camera is a foundational change cascading into nearly every other feature.

**Major components:**

1. **HD Viewport Foundation** — `main.ts` resolution change + all hardcoded 800x600 coordinates updated to use `this.cameras.main.width/height` or Layout constants. Establishes viewport-relative positioning pattern for all UI.

2. **Dynamic Arena Bounds** — Replace global `ARENA = {800, 608}` constant with per-map `MapMetadata.arenaWidth/arenaHeight`. Pass arena bounds to PredictionSystem constructor and GameRoom edge clamping instead of importing ARENA singleton. Enables variable map sizes.

3. **Multi-Stage State Machine** — Extend GameRoom state flow: `WAITING -> STAGE_INTRO -> PLAYING -> STAGE_END -> (next stage or) MATCH_END`. Add Schema fields: `stageNumber`, `totalStages`, `stageWinners[]`. Between stages: reset health/positions/velocities, clear projectiles/powerups, rebuild CollisionGrid, hot-swap tilemap on client via `mapName` listener.

4. **Powerup System** — New `shared/powerups.ts` type defs, new `server/schema/PowerupState.ts`, MapSchema in GameState, server spawn timer + collision detection, client sprite rendering (onAdd/onRemove pattern), HUD active effect indicator. Same pattern as projectiles/obstacles.

5. **Camera Follow Integration** — GameScene: `camera.startFollow(localSprite, true, 0.1, 0.1)` + `camera.setBounds(0, 0, mapPixelWidth, mapPixelHeight)`. HUDScene stays fixed with separate camera. Spectator mode switches follow targets. Minimap via secondary camera with `cameras.add()`.

6. **Tileset Pipeline Extension** — Existing dynamic tilemap loading handles larger maps and new tilesets with no code changes. Author new 50x38 maps in Tiled using provided hedge/brick/wood tilesets. Deploy tileset PNGs to `client/public/tilesets/`. Hot-swap tilesets between stages via mapName change.

7. **Audio System Upgrade** — Extend AudioManager with crossfade support for music transitions. Deploy MP3s to `client/public/audio/`. MapMetadata gains `musicTrack` field. Play per-stage music with fade-out/fade-in on transitions. Keep jsfxr for SFX unchanged.

**Confidence:** HIGH — based on direct codebase analysis and verified Phaser 3 / Colyseus 0.15 capabilities.

### Critical Pitfalls

1. **ARENA constant hardcoded everywhere** — Changing to larger arenas without updating the global `ARENA = {width: 800, height: 608}` constant causes players to hit invisible walls at (800, 608) in 1600x1216 arenas. Both `PredictionSystem` and `GameRoom` use ARENA for edge clamping. **Prevention:** Remove global constant, add `arenaWidth`/`arenaHeight` to MapMetadata, pass dimensions to PredictionSystem constructor and GameRoom collision resolution.

2. **HUD uses hardcoded pixel positions** — HUDScene positions every element at magic numbers: timer at (400, 20), health bars at y=575, etc. At 1280x720, all elements cluster incorrectly. **Prevention:** Refactor all HUD positions to use `this.cameras.main.width/height`, express coordinates as percentages or anchor offsets (e.g., `width - 20` for right-aligned).

3. **Multi-stage rounds require full state reset without room recreation** — Best-of-3 needs to reset GameState (health, positions, obstacles, projectiles, collision grid) between rounds while keeping the same Colyseus room open. Creating new rooms per stage causes session ID changes (known issue from Phase 5). **Prevention:** Add `stageNumber` and `stageWinners[]` to Schema, implement stage transition logic that resets Schema fields and rebuilds CollisionGrid, client listens for `mapName` change to hot-swap tilemap.

4. **Camera follow breaks existing coordinate assumptions** — Adding `camera.startFollow()` means the camera scrolls, breaking screen-fixed elements like status text at (10, 10). **Prevention:** Move screen-fixed elements to HUDScene or use `setScrollFactor(0)`, set camera bounds after tilemap loads, use `camera.stopFollow()` then `startFollow(newTarget)` for spectator mode.

5. **Phaser scene reuse (30+ member variables to reset)** — GameScene.create() already resets 30+ member variables for scene reuse. Each new feature (powerups, minimap, stage tracking) adds more state that MUST be reset or causes ghost sprites, orphaned particles, stale listeners. **Prevention:** Establish pattern that every new Map, Set, or game object reference gets corresponding reset in create() AND a round-reset handler. Consider extracting state into a `GameSceneState` class with single `reset()` method.

## Implications for Roadmap

Based on research, the v2.0 milestone naturally decomposes into **7 phases** driven by technical dependencies:

### Phase 1: HD Viewport + Camera Foundation
**Rationale:** Every subsequent feature depends on correct viewport dimensions (1280x720) and camera scrolling. Larger maps are unplayable without camera follow. HUD positioning breaks without viewport-relative coordinates. This is the foundational change — attempting any other feature first requires rework when viewport changes.

**Delivers:**
- Game config updated to 1280x720 resolution
- Camera follows local player with smooth lerp
- Camera bounds prevent scrolling outside arena
- ARENA constant replaced with per-map bounds system
- All HUD/scene UI repositioned for new viewport
- PredictionSystem accepts dynamic arena dimensions

**Addresses:** Camera follow with lerp (table stakes), world bounds (table stakes), HD viewport (table stakes)

**Avoids:** Pitfall 1 (ARENA constant), Pitfall 2 (hardcoded HUD positions), Pitfall 4 (prediction edge clamp), Pitfall 6 (camera coordinate assumptions)

**Integration Risk:** MEDIUM — ARENA constant used in multiple files (PredictionSystem, GameRoom, shared physics); requires coordinated change across server/client/shared layers.

### Phase 2: Tileset Integration + Map Format
**Rationale:** Must establish map data contract before designing larger arenas. New tilesets require different tile IDs and potentially multiple tilesets per map. This phase defines the format that all subsequent maps will follow.

**Delivers:**
- Tile ID mapping via Tiled custom properties (not hardcoded IDs)
- Support for multiple tilesets per map
- Tile extrusion to prevent bleeding artifacts
- Updated map loading to parse tileset data
- Map format contract documented for level design
- Backward compatibility with existing v1.0 maps

**Uses:** Phaser tilemap API (addTilesetImage with multiple tilesets, tile properties)

**Implements:** Tileset pipeline extension (Architecture component 6)

**Avoids:** Pitfall 7 (tile bleeding), Pitfall 14 (Tiled format assumptions), Pitfall 19 (path resolution)

**Integration Risk:** LOW — extends existing tilemap pipeline additively.

### Phase 3: Arena Enlargement (50x38 tiles)
**Rationale:** With camera follow working and map format stable, can now create larger arenas. Tests that camera system scales correctly. Provides the larger playspace that justifies v2.0.

**Delivers:**
- 2-4 new maps at 1600x1216 pixel scale (50x38 tiles)
- Updated spawn points spread across larger arenas
- Tileset rendering verified at larger scale
- CollisionGrid handles larger tile arrays
- Client prediction bounds use map-specific dimensions

**Addresses:** Larger arenas unlock the "arena evolution" promise

**Avoids:** Pitfall 4 (prediction bounds), Pitfall 11 (CollisionGrid rebuild)

**Integration Risk:** LOW — existing systems already handle arbitrary map sizes.

### Phase 4: Multi-Stage Best-of-3
**Rationale:** Powerups in a multi-stage context require stage lifecycle (cleared between stages, spawn timers reset). Building powerups first would require rework when stages are added. Multi-stage is the most architecturally complex feature, so build it before layering enhancements on top.

**Delivers:**
- Extended state machine: STAGE_INTRO -> PLAYING -> STAGE_END -> (repeat or MATCH_END)
- Schema additions: stageNumber, totalStages, stageWinners[]
- Full state reset between stages (health, positions, obstacles, projectiles, collision grid)
- Stage pool per match (3 maps, no repeats)
- Client tilemap hot-swap via mapName change listener
- Transition screen showing stage results and next arena
- HUDScene stage score indicator
- VictoryScene best-of-3 summary

**Addresses:** Round indicator (table stakes), transition screen (table stakes), round-specific arena selection (differentiator)

**Avoids:** Pitfall 5 (state reset without room recreation), Pitfall 10 (scene member variable reset), Pitfall 11 (CollisionGrid rebuild), Pitfall 18 (HUD state reset)

**Integration Risk:** HIGH — core server logic extension; must not break existing match flow; comprehensive testing required for all edge cases (disconnect mid-stage, all players dead simultaneously, timeout per stage).

### Phase 5: Powerup System
**Rationale:** With stage lifecycle in place, powerups can integrate cleanly (spawn at stage start, clear at stage end). Adds tactical depth to the enlarged arenas.

**Delivers:**
- shared/powerups.ts type definitions (4 types: speed, health, damage, shield)
- server/schema/PowerupState.ts Schema
- GameRoom spawn timer + collision detection + effect application
- Duration-based effect tracking server-side
- Client powerup sprite rendering (onAdd/onRemove)
- Bobbing animation and pickup particles
- HUDScene active powerup indicator (icon + duration bar)

**Uses:** Colyseus MapSchema pattern (same as projectiles/obstacles)

**Implements:** Powerup system (Architecture component 4)

**Addresses:** Powerup spawning system (differentiator), active powerup indicator (differentiator)

**Avoids:** Pitfall 8 (sync timing with optimistic client pickup), Pitfall 15 (bandwidth via static positions)

**Integration Risk:** MEDIUM — new server-authoritative system; balance tuning required; interaction with existing combat needs testing.

### Phase 6: Minimap + Music System
**Rationale:** Polish layer that enhances the larger arena experience. Both are independent subsystems that can be developed together. Minimap depends on larger arenas existing. Music is fully independent.

**Delivers:**
- Minimap: secondary camera at 180x120 viewport, zoomed to show full arena, colored dots per player
- Minimap border/background rendered in HUDScene
- Music system: per-scene track selection, crossfade transitions, volume persistence
- Lobby music, 2 match music tracks, per-map music assignment
- MapMetadata.musicTrack field
- AudioManager crossfade support

**Uses:** Phaser multi-camera (`cameras.add`), Sound Manager or HTMLAudioElement with custom crossfade

**Implements:** Camera follow integration (component 5, minimap part), Audio system upgrade (component 7)

**Addresses:** Minimap (table stakes), music during matches (table stakes), per-arena music tracks (differentiator), music crossfade (differentiator)

**Avoids:** Pitfall 9 (minimap performance via static update rate), Pitfall 12 (music system limitations)

**Integration Risk:** LOW — both are additive subsystems with minimal coupling to core gameplay.

### Phase 7: HUD Overhaul with Icons
**Rationale:** Final polish pass that integrates elements from powerups (active effect icons), stage scores (round indicator), and new icon assets. Best done when all systems exist so HUD layout can accommodate everything.

**Delivers:**
- Load icon sprites from assets/icons/ (hearts, timer, skull, potions, volume levels)
- Icon-based health display (heart-full, heart-empty)
- Icon-based timer display
- Cooldown bar with icon
- Powerup active display with potion icons
- Round score indicator with stage markers
- Volume controls with speaker icons
- Visual polish pass across all HUD elements

**Addresses:** Icon-based HUD elements (differentiator), volume controls with icons (differentiator)

**Avoids:** Pitfall 2 (hardcoded positions, addressed in Phase 1 but final verification here)

**Integration Risk:** LOW — purely visual enhancement; no gameplay logic changes.

### Phase Ordering Rationale

- **Phase 1 must be first:** Every feature needs 1280x720 positioning and camera scroll awareness. Without this, you can't test large maps, minimap, or correct HUD placement. Attempting later phases first creates technical debt that must be repaid with a full refactor.

- **Phase 2 before Phase 3:** Creating larger maps requires the tileset format to be stable. Defining the map contract before map design prevents rework.

- **Phase 3 before Phase 4:** Multi-stage needs a pool of maps. Creating larger arenas validates the camera/tileset system before adding state machine complexity.

- **Phase 4 before Phase 5:** Powerups in a multi-stage context require the stage lifecycle (cleared between stages, spawn timers reset). Building powerups first would require rework when stage transitions are added.

- **Phase 5 after Phase 4:** Powerup spawn/despawn logic integrates with stage state machine. Clean separation: stage system owns lifecycle, powerup system owns entity behavior.

- **Phase 6 parallel-safe with Phases 4-5:** Minimap and music are independent subsystems with minimal coupling. Minimap only needs larger arenas (Phase 3) to make sense. Music is entirely independent and can be done alongside any phase.

- **Phase 7 last:** HUD polish integrates powerup indicators (Phase 5), stage scores (Phase 4), and icons. Best done when all systems exist.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 4 (Multi-Stage):** Complex state machine with many edge cases. May need gap closure rounds for: reconnection mid-stage, simultaneous player death, stage timeout handling, collision grid rebuild race conditions, tilemap hot-swap memory management.
- **Phase 5 (Powerups):** Balance tuning requires playtesting feedback. Effect values (duration, multipliers) are estimates. May need iteration rounds.

**Phases with standard patterns (minimal research needed):**
- **Phase 1 (HD Viewport + Camera):** Well-documented Phaser APIs; existing codebase already uses camera methods for spectator mode.
- **Phase 2 (Tileset Integration):** Standard Tiled workflow; tile-extruder is a known tool.
- **Phase 3 (Arena Enlargement):** Extension of existing tilemap pipeline.
- **Phase 6 (Minimap + Music):** Phaser multi-camera and audio management are well-documented; multiple official examples exist.
- **Phase 7 (HUD Icons):** Standard image loading and UI composition.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All features implementable with existing stack. Zero new dependencies. Verified against package.json, Phaser 3.90 docs, Colyseus 0.15 docs. |
| Features | HIGH | Table stakes identified via game design patterns for scrollable arenas. Sizing estimates derived from existing codebase plan counts (Phase 5 took 11 plans + 3 gap closure rounds; v2.0 features are similar complexity). |
| Architecture | HIGH | Based on direct codebase analysis. All 7 integration domains map to existing files/components. Patterns follow established codebase conventions (Schema for entity sync, onAdd/onRemove for sprites, scene reuse with create() reset). |
| Pitfalls | HIGH | All critical pitfalls derived from actual code paths with line number verification. ARENA constant issue verified at physics.ts:14-15, Prediction.ts:106-107, GameRoom.ts:342-343. HUD positions verified throughout HUDScene.ts. Multi-stage state reset issue informed by Phase 5 session ID learnings documented in MEMORY.md. |

**Overall confidence:** HIGH

### Gaps to Address

- **Multi-stage collision grid rebuild specifics:** CollisionGrid needs a `rebuild()` method but the exact implementation (full re-initialization vs field reset) needs verification during Phase 4 planning. Client-side rebuild must synchronize with server-side rebuild to prevent prediction desync window.

- **Powerup effect values:** Speed boost multiplier (1.5x), damage boost multiplier (1.5x), durations (5-8s) are educated guesses based on game design conventions. Actual values need playtesting iteration in Phase 5.

- **Minimap performance measurement:** RenderTexture vs secondary camera performance comparison is theoretical. Actual FPS impact needs measurement during Phase 6 implementation to choose optimal approach.

- **Tilemap hot-swap memory management:** Calling `map.destroy()` and recreating tilemap mid-scene should work but needs testing to verify no cache/memory issues during Phase 4 stage transitions.

- **Music asset file sizes:** Provided MP3 files need size verification. If total music payload exceeds 5MB, may need OGG encoding or streaming approach during Phase 6.

**Handling strategy:** All gaps are implementation details that can be resolved during per-phase planning with `/gsd:research-phase` if needed. None block the overall phase structure or dependency ordering.

## Sources

### Primary (HIGH confidence)
- Banger codebase direct analysis — All files in `/Users/jonasbrandvik/Projects/banger-game/` (server/, client/, shared/)
- [Phaser 3.90 Camera API](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera) — startFollow, setBounds, setViewport, setZoom verified
- [Phaser 3 Camera Concepts](https://docs.phaser.io/phaser/concepts/cameras) — multi-camera, viewport, deadzone, lerp parameters
- [Phaser 3 Minimap Camera Example](https://phaser.io/examples/v3/view/camera/minimap-camera) — official example using secondary camera
- [Phaser 3 Tilemap API](https://docs.phaser.io/api-documentation/function/tilemaps) — multiple tilesets, tile properties, layer creation
- [Phaser 3 Audio Concepts](https://docs.phaser.io/phaser/concepts/audio) — Sound Manager global persistence, Web Audio support
- [Colyseus 0.15 Room API](https://0-15-x.docs.colyseus.io/server/room/) — Room lifecycle, allowReconnection, state machine patterns
- [Colyseus State Best Practices](https://docs.colyseus.io/state/best-practices) — Schema design patterns, MapSchema usage

### Secondary (MEDIUM confidence)
- [tile-extruder tool](https://github.com/sporadic-labs/tile-extruder) — Prevents tile bleeding in Phaser tilesets
- [Phaser 3 roundPixels camera discussion](https://phaser.discourse.group/t/roundpixels-is-causing-jittering-with-cameras-main-startfollow/11880) — Known camera follow + roundPixels behavior
- [Phaser 3 Audio Fade patterns](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/fadevolume/) — Volume fading for music crossfade
- [Level Design in Top-Down Shooters](https://medium.com/my-games-company/level-design-in-top-down-shooters-creating-diversified-experience-using-maps-ff9e21c8e600) — Powerup placement patterns
- [HUD Scene with Multiple Cameras](https://phaser.discourse.group/t/hud-scene-multiple-scenes/6348) — setScrollFactor(0) vs separate scene approach
- [Phaser 3 ScrollFactor](https://newdocs.phaser.io/docs/3.54.0/Phaser.GameObjects.Components.ScrollFactor) — Fixed UI in scrolling scenes

### Tertiary (LOW confidence)
- [Phaser 3 Pixel Art Scaling](https://www.davideaversa.it/blog/quick-dev-tips-pixel-perfect-scaling-phaser-game/) — Integer scaling recommendations (not critical for v2.0)

---
*Research completed: 2026-02-13*
*Ready for roadmap: yes*

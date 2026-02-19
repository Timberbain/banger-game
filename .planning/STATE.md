# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** The asymmetric momentum mechanic must feel right -- Paran building terrifying speed with Pac-Man cardinal movement but losing everything on collision, guardians relying on positioning and teamwork to force those collisions.
**Current focus:** Phase 12 -- HUD Icon Overhaul

## Current Position

Phase: 12 (HUD Icon Overhaul)
Plan: 1 of 2 in current phase
Status: Plan 12-01 complete (Core HUD Icon Replacements)
Last activity: 2026-02-19 -- Completed 12-01 (Core HUD Icon Replacements)

Progress: [##########..........] 50% (1 of 2 Phase 12 plans complete)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 41
- Total execution time: ~4 days (2026-02-09 to 2026-02-13)

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation | 3 | Complete |
| 2. Movement | 2 | Complete |
| 3. Combat | 2 | Complete |
| 4. Match Lifecycle | 3 | Complete |
| 5. Lobbies | 13 | Complete |
| 5.1 Collisions | 4 | Complete |
| 6. UX Polish | 11 | Complete |
| 7. HD Viewport & Camera | 9 | Complete |
| 8. Arena Overhaul | 5 | Complete |
| 9. Multi-Stage Rounds | 5 | Complete (incl. gap closures) |
| 9.1 Tilemap Collision Masks | 3 | Complete |
| 10. Powerup System | 5 | Complete (incl. gap closure) |
| 11. Minimap & Music | 4 | Complete (incl. gap closure) |
| 12. HUD Icon Overhaul | 2 | In Progress (1/2) |

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.
v2.0 pending decisions (from research): HD resolution, multi-stage rounds, tilesets, powerups, music.

**Phase 7 decisions:**
- Characters at 64x64 with genuine 2x detail (not naive upscale), tilesets stay 1x (32x32 tiles)
- 36 frames per character: 6-frame walks, 3-frame idle breathing, 3-frame shoot, 6-frame death
- ARENA constant preserved as fallback default, PredictionSystem uses optional constructor injection for dynamic bounds
- Removed unused arcade physics block from Phaser config (custom shared physics used)
- Walk frameRate 8->10 for 6-frame walks (0.6s cycle comparable to old 0.5s), idle 3fps breathing
- Spectator camera uses startFollow with lerp instead of centerOn for smooth tracking
- Look-ahead uses followOffset (SUBTRACTED) with negated direction vectors, 0.14 lerp (tuned from 0.04)
- pendingOverview deferred pattern for Colyseus state.listen vs onStateChange.once race condition
- Gameplay deadzone 20x15, spectator deadzone 60x45 (separate tuning)
- Camera shake: wall impact 80ms/0.003, damage 100ms/0.005 (local player only)
- HUD uses viewport-relative W/H percentages, menu scenes use cameras.main.centerX/centerY
- HUD cooldown bar at H*0.89 (was H*0.92) for clear gap above name label
- Lobby panel offset titleY+100 (was titleY+70) with Players section shifted +30px
- Help screen: playful taglines + flavor text, no stats or technical jargon
- overviewActive guard in createTilemap: setBounds unconditional, setZoom+follow guarded
- HelpScene panels 280x260 with 250px wordWrap and 28px line spacing

**Phase 8 decisions:**
- Composite tileset layout: 4x3 grid (128x96), IDs 1-4=ground, 5-8=wall/obstacles, 9-12=deco
- Tile ID shift from old convention (WALL=3) to new (WALL=5) due to ground tiles in row 0
- Arena layouts: hedge=open corridors (Paran-favoring), brick=chambers (Guardian-favoring), timber=symmetric cross (balanced)
- Ground tiles cherry-picked from 42x12 ground atlas per theme palette
- Overview zoom calculated dynamically: Math.min(viewport/arena) for arena-size-independent camera
- Generic tileset fallback via Object.values() instead of named map key
- GameState schema default mapName updated to hedge_garden (first map in rotation)
- setArenaBounds as post-construction setter rather than re-instantiating PredictionSystem
- ARENA fallback updated to 1600x1216 so any code path using it as default is safe
- Per-map spawn coordinates validated with 1-tile buffer clearance; paran center, faran top-left, baran bottom-right
- Spawn validation runs automatically in generate-arenas.py after map generation
- Auto-tile rules need explicit false constraints to prevent subset shadowing in first-match-wins evaluation
- Rule 46 added for bottom-edge NE-only-inner/NW-false/SE-false gap case

**Phase 9 decisions:**
- Stats accumulate across stages, not reset -- StageSnapshot captures cumulative state, victory screen diffs for per-stage
- Arena selection at room creation (onCreate) not match start -- stageArenas[0] needed for initial map loading
- MATCH_END as new terminal state, ENDED kept for backward compatibility
- loadMap() extracted as shared method for onCreate and resetStage
- setSpawnPosition() helper extracted for reuse in onJoin and resetStage
- onLeave allows reconnection during STAGE_END and STAGE_TRANSITION (active match states)
- Colyseus 0.15 safe reset: pop() for ArraySchema, iterate+delete for MapSchema, in-place for players
- Preload all 3 tilesets and tilemaps in BootScene for zero-delay stage transitions
- ~~Camera fade callback with progress >= 1 for safe tilemap swap during black screen~~ -- REPLACED in 09-04 (geometry mask iris wipe)
- Reuse startMatchOverview() for stage starts (consistent cinematic experience)
- Controls locked from stageEnd through overview completion (prevents ghost inputs)
- PredictionSystem.setCollisionGrid accepts null for clean stage reset
- Consolidated matchState listener in HUDScene for countdown + stage_end + stage_transition
- Stage breakdown only rendered when stageResults non-empty (backward compatible)
- VictoryScene falls back to simple winner label when no stageResults available
- Geometry mask iris wipe replaces camera fade for unified stage transition effect
- 600ms server delay before resetStage ensures client iris fully closes before position updates
- inStageTransition flag guards handlePlayerChange to prevent visible teleportation
- loadMap reordered before player reset in resetStage for spawn collision validation
- Spawn collision validation with 9-offset nudge pattern in setSpawnPosition()
- Fill color 0xffffff on geometry mask circle triggers isFilled for stencil buffer rendering
- InterpolationSystem.snapTo() injects two identical snapshots for instant teleport (bypasses lerp)
- Position backfill in stageStart reads room.state.players directly after dropping inStageTransition guard
- isSpectating race condition: update() spectator entry guarded with !inStageTransition + safety net reset in stageStart

**Phase 09.1 decisions:**
- Full-tile fallback when collisionShapes not provided preserves identical behavior at all existing call sites
- OOB tiles get full-tile rect in resolveCollisions via null-coalescing fallback
- Broad-phase tile scan range unchanged -- only per-tile overlap test and push-out positions use sub-rects
- PredictionSystem needs no changes for sub-rect collision -- receives CollisionGrid by reference via setCollisionGrid
- Debug overlay destroyed on stage transitions and scene reuse to prevent stale visuals
- F3 debug overlay color coding: red=indestructible, orange=heavy(101), yellow=medium(102), green=light(other)

**Phase 10 decisions:**
- Buff state tracked server-only (activeBuffs array) with broadcast events for client feedback
- speedMultiplier synced via Schema for client-side prediction accuracy
- originalObstacleTiles set prevents powerup spawns on destroyed obstacle locations
- PowerupType enum uses numeric values (0,1,2) for uint8 Schema efficiency
- Aura emitters tracked in activeTrails Set for automatic cleanup on scene destroy
- Aura particle depth 9 (below player sprites at 10, above projectile trails at 4)
- Beam trail uses direct scene.add.particles for custom gold particles instead of ParticleFactory.createTrail
- Buff indicators at H*0.87 with dynamic centering for variable indicator count
- clearAllBuffAuras before particleFactory.destroy() in cleanupStageVisuals to prevent orphaned emitters
- Dual-map aura tracking: Map<sessionId, Map<buffType, Emitter>> for per-player per-buff lifecycle
- WAV sounds take priority over jsfxr in playSFX via wavSounds check-first pattern
- Idle aura tracked in separate powerupIdleEmitters map for independent lifecycle from buff auras
- Number() cast on Colyseus message data.type prevents string/number enum mismatch in switch

**Phase 11 decisions:**
- fadeVolume uses 50ms setInterval steps for smooth linear volume ramping
- volumeDipFactor field integrates with setMusicVolume to respect slider changes during dip
- crossfadeTo respects active volumeDipFactor for target volume calculation
- playMusicWithPause stale guard checks currentMusic identity before restarting
- Minimap uses Graphics (clear+redraw at 10Hz) not RenderTexture -- simpler, no texture management
- CollisionGrid and MapMetadata shared via Phaser registry from GameScene to HUDScene
- Minimap toggle state persisted via registry across stages (survives scene re-launch)
- Ping display (y=133) and kill feed (baseY=155) repositioned below minimap to avoid overlap
- overviewStart/overviewEnd events emitted from GameScene in all 3 overview code paths
- isPlayingMusic() guard in LobbyScene prevents restarting lobby loop when VictoryScene already crossfaded to it
- StageIntroScene needs no audio changes -- volume dip bracketed by GameScene stageEnd/stageStart handlers
- hasProjectileBuff tracked client-side via powerupCollect/buffExpired for Paran beam fire SFX accuracy
- Volume sliders use rectangle hit areas with drag support, replacing +/- buttons
- Return-to-lobby: VictoryScene fadeOutMusic(500ms), LobbyScene detects silence and starts loop after 500ms delay
- Kill feed bg: text-first creation, then bg sized to text.displayWidth + 16px padding
- stopAndPlayWAV: reuses source HTMLAudioElement (currentTime=0) for exclusive non-overlapping playback
- Shoot SFX in createProjectileSprite (server-confirmed), not input handler (client-predicted)
- fadeOutMusic callback gates returnToLobby so isPlayingMusic() returns false before LobbyScene.create()

**Phase 12 decisions:**
- 10 HP per heart icon (Paran=15 hearts, Guardians=5 hearts) for clear visual health feedback
- Local player health only -- removed all non-local health bars from HUD for cleaner display
- Graphics-based pip rendering for round score (simpler than Image objects for small colored dots)
- Potion color mapping: Red=Speed, Blue=Invincibility, Green=Projectile (consistent across all files)
- Heart damage animation uses texture key comparison to detect transition direction (full->empty triggers tween)
- Paired icon+text layout: timer icon and text share visibility, tint, and alpha state

### Pending Todos

None.

### Roadmap Evolution

- v1.0: Phase 05.1 inserted for arena collisions + contact kill
- v2.0: DISP-05 (zoom transition) assigned to Phase 9 (Multi-Stage Rounds) rather than Phase 7 -- only observable during stage transitions
- Phase 09.1 inserted after Phase 9: Tilemap collision masks for precise wall/obstacle collisions (URGENT)

### Blockers/Concerns

- ~~ARENA constant hardcoded in physics.ts, PredictionSystem, GameRoom~~ -- RESOLVED in 07-02 (dynamic bounds)
- ~~30+ hardcoded pixel positions across HUD/UI scenes~~ -- RESOLVED in Phase 7 (viewport-relative)
- ~~Multi-stage state reset without room recreation (session ID issue from v1.0 Phase 5)~~ -- RESOLVED in 09-01 (in-room reset with safe Colyseus patterns)

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 12-01-PLAN.md (Core HUD Icon Replacements)
Resume file: .planning/phases/12-hud-icon-overhaul/12-01-SUMMARY.md
Next step: Execute 12-02-PLAN.md

---
*Updated: 2026-02-19 after completing 12-01 (Core HUD Icon Replacements)*

# Feature Landscape: v2.0 Arena Evolution

**Domain:** HD viewport, scrollable arenas, multi-round matches, powerups, minimap, tileset upgrade, music system
**Researched:** 2026-02-13
**Confidence:** HIGH (verified against Phaser 3 docs, codebase analysis, established game design patterns)

## Table Stakes

Features that v2.0 users will expect once the arena grows beyond a single screen. Missing any = the larger arenas feel broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Camera follow with smooth lerp | Players must see their character in larger arenas. Instant snap feels jarring. | Low | Phaser `camera.startFollow(sprite, true, 0.1, 0.1)` with `setBounds(0,0,mapW,mapH)`. Existing HUDScene already has `camera.setScroll(0,0)` -- stays fixed. |
| World bounds matching arena size | Camera must not scroll past map edges into void. | Low | `camera.setBounds(0,0,arenaW,arenaH)` constrains scrolling. Must update `ARENA` constant from 800x608 to new size. |
| HD viewport resolution | Current 800x600 canvas is small on modern 1080p+ screens. 32px pixel art needs integer scaling. | Low | Change game config to 1280x720 or 1280x960 (zoom 2x of 640x480 or 640x360 logical). Use `pixelArt: true` (already set) + `roundPixels: true` on camera. |
| Minimap showing player positions | In a scrollable arena, players need global awareness of enemy positions. Core to multiplayer tactics. | Medium | Second Phaser camera with `setViewport` + `setZoom` + `camera.ignore(hudElements)`. Show colored dots (one per player). |
| Round indicator / score display | If playing best-of-3, players must know current round and score at a glance. | Low | HUDScene text element: "Round 2/3 -- Paran 1 : 0 Guardians" |
| Transition screen between rounds | Dead time between rounds needs a visual bridge (score recap, next arena preview, respawn countdown). | Medium | 3-5 second overlay scene showing round result, cumulative score, "Next: [Map Name]", countdown. |
| Music that plays during matches | Players expect background music in a polished game. Silent arenas feel unfinished. | Low | AudioManager already has `playMusic(src)`. Need mp3 files and scene-appropriate track selection. |

## Differentiators

Features that elevate v2.0 beyond "bigger maps." Not strictly expected, but make the game feel substantially better.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Powerup spawning system | Adds mid-match strategic decisions: risk position for a buff. Creates tension and map control. | High | Server-authoritative spawn + pickup logic, Schema sync, client rendering, timer-based respawns. 3 types: speed boost, invincibility, larger hitbox. |
| Camera deadzone | Slight dead area around player before camera moves. Prevents camera jitter on small movements. Polished feel. | Low | `camera.setDeadzone(60, 60)` -- small rectangle where micro-movement doesn't trigger scroll. |
| Per-arena music tracks | Different music per map creates distinct atmosphere. Players associate arenas with themes. | Low | Map metadata gains `musicTrack` field. AudioManager switches on arena load. |
| Music crossfade on scene transitions | Abrupt audio cuts feel jarring. Smooth 0.5s fade-out/fade-in is polished. | Low | Tween `currentMusic.volume` from current to 0 over 500ms, then switch track and tween to target volume. |
| Minimap with fog/limited range | Only show enemies within detection range on minimap (e.g., 50% of arena). Forces scouting. | Medium | Server sends "visible enemies" list based on distance, or client filters minimap dots by distance from local player. |
| Round-specific arena selection | Each round in best-of-3 uses a different arena. Prevents repetition and tests adaptability. | Low | Server picks 3 distinct maps from pool when match starts. Already have 4 maps. |
| Powerup visual indicators | Floating/bobbing pickup sprites, glow effects, collection particles. Makes arena feel alive. | Low | Animated sprites on client from server-synced positions. Bob with `sin(time)` offset. |
| Icon-based HUD elements | Replace text-only HUD with icon+text (hearts for health, timer icon, skull for kills). | Medium | Load icon assets from `assets/icons/`. Use `icon001.png` (heart-full), `icon005.png` (timer), `icon006.png` (skull). Compose with Phaser images. |
| Active powerup indicator | Show which powerup is currently active on a player (icon + duration bar above character or in HUD). | Medium | Server syncs active effect type + remaining duration. HUD renders icon + shrinking bar. |
| Volume controls with icons | Replace text volume labels with `icon044-047.png` speaker icons for SFX/music volume. | Low | Already have 4 volume level icons. Swap based on current volume bracket. |

## Anti-Features

Features to explicitly NOT build in v2.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Free camera control (detached from player) | Ruins competitive integrity -- players would scout the whole map freely | Camera locked to player, minimap provides limited awareness |
| Unlimited powerup stacking | Speed + invincibility + size = game-breaking. Impossible to balance. | One active powerup at a time. Picking up a new one replaces the current. |
| Powerup-specific balancing per character | Exponential complexity (3 characters x 3 powerups = 9 balance scenarios per round) | Same powerup values for all characters. Let asymmetric base stats create emergent balance. |
| Client-side powerup collision | Opens door to cheating (fake pickups, timing exploits) | Server-authoritative: server detects overlap, applies effect, broadcasts result |
| Procedural arena generation | Quality control nightmare for competitive play. v1.0 maps are hand-crafted. | Expand the 4 hand-crafted map pool (add 2-4 larger maps designed for scrolling) |
| Dynamic resolution scaling | Complexity for marginal gain. Browser games target consistent hardware. | Fixed HD resolution (1280x720 or 960) with `Scale.FIT` |
| Round-robin map voting | 3 players, voting is awkward (2v1 always). Unnecessary complexity. | Server picks arena sequence deterministically (or random). |
| Per-pixel lighting / shadows | Massive scope increase, not consistent with pixel art aesthetic | Keep flat solarpunk palette. Use tint overlays for mood. |
| Lobby map preview with thumbnails | Nice-to-have but scope creep for v2.0 | Text-only "Next arena: Cross Fire" is sufficient |
| Adaptive music (stems/layers) | Extremely complex audio engineering. Not justified for 3-player arena. | Simple track-per-scene approach. |

## Feature Dependencies

```
HD Viewport → Camera Follow (can't scroll without camera system)
Camera Follow → Minimap (minimap only needed when arena scrolls)
Camera Follow → World Bounds (bounds prevent void scrolling)
Camera Follow → HUD Fixed Position (HUD must not scroll with world)

Larger Arenas → Camera Follow (arenas > viewport require scrolling)
Larger Arenas → Updated ARENA constant (physics bounds)
Larger Arenas → Updated Spawn Points (spread across bigger space)
Larger Arenas → Updated Collision Grid (bigger tile arrays)

Multi-Round System → Round State Machine (server tracks rounds/score)
Multi-Round System → Transition Screen (between-round UI)
Multi-Round System → Arena Sequence (pick 3 maps for 3 rounds)
Multi-Round System → Player Reset (health, position, cooldowns per round)

Powerup System → Server Schema (PowerupState with type, position, active)
Powerup System → Spawn Logic (timer-based, server-authoritative)
Powerup System → Pickup Detection (server AABB overlap check)
Powerup System → Effect Application (modify player stats temporarily)
Powerup System → Client Rendering (sprites, collection VFX)
Powerup System → HUD Integration (active effect indicator)

Music System → AudioManager Enhancement (crossfade, track selection)
Music System → Map Metadata (musicTrack field per arena)

Icon HUD → Asset Loading (icons from assets/icons/)
Icon HUD → HUD Refactor (compose images + text)
```

## MVP Recommendation

### Phase 1: HD Viewport + Camera System (build first -- everything else depends on it)
1. **HD viewport resolution** -- Change game config from 800x600 to 1280x720 (or 960), adjust Scale.FIT
2. **Camera follow with lerp** -- `startFollow` on local player sprite, `setBounds` to arena
3. **Camera deadzone** -- Small dead area for polished feel
4. **HUD scene verification** -- Confirm HUDScene stays fixed (already has `setScroll(0,0)`)
5. **Round pixels on camera** -- Prevent pixel art sub-pixel blur during scroll

### Phase 2: Scrollable Arenas (unlocks the "arena evolution" core promise)
1. **ARENA constant expansion** -- Update `shared/physics.ts` from 800x608 to ~1600x1216 (50x38 tiles)
2. **New/expanded map designs** -- At least 2 maps at the new larger size
3. **Updated spawn points** -- Spread across the larger arena
4. **Prediction system bounds update** -- `PredictionSystem` uses ARENA for edge clamp
5. **Tileset rendering at larger scale** -- Verify tilemap rendering works at new size

### Phase 3: Multi-Stage Rounds (best-of-3 transforms match structure)
1. **Round state machine on server** -- WAITING -> ROUND_PLAYING -> ROUND_END -> (repeat or) MATCH_END
2. **Player reset between rounds** -- Health, position, velocity, cooldowns
3. **Arena sequence per match** -- Server picks 3 distinct maps at match creation
4. **Transition screen** -- Score display, next arena name, countdown between rounds
5. **Round indicator in HUD** -- Current round, cumulative score

### Phase 4: Powerup System (adds mid-match tactical depth)
1. **Server-side PowerupState Schema** -- type, x, y, active, respawnTimer
2. **Spawn positions per map** -- 2-4 designated powerup locations in map metadata
3. **Pickup collision detection** -- Server checks player-powerup AABB overlap
4. **Effect application** -- Speed boost (1.5x maxVelocity, 5s), invincibility (ignore damage, 3s), larger hitbox (2x playerRadius, 5s)
5. **Client rendering** -- Animated bobbing sprites, collection particles
6. **HUD active effect indicator** -- Icon + duration bar

### Phase 5: Minimap + Music + HUD Polish (polish layer)
1. **Minimap camera** -- Second camera, small viewport (160x120), zoomed out to show full arena, colored dots per player
2. **Music system** -- Per-scene track selection, crossfade transitions, volume persistence
3. **Icon-based HUD** -- Hearts for health, timer icon, skull for kills, volume icons
4. **Volume control icons** -- Use `icon044-047.png` for visual volume indicator

### Defer to v3.0+
- **Fog-of-war minimap** -- Adds complexity, validate base minimap first
- **Powerup balancing per character** -- See if base system needs it from playtesting
- **More than 3 rounds** -- Best-of-5 only if matches feel too short
- **Map voting** -- Server pick is fine for 3 players
- **Adaptive music** -- Track-per-scene is sufficient

## Feature Sizing (rough estimates)

| Feature | Estimated Plans | Reasoning |
|---------|----------------|-----------|
| HD viewport + camera | 2-3 plans | Config change + camera setup + bounds verification + HUD adjustment |
| Scrollable arenas (larger maps) | 3-4 plans | ARENA constants + new maps + spawn points + prediction bounds + collision grid scaling |
| Multi-round system | 4-5 plans | Server state machine + player reset + arena sequence + transition scene + HUD round display |
| Powerup system | 5-6 plans | Schema + spawn logic + pickup detection + 3 effect types + client rendering + HUD indicator |
| Minimap | 2 plans | Second camera setup + player dot rendering |
| Music system | 2 plans | AudioManager crossfade + per-map track assignment |
| Icon HUD overhaul | 2-3 plans | Asset loading + health bar icons + timer/kill feed icons + volume icons |

**Total estimate: ~20-25 plans across 5 phases**

## Critical Path Features

These features must work correctly or v2.0 is broken:

1. **Camera follow** -- Broken camera = unplayable in larger arenas
2. **ARENA bounds sync** -- Server and client must agree on arena dimensions. Mismatch = prediction divergence
3. **Round state machine** -- Must handle edge cases: disconnect mid-round, all players dead simultaneously, timeout per round
4. **Powerup server authority** -- Client rendering is cosmetic. Server is truth. Race conditions on simultaneous pickup must have deterministic winner.

## Existing Code Impact Analysis

| Existing System | Required Changes | Risk |
|----------------|-----------------|------|
| `shared/physics.ts` ARENA | Width/height must become dynamic (per-map), not constant 800x608 | HIGH -- used by server, client prediction, and edge clamping. Must change carefully. |
| `shared/maps.ts` MapMetadata | Add `musicTrack`, `powerupSpawns`, support larger dimensions | LOW -- additive fields |
| `client/src/main.ts` game config | Resolution change from 800x600 | LOW -- single config object |
| `GameScene.ts` | Add camera.startFollow, camera.setBounds, minimap camera, powerup rendering | MEDIUM -- large file, many touch points |
| `HUDScene.ts` | Add round indicator, powerup status, icon-based elements. Hardcoded `screenWidth = 800` must change. | MEDIUM -- layout math needs viewport-relative positioning |
| `GameRoom.ts` | Round state machine wrapping existing match logic, powerup spawning, arena sequence | HIGH -- core server logic, must not break existing match flow |
| `GameState.ts` Schema | Add round number, round scores, powerup schema, arena sequence | MEDIUM -- Schema changes require client-server coordination |
| `PredictionSystem.ts` | ARENA bounds must be dynamic (passed in, not imported constant) | MEDIUM -- affects reconciliation correctness |
| `AudioManager.ts` | Add crossfade, track switching, per-scene music selection | LOW -- additive methods |
| `VictoryScene.ts` | Must distinguish round-end from match-end. Round-end goes to transition, match-end goes to full victory. | MEDIUM -- scene flow branching |

## Sources

- [Phaser 3 Cameras Documentation](https://docs.phaser.io/phaser/concepts/cameras) -- camera.startFollow, setBounds, setViewport, setZoom, ignore(), deadzone, lerp (HIGH confidence)
- [Phaser 3 Camera API](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera) -- startFollow signature, roundPixels, setDeadzone (HIGH confidence)
- [Phaser 3 Minimap Camera Example](https://phaser.io/examples/v3/view/camera/minimap-camera) -- second camera approach for minimap (HIGH confidence)
- [Phaser 3 Pixel Art Scaling](https://www.davideaversa.it/blog/quick-dev-tips-pixel-perfect-scaling-phaser-game/) -- integer scaling, roundPixels, pixelArt config (MEDIUM confidence)
- [Phaser 3 roundPixels Jitter Discussion](https://phaser.discourse.group/t/roundpixels-is-causing-jittering-with-cameras-main-startfollow/11880) -- known pitfall with camera follow + roundPixels (MEDIUM confidence)
- [Level Design in Top-Down Shooters](https://medium.com/my-games-company/level-design-in-top-down-shooters-creating-diversified-experience-using-maps-ff9e21c8e600) -- powerup placement patterns, map design for arena games (MEDIUM confidence)
- [Phaser 3 Audio Fade](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/fadevolume/) -- volume fading for music crossfade (MEDIUM confidence)
- [HUD Scene with Multiple Cameras](https://phaser.discourse.group/t/hud-scene-multiple-scenes/6348) -- setScrollFactor(0) vs separate scene approach for fixed HUD (MEDIUM confidence)
- Codebase analysis: `client/src/main.ts`, `client/src/scenes/GameScene.ts`, `client/src/scenes/HUDScene.ts`, `server/src/rooms/GameRoom.ts`, `shared/physics.ts`, `shared/maps.ts` (HIGH confidence -- direct source)

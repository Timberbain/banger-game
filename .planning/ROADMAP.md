# Roadmap: Banger

## Milestones

- **v1.0 MVP** -- Phases 1-6 (shipped 2026-02-13) | [Archive](milestones/v1.0-ROADMAP.md)
- **v2.0 Arena Evolution** -- Phases 7-12 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) -- SHIPPED 2026-02-13</summary>

- [x] Phase 1: Foundation & Server Architecture (3/3 plans) -- completed 2026-02-10
- [x] Phase 2: Core Movement (2/2 plans) -- completed 2026-02-10
- [x] Phase 3: Combat System (2/2 plans) -- completed 2026-02-10
- [x] Phase 4: Match Lifecycle & Maps (3/3 plans) -- completed 2026-02-10
- [x] Phase 5: Multiplayer Lobbies (13/13 plans) -- completed 2026-02-11
- [x] Phase 5.1: Arena Collisions & Contact Kill (4/4 plans) -- completed 2026-02-12
- [x] Phase 6: UX Polish (11/11 plans) -- completed 2026-02-13

**Total:** 7 phases, 38 plans | [Full details](milestones/v1.0-ROADMAP.md)

</details>

### v2.0 Arena Evolution (In Progress)

**Milestone Goal:** Transform the arena experience with HD resolution, scrollable maps, multi-stage rounds, powerups, and proper tileset art.

**Phase Numbering:**
- Integer phases (7, 8, 9...): Planned milestone work
- Decimal phases (7.1, 8.1...): Urgent insertions (marked with INSERTED)

- [x] **Phase 7: HD Viewport & Camera** - 1280x720 resolution with camera follow and viewport-relative UI -- completed 2026-02-13
- [x] **Phase 8: Arena Overhaul** - Tileset art and larger scrollable arenas (50x38 tiles) -- completed 2026-02-14
- [x] **Phase 9: Multi-Stage Rounds** - Best-of-3 match structure with stage transitions -- completed 2026-02-18
- [x] **Phase 10: Powerup System** - Server-authoritative powerup spawning, collection, and temporary buffs -- completed 2026-02-18
- [x] **Phase 11: Minimap & Music** - Minimap overlay and music system with crossfade transitions (completed 2026-02-19)
- [ ] **Phase 12: HUD Icon Overhaul** - Icon-based HUD replacing text-only elements

## Phase Details

### Phase 7: HD Viewport & Camera
**Goal**: Players experience the game at 1280x720 with a camera that smoothly follows their character and all UI renders correctly at the new resolution
**Depends on**: Nothing (first phase of v2.0; builds on v1.0 foundation)
**Requirements**: DISP-01, DISP-02, DISP-03, DISP-04
**Success Criteria** (what must be TRUE):
  1. Game launches at 1280x720 and pixel art tiles render crisp without blurring or sub-pixel artifacts
  2. Camera smoothly follows the local player with a deadzone so small movements do not cause constant scrolling
  3. Camera stops at world edges -- no black void or out-of-bounds rendering is visible
  4. Boot, Lobby, Victory, Help, and HUD scenes all display correctly at 1280x720 with no elements cut off or mispositioned
  5. ARENA bounds are dynamic (read from map metadata, not a hardcoded global constant) so physics edge-clamping works for any map size
**Plans:** 9 plans -- completed 2026-02-13

Plans:
- [x] 07-01-PLAN.md -- 2x asset generation (characters 64x64, projectiles 16x16, improved tilesets)
- [x] 07-02-PLAN.md -- Resolution config (1280x720) and dynamic arena bounds
- [x] 07-03-PLAN.md -- BootScene 2x asset loading and 36-frame animation registration
- [x] 07-04-PLAN.md -- Camera system (follow, deadzone, look-ahead, speed zoom, shake, overview, spectator)
- [x] 07-05-PLAN.md -- HUD viewport-relative positioning + Lobby/Victory/Help scene updates
- [~] 07-06-PLAN.md -- Visual verification checkpoint (skipped: covered by gap closure + verification)
- [x] 07-07-PLAN.md -- Gap closure: camera follow race condition + look-ahead tuning
- [x] 07-08-PLAN.md -- Gap closure: HUD/Lobby overlap fixes + help screen redesign
- [x] 07-09-PLAN.md -- Gap closure: overview camera guard + help screen text containment

### Phase 8: Arena Overhaul
**Goal**: Arenas use the provided tileset art (hedge, brick, wood, ground) and are roughly 2x larger (50x38 tiles), each with a distinct visual theme and defined spawn points
**Depends on**: Phase 7 (camera follow and dynamic arena bounds required for larger maps)
**Requirements**: ARENA-01, ARENA-02, ARENA-03, ARENA-04, ARENA-05
**Success Criteria** (what must be TRUE):
  1. Arenas render using the 32x32 tileset spritesheets with no tile bleeding or visual seams
  2. Arenas are approximately 1600x1216 pixels (50x38 tiles) and the camera scrolls to reveal the full playspace
  3. Map JSON files are human-readable with named tile type references (not opaque numeric IDs)
  4. Each of the 3+ arenas has a visually distinct theme using different tileset combinations (e.g., hedge arena, brick arena, wood arena)
  5. Players spawn at map-defined locations appropriate to their role (Paran separated from Guardians)
**Plans:** 5 plans -- completed 2026-02-14

Plans:
- [x] 08-01-PLAN.md -- Generate composite tilesets (128x96) and 50x38 map JSONs via Python script
- [x] 08-02-PLAN.md -- Integrate new tilesets/maps into game pipeline (tile IDs, map metadata, overview zoom, cleanup)
- [x] 08-03-PLAN.md -- Gap closure: fix PredictionSystem arena bounds race condition (collision desync)
- [x] 08-04-PLAN.md -- Gap closure: per-map validated spawn points (spawn inside walls)
- [x] 08-05-PLAN.md -- Gap closure: fix auto-tile rule shadowing (Rule 1/5 shadow Rule 4) and regenerate maps

### Phase 9: Multi-Stage Rounds
**Goal**: Matches play as best-of-3 with each stage on a different arena, smooth transitions between stages, and a final winner declaration
**Depends on**: Phase 8 (needs pool of 3+ arena maps for stage rotation)
**Requirements**: ROUND-01, ROUND-02, ROUND-03, ROUND-04, ROUND-05, ROUND-06, DISP-05
**Success Criteria** (what must be TRUE):
  1. A match consists of up to 3 stages and the first side to win 2 stages wins the match
  2. Each stage loads a different arena -- no arena repeats within a single match
  3. Between stages, a transition screen shows the round number, arena name, and current score before play begins
  4. All game state resets cleanly between stages (health, positions, projectiles, obstacles) with no ghost entities or stale data
  5. The round score (e.g., "1-0") is visible throughout the match and the final victory screen shows best-of-3 results with per-stage breakdown
**Plans:** 5 plans -- completed 2026-02-18

Plans:
- [x] 09-01-PLAN.md -- Server-side best-of-3 stage lifecycle (schema, state machine, arena selection, state reset)
- [x] 09-02-PLAN.md -- Client stage transitions (tilemap swap, camera zoom, StageIntroScene overlay, BootScene preload)
- [x] 09-03-PLAN.md -- HUD round score display and VictoryScene per-stage breakdown
- [x] 09-04-PLAN.md -- Gap closure: iris wipe transition, teleport fix, spawn collision validation
- [x] 09-05-PLAN.md -- Gap closure: iris wipe fill color fix, position backfill, isSpectating race condition

### Phase 09.1: Tilemap collision masks for precise wall/obstacle collisions (INSERTED)

**Goal:** Replace full-tile AABB collision with sub-tile rectangle collision shapes so players and projectiles collide with the visual edges of walls and obstacles, not invisible tile boundaries
**Depends on:** Phase 9
**Requirements:** COLL-MASK-01, COLL-MASK-02, COLL-MASK-03, COLL-MASK-04, COLL-MASK-05
**Plans:** 3 plans -- completed 2026-02-17

Plans:
- [x] 09.1-01-PLAN.md -- Auto-derive collision rects from tilesets + embed in map JSONs
- [x] 09.1-02-PLAN.md -- CollisionGrid sub-rect resolution algorithm + isPointInSolidRect
- [x] 09.1-03-PLAN.md -- Server/client integration + F3 debug visualization overlay

### Phase 10: Powerup System
**Goal**: Powerups spawn during gameplay, players collect them on contact, and temporary buffs (speed, invincibility, larger projectiles) add tactical depth to arena combat
**Depends on**: Phase 9 (powerups integrate with stage lifecycle -- cleared between stages, spawn timers reset)
**Requirements**: PWR-01, PWR-02, PWR-03, PWR-04, PWR-05, PWR-06, PWR-07
**Success Criteria** (what must be TRUE):
  1. Powerups appear at random arena positions during gameplay with a visible bobbing animation using the potion icon sprites
  2. Walking over a powerup collects it (server-authoritative -- no desync between players about who picked it up)
  3. Speed boost, invincibility, and larger projectile hitbox each produce a distinct, observable gameplay effect
  4. The HUD shows which powerup is active on the player with a visible countdown indicator for remaining duration
  5. Powerups are cleared between stages and spawn fresh each stage
**Plans:** 5/5 plans complete

Plans:
- [x] 10-01-PLAN.md -- Shared powerup constants, Schema definitions, server spawn/collection/buff/stage-cleanup
- [x] 10-02-PLAN.md -- Client asset preloading (potion sprites), SFX definitions, ParticleFactory aura methods
- [x] 10-03-PLAN.md -- Server buff gameplay effects (speed/invincibility/projectile/beam) + client prediction sync
- [x] 10-04-PLAN.md -- GameScene powerup rendering + HUD buff indicators + kill feed + beam visuals
- [x] 10-05-PLAN.md -- Gap closure: sprite size 2x, WAV pickup SFX, aura visibility, 5x durations, type coercion fix

### Phase 11: Minimap & Music
**Goal**: Players have global arena awareness via a minimap overlay and matches have atmosphere through looping music with smooth transitions
**Depends on**: Phase 8 (minimap needs larger arenas to be meaningful); music is independent but grouped here as a polish subsystem
**Requirements**: MMAP-01, MMAP-02, MMAP-03, AUD-01, AUD-02, AUD-03
**Success Criteria** (what must be TRUE):
  1. A semi-transparent minimap overlay is visible during gameplay showing the full arena in miniature
  2. Player positions appear on the minimap as role-colored markers that update in real-time
  3. Lobby scene plays background music on loop from the provided lobby soundtrack
  4. A randomly selected stage track plays during all stages of a match, and a different track is picked for each new game
  5. Music crossfades smoothly between lobby and game transitions with no jarring cuts or silence gaps
**Plans:** 4/4 plans complete

Plans:
- [x] 11-01-PLAN.md -- AudioManager extension (crossfade, loop-with-pause, volume dip, WAV methods) + asset pipeline
- [x] 11-02-PLAN.md -- Minimap overlay on HUDScene (wall blocks, player dots, powerup dots, toggle, death markers)
- [x] 11-03-PLAN.md -- Music integration across scenes (lobby/stage/victory/defeat) + WAV SFX replacements + volume sliders
- [ ] 11-04-PLAN.md -- Gap closure: kill feed overflow, laser SFX overlap, lobby music restart

### Phase 12: HUD Icon Overhaul
**Goal**: All HUD elements use the provided icon assets (hearts, timer, skull, potions, gravestone) replacing text-only displays, properly laid out for 1280x720 with round and powerup indicators
**Depends on**: Phase 10 (powerup indicators need powerup system), Phase 9 (round counter needs stage system)
**Requirements**: HUD-01, HUD-02, HUD-03, HUD-04, HUD-05, HUD-06
**Success Criteria** (what must be TRUE):
  1. Health is displayed using heart icon sprites (filled/empty) instead of text or colored bars
  2. Timer and kill feed use their respective icon assets (timer icon, skull/gravestone icons) instead of plain text
  3. Round counter shows current stage progress (e.g., "1-0") with a visual stage indicator
  4. Active powerup type and remaining duration are shown in the HUD using potion icon sprites
  5. All HUD elements are positioned correctly at 1280x720 with no overlap, cutoff, or misalignment
**Plans:** 1/2 plans executed

Plans:
- [ ] 12-01-PLAN.md -- Asset pipeline + heart health display + timer icon + round score pips + potion color mapping
- [ ] 12-02-PLAN.md -- Kill feed skull icons + arena gravestones + death overlay + radial powerup indicators + low-health tint pulse + layout pass

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 8 -> 9 -> 10 -> 11 -> 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-6 | v1.0 | 38/38 | Complete | 2026-02-13 |
| 7. HD Viewport & Camera | v2.0 | 9/9 | Complete | 2026-02-13 |
| 8. Arena Overhaul | v2.0 | 5/5 | Complete | 2026-02-14 |
| 9. Multi-Stage Rounds | v2.0 | 5/5 | Complete | 2026-02-18 |
| 10. Powerup System | v2.0 | 5/5 | Complete | 2026-02-18 |
| 11. Minimap & Music | 4/4 | Complete    | 2026-02-19 | - |
| 12. HUD Icon Overhaul | 1/2 | In Progress|  | - |

---
*Created: 2026-02-09*
*Last updated: 2026-02-19 (Phase 11 gap closure plan added)*

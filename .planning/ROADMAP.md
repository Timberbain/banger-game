# Roadmap: Banger

## Overview

Building a browser-based asymmetric 1v2 multiplayer shooter with server-authoritative architecture. From foundation (Phaser + Colyseus setup) through core gameplay (movement, combat, collisions) to multiplayer systems (lobbies, matchmaking) and polish (accounts, stats, UX). The roadmap prioritizes establishing the authority model early to prevent architectural rewrites, then delivers playable gameplay incrementally before adding retention features.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Server Architecture** - Establish infrastructure and authority model
- [x] **Phase 2: Core Movement** - Acceleration-based physics with client prediction
- [x] **Phase 3: Combat System** - Projectiles, collision detection, damage system
- [x] **Phase 4: Match Lifecycle & Maps** - Win conditions, multiple arenas, spectator mode
- [x] **Phase 5: Multiplayer Lobbies** - Room codes, matchmaking, character selection
- [ ] **Phase 6: UX Polish** - HUD, audio, visual feedback, tutorial

## Phase Details

### Phase 1: Foundation & Server Architecture
**Goal**: Working client-server connection with authority model established
**Depends on**: Nothing (first phase)
**Requirements**: NET-01, NET-04, NET-05, NET-06, MAP-02
**Success Criteria** (what must be TRUE):
  1. Player can open game in browser and connect to server
  2. Server runs at fixed 60Hz tick rate with authoritative game state
  3. Delta state synchronization works (only changed properties transmitted)
  4. Server validates all client input and rejects impossible values
  5. Latency simulation tools configured for testing at 100ms+
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Server foundation (Express + Colyseus + Schema state + 60Hz GameRoom)
- [x] 01-02-PLAN.md — Client foundation (Vite + Phaser + Tiled test arena map)
- [x] 01-03-PLAN.md — Integration (client-server connection, input validation, latency simulation)

### Phase 2: Core Movement
**Goal**: Players can move characters with responsive acceleration-based physics
**Depends on**: Phase 1
**Requirements**: GAME-01, GAME-02, GAME-10, NET-02, NET-03, NET-07, NET-08
**Success Criteria** (what must be TRUE):
  1. Player controls character with WASD/arrow keys using acceleration-based movement
  2. Character faces movement direction automatically
  3. Local player movement feels responsive (input-to-visual latency under 100ms)
  4. Remote players move smoothly via interpolation
  5. Game remains playable at up to 150ms network latency
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — Shared physics constants + server acceleration-based movement
- [x] 02-02-PLAN.md — Client prediction, entity interpolation, and latency verification

### Phase 3: Combat System
**Goal**: Players can fire projectiles and deal damage with collision detection
**Depends on**: Phase 2
**Requirements**: GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, MAP-03
**Success Criteria** (what must be TRUE):
  1. Players fire projectiles in their facing direction
  2. Projectiles deal damage on hit; characters die at zero health
  3. Faran and Baran have distinct stats (low health, high agility, rapid weak attacks)
  4. Paran has distinct stats (high health, slow acceleration, powerful attacks, Pac-Man cardinal movement with instant direction change)
  5. Paran loses all speed on collision with walls
  6. Arena edges block all players
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md -- Server combat: character stats, projectile lifecycle, collision detection, Paran wall penalty
- [x] 03-02-PLAN.md -- Client combat: fire input, projectile rendering, health display, role differentiation + human verify

### Phase 4: Match Lifecycle & Maps
**Goal**: Complete matches with win conditions on multiple hand-crafted maps
**Depends on**: Phase 3
**Requirements**: GAME-09, MAP-01, MAP-04, FLOW-03, FLOW-04, FLOW-05, UX-06
**Success Criteria** (what must be TRUE):
  1. Match ends when all guardians or Paran are eliminated
  2. Victory/defeat screen shows match outcome with stats (kills, damage, accuracy, collisions)
  3. Players return to lobby after match ends
  4. 3-5 hand-crafted arena maps with distinct obstacle layouts exist
  5. Maps rotate between matches
  6. Eliminated players can spectate remainder of match
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Server match state machine, win conditions, and per-player stats tracking
- [x] 04-02-PLAN.md — Client victory/defeat screen with stats display and spectator mode
- [x] 04-03-PLAN.md — Hand-crafted arena maps (3 new) and sequential map rotation

### Phase 5: Multiplayer Lobbies
**Goal**: Players can find matches via room codes or matchmaking
**Depends on**: Phase 4
**Requirements**: MULT-01, MULT-02, MULT-03, MULT-04, MULT-05, FLOW-01, FLOW-02, NET-09
**Success Criteria** (what must be TRUE):
  1. Player can create private room and share room code
  2. Player can join private room by entering room code
  3. Player can queue for automatic matchmaking
  4. Matchmaking fills rooms with 3 players (1 Paran + 2 guardians)
  5. Lobby shows connected players and readiness state
  6. Player selects character before match begins
  7. Match begin with countdown after all 3 players ready
  8. Player can reconnect to active match within grace period (30-60s)
**Plans:** 13 plans (complete)

Plans:
- [x] 05-01-PLAN.md — Server lobby infrastructure (LobbyRoom, LobbyState, MatchmakingQueue, room codes)
- [x] 05-02-PLAN.md — Client LobbyScene UI (create/join/queue, character selection, ready, countdown)
- [x] 05-03-PLAN.md — Reconnection grace period (server allowReconnection, client token persistence)
- [x] 05-04-PLAN.md — Gap closure: Fix phantom seat + role assignment (blockers)
- [x] 05-05-PLAN.md — Gap closure: Fix room code display + character selection highlight
- [x] 05-06-PLAN.md — Gap closure: Matchmaking redesign with dedicated MatchmakingRoom
- [x] 05-07-PLAN.md — Gap closure: Fix reconnection retry + disconnect ghosting
- [x] 05-08-PLAN.md — Gap closure v2: Lobby input keys, character deselect, lobby reconnect, retry window
- [x] 05-09-PLAN.md — Gap closure v2: Consistent game status text via Schema listener
- [x] 05-10-PLAN.md — Gap closure v3: GameScene state reset + server crash protection
- [x] 05-11-PLAN.md — Gap closure v3: Matchmaking role highlight + lobby reconnect retry
- [x] 05-12-PLAN.md — Gap closure v4: S key input fix + sessionStorage for reconnection tokens
- [x] 05-13-PLAN.md — Gap closure v5: Fix focus event listener race condition for WASD in room code input

### Phase 05.1: Arena Collisions & Paran Contact Kill (INSERTED)

**Goal:** Tile-based obstacle collision for all players, Paran contact kill mechanic, projectile-wall destruction, and destructible obstacles with 3 durability tiers across all 4 maps
**Depends on:** Phase 5
**Requirements**: GAME-07, GAME-08, MAP-03
**Success Criteria** (what must be TRUE):
  1. All players physically collide with tile-based obstacles and cannot pass through them
  2. Paran loses ALL velocity on collision with any wall or obstacle (core momentum penalty)
  3. Paran instantly kills guardians on body collision (contact kill, any speed, no HP threshold)
  4. Projectiles destroyed on contact with walls/obstacles; destructible obstacles take damage
  5. Destructible obstacles have 3 tiers (Light/Medium/Heavy) with distinct visuals and HP
  6. Paran instant-breaks any destructible obstacle on contact (wrecking ball mechanic)
  7. All 4 maps updated with strategic obstacle layouts
  8. Client prediction matches server collision (no jitter or wall-clipping)
**Plans:** 3 plans

Plans:
- [x] 05.1-01-PLAN.md -- Shared collision infrastructure, tileset expansion, map obstacle layouts
- [x] 05.1-02-PLAN.md -- Server collision enforcement, contact kill, projectile-wall, destructible obstacles
- [x] 05.1-03-PLAN.md -- Client prediction collision integration, obstacle destruction rendering

### Phase 6: UX Polish
**Goal**: Game has polished interface, audio, and onboarding
**Depends on**: Phase 5
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-07
**Success Criteria** (what must be TRUE):
  1. HUD displays health bars, ability cooldowns, and match timer
  2. Visual hit feedback appears (hit markers, flash on damage)
  3. Audio plays for shots, hits, deaths, and match events
  4. Controls tutorial/help screen accessible from menu
  5. Connection quality indicator visible during gameplay
  6. Pixel art sprites and tileset with solarpunk aesthetic exist
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Server Architecture | 3/3 | ✓ Complete | 2026-02-10 |
| 2. Core Movement | 2/2 | ✓ Complete | 2026-02-10 |
| 3. Combat System | 2/2 | ✓ Complete | 2026-02-10 |
| 4. Match Lifecycle & Maps | 3/3 | ✓ Complete | 2026-02-10 |
| 5. Multiplayer Lobbies | 13/13 | ✓ Complete | 2026-02-11 |
| 5.1 Arena Collisions & Contact Kill | 3/3 | ✓ Complete | 2026-02-12 |
| 6. UX Polish | 0/TBD | Not started | - |

---
*Created: 2026-02-09*
*Last updated: 2026-02-12 (Phase 05.1 complete — Arena Collisions & Contact Kill)*

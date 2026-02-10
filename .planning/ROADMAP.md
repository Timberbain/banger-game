# Roadmap: Banger

## Overview

Building a browser-based asymmetric 1v2 multiplayer shooter with server-authoritative architecture. From foundation (Phaser + Colyseus setup) through core gameplay (movement, combat, collisions) to multiplayer systems (lobbies, matchmaking) and polish (accounts, stats, UX). The roadmap prioritizes establishing the authority model early to prevent architectural rewrites, then delivers playable gameplay incrementally before adding retention features.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Server Architecture** - Establish infrastructure and authority model
- [ ] **Phase 2: Core Movement** - Acceleration-based physics with client prediction
- [ ] **Phase 3: Combat System** - Projectiles, collision detection, damage system
- [ ] **Phase 4: Match Lifecycle & Maps** - Win conditions, multiple arenas, spectator mode
- [ ] **Phase 5: Multiplayer Lobbies** - Room codes, matchmaking, character selection
- [ ] **Phase 6: Accounts & Stats** - Light accounts, stat tracking, match history
- [ ] **Phase 7: UX Polish** - HUD, audio, visual feedback, tutorial

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
**Plans**: TBD

Plans:
- [ ] 02-01: TBD during planning

### Phase 3: Combat System
**Goal**: Players can fire projectiles and deal damage with collision detection
**Depends on**: Phase 2
**Requirements**: GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, MAP-03
**Success Criteria** (what must be TRUE):
  1. Players fire projectiles in their facing direction
  2. Projectiles deal damage on hit; characters die at zero health
  3. Faran and Baran have distinct stats (low health, high agility, rapid weak attacks)
  4. Paran has distinct stats (high health, slow acceleration, powerful attacks, instant turning)
  5. Paran loses all speed on collision with walls or obstacles
  6. Arena edges block all players
**Plans**: TBD

Plans:
- [ ] 03-01: TBD during planning

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
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during planning

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
  7. Match begins with countdown after all 3 players ready
  8. Player can reconnect to active match within grace period (30-60s)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during planning

### Phase 6: Accounts & Stats
**Goal**: Players have persistent accounts with tracked stats
**Depends on**: Phase 5
**Requirements**: ACCT-01, ACCT-02, ACCT-03, ACCT-04
**Success Criteria** (what must be TRUE):
  1. Player can create account with username and password
  2. Player session persists across browser refresh
  3. Player stats tracked (wins, losses, games played per character)
  4. Player can view their own stats
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during planning

### Phase 7: UX Polish
**Goal**: Game has polished interface, audio, and onboarding
**Depends on**: Phase 6
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
- [ ] 07-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Server Architecture | 3/3 | ✓ Complete | 2026-02-10 |
| 2. Core Movement | 0/TBD | Not started | - |
| 3. Combat System | 0/TBD | Not started | - |
| 4. Match Lifecycle & Maps | 0/TBD | Not started | - |
| 5. Multiplayer Lobbies | 0/TBD | Not started | - |
| 6. Accounts & Stats | 0/TBD | Not started | - |
| 7. UX Polish | 0/TBD | Not started | - |

---
*Created: 2026-02-09*
*Last updated: 2026-02-10*

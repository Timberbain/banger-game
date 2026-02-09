# Requirements: Banger

**Defined:** 2026-02-09
**Core Value:** The asymmetric momentum mechanic must feel right — Paran building speed with instant turning but losing everything on collision, guardians relying on positioning and teamwork to force those collisions.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Gameplay

- [ ] **GAME-01**: Player controls character with acceleration-based movement (WASD/arrow keys)
- [ ] **GAME-02**: Characters face their movement direction automatically
- [ ] **GAME-03**: Players fire projectiles in their facing direction
- [ ] **GAME-04**: Projectiles deal flat damage on hit; characters die at zero health
- [ ] **GAME-05**: Faran and Baran have low health, high agility, fast acceleration, rapid weak attacks
- [ ] **GAME-06**: Paran has high health, high top speed, slow acceleration, instant turning, powerful infrequent attacks
- [ ] **GAME-07**: Paran loses all speed on collision with walls or obstacles
- [ ] **GAME-08**: Arena has bounded edges that all players collide with
- [ ] **GAME-09**: Match ends when all guardians or Paran are eliminated
- [ ] **GAME-10**: Balance levers (speeds, damage, cooldowns, health) are configurable via shared constants

### Networking

- [ ] **NET-01**: Server-authoritative game state — all physics and combat run on Colyseus server
- [ ] **NET-02**: Client-side prediction for local player movement with server reconciliation
- [ ] **NET-03**: Entity interpolation for remote players (smooth movement between server updates)
- [ ] **NET-04**: Delta state sync via Colyseus Schema (only changed properties transmitted)
- [ ] **NET-05**: Server tick rate of 60Hz with fixed timestep
- [ ] **NET-06**: Input validation on server (reject impossible speeds, cooldown bypasses)
- [ ] **NET-07**: Perceived input-to-visual latency under 100ms on typical connections
- [ ] **NET-08**: Playable at up to 150ms network latency
- [ ] **NET-09**: Reconnection with grace period (30-60s) to rejoin active match

### Multiplayer

- [ ] **MULT-01**: Player can create private room and receive shareable room code
- [ ] **MULT-02**: Player can join private room by entering room code
- [ ] **MULT-03**: Player can queue for automatic matchmaking
- [ ] **MULT-04**: Matchmaking fills rooms with 3 players (1 Paran + 2 guardians)
- [ ] **MULT-05**: Lobby shows connected players and readiness state

### Match Flow

- [ ] **FLOW-01**: Player selects character (Faran, Baran, or Paran) before match
- [ ] **FLOW-02**: Match begins with countdown after all 3 players ready
- [ ] **FLOW-03**: Victory/defeat screen shows match outcome
- [ ] **FLOW-04**: Post-match stats show kills, damage dealt, accuracy, collisions forced
- [ ] **FLOW-05**: Player returns to lobby after match ends

### Maps

- [ ] **MAP-01**: 3-5 hand-crafted arena maps with distinct obstacle layouts
- [ ] **MAP-02**: Maps loaded from Tiled-compatible tilemap format
- [ ] **MAP-03**: Obstacles affect Paran navigation (collision penalty zones)
- [ ] **MAP-04**: Map selection or rotation between matches

### Accounts

- [ ] **ACCT-01**: Player can create account with username and password
- [ ] **ACCT-02**: Player session persists across browser refresh
- [ ] **ACCT-03**: Player stats tracked: wins, losses, games played per character
- [ ] **ACCT-04**: Player can view their own stats

### UX & Polish

- [ ] **UX-01**: HUD displays health bars, ability cooldowns, and match timer
- [ ] **UX-02**: Visual hit feedback (hit markers, flash on damage)
- [ ] **UX-03**: Audio feedback for shots, hits, deaths, and match events
- [ ] **UX-04**: Controls tutorial/help screen accessible from menu
- [ ] **UX-05**: Connection quality indicator visible during gameplay
- [ ] **UX-06**: Eliminated players can spectate remainder of match
- [ ] **UX-07**: Pixel art sprites and tileset with solarpunk aesthetic

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Competitive

- **LEAD-01**: Global leaderboards (daily/weekly/all-time)
- **RANK-01**: Skill-based matchmaking with rating system
- **RANK-02**: Ranked competitive mode

### Social

- **COSM-01**: Character cosmetic skins
- **SOCL-01**: Friend system and party queuing
- **CHAT-01**: In-game quick chat wheel

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Local/split-screen multiplayer | Online-only simplifies architecture |
| Mobile touch controls | Desktop browser focus for v1 |
| Voice chat | Toxicity management burden, use external apps |
| Procedural map generation | Hand-crafted maps better for competitive balance |
| Single-player campaign | Arena game, not narrative |
| AI bots | Hard to balance for asymmetric 1v2, human-only |
| NFT/blockchain | Negative community reaction |
| Pay-to-win mechanics | Destroys competitive integrity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (Populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 0
- Unmapped: 38

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-09 after initial definition*

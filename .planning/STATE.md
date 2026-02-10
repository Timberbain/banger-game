# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The asymmetric momentum mechanic must feel right — Paran building terrifying speed with instant turning but losing everything on collision, guardians relying on positioning and teamwork to force those collisions.
**Current focus:** Phase 4 (Match Lifecycle & Maps)

## Current Position

Phase: 4 of 7 (Match Lifecycle & Maps)
Plan: 2 of 3
Status: In Progress
Last activity: 2026-02-10 — Completed 04-02-PLAN.md (Client Match End UI & Spectator Mode)

Progress: [███████░░░] 60% (9 of 12 plans complete: Phase 1-3 done, Phase 4: 2/3 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 11.3 min
- Total execution time: 3.07 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-server-architecture | 3 | 26 min | 8.7 min |
| 02-core-movement | 2 | 29 min | 14.5 min |
| 03-combat-system | 2 | 48 min | 24.0 min |
| 04-match-lifecycle-maps | 2 | 13 min | 6.5 min |

**Recent Trend:**
- Last 5 plans: 03-01 (3 min), 03-02 (45 min), 04-01 (10 min), 04-02 (3 min)
- Trend: Phase 4 very fast (6.5 min avg), straightforward UI implementation

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Phaser for game engine — User preference, mature browser game framework
- Phase 1: Colyseus for multiplayer — User preference, built for authoritative game servers
- Phase 1: Online multiplayer only — Simplifies input handling, single networking model
- 01-01: Colyseus 0.15.57 instead of 0.17.x — Missing peer dependencies in 0.17 branch
- 01-01: patchRate = 1000/60 to match tick rate — Ensures smooth 60Hz state sync, prevents choppy updates
- 01-01: Input queue 10-entry cap — Prevents memory abuse from malicious clients
- 01-01: Server-only inputQueue (no @type) — Security and bandwidth optimization
- 01-02: Colyseus.js 0.16.22 instead of 0.17.0 — Version 0.17.0 does not exist, 0.16.22 is latest stable
- 01-02: Canvas package for tileset generation — Programmatic PNG creation for colored tile variants
- 01-03: Colyseus.js downgrade to 0.15.28 — WebSocket protocol compatibility with server 0.15.57
- 01-03: Pure server authority (no client prediction) — Phase 1 proves authoritative model; prediction is Phase 2
- 01-03: Non-punitive input validation — Silent rejection with warning; kick threshold deferred
- 01-03: WebSocket latency simulation via setTimeout — HTTP middleware doesn't affect WebSocket messages
- 02-01: Relative imports for shared module — Simpler than path mapping, works with ts-node-dev without config
- 02-01: Fixed timestep 1/60s not deltaTime — Ensures deterministic physics matching client prediction
- 02-01: Clamp velocity at arena edges — Prevents wall sliding misprediction from accumulated velocity
- 02-02: Send input every frame (not just on change) — Acceleration physics requires one input per tick to match server's 60Hz fixed timestep
- 02-02: Apply drag physics on server when input queue empty — Player must decelerate when client stops sending input
- 02-02: 100ms interpolation delay for remote players — Balances smoothness with visual latency
- 03-01: Character-specific physics overrides — Enables asymmetric gameplay while keeping shared physics logic
- 03-01: Paran wall penalty (lose ALL velocity) — Core asymmetric mechanic for high-speed glass cannon role
- 03-01: Fire input in queue (not separate handler) — Keeps fire synchronized with movement at 60Hz
- 03-01: Server-only lastFireTime (no @type) — Cooldown enforcement is server-authoritative, reduces bandwidth
- 03-02: Paran Pac-Man style cardinal movement — Last-key-wins, instant stop, speed redirects; simplifies high-speed control
- 03-02: Guardian instant stop on input release — Zero velocity immediately (not gradual drag); more responsive control
- 03-02: Guardian maxVelocity 160 (from 220) — Less floaty/slidey; balances mobility vs precise positioning
- 03-02: Client-side projectile interpolation (not prediction) — Smooth rendering between server updates without prediction complexity
- 04-01: Match starts when 3 players join — Automatic transition from WAITING to PLAYING
- 04-01: Room locked on match start — Prevents mid-game joins
- 04-01: Dead player input drained and ignored — Prevents ghost shooting
- 04-01: Stats synced to clients via MapSchema — Clients can display live stats
- 04-01: Auto-disconnect 15s after match end — Gives time to view stats
- 04-01: Player leaving during PLAYING triggers win check — Counts as elimination
- 04-02: scene.launch (not scene.start) for VictoryScene — Keeps GameScene visible underneath as overlay
- 04-02: matchEnd message with stats (not Schema listener) — Avoids stale stats pitfall
- 04-02: Tab key for spectator camera cycling — Familiar FPS convention

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-10 (phase execution)
Stopped at: Completed 04-02-PLAN.md (Client Match End UI & Spectator Mode) — Phase 4: 2 of 3 plans complete
Resume file: .planning/phases/04-match-lifecycle-maps/04-02-SUMMARY.md

**Phase 4 Progress (2 of 3):**
- 04-01 Complete: Match lifecycle state machine (WAITING → PLAYING → ENDED)
  - Match starts when 3 players join, room locked during PLAYING
  - Win conditions: all guardians dead = paran wins, paran dead = guardians win
  - Per-player stats tracking (kills, deaths, damage, shots fired/hit, accuracy)
  - matchEnd broadcast with final stats, auto-disconnect after 15s
- 04-02 Complete: Client match end UI and spectator mode
  - VictoryScene overlay with stats table (kills, deaths, damage, accuracy)
  - Local player highlighted in yellow for quick identification
  - Spectator mode for eliminated players (Tab to cycle camera between alive players)
  - Return to Lobby button (disconnects from room, returns to BootScene)
  - Match state status text (waiting, match started, spectating)
- Next: 04-03 Arena map system with structured tilemap and spawn positions

**Phase 3 Complete:**
- Server-authoritative combat system with projectiles, collision, damage, death
- Character archetypes: faran/baran guardians (50 HP, fast fire) vs paran force (150 HP, slow fire, high damage)
- Client fire input (spacebar), projectile rendering with interpolation, health bar UI
- Role-based visual differentiation (size, color) and gameplay (fire rate, damage, speed)
- Paran Pac-Man style cardinal movement (last-key-wins, instant stop, speed redirects)
- Guardian instant stop mechanic (zero velocity on input release)
- Paran wall penalty mechanic (loses all velocity on wall collision)

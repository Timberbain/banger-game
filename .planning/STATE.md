# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The asymmetric momentum mechanic must feel right — Paran building terrifying speed with instant turning but losing everything on collision, guardians relying on positioning and teamwork to force those collisions.
**Current focus:** Phase 3 (Combat System)

## Current Position

Phase: 3 of 7 (Combat System)
Plan: 2 of 2
Status: Complete
Last activity: 2026-02-10 — Completed 03-02-PLAN.md (Client Combat Rendering)

Progress: [█████░░░░░] 50% (Phases 1-3 complete, total: 7 of 9 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 12.7 min
- Total execution time: 2.75 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-server-architecture | 3 | 26 min | 8.7 min |
| 02-core-movement | 2 | 29 min | 14.5 min |
| 03-combat-system | 2 | 48 min | 24.0 min |

**Recent Trend:**
- Last 5 plans: 02-01 (6 min), 02-02 (23 min), 03-01 (3 min), 03-02 (45 min)
- Trend: Variable (03-02 included checkpoint iteration with 7 fix commits)

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-10 (phase execution)
Stopped at: Completed 03-02-PLAN.md (Client Combat Rendering) — Phase 3 complete (2 of 2 plans)
Resume file: .planning/phases/03-combat-system/03-02-SUMMARY.md

**Phase 3 Complete:**
- Server-authoritative combat system with projectiles, collision, damage, death
- Character archetypes: faran/baran guardians (50 HP, fast fire) vs paran force (150 HP, slow fire, high damage)
- Client fire input (spacebar), projectile rendering with interpolation, health bar UI
- Role-based visual differentiation (size, color) and gameplay (fire rate, damage, speed)
- Paran Pac-Man style cardinal movement (last-key-wins, instant stop, speed redirects)
- Guardian instant stop mechanic (zero velocity on input release)
- Paran wall penalty mechanic (loses all velocity on wall collision)
- Combat loop verified by human — ready for Phase 4 (Server Reconciliation)

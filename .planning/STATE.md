# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The asymmetric momentum mechanic must feel right — Paran building terrifying speed with instant turning but losing everything on collision, guardians relying on positioning and teamwork to force those collisions.
**Current focus:** Phase 3 (Combat System)

## Current Position

Phase: 3 of 7 (Combat System)
Plan: 1 of 2
Status: In progress
Last activity: 2026-02-10 — Completed 03-01-PLAN.md (Server Combat Core)

Progress: [████░░░░░░] 40% (Phases 1-2 complete, Phase 3: 1 of 2 plans done, total: 6 of 9 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 10.0 min
- Total execution time: 2.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-server-architecture | 3 | 26 min | 8.7 min |
| 02-core-movement | 2 | 29 min | 14.5 min |
| 03-combat-system | 1 | 3 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 01-03 (15 min), 02-01 (6 min), 02-02 (23 min), 03-01 (3 min)
- Trend: Decreasing (03-01 was fast, no checkpoints needed)

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-10 (phase execution)
Stopped at: Completed 03-01-PLAN.md (Server Combat Core) — Phase 3 plan 1 of 2 done
Resume file: .planning/phases/03-combat-system/03-01-SUMMARY.md

**Phase 3 Progress:**
- Server-authoritative combat system implemented
- Character archetypes defined (faran/baran guardians, paran force)
- Projectile spawning, simulation, and collision detection
- Role-specific physics (acceleration, drag, maxVelocity per character)
- Paran wall penalty mechanic (loses all velocity on wall collision)
- Fire rate cooldown enforcement (200ms for guardians, 1000ms for Paran)
- Ready for client combat implementation (03-02)

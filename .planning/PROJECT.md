# Banger

## What This Is

A 2D top-down asymmetric multiplayer shooter set in a solarpunk world, played in the browser. Two guardians (Faran & Baran) cooperate to defend against a single overwhelming force of nature (Paran) in fast-paced 1v2 arena combat. Players connect online, find matches through room codes or matchmaking, select characters, and fight across 4 hand-crafted arenas until one side is eliminated.

## Core Value

The asymmetric momentum mechanic must feel right — Paran building terrifying speed with Pac-Man cardinal movement but losing everything on collision, guardians relying on positioning and teamwork to force those collisions. If this core dynamic doesn't create tension, nothing else matters.

## Requirements

### Validated

- Real-time online 1v2 asymmetric combat with authoritative server — v1.0
- Three distinct characters (Faran, Baran, Paran) with asymmetric stats and feel — v1.0
- Acceleration-based movement physics with collision penalties for Paran — v1.0
- Projectile combat with directional firing — v1.0
- Multiple hand-crafted arena maps with obstacle layouts (4 maps) — v1.0
- Room code system for playing with friends — v1.0
- Automatic matchmaking for finding games — v1.0
- Character selection before each match — v1.0
- Match flow: lobby → character select → countdown → combat → victory screen — v1.0
- Pixel art visual style with solarpunk aesthetic — v1.0
- Paran contact kill (instant guardian death on body collision) — v1.0
- Destructible obstacles with 3 durability tiers — v1.0
- HUD with health bars, cooldowns, timer, kill feed, ping indicator — v1.0
- Procedural audio system (jsfxr) with volume controls — v1.0
- Particle effects (hit flash, speed lines, death explosion, projectile trails) — v1.0
- Reconnection with 60s grace period — v1.0

### Active

(None — awaiting next milestone definition via `/gsd:new-milestone`)

### Out of Scope

- Local/split-screen multiplayer — online only
- Mobile support — desktop browser only
- Voice/text chat — players use external communication
- Ranked/competitive matchmaking — simple matchmaking only
- Account system — game fully playable without accounts; reconnection tokens suffice
- AI bots — hard to balance for asymmetric 1v2
- Procedural map generation — hand-crafted maps better for competitive balance

## Context

Shipped v1.0 MVP with 6,498 TypeScript LOC across server + client.
Tech stack: Phaser 3.90 + Vite 5 (client), Express + Colyseus 0.15 (server).
Server-authoritative architecture with 60Hz fixed timestep, delta sync via Colyseus Schema.
Client prediction with reconciliation for responsive movement, entity interpolation for remote players.
4 hand-crafted arena maps (800x608 pixels, 25x19 tiles) with sequential rotation.
Pixel art assets generated via Python PIL, procedural audio via jsfxr.

**Known tech debt:**
- Cross-browser audio testing not performed (Chrome-only development)
- LobbyRoom.ts has a TODO for lobby optimization (non-blocking)
- GAME-06 deviation: "instant turning" became Pac-Man cardinal movement (user-approved, plays better)

## Constraints

- **Engine**: Phaser 3.90 (browser game engine)
- **Networking**: Colyseus 0.15.57 (authoritative multiplayer server) — client must use colyseus.js 0.15.28
- **Platform**: Desktop web browsers — no mobile
- **Players**: Exactly 3 per match (1v2)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phaser for game engine | User preference, mature browser game framework | Good |
| Colyseus 0.15 for multiplayer | User preference, authoritative game servers; 0.17.x had missing peer deps | Good |
| Online multiplayer only | Simplifies input handling, single networking model | Good |
| Multiple hand-crafted maps (4) | More variety than single map, competitive balance | Good |
| Pixel art style | Fits solarpunk theme, PIL generation pipeline | Good |
| Pac-Man cardinal movement for Paran | Replaced "instant turning"; simplifies high-speed control, feels better | Good |
| Fixed timestep 1/60s (not deltaTime) | Deterministic physics matching client prediction | Good |
| Send input every frame | Acceleration physics requires 1 input per tick for server match | Good |
| Colyseus.js 0.15.28 client SDK | WebSocket protocol compat with server 0.15.57 | Good |
| sessionStorage for reconnect tokens | Per-tab isolation, survives F5 | Good |
| Shared CollisionGrid (pure TS) | No Phaser/server deps, used by both client prediction and server | Good |
| Contact kill (any speed, no threshold) | Simpler, more exciting; Paran is always dangerous | Good |
| matchMaker.createRoom (not create) | Avoids phantom seat reservation bug | Good |
| Account system moved to Out of Scope | Game fully playable without accounts; deferred to future milestone | Good |
| jsfxr procedural audio | No external audio files needed, consistent retro aesthetic | Good |

---
*Last updated: 2026-02-13 after v1.0 milestone*

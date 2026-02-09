# Banger

## What This Is

A 2D top-down asymmetric multiplayer shooter set in a solarpunk world, played in the browser. Two guardians (Faran & Baran) cooperate to defend against a single overwhelming force of nature (Paran) in fast-paced 1v2 arena combat. Players connect online, find matches through room codes or matchmaking, and fight until one side is eliminated.

## Core Value

The asymmetric momentum mechanic must feel right — Paran building terrifying speed with instant turning but losing everything on collision, guardians relying on positioning and teamwork to force those collisions. If this core dynamic doesn't create tension, nothing else matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Real-time online 1v2 asymmetric combat with authoritative server
- [ ] Three distinct characters (Faran, Baran, Paran) with asymmetric stats and feel
- [ ] Acceleration-based movement physics with collision penalties for Paran
- [ ] Projectile combat with directional firing
- [ ] Multiple hand-crafted arena maps with obstacle layouts
- [ ] Room code system for playing with friends
- [ ] Automatic matchmaking for finding games
- [ ] Light account system with stat/win tracking
- [ ] Character selection before each match
- [ ] Match flow: lobby → character select → countdown → combat → victory screen
- [ ] Pixel art visual style with solarpunk aesthetic

### Out of Scope

- Local/split-screen multiplayer — online only for v1
- Progression/unlock systems — light accounts track stats, no unlockables
- Mobile support — desktop browser only
- Voice/text chat — players use external communication
- Spectator mode — not in v1
- Ranked/competitive matchmaking — simple matchmaking only

## Context

**Game Design Document:** `docs/GAME_DESIGN.md` — the authoritative source for game mechanics, balance levers, and character design.

**Core dynamic:** Paran is a precision predator that builds speed and can redirect instantly, but any collision kills momentum. Guardians are nimble but fragile — they win by splitting apart and forcing Paran into tight angles near walls. Paran wins through mastery of speed and precision, weaving without touching anything.

**Balance levers:** Paran's acceleration curve, attack cooldowns, guardian health, projectile speed/damage, arena obstacle density. These need to be tunable.

**Visual direction:** Pixel art with a solarpunk palette — lush, overgrown, nature and civilization in fragile balance.

## Constraints

- **Engine**: Phaser (browser game engine) — chosen by user
- **Networking**: Colyseus (authoritative multiplayer server) — chosen by user
- **Platform**: Desktop web browsers — no mobile
- **Deployment**: Self-hosted server infrastructure
- **Players**: Exactly 3 per match (1v2) — no variable player counts

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phaser for game engine | User preference, mature browser game framework | — Pending |
| Colyseus for multiplayer | User preference, built for authoritative game servers with room management | — Pending |
| Online multiplayer only | Simplifies input handling, single networking model | — Pending |
| Multiple hand-crafted maps | More variety than single map, more controlled than generated layouts | — Pending |
| Pixel art style | Fits solarpunk theme, manageable art pipeline | — Pending |

---
*Last updated: 2026-02-09 after initialization*

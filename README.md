# Banger

**Asymmetric 1v2 arena shooter** — one unstoppable predator vs. two coordinated guardians, set in a solarpunk pixel art world.

## About the Game

In a lush, overgrown world where nature and civilization exist in fragile balance, two guardians of serenity must hold the line against an elemental force of nature. Paran is not evil — just relentless and indifferent. When nature surges, the guardians must cooperate or fall.

Banger is a server-authoritative multiplayer game where asymmetry is the core design. The solo player has raw power and speed. The duo has numbers and coordination. Every match plays out differently depending on which side you're on.

## Characters

### Paran — Solo Predator

A precision predator that builds terrifying speed and can redirect instantly. Cardinal-only movement with acceleration physics means threading through tight gaps at full velocity feels incredible — but any collision with a wall or obstacle kills all momentum, leaving Paran exposed.

- **150 HP** / high top speed / slow acceleration
- Powerful attacks (40 damage) on a 1-second cooldown
- Loses ALL velocity on wall or obstacle collision

### Faran — Sharpshooter

An agile guardian with snappy movement and rapid-fire attacks. Individually outmatched, but deadly when coordinating crossfire with Baran.

- **50 HP** / instant acceleration / 8-directional movement
- Rapid fire (5 shots/sec) dealing 10 damage each

### Baran — Heavy Hitter

The other half of the guardian duo. Same responsive controls as Faran, complementing the pair's ability to split apart and create dangerous angles for Paran.

- **50 HP** / instant acceleration / 8-directional movement
- Rapid fire (5 shots/sec) dealing 10 damage each

## Core Mechanics

**Asymmetric combat** — 1v2 with fundamentally different playstyles per side. Guardians win through positioning and teamwork. Paran wins through speed mastery and precision.

**Momentum system** — Paran's acceleration physics create a high-risk, high-reward loop. Building speed is slow, but once moving at full velocity, Paran is devastating. One wall clip resets everything.

**Stage rotation** — Matches cycle through multiple arenas, keeping positioning fresh and preventing either side from settling into patterns.

## Arenas

| Arena          | Theme       | Description                             |
| -------------- | ----------- | --------------------------------------- |
| Hedge Garden   | Hedge walls | Organic corridors with tight turns      |
| Brick Fortress | Brick walls | Structured layouts with long sightlines |
| Timber Yard    | Wood walls  | Open spaces with scattered cover        |

## Tech Stack

| Layer      | Technology                                       |
| ---------- | ------------------------------------------------ |
| Server     | Node.js + Express + Colyseus 0.15                |
| Client     | Phaser 3.90 + Vite 5                             |
| Shared     | Pure TypeScript (physics, collision, characters) |
| Networking | 60Hz server-authoritative with client prediction |
| Audio      | jsfxr (procedural SFX) + WAV music               |
| Deployment | Docker single-container                          |

## Getting Started

Requires Node.js 20+. Both server and client must run simultaneously.

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Start server (port 2567)
cd ../server && npm run dev

# Start client (port 8080) — in a second terminal
cd client && npm run dev
```

Open `http://localhost:8080` in your browser. Open a second browser window to play as the other side.

## Project Structure

```
banger-game/
├── server/          # Colyseus game server (rooms, schema, match logic)
├── client/          # Phaser 3 client (scenes, systems, UI)
├── shared/          # Pure TS shared by both (physics, characters, collision, maps)
├── assets/          # Source art, fonts, soundtrack
├── scripts/         # Python asset generation (sprites, tilesets, arenas)
├── docs/            # Game design doc, design system, learnings
└── Dockerfile       # Single-container production build
```

## Deployment

The included `Dockerfile` produces a single container that serves both the game client and WebSocket server on port 3000. Built with multi-stage builds for minimal image size.

```bash
docker build -t banger .
docker run -p 3000:3000 banger
```

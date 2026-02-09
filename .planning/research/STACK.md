# Technology Stack

**Project:** Banger (Browser-based Multiplayer Arena Game)
**Researched:** 2026-02-09
**Confidence:** MEDIUM (training data only - external verification tools unavailable)

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Phaser** | 3.80+ | Client-side game engine | Industry standard for 2D browser games. Excellent performance, active community, rich plugin ecosystem. Handles rendering, physics, input, and asset management. WebGL + Canvas fallback. |
| **Colyseus** | 0.15+ | Authoritative multiplayer server | Purpose-built for real-time multiplayer games. Room-based architecture fits arena game model. Client prediction support, state synchronization, built-in matchmaking foundation. |
| **Node.js** | 20 LTS | Server runtime | Required for Colyseus. LTS ensures stability for production. Native TypeScript support in 20+. |
| **TypeScript** | 5.3+ | Language | Type safety critical for game state synchronization. Shared types between client/server prevent desync bugs. Both Phaser and Colyseus have excellent TS support. |
| **Vite** | 5.0+ | Client build tool | Fast dev server with HMR for rapid iteration. Native TS support. Tree-shaking reduces bundle size. Replaces older Webpack-based workflows. |

**Confidence:** MEDIUM - Versions based on training data (Jan 2025 cutoff). Need verification with official docs.

### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 16+ | Primary database | User accounts, stats, match history. JSONB for flexible stat storage. Excellent Node.js drivers. Self-hostable. Battle-tested for multiplayer games. |
| **Redis** | 7+ | Session/cache layer | Fast session storage for active players. Colyseus presence API integration. Matchmaking queue management. Pub/sub for multi-server coordination if needed. |

**Why NOT MongoDB:**
- PostgreSQL's JSONB gives schema flexibility where needed while maintaining relational integrity for user accounts and match records
- Stronger consistency guarantees matter for competitive game stats

**Confidence:** HIGH - Standard pattern for multiplayer games with stat tracking.

### State Management & Networking
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@colyseus/schema** | (bundled) | State definition | Built into Colyseus. Efficient binary serialization. Type-safe state sync. Automatic delta compression. |
| **@colyseus/ws** | (bundled) | WebSocket transport | Default Colyseus transport. Reliable, low-latency. Fallback options available. |

**Client-side interpolation:** Roll your own or use community libs
- Colyseus handles authoritative state
- Client interpolates between state updates for smooth visuals
- Phaser tweens work well for this

**Confidence:** HIGH - Core Colyseus architecture patterns.

### Authentication & Security
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Passport.js** | 0.7+ | Auth strategy framework | Flexible for "light accounts". Start with local strategy, add OAuth later if needed. Node.js standard. |
| **bcrypt** | 5+ | Password hashing | Industry standard. Proper salt rounds for gaming context (don't over-engineer for casual game). |
| **express-session** | 1.18+ | Session management | Colyseus integrates cleanly. Redis-backed for multi-server. |
| **helmet** | 7+ | Security headers | Essential HTTP security middleware. Prevents common vulnerabilities. |

**Why NOT JWT for sessions:**
- Stateful sessions better for game context (kick players, invalidate on suspicious activity)
- Redis-backed sessions integrate cleanly with Colyseus presence

**Confidence:** HIGH - Standard Node.js auth patterns.

### Asset Pipeline
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **TexturePacker** | (external tool) | Sprite atlas generation | Industry standard. Generates optimal atlases + JSON metadata. Phaser native support. Reduces draw calls. |
| **Aseprite** | (external tool) | Pixel art creation | Gold standard for pixel art. Export to sprite sheets. |
| **Tiled** | (external tool) | Map editor | Standard for 2D tile-based maps. Phaser has excellent Tiled import support. JSON export. |

**Asset loading:**
- Phaser's native loader (supports atlases, tilemaps, audio)
- Lazy load per-map assets to reduce initial bundle

**Confidence:** HIGH - Industry standard pixel art game pipeline.

### Infrastructure & Deployment
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Docker** | 24+ | Containerization | Self-hosting requirement. Consistent dev/prod environments. Easy multi-container orchestration (app + postgres + redis). |
| **docker-compose** | 2.23+ | Local orchestration | Development parity. Simple production deployment for single-server start. |
| **nginx** | 1.25+ | Reverse proxy | WebSocket proxy to Colyseus. Static asset serving. SSL termination. Rate limiting. |
| **PM2** | 5+ | Process manager | Node.js process management. Auto-restart on crash. Log management. Zero-downtime reloads. |

**Scaling considerations (future):**
- Start single-server
- Colyseus supports Redis-based multi-server presence when needed
- nginx load balancing with sticky sessions

**Confidence:** HIGH - Standard self-hosted Node.js deployment pattern.

### Monitoring & Logging
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Pino** | 8+ | Structured logging | Fast JSON logging. Low overhead for game server. Easy parsing for analysis. |
| **Grafana + Prometheus** | Latest | Metrics & dashboards | Self-hostable monitoring. Track active rooms, player counts, server performance. Essential for multiplayer ops. |

**Game-specific metrics to track:**
- Active rooms
- Players per room
- Tick rate consistency
- State sync latency
- Match completion rates

**Confidence:** MEDIUM - Standard monitoring stack, but alternatives exist.

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@colyseus/monitor** | (bundled) | Dev dashboard | Development only. Inspect active rooms, connections, state. |
| **phaser3-rex-plugins** | Latest | Phaser extensions | UI components (health bars, name tags), pathfinding, virtual joystick for mobile. |
| **zod** | 3+ | Runtime validation | Validate client inputs to Colyseus rooms. Prevent malformed commands. Schema-first approach matches TypeScript. |
| **eslint** + **prettier** | Latest | Code quality | Consistent formatting across team. Catch common errors. TypeScript-aware rules. |
| **vitest** | 1+ | Testing | Fast TS-native test runner. Test game logic, state mutations, room behaviors. |

**Testing strategy:**
- Unit test game logic (separate from Phaser/Colyseus)
- Integration test Colyseus room lifecycles
- Manual playtest for gameplay feel (hard to automate)

**Confidence:** MEDIUM-HIGH - Common choices, but alternatives exist (e.g., Jest instead of Vitest).

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **Game Engine** | Phaser 3 | PixiJS | PixiJS is lower-level renderer, not a game engine. Would need to build entity system, input handling, physics. Phaser provides complete game framework. |
| | | Unity WebGL | Massive bundle sizes (10-50MB+). Overkill for 2D pixel art. Phaser gives better performance and smaller footprint. |
| | | Godot Web | Experimental HTML5 export. Less mature than Phaser for web. Godot shines for native games. |
| **Multiplayer** | Colyseus | Socket.io + custom | Colyseus provides room management, state sync, matchmaking foundation. Rolling your own costs weeks of development and introduces bugs. |
| | | Photon | Third-party hosted (conflicts with self-hosting requirement). Vendor lock-in. Colyseus gives full control. |
| | | Nakama | Heavier framework (user management, leaderboards, etc.). More than needed for MVP. Colyseus is focused on real-time state sync. |
| **Database** | PostgreSQL | MongoDB | Weaker consistency model. Game stats need ACID guarantees. PostgreSQL JSONB provides flexibility where needed. |
| | | SQLite | Not suitable for concurrent writes from multiplayer server. Fine for single-player, wrong for this use case. |
| **Build Tool** | Vite | Webpack | Vite is significantly faster. Better DX with HMR. Modern default for new Phaser projects. Webpack is legacy choice. |
| | | Parcel | Less ecosystem momentum. Vite has become standard for Phaser + TS projects. |
| **Language** | TypeScript | JavaScript | Type safety prevents client/server desync bugs. Shared state interfaces critical for multiplayer. All deps have TS support. No reason to skip. |

## Package.json Starter

### Client (Vite + Phaser)
```json
{
  "dependencies": {
    "phaser": "^3.80.1",
    "colyseus.js": "^0.15.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.3",
    "@types/node": "^20.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "vitest": "^1.2.0"
  }
}
```

### Server (Colyseus)
```json
{
  "dependencies": {
    "@colyseus/core": "^0.15.0",
    "@colyseus/ws-transport": "^0.15.0",
    "@colyseus/monitor": "^0.15.0",
    "express": "^4.18.2",
    "express-session": "^1.18.0",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "bcrypt": "^5.1.1",
    "helmet": "^7.1.0",
    "pg": "^8.11.3",
    "redis": "^4.6.12",
    "pino": "^8.17.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.21",
    "@types/passport": "^1.0.16",
    "@types/bcrypt": "^5.0.2",
    "nodemon": "^3.0.3",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "vitest": "^1.2.0"
  }
}
```

**Note:** Versions are approximate based on training data (Jan 2025). Verify current stable releases before installing.

## Installation & Setup

### 1. Prerequisites
```bash
# Node.js 20 LTS
node -v  # Should be v20.x

# Docker for local development
docker -v

# pnpm (faster than npm, better for monorepos)
npm install -g pnpm
```

### 2. Project Structure (Monorepo Recommended)
```
banger-game/
├── packages/
│   ├── client/          # Vite + Phaser
│   ├── server/          # Colyseus + Express
│   └── shared/          # TypeScript types for game state
├── docker-compose.yml   # Postgres + Redis
└── package.json         # Root workspace config
```

**Why monorepo:**
- Shared types between client/server in `packages/shared`
- Single command to start full stack
- Prevents version drift

**Tools:** pnpm workspaces (built-in) or Turborepo for caching

### 3. Core Setup
```bash
# Install dependencies
pnpm install

# Start infrastructure
docker-compose up -d  # Postgres + Redis

# Start development
pnpm dev  # Runs both client (Vite) and server (nodemon)
```

### 4. External Tools (Manual Installation)
- **Aseprite:** https://www.aseprite.org/ (pixel art)
- **Tiled:** https://www.mapeditor.org/ (maps)
- **TexturePacker:** https://www.codeandweb.com/texturepacker (atlases)

## Architecture Notes

### Client-Server Separation
- **Client:** Pure presentation layer. Renders game state from server.
- **Server:** Authoritative. All game logic, collision detection, hit registration.
- **Client predicts:** Local player movement for responsiveness, reconciles with server state.

**Why authoritative server:**
- Prevents cheating (can't fake hits or positions)
- Consistent game state for all players
- Required for competitive integrity

### State Synchronization Pattern
1. Client sends input commands (move, shoot, ability)
2. Server validates, updates authoritative state
3. Server broadcasts state deltas to all clients in room
4. Clients interpolate between states for smooth rendering

**Tick rate:** 20-30 Hz (server updates)
**Render rate:** 60 FPS (client interpolates)

### Network Optimization
- Binary serialization via `@colyseus/schema` (smaller than JSON)
- Delta compression (only changed fields transmitted)
- Entity interpolation on client
- Input buffering for lag compensation

## Technology Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Phaser 4 release during development** | Medium | Phaser 3 is stable and will be maintained. Don't migrate mid-project. Assess Phaser 4 for future titles. |
| **Colyseus commercial licensing** | Low | Open source with optional paid hosting. Self-hosting avoids costs. MIT license for core. |
| **WebSocket connection limits** | Medium | Plan for nginx tuning (worker connections). Redis-based presence allows horizontal scaling if needed. |
| **Client-side cheat attempts** | High | Authoritative server mitigates most cheats. Add server-side sanity checks (movement speed, fire rate). Monitor suspicious patterns. |
| **State synchronization complexity** | High | Start with simple state (positions, health). Add complexity incrementally. Use Colyseus examples as reference. |

## Development Environment

### Recommended IDE
- **VS Code** with extensions:
  - ESLint
  - Prettier
  - TypeScript + JavaScript Language Features
  - Error Lens (inline errors)

### Debugging Tools
- **Chrome DevTools:** Network tab for WebSocket messages
- **@colyseus/monitor:** Dashboard for room inspection (dev only)
- **Phaser Inspector:** Browser extension for scene debugging

### Performance Profiling
- Chrome Performance tab for client FPS
- Node.js built-in profiler for server tick rate
- Pino logs for identifying bottlenecks

## Security Considerations

### Authentication
- HTTPS required for WebSocket connections (wss://)
- Session cookies with httpOnly, secure, sameSite flags
- Rate limit account creation and login attempts

### Game Server
- Validate ALL client inputs (zod schemas)
- Server-side cooldowns for abilities (don't trust client timing)
- Maximum payload sizes to prevent DoS
- Room size limits to prevent resource exhaustion

### Deployment
- Environment variables for secrets (never commit)
- Database connection string security
- Regular dependency updates (npm audit)

## Confidence Assessment

| Category | Confidence | Rationale |
|----------|------------|-----------|
| **Core Framework (Phaser + Colyseus)** | HIGH | Industry-standard pairing for browser multiplayer games. Well-documented, mature ecosystems. |
| **Specific Versions** | MEDIUM | Based on training data (Jan 2025). Need verification with official releases. |
| **Database Choice (PostgreSQL + Redis)** | HIGH | Standard pattern for multiplayer games with user accounts and stats. |
| **Build Tools (Vite)** | HIGH | Clear modern standard for Phaser + TypeScript projects. |
| **Auth Stack (Passport)** | HIGH | Battle-tested Node.js authentication approach. |
| **Deployment (Docker + nginx)** | HIGH | Standard self-hosted Node.js deployment pattern. |
| **Monitoring (Pino + Prometheus)** | MEDIUM | Common choices, but monitoring has many valid alternatives. |

## Research Limitations

**External verification tools were unavailable during research.** Recommendations are based on training data (January 2025 knowledge cutoff) and established patterns for browser multiplayer games.

**Before implementation:**
1. Verify current stable versions of Phaser and Colyseus
2. Check official documentation for any breaking changes
3. Review Colyseus examples for latest best practices
4. Confirm Docker base image versions for Node.js 20

**HIGH confidence areas** reflect stable, long-standing patterns unlikely to change.
**MEDIUM confidence areas** may have version updates or emerging alternatives.

## Sources

**Note:** Unable to access external sources during research. Recommendations based on established patterns from training data. Verify with official documentation:

- Phaser: https://phaser.io/
- Colyseus: https://colyseus.io/
- Node.js LTS: https://nodejs.org/
- TypeScript: https://www.typescriptlang.org/

**Recommended next step:** Validate versions and check for any ecosystem shifts since January 2025.

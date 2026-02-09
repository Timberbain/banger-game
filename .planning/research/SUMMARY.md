# Project Research Summary

**Project:** Banger
**Domain:** Browser-based multiplayer arena game (1v2 asymmetric shooter)
**Researched:** 2026-02-09
**Confidence:** MEDIUM

## Executive Summary

Banger is a browser-based multiplayer arena shooter with asymmetric 1v2 gameplay, featuring acceleration-based movement and collision mechanics. Expert developers in this domain build such games using **Phaser 3** for client-side rendering, **Colyseus** for authoritative multiplayer server architecture, and a separation of concerns where the server owns all game logic while clients only render and send input. This pattern prevents cheating and ensures consistent gameplay across all players.

The recommended approach is a **server-authoritative architecture** with client-side prediction for local responsiveness and interpolation for remote entities. Start with a monorepo structure (client/server/shared packages) using TypeScript throughout, PostgreSQL for persistence, and Redis for sessions. Deploy in Docker containers with nginx as reverse proxy. The core technical challenge is achieving responsive combat feel (sub-100ms perceived latency) while maintaining server authority over physics and collision detection—critical for Banger's collision penalty mechanics and competitive integrity.

**Key risks:** (1) Physics desynchronization between client and server leading to unfair collision penalties, (2) bandwidth explosion from naïve state synchronization in projectile-heavy combat, (3) client trust vulnerabilities enabling cheating in competitive 1v2 matches, and (4) poor perceived responsiveness if latency testing is deferred. All of these can be mitigated by establishing the server-authoritative pattern from day one, implementing client prediction with server reconciliation, using Colyseus Schema delta compression, validating all client input, and testing with realistic latency (100-150ms) starting in Phase 1.

## Key Findings

### Recommended Stack

**Phaser 3.80+ and Colyseus 0.15+** form the industry-standard foundation for browser multiplayer games. Phaser provides the complete client-side game framework (rendering, input, asset management, physics for display purposes) with WebGL performance and Canvas fallback. Colyseus offers purpose-built real-time multiplayer infrastructure with room-based architecture, automatic state synchronization via binary serialization, and client prediction support—all essential for the authoritative server pattern.

**Core technologies:**
- **Phaser 3.80+**: Client-side game engine — industry standard for 2D browser games, handles rendering and input, active ecosystem
- **Colyseus 0.15+**: Authoritative multiplayer server — purpose-built for real-time games, room-based architecture, state synchronization
- **Node.js 20 LTS**: Server runtime — required for Colyseus, native TypeScript support, LTS stability
- **TypeScript 5.3+**: Language — type safety critical for client/server state sync, prevents desync bugs
- **PostgreSQL 16+**: Database — user accounts and match history with JSONB flexibility, ACID guarantees for competitive stats
- **Redis 7+**: Session/cache — fast session storage, matchmaking queues, Colyseus presence for multi-server coordination
- **Vite 5.0+**: Build tool — fast dev server with HMR, native TS support, modern replacement for Webpack
- **Docker 24+**: Containerization — self-hosting requirement, consistent dev/prod environments

**Supporting infrastructure:** nginx for WebSocket proxy and static assets, PM2 for process management, Pino for structured logging, Prometheus + Grafana for monitoring (active rooms, tick rate, player counts). Monorepo structure recommended using pnpm workspaces with separate client, server, and shared packages for TypeScript types.

**Confidence:** HIGH for framework choices (Phaser + Colyseus is proven pairing), MEDIUM for specific versions (based on Jan 2025 training data, need verification with current releases).

### Expected Features

Browser multiplayer arena games have clear feature expectations derived from the .io game genre and competitive shooters like krunker.io.

**Must have (table stakes):**
- Instant play (no download) — core browser game value proposition
- Responsive controls — players judge quality immediately, acceleration movement must feel tight
- Low-latency netcode — competitive games unplayable with lag, critical for projectile combat
- Match/lobby system — room codes already planned for private matches
- Basic HUD (health, ammo, score) — essential for combat decision-making
- Match end screen with stats — closure and feedback expectation
- Reconnection handling — browser tabs get refreshed, need graceful disconnect
- Mobile-responsive UI — significant traffic from mobile, touch controls required
- Username/identity — light accounts for recognition
- Tutorial/controls screen — acceleration movement has learning curve
- Audio/visual feedback — shooting, hits, deaths require feedback
- Visual hit confirmation — hit markers or damage numbers for combat clarity
- Spectator mode — dead players need something to do in asymmetric matches

**Should have (competitive differentiators):**
- Asymmetric 1v2 gameplay — core differentiator, requires careful balance testing
- Acceleration-based movement — higher skill ceiling than click-to-move
- Multiple hand-crafted maps (3-5 minimum) — variety prevents staleness, competitive balance
- Character-specific abilities (Faran/Baran/Paran) — role differentiation beyond numbers
- Collision-based gameplay — tactical dimension (body blocking), core to concept
- Stat tracking & progression — long-term engagement, enabled by light accounts
- Leaderboards — competitive motivation (daily/weekly/all-time)
- Matchmaking system — most .io games lack skill-based matching (opportunity)
- Ranked/competitive mode — aspirational goal, requires matchmaking foundation

**Defer (v2+):**
- Cosmetic customization — defer until core loop proven and retention validated
- Friend system & parties — room codes sufficient initially for social play
- Seasonal content — requires active playerbase first
- Tournament system — needs established competitive scene
- Replay system — high complexity, low initial value
- Custom game modes — core 1v2 mode must be solid before variants
- Map editor — massive scope increase, user-generated content premature

**Anti-features (explicitly avoid):**
- Pay-to-win mechanics — destroys competitive integrity (cosmetic-only monetization instead)
- Loot boxes/gacha — regulatory risk (direct purchase or battle pass)
- Voice chat — toxicity management burden (text chat or quick chat wheel)
- Auto-matchmaking only — removes casual play (keep room codes alongside matchmaking)
- Complex account system — friction for browser game (keep light/optional)
- Single-player campaign — wrong scope for arena game (tutorial/practice only)

### Architecture Approach

The proven pattern is **authoritative server with dumb client**: server owns all game logic (physics, collision, combat), clients only render state and send input. This prevents cheating and ensures consistency—critical for competitive integrity in Banger's 1v2 asymmetric balance.

**Major components:**

1. **Client (Phaser)** — Pure presentation layer. Renders game state received from server. Captures input (keyboard/mouse) and sends to server. Client-side prediction for local player movement only (for responsiveness), interpolation for remote entities (for smoothness). Never modifies authoritative state.

2. **Server (Colyseus Room)** — Authoritative game logic. Fixed timestep game loop (60Hz typical) processes input queue, runs physics simulation, detects collisions, applies damage, updates game state. Uses `@colyseus/schema` for automatic binary state synchronization with delta compression. One room instance per active match (isolated state).

3. **Shared Types** — TypeScript interfaces for game state shared between client and server in monorepo `/shared` package. Ensures client and server agree on state structure, prevents desync bugs.

4. **Persistence Layer** — Separate async service (PostgreSQL for accounts/stats, Redis for sessions). Never blocks game loop. Match results written after game ends, not during update tick.

5. **Matchmaking & Lobby** — Dual system supporting both room codes (private matches with friends) and matchmaking (skill-based public matches). Colyseus room discovery and filtering. Redis-backed presence for multi-server scaling when needed.

**Critical data flow:** Client captures input → sends to server → server queues input → fixed timestep processes queue → updates physics → modifies state → Colyseus auto-syncs delta to clients → clients interpolate → render in Phaser.

**Key patterns to follow:**
- Schema-driven state sync (automatic change detection, binary protocol)
- Input queue with timestamp validation (handles jitter, prevents speedhacks)
- Fixed timestep server loop (deterministic physics, consistent 60Hz)
- Entity interpolation on client (smooth 60 FPS rendering from 20-60Hz network updates)
- Component-based state organization (players/projectiles/map separated)

**Anti-patterns to avoid:**
- Client-side game logic (enables cheating, causes desync)
- Synchronizing derived state (wastes bandwidth—only sync essential state)
- Processing input in `onMessage` handler (bypasses fixed timestep, race conditions)
- Blocking operations in game loop (database writes freeze match)
- Trusting client timestamps without validation (speedhack vulnerability)

**Build order:** Schema → Room + Server → Client connection → Input system → Game loop → Physics → Rendering → Combat → Collision → Interpolation → Match lifecycle → Persistence → Maps → Matchmaking. This sequence ensures each phase builds on working foundation.

### Critical Pitfalls

Research identified 15 domain pitfalls ranging from critical (cause rewrites) to minor (annoyance). Top 5 critical pitfalls that would derail Banger if ignored:

1. **Client-server physics authority mismatch** — Running physics on both sides with different configs causes desync. Client shows wall collision, server says no hit—combat becomes unpredictable. **Prevention:** Establish server-authoritative model in Phase 1. Server runs lightweight physics (not full Phaser), clients predict locally and reconcile with server state. Use fixed timestep on server (60Hz), interpolate on client.

2. **Naïve state synchronization** — Sending full state every tick creates bandwidth bottleneck. Works locally, breaks at 100ms+ latency or on mobile. Projectile-heavy combat scales poorly. **Prevention:** Use Colyseus Schema delta compression (only changed properties sync). Design schema to maximize delta efficiency. Use event-driven for discrete actions (projectile_fired event, not projectile state every tick). Quantize positions to reduce bandwidth.

3. **Client trust vulnerabilities** — Accepting client input without validation enables cheating (speed hacks, teleportation, invincibility). Competitive 1v2 unplayable when one player cheats. **Prevention:** Validate ALL input server-side from day one. Check movement speed limits, action cooldowns, collision states. Server-authoritative hit detection. Rate limit input messages. Add sanity checks (impossible speeds, wall clipping).

4. **Interpolation vs extrapolation confusion** — Using extrapolation (predicting future) when should interpolate (smoothing between known states) makes remote players look jittery. Especially bad for acceleration-based movement. **Prevention:** Interpolate remote players (render 100-150ms in past, smooth between server updates). Only extrapolate local player (prediction for responsiveness). Buffer 2-3 server updates to handle jitter.

5. **No realistic latency testing** — Game feels great on localhost (0ms), launches with 50-150ms real latency, and combat feels broken. Post-launch panic. **Prevention:** Setup latency simulation tools (Chrome DevTools throttling, tc, Clumsy) in Phase 1. Test daily at 50ms, 100ms, 150ms. Define latency budget (playable at 150ms). Use client prediction to hide network delay.

**Moderate pitfalls** requiring attention but not rewrites: tight coupling between Phaser and game logic (prevents server reuse), room state size explosion (projectiles accumulate), matchmaking without reconnection (mobile network blips ruin matches), asset loading hitches during gameplay, no graceful degradation for lag spikes.

**Banger-specific concerns:** Momentum-based movement requires tight synchronization. Collision penalties must be server-authoritative for fairness (core mechanic). 1v2 asymmetry means balance is critical—cheating ruins it. Projectile-heavy combat is bandwidth sensitive (delta compression essential).

## Implications for Roadmap

Based on research, suggested phase structure balances dependency ordering (can't build combat before movement), risk mitigation (address critical pitfalls early), and incremental deliverables (playable milestones).

### Phase 1: Foundation & Authority Model
**Rationale:** Establish architecture fundamentals before building features. Getting authority model wrong causes rewrites (Pitfall #1). Setting up latency testing early prevents post-launch panic (Pitfall #5).

**Delivers:** Monorepo structure, basic Colyseus server with room creation, Phaser client connects and joins room, schema defined for game state, input capture works, latency simulation tools configured.

**Addresses (from FEATURES.md):** Infrastructure for instant play (browser-based), foundation for responsive controls (input system).

**Avoids (from PITFALLS.md):** Physics authority mismatch (decision made in Phase 1), client trust (validation framework established), no latency testing (tools setup).

**Stack elements:** Phaser 3 + Colyseus setup, TypeScript monorepo with pnpm workspaces, Node.js 20 server, Vite for client build.

**Needs research-phase?** NO — standard Phaser + Colyseus setup, well-documented in official examples.

---

### Phase 2: Core Loop (Movement & State Sync)
**Rationale:** Movement is foundation for all gameplay. Acceleration-based movement is core differentiator requiring tight synchronization. Must prove multiplayer works before adding combat complexity.

**Delivers:** Server-authoritative movement physics (acceleration-based), client-side prediction for local player, interpolation for remote players, state synchronization working with delta compression, fixed timestep game loop (60Hz), players can move around in shared room.

**Addresses:** Responsive controls (table stakes), acceleration-based movement (differentiator), low-latency netcode foundation.

**Avoids:** Naïve state sync (delta compression implemented), physics desync (server authoritative established), client logic (separation maintained).

**Implements (from ARCHITECTURE.md):** Fixed timestep server loop, input queue with validation, schema-driven state sync, entity interpolation.

**Stack elements:** Colyseus Schema for state, server physics logic (lightweight, not full Phaser), Phaser rendering client-side.

**Needs research-phase?** MAYBE — If momentum physics tuning proves complex, may need brief research on acceleration curves and feel. Otherwise standard pattern.

---

### Phase 3: Combat & Collision
**Rationale:** Combat is second half of core gameplay loop. Collision detection is unique mechanic (body blocking, collision penalties) requiring server authority. Projectiles test bandwidth optimization.

**Delivers:** Server-authoritative projectile spawning, collision detection (player-player, player-projectile, player-wall), health/damage system, death and respawn, hit detection with visual feedback, collision penalties applied fairly.

**Addresses:** Visual hit confirmation (table stakes), collision-based gameplay (differentiator), projectile combat.

**Avoids:** Client trust for hit detection (server validates), bandwidth explosion from projectiles (event-driven approach).

**Implements:** Collision detection (AABB for MVP), combat state in schema, projectile lifecycle management (cleanup to prevent state explosion).

**Needs research-phase?** MAYBE — Collision detection algorithm choice (AABB vs SAT vs Circle) may need brief performance research if >20 entities per room. Standard for initial implementation.

---

### Phase 4: Match Lifecycle & Maps
**Rationale:** Multiple maps are table stakes (single map gets stale). Match win/loss conditions needed for closure. Spectator mode essential for dead players in asymmetric matches.

**Delivers:** Win/loss conditions for 1v2 matches, match timer, match end screen with stats (kills, deaths, accuracy), spectator mode (camera follows alive players), 3-5 hand-crafted maps, map selection UI.

**Addresses:** Match end screen (table stakes), spectator mode (table stakes), multiple maps (table stakes to prevent staleness).

**Avoids:** Hardcoded constants (centralized config for map parameters, balance tuning).

**Stack elements:** Tiled for map creation (JSON export to Phaser), asset preloading to avoid hitches.

**Needs research-phase?** NO — Standard match lifecycle patterns. Map creation is design work (Tiled + Phaser integration well-documented).

---

### Phase 5: Accounts & Progression
**Rationale:** Light accounts enable stat tracking (differentiator) and leaderboards (competitive motivation). Persistence layer separate from game loop prevents blocking.

**Delivers:** Light account system (username/password), session management (Redis-backed), stat tracking (wins, losses, K/D ratio), match history, leaderboards (daily/weekly/all-time), profile page.

**Addresses:** Username/identity (table stakes), stat tracking (differentiator), leaderboards (differentiator).

**Implements (from ARCHITECTURE.md):** Persistence layer (PostgreSQL for accounts, Redis for sessions), separate from game server (async writes after match).

**Stack elements:** Passport.js for auth, bcrypt for passwords, PostgreSQL with JSONB for flexible stats, express-session with Redis backend.

**Needs research-phase?** NO — Standard Node.js authentication patterns. Well-documented Passport + Colyseus integration.

---

### Phase 6: Polish & Mobile
**Rationale:** Mobile traffic significant for browser games. Reconnection essential for browser context (tabs get closed). Tutorial needed for acceleration movement learning curve.

**Delivers:** Mobile-responsive UI and touch controls, reconnection handling (30-60s grace period), tutorial/controls screen, audio system (shooting, hits, deaths), improved visual effects, performance optimization for low-end devices.

**Addresses:** Mobile-responsive (table stakes), reconnection (table stakes), tutorial (table stakes), audio feedback (table stakes).

**Avoids:** Asset loading hitches (preloading implemented), no reconnection (grace period added), browser tab visibility issues (handled).

**Stack elements:** Phaser touch input, phaser3-rex-plugins for mobile UI (virtual joystick), reconnection tokens in Colyseus.

**Needs research-phase?** NO — Standard mobile responsiveness and Colyseus reconnection patterns.

---

### Phase 7: Character Abilities (Asymmetric Depth)
**Rationale:** Abilities differentiate Faran/Baran/Paran roles beyond numbers. Adds strategic depth to 1v2 asymmetry. Complex balance work—defer until core loop proven.

**Delivers:** Character-specific abilities (design TBD), ability system with cooldowns (server-validated), UI for ability status, balance testing and iteration.

**Addresses:** Character-specific abilities (differentiator), asymmetric depth.

**Avoids:** Clock sync issues (use Colyseus Clock for ability cooldowns), client trust for cooldowns (server enforces).

**Stack elements:** Zod for input validation (ability commands), Colyseus Schema for ability state.

**Needs research-phase?** MAYBE — Ability design is greenfield. If looking at MOBA-style or hero shooter patterns for inspiration, brief research may help. Implementation standard once designed.

---

### Phase 8: Matchmaking & Ranked
**Rationale:** Matchmaking differentiates from typical .io games (most lack skill-based matching). Ranked mode aspirational for competitive players. Requires working game and enough players to test.

**Delivers:** Skill-based matchmaking (Elo or Glicko rating), ranked mode with visible rating, matchmaking queue system, party support (queue with friends), separate casual and ranked pools.

**Addresses:** Matchmaking system (differentiator), ranked mode (differentiator), friend parties (deferred from Phase 5).

**Implements:** Dual lobby system (room codes + matchmaking) from architecture, Colyseus room filtering by mode.

**Avoids:** Matchmaking without reconnection (reconnection already implemented in Phase 6), room cleanup issues (disposal logic in place).

**Stack elements:** Redis for matchmaking queues, skill rating stored in PostgreSQL.

**Needs research-phase?** MAYBE — If implementing Glicko-2 or TrueSkill instead of basic Elo, may need algorithm research. Otherwise standard queue patterns.

---

### Phase Ordering Rationale

**Dependency-driven:**
- Can't build combat (Phase 3) without movement working (Phase 2)
- Can't track stats (Phase 5) without match end conditions (Phase 4)
- Can't do ranked matchmaking (Phase 8) without skill tracking (Phase 5)
- Reconnection (Phase 6) easier after persistence layer exists (Phase 5)

**Risk mitigation:**
- Authority model decided in Phase 1 (prevents Pitfall #1 rewrite)
- State sync optimized in Phase 2 (prevents Pitfall #2 bandwidth issues)
- Input validation from Phase 1 onward (prevents Pitfall #3 cheating)
- Latency testing in all phases (prevents Pitfall #5 launch surprise)

**Incremental value:**
- Phase 2 delivers playable movement (first multiplayer milestone)
- Phase 3 completes core gameplay loop (fully playable game)
- Phase 4 adds variety and closure (shippable MVP)
- Phase 5-8 add competitive depth and retention features

**Parallelizable work:**
- Once Phase 3 complete (core loop works), map creation (Phase 4) can happen in parallel with account backend (Phase 5)
- UI polish (Phase 6) can happen alongside ability design (Phase 7)

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 7 (Character Abilities):** Greenfield design. May benefit from research on MOBA ability patterns, hero shooter balance, or asymmetric game design if team unfamiliar with domain.
- **Phase 8 (Matchmaking Algorithm):** If going beyond basic Elo (e.g., Glicko-2, TrueSkill, or handling 1v2 rating asymmetry), brief algorithm research recommended.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Phaser + Colyseus setup extensively documented in official guides and examples.
- **Phase 2 (Movement):** Client prediction + server reconciliation is standard multiplayer pattern with many references.
- **Phase 3 (Combat):** Collision detection and projectile systems well-covered in Phaser/Colyseus examples.
- **Phase 4 (Maps & Lifecycle):** Tiled integration with Phaser is standard workflow. Match lifecycle straightforward.
- **Phase 5 (Accounts):** Passport.js + Express + Colyseus is documented integration pattern.
- **Phase 6 (Mobile & Polish):** Touch controls and reconnection in Colyseus have established patterns.

### Suggested Minimum Viable Product (MVP)

**MVP = Phases 1-4** delivers:
- Working multiplayer with room codes (instant play)
- Responsive acceleration-based movement (core differentiator)
- Projectile combat with collision mechanics (core gameplay)
- 3-5 maps with match end conditions (variety and closure)
- Spectator mode for dead players
- Basic HUD and visual feedback

**This is shippable** but lacks retention features (no accounts, stats, or ranked play). Good for alpha testing and validating core loop.

**Full Launch = Phases 1-6** adds:
- Light accounts with stat tracking
- Leaderboards for competitive motivation
- Mobile support (expands audience)
- Reconnection (quality of life)
- Tutorial (onboarding)
- Audio and polish

**This is competitive launch quality.** Phases 7-8 add depth for long-term retention but not required for initial launch.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Phaser + Colyseus is proven pairing for browser multiplayer games. Version numbers are MEDIUM confidence (based on Jan 2025 training data—verify current stable releases). |
| Features | LOW-MEDIUM | Table stakes based on .io game genre expectations (HIGH confidence those are standard). Differentiators are Banger-specific judgment calls (MEDIUM). Cannot verify 2026 market state without web access. |
| Architecture | MEDIUM-HIGH | Server-authoritative pattern is fundamental to multiplayer (HIGH confidence). Specific implementation details (tick rates, collision algorithms) are standard patterns (MEDIUM—may have newer approaches in 2026). |
| Pitfalls | MEDIUM | Critical pitfalls reflect fundamental networking principles unlikely to change (physics desync, bandwidth, client trust—HIGH confidence these matter). Framework-specific gotchas need verification with 2026 versions (LOW confidence those haven't changed). |

**Overall confidence: MEDIUM**

Research is based on established patterns for browser multiplayer games and the standard Phaser + Colyseus architecture. However, **all findings are based on training data with knowledge cutoff January 2025**—web search and external documentation tools were unavailable during research. Version numbers, specific API details, and 2026 ecosystem changes require verification.

### Gaps to Address

**Before Phase 1 kickoff:**
1. **Verify current Phaser and Colyseus versions** — Check official docs for any breaking changes or new best practices since Jan 2025. Confirm latest stable releases and update package.json recommendations.
2. **Validate tick rate recommendations** — Research whether 60Hz server tick is still standard or if newer hardware allows higher rates without penalty.
3. **Check for new lag compensation techniques** — WebRTC vs WebSocket may have shifted, or new browser APIs may improve prediction/reconciliation.

**During Phase 2 (Movement):**
- Collision detection algorithm choice (AABB sufficient for 3-player matches, but profile if adding more entities). Research spatial partitioning if performance issues arise.

**During Phase 3 (Combat):**
- Lag compensation for hit detection fairness. Standard approaches exist, but may need tuning for acceleration-based movement feel.

**During Phase 5 (Persistence):**
- Database schema design for stats (what granularity, JSONB structure). Standard patterns exist but Banger-specific metrics need definition.

**During Phase 7 (Abilities):**
- Ability design patterns from MOBA/hero shooter genres if team lacks asymmetric game experience. Implementation is standard once design settled.

**Ongoing validation:**
- Check Phaser and Colyseus Discord/GitHub discussions for 2026-specific gotchas or emerging patterns
- Review recent browser multiplayer game post-mortems (especially .io games and browser shooters)
- Validate that Colyseus Schema is still the recommended state sync approach (vs manual MessagePack or newer alternatives)

### Verification Checklist

Before starting implementation, validate these research assumptions:

- [ ] Phaser 3.80+ is current stable (or identify newer version)
- [ ] Colyseus 0.15+ is current stable (or identify newer version)
- [ ] Node.js 20 LTS is current recommendation (or 22 LTS if released)
- [ ] Colyseus still uses Schema for state sync (confirm current API)
- [ ] Phaser Arcade Physics non-determinism still applies (check if Matter.js or custom needed)
- [ ] WebSocket still preferred over WebRTC for Colyseus (or has this shifted?)
- [ ] Docker + nginx deployment pattern still standard for self-hosted Node.js (or are there newer approaches?)
- [ ] Vite still the modern default for Phaser + TS projects (vs Parcel, Rollup, or newer tools)

**All confidence levels assume these validations pass.** If any assumption is wrong, confidence drops and specific recommendations may change.

## Sources

**PRIMARY LIMITATION:** This research was conducted using training data only (knowledge cutoff January 2025). Web search, Context7 library access, and documentation verification tools were unavailable. All findings should be considered **MEDIUM confidence at best** pending verification.

### What Research is Based On

**HIGH confidence (fundamental principles):**
- Client-server architecture patterns for multiplayer games (authoritative server, client prediction, state synchronization)
- Network programming fundamentals (latency, bandwidth, delta compression)
- Security fundamentals (input validation, server authority)
- Physics simulation determinism challenges

**MEDIUM confidence (established domain patterns):**
- Phaser + Colyseus as standard stack for browser multiplayer (widely used as of 2025)
- .io game genre expectations (instant play, leaderboards, etc.)
- Common multiplayer pitfalls (well-documented in game dev community)

**LOW confidence (needs verification):**
- Specific version numbers (Phaser 3.80, Colyseus 0.15—need to check 2026 releases)
- Framework-specific API details (Schema syntax, Colyseus room lifecycle—may have changed)
- 2026 market state (new competitors, feature expectations, browser API changes)
- Mobile browser WebSocket limits (may have improved)

### Recommended Verification Sources

**Before implementation, consult:**
1. **Colyseus Official Docs** (https://docs.colyseus.io/) — Verify state sync patterns, room lifecycle, current version
2. **Phaser 3 Docs** (https://photonstorm.github.io/phaser3-docs/) — Confirm physics behavior, current version, TypeScript support
3. **Phaser + Colyseus Examples** (GitHub, official examples) — Check for 2025-2026 updates to integration patterns
4. **Recent Post-Mortems** — Search for "browser multiplayer game post-mortem 2025 2026" to find recent learnings
5. **Colyseus Discord/GitHub Issues** — Check for gotchas, performance tips, common questions from active community

**For specific phases:**
- **Phase 1-3:** Colyseus examples repo, Phaser multiplayer tutorials
- **Phase 5:** Passport.js + Express + Colyseus integration guides
- **Phase 7:** MOBA or hero shooter design resources if needed (GDC talks, design blogs)
- **Phase 8:** Matchmaking algorithm papers (Elo, Glicko-2, TrueSkill) if going beyond basic

---

**Research completed:** 2026-02-09
**Ready for roadmap:** Yes
**Next step:** Requirements definition (defining user stories and acceptance criteria per phase)

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The asymmetric momentum mechanic must feel right — Paran building terrifying speed with instant turning but losing everything on collision, guardians relying on positioning and teamwork to force those collisions.
**Current focus:** Phase 5 (Multiplayer Lobbies)

## Current Position

Phase: 5 of 7 (Multiplayer Lobbies)
Plan: 6 of 7
Status: Complete
Last activity: 2026-02-11 — Completed 05-10-PLAN.md (Scene Reuse + Reconnect Error Handling)

Progress: [█████████░] 89% (16 of 18 plans complete: Phase 1-4 done, Phase 5: 6/7 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 7.1 min
- Total execution time: 1.9 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-server-architecture | 3 | 26 min | 8.7 min |
| 02-core-movement | 2 | 29 min | 14.5 min |
| 03-combat-system | 2 | 48 min | 24.0 min |
| 04-match-lifecycle-maps | 3 | 17 min | 5.7 min |
| 05-multiplayer-lobbies | 6 | 18 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 05-02 (3 min), 05-03 (2 min), 05-04 (5 min), 05-07 (3 min), 05-10 (2 min)
- Trend: Phase 5 maintaining excellent velocity (avg 3.0 min), gap closures resolving UAT blockers efficiently

*Updated after each plan completion*
| Phase 05 P02 | 3 | 2 tasks | 6 files |
| Phase 05 P03 | 2 | 2 tasks | 5 files |
| Phase 05 P05 | 1 | 2 tasks | 1 files |
| Phase 05 P06 | 4 | 2 tasks | 3 files |
| Phase 05 P04 | 5 | 2 tasks | 2 files |
| Phase 05 P07 | 3 | 2 tasks | 3 files |
| Phase 05 P11 | 88 | 2 tasks | 1 files |
| Phase 05 P10 | 1.7 | 2 tasks | 3 files |

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
- [Phase 04-03]: 4 maps in rotation pool provides gameplay variety
- [Phase 04-03]: Sequential map rotation ensures all maps get played without repetition
- [Phase 04-03]: Map-specific spawn points ensure balanced starting positions
- [Phase 05-01]: Room code excludes ambiguous characters (0/O, 1/I/L) for user clarity
- [Phase 05-01]: Changing role un-readies player to confirm selection
- [Phase 05-01]: GameRoom accepts roleAssignments option from lobby
- [Phase 05-01]: Room code excludes ambiguous characters (0/O, 1/I/L) for user clarity
- [Phase 05-01]: Changing role un-readies player to confirm selection
- [Phase 05-01]: GameRoom accepts roleAssignments option from lobby
- [Phase 05-02]: HTML input for room code entry (Phaser lacks native text input)
- [Phase 05-02]: GameScene accepts room from scene data with fallback for testing
- [Phase 05-02]: Room code lookup via HTTP GET /rooms/find endpoint
- [Phase 05-02]: Store reconnection token in localStorage for browser refresh recovery
- [Phase 05-03]: 60s grace period for match reconnection (longer than 30s lobby grace)
- [Phase 05-03]: Disconnected players frozen in place for fair reconnection
- [Phase 05-03]: Client checks reconnection on LobbyScene.create() for seamless auto-reconnect
- [Phase 05-03]: 60s grace period for match reconnection (longer than 30s lobby grace)
- [Phase 05-03]: Disconnected players frozen in place for fair reconnection
- [Phase 05-03]: Client checks reconnection on LobbyScene.create() for seamless auto-reconnect
- [Phase 05]: State listener for room code display - race-condition-safe
- [Phase 05]: Optimistic UI updates for character selection - immediate visual feedback
- [Phase 05-06]: Single shared MatchmakingRoom instance for all queuing players
- [Phase 05-06]: Match formation check every 1 second via clock interval
- [Phase 05-06]: Server creates lobby and broadcasts roomId to matched players
- [Phase 05-06]: Client auto-selects assigned role after joining lobby from matchmaking
- [Phase 05-04]: matchMaker.createRoom() instead of create() to avoid phantom seat reservation
- [Phase 05-04]: GameRoom reads role from options.role instead of sessionId lookup for cross-room persistence
- [Phase 05-07]: Defer consented leave deletion by 2s during PLAYING state for disconnect visual rendering
- [Phase 05-07]: Separate dcLabels map from eliminatedTexts to prevent label collision
- [Phase 05-07]: 3 retries with 800ms delay for F5 reconnection to handle WebSocket close race condition
- [Phase 05-07]: Extract handlePlayerChange() helper to deduplicate onChange logic between initial connection and reconnection

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-11 (phase execution)
Stopped at: Completed 05-10-PLAN.md (Scene Reuse + Reconnect Error Handling) — Phase 5: 6 of 7 plans complete
Resume file: .planning/phases/05-multiplayer-lobbies/05-10-SUMMARY.md

**Phase 5 In Progress (6 of 7):**
- 05-01 Complete: Server-side lobby infrastructure
  - LobbyRoom with character selection (role validation, conflict detection)
  - Ready system with 3-second countdown (requires 1 paran + 1 faran + 1 baran)
  - Private room codes (6-char alphanumeric, excludes ambiguous characters)
  - MatchmakingQueue singleton for role-based matchmaking (1 paran + 2 guardians)
  - GameRoom accepts lobby-assigned roles via roleAssignments option
  - Reconnection grace period (30s lobby, 60s match)
  - Both lobby_room and game_room registered on server
- 05-02 Complete: Client lobby UI and scene transitions
  - LobbyScene with main menu (create/join/queue buttons)
  - Private room creation with room code display
  - Join by room code with HTML input and /rooms/find endpoint
  - Matchmaking with preferred role selection
  - Character selection UI with availability indicators
  - Player list with real-time Schema callbacks
  - Ready button with role validation and countdown display
  - gameReady message handler for GameScene transition
  - Scene flow: Boot → Lobby → Game → Victory → Lobby
  - GameScene accepts room from scene data (no duplicate connection)
  - Reconnection token storage in localStorage
- 05-03 Complete: Reconnection support for network resilience
  - Server-side 60s grace period with allowReconnection during active matches
  - Player.connected boolean field synced to clients
  - Disconnected players frozen in place (zero velocity, drained inputs)
  - Client-side reconnection token persistence in localStorage
  - Automatic reconnection check on LobbyScene.create() before showing menu
  - handleReconnection method with token-based client.reconnect()
  - Disconnected players shown at 30% opacity with "DC" label
  - Browser refresh survival via stored reconnection token
  - Token cleanup on match end and intentional leave
- 05-04 Complete: Lobby-to-Game transition blockers (gap closure)
  - Fixed phantom seat reservation (matchMaker.createRoom instead of create)
  - Fixed role assignment (options.role instead of sessionId lookup)
  - Added role conflict prevention with fallback to available role
  - All 3 players can now successfully join GameRoom with correct roles
- 05-07 Complete: Reconnection failures and disconnect ghosting (gap closure)
  - Server: defer consented leave deletion by 2s during PLAYING state
  - Client: separate dcLabels map for DC labels (no collision with ELIMINATED)
  - LobbyScene: 3-attempt retry with 800ms delay for F5 reconnection
  - GameScene: full Schema state listener re-registration after reconnect
  - Extracted handlePlayerChange() helper for code reuse
- 05-10 Complete: Scene reuse + reconnect error handling (gap closure v3)
  - GameScene: explicit member variable reset in create() for scene reuse safety
  - Unified status text to single matchState Schema listener (removed competing writers)
  - GameRoom: onUncaughtException handler enabling Colyseus framework error wrapping
  - Defensive player validation in reconnection success path
  - Process-level uncaughtException and unhandledRejection handlers in index.ts
  - Fixes intermittent Baran controls on second match and reconnect crashes
- Next: 05-11 (final gap closure) then Phase 5 complete

**Phase 4 Complete (3 of 3):**
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
- 04-03 Complete: Arena map system with 4-map rotation
  - shared/maps.ts with MapMetadata interface and MAPS array
  - 3 new arena maps: corridor_chaos (tight corridors), cross_fire (central cross), pillars (scattered cover)
  - Server sequential map rotation with static counter (round-robin)
  - Client dynamic map loading from state.mapName
  - Map-specific spawn points (Paran center, guardians at opposite corners)
  - All maps 800x608 pixels (25x19 tiles) with distinct obstacle layouts
- Next: Phase 5 (if exists) or Phase 6 (Polish & Testing)

**Phase 3 Complete:**
- Server-authoritative combat system with projectiles, collision, damage, death
- Character archetypes: faran/baran guardians (50 HP, fast fire) vs paran force (150 HP, slow fire, high damage)
- Client fire input (spacebar), projectile rendering with interpolation, health bar UI
- Role-based visual differentiation (size, color) and gameplay (fire rate, damage, speed)
- Paran Pac-Man style cardinal movement (last-key-wins, instant stop, speed redirects)
- Guardian instant stop mechanic (zero velocity on input release)
- Paran wall penalty mechanic (loses all velocity on wall collision)

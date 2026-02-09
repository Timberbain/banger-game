# Domain Pitfalls

**Domain:** Real-time multiplayer browser arena game (Phaser + Colyseus)
**Project:** Banger (1v2 asymmetric shooter)
**Researched:** 2026-02-09
**Confidence:** MEDIUM (based on training data, unable to verify with current sources)

## Research Limitations

**IMPORTANT:** This research was conducted using training data only (knowledge cutoff January 2025). Web search and documentation verification tools were unavailable. All findings should be validated against:
- Current Colyseus documentation (2026)
- Current Phaser 3 documentation (2026)
- Recent post-mortems from shipped multiplayer games

Confidence levels reflect this limitation.

---

## Critical Pitfalls

Mistakes that cause rewrites, fundamental architecture changes, or render the game unplayable.

### Pitfall 1: Client-Side Physics Simulation with Server Authority Mismatch

**Confidence:** HIGH (fundamental to all client-server architectures)

**What goes wrong:**
Running full physics simulation on both client and server with different physics engines or configurations leads to desynchronization. Client shows player hitting a wall, server says they didn't - combat outcomes become unpredictable and frustrating.

**Why it happens:**
- Phaser's Arcade/Matter physics runs client-side by default
- Developers assume running "the same" physics on both sides is enough
- Floating-point arithmetic differences between environments cause drift
- Frame rate differences (server may run at different tick rate than client)

**Consequences:**
- Players see hits that don't register
- Collision penalties apply inconsistently
- Rubber-banding and teleportation
- Momentum-based mechanics (critical for Banger's Paran character) become unreliable
- Trust issues: "I didn't hit that wall!"

**Prevention:**
1. **Choose Authority Model Early (Phase 1: Core Architecture)**
   - **Server-authoritative:** Server runs physics, clients predict and reconcile
   - **Client-authoritative:** Risky for competitive games (cheat vulnerability)
   - For Banger: Server-authoritative required for fair collision penalties

2. **Implement Client-Side Prediction + Server Reconciliation**
   - Client simulates movement locally for responsive feel
   - Server sends authoritative state updates
   - Client reconciles differences and corrects predictions
   - Document: "Client prediction is an APPROXIMATION, server state is TRUTH"

3. **Physics-Less Server Option**
   - Don't run full Phaser physics server-side
   - Implement simplified physics logic in Colyseus room
   - Use lightweight collision detection (SAT.js, custom AABB)
   - Reduces server load, ensures determinism

4. **Fixed Timestep on Server**
   - Server physics must run at fixed tick rate (e.g., 60 ticks/sec)
   - Independent of client frame rate
   - Use accumulator pattern for consistent updates

**Detection:**
- Players report "hits not registering"
- Movement feels "snappy" then "corrects" abruptly
- Different outcomes on slow vs fast connections
- Desync increases over time (positions drift)

**Phase to Address:**
- **Phase 1 (Foundation):** Establish authority model, implement basic prediction
- **Phase 2 (Core Loop):** Tune reconciliation, test with latency simulation
- **Phase 4 (Polish):** Advanced prediction techniques (lag compensation)

---

### Pitfall 2: Naïve State Synchronization (Sending Everything Every Tick)

**Confidence:** HIGH (core Colyseus concern)

**What goes wrong:**
Sending full game state every server tick (e.g., all 3 player positions, all projectiles, all collision states) creates bandwidth bottleneck. Game works fine locally, breaks with 100+ ms latency or on mobile networks.

**Why it happens:**
- Colyseus schema makes state sync easy - too easy
- "Just sync everything" seems simplest during prototyping
- Bandwidth issues don't appear in local testing
- Projectile spawning scales poorly (10 bullets = 10x state updates)

**Consequences:**
- Laggy gameplay on typical connections
- High server bandwidth costs
- Mobile players can't play (cellular bandwidth)
- Projectile-heavy combat (Banger's core) becomes unplayable
- Server costs scale linearly with player count

**Prevention:**
1. **Delta Compression (Built into Colyseus)**
   - Colyseus sends only changed state by default
   - BUT: Must design schema to maximize delta efficiency
   - Group frequently-changing data (positions) separately from static data (player names)

2. **Spatial Filtering**
   - Don't send updates for entities outside player viewport
   - For Banger: Small arena, less relevant, but applies to multi-room lobbies

3. **Update Frequency Tiers**
   - Critical data (player positions): 20-60 Hz
   - Less critical (player health): 10 Hz
   - Static data (map obstacles): Once on join
   - Implement in Colyseus room logic with separate update loops

4. **Event-Driven for Discrete Actions**
   - Don't sync projectile state every tick
   - Send "projectile_fired" event with initial vector
   - Clients simulate trajectory
   - Server sends corrections only if misprediction

5. **Quantization**
   - Don't send `position: { x: 1234.5678, y: 9876.5432 }`
   - Round to nearest integer or fixed precision
   - `position: { x: 1235, y: 9877 }` (50% bandwidth reduction for positions)

**Detection:**
- Bandwidth monitoring shows >100 KB/s per player
- Lag correlates with number of projectiles on screen
- Chrome DevTools Network tab shows constant WebSocket traffic
- Colyseus room state size grows unbounded

**Phase to Address:**
- **Phase 1:** Establish delta-friendly schema structure
- **Phase 2:** Implement update frequency tiers
- **Phase 3:** Add event-driven projectiles, quantization
- **Phase 5:** Spatial filtering (if scope expands)

---

### Pitfall 3: Client Trust (Validating Nothing Server-Side)

**Confidence:** HIGH (security fundamental)

**What goes wrong:**
Accepting client input without validation allows cheating: speed hacks, teleportation, invincibility, instant reloads. Competitive 1v2 game becomes unplayable when one player cheats.

**Why it happens:**
- "We're not big enough to attract cheaters" (wrong from day one)
- Validation adds complexity and latency
- Trusting clients is easier during development
- Colyseus examples often skip validation for simplicity

**Consequences:**
- Cheaters ruin matches
- Legitimate players leave
- Reputation damage
- Impossible to add anti-cheat retroactively (requires architecture change)

**Prevention:**
1. **Validate All Input (Phase 1: Non-Negotiable)**
   - Movement: Max speed, acceleration limits
   - Actions: Cooldowns, resource costs, range limits
   - Collision: Server confirms collision state, applies penalties
   - Example: Client says "I moved 500 units/frame" → Server rejects (physically impossible)

2. **Server Authority for Combat**
   - Server determines hit detection
   - Client renders optimistically, server confirms
   - Rollback on misprediction acceptable for competitive integrity

3. **Rate Limiting**
   - Limit input messages per second per client
   - Reject clients spamming inputs
   - Colyseus built-in: `maxClients`, custom rate limiters

4. **Sanity Checks**
   - "Did player teleport?" (distance > max_speed * delta_time)
   - "Is player inside wall?" (collision check)
   - "Did player shoot before reload finished?" (timestamp check)

5. **Cheat Detection Telemetry**
   - Log suspicious events (impossible speeds, excessive hits)
   - Flag accounts for review
   - Don't ban immediately (false positives), but track

**Detection:**
- Players report impossible gameplay
- Replay data shows physics violations
- One player dominates with statistically impossible accuracy/speed

**Phase to Address:**
- **Phase 1:** Input validation framework
- **Phase 2:** Combat validation
- **Phase 3:** Rate limiting, sanity checks
- **Phase 6:** Telemetry and detection (post-launch)

---

### Pitfall 4: Interpolation vs. Extrapolation Confusion

**Confidence:** MEDIUM (implementation detail, but commonly misunderstood)

**What goes wrong:**
Using extrapolation (predicting future positions) when you should interpolate (smoothing between known states) creates erratic movement. Players see opponents "jump" or move in wrong direction.

**Why it happens:**
- Terms are confusing for beginners
- "Prediction" sounds better than "delay"
- Copying code without understanding
- Network jitter causes missed updates

**Consequences:**
- Opponent movement looks jittery or wrong
- Acceleration-based movement (Banger's core) looks especially bad
- Players can't aim at moving targets
- Momentum mechanic feels unpredictable

**Prevention:**
1. **Understand the Difference**
   - **Interpolation:** Render positions slightly in the past, smoothly between known server states
   - **Extrapolation:** Predict future position based on last known velocity
   - **Local player:** Extrapolation (prediction) for responsiveness
   - **Remote players:** Interpolation for accuracy

2. **Use Interpolation for Remote Players**
   - Buffer 2-3 server updates
   - Render position 100-150ms in the past
   - Smooth transitions using lerp/slerp
   - Acceptable tradeoff: slight delay for smooth, accurate movement

3. **Extrapolation Only for Local Player**
   - Immediate response to input
   - Predict local movement
   - Server corrects if wrong (reconciliation)

4. **Handle Jitter with Buffer**
   - Network jitter causes irregular update timing
   - Maintain small buffer of states
   - Interpolate between buffered states at consistent rate
   - If buffer empty (packet loss), extrapolate briefly as fallback

**Detection:**
- Remote players "stutter" or "teleport"
- Movement looks wrong during direction changes
- Acceleration/deceleration not smooth
- Players complain they "can't hit" moving targets

**Phase to Address:**
- **Phase 2:** Implement interpolation for remote entities
- **Phase 3:** Tune buffer size, handle jitter
- **Phase 4:** Polish smoothness

---

### Pitfall 5: Not Testing With Realistic Latency Early

**Confidence:** HIGH (testing methodology)

**What goes wrong:**
Game feels great on localhost (0ms latency), launches with real-world latency (50-150ms), and combat feels unresponsive or broken. Major rework required post-launch.

**Why it happens:**
- Local testing is easy and fast
- "We'll test networking later"
- Don't realize how much latency affects feel
- Tools for latency simulation unknown/unused

**Consequences:**
- Combat timing feels wrong
- Hit registration frustrates players
- Movement feels sluggish
- Post-launch panic and rushed fixes
- Bad reviews focus on "laggy" gameplay

**Prevention:**
1. **Latency Simulation from Phase 1**
   - Use tools: Chrome DevTools Network throttling, `tc` (Linux), Clumsy (Windows)
   - Test at 50ms, 100ms, 150ms, 200ms latency
   - Test with packet loss (1-3%)
   - Make this part of daily development workflow

2. **CI/CD with Latency Tests**
   - Automated tests run with simulated latency
   - Catch regressions that only appear under lag
   - Colyseus testing: Use `@colyseus/testing` or Playwright with network conditions

3. **Target Latency Budget**
   - Define acceptable latency range (e.g., "playable at 150ms")
   - Measure perceived responsiveness (input → visual feedback)
   - For Banger: Fast-paced combat needs <100ms perceived latency
   - Use prediction to hide network latency

4. **Geographically Distributed Testing**
   - Don't just test locally
   - Test cross-region (US-East to US-West, US to EU)
   - Identify when multiple server regions needed

**Detection:**
- Launch day reports: "Game is laggy"
- Combat timing complaints
- Regional differences (EU players vs US players)
- Metrics show high input-to-action latency

**Phase to Address:**
- **Phase 1:** Setup latency simulation tools
- **Phase 2:** Daily testing with simulated lag
- **Phase 3:** Cross-region testing
- **Phase 5:** Production monitoring

---

## Moderate Pitfalls

Issues that cause significant rework but not complete rewrites.

### Pitfall 6: Tight Coupling Between Phaser and Game Logic

**Confidence:** MEDIUM

**What goes wrong:**
Game logic (movement, combat, collision) embedded in Phaser scene code makes it impossible to run logic server-side or write unit tests. Server must duplicate logic differently, causing desync.

**Prevention:**
- Separate pure game logic from rendering
- Extract to shared TypeScript modules (usable client and server)
- Phaser scenes only handle rendering and input capture
- Server and client import same logic modules
- **Phase to address:** Phase 1 (architecture foundation)

**Detection:**
- Can't unit test game logic
- Server logic diverges from client
- Desync bugs appear post-launch

---

### Pitfall 7: Room State Size Explosion

**Confidence:** MEDIUM (Colyseus-specific)

**What goes wrong:**
Colyseus room state grows unbounded as projectiles, effects, and events accumulate. State serialization slows down, eventually crashes server.

**Prevention:**
- Remove entities from state when no longer needed
- Projectiles: Remove after impact or timeout
- Events: Don't store history in state
- Use MapSchema with proper cleanup
- Monitor state size in development
- **Phase to address:** Phase 2 (implement cleanup), Phase 4 (monitoring)

**Detection:**
- Server memory usage grows over time
- Serialization time increases
- Room crashes after long matches

---

### Pitfall 8: Matchmaking Without Reconnection

**Confidence:** MEDIUM

**What goes wrong:**
Player disconnects briefly (mobile network blip), gets kicked, can't rejoin match. 1v2 becomes 1v1, ruins match for all players.

**Prevention:**
- Implement reconnection grace period (30-60 seconds)
- Store player session tokens
- Allow rejoin to same room
- Handle state resynchronization after reconnect
- **Phase to address:** Phase 3 (matchmaking includes reconnection)

**Detection:**
- Players complain about disconnections
- Matches end prematurely
- High abandonment rate

---

### Pitfall 9: Asset Loading Causes Gameplay Hitches

**Confidence:** MEDIUM

**What goes wrong:**
Loading projectile sprites, sound effects, or map assets during gameplay causes frame drops during combat. Player fires first shot, game freezes 100ms.

**Prevention:**
- Preload all assets before match starts
- Use Phaser's preloader scene
- Lazy loading only for non-gameplay assets (UI, menus)
- Test on slower devices (mobile, old laptops)
- **Phase to address:** Phase 2 (asset preloading), Phase 4 (performance testing)

**Detection:**
- Frame drops during first projectile spawn
- Stuttering when new effects appear
- Performance metrics show spikes

---

### Pitfall 10: No Graceful Degradation for Lag Spikes

**Confidence:** MEDIUM

**What goes wrong:**
Temporary connection issues (packet loss, latency spike) make game completely unplayable instead of degrading gracefully. 5-second lag spike = player dies because couldn't move.

**Prevention:**
- Implement dead reckoning (continue predicted movement during connection loss)
- Freeze game state for very brief disconnects (<500ms)
- Visual indicators for lag (connection quality icon)
- Input buffering during reconnection
- **Phase to address:** Phase 4 (polish and edge cases)

**Detection:**
- Players report sudden freezing
- Deaths during lag spikes
- No visual feedback for connection issues

---

## Minor Pitfalls

Issues that cause annoyance but are relatively easy to fix.

### Pitfall 11: Hardcoded Game Constants

**Confidence:** LOW (basic code quality)

**What goes wrong:**
Player speed, projectile damage, collision penalties scattered throughout code. Balancing requires hunting down magic numbers.

**Prevention:**
- Centralize constants in config files
- Use TypeScript const enums or config objects
- Load from JSON for easy tweaking
- **Phase to address:** Phase 1 (code organization)

---

### Pitfall 12: No Local Development Proxy

**Confidence:** LOW

**What goes wrong:**
Testing client changes requires restarting server, slows iteration. Frontend devs can't work without backend running.

**Prevention:**
- Use Colyseus dev mode with hot reload
- Proxy client to remote dev server
- Mock server responses for pure UI work
- **Phase to address:** Phase 1 (dev environment setup)

---

### Pitfall 13: Forgetting Clock Synchronization

**Confidence:** MEDIUM (timing-specific)

**What goes wrong:**
Client and server clocks out of sync causes ability cooldowns, match timers, and timed events to mismatch. Server says "reload not ready", client shows ready.

**Prevention:**
- Use Colyseus Clock API (`room.clock`)
- Sync client clock with server on connection
- Use server time for all game timing logic
- Client clock only for rendering/interpolation
- **Phase to address:** Phase 2 (timing systems)

**Detection:**
- Cooldowns appear incorrect
- Match timers desync
- Timed events trigger at wrong time

---

### Pitfall 14: Not Handling Browser Tab Visibility

**Confidence:** LOW

**What goes wrong:**
Player switches browser tabs, game continues running. Returns to find character dead or match over. Or: game pauses, causing server timeout.

**Prevention:**
- Detect visibility change (Page Visibility API)
- Reduce update frequency when tab hidden (save battery)
- Show reconnection UI when returning
- Server should be lenient with timeouts (don't kick immediately)
- **Phase to address:** Phase 3 (UX polish)

---

### Pitfall 15: Inadequate Room Cleanup

**Confidence:** MEDIUM (Colyseus-specific)

**What goes wrong:**
Empty rooms stay alive, consuming server resources. Memory leaks accumulate. Server eventually runs out of memory.

**Prevention:**
- Implement `onDispose()` in Colyseus rooms
- Auto-dispose empty rooms after timeout
- Clean up timers, intervals, event listeners
- Monitor room count vs active players
- **Phase to address:** Phase 2 (room lifecycle management)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Confidence |
|-------------|---------------|------------|------------|
| Phase 1: Architecture | Choosing wrong authority model | Research client prediction + server reconciliation patterns, prototype early | HIGH |
| Phase 1: Networking | No latency testing from day one | Setup throttling tools before first multiplayer test | HIGH |
| Phase 2: Core Loop | Trusting client input | Implement validation framework before adding features | HIGH |
| Phase 2: Physics | Physics desync client/server | Decide: lightweight server physics OR full reconciliation | HIGH |
| Phase 2: State Sync | Sending everything every frame | Use Colyseus delta compression, profile bandwidth early | HIGH |
| Phase 3: Combat | Hit detection feels wrong | Implement lag compensation, test at 100ms+ latency | MEDIUM |
| Phase 3: Matchmaking | No reconnection support | Build reconnection before public testing | MEDIUM |
| Phase 4: Performance | Asset loading hitches | Profile on slow devices, preload everything | MEDIUM |
| Phase 5: Scale | Room cleanup neglected | Memory profiling, automated cleanup tests | MEDIUM |
| Phase 6: Launch | No production monitoring | Setup telemetry before launch | MEDIUM |

---

## Phaser + Colyseus Specific Gotchas

### Gotcha 1: Phaser's Arcade Physics is Not Deterministic

**Confidence:** MEDIUM (Phaser-specific)

Arcade Physics uses floating-point arithmetic that can produce different results on different machines. Running identical code client and server may still produce desyncs due to CPU architecture differences.

**Solution:**
- Don't rely on perfect physics determinism
- Use server-authoritative model with client prediction
- OR: Use Matter.js (more deterministic) but heavier
- OR: Implement custom fixed-point physics

---

### Gotcha 2: Colyseus State Schema Doesn't Support Inheritance Well

**Confidence:** LOW (Colyseus-specific, may have changed)

Using TypeScript class inheritance with Colyseus Schema can cause serialization issues.

**Solution:**
- Prefer composition over inheritance for state classes
- Keep state schema flat where possible
- Test serialization thoroughly if using inheritance

---

### Gotcha 3: WebSocket Connections Limited on Mobile

**Confidence:** LOW

Mobile browsers may have stricter WebSocket connection limits or aggressive power-saving that closes connections.

**Solution:**
- Implement robust reconnection
- Test thoroughly on mobile devices (not just emulators)
- Consider using Colyseus's built-in reconnection tokens

---

## Testing Strategy for Pitfall Prevention

### Phase 1: Foundation (Week 1-2)
- [ ] Setup latency simulation (Chrome DevTools, tc, or Clumsy)
- [ ] Test basic movement at 0ms, 50ms, 100ms, 150ms
- [ ] Verify client prediction + server reconciliation works
- [ ] Confirm input validation framework in place

### Phase 2: Core Loop (Week 3-6)
- [ ] Test projectiles under lag
- [ ] Profile bandwidth usage (target: <50 KB/s per player)
- [ ] Test collision detection under latency
- [ ] Verify momentum mechanics don't desync

### Phase 3: Multiplayer Features (Week 7-10)
- [ ] Test reconnection (simulate disconnect/reconnect)
- [ ] Test with 3 players at different latencies
- [ ] Cross-region testing (US <-> EU)
- [ ] Verify matchmaking doesn't leak rooms

### Phase 4: Polish (Week 11-12)
- [ ] Test on mobile devices (iOS Safari, Chrome Android)
- [ ] Test tab visibility changes
- [ ] Performance profiling on low-end devices
- [ ] Lag spike simulation (200ms+ temporary latency)

### Phase 5: Scale Testing (Week 13-14)
- [ ] Load test: Multiple rooms simultaneously
- [ ] Memory profiling: Long-running rooms
- [ ] Connection storm: Many joins/leaves rapidly

---

## Red Flags Checklist

If you answer "yes" to any of these during development, STOP and address:

- [ ] **Can client send movement input without validation?** (Client trust pitfall)
- [ ] **Does server send full state every tick?** (Bandwidth pitfall)
- [ ] **Are we testing only on localhost?** (Latency testing pitfall)
- [ ] **Is game logic embedded in Phaser scenes?** (Coupling pitfall)
- [ ] **Do projectiles stay in state forever?** (State explosion pitfall)
- [ ] **Can't unit test combat logic?** (Coupling pitfall)
- [ ] **No way to rejoin disconnected match?** (Reconnection pitfall)
- [ ] **Clock/timing uses client time?** (Clock sync pitfall)
- [ ] **Empty rooms never dispose?** (Resource leak pitfall)

---

## Sources & Verification Needed

**CRITICAL:** This research was conducted without access to verification tools. All findings are based on training data (pre-January 2025) and should be validated against:

1. **Official Documentation (HIGH PRIORITY)**
   - Colyseus documentation (https://docs.colyseus.io/) - Verify state sync, authority patterns, testing
   - Phaser 3 documentation (https://photonstorm.github.io/phaser3-docs/) - Verify physics behavior
   - Check for 2026 updates to both frameworks

2. **Real-World Case Studies (MEDIUM PRIORITY)**
   - Search for "Phaser Colyseus post-mortem 2025 2026"
   - GitHub discussions on Colyseus repo
   - Phaser Discord/forum discussions on multiplayer

3. **Specific Verification Points (HIGH PRIORITY)**
   - Does Colyseus still use Schema for state? (Confirm current API)
   - Is Arcade Physics still non-deterministic? (Verify with latest Phaser)
   - What are current Colyseus testing best practices?
   - Are there new latency compensation techniques (2025-2026)?

**Confidence Assessment:**
- Critical Pitfalls 1-5: MEDIUM-HIGH (based on fundamental networking principles unlikely to change)
- Moderate Pitfalls: MEDIUM (common patterns, need verification)
- Minor Pitfalls: LOW-MEDIUM (implementation details, may have changed)
- Framework-specific gotchas: LOW (need verification with current versions)

**Recommended Next Steps:**
1. Verify Colyseus current best practices documentation
2. Check Phaser 3 physics determinism in 2026 documentation
3. Search for recent multiplayer game post-mortems using this stack
4. Validate pitfall rankings with community discussions

---

## Summary

**Highest Priority Pitfalls to Address in Phase 1:**
1. Client-server physics authority model
2. Input validation framework
3. Latency testing setup
4. State synchronization strategy
5. Code architecture (logic separation)

**Most Likely to Cause Rewrites if Ignored:**
- Physics authority model chosen wrong
- No client prediction/reconciliation
- Client trust (no validation)
- State sync sends everything

**Banger-Specific Concerns:**
- Momentum-based movement requires tight synchronization
- Collision penalties must be server-authoritative for fairness
- 1v2 asymmetry means balance is critical (cheating ruins it)
- Projectile-heavy combat = bandwidth sensitive

All findings require validation with current documentation and community resources.

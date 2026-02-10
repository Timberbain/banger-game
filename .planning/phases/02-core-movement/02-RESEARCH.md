# Phase 2: Core Movement - Research

**Researched:** 2026-02-10
**Domain:** Client-side prediction, entity interpolation, acceleration-based physics
**Confidence:** HIGH

## Summary

Phase 2 implements responsive player movement using acceleration-based physics with client-side prediction for the local player and entity interpolation for remote players. This phase transforms the pure server-authoritative movement from Phase 1 into a responsive experience that feels good at up to 150ms network latency.

The core technical challenge is maintaining server authority while achieving <100ms perceived input latency. This requires three complementary techniques: (1) client-side prediction with input replay for local movement, (2) entity interpolation with buffering for smooth remote player rendering, and (3) acceleration-based physics that's deterministic enough for prediction/reconciliation.

Colyseus provides delta state synchronization but doesn't include built-in prediction/interpolation systems—these must be implemented manually. The good news: this is a well-understood problem domain with established patterns from Valve's Source engine, Gabriel Gambetta's articles, and Colyseus community implementations.

**Primary recommendation:** Implement client-side prediction first (local responsiveness), then entity interpolation (remote smoothness), using Phaser's Arcade Physics properties (acceleration, drag, maxVelocity) for deterministic movement simulation on both client and server.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Colyseus | 0.15.57 | Server-authoritative state sync | Provides delta encoding, input queuing foundation; client/server must match major.minor |
| Colyseus.js | 0.15.28 | Client SDK | Protocol compatibility with server 0.15.57 (0.16.x incompatible) |
| Phaser 3 | 3.90.0 | Game engine with physics | Arcade Physics provides acceleration, drag, maxVelocity properties for movement |
| TypeScript | 5.x | Type-safe shared code | Enables shared constants and physics logic between client/server |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | Prediction/interpolation implemented manually using Colyseus primitives |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual prediction | Colyseus 0.17+ built-in | 0.17 has missing peer dependencies (Phase 1 decision), manual gives full control |
| Phaser Arcade Physics | Custom physics | Arcade Physics provides proven acceleration/drag/maxVelocity; custom adds complexity |
| Shared constants via npm workspace | Duplicate constants | Workspace adds build complexity; simple file duplication acceptable for small config |

**Installation:**
```bash
# No new dependencies required
# All libraries already installed in Phase 1
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shared/                  # Code shared between client and server
│   ├── physics.ts          # Movement constants, acceleration values, drag coefficients
│   └── config.ts           # Arena size, tick rate, player limits
├── server/src/
│   ├── rooms/
│   │   └── GameRoom.ts     # Server-authoritative physics simulation
│   └── schema/
│       └── GameState.ts    # Add velocity fields to Player schema
└── client/src/
    ├── scenes/
    │   └── GameScene.ts    # Client prediction + interpolation
    ├── systems/
    │   ├── Prediction.ts   # Local player prediction with input replay
    │   └── Interpolation.ts # Remote player smooth rendering
    └── physics/
        └── movement.ts     # Shared movement logic (apply acceleration, clamp velocity)
```

### Pattern 1: Client-Side Prediction with Input Replay

**What:** Client immediately simulates local player movement upon input, then reconciles with authoritative server state when updates arrive.

**When to use:** For local player only—eliminates perceived input lag by showing immediate visual feedback.

**How it works:**
1. Client sends input to server with sequence number
2. Client immediately applies input locally (prediction)
3. Client stores input in pending buffer
4. Server processes input and sends back state + last processed sequence
5. Client receives update, rewinds to that state, replays all unacknowledged inputs

**Example:**
```typescript
// Source: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
// Adapted for Colyseus + Phaser

interface PendingInput {
  seq: number;
  input: InputState;
  timestamp: number;
}

class PredictionSystem {
  private inputSequence = 0;
  private pendingInputs: PendingInput[] = [];

  sendInput(input: InputState) {
    const seq = this.inputSequence++;

    // Send to server with sequence number
    this.room.send('input', { seq, ...input });

    // Apply immediately to local player (prediction)
    this.applyInput(this.localPlayer, input);

    // Store for reconciliation
    this.pendingInputs.push({ seq, input, timestamp: Date.now() });
  }

  reconcile(serverState: PlayerState, lastProcessedSeq: number) {
    // Discard acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter(i => i.seq > lastProcessedSeq);

    // Reset to authoritative state
    this.localPlayer.x = serverState.x;
    this.localPlayer.y = serverState.y;
    this.localPlayer.vx = serverState.vx;
    this.localPlayer.vy = serverState.vy;

    // Replay unacknowledged inputs
    for (const pending of this.pendingInputs) {
      this.applyInput(this.localPlayer, pending.input);
    }
  }

  private applyInput(player: Player, input: InputState) {
    // Apply acceleration-based movement (shared logic)
    applyMovementPhysics(player, input, PHYSICS_CONSTANTS);
  }
}
```

### Pattern 2: Entity Interpolation for Remote Players

**What:** Render remote players between two past server snapshots, trading real-time accuracy for smooth movement.

**When to use:** For all remote players—eliminates choppy movement caused by discrete server updates.

**How it works:**
1. Buffer incoming position updates (at least 2 snapshots)
2. Render time lags behind real time by interpolation delay (typically 100ms)
3. Linearly interpolate position/angle between buffered snapshots
4. If snapshot missing (packet loss), continue interpolating to last known position

**Example:**
```typescript
// Source: https://www.gabrielgambetta.com/entity-interpolation.html
// Adapted for Colyseus schema onChange callbacks

interface Snapshot {
  timestamp: number;
  x: number;
  y: number;
  angle: number;
}

class InterpolationSystem {
  private snapshots: Map<string, Snapshot[]> = new Map();
  private renderDelay = 100; // ms behind server time

  addSnapshot(sessionId: string, snapshot: Snapshot) {
    if (!this.snapshots.has(sessionId)) {
      this.snapshots.set(sessionId, []);
    }
    const buffer = this.snapshots.get(sessionId)!;
    buffer.push(snapshot);

    // Keep buffer reasonable size (last 1 second of snapshots)
    const cutoff = Date.now() - 1000;
    this.snapshots.set(sessionId, buffer.filter(s => s.timestamp > cutoff));
  }

  interpolate(sessionId: string, renderTime: number): Snapshot | null {
    const buffer = this.snapshots.get(sessionId);
    if (!buffer || buffer.length < 2) return null;

    const targetTime = renderTime - this.renderDelay;

    // Find snapshots to interpolate between
    let from: Snapshot | null = null;
    let to: Snapshot | null = null;

    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i].timestamp <= targetTime && buffer[i + 1].timestamp >= targetTime) {
        from = buffer[i];
        to = buffer[i + 1];
        break;
      }
    }

    if (!from || !to) {
      // Render latest available if no interpolation range found
      return buffer[buffer.length - 1];
    }

    // Linear interpolation
    const total = to.timestamp - from.timestamp;
    const elapsed = targetTime - from.timestamp;
    const alpha = total > 0 ? elapsed / total : 0;

    return {
      timestamp: targetTime,
      x: from.x + (to.x - from.x) * alpha,
      y: from.y + (to.y - from.y) * alpha,
      angle: from.angle + (to.angle - from.angle) * alpha,
    };
  }
}
```

### Pattern 3: Acceleration-Based Movement Physics

**What:** Players control acceleration, not position directly. Velocity accumulates from acceleration and decays via drag.

**When to use:** All player movement—provides responsive controls with momentum/inertia feel.

**How it works:**
1. Input applies acceleration in movement direction
2. Velocity += acceleration * deltaTime
3. Velocity *= (1 - drag * deltaTime) for deceleration
4. Clamp velocity to maxVelocity
5. Position += velocity * deltaTime

**Example:**
```typescript
// Source: Phaser Arcade Physics + https://www.gamedeveloper.com/design/game-feel-tips-ii-speed-gravity-friction
// Shared between client and server

interface PhysicsConstants {
  acceleration: number;    // px/s² applied when input held
  drag: number;            // damping factor (0-1, higher = more friction)
  maxVelocity: number;     // px/s maximum speed
}

const PHYSICS_CONSTANTS: PhysicsConstants = {
  acceleration: 600,       // Responsive acceleration
  drag: 0.85,              // Moderate friction (85% speed retained per second)
  maxVelocity: 200,        // Cap to prevent excessive speed
};

function applyMovementPhysics(
  player: { x: number; y: number; vx: number; vy: number },
  input: { left: boolean; right: boolean; up: boolean; down: boolean },
  constants: PhysicsConstants,
  deltaTime: number // in seconds (e.g., 0.01667 for 60Hz)
) {
  // Apply acceleration based on input
  let ax = 0;
  let ay = 0;

  if (input.left) ax -= constants.acceleration;
  if (input.right) ax += constants.acceleration;
  if (input.up) ay -= constants.acceleration;
  if (input.down) ay += constants.acceleration;

  // Normalize diagonal movement (prevent faster diagonal speed)
  if (ax !== 0 && ay !== 0) {
    const mag = Math.sqrt(ax * ax + ay * ay);
    ax = (ax / mag) * constants.acceleration;
    ay = (ay / mag) * constants.acceleration;
  }

  // Integrate acceleration into velocity
  player.vx += ax * deltaTime;
  player.vy += ay * deltaTime;

  // Apply drag (exponential decay)
  player.vx *= Math.pow(constants.drag, deltaTime);
  player.vy *= Math.pow(constants.drag, deltaTime);

  // Clamp to max velocity
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  if (speed > constants.maxVelocity) {
    player.vx = (player.vx / speed) * constants.maxVelocity;
    player.vy = (player.vy / speed) * constants.maxVelocity;
  }

  // Integrate velocity into position
  player.x += player.vx * deltaTime;
  player.y += player.vy * deltaTime;

  // Stop very small velocities (prevent floating point drift)
  if (Math.abs(player.vx) < 0.01) player.vx = 0;
  if (Math.abs(player.vy) < 0.01) player.vy = 0;
}
```

### Pattern 4: Automatic Facing Direction

**What:** Character sprite rotates to face movement direction using velocity vector.

**When to use:** When player is moving (velocity > threshold).

**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2

function updateFacingDirection(player: { vx: number; vy: number; angle: number }) {
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);

  // Only update facing if moving above threshold (prevents jitter when stopped)
  if (speed > 10) {
    // atan2(y, x) returns angle in radians from positive x-axis
    player.angle = Math.atan2(player.vy, player.vx);
  }
  // If not moving, retain last facing direction
}
```

### Pattern 5: Shared Constants Between Client and Server

**What:** Physics constants, arena dimensions, and game balance values defined once and used by both client and server.

**When to use:** All configurable values that affect gameplay or need client/server agreement.

**Example:**
```typescript
// shared/physics.ts - copied to both client/src and server/src
// Simple file duplication avoids monorepo complexity for small config

export const PHYSICS_CONSTANTS = {
  acceleration: 600,
  drag: 0.85,
  maxVelocity: 200,
};

export const ARENA_CONFIG = {
  width: 800,
  height: 600,
};

export const NETWORK_CONFIG = {
  tickRate: 60,
  interpolationDelay: 100, // ms
};
```

### Anti-Patterns to Avoid

- **Using Phaser physics on both client and server:** Phaser is browser-only. Server should use shared logic, not Phaser objects.
- **Syncing position without velocity:** Reconciliation and interpolation need velocity for accurate replay/prediction.
- **Fixed 100ms interpolation delay for all network conditions:** Use adaptive delay based on actual update frequency and jitter.
- **Applying drag when acceleration is present:** Drag should apply continuously, not conditionally (Phaser Arcade's drag applies only when acceleration is zero, which is unintuitive for top-down movement).
- **Sending inputs on every frame even when unchanged:** Wastes bandwidth; only send when input state changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State serialization | Custom binary protocol | Colyseus Schema | Delta encoding, type safety, automatic diffing |
| Input validation | String parsing of input | TypeScript interfaces + validation | Type errors at compile time, not runtime |
| Fixed timestep loop | setInterval or requestAnimationFrame | Colyseus setSimulationInterval + accumulator | Handles variable frame rates, prevents physics instability |
| Network time sync | Custom NTP implementation | Server-sent timestamps | Sufficient for interpolation delay calculations |
| Interpolation math | Bezier curves or splines | Linear interpolation | Simpler, lower latency, adequate for 60Hz updates |

**Key insight:** Client prediction and interpolation seem simple but have subtle edge cases (packet loss, out-of-order arrival, large corrections). Gabriel Gambetta's articles are the definitive reference—don't improvise without understanding the foundations.

## Common Pitfalls

### Pitfall 1: Misprediction Causing Rubberbanding

**What goes wrong:** Client prediction diverges from server state, causing visible "snapping" or "teleporting" when reconciliation occurs.

**Why it happens:**
- Different physics simulation on client vs server (floating point differences, missing shared constants)
- Client and server use different deltaTime values
- Velocity not synced, only position (reconciliation replays inputs from wrong initial conditions)

**How to avoid:**
- Use identical physics logic on client and server (shared TypeScript file)
- Ensure server's fixed timestep matches client's prediction timestep
- Sync velocity in addition to position (add vx, vy to Player schema)
- Add small tolerance for corrections (don't reconcile if error < 1 pixel)

**Warning signs:**
- Player appears to "jump backward" briefly when stopping
- Diagonal movement desyncs but cardinal directions work
- Prediction works on localhost but fails at >50ms latency

### Pitfall 2: Interpolation Stutter from Insufficient Buffer

**What goes wrong:** Remote players move jerkily or freeze momentarily during normal gameplay.

**Why it happens:**
- Interpolation delay too short (buffer runs out between updates)
- Packet loss or jitter causes missing snapshots
- Only buffering 1-2 snapshots (no margin for network variance)

**How to avoid:**
- Buffer at least 3 snapshots (allows interpolation even if 1 dropped)
- Use interpolation delay of 3x packet send rate (e.g., 100ms for 60Hz updates)
- Implement adaptive buffering that increases delay if frequent buffer starvation
- Add extrapolation fallback for rare cases where buffer fully depletes

**Warning signs:**
- Smooth at <50ms latency but choppy at 100ms+
- Player movement stalls briefly, then "catches up"
- Works fine on wired connection, fails on WiFi

### Pitfall 3: Non-Deterministic Physics Breaking Prediction

**What goes wrong:** Client's replayed inputs produce different results than original prediction, causing constant corrections.

**Why it happens:**
- Using Date.now() or performance.now() in physics calculations
- Randomness without seeded RNG
- Different deltaTime between initial prediction and reconciliation replay
- Floating point operations in different order on client vs server

**How to avoid:**
- Fixed timestep with constant deltaTime (1/60 = 0.01667s)
- No random numbers in movement physics
- Same formula order on client and server (a + b + c, not c + a + b)
- Use velocity clamping to prevent floating point accumulation

**Warning signs:**
- Constant small corrections even on localhost (0ms latency)
- Player vibrates in place when stationary
- Works initially but desyncs over time (floating point drift)

### Pitfall 4: Excessive Bandwidth from Unchanged State Sync

**What goes wrong:** Network traffic grows with player count even when players are stationary.

**Why it happens:**
- Colyseus sends state every patchRate even if nothing changed
- Floating point velocity never truly reaches zero (0.0000001)
- Angle constantly changing due to Math.atan2 on tiny velocity values

**How to avoid:**
- Set velocity to exactly 0 when below threshold (e.g., < 0.01)
- Only update angle when speed > movement threshold
- Use Colyseus filters to skip unchanged properties (advanced)
- Consider patchRate = 1000/30 (30Hz) instead of 60Hz if bandwidth limited

**Warning signs:**
- Network traffic proportional to player count, not activity
- Bandwidth usage same when all players AFK vs active
- Each client receives updates every tick even when nothing happening

### Pitfall 5: Input Lag from Server Round-Trip

**What goes wrong:** Movement feels sluggish even with client prediction enabled.

**Why it happens:**
- Waiting for server response before showing movement (defeats purpose of prediction)
- Rendering predicted position but not updating sprite until next frame
- Input handling in update() instead of immediately on keydown
- Not reconciling frequently enough (waiting for multiple inputs to batch)

**How to avoid:**
- Apply prediction in same frame as input sent (before render)
- Send input immediately on state change, don't wait for update() tick
- Reconcile on every server update, not batched
- Measure client-side input-to-visual latency (should be <16ms @ 60fps)

**Warning signs:**
- Feels better when disconnected from server
- Local player movement lags behind remote players
- Reducing network latency doesn't improve feel

## Code Examples

Verified patterns from official sources:

### Server: Add Velocity to Schema and Sync Last Processed Input

```typescript
// Source: Colyseus docs + https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html

import { Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;  // Add velocity for reconciliation
  @type("number") vy: number = 0;  // Add velocity for reconciliation
  @type("number") angle: number = 0;
  @type("number") health: number = 100;
  @type("string") name: string = "";
  @type("string") role: string = "";

  // Add last processed input sequence for reconciliation
  @type("number") lastProcessedSeq: number = 0;

  // Server-only (not synced)
  inputQueue: Array<{ seq: number; input: InputState }> = [];
}
```

### Server: Process Inputs with Sequence Tracking

```typescript
// Source: Adapted from Colyseus tutorial + Gambetta articles

this.onMessage("input", (client, message) => {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;

  const { seq, ...input } = message;

  // Validate input structure
  if (!this.isValidInput(input)) {
    console.warn(`Invalid input from ${client.sessionId}`);
    return;
  }

  // Queue input with sequence number
  player.inputQueue.push({ seq, input });
});

fixedTick(deltaTime: number) {
  this.state.players.forEach((player) => {
    while (player.inputQueue.length > 0) {
      const { seq, input } = player.inputQueue.shift()!;

      // Apply physics simulation
      applyMovementPhysics(player, input, PHYSICS_CONSTANTS, deltaTime / 1000);

      // Update facing direction
      updateFacingDirection(player);

      // Track last processed sequence for client reconciliation
      player.lastProcessedSeq = seq;
    }

    // Clamp to arena bounds
    player.x = Math.max(0, Math.min(ARENA_CONFIG.width, player.x));
    player.y = Math.max(0, Math.min(ARENA_CONFIG.height, player.y));
  });
}
```

### Client: Prediction with Reconciliation

```typescript
// Source: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
// Integrated with Colyseus + Phaser

export class GameScene extends Phaser.Scene {
  private inputSequence = 0;
  private pendingInputs: Array<{ seq: number; input: InputState }> = [];
  private lastInput: InputState = { left: false, right: false, up: false, down: false };

  create() {
    // Listen for server updates on local player
    this.room.state.players.onChange((player, sessionId) => {
      if (sessionId === this.room.sessionId) {
        // This is our local player - reconcile prediction
        this.reconcile(player);
      } else {
        // Remote player - add to interpolation buffer
        this.interpolation.addSnapshot(sessionId, {
          timestamp: Date.now(),
          x: player.x,
          y: player.y,
          angle: player.angle,
        });
      }
    });
  }

  update(time: number, delta: number) {
    const input = this.readInput();

    // Only send if input changed (save bandwidth)
    if (this.hasInputChanged(input, this.lastInput)) {
      this.sendInput(input);
      this.lastInput = { ...input };
    }

    // Update remote players via interpolation
    this.updateRemotePlayers(time);
  }

  private sendInput(input: InputState) {
    const seq = this.inputSequence++;

    // Send to server
    this.room.send('input', { seq, ...input });

    // Predict locally
    const localPlayer = this.getLocalPlayerData();
    applyMovementPhysics(localPlayer, input, PHYSICS_CONSTANTS, 1/60);
    this.updateLocalSprite(localPlayer);

    // Store for reconciliation
    this.pendingInputs.push({ seq, input });
  }

  private reconcile(serverState: Player) {
    // Discard inputs the server has processed
    const lastProcessedSeq = serverState.lastProcessedSeq;
    this.pendingInputs = this.pendingInputs.filter(p => p.seq > lastProcessedSeq);

    // Start from authoritative server state
    const localPlayer = {
      x: serverState.x,
      y: serverState.y,
      vx: serverState.vx,
      vy: serverState.vy,
      angle: serverState.angle,
    };

    // Replay pending (unacknowledged) inputs
    for (const { input } of this.pendingInputs) {
      applyMovementPhysics(localPlayer, input, PHYSICS_CONSTANTS, 1/60);
    }

    // Update sprite to reconciled position
    this.updateLocalSprite(localPlayer);
  }
}
```

### Client: Interpolation for Remote Players

```typescript
// Source: https://www.gabrielgambetta.com/entity-interpolation.html

class InterpolationSystem {
  private buffers = new Map<string, Snapshot[]>();
  private renderDelay = 100; // ms

  update(sessionId: string, sprite: Phaser.GameObjects.Sprite, currentTime: number) {
    const interpolated = this.interpolate(sessionId, currentTime);
    if (!interpolated) return;

    sprite.x = interpolated.x;
    sprite.y = interpolated.y;
    sprite.rotation = interpolated.angle;
  }

  private interpolate(sessionId: string, renderTime: number): Snapshot | null {
    const buffer = this.buffers.get(sessionId);
    if (!buffer || buffer.length < 2) return buffer?.[0] || null;

    const targetTime = renderTime - this.renderDelay;

    // Find bracketing snapshots
    for (let i = 0; i < buffer.length - 1; i++) {
      const from = buffer[i];
      const to = buffer[i + 1];

      if (from.timestamp <= targetTime && to.timestamp >= targetTime) {
        // Linear interpolation
        const alpha = (targetTime - from.timestamp) / (to.timestamp - from.timestamp);
        return {
          timestamp: targetTime,
          x: from.x + (to.x - from.x) * alpha,
          y: from.y + (to.y - from.y) * alpha,
          angle: from.angle + (to.angle - from.angle) * alpha,
        };
      }
    }

    // Fallback: use latest if ahead of buffer
    return buffer[buffer.length - 1];
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Position-only sync | Position + velocity sync | 2010s (Source engine) | Enables accurate reconciliation and smoother interpolation |
| Fixed 100ms interpolation delay | Adaptive buffering | 2020s | Better handling of variable network conditions |
| Full state updates | Delta compression (Colyseus Schema) | Colyseus 0.10+ | Reduced bandwidth, supports more players per server |
| TCP for game state | WebSocket (TCP) with unreliable message option | 2020s | Lower overhead than raw TCP, better than HTTP polling |
| Client-authoritative movement | Server-authoritative with prediction | 2000s (post-cheating era) | Security without sacrificing responsiveness |

**Deprecated/outdated:**
- **Phaser Arcade Physics on server:** Phaser 3 is browser-only. Use shared logic, not Phaser objects.
- **Colyseus 0.14 and earlier:** Breaking changes in 0.15 (Schema v2, new state sync). Project uses 0.15.57.
- **Sending inputs as strings:** Use typed messages (Colyseus message type system or JSON). Better performance and type safety.

## Open Questions

1. **Should interpolation delay be adaptive or fixed?**
   - What we know: Fixed 100ms works for most cases; adaptive adjusts to actual jitter/packet loss
   - What's unclear: Whether added complexity of adaptive buffering justified for 3-player game
   - Recommendation: Start with fixed 100ms, monitor for stutter, add adaptive only if needed

2. **Should we implement extrapolation for packet loss?**
   - What we know: Extrapolation predicts future position when snapshots missing; can cause overshoot
   - What's unclear: How often packet loss will occur on typical connections; tradeoff of complexity vs robustness
   - Recommendation: Defer to later phase; focus on sufficient buffering first

3. **How to handle player collision with acceleration physics?**
   - What we know: Phaser Arcade Physics handles collisions; need to integrate with prediction/reconciliation
   - What's unclear: Whether collision outcomes deterministic enough for replay
   - Recommendation: Defer collision to Phase 3 (combat); Phase 2 focuses on free movement only

4. **Should physics constants be server-sent or hard-coded in client?**
   - What we know: Server-sent enables runtime tuning; hard-coded reduces sync risk
   - What's unclear: Whether we'll tune balance frequently enough to justify runtime sync
   - Recommendation: Hard-code shared constants in Phase 2; add runtime config in Phase 6 (balancing)

## Sources

### Primary (HIGH confidence)
- Colyseus Official Docs - State synchronization: https://docs.colyseus.io/state
- Colyseus Official Tutorial - Client predicted input (Phaser): https://docs.colyseus.io/tutorial/phaser/client-predicted-input
- Phaser Official Docs - Arcade Physics: https://docs.phaser.io/phaser/concepts/physics/arcade
- Gabriel Gambetta - Client-Side Prediction and Server Reconciliation: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
- Gabriel Gambetta - Entity Interpolation: https://www.gabrielgambetta.com/entity-interpolation.html
- Gaffer On Games - Fix Your Timestep: https://gafferongames.com/post/fix_your_timestep/
- Gaffer On Games - Deterministic Lockstep: https://gafferongames.com/post/deterministic_lockstep/
- Context7 - Colyseus (/websites/colyseus_io): Client prediction patterns
- Context7 - Phaser (/websites/phaser_io): Arcade Physics API reference

### Secondary (MEDIUM confidence)
- Arnauld-Alex - Multiplayer Game with Colyseus & PixiJS: https://arnauld-alex.com/guiding-the-flock-building-a-realtime-multiplayer-game-architecture-in-typescript
- Game Developer - Game Feel Tips II: https://www.gamedeveloper.com/design/game-feel-tips-ii-speed-gravity-friction
- Valve Developer Community - Source Multiplayer Networking: https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
- MDN Web Docs - Math.atan2(): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2
- Gist by qingwei91 - How Multiplayer Games Sync State: https://gist.github.com/qingwei91/535fa1f6b73062a46d716b741637aa8d

### Tertiary (LOW confidence)
- Various WebSearch results on interpolation buffer sizing, input lag thresholds, monorepo patterns
- Community forum discussions on deterministic physics and prediction pitfalls

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Colyseus and Phaser already in project, prediction/interpolation patterns well-documented
- Architecture: HIGH - Gabriel Gambetta's articles are industry standard, Colyseus tutorials verified
- Pitfalls: HIGH - Common issues well-documented in Valve docs, Gambetta articles, and community forums
- Physics implementation: MEDIUM - Shared physics logic straightforward, but determinism requires careful testing

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - stable domain with mature patterns)
